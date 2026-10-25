import type { TenantContext } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { SchoolDatabaseKind } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { connectionStringOf } from './school-database-layout.js';
import type { TenantRegistry } from './tenant-registry.js';

// Nhóm kết nối cơ sở dữ liệu theo trường, có giới hạn (DT-SaaS phần S1a): số kết nối mỗi cơ sở dữ liệu của trường, tổng số
// nhóm mở cùng lúc, tự đóng khi không dùng quá hạn. Không bao giờ trả kết nối của trường khác với trường được hỏi

export interface TenantConnectionsOptions {
  // Số kết nối tối đa mỗi cơ sở dữ liệu của một trường (TENANT_POOL_MAX, mặc định 3)
  poolMax?: number;
  // Số nhóm kết nối mở cùng lúc, mỗi trường thường dùng hai đến ba nhóm (TENANT_POOL_SCHOOLS nhân số nhóm mỗi trường)
  maxPools?: number;
  // Nhóm không dùng quá thời gian này (giây) thì đóng
  idleSeconds?: number;
  // Kết nối rảnh trong nhóm đóng sau thời gian này (mili giây)
  connectionIdleMillis?: number;
  now?: () => number;
}

interface PoolEntry {
  database: Kysely<unknown>;
  schoolId: string;
  lastUsed: number;
}

// Nhóm vừa được dùng trong khoảng này không bị đóng để nhường chỗ, tránh đóng nhóm đang có truy vấn
const RECENT_USE_PROTECTION_MS = 5000;

export class TenantConnections {
  private readonly pools = new Map<string, PoolEntry>();
  private readonly poolMax: number;
  private readonly maxPools: number;
  private readonly idleMillis: number;
  private readonly connectionIdleMillis: number;
  private readonly now: () => number;
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly registry: TenantRegistry,
    options: TenantConnectionsOptions = {},
  ) {
    this.poolMax = options.poolMax ?? 3;
    this.maxPools = options.maxPools ?? 60;
    this.idleMillis = (options.idleSeconds ?? 600) * 1000;
    this.connectionIdleMillis = options.connectionIdleMillis ?? 30_000;
    this.now = options.now ?? (() => Date.now());
  }

  get poolCount(): number {
    return this.pools.size;
  }

  // Kết nối của một cơ sở dữ liệu của trường; lược đồ kiểu do bên gọi xác định
  database<Schema>(tenant: TenantContext, kind: SchoolDatabaseKind, name: string): Kysely<Schema> {
    const descriptor = this.registry.descriptorOf(tenant, kind, name);
    // Khóa gồm mã trường và thời điểm sửa mô tả nên đổi mật khẩu hay địa chỉ thì mở nhóm mới
    const key = `${tenant.schoolId}|${descriptor.id}|${descriptor.updatedAt}`;
    const now = this.now();
    let entry = this.pools.get(key);
    if (!entry) {
      this.makeRoom(now);
      entry = {
        database: createDatabase<unknown>(connectionStringOf(descriptor), {
          max: this.poolMax,
          idleTimeoutMillis: this.connectionIdleMillis,
        }),
        schoolId: tenant.schoolId,
        lastUsed: now,
      };
      this.pools.set(key, entry);
      this.ensureSweeper();
    }
    entry.lastUsed = now;
    return entry.database as Kysely<Schema>;
  }

  // Đóng nhóm của một cơ sở dữ liệu (ví dụ khóa năm học đã đóng để kết nối mới nhận chế độ chỉ đọc)
  async close(tenant: TenantContext, kind: SchoolDatabaseKind, name: string): Promise<void> {
    const descriptor = this.registry.descriptorOf(tenant, kind, name);
    const prefix = `${tenant.schoolId}|${descriptor.id}|`;
    await this.closeWhere((key) => key.startsWith(prefix));
  }

  async closeSchool(schoolId: string): Promise<void> {
    await this.closeWhere((key) => key.startsWith(`${schoolId}|`));
  }

  async closeAll(): Promise<void> {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
    await this.closeWhere(() => true);
  }

  // Đóng các nhóm không dùng quá hạn (gọi định kỳ và gọi tay trong kiểm thử)
  async sweepIdle(): Promise<number> {
    const threshold = this.now() - this.idleMillis;
    const stale = [...this.pools.entries()].filter(([, entry]) => entry.lastUsed < threshold).map(([key]) => key);
    await this.closeWhere((key) => stale.includes(key));
    return stale.length;
  }

  private async closeWhere(predicate: (key: string) => boolean): Promise<void> {
    const keys = [...this.pools.keys()].filter(predicate);
    const entries = keys.map((key) => this.pools.get(key) as PoolEntry);
    for (const key of keys) {
      this.pools.delete(key);
    }
    await Promise.all(entries.map((entry) => entry.database.destroy()));
  }

  // Đủ chỗ cho một nhóm mới: đóng nhóm lâu không dùng nhất, trừ nhóm vừa dùng
  private makeRoom(now: number): void {
    while (this.pools.size >= this.maxPools) {
      let oldestKey: string | undefined;
      let oldest = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.pools) {
        if (entry.lastUsed < oldest) {
          oldest = entry.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey === undefined || now - oldest < RECENT_USE_PROTECTION_MS) {
        return;
      }
      const entry = this.pools.get(oldestKey) as PoolEntry;
      this.pools.delete(oldestKey);
      void entry.database.destroy();
    }
  }

  private ensureSweeper(): void {
    if (this.sweeper) {
      return;
    }
    this.sweeper = setInterval(() => {
      void this.sweepIdle();
    }, 60_000);
    this.sweeper.unref();
  }
}

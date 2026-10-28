import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import { createDatabase, type IdentityDatabase, type TenancyRuntime } from '@school-management/database';
import { requireTenant } from '@school-management/server';
import { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from './configuration.js';
import { MEMORY_STORE_URL, MemoryStore, type CacheStore } from './memory-store.js';

export interface ScopedCache {
  get(name: string): Promise<string | null>;
  set(name: string, value: string, seconds: number): Promise<void>;
  // Đọc và xóa trong một giao dịch: giá trị chỉ dùng được một lần
  take(name: string): Promise<string | null>;
  delete(name: string): Promise<void>;
  // Tăng bộ đếm, đặt hạn ở lần đầu; trả giá trị sau khi tăng (đếm số lần gửi mã mỗi giờ, YCTD-323)
  increment(name: string, seconds: number): Promise<number>;
}

// Kết nối cơ sở dữ liệu định danh và Redis, đóng khi dịch vụ dừng. REDIS_URL=memory:// dùng kho trong bộ nhớ (một bản dịch vụ, hồ
// sơ thử nghiệm DT-SaaS S9)
@Injectable()
export class Infrastructure implements OnModuleDestroy {
  private readonly singleDatabase: Kysely<IdentityDatabase> | null;
  readonly redis: CacheStore;

  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.singleDatabase = tenancy ? null : createDatabase<IdentityDatabase>(configuration.databaseUrl);
    this.redis =
      configuration.redisUrl === MEMORY_STORE_URL
        ? new MemoryStore()
        : new Redis(configuration.redisUrl, { maxRetriesPerRequest: 3 });
  }

  // Chế độ một trường: cơ sở dữ liệu định danh duy nhất. Chế độ nhiều trường (DT-SaaS phần S1a): cơ sở dữ liệu định danh của
  // trường trong ngữ cảnh của yêu cầu; thiếu ngữ cảnh là lỗi
  get database(): Kysely<IdentityDatabase> {
    const tenant = requireTenant('cơ sở dữ liệu định danh');
    if (tenant && this.tenancy) {
      return this.tenancy.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    }
    return this.singleDatabase as Kysely<IdentityDatabase>;
  }

  // Tiền tố khóa Redis của dịch vụ: thêm tiền tố của trường ở chế độ nhiều trường để giới hạn đăng nhập, mã xác nhận, đếm lần
  // sai không lẫn giữa các trường; trường số 1 có tiền tố trống nên khóa hiện có còn đúng
  keyPrefix(): string {
    const tenant = requireTenant('bộ nhớ đệm định danh');
    return tenant?.keyPrefix
      ? `${this.configuration.redisKeyPrefix}:t:${tenant.keyPrefix}`
      : this.configuration.redisKeyPrefix;
  }

  // Kho tạm theo trường cho một nhóm khóa (DT-25): khóa luôn là `<keyPrefix()>:<nhóm>:<tên>`, mã nghiệp vụ không tự ghép khóa Redis
  scopedCache(namespace: string): ScopedCache {
    const store = this.redis;
    const key = (name: string) => `${this.keyPrefix()}:${namespace}:${name}`;
    return {
      get: (name) => store.get(key(name)),
      set: async (name, value, seconds) => {
        await store.set(key(name), value, 'EX', seconds);
      },
      take: async (name) => {
        const results = await store.multi().get(key(name)).del(key(name)).exec();
        const value = results?.[0]?.[1];
        return typeof value === 'string' ? value : null;
      },
      delete: async (name) => {
        await store.del(key(name));
      },
      increment: async (name, seconds) => {
        const count = await store.incr(key(name));
        if (count === 1) {
          await store.expire(key(name), seconds);
        }
        return count;
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    await this.singleDatabase?.destroy();
  }
}

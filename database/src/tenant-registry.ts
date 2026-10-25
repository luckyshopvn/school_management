import {
  decryptSecret,
  normalizeHost,
  type TenantContext,
  type TenantResolver,
} from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase, SchoolDatabaseKind } from '../platform/schema.js';
import { connectionStringOf, type DatabaseDescriptor } from './school-database-layout.js';
import { asDateText, loadCurrentPlan, vietnamDate } from './school-plans.js';

// Bộ phân giải tên miền thành trường của nền tảng nhiều trường (DT-SaaS phần S1a): đọc cơ sở dữ liệu nền tảng, giữ trong bộ
// nhớ ngữ cảnh trường, mô tả kết nối từng cơ sở dữ liệu và khóa của trường, làm mới sau một thời gian ngắn

export interface TenantRecord {
  context: TenantContext;
  databases: Map<string, DatabaseDescriptor & { id: string; updatedAt: number }>;
  loadedAt: number;
}

export interface TenantRegistryOptions {
  // Thời gian giữ bản đã nạp trước khi nạp lại ở lần phân giải tên miền kế tiếp (giây)
  cacheSeconds?: number;
  now?: () => number;
}

export function databaseKey(kind: SchoolDatabaseKind, name: string): string {
  return `${kind}:${name}`;
}

export class TenantRegistry implements TenantResolver {
  private readonly records = new Map<string, TenantRecord>();
  private readonly hostToSchool = new Map<string, { schoolId: string; at: number }>();
  private readonly cacheMillis: number;
  private readonly now: () => number;

  constructor(
    readonly platform: Kysely<PlatformDatabase>,
    private readonly masterKey: Buffer,
    options: TenantRegistryOptions = {},
  ) {
    this.cacheMillis = (options.cacheSeconds ?? 30) * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  // Tên miền đang phục vụ (trạng thái active) của một trường; tên miền chưa xác nhận hoặc đã tắt không phục vụ
  async resolveHost(host: string): Promise<TenantContext | null> {
    const normalized = normalizeHost(host);
    if (!normalized) {
      return null;
    }
    const cached = this.hostToSchool.get(normalized);
    const now = this.now();
    if (cached && now - cached.at < this.cacheMillis) {
      const record = this.records.get(cached.schoolId);
      if (record && now - record.loadedAt < this.cacheMillis) {
        return record.context;
      }
    }
    const row = await this.platform
      .selectFrom('school_domains')
      .select('school_id')
      .where('host', '=', normalized)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!row) {
      this.hostToSchool.delete(normalized);
      return null;
    }
    const record = await this.loadSchool(row.school_id);
    if (!record) {
      return null;
    }
    this.hostToSchool.set(normalized, { schoolId: row.school_id, at: now });
    return record.context;
  }

  // Nạp lại một trường (ngữ cảnh, mô tả kết nối, khóa); dùng khi tạo năm học mới, đổi trạng thái, đổi khóa
  async loadSchool(schoolId: string): Promise<TenantRecord | null> {
    const school = await this.platform.selectFrom('schools').selectAll().where('id', '=', schoolId).executeTakeFirst();
    if (!school) {
      this.records.delete(schoolId);
      return null;
    }
    const keys = await this.platform
      .selectFrom('school_keys')
      .selectAll()
      .where('school_id', '=', schoolId)
      .executeTakeFirst();
    const rows = await this.platform
      .selectFrom('school_databases')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('status', '!=', 'dropped')
      .execute();
    const context: TenantContext = {
      schoolId: school.id,
      code: school.code,
      name: school.name,
      status: school.status,
      dataClass: school.data_class,
      keyPrefix: school.key_prefix,
      yearDatabasePrefix: school.year_database_prefix,
      plan: await loadCurrentPlan(this.platform, school.id, vietnamDate(new Date(this.now()))),
      trialEndsOn: asDateText(school.trial_ends_on),
      paidUntil: asDateText(school.paid_until),
      ...(keys
        ? {
            childDataEncryptionKey: Buffer.from(
              decryptSecret(this.masterKey, keys.child_encryption_key_encrypted),
              'base64',
            ),
            childDataHashKey: Buffer.from(decryptSecret(this.masterKey, keys.child_hash_key_encrypted), 'base64'),
          }
        : {}),
    };
    const databases = new Map<string, DatabaseDescriptor & { id: string; updatedAt: number }>();
    for (const row of rows) {
      databases.set(databaseKey(row.kind, row.name), {
        id: row.id,
        updatedAt: row.updated_at.getTime(),
        kind: row.kind,
        name: row.name,
        layout: row.layout,
        host: row.host,
        port: row.port,
        databaseName: row.database_name,
        schemaName: row.schema_name,
        roleName: row.role_name,
        password: decryptSecret(this.masterKey, row.password_encrypted),
      });
    }
    const record: TenantRecord = { context, databases, loadedAt: this.now() };
    this.records.set(schoolId, record);
    return record;
  }

  // Bản đã nạp (đồng bộ). Thiếu nghĩa là chưa có yêu cầu nào của trường qua resolveHost hoặc loadSchool: đóng chặt
  recordOf(schoolId: string): TenantRecord {
    const record = this.records.get(schoolId);
    if (!record) {
      throw new Error(`Chưa nạp mô tả cơ sở dữ liệu của trường ${schoolId}`);
    }
    return record;
  }

  descriptorOf(
    tenant: TenantContext,
    kind: SchoolDatabaseKind,
    name: string,
  ): DatabaseDescriptor & { id: string; updatedAt: number } {
    const descriptor = this.recordOf(tenant.schoolId).databases.get(databaseKey(kind, name));
    if (!descriptor) {
      throw new Error(`Trường ${tenant.code} không có cơ sở dữ liệu ${kind} ${name}`);
    }
    return descriptor;
  }

  connectionString(tenant: TenantContext, kind: SchoolDatabaseKind, name: string): string {
    return connectionStringOf(this.descriptorOf(tenant, kind, name));
  }

  // Các trường đang phục vụ (cho bộ lập lịch theo trường ở S1b)
  async listServingSchoolIds(): Promise<string[]> {
    const rows = await this.platform
      .selectFrom('schools')
      .select('id')
      .where('status', 'in', ['trial', 'active', 'read_only'])
      .orderBy('code')
      .execute();
    return rows.map((row) => row.id);
  }

  invalidate(): void {
    this.records.clear();
    this.hostToSchool.clear();
  }
}

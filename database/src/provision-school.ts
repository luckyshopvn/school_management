import { randomBytes } from 'node:crypto';
import { encryptSecret, normalizeHost, validateSchoolCode } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type {
  PlatformDatabase,
  SchoolDataClassValue,
  SchoolDatabaseKind,
  SchoolStatusValue,
} from '../platform/schema.js';
import { migrateToLatest } from './migrate.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  schoolSlug,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';

// Dựng và gỡ một trường ở cơ sở dữ liệu nền tảng (DT-SaaS phần S1a). Hàm thư viện dùng cho lệnh dòng lệnh, kiểm thử và dựng
// thử; bước setup, vòng đời, xóa có thời gian chờ của phần S2 xây trên các hàm này

export function generateChildKeyPair(): { encryption: Buffer; hash: Buffer } {
  return { encryption: randomBytes(32), hash: randomBytes(32) };
}

// Lưu mô tả kết nối của một cơ sở dữ liệu của trường; mật khẩu mã hóa bằng khóa gốc của nền tảng
export async function registerDescriptor(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  schoolId: string,
  descriptor: DatabaseDescriptor,
  status: 'active' | 'read_only' = 'active',
): Promise<void> {
  await platform
    .insertInto('school_databases')
    .values({
      school_id: schoolId,
      kind: descriptor.kind,
      name: descriptor.name,
      layout: descriptor.layout,
      host: descriptor.host,
      port: descriptor.port,
      database_name: descriptor.databaseName,
      schema_name: descriptor.schemaName,
      role_name: descriptor.roleName,
      login_name: descriptor.loginName ?? null,
      password_encrypted: encryptSecret(masterKey, descriptor.password),
      status,
    })
    .execute();
}

export async function storeSchoolKeys(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  schoolId: string,
  keys: { encryption: Buffer; hash: Buffer },
): Promise<void> {
  await platform
    .insertInto('school_keys')
    .values({
      school_id: schoolId,
      child_encryption_key_encrypted: encryptSecret(masterKey, keys.encryption.toString('base64')),
      child_hash_key_encrypted: encryptSecret(masterKey, keys.hash.toString('base64')),
    })
    .execute();
}

export async function writeAudit(
  platform: Kysely<PlatformDatabase>,
  entry: {
    actorType: 'operator' | 'system' | 'cli';
    actorId?: string;
    action: string;
    schoolId?: string;
    details?: unknown;
  },
): Promise<void> {
  await platform
    .insertInto('platform_audit_log')
    .values({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      school_id: entry.schoolId ?? null,
      details: JSON.stringify(entry.details ?? {}),
      ip_address: null,
    })
    .execute();
}

export interface ProvisionSchoolOptions {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  layout: SchoolDatabaseLayout;
  code: string;
  name: string;
  // Tên miền phục vụ của trường (trạng thái active)
  domains: string[];
  dataClass?: SchoolDataClassValue;
  status?: SchoolStatusValue;
  // Máy chủ cơ sở dữ liệu của trường; mặc định lấy từ mô tả kết nối của lớp bố cục
  clusterName?: string;
  // Bố cục database: tên cơ sở dữ liệu mặc định s_<mã>_identity, s_<mã>_system; lược đồ trùng tên
  yearDatabasePrefix?: string;
  keyPrefix?: string;
  // Cơ sở dữ liệu năm học đầu tiên (tên cơ sở dữ liệu theo tiền tố): chỉ tạo khi cần cho kiểm thử, năm học thật do máy chủ API mở
  firstYear?: { startYear: number; endYear: number };
  // Chạy tệp thay đổi cấu trúc cho từng cơ sở dữ liệu vừa tạo (mặc định có)
  runMigrations?: boolean;
  host: string;
  port: number;
}

export interface ProvisionedSchool {
  schoolId: string;
  code: string;
  descriptors: DatabaseDescriptor[];
}

export function yearDatabaseName(prefix: string, startYear: number, endYear: number): string {
  return `${prefix}${startYear}_${endYear}`;
}

export async function provisionSchool(options: ProvisionSchoolOptions): Promise<ProvisionedSchool> {
  const problem = validateSchoolCode(options.code);
  if (problem) {
    throw new Error(problem);
  }
  const slug = schoolSlug(options.code);
  const hosts = options.domains.map((domain) => normalizeHost(domain));
  if (hosts.some((host) => !host)) {
    throw new Error('Tên miền không hợp lệ');
  }
  const { platform, masterKey } = options;
  const clusterName = options.clusterName ?? `${options.host}:${options.port}`;
  const cluster = await platform
    .insertInto('school_clusters')
    .values({ name: clusterName, host: options.host, port: options.port })
    .onConflict((conflict) => conflict.column('name').doUpdateSet({ host: options.host }))
    .returning('id')
    .executeTakeFirstOrThrow();
  const yearPrefix = options.yearDatabasePrefix ?? `s_${slug}_year_`;
  const school = await platform
    .insertInto('schools')
    .values({
      code: options.code,
      name: options.name,
      status: 'provisioning',
      data_class: options.dataClass ?? 'synthetic',
      cluster_id: cluster.id,
      key_prefix: options.keyPrefix ?? options.code,
      year_database_prefix: yearPrefix,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await storeSchoolKeys(platform, masterKey, school.id, generateChildKeyPair());

  const schoolRolePassword = generatePassword();
  const descriptors: DatabaseDescriptor[] = [];
  const plan: Array<{ kind: SchoolDatabaseKind; logicalName: string; physicalName: string }> = [
    { kind: 'identity', logicalName: 'identity', physicalName: `s_${slug}_identity` },
    { kind: 'system', logicalName: 'system', physicalName: `s_${slug}_system` },
  ];
  if (options.firstYear) {
    const name = yearDatabaseName(yearPrefix, options.firstYear.startYear, options.firstYear.endYear);
    plan.push({ kind: 'school-year', logicalName: name, physicalName: name });
  }
  for (const item of plan) {
    const descriptor = await options.layout.create({
      schoolCode: options.code,
      kind: item.kind,
      logicalName: item.logicalName,
      physicalName: item.physicalName,
      schoolRolePassword,
    });
    await registerDescriptor(platform, masterKey, school.id, descriptor);
    descriptors.push(descriptor);
    if (options.runMigrations !== false) {
      const migration = await migrateToLatest(item.kind, connectionStringOf(descriptor));
      if (migration.error) {
        throw migration.error;
      }
    }
  }
  for (const host of hosts as string[]) {
    await platform
      .insertInto('school_domains')
      .values({ school_id: school.id, host, status: 'active', verified_at: new Date() })
      .execute();
  }
  await platform
    .updateTable('schools')
    .set({ status: options.status ?? 'active', updated_at: new Date() })
    .where('id', '=', school.id)
    .execute();
  await writeAudit(platform, {
    actorType: 'cli',
    action: 'school.provision',
    schoolId: school.id,
    details: { code: options.code },
  });
  return { schoolId: school.id, code: options.code, descriptors };
}

// Gỡ một trường: xóa mọi cơ sở dữ liệu, vai trò và hàng ở nền tảng (dùng cho kiểm thử và dọn dẹp; xóa có thời gian chờ ở S2)
export async function dropSchool(options: {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  layout: SchoolDatabaseLayout;
  schoolId: string;
}): Promise<void> {
  const { platform, layout } = options;
  const school = await platform
    .selectFrom('schools')
    .select(['code'])
    .where('id', '=', options.schoolId)
    .executeTakeFirst();
  if (!school) {
    return;
  }
  const rows = await platform
    .selectFrom('school_databases')
    .selectAll()
    .where('school_id', '=', options.schoolId)
    .execute();
  for (const row of rows) {
    await layout.drop(descriptorFromRow(row, options.masterKey));
  }
  await layout.dropSchoolRole(school.code);
  await platform.deleteFrom('schools').where('id', '=', options.schoolId).execute();
  await writeAudit(platform, { actorType: 'cli', action: 'school.drop', details: { code: school.code } });
}

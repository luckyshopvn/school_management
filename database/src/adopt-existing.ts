import { encryptSecret, normalizeHost, validateSchoolCode } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase, SchoolDataClassValue, SchoolStatusValue } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { writeAudit } from './provision-school.js';
import type { SystemDatabase } from '../system/schema.js';

// Nhận bản triển khai đang chạy làm trường số 1 của nền tảng (DT-SaaS phần S1a, tài liệu 47 mục 14.5): chỉ ghi cơ sở dữ liệu nền
// tảng và dùng lại cơ sở dữ liệu hiện có, tiền tố khóa trống, khóa dữ liệu trẻ nhập từ cấu hình hiện tại; KHÔNG đổi tên, KHÔNG
// sao chép dữ liệu. Chạy lặp được: lần sau cập nhật mô tả kết nối, khóa, tên miền, thêm cơ sở dữ liệu năm học mới

export interface AdoptExistingOptions {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  code: string;
  name: string;
  domains: string[];
  // Địa chỉ kết nối của bản đang chạy (IDENTITY_DATABASE_URL, SYSTEM_DATABASE_URL); cơ sở dữ liệu năm học dùng tài khoản của hệ thống
  identityUrl: string;
  systemUrl: string;
  // SCHOOL_YEAR_DATABASE_PREFIX hiện có
  yearDatabasePrefix: string;
  childEncryptionKey: Buffer;
  childHashKey: Buffer;
  dataClass?: SchoolDataClassValue;
  status?: SchoolStatusValue;
}

export interface AdoptResult {
  schoolId: string;
  created: boolean;
  databases: string[];
  domains: string[];
}

interface ParsedUrl {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function parseConnection(url: string, what: string): ParsedUrl {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '');
  if (!database || !parsed.username) {
    throw new Error(`${what} thiếu tên cơ sở dữ liệu hoặc tài khoản kết nối`);
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

// Tên miền từ giá trị biến môi trường dạng `portal.truong.vn`, `http://portal.truong.vn` hoặc có cổng, đường dẫn
export function hostFromSiteSetting(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }
  const withoutScheme = text.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  return normalizeHost(withoutScheme);
}

export async function adoptExistingSchool(options: AdoptExistingOptions): Promise<AdoptResult> {
  const problem = validateSchoolCode(options.code);
  if (problem) {
    throw new Error(problem);
  }
  if (options.childEncryptionKey.length !== 32 || options.childHashKey.length !== 32) {
    throw new Error('Khóa mã hóa và khóa băm dữ liệu trẻ phải đủ 32 byte');
  }
  const hosts = [...new Set(options.domains.map((domain) => normalizeHost(domain)))];
  if (hosts.length === 0 || hosts.some((host) => !host)) {
    throw new Error('Cần ít nhất một tên miền hợp lệ cho trường số 1');
  }
  const identity = parseConnection(options.identityUrl, 'Địa chỉ cơ sở dữ liệu định danh');
  const system = parseConnection(options.systemUrl, 'Địa chỉ cơ sở dữ liệu hệ thống');
  const { platform, masterKey } = options;

  // Danh sách cơ sở dữ liệu năm học đang có (đọc ở cơ sở dữ liệu hệ thống, không ghi gì)
  const systemDatabase = createDatabase<SystemDatabase>(options.systemUrl, { max: 1 });
  let yearRows: Array<{ database_name: string; status: string }>;
  try {
    yearRows = await systemDatabase.selectFrom('academic_year_databases').select(['database_name', 'status']).execute();
  } finally {
    await systemDatabase.destroy();
  }

  const existing = await platform
    .selectFrom('schools')
    .select(['id', 'legacy', 'code'])
    .where((builder) => builder.or([builder('code', '=', options.code), builder('legacy', '=', true)]))
    .execute();
  if (existing.some((row) => row.code !== options.code)) {
    throw new Error('Nền tảng đã có trường số 1 mang mã khác; không nhận thêm bản đang chạy thứ hai');
  }
  const found = existing[0];
  const clusterName = `${system.host}:${system.port}`;
  const cluster = await platform
    .insertInto('school_clusters')
    .values({ name: clusterName, host: system.host, port: system.port })
    .onConflict((conflict) => conflict.column('name').doUpdateSet({ host: system.host }))
    .returning('id')
    .executeTakeFirstOrThrow();

  let schoolId: string;
  let created = false;
  if (found) {
    schoolId = found.id;
    await platform
      .updateTable('schools')
      .set({
        name: options.name,
        cluster_id: cluster.id,
        year_database_prefix: options.yearDatabasePrefix,
        legacy: true,
        updated_at: new Date(),
      })
      .where('id', '=', schoolId)
      .execute();
  } else {
    const inserted = await platform
      .insertInto('schools')
      .values({
        code: options.code,
        name: options.name,
        status: options.status ?? 'active',
        data_class: options.dataClass ?? 'production',
        cluster_id: cluster.id,
        key_prefix: '',
        year_database_prefix: options.yearDatabasePrefix,
        legacy: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    schoolId = inserted.id;
    created = true;
  }

  const upsertDatabase = async (
    kind: 'identity' | 'system' | 'school-year',
    name: string,
    connection: ParsedUrl,
    databaseName: string,
    status: 'active' | 'read_only',
  ): Promise<void> => {
    await platform
      .insertInto('school_databases')
      .values({
        school_id: schoolId,
        kind,
        name,
        layout: 'database',
        host: connection.host,
        port: connection.port,
        database_name: databaseName,
        schema_name: null,
        role_name: connection.user,
        password_encrypted: encryptSecret(masterKey, connection.password),
        status,
      })
      .onConflict((conflict) =>
        conflict.columns(['school_id', 'kind', 'name']).doUpdateSet({
          host: connection.host,
          port: connection.port,
          database_name: databaseName,
          role_name: connection.user,
          password_encrypted: encryptSecret(masterKey, connection.password),
          status,
          updated_at: new Date(),
        }),
      )
      .execute();
  };
  await upsertDatabase('identity', 'identity', identity, identity.database, 'active');
  await upsertDatabase('system', 'system', system, system.database, 'active');
  for (const row of yearRows) {
    await upsertDatabase(
      'school-year',
      row.database_name,
      system,
      row.database_name,
      row.status === 'read_only' ? 'read_only' : 'active',
    );
  }

  await platform
    .insertInto('school_keys')
    .values({
      school_id: schoolId,
      child_encryption_key_encrypted: encryptSecret(masterKey, options.childEncryptionKey.toString('base64')),
      child_hash_key_encrypted: encryptSecret(masterKey, options.childHashKey.toString('base64')),
    })
    .onConflict((conflict) =>
      conflict.column('school_id').doUpdateSet({
        child_encryption_key_encrypted: encryptSecret(masterKey, options.childEncryptionKey.toString('base64')),
        child_hash_key_encrypted: encryptSecret(masterKey, options.childHashKey.toString('base64')),
      }),
    )
    .execute();

  for (const host of hosts as string[]) {
    await platform
      .insertInto('school_domains')
      .values({ school_id: schoolId, host, kind: 'system', status: 'active', verified_at: new Date() })
      .onConflict((conflict) => conflict.column('host').doUpdateSet({ status: 'active', updated_at: new Date() }))
      .execute();
  }
  await writeAudit(platform, {
    actorType: 'cli',
    action: created ? 'school.adopt-existing' : 'school.adopt-existing-refresh',
    schoolId,
    details: { code: options.code, years: yearRows.length },
  });
  return {
    schoolId,
    created,
    databases: ['identity', 'system', ...yearRows.map((row) => row.database_name)],
    domains: hosts as string[],
  };
}

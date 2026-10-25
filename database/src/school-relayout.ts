import { sql, type Kysely } from 'kysely';
import { decryptSecret } from '@school-management/server/tenancy';
import type { PlatformDatabase, SchoolDatabaseKind } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { registerDescriptor, storeSchoolKeys, writeAudit } from './provision-school.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  schoolSlug,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import type { Actor } from './school-lifecycle.js';

// Chuyển một trường sang nền tảng khác hoặc bố cục khác mà không sửa mã (DT-SaaS phần S9, YCTD-203; tài liệu 32 mục 14.5 "Chuyển
// lên VPS không sửa mã"): từ hồ sơ thử nghiệm (bố cục schema ở Neon, Supabase) sang hồ sơ vận hành (bố cục database ở VPS trong
// nước), hoặc ngược lại. Các bước:
// 1. trường nguồn phải đang tạm dừng hoặc chỉ đọc để dữ liệu không đổi trong lúc chép;
// 2. ở nền tảng đích: ghi trường (cùng mã, tiền tố khóa, tiền tố tên năm học), khóa dữ liệu trẻ bọc lại bằng khóa gốc của nền tảng
//    đích, tên miền, hồ sơ đồng ý, vùng máy chủ; tạo từng cơ sở dữ liệu (hoặc lược đồ) theo bố cục đích và chạy migrate;
// 3. chép dữ liệu từng bảng bằng tài khoản quản trị của đích trong một giao dịch mỗi cơ sở dữ liệu (xóa dữ liệu mặc định của
//    migrate, tắt kiểm tra khóa ngoại và trigger bằng session_replication_role, chép theo trang, đặt lại bộ đếm tự tăng);
// 4. so số dòng và tổng kiểm (md5 của các dòng đã sắp) từng bảng giữa nguồn và đích; lệch thì báo lỗi, không bật trường;
// 5. trường ở đích giữ trạng thái của nguồn; đổi loại dữ liệu sang `production`, ghi vùng máy chủ mới, bật lại trường và xóa
//    trường ở nền tảng nguồn là bước của người vận hành sau khi kiểm tra (tệp chép bằng công cụ S3 như rclone, giữ nguyên khóa)
// Tài khoản quản trị của đích cần quyền siêu người dùng (session_replication_role); máy chủ tự dựng ở VPS có quyền này
export interface RelayoutSide {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
}

export interface RelayoutTarget extends RelayoutSide {
  layout: SchoolDatabaseLayout;
  adminUrl: string;
}

export interface RelayoutTableReport {
  database: string;
  table: string;
  rows: number;
  checksumMatches: boolean;
}

export interface RelayoutReport {
  code: string;
  databases: string[];
  tables: RelayoutTableReport[];
}

const SKIPPED_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);
const PAGE_ROWS = 500;

interface ColumnInfo {
  name: string;
  dataType: string;
  generated: boolean;
  identityAlways: boolean;
  serial: boolean;
}

async function listTables(database: Kysely<unknown>, schema: string): Promise<string[]> {
  const result = await sql<{ table_name: string }>`
    select table_name from information_schema.tables
    where table_schema = ${schema} and table_type = 'BASE TABLE' order by table_name`.execute(database);
  return result.rows.map((row) => row.table_name).filter((name) => !SKIPPED_TABLES.has(name));
}

async function listColumns(database: Kysely<unknown>, schema: string, table: string): Promise<ColumnInfo[]> {
  const result = await sql<{
    column_name: string;
    data_type: string;
    is_generated: string;
    identity_generation: string | null;
    column_default: string | null;
  }>`
    select column_name, data_type, is_generated, identity_generation, column_default from information_schema.columns
    where table_schema = ${schema} and table_name = ${table} order by ordinal_position`.execute(database);
  return result.rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    generated: row.is_generated === 'ALWAYS',
    identityAlways: row.identity_generation === 'ALWAYS',
    serial: row.identity_generation !== null || (row.column_default ?? '').startsWith('nextval('),
  }));
}

async function currentSchema(database: Kysely<unknown>): Promise<string> {
  const result = await sql<{ schema: string }>`select current_schema() as schema`.execute(database);
  return result.rows[0]?.schema ?? 'public';
}

// Tổng kiểm một bảng: số dòng và md5 của các dòng (dạng văn bản) đã sắp; hai nơi cùng cấu trúc thì cùng kết quả
async function tableChecksum(
  database: Kysely<unknown>,
  schema: string,
  table: string,
  columns: string[],
): Promise<{ rows: number; checksum: string }> {
  const list = sql.join(
    columns.map((column) => sql`${sql.ref(`t.${column}`)}::text`),
    sql`, `,
  );
  // Dạng văn bản của mốc thời gian theo múi giờ của phiên: cố định múi giờ, kiểu ngày trong giao dịch ở cả hai nơi
  const result = await database.transaction().execute(async (transaction) => {
    await sql`set local timezone = 'UTC'`.execute(transaction);
    await sql`set local datestyle = 'ISO, YMD'`.execute(transaction);
    return sql<{ rows: string; checksum: string | null }>`
    select count(*)::text as rows,
      md5(coalesce(string_agg(r.h, '' order by r.h), '')) as checksum
    from (select md5(concat_ws('|', ${list})) as h from ${sql.table(`${schema}.${table}`)} as t) as r`.execute(
      transaction,
    );
  });
  return { rows: Number(result.rows[0]?.rows ?? 0), checksum: result.rows[0]?.checksum ?? '' };
}

async function copyDatabase(
  source: DatabaseDescriptor,
  target: DatabaseDescriptor,
  adminUrl: string,
  report: RelayoutTableReport[],
  onProgress?: (line: string) => void,
): Promise<void> {
  const sourceDatabase = createDatabase<unknown>(connectionStringOf(source), { max: 1 });
  const targetDatabase = createDatabase<unknown>(replaceDatabaseName(adminUrl, target.databaseName), { max: 1 });
  try {
    const sourceSchema = source.schemaName ?? (await currentSchema(sourceDatabase));
    const targetSchema = target.schemaName ?? 'public';
    const tables = await listTables(sourceDatabase, sourceSchema);
    const targetTables = new Set(await listTables(targetDatabase, targetSchema));
    const missing = tables.filter((table) => !targetTables.has(table));
    if (missing.length > 0) {
      throw new Error(`Đích thiếu bảng ${missing.join(', ')} (${target.name}); chạy cùng phiên bản mã ở hai nơi`);
    }
    const columnsByTable = new Map<string, ColumnInfo[]>();
    for (const table of tables) {
      columnsByTable.set(table, await listColumns(sourceDatabase, sourceSchema, table));
    }
    await targetDatabase.transaction().execute(async (transaction) => {
      await sql`set local session_replication_role = replica`.execute(transaction);
      if (tables.length > 0) {
        const list = sql.join(
          tables.map((table) => sql.table(`${targetSchema}.${table}`)),
          sql`, `,
        );
        await sql`truncate table ${list} restart identity cascade`.execute(transaction);
      }
      for (const table of tables) {
        const columns = (columnsByTable.get(table) ?? []).filter((column) => !column.generated);
        const names = columns.map((column) => column.name);
        const overriding = columns.some((column) => column.identityAlways) ? sql`overriding system value` : sql``;
        const pageRows = Math.max(1, Math.min(PAGE_ROWS, Math.floor(30_000 / Math.max(1, names.length))));
        for (let offset = 0; ; offset += pageRows) {
          // Đọc mọi cột ở dạng văn bản của PostgreSQL (giữ đủ phần micro giây của mốc thời gian, số thập phân, JSON, mảng); câu
          // lệnh chèn ép lại về kiểu của cột đích
          const page = await sourceDatabase.transaction().execute(async (transaction) => {
            await sql`set local datestyle = 'ISO, YMD'`.execute(transaction);
            await sql`set local intervalstyle = 'postgres'`.execute(transaction);
            return sql<Record<string, string | null>>`
              select ${sql.join(
                names.map((name) => sql`${sql.ref(name)}::text as ${sql.ref(name)}`),
                sql`, `,
              )} from ${sql.table(`${sourceSchema}.${table}`)}
              order by ctid limit ${pageRows} offset ${offset}`.execute(transaction);
          });
          if (page.rows.length === 0) {
            break;
          }
          const values = page.rows.map((row) => sql`(${sql.join(names.map((name) => row[name] ?? null))})`);
          await sql`insert into ${sql.table(`${targetSchema}.${table}`)}
            (${sql.join(
              names.map((name) => sql.ref(name)),
              sql`, `,
            )}) ${overriding} values ${sql.join(values, sql`, `)}`.execute(transaction);
          if (page.rows.length < pageRows) {
            break;
          }
        }
        for (const column of columns.filter((item) => item.serial)) {
          await sql`select setval(pg_get_serial_sequence(${`${targetSchema}.${table}`}, ${column.name}),
            coalesce((select max(${sql.ref(column.name)}) from ${sql.table(`${targetSchema}.${table}`)}), 0) + 1, false)`.execute(
            transaction,
          );
        }
      }
    });
    for (const table of tables) {
      const names = (columnsByTable.get(table) ?? []).map((column) => column.name);
      const before = await tableChecksum(sourceDatabase, sourceSchema, table, names);
      const after = await tableChecksum(targetDatabase, targetSchema, table, names);
      const matches = before.rows === after.rows && before.checksum === after.checksum;
      report.push({ database: target.name, table, rows: after.rows, checksumMatches: matches });
      if (!matches) {
        throw new Error(`Lệch dữ liệu ở ${target.name}.${table}: nguồn ${before.rows} dòng, đích ${after.rows} dòng`);
      }
    }
    onProgress?.(`${target.kind}:${target.name}: ${tables.length} bảng đã chép, khớp số dòng và tổng kiểm`);
  } finally {
    await sourceDatabase.destroy();
    await targetDatabase.destroy();
  }
}

export async function relayoutSchool(options: {
  source: RelayoutSide;
  target: RelayoutTarget;
  code: string;
  actor: Actor;
  onProgress?: (line: string) => void;
}): Promise<RelayoutReport> {
  const { source, target, code, actor } = options;
  const school = await source.platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
  if (!school) {
    throw new Error(`Không tìm thấy trường ${code} ở nền tảng nguồn`);
  }
  if (school.status !== 'suspended' && school.status !== 'read_only') {
    throw new Error(
      'Tạm dừng hoặc chuyển chỉ đọc trường nguồn trước khi chuyển (dữ liệu không được đổi trong lúc chép)',
    );
  }
  const exists = await target.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
  if (exists) {
    throw new Error(`Nền tảng đích đã có trường ${code}; xóa trường đó trước khi chuyển lại`);
  }
  const keys = await source.platform
    .selectFrom('school_keys')
    .selectAll()
    .where('school_id', '=', school.id)
    .executeTakeFirst();
  const sourceDescriptors = (
    await source.platform
      .selectFrom('school_databases')
      .selectAll()
      .where('school_id', '=', school.id)
      .where('status', '!=', 'dropped')
      .execute()
  ).map((row) => ({ descriptor: descriptorFromRow(row, source.masterKey), status: row.status }));
  const order: SchoolDatabaseKind[] = ['identity', 'system', 'school-year'];
  sourceDescriptors.sort((left, right) => order.indexOf(left.descriptor.kind) - order.indexOf(right.descriptor.kind));

  const created = await target.platform
    .insertInto('schools')
    .values({
      code: school.code,
      name: school.name,
      status: 'provisioning',
      data_class: school.data_class,
      key_prefix: school.key_prefix,
      year_database_prefix: school.year_database_prefix,
      notes: school.notes,
      address: school.address,
      school_levels: JSON.stringify(school.school_levels ?? []),
      first_academic_year: school.first_academic_year,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (keys) {
    await storeSchoolKeys(target.platform, target.masterKey, created.id, {
      encryption: Buffer.from(decryptSecret(source.masterKey, keys.child_encryption_key_encrypted), 'base64'),
      hash: Buffer.from(decryptSecret(source.masterKey, keys.child_hash_key_encrypted), 'base64'),
    });
  }
  const domains = await source.platform
    .selectFrom('school_domains')
    .select([
      'host',
      'kind',
      'status',
      'verified_at',
      'provider',
      'verification_token',
      'cname_target',
      'last_checked_at',
      'check_error',
    ])
    .where('school_id', '=', school.id)
    .execute();
  for (const domain of domains) {
    await target.platform
      .insertInto('school_domains')
      .values({ ...domain, school_id: created.id })
      .execute();
  }
  // Hồ sơ đồng ý giữ nguyên; người ghi ở nền tảng nguồn không có ở đích nên chỉ giữ tên người ghi
  const consents = await source.platform
    .selectFrom('school_consents')
    .select([
      'kind',
      'template_code',
      'template_version',
      'signer_name',
      'signer_title',
      'signed_on',
      'valid_from',
      'valid_until',
      'data_scope',
      'hosting_snapshot',
      'file_sha256',
      'file_key',
      'file_name',
      'submitted_to_authority_on',
      'authority_reference',
      'recorded_by_name',
      'withdrawn_on',
    ])
    .where('school_id', '=', school.id)
    .execute();
  for (const consent of consents) {
    await target.platform
      .insertInto('school_consents')
      .values({
        ...consent,
        school_id: created.id,
        recorded_by: null,
        hosting_snapshot: JSON.stringify(consent.hosting_snapshot ?? []),
      })
      .execute();
  }
  const hostingRows = await source.platform
    .selectFrom('school_hosting')
    .select(['provider', 'service', 'region', 'role', 'stores_personal_data', 'started_on', 'ended_on'])
    .where('school_id', '=', school.id)
    .execute();
  for (const hosting of hostingRows) {
    await target.platform
      .insertInto('school_hosting')
      .values({ ...hosting, school_id: created.id })
      .execute();
  }

  const report: RelayoutReport = { code, databases: [], tables: [] };
  const slug = schoolSlug(code);
  const rolePassword = generatePassword();
  for (const { descriptor, status } of sourceDescriptors) {
    const physicalName =
      descriptor.kind === 'identity'
        ? `s_${slug}_identity`
        : descriptor.kind === 'system'
          ? `s_${slug}_system`
          : descriptor.name;
    const targetDescriptor = await target.layout.create({
      schoolCode: code,
      kind: descriptor.kind,
      logicalName: descriptor.name,
      physicalName,
      schoolRolePassword: rolePassword,
    });
    await registerDescriptor(target.platform, target.masterKey, created.id, targetDescriptor);
    const migration = await migrateToLatest(descriptor.kind, connectionStringOf(targetDescriptor));
    if (migration.error) {
      throw migration.error;
    }
    await copyDatabase(descriptor, targetDescriptor, target.adminUrl, report.tables, options.onProgress);
    if (status === 'read_only') {
      await target.layout.setReadOnly(targetDescriptor, true);
      await target.platform
        .updateTable('school_databases')
        .set({ status: 'read_only' })
        .where('school_id', '=', created.id)
        .where('kind', '=', descriptor.kind)
        .where('name', '=', descriptor.name)
        .execute();
    }
    report.databases.push(`${descriptor.kind}:${descriptor.name}`);
  }

  await target.platform
    .updateTable('schools')
    .set({ status: school.status, suspended_at: school.suspended_at, updated_at: new Date() })
    .where('id', '=', created.id)
    .execute();
  await target.platform
    .insertInto('school_lifecycle_events')
    .values({
      school_id: created.id,
      event: 'relayout-imported',
      from_status: null,
      to_status: school.status,
      reason: `Chuyển từ nền tảng khác: ${report.databases.length} cơ sở dữ liệu, ${report.tables.length} bảng khớp`,
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    })
    .execute();
  await writeAudit(target.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.relayout-imported',
    schoolId: created.id,
    details: { code, databases: report.databases, tables: report.tables.length },
  });
  await writeAudit(source.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.relayout-exported',
    schoolId: school.id,
    details: { code, databases: report.databases, tables: report.tables.length },
  });
  return report;
}

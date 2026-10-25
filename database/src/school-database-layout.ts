import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { replaceDatabaseName } from './environment.js';
import type { SchoolDatabaseKind, SchoolDatabaseLayoutValue } from '../platform/schema.js';
import { decryptSecret } from '@school-management/server/tenancy';
import { VIETNAM_TIMEZONE } from './timezone.js';

// Bố cục cơ sở dữ liệu của một trường (DT-SaaS phần S1a, tài liệu 32 mục 14.4):
// - database: mỗi cơ sở dữ liệu riêng của trường, một vai trò PostgreSQL `s_<mã>` sở hữu và là vai trò kết nối duy nhất;
// - schema: mỗi lược đồ riêng trong một cơ sở dữ liệu dùng chung (hồ sơ thử nghiệm, gói miễn phí giới hạn số cơ sở dữ liệu),
//   mỗi lược đồ một vai trò riêng chỉ có quyền trên lược đồ đó, `search_path` đặt ở mức vai trò nên mã truy vấn không đổi
// Mã nghiệp vụ không biết bố cục: chỉ đọc mô tả kết nối ở bảng school_databases

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export function assertIdentifier(value: string, what: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${what} không hợp lệ: ${value}`);
  }
}

// Mã trường có gạch ngang, tên cơ sở dữ liệu và vai trò chỉ có gạch dưới
export function schoolSlug(code: string): string {
  return code.replaceAll('-', '_');
}

export function schoolRoleName(code: string): string {
  return `s_${schoolSlug(code)}`;
}

export function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

export interface DatabaseDescriptor {
  kind: SchoolDatabaseKind;
  // Tên logic: 'identity', 'system' hoặc tên cơ sở dữ liệu năm học
  name: string;
  layout: SchoolDatabaseLayoutValue;
  host: string;
  port: number;
  databaseName: string;
  schemaName: string | null;
  roleName: string;
  // Tên đăng nhập khi khác tên vai trò: bộ gom kết nối của Supabase nhận `<vai trò>.<mã dự án>` (DT-SaaS phần S9)
  loginName?: string | null;
  password: string;
}

export function connectionStringOf(descriptor: DatabaseDescriptor): string {
  const url = new URL('postgres://placeholder');
  url.hostname = descriptor.host;
  url.port = String(descriptor.port);
  url.username = descriptor.loginName || descriptor.roleName;
  url.password = descriptor.password;
  url.pathname = `/${descriptor.databaseName}`;
  return url.toString();
}

export interface CreateSchoolDatabaseRequest {
  schoolCode: string;
  kind: SchoolDatabaseKind;
  logicalName: string;
  // Tên cơ sở dữ liệu (bố cục database) hoặc tên lược đồ và vai trò (bố cục schema)
  physicalName: string;
  // Mật khẩu của vai trò trường dùng chung cho mọi cơ sở dữ liệu của trường ở bố cục database
  schoolRolePassword: string;
}

export interface SchoolDatabaseLayout {
  readonly kind: SchoolDatabaseLayoutValue;
  create(request: CreateSchoolDatabaseRequest): Promise<DatabaseDescriptor>;
  // Xóa cơ sở dữ liệu hoặc lược đồ và vai trò riêng của nó
  drop(descriptor: DatabaseDescriptor): Promise<void>;
  // Khóa ghi (năm học đã đóng) hoặc mở lại; kết nối đang mở giữ cài đặt cũ cho tới khi mở kết nối mới
  setReadOnly(descriptor: DatabaseDescriptor, readOnly: boolean): Promise<void>;
  // Xóa vai trò của trường sau khi đã xóa hết cơ sở dữ liệu (không có việc ở bố cục schema)
  dropSchoolRole(schoolCode: string): Promise<void>;
}

export interface LayoutEnvironment {
  // Tài khoản quản trị có quyền tạo cơ sở dữ liệu và vai trò (cấp nền tảng, không phải của một trường)
  adminUrl: string;
  // Máy chủ và cổng ghi vào mô tả kết nối; mặc định lấy từ adminUrl
  host?: string;
  port?: number;
  // Bố cục schema: cơ sở dữ liệu dùng chung chứa các lược đồ của mọi trường
  sharedDatabase?: string;
  // Hậu tố tên đăng nhập qua bộ gom kết nối của nhà cung cấp (Supabase: `.<mã dự án>`); trống là đăng nhập bằng tên vai trò
  loginSuffix?: string;
  // Thu hồi quyền kết nối mặc định của PUBLIC vào cơ sở dữ liệu dùng chung (mặc định có). Supabase để không, vì dịch vụ của
  // Supabase (kho tệp, xác thực) kết nối cùng cơ sở dữ liệu; cách ly vẫn bằng quyền trên lược đồ và search_path mức vai trò
  revokePublicConnect?: boolean;
}

function loginOf(environment: LayoutEnvironment, roleName: string): string | null {
  return environment.loginSuffix ? `${roleName}${environment.loginSuffix}` : null;
}

// Mô tả kết nối từ một dòng của `school_databases` (mật khẩu giải mã bằng khóa gốc)
export function descriptorFromRow(
  row: {
    kind: SchoolDatabaseKind;
    name: string;
    layout: SchoolDatabaseLayoutValue;
    host: string;
    port: number;
    database_name: string;
    schema_name: string | null;
    role_name: string;
    login_name?: string | null;
    password_encrypted: string;
  },
  masterKey: Buffer,
): DatabaseDescriptor {
  return {
    kind: row.kind,
    name: row.name,
    layout: row.layout,
    host: row.host,
    port: row.port,
    databaseName: row.database_name,
    schemaName: row.schema_name,
    roleName: row.role_name,
    loginName: row.login_name ?? null,
    password: decryptSecret(masterKey, row.password_encrypted),
  };
}

function hostOf(environment: LayoutEnvironment): { host: string; port: number } {
  const url = new URL(environment.adminUrl);
  return {
    host: environment.host ?? url.hostname,
    port: environment.port ?? (url.port ? Number(url.port) : 5432),
  };
}

// Gỡ lược đồ của trường theo lô: mỗi lô vài chục bảng một giao dịch rồi mới gỡ lược đồ. `drop schema ... cascade` một lần giữ khóa
// của mọi bảng, chỉ mục trong một giao dịch, lược đồ năm học có hàng trăm bảng nên vượt bảng khóa dùng chung của máy chủ ("out of
// shared memory") khi nhiều trường cùng thao tác; gói miễn phí của Neon, Supabase không đổi được max_locks_per_transaction
const DROP_BATCH = 40;

async function dropSchemaInBatches(database: ReturnType<typeof createDatabase<unknown>>, name: string): Promise<void> {
  const tables = await sql<{ relname: string }>`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${name} and c.relkind in ('r', 'p') and not c.relispartition`.execute(database);
  const names = tables.rows.map((row) => row.relname);
  for (let index = 0; index < names.length; index += DROP_BATCH) {
    const batch = names.slice(index, index + DROP_BATCH).map((table) => sql`${sql.id(name, table)}`);
    await sql`drop table if exists ${sql.join(batch)} cascade`.execute(database);
  }
  await sql`drop schema if exists ${sql.id(name)} cascade`.execute(database);
}

async function withAdmin<T>(
  adminUrl: string,
  databaseName: string | null,
  work: (database: ReturnType<typeof createDatabase<unknown>>) => Promise<T>,
): Promise<T> {
  const database = createDatabase<unknown>(databaseName ? replaceDatabaseName(adminUrl, databaseName) : adminUrl, {
    max: 1,
  });
  try {
    return await work(database);
  } finally {
    await database.destroy();
  }
}

async function roleExists(database: ReturnType<typeof createDatabase<unknown>>, roleName: string): Promise<boolean> {
  const result = await sql<{
    exists: boolean;
  }>`select exists(select 1 from pg_roles where rolname = ${roleName}) as exists`.execute(database);
  return result.rows[0]?.exists === true;
}

export class DatabaseLayout implements SchoolDatabaseLayout {
  readonly kind = 'database' as const;

  constructor(private readonly environment: LayoutEnvironment) {}

  async create(request: CreateSchoolDatabaseRequest): Promise<DatabaseDescriptor> {
    const roleName = schoolRoleName(request.schoolCode);
    assertIdentifier(roleName, 'Tên vai trò');
    assertIdentifier(request.physicalName, 'Tên cơ sở dữ liệu');
    await withAdmin(this.environment.adminUrl, null, async (database) => {
      if (!(await roleExists(database, roleName))) {
        await sql`create role ${sql.id(roleName)} login password ${sql.lit(request.schoolRolePassword)} nocreatedb nocreaterole nosuperuser`.execute(
          database,
        );
        await sql`alter role ${sql.id(roleName)} set timezone to ${sql.lit(VIETNAM_TIMEZONE)}`.execute(database);
      }
      await sql`create database ${sql.id(request.physicalName)} owner ${sql.id(roleName)}`.execute(database);
      // Chỉ vai trò của trường kết nối được
      await sql`revoke connect on database ${sql.id(request.physicalName)} from public`.execute(database);
    });
    return {
      kind: request.kind,
      name: request.logicalName,
      layout: 'database',
      ...hostOf(this.environment),
      databaseName: request.physicalName,
      schemaName: null,
      roleName,
      loginName: loginOf(this.environment, roleName),
      password: request.schoolRolePassword,
    };
  }

  async drop(descriptor: DatabaseDescriptor): Promise<void> {
    assertIdentifier(descriptor.databaseName, 'Tên cơ sở dữ liệu');
    await withAdmin(this.environment.adminUrl, null, async (database) => {
      await sql`drop database if exists ${sql.id(descriptor.databaseName)} with (force)`.execute(database);
    });
  }

  async setReadOnly(descriptor: DatabaseDescriptor, readOnly: boolean): Promise<void> {
    assertIdentifier(descriptor.databaseName, 'Tên cơ sở dữ liệu');
    await withAdmin(this.environment.adminUrl, null, async (database) => {
      if (readOnly) {
        await sql`alter database ${sql.id(descriptor.databaseName)} set default_transaction_read_only = on`.execute(
          database,
        );
      } else {
        await sql`alter database ${sql.id(descriptor.databaseName)} reset default_transaction_read_only`.execute(
          database,
        );
      }
    });
  }

  async dropSchoolRole(schoolCode: string): Promise<void> {
    const roleName = schoolRoleName(schoolCode);
    assertIdentifier(roleName, 'Tên vai trò');
    await withAdmin(this.environment.adminUrl, null, async (database) => {
      await sql`drop role if exists ${sql.id(roleName)}`.execute(database);
    });
  }
}

export class SchemaLayout implements SchoolDatabaseLayout {
  readonly kind = 'schema' as const;

  constructor(private readonly environment: LayoutEnvironment) {
    if (!environment.sharedDatabase) {
      throw new Error('Bố cục schema cần cơ sở dữ liệu dùng chung (sharedDatabase)');
    }
    assertIdentifier(environment.sharedDatabase, 'Tên cơ sở dữ liệu dùng chung');
  }

  private get sharedDatabase(): string {
    return this.environment.sharedDatabase as string;
  }

  async create(request: CreateSchoolDatabaseRequest): Promise<DatabaseDescriptor> {
    // Mỗi lược đồ một vai trò cùng tên, mật khẩu riêng
    const name = request.physicalName;
    assertIdentifier(name, 'Tên lược đồ');
    const password = generatePassword();
    const shared = this.sharedDatabase;
    await withAdmin(this.environment.adminUrl, shared, async (database) => {
      await sql`create role ${sql.id(name)} login password ${sql.lit(password)} nocreatedb nocreaterole nosuperuser`.execute(
        database,
      );
      await sql`alter role ${sql.id(name)} set timezone to ${sql.lit(VIETNAM_TIMEZONE)}`.execute(database);
      await sql`create schema ${sql.id(name)} authorization ${sql.id(name)}`.execute(database);
      // Vai trò của lược đồ chỉ thấy lược đồ của mình: không có public trong search_path, không quyền tạo ở public
      await sql`alter role ${sql.id(name)} set search_path to ${sql.id(name)}`.execute(database);
      await sql`revoke all on schema public from ${sql.id(name)}`.execute(database);
      if (this.environment.revokePublicConnect !== false) {
        await sql`revoke connect on database ${sql.id(shared)} from public`.execute(database);
      }
      await sql`grant connect on database ${sql.id(shared)} to ${sql.id(name)}`.execute(database);
    });
    return {
      kind: request.kind,
      name: request.logicalName,
      layout: 'schema',
      ...hostOf(this.environment),
      databaseName: shared,
      schemaName: name,
      roleName: name,
      loginName: loginOf(this.environment, name),
      password,
    };
  }

  async drop(descriptor: DatabaseDescriptor): Promise<void> {
    const name = descriptor.schemaName;
    if (!name) {
      throw new Error('Mô tả kết nối không có lược đồ');
    }
    assertIdentifier(name, 'Tên lược đồ');
    await withAdmin(this.environment.adminUrl, this.sharedDatabase, async (database) => {
      await dropSchemaInBatches(database, name);
      await sql`drop owned by ${sql.id(name)}`.execute(database);
      await sql`drop role if exists ${sql.id(name)}`.execute(database);
    });
  }

  async setReadOnly(descriptor: DatabaseDescriptor, readOnly: boolean): Promise<void> {
    const name = descriptor.roleName;
    assertIdentifier(name, 'Tên vai trò');
    await withAdmin(this.environment.adminUrl, this.sharedDatabase, async (database) => {
      if (readOnly) {
        await sql`alter role ${sql.id(name)} set default_transaction_read_only to on`.execute(database);
      } else {
        await sql`alter role ${sql.id(name)} reset default_transaction_read_only`.execute(database);
      }
    });
  }

  async dropSchoolRole(): Promise<void> {
    // Mỗi lược đồ có vai trò riêng, đã xóa cùng lược đồ
  }
}

export function createSchoolDatabaseLayout(
  kind: SchoolDatabaseLayoutValue,
  environment: LayoutEnvironment,
): SchoolDatabaseLayout {
  return kind === 'schema' ? new SchemaLayout(environment) : new DatabaseLayout(environment);
}

// Ký tự thoát của LIKE là `#` (tránh dấu gạch chéo ngược lẫn với chuỗi), `_` và `%` là ký tự đại diện nên phải thoát
const LIKE_ESCAPE = '#';

function escapeLike(value: string): string {
  return value
    .replaceAll(LIKE_ESCAPE, LIKE_ESCAPE + LIKE_ESCAPE)
    .replaceAll('_', `${LIKE_ESCAPE}_`)
    .replaceAll('%', `${LIKE_ESCAPE}%`);
}

// Dọn mọi cơ sở dữ liệu, lược đồ và vai trò còn sót của một mã trường (kiểm thử và dựng thử chạy lại): tên theo đúng quy ước của
// bố cục, `s_<mã>_identity`, `s_<mã>_system`, `s_<mã>_year_...` và vai trò `s_<mã>`. Chỉ dùng cho môi trường kiểm thử và phát triển
export async function purgeSchoolArtifacts(
  adminUrl: string,
  schoolCode: string,
  sharedDatabase?: string,
): Promise<void> {
  const slug = escapeLike(schoolSlug(schoolCode));
  const patterns = [
    `s${LIKE_ESCAPE}_${slug}${LIKE_ESCAPE}_identity`,
    `s${LIKE_ESCAPE}_${slug}${LIKE_ESCAPE}_system`,
    `s${LIKE_ESCAPE}_${slug}${LIKE_ESCAPE}_year${LIKE_ESCAPE}_%`,
  ];
  const matches = (column: string) =>
    `(${patterns.map((pattern) => `${column} like '${pattern}' escape '${LIKE_ESCAPE}'`).join(' or ')})`;
  const roleNames = await withAdmin(adminUrl, null, async (database) => {
    const databases = await sql
      .raw<{ datname: string }>(`select datname from pg_database where ${matches('datname')}`)
      .execute(database);
    for (const row of databases.rows) {
      await sql`drop database if exists ${sql.id(row.datname)} with (force)`.execute(database);
    }
    const roles = await sql
      .raw<{ rolname: string }>(
        `select rolname from pg_roles where rolname = 's_${schoolSlug(schoolCode)}' or ${matches('rolname')}`,
      )
      .execute(database);
    return roles.rows.map((row) => row.rolname);
  });
  const sharedExists =
    sharedDatabase !== undefined &&
    (await withAdmin(adminUrl, null, async (database) => {
      const found = await sql<{
        found: boolean;
      }>`select exists(select 1 from pg_database where datname = ${sharedDatabase}) as found`.execute(database);
      return found.rows[0]?.found === true;
    }));
  if (sharedDatabase && sharedExists) {
    await withAdmin(adminUrl, sharedDatabase, async (database) => {
      for (const roleName of roleNames) {
        await dropSchemaInBatches(database, roleName);
        await sql`drop owned by ${sql.id(roleName)}`.execute(database);
      }
    });
  }
  await withAdmin(adminUrl, null, async (database) => {
    for (const roleName of roleNames) {
      await sql`drop role if exists ${sql.id(roleName)}`.execute(database);
    }
  });
}

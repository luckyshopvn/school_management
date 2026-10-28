import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { replaceDatabaseName } from './environment.js';
import { assertIdentifier } from './school-database-layout.js';

export interface ProvisionOwnedDatabaseRequest {
  adminUrl: string;
  databaseName: string;
  roleName: string;
  rolePassword: string;
}

// Tạo vai trò đăng nhập và cơ sở dữ liệu do vai trò đó sở hữu, chỉ vai trò đó (và quản trị) kết nối được; trả chuỗi kết nối bằng vai
// trò. Chạy lại khi đã có thì giữ nguyên dữ liệu, chỉ đặt lại mật khẩu. Dùng cho cơ sở dữ liệu chợ gia sư (DT-27 phần 27f) và cơ sở dữ
// liệu nền tảng của bản nhiều trường trên máy phát triển (YCTD-310)
export async function provisionOwnedDatabase(request: ProvisionOwnedDatabaseRequest): Promise<string> {
  const { roleName } = request;
  assertIdentifier(roleName, 'Tên vai trò');
  assertIdentifier(request.databaseName, 'Tên cơ sở dữ liệu');
  const admin = createDatabase<unknown>(request.adminUrl, { max: 1 });
  try {
    const role = await sql<{
      exists: boolean;
    }>`select exists(select 1 from pg_roles where rolname = ${roleName}) as exists`.execute(admin);
    if (role.rows[0]?.exists) {
      await sql`alter role ${sql.id(roleName)} login password ${sql.lit(request.rolePassword)}`.execute(admin);
    } else {
      await sql`create role ${sql.id(roleName)} login password ${sql.lit(request.rolePassword)} nocreatedb nocreaterole nosuperuser`.execute(
        admin,
      );
    }
    const database = await sql<{
      exists: boolean;
    }>`select exists(select 1 from pg_database where datname = ${request.databaseName}) as exists`.execute(admin);
    if (!database.rows[0]?.exists) {
      await sql`create database ${sql.id(request.databaseName)} owner ${sql.id(roleName)}`.execute(admin);
    }
    await sql`revoke connect on database ${sql.id(request.databaseName)} from public`.execute(admin);
    await sql`grant connect on database ${sql.id(request.databaseName)} to ${sql.id(roleName)}`.execute(admin);
  } finally {
    await admin.destroy();
  }
  const url = new URL(replaceDatabaseName(request.adminUrl, request.databaseName));
  url.username = roleName;
  url.password = request.rolePassword;
  return url.toString();
}

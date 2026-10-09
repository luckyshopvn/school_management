import { createDatabase } from './connection.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { migrateToLatest, type DatabaseKind } from './migrate.js';
import type { SystemDatabase } from '../system/schema.js';

// Chạy tệp thay đổi cấu trúc cho cơ sở dữ liệu định danh, hệ thống và năm học đang dùng;
// năm học đã đóng giữ nguyên cấu trúc (QU-11)
async function migrate(label: string, kind: DatabaseKind, connectionString: string): Promise<boolean> {
  const { error, results } = await migrateToLatest(kind, connectionString);
  for (const result of results ?? []) {
    console.log(`${label}: ${result.migrationName} ${result.status}`);
  }
  if (error) {
    console.error(`${label}: chạy tệp thay đổi cấu trúc thất bại`, error);
    return false;
  }
  console.log(`${label}: đã ở phiên bản cấu trúc mới nhất`);
  return true;
}

const systemConnectionString = readConnectionString('system');
let succeeded =
  (await migrate('identity', 'identity', readConnectionString('identity'))) &&
  (await migrate('system', 'system', systemConnectionString));

if (succeeded) {
  const systemDatabase = createDatabase<SystemDatabase>(systemConnectionString);
  const activeDatabases = await systemDatabase
    .selectFrom('academic_year_databases')
    .select('database_name')
    .where('status', '=', 'active')
    .execute();
  await systemDatabase.destroy();
  for (const { database_name: databaseName } of activeDatabases) {
    succeeded =
      succeeded &&
      (await migrate(databaseName, 'school-year', replaceDatabaseName(systemConnectionString, databaseName)));
  }
}
process.exitCode = succeeded ? 0 : 1;

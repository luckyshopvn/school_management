// Chuẩn bị cơ sở dữ liệu hệ thống riêng cho kiểm thử giao diện để mỗi lần chạy bắt đầu từ trạng thái trống
import { existsSync } from 'node:fs';
import {
  createEmptyDatabase,
  dropDatabaseIfExists,
  listDatabasesWithPrefix,
  migrateToLatest,
  readConnectionString,
  replaceDatabaseName,
} from '@school-management/database';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from './e2e-environment.mjs';

if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const baseSystemUrl = readConnectionString('system');
for (const databaseName of await listDatabasesWithPrefix(baseSystemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX)) {
  await dropDatabaseIfExists(baseSystemUrl, databaseName);
}
await dropDatabaseIfExists(baseSystemUrl, E2E_SYSTEM_DATABASE_NAME);
await createEmptyDatabase(baseSystemUrl, E2E_SYSTEM_DATABASE_NAME);
const migration = await migrateToLatest('system', replaceDatabaseName(baseSystemUrl, E2E_SYSTEM_DATABASE_NAME));
if (migration.error) {
  throw migration.error;
}
const identityMigration = await migrateToLatest('identity', readConnectionString('identity'));
if (identityMigration.error) {
  throw identityMigration.error;
}
console.log(`Đã chuẩn bị cơ sở dữ liệu ${E2E_SYSTEM_DATABASE_NAME}`);

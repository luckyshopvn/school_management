// Dựng nền tảng nhiều trường cho kiểm thử giao diện (DT-SaaS phần S1a): cơ sở dữ liệu nền tảng riêng, hai trường giả (alpha, beta) mỗi
// trường một bộ cơ sở dữ liệu riêng (bố cục E2E_TENANT_LAYOUT=database hoặc schema), tên miền con của tên miền hệ thống giả.
// Mỗi lần chạy dọn sạch lần trước. Khóa gốc nền tảng sinh ngẫu nhiên cho lần chạy, chỉ ghi vào tệp trạng thái không đưa lên kho
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import {
  createEmptyDatabase,
  createDatabase,
  createSchoolDatabaseLayout,
  dropDatabaseIfExists,
  migrateToLatest,
  provisionSchool,
  purgeSchoolArtifacts,
  replaceDatabaseName,
  testAdminDatabaseUrl,
} from '@school-management/database';
import {
  E2E_LIFECYCLE_SCHOOL_CODES,
  E2E_MULTI_STATE_FILE,
  E2E_PLATFORM_DATABASE_NAME,
  E2E_SCHOOL_CODES,
  E2E_SHARED_DATABASE_NAME,
  schoolHost,
} from './e2e-multi-environment.mjs';

if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const adminUrl = testAdminDatabaseUrl();
const layoutKind = process.env.E2E_TENANT_LAYOUT === 'schema' ? 'schema' : 'database';
const host = new URL(adminUrl).hostname;
const port = new URL(adminUrl).port ? Number(new URL(adminUrl).port) : 5432;

for (const code of [...E2E_SCHOOL_CODES, ...E2E_LIFECYCLE_SCHOOL_CODES]) {
  await purgeSchoolArtifacts(adminUrl, code, E2E_SHARED_DATABASE_NAME);
}
await dropDatabaseIfExists(adminUrl, E2E_PLATFORM_DATABASE_NAME);
await dropDatabaseIfExists(adminUrl, E2E_SHARED_DATABASE_NAME);
await createEmptyDatabase(adminUrl, E2E_PLATFORM_DATABASE_NAME);
if (layoutKind === 'schema') {
  await createEmptyDatabase(adminUrl, E2E_SHARED_DATABASE_NAME);
}
const platformUrl = replaceDatabaseName(adminUrl, E2E_PLATFORM_DATABASE_NAME);
const migration = await migrateToLatest('platform', platformUrl);
if (migration.error) {
  throw migration.error;
}

const masterKey = randomBytes(32);
const platform = createDatabase(platformUrl, { max: 2 });
try {
  const layout = createSchoolDatabaseLayout(layoutKind, {
    adminUrl,
    ...(layoutKind === 'schema' ? { sharedDatabase: E2E_SHARED_DATABASE_NAME } : {}),
  });
  for (const code of E2E_SCHOOL_CODES) {
    await provisionSchool({
      platform,
      masterKey,
      layout,
      code,
      name: `Trường ${code} (dữ liệu giả)`,
      domains: [schoolHost(code)],
      host,
      port,
    });
  }
} finally {
  await platform.destroy();
}
writeFileSync(E2E_MULTI_STATE_FILE, JSON.stringify({ masterKey: masterKey.toString('base64'), layout: layoutKind }));
console.log(`Đã dựng nền tảng nhiều trường kiểm thử: ${E2E_SCHOOL_CODES.join(', ')} (bố cục ${layoutKind})`);

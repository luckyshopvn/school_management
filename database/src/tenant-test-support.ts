import { randomBytes, randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase, SchoolDatabaseLayoutValue } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { dropSchool, provisionSchool, type ProvisionedSchool } from './provision-school.js';
import { createSchoolDatabaseLayout, type SchoolDatabaseLayout } from './school-database-layout.js';
import { readTenancyConfiguration, TenancyRuntime } from './tenancy-runtime.js';
import { testAdminDatabaseUrl } from './test-admin.js';

// Nền tảng nhiều trường dựng riêng cho kiểm thử (DT-SaaS phần S1a, tài liệu 32 mục 14.7): cơ sở dữ liệu nền tảng tạm, vài trường
// giả với tên miền `<tên>-<hậu tố>.e2e.localhost`, cơ sở dữ liệu và vai trò riêng của lần chạy; gỡ sạch khi đóng. Dùng cho kiểm
// thử của dịch vụ định danh, máy chủ API và bộ kiểm thử cách ly; không bao giờ đụng cơ sở dữ liệu dùng chung
export interface TestSchool extends ProvisionedSchool {
  name: string;
  host: string;
}

export interface TenantTestPlatform {
  adminUrl: string;
  platformUrl: string;
  masterKey: Buffer;
  suffix: string;
  layoutKind: SchoolDatabaseLayoutValue;
  sharedDatabase: string | null;
  layout: SchoolDatabaseLayout;
  platform: Kysely<PlatformDatabase>;
  schools: Map<string, TestSchool>;
  school(name: string): TestSchool;
  // Biến môi trường tương đương để dựng thời gian chạy nền tảng hoặc truyền cho tiến trình con
  environment(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  createRuntime(extra?: NodeJS.ProcessEnv): TenancyRuntime;
  addSchool(name: string): Promise<TestSchool>;
  close(): Promise<void>;
}

export async function startTenantTestPlatform(
  options: { schools: string[]; layout?: SchoolDatabaseLayoutValue; label?: string } = { schools: [] },
): Promise<TenantTestPlatform> {
  const adminUrl = testAdminDatabaseUrl();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const label = options.label ?? 't';
  const layoutKind = options.layout ?? 'database';
  const platformDatabaseName = `school_platform_${label}_${suffix}`;
  const sharedDatabase = layoutKind === 'schema' ? `school_shared_${label}_${suffix}` : null;
  const masterKey = randomBytes(32);
  const url = new URL(adminUrl);
  const host = url.hostname;
  const port = url.port ? Number(url.port) : 5432;

  await createEmptyDatabase(adminUrl, platformDatabaseName);
  if (sharedDatabase) {
    await createEmptyDatabase(adminUrl, sharedDatabase);
  }
  const platformUrl = replaceDatabaseName(adminUrl, platformDatabaseName);
  const migration = await migrateToLatest('platform', platformUrl);
  if (migration.error) {
    throw migration.error;
  }
  const platform = createDatabase<PlatformDatabase>(platformUrl, { max: 4 });
  const layout = createSchoolDatabaseLayout(layoutKind, {
    adminUrl,
    ...(sharedDatabase ? { sharedDatabase } : {}),
  });
  const schools = new Map<string, TestSchool>();

  const environment = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    PLATFORM_DATABASE_URL: platformUrl,
    PLATFORM_MASTER_KEY: masterKey.toString('base64'),
    PLATFORM_ADMIN_DATABASE_URL: adminUrl,
    TENANT_DB_LAYOUT: layoutKind,
    ...(sharedDatabase ? { PLATFORM_SHARED_DATABASE: sharedDatabase } : {}),
    ...extra,
  });

  const addSchool = async (name: string): Promise<TestSchool> => {
    const code = `${name}-${suffix}`;
    const schoolHost = `${code}.e2e.localhost`;
    const provisioned = await provisionSchool({
      platform,
      masterKey,
      layout,
      code,
      name: `Trường ${name} (dữ liệu giả)`,
      domains: [schoolHost],
      host,
      port,
    });
    const school: TestSchool = { ...provisioned, name, host: schoolHost };
    schools.set(name, school);
    return school;
  };

  const runtimes: TenancyRuntime[] = [];
  try {
    for (const name of options.schools) {
      await addSchool(name);
    }
  } catch (error) {
    await cleanup();
    throw error;
  }

  async function cleanup(): Promise<void> {
    for (const runtime of runtimes) {
      await runtime.close().catch(() => undefined);
    }
    for (const school of schools.values()) {
      await dropSchool({ platform, masterKey, layout, schoolId: school.schoolId }).catch(() => undefined);
    }
    await platform.destroy().catch(() => undefined);
    await dropDatabaseIfExists(adminUrl, platformDatabaseName);
    if (sharedDatabase) {
      await dropDatabaseIfExists(adminUrl, sharedDatabase);
    }
  }

  return {
    adminUrl,
    platformUrl,
    masterKey,
    suffix,
    layoutKind,
    sharedDatabase,
    layout,
    platform,
    schools,
    school(name) {
      const school = schools.get(name);
      if (!school) {
        throw new Error(`Không có trường kiểm thử ${name}`);
      }
      return school;
    },
    environment,
    createRuntime(extra) {
      const configuration = readTenancyConfiguration(environment(extra));
      if (!configuration) {
        throw new Error('Cấu hình nền tảng kiểm thử không hợp lệ');
      }
      const runtime = new TenancyRuntime(configuration);
      runtimes.push(runtime);
      return runtime;
    },
    addSchool,
    close: cleanup,
  };
}

// Có chuỗi `needle` ở bất kỳ ô nào của bất kỳ bảng nào của một cơ sở dữ liệu (hoặc lược đồ) của trường không: quét bằng tài khoản
// quản trị, giống tìm chuỗi mồi (canary) trong bản chụp cơ sở dữ liệu (tài liệu 32 mục 14.7 lớp 4). Chỉ dùng trong kiểm thử
export async function textExistsInSchoolDatabase(
  adminUrl: string,
  descriptor: { databaseName: string; schemaName: string | null },
  needle: string,
): Promise<boolean> {
  const schema = descriptor.schemaName ?? 'public';
  const database = createDatabase<unknown>(replaceDatabaseName(adminUrl, descriptor.databaseName), { max: 1 });
  try {
    const tables = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = ${schema} and table_type = 'BASE TABLE'`.execute(database);
    for (const table of tables.rows) {
      const found = await sql<{ found: boolean }>`
        select exists(select 1 from ${sql.table(`${schema}.${table.table_name}`)} t where t::text like ${`%${needle}%`}) as found`.execute(
        database,
      );
      if (found.rows[0]?.found) {
        return true;
      }
    }
    return false;
  } finally {
    await database.destroy();
  }
}

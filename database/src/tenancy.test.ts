import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { runAsSchool } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { dropSchool, provisionSchool, writeAudit, type ProvisionedSchool } from './provision-school.js';
import {
  connectionStringOf,
  createSchoolDatabaseLayout,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import { TenancyRuntime, readTenancyConfiguration } from './tenancy-runtime.js';
import { testAdminDatabaseUrl } from './test-admin.js';
import { TenantConnections } from './tenant-connections.js';
import { TenantRegistry } from './tenant-registry.js';

// Kiểm thử nền đa thuê bao ở cấp cơ sở dữ liệu (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 1, 4, 9): cơ sở dữ liệu nền tảng,
// hai bố cục, bộ phân giải, nhóm kết nối. Mọi cơ sở dữ liệu, vai trò dựng riêng cho lần chạy và gỡ khi xong
const adminUrl = testAdminDatabaseUrl();
const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
const platformDatabaseName = `school_platform_test_${suffix}`;
const sharedDatabaseName = `school_shared_test_${suffix}`;
const masterKey = randomBytes(32);
const host = new URL(adminUrl).hostname;
const port = new URL(adminUrl).port ? Number(new URL(adminUrl).port) : 5432;

let platform: Kysely<PlatformDatabase>;
let platformUrl: string;
let databaseLayout: SchoolDatabaseLayout;
let schemaLayout: SchoolDatabaseLayout;
const provisioned: ProvisionedSchool[] = [];
let alpha: ProvisionedSchool;
let beta: ProvisionedSchool;
let gamma: ProvisionedSchool;
let delta: ProvisionedSchool;

function codeOf(name: string): string {
  return `${name}-${suffix}`;
}

async function runQuery<T>(descriptor: DatabaseDescriptor, query: string): Promise<T[]> {
  const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
  try {
    const result = await sql.raw<T>(query).execute(database);
    return result.rows;
  } finally {
    await database.destroy();
  }
}

function descriptorOf(school: ProvisionedSchool, kind: string): DatabaseDescriptor {
  const found = school.descriptors.find((descriptor) => descriptor.kind === kind);
  assert.ok(found, `thiếu mô tả ${kind}`);
  return found;
}

before(async () => {
  await createEmptyDatabase(adminUrl, platformDatabaseName);
  await createEmptyDatabase(adminUrl, sharedDatabaseName);
  platformUrl = replaceDatabaseName(adminUrl, platformDatabaseName);
  const migration = await migrateToLatest('platform', platformUrl);
  assert.equal(migration.error, undefined);
  platform = createDatabase<PlatformDatabase>(platformUrl, { max: 4 });
  databaseLayout = createSchoolDatabaseLayout('database', { adminUrl });
  schemaLayout = createSchoolDatabaseLayout('schema', { adminUrl, sharedDatabase: sharedDatabaseName });
  const common = { platform, masterKey, host, port };
  alpha = await provisionSchool({
    ...common,
    layout: databaseLayout,
    code: codeOf('alpha'),
    name: 'Trường Alpha (giả)',
    domains: [`alpha-${suffix}.e2e.localhost`],
  });
  beta = await provisionSchool({
    ...common,
    layout: databaseLayout,
    code: codeOf('beta'),
    name: 'Trường Beta (giả)',
    domains: [`beta-${suffix}.e2e.localhost`],
    firstYear: { startYear: 2026, endYear: 2027 },
  });
  gamma = await provisionSchool({
    ...common,
    layout: schemaLayout,
    code: codeOf('gamma'),
    name: 'Trường Gamma (giả)',
    domains: [`gamma-${suffix}.e2e.localhost`],
  });
  delta = await provisionSchool({
    ...common,
    layout: schemaLayout,
    code: codeOf('delta'),
    name: 'Trường Delta (giả)',
    domains: [`delta-${suffix}.e2e.localhost`],
  });
  provisioned.push(alpha, beta, gamma, delta);
});

after(async () => {
  const layouts = new Map([
    [alpha.schoolId, databaseLayout],
    [beta.schoolId, databaseLayout],
    [gamma.schoolId, schemaLayout],
    [delta.schoolId, schemaLayout],
  ]);
  for (const school of provisioned) {
    await dropSchool({
      platform,
      masterKey,
      layout: layouts.get(school.schoolId) as SchoolDatabaseLayout,
      schoolId: school.schoolId,
    });
  }
  await platform.destroy();
  await dropDatabaseIfExists(adminUrl, platformDatabaseName);
  await dropDatabaseIfExists(adminUrl, sharedDatabaseName);
});

describe('cơ sở dữ liệu nền tảng', () => {
  it('đã chạy tệp thay đổi cấu trúc, chạy lại không lỗi', async () => {
    const again = await migrateToLatest('platform', platformUrl);
    assert.equal(again.error, undefined);
    assert.deepEqual(again.results, []);
    const tables = await sql<{
      table_name: string;
    }>`select table_name from information_schema.tables where table_schema = 'public'`.execute(platform);
    const names = tables.rows.map((row) => row.table_name);
    for (const expected of [
      'schools',
      'school_domains',
      'school_databases',
      'school_keys',
      'school_clusters',
      'platform_settings',
      'platform_operators',
      'platform_audit_log',
    ]) {
      assert.ok(names.includes(expected), expected);
    }
  });

  it('ràng buộc: mã trường sai mẫu, tên miền chữ hoa, tiền tố khóa trùng', async () => {
    await assert.rejects(
      platform.insertInto('schools').values({ code: 'Sai Ma', name: 'x', year_database_prefix: 'sai_' }).execute(),
    );
    await assert.rejects(
      platform.insertInto('school_domains').values({ school_id: alpha.schoolId, host: 'Chu.Hoa.vn' }).execute(),
    );
    await assert.rejects(
      platform
        .insertInto('schools')
        .values({ code: `trung-${suffix}`, name: 'x', key_prefix: codeOf('alpha'), year_database_prefix: 'trung_' })
        .execute(),
    );
  });

  it('một tên miền thuộc đúng một trường', async () => {
    await assert.rejects(
      platform
        .insertInto('school_domains')
        .values({ school_id: beta.schoolId, host: `alpha-${suffix}.e2e.localhost` })
        .execute(),
    );
  });

  it('mật khẩu kết nối và khóa chỉ lưu bản mã', async () => {
    const rows = await platform
      .selectFrom('school_databases')
      .select('password_encrypted')
      .where('school_id', '=', alpha.schoolId)
      .execute();
    assert.ok(rows.length >= 2);
    const passwords = alpha.descriptors.map((descriptor) => descriptor.password);
    for (const row of rows) {
      assert.ok(!passwords.includes(row.password_encrypted));
      assert.ok(!passwords.some((password) => row.password_encrypted.includes(password)));
    }
    const key = await platform
      .selectFrom('school_keys')
      .selectAll()
      .where('school_id', '=', alpha.schoolId)
      .executeTakeFirstOrThrow();
    assert.notEqual(key.child_encryption_key_encrypted, key.child_hash_key_encrypted);
    await writeAudit(platform, {
      actorType: 'system',
      action: 'kiem-thu',
      schoolId: alpha.schoolId,
      details: { ok: true },
    });
  });
});

describe('bố cục database: một vai trò mỗi trường, cơ sở dữ liệu riêng', () => {
  it('vai trò của trường vào được cơ sở dữ liệu của mình và đã chạy migrate', async () => {
    const identity = descriptorOf(alpha, 'identity');
    assert.equal(identity.layout, 'database');
    assert.equal(identity.schemaName, null);
    const rows = await runQuery<{ current_user: string; has_users: boolean }>(
      identity,
      `select current_user, to_regclass('users') is not null as has_users`,
    );
    assert.equal(rows[0]?.current_user, identity.roleName);
    assert.equal(rows[0]?.has_users, true);
  });

  it('vai trò trường A không kết nối được cơ sở dữ liệu của trường B', async () => {
    const aRole = descriptorOf(alpha, 'identity');
    const bDatabase = descriptorOf(beta, 'identity');
    await assert.rejects(
      runQuery({ ...bDatabase, roleName: aRole.roleName, password: aRole.password }, 'select 1'),
      /permission denied|không có quyền/i,
    );
  });

  it('cơ sở dữ liệu năm học của trường B có tên theo tiền tố của trường', async () => {
    const year = descriptorOf(beta, 'school-year');
    assert.equal(year.databaseName, `s_${codeOf('beta').replaceAll('-', '_')}_year_2026_2027`);
    assert.equal(year.roleName, descriptorOf(beta, 'identity').roleName);
  });

  it('khóa ghi rồi mở lại năm học', async () => {
    const year = descriptorOf(beta, 'school-year');
    await databaseLayout.setReadOnly(year, true);
    const readOnly = await runQuery<{ transaction_read_only: string }>(year, 'show transaction_read_only');
    assert.equal(readOnly[0]?.transaction_read_only, 'on');
    await databaseLayout.setReadOnly(year, false);
    const writable = await runQuery<{ transaction_read_only: string }>(year, 'show transaction_read_only');
    assert.equal(writable[0]?.transaction_read_only, 'off');
  });
});

describe('bố cục schema: một vai trò mỗi lược đồ, chung một cơ sở dữ liệu', () => {
  it('mỗi lược đồ có vai trò riêng, search_path ở mức vai trò, đã chạy migrate', async () => {
    const identity = descriptorOf(gamma, 'identity');
    assert.equal(identity.layout, 'schema');
    assert.equal(identity.databaseName, sharedDatabaseName);
    assert.equal(identity.schemaName, identity.roleName);
    const rows = await runQuery<{ current_user: string; search_path: string; has_users: boolean; schema: string }>(
      identity,
      `select current_user, current_setting('search_path') as search_path, to_regclass('users') is not null as has_users, current_schema() as schema`,
    );
    assert.equal(rows[0]?.current_user, identity.roleName);
    assert.equal(rows[0]?.search_path, identity.schemaName);
    assert.equal(rows[0]?.schema, identity.schemaName);
    assert.equal(rows[0]?.has_users, true);
    const timezone = await runQuery<{ TimeZone: string }>(identity, 'show timezone');
    assert.equal(timezone[0]?.TimeZone, 'Asia/Ho_Chi_Minh');
  });

  it('vai trò của lược đồ trường A không đọc, ghi, tạo bảng ở lược đồ trường B và ở public', async () => {
    const gammaIdentity = descriptorOf(gamma, 'identity');
    const deltaIdentity = descriptorOf(delta, 'identity');
    await assert.rejects(
      runQuery(gammaIdentity, `select * from ${deltaIdentity.schemaName}.users`),
      /permission denied/i,
    );
    await assert.rejects(
      runQuery(gammaIdentity, `delete from ${deltaIdentity.schemaName}.users`),
      /permission denied/i,
    );
    await assert.rejects(
      runQuery(gammaIdentity, `create table ${deltaIdentity.schemaName}.chen (id int)`),
      /permission denied/i,
    );
    await assert.rejects(runQuery(gammaIdentity, 'create table public.chen (id int)'), /permission denied/i);
    // Lược đồ hệ thống của cùng trường cũng là vai trò khác
    const gammaSystem = descriptorOf(gamma, 'system');
    await assert.rejects(
      runQuery(gammaIdentity, `select * from ${gammaSystem.schemaName}.school_levels`),
      /permission denied/i,
    );
  });

  it('truy vấn không ghi tên lược đồ chỉ rơi vào lược đồ của chính vai trò đó', async () => {
    const gammaIdentity = descriptorOf(gamma, 'identity');
    const deltaIdentity = descriptorOf(delta, 'identity');
    await runQuery(deltaIdentity, `insert into roles (code, name) values ('rieng-delta', 'Chỉ có ở Delta')`);
    const gammaRows = await runQuery<{ code: string }>(
      gammaIdentity,
      `select code from roles where code = 'rieng-delta'`,
    );
    assert.deepEqual(gammaRows, []);
    const deltaRows = await runQuery<{ code: string }>(
      deltaIdentity,
      `select code from roles where code = 'rieng-delta'`,
    );
    assert.equal(deltaRows.length, 1);
  });

  it('khóa ghi một lược đồ bằng cài đặt mức vai trò rồi mở lại', async () => {
    const system = descriptorOf(gamma, 'system');
    await schemaLayout.setReadOnly(system, true);
    const on = await runQuery<{ transaction_read_only: string }>(system, 'show transaction_read_only');
    assert.equal(on[0]?.transaction_read_only, 'on');
    await schemaLayout.setReadOnly(system, false);
    const off = await runQuery<{ transaction_read_only: string }>(system, 'show transaction_read_only');
    assert.equal(off[0]?.transaction_read_only, 'off');
  });
});

describe('bộ phân giải tên miền', () => {
  it('phân giải tên miền đang hoạt động, đọc khóa của trường, bỏ qua tên miền lạ hoặc chưa xác nhận', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const tenant = await registry.resolveHost(`ALPHA-${suffix}.e2e.localhost:5373`);
    assert.equal(tenant?.code, codeOf('alpha'));
    assert.equal(tenant?.status, 'active');
    assert.equal(tenant?.dataClass, 'synthetic');
    assert.equal(tenant?.childDataEncryptionKey?.length, 32);
    assert.equal(tenant?.childDataHashKey?.length, 32);
    assert.notDeepEqual(tenant?.childDataEncryptionKey, tenant?.childDataHashKey);
    assert.equal(await registry.resolveHost('khong-co.e2e.localhost'), null);
    assert.equal(await registry.resolveHost('bad host'), null);

    await platform
      .insertInto('school_domains')
      .values({ school_id: alpha.schoolId, host: `cho-${suffix}.example.vn`, status: 'pending' })
      .execute();
    assert.equal(await registry.resolveHost(`cho-${suffix}.example.vn`), null);
    await platform
      .updateTable('school_domains')
      .set({ status: 'active' })
      .where('host', '=', `cho-${suffix}.example.vn`)
      .execute();
    assert.equal((await registry.resolveHost(`cho-${suffix}.example.vn`))?.code, codeOf('alpha'));
  });

  it('mỗi trường có khóa dữ liệu trẻ khác nhau', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const a = await registry.resolveHost(`alpha-${suffix}.e2e.localhost`);
    const b = await registry.resolveHost(`beta-${suffix}.e2e.localhost`);
    assert.ok(a?.childDataEncryptionKey && b?.childDataEncryptionKey);
    assert.notDeepEqual(a.childDataEncryptionKey, b.childDataEncryptionKey);
    assert.notDeepEqual(a.childDataHashKey, b.childDataHashKey);
  });

  it('khóa gốc sai thì không đọc được mô tả kết nối', async () => {
    const registry = new TenantRegistry(platform, randomBytes(32));
    await assert.rejects(registry.resolveHost(`alpha-${suffix}.e2e.localhost`));
  });

  it('giữ bản đã nạp trong thời hạn đệm rồi nạp lại', async () => {
    let clock = 1_000_000;
    const registry = new TenantRegistry(platform, masterKey, { cacheSeconds: 30, now: () => clock });
    const before = await registry.resolveHost(`beta-${suffix}.e2e.localhost`);
    assert.equal(before?.status, 'active');
    await platform.updateTable('schools').set({ status: 'suspended' }).where('id', '=', beta.schoolId).execute();
    assert.equal((await registry.resolveHost(`beta-${suffix}.e2e.localhost`))?.status, 'active');
    clock += 31_000;
    assert.equal((await registry.resolveHost(`beta-${suffix}.e2e.localhost`))?.status, 'suspended');
    await platform.updateTable('schools').set({ status: 'active' }).where('id', '=', beta.schoolId).execute();
    registry.invalidate();
    assert.equal((await registry.resolveHost(`beta-${suffix}.e2e.localhost`))?.status, 'active');
  });

  it('đóng chặt: chưa nạp trường thì không có mô tả kết nối', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    assert.throws(() => registry.recordOf(alpha.schoolId), /Chưa nạp/);
  });

  it('danh sách trường đang phục vụ', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const ids = await registry.listServingSchoolIds();
    for (const school of provisioned) {
      assert.ok(ids.includes(school.schoolId));
    }
  });
});

describe('nhóm kết nối theo trường', () => {
  it('trả đúng cơ sở dữ liệu của đúng trường ở cả hai bố cục, dùng lại nhóm', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const connections = new TenantConnections(registry, { poolMax: 2 });
    try {
      const tenants = [];
      for (const [name, school] of [
        ['alpha', alpha],
        ['beta', beta],
        ['gamma', gamma],
        ['delta', delta],
      ] as const) {
        const tenant = await registry.resolveHost(`${name}-${suffix}.e2e.localhost`);
        assert.ok(tenant, name);
        tenants.push({ tenant, school });
      }
      for (const { tenant, school } of tenants) {
        const database = connections.database<unknown>(tenant, 'identity', 'identity');
        const who = await sql<{ current_user: string }>`select current_user`.execute(database);
        assert.equal(who.rows[0]?.current_user, descriptorOf(school, 'identity').roleName);
        assert.equal(connections.database<unknown>(tenant, 'identity', 'identity'), database);
      }
      assert.equal(connections.poolCount, 4);
      const first = tenants[0];
      assert.ok(first);
      assert.throws(() => connections.database(first.tenant, 'school-year', 'khong-co'), /không có cơ sở dữ liệu/);
    } finally {
      await connections.closeAll();
    }
  });

  it('chạy song song hai trường, mỗi yêu cầu chỉ thấy dữ liệu của trường mình', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const connections = new TenantConnections(registry);
    try {
      const a = await registry.resolveHost(`alpha-${suffix}.e2e.localhost`);
      const g = await registry.resolveHost(`gamma-${suffix}.e2e.localhost`);
      assert.ok(a && g);
      for (const [tenant, marker] of [
        [a, 'canary-alpha'],
        [g, 'canary-gamma'],
      ] as const) {
        await sql`insert into roles (code, name) values (${marker}, ${marker})`.execute(
          connections.database<unknown>(tenant, 'identity', 'identity'),
        );
      }
      const read = async (tenant: typeof a) => {
        const rows = await sql<{ code: string }>`select code from roles where code like 'canary-%'`.execute(
          connections.database<unknown>(tenant, 'identity', 'identity'),
        );
        return rows.rows.map((row) => row.code);
      };
      const results = await Promise.all([
        runAsSchool(a, () => read(a)),
        runAsSchool(g, () => read(g)),
        runAsSchool(a, () => read(a)),
        runAsSchool(g, () => read(g)),
      ]);
      assert.deepEqual(results, [['canary-alpha'], ['canary-gamma'], ['canary-alpha'], ['canary-gamma']]);
    } finally {
      await connections.closeAll();
    }
  });

  it('giới hạn số nhóm: đóng nhóm lâu không dùng nhất, giữ nhóm vừa dùng', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    let clock = 10_000_000;
    const connections = new TenantConnections(registry, { maxPools: 2, now: () => clock });
    try {
      const a = await registry.resolveHost(`alpha-${suffix}.e2e.localhost`);
      const b = await registry.resolveHost(`beta-${suffix}.e2e.localhost`);
      const g = await registry.resolveHost(`gamma-${suffix}.e2e.localhost`);
      assert.ok(a && b && g);
      connections.database(a, 'identity', 'identity');
      clock += 10_000;
      connections.database(b, 'identity', 'identity');
      clock += 10_000;
      connections.database(g, 'identity', 'identity');
      assert.equal(connections.poolCount, 2);
      // Nhóm của A (lâu nhất) đã bị đóng; mở lại tạo nhóm mới
      clock += 10_000;
      connections.database(a, 'identity', 'identity');
      assert.equal(connections.poolCount, 2);
    } finally {
      await connections.closeAll();
    }
  });

  it('đóng nhóm không dùng quá hạn và đóng toàn bộ nhóm của một trường', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    let clock = 20_000_000;
    const connections = new TenantConnections(registry, { idleSeconds: 60, now: () => clock });
    try {
      const a = await registry.resolveHost(`alpha-${suffix}.e2e.localhost`);
      const g = await registry.resolveHost(`gamma-${suffix}.e2e.localhost`);
      assert.ok(a && g);
      connections.database(a, 'identity', 'identity');
      connections.database(a, 'system', 'system');
      clock += 30_000;
      connections.database(g, 'identity', 'identity');
      clock += 40_000;
      assert.equal(await connections.sweepIdle(), 2);
      assert.equal(connections.poolCount, 1);
      await connections.closeSchool(g.schoolId);
      assert.equal(connections.poolCount, 0);
    } finally {
      await connections.closeAll();
    }
  });
});

describe('thời gian chạy nền tảng', () => {
  const baseEnv = (): NodeJS.ProcessEnv => ({
    PLATFORM_DATABASE_URL: platformUrl,
    PLATFORM_MASTER_KEY: masterKey.toString('base64'),
  });

  it('không có PLATFORM_DATABASE_URL thì chế độ một trường', () => {
    assert.equal(readTenancyConfiguration({}), null);
  });

  it('đọc cấu hình và từ chối cấu hình thiếu hoặc sai', () => {
    const configuration = readTenancyConfiguration({ ...baseEnv(), TENANT_POOL_MAX: '2', TENANT_POOL_SCHOOLS: '4' });
    assert.equal(configuration?.layout, 'database');
    assert.deepEqual(configuration?.hostSource, { kind: 'host' });
    assert.equal(configuration?.connections.poolMax, 2);
    assert.equal(configuration?.connections.maxPools, 12);
    assert.throws(() => readTenancyConfiguration({ PLATFORM_DATABASE_URL: platformUrl }), /PLATFORM_MASTER_KEY/);
    assert.throws(() => readTenancyConfiguration({ ...baseEnv(), PLATFORM_MASTER_KEY: 'ngan' }), /32 byte/);
    assert.throws(() => readTenancyConfiguration({ ...baseEnv(), TENANT_DB_LAYOUT: 'khac' }), /TENANT_DB_LAYOUT/);
    assert.throws(
      () => readTenancyConfiguration({ ...baseEnv(), TENANT_DB_LAYOUT: 'schema' }),
      /PLATFORM_SHARED_DATABASE/,
    );
    assert.throws(
      () => readTenancyConfiguration({ ...baseEnv(), TENANT_HOST_SOURCE: 'header:x-tenant-host' }),
      /EDGE_SHARED_SECRET/,
    );
    assert.throws(
      () => readTenancyConfiguration({ ...baseEnv(), TENANT_HOST_SOURCE: 'x-forwarded-host' }),
      /TRUST_PROXY/,
    );
    assert.equal(
      readTenancyConfiguration({ ...baseEnv(), TENANT_HOST_SOURCE: 'x-forwarded-host', TRUST_PROXY: '1' })?.hostSource
        .kind,
      'x-forwarded-host',
    );
  });

  async function exerciseYearLifecycle(layoutKind: 'database' | 'schema', school: ProvisionedSchool, domain: string) {
    const runtime = new TenancyRuntime(
      readTenancyConfiguration({
        ...baseEnv(),
        PLATFORM_ADMIN_DATABASE_URL: adminUrl,
        TENANT_DB_LAYOUT: layoutKind,
        ...(layoutKind === 'schema' ? { PLATFORM_SHARED_DATABASE: sharedDatabaseName } : {}),
      }) as NonNullable<ReturnType<typeof readTenancyConfiguration>>,
    );
    try {
      const tenant = await runtime.registry.resolveHost(domain);
      assert.ok(tenant);
      const name = `${tenant.yearDatabasePrefix}2030_2031`;
      const url = await runtime.createYearDatabase(tenant, name);
      const migration = await migrateToLatest('school-year', url);
      assert.equal(migration.error, undefined);
      const year = runtime.connections.database<unknown>(tenant, 'school-year', name);
      const tables = await sql<{
        has_children: boolean;
      }>`select to_regclass('children') is not null as has_children`.execute(year);
      assert.equal(tables.rows[0]?.has_children, true);
      await runtime.setYearReadOnly(tenant, name, true);
      const reopened = runtime.connections.database<unknown>(tenant, 'school-year', name);
      const ro = await sql<{ transaction_read_only: string }>`show transaction_read_only`.execute(reopened);
      assert.equal(ro.rows[0]?.transaction_read_only, 'on');
      await runtime.setYearReadOnly(tenant, name, false);
      await runtime.dropYearDatabase(tenant, name);
      assert.throws(() => runtime.connections.database(tenant, 'school-year', name), /không có cơ sở dữ liệu/);
      assert.equal(school.descriptors.length >= 2, true);
    } finally {
      await runtime.close();
    }
  }

  it('tạo, khóa ghi, mở lại, xóa năm học của một trường ở bố cục database', async () => {
    await exerciseYearLifecycle('database', alpha, `alpha-${suffix}.e2e.localhost`);
  });

  it('tạo, khóa ghi, mở lại, xóa năm học của một trường ở bố cục schema', async () => {
    await exerciseYearLifecycle('schema', gamma, `gamma-${suffix}.e2e.localhost`);
  });

  it('thiếu tài khoản quản trị thì không tạo được năm học mới', async () => {
    const runtime = new TenancyRuntime(
      readTenancyConfiguration(baseEnv()) as NonNullable<ReturnType<typeof readTenancyConfiguration>>,
    );
    try {
      const tenant = await runtime.registry.resolveHost(`alpha-${suffix}.e2e.localhost`);
      assert.ok(tenant);
      await assert.rejects(runtime.createYearDatabase(tenant, 'khong_tao_duoc'), /PLATFORM_ADMIN_DATABASE_URL/);
    } finally {
      await runtime.close();
    }
  });
});

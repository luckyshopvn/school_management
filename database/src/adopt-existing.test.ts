import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { cacheKey, storageKey } from '@school-management/server/resource-names';
import { runAsSchool, setMultiTenantMode } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { adoptExistingSchool, hostFromSiteSetting } from './adopt-existing.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';
import { testAdminDatabaseUrl } from './test-admin.js';
import { TenantConnections } from './tenant-connections.js';
import { TenantRegistry } from './tenant-registry.js';

// Nhận bản đang chạy làm trường số 1 (DT-SaaS phần S1a): dùng lại cơ sở dữ liệu hiện có, không đổi tên, không chép dữ liệu,
// khóa tên cũ còn đúng; chạy lặp được
const adminUrl = testAdminDatabaseUrl();
const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
const platformName = `school_platform_adopt_${suffix}`;
const identityName = `school_identity_adopt_${suffix}`;
const systemName = `school_system_adopt_${suffix}`;
const yearName = `school_year_adopt_${suffix}_2026_2027`;
const masterKey = randomBytes(32);
const encryptionKey = randomBytes(32);
const hashKey = randomBytes(32);
let platform: Kysely<PlatformDatabase>;
let platformUrl: string;

before(async () => {
  for (const name of [platformName, identityName, systemName, yearName]) {
    await createEmptyDatabase(adminUrl, name);
  }
  platformUrl = replaceDatabaseName(adminUrl, platformName);
  assert.equal((await migrateToLatest('platform', platformUrl)).error, undefined);
  assert.equal((await migrateToLatest('identity', replaceDatabaseName(adminUrl, identityName))).error, undefined);
  assert.equal((await migrateToLatest('system', replaceDatabaseName(adminUrl, systemName))).error, undefined);
  assert.equal((await migrateToLatest('school-year', replaceDatabaseName(adminUrl, yearName))).error, undefined);
  platform = createDatabase<PlatformDatabase>(platformUrl, { max: 2 });
  // Bản đang chạy đã có một năm học đang dùng
  const system = createDatabase<SystemDatabase>(replaceDatabaseName(adminUrl, systemName), { max: 1 });
  try {
    const year = await system
      .insertInto('academic_years')
      .values({ name: '2026–2027' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await system
      .insertInto('academic_year_databases')
      .values({ academic_year_id: year.id, database_name: yearName, status: 'active', opened_at: new Date() })
      .execute();
  } finally {
    await system.destroy();
  }
});

after(async () => {
  setMultiTenantMode(false);
  await platform.destroy();
  for (const name of [platformName, identityName, systemName, yearName]) {
    await dropDatabaseIfExists(adminUrl, name);
  }
});

function options(
  overrides: Partial<Parameters<typeof adoptExistingSchool>[0]> = {},
): Parameters<typeof adoptExistingSchool>[0] {
  return {
    platform,
    masterKey,
    code: 'truong-mot',
    name: 'Trường số 1 (giả)',
    domains: [`mot-${suffix}.e2e.localhost`, `Quan-Ly-${suffix}.E2E.localhost:5173`],
    identityUrl: replaceDatabaseName(adminUrl, identityName),
    systemUrl: replaceDatabaseName(adminUrl, systemName),
    yearDatabasePrefix: `school_year_adopt_${suffix}_`,
    childEncryptionKey: encryptionKey,
    childHashKey: hashKey,
    ...overrides,
  };
}

describe('hostFromSiteSetting', () => {
  it('lấy tên miền từ giá trị biến môi trường', () => {
    assert.equal(hostFromSiteSetting('portal.truong.vn'), 'portal.truong.vn');
    assert.equal(hostFromSiteSetting('https://Portal.Truong.vn/duong-dan'), 'portal.truong.vn');
    assert.equal(hostFromSiteSetting('http://localhost:5173'), 'localhost');
    assert.equal(hostFromSiteSetting(''), undefined);
    assert.equal(hostFromSiteSetting(undefined), undefined);
  });
});

describe('nhận bản đang chạy làm trường số 1', () => {
  it('ghi trường, cơ sở dữ liệu hiện có (không đổi tên), khóa, tên miền; tiền tố khóa trống', async () => {
    const result = await adoptExistingSchool(options());
    assert.equal(result.created, true);
    assert.deepEqual(result.databases, ['identity', 'system', yearName]);
    assert.equal(result.domains.length, 2);

    const school = await platform
      .selectFrom('schools')
      .selectAll()
      .where('id', '=', result.schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(school.legacy, true);
    assert.equal(school.key_prefix, '');
    assert.equal(school.data_class, 'production');
    assert.equal(school.year_database_prefix, `school_year_adopt_${suffix}_`);
    const databases = await platform
      .selectFrom('school_databases')
      .select(['kind', 'name', 'database_name', 'layout'])
      .where('school_id', '=', result.schoolId)
      .orderBy('kind')
      .execute();
    assert.deepEqual(
      databases.map((row) => [row.kind, row.database_name, row.layout]),
      [
        ['identity', identityName, 'database'],
        ['school-year', yearName, 'database'],
        ['system', systemName, 'database'],
      ],
    );
  });

  it('chạy lặp được: không tạo thêm hàng, cập nhật tên', async () => {
    const before = await platform
      .selectFrom('school_databases')
      .select((builder) => builder.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const again = await adoptExistingSchool(options({ name: 'Trường số 1 đổi tên (giả)' }));
    assert.equal(again.created, false);
    const after = await platform
      .selectFrom('school_databases')
      .select((builder) => builder.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    assert.equal(after.n, before.n);
    const school = await platform
      .selectFrom('schools')
      .select('name')
      .where('id', '=', again.schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(school.name, 'Trường số 1 đổi tên (giả)');
  });

  it('không nhận thêm bản đang chạy thứ hai mang mã khác', async () => {
    await assert.rejects(adoptExistingSchool(options({ code: 'truong-hai' })), /trường số 1 mang mã khác/);
  });

  it('từ chối mã sai, khóa sai độ dài, thiếu tên miền', async () => {
    await assert.rejects(adoptExistingSchool(options({ code: 'Sai Ma' })));
    await assert.rejects(adoptExistingSchool(options({ childHashKey: randomBytes(16) })), /32 byte/);
    await assert.rejects(adoptExistingSchool(options({ domains: [] })), /tên miền/);
  });

  it('bộ phân giải đọc được trường, kết nối đúng cơ sở dữ liệu cũ, khóa khớp cấu hình cũ, khóa tên cũ còn đúng', async () => {
    const registry = new TenantRegistry(platform, masterKey);
    const tenant = await registry.resolveHost(`mot-${suffix}.e2e.localhost`);
    assert.equal(tenant?.code, 'truong-mot');
    assert.deepEqual(tenant?.childDataEncryptionKey, encryptionKey);
    assert.deepEqual(tenant?.childDataHashKey, hashKey);
    assert.equal((await registry.resolveHost(`quan-ly-${suffix}.e2e.localhost`))?.code, 'truong-mot');
    assert.ok(tenant);

    const connections = new TenantConnections(registry);
    try {
      const identity = connections.database<unknown>(tenant, 'identity', 'identity');
      const users = await sql<{ ok: boolean }>`select to_regclass('users') is not null as ok`.execute(identity);
      assert.equal(users.rows[0]?.ok, true);
      const year = connections.database<unknown>(tenant, 'school-year', yearName);
      const children = await sql<{ ok: boolean }>`select to_regclass('children') is not null as ok`.execute(year);
      assert.equal(children.rows[0]?.ok, true);
      setMultiTenantMode(true);
      runAsSchool(tenant, () => {
        assert.equal(storageKey('incoming-documents', 'a'), 'incoming-documents/a');
        assert.equal(cacheKey('counts', 'u1'), 'counts:u1');
      });
    } finally {
      setMultiTenantMode(false);
      await connections.closeAll();
    }
  });
});

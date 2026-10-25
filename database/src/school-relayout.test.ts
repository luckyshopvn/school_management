import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { IdentityDatabase } from '../identity/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { dropSchool } from './provision-school.js';
import { connectionStringOf, descriptorFromRow } from './school-database-layout.js';
import {
  runProvisioningJob,
  startProvisioning,
  suspendSchool,
  type Actor,
  type LifecycleEnvironment,
} from './school-lifecycle.js';
import { relayoutSchool } from './school-relayout.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Chuyển trường giữa hai nền tảng và hai bố cục (DT-SaaS phần S9, YCTD-203): nguồn bố cục schema (hồ sơ thử nghiệm), đích bố cục
// database (hồ sơ vận hành); dữ liệu giả, mọi cơ sở dữ liệu dựng riêng cho lần chạy
const actor: Actor = { type: 'cli', name: 'Kiểm thử S9' };
let source: TenantTestPlatform;
let target: TenantTestPlatform;
let environment: LifecycleEnvironment;
let code: string;

before(async () => {
  source = await startTenantTestPlatform({ schools: [], layout: 'schema', label: 's9src' });
  target = await startTenantTestPlatform({ schools: [], layout: 'database', label: 's9dst' });
  environment = {
    platform: source.platform,
    masterKey: source.masterKey,
    layout: source.layout,
    systemDomain: 'thu.example.test',
  };
  code = `rl-${source.suffix}`;
});

after(async () => {
  for (const side of [source, target]) {
    const school = await side?.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
    if (school) {
      await dropSchool({
        platform: side.platform,
        masterKey: side.masterKey,
        layout: side.layout,
        schoolId: school.id,
      }).catch(() => undefined);
    }
  }
  await source?.close();
  await target?.close();
});

describe('chuyển trường sang nền tảng và bố cục khác', () => {
  it('chép đủ cơ sở dữ liệu, khớp số dòng và tổng kiểm; khóa dữ liệu trẻ bọc lại bằng khóa gốc của đích', async () => {
    const started = await startProvisioning(
      environment,
      {
        code,
        name: 'Trường chuyển bố cục (dữ liệu giả)',
        levels: ['THCS', 'THPT'],
        first_year_start: 2026,
        domain: { mode: 'system' },
        data_class: 'synthetic',
        admin: { full_name: 'Quản trị giả', login: 'quantri' },
        terms: { version: 'PL-04 v1', accepted: true, accepted_by_name: 'Hiệu trưởng giả' },
        hosting: [
          { provider: 'Nhà cung cấp giả', service: 'PostgreSQL', region: 'Singapore', started_on: '2026-10-25' },
        ],
      },
      actor,
    );
    assert.equal((await runProvisioningJob(environment, started.jobId)).status, 'done');

    await assert.rejects(
      () =>
        relayoutSchool({
          source: { platform: source.platform, masterKey: source.masterKey },
          target: {
            platform: target.platform,
            masterKey: target.masterKey,
            layout: target.layout,
          },
          code,
          actor,
        }),
      /Tạm dừng/,
    );
    await suspendSchool(environment, code, actor, 'Chuyển sang hồ sơ vận hành (giả)');

    const lines: string[] = [];
    const report = await relayoutSchool({
      source: { platform: source.platform, masterKey: source.masterKey },
      target: {
        platform: target.platform,
        masterKey: target.masterKey,
        layout: target.layout,
      },
      code,
      actor,
      onProgress: (line) => lines.push(line),
    });
    assert.equal(report.databases.length, 3);
    assert.ok(report.tables.length > 100, `chỉ ${report.tables.length} bảng`);
    assert.ok(report.tables.every((table) => table.checksumMatches));
    assert.equal(lines.length, 3);

    const school = await target.platform
      .selectFrom('schools')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    assert.equal(school.status, 'suspended');
    assert.deepEqual(school.school_levels, ['THCS', 'THPT']);
    const databases = await target.platform
      .selectFrom('school_databases')
      .selectAll()
      .where('school_id', '=', school.id)
      .execute();
    assert.ok(databases.every((row) => row.layout === 'database' && row.schema_name === null));
    const hosting = await target.platform
      .selectFrom('school_hosting')
      .selectAll()
      .where('school_id', '=', school.id)
      .execute();
    assert.equal(hosting.length, 1);
    const domains = await target.platform
      .selectFrom('school_domains')
      .selectAll()
      .where('school_id', '=', school.id)
      .execute();
    assert.equal(domains[0]?.host, `${code}.thu.example.test`);

    // Khóa dữ liệu trẻ giữ nguyên giá trị nhưng bọc bằng khóa gốc của đích
    const sourceRecord = await source
      .createRuntime()
      .registry.loadSchool(
        (await source.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirstOrThrow())
          .id,
      );
    const targetRecord = await target.createRuntime().registry.loadSchool(school.id);
    assert.ok(sourceRecord?.context.childDataEncryptionKey);
    assert.deepEqual(targetRecord?.context.childDataEncryptionKey, sourceRecord?.context.childDataEncryptionKey);

    // Dữ liệu đọc được bằng vai trò của trường ở đích
    const identityRow = databases.find((row) => row.kind === 'identity');
    assert.ok(identityRow);
    const identity = createDatabase<IdentityDatabase>(
      connectionStringOf(descriptorFromRow(identityRow, target.masterKey)),
      {
        max: 1,
      },
    );
    try {
      const user = await identity
        .selectFrom('users')
        .select('username')
        .where('username', '=', 'quantri')
        .executeTakeFirst();
      assert.equal(user?.username, 'quantri');
    } finally {
      await identity.destroy();
    }
    const systemRow = databases.find((row) => row.kind === 'system');
    assert.ok(systemRow);
    const system = createDatabase<SystemDatabase>(connectionStringOf(descriptorFromRow(systemRow, target.masterKey)), {
      max: 1,
    });
    try {
      const enabled = await system
        .selectFrom('school_levels')
        .select('code')
        .where('is_enabled', '=', true)
        .orderBy('code')
        .execute();
      assert.deepEqual(
        enabled.map((row) => row.code),
        ['THCS', 'THPT'],
      );
    } finally {
      await system.destroy();
    }

    await assert.rejects(
      () =>
        relayoutSchool({
          source: { platform: source.platform, masterKey: source.masterKey },
          target: {
            platform: target.platform,
            masterKey: target.masterKey,
            layout: target.layout,
          },
          code,
          actor,
        }),
      /đã có trường/,
    );
  });
});

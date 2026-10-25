import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import type { IdentityDatabase } from '../identity/schema.js';
import type { SchoolYearDatabase } from '../school-year/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { createDomainProvider, DnsCheckDomainProvider, type DnsResolver } from './domain-provider.js';
import { dropSchool } from './provision-school.js';
import { connectionStringOf, type DatabaseDescriptor } from './school-database-layout.js';
import {
  addConsent,
  addHosting,
  cancelDeletion,
  changeDataClass,
  consentGaps,
  customDomainProblem,
  dueDeletions,
  findInvitation,
  hashActivationToken,
  LifecycleError,
  markInvitationUsed,
  migrateSchools,
  purgeSchool,
  reissueInvitation,
  requestCustomDomain,
  requestDeletion,
  resumeSchool,
  rollbackProvisioningJob,
  runProvisioningJob,
  startProvisioning,
  suspendSchool,
  validateSetup,
  verifyCustomDomain,
  type Actor,
  type ConsentInput,
  type LifecycleEnvironment,
  type SchoolSetupInput,
} from './school-lifecycle.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';
import { decryptSecret } from '@school-management/server/tenancy';

// Kiểm thử khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.5, 14.7). Cơ sở dữ liệu nền tảng, cơ sở
// dữ liệu và vai trò của trường dựng riêng cho lần chạy; dữ liệu giả hoàn toàn
const actor: Actor = { type: 'cli', name: 'Kiểm thử S2' };
const SYSTEM_DOMAIN = 'truong.test.localhost';
let test: TenantTestPlatform;
let environment: LifecycleEnvironment;
const created: string[] = [];

function code(name: string): string {
  return `${name}-${test.suffix}`;
}

function setup(name: string, overrides: Partial<SchoolSetupInput> = {}): SchoolSetupInput {
  return {
    code: code(name),
    name: `Trường ${name} (dữ liệu giả)`,
    address: 'Địa chỉ giả',
    levels: ['THCS'],
    first_year_start: 2026,
    domain: { mode: 'system' },
    data_class: 'synthetic',
    admin: { full_name: 'Quản trị giả', login: 'quantri' },
    terms: {
      version: 'PL-04 v1',
      accepted: true,
      accepted_by_name: 'Hiệu trưởng giả',
      accepted_by_title: 'Hiệu trưởng',
    },
    ...overrides,
  };
}

function consent(kind: ConsentInput['kind']): ConsentInput {
  return {
    kind,
    template_code: kind === 'dpa' ? 'PL-01' : 'PL-02',
    template_version: '1.0',
    signer_name: 'Người ký giả',
    signer_title: 'Hiệu trưởng',
    signed_on: '2026-10-01',
    valid_from: '2026-10-01',
    data_scope: 'Dữ liệu học sinh, giáo viên của trường',
    file_sha256: 'a'.repeat(64),
  };
}

async function descriptors(schoolId: string): Promise<DatabaseDescriptor[]> {
  const rows = await test.platform
    .selectFrom('school_databases')
    .selectAll()
    .where('school_id', '=', schoolId)
    .execute();
  return rows.map((row) => ({
    kind: row.kind,
    name: row.name,
    layout: row.layout,
    host: row.host,
    port: row.port,
    databaseName: row.database_name,
    schemaName: row.schema_name,
    roleName: row.role_name,
    password: decryptSecret(test.masterKey, row.password_encrypted),
  }));
}

async function onDatabase<D, T>(
  descriptor: DatabaseDescriptor,
  work: (database: ReturnType<typeof createDatabase<D>>) => Promise<T>,
) {
  const database = createDatabase<D>(connectionStringOf(descriptor), { max: 1 });
  try {
    return await work(database);
  } finally {
    await database.destroy();
  }
}

async function provision(name: string, overrides: Partial<SchoolSetupInput> = {}) {
  const started = await startProvisioning(environment, setup(name, overrides), actor);
  created.push(started.schoolId);
  const result = await runProvisioningJob(environment, started.jobId);
  return { ...started, ...result };
}

before(async () => {
  test = await startTenantTestPlatform({ schools: [], label: 's2' });
  environment = {
    platform: test.platform,
    masterKey: test.masterKey,
    layout: test.layout,
    systemDomain: SYSTEM_DOMAIN,
    ingressHost: 'vao.truong.test.localhost',
  };
});

after(async () => {
  for (const schoolId of created) {
    await dropSchool({ platform: test.platform, masterKey: test.masterKey, layout: test.layout, schoolId }).catch(
      () => undefined,
    );
  }
  await test?.close();
});

describe('Bước setup', () => {
  it('kiểm tra mã, cấp học, tên miền, quản trị viên, điều khoản', () => {
    const problems = validateSetup(
      {
        ...setup('x'),
        code: 'Admin',
        levels: [],
        domain: { mode: 'custom', host: 'a.truong.test.localhost' },
        admin: { full_name: '', login: 'A' },
        terms: { version: '', accepted: false, accepted_by_name: '' },
      },
      environment,
    );
    const fields = problems.map((problem) => problem.field);
    for (const field of [
      'code',
      'levels',
      'domain.host',
      'admin.full_name',
      'admin.login',
      'terms',
      'terms.accepted_by_name',
    ]) {
      assert.ok(fields.includes(field), `thiếu lỗi ${field}`);
    }
  });

  it('dữ liệu thật cần đủ bốn hồ sơ đồng ý và vùng máy chủ', () => {
    const missing = validateSetup(setup('y', { data_class: 'consented', consents: [consent('dpa')] }), environment);
    assert.ok(missing.some((problem) => problem.field === 'consents'));
    const complete = validateSetup(
      setup('y', {
        data_class: 'consented',
        consents: (['dpa', 'consent', 'impact-assessment', 'risk-acceptance'] as const).map(consent),
        hosting: [{ provider: 'Nhà cung cấp giả', service: 'Máy chủ', region: 'VN', started_on: '2026-10-01' }],
      }),
      environment,
    );
    assert.deepEqual(complete, []);
  });

  it('hồ sơ đã rút hoặc hết hạn không tính', () => {
    const gaps = consentGaps(
      [
        { kind: 'dpa', valid_from: '2026-01-01', valid_until: '2026-06-30', withdrawn_on: null },
        { kind: 'consent', valid_from: '2026-01-01', valid_until: null, withdrawn_on: '2026-09-01' },
      ],
      1,
      '2026-10-25',
    );
    assert.equal(gaps.length, 4);
  });

  it('tên miền riêng không được là IP hay thuộc tên miền hệ thống', () => {
    assert.ok(customDomainProblem('10.0.0.1', SYSTEM_DOMAIN));
    assert.ok(customDomainProblem(`abc.${SYSTEM_DOMAIN}`, SYSTEM_DOMAIN));
    assert.equal(customDomainProblem('truong-gia.example.test', SYSTEM_DOMAIN), null);
  });
});

describe('Khởi tạo trường', () => {
  it('chạy đủ bước: cơ sở dữ liệu, cấp học, năm học, đơn vị gốc, quản trị viên, tên miền', async () => {
    const result = await provision('gamma', { levels: ['THCS', 'THPT'] });
    assert.equal(result.status, 'done', result.error ?? '');
    assert.ok(result.activationToken);
    const school = await test.platform
      .selectFrom('schools')
      .selectAll()
      .where('id', '=', result.schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(school.status, 'trial');
    assert.ok(school.cluster_id);
    const domain = await test.platform
      .selectFrom('school_domains')
      .selectAll()
      .where('school_id', '=', result.schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(domain.host, `${code('gamma')}.${SYSTEM_DOMAIN}`);
    assert.equal(domain.status, 'active');

    const all = await descriptors(result.schoolId);
    assert.deepEqual(all.map((item) => item.kind).sort(), ['identity', 'school-year', 'system']);
    const system = all.find((item) => item.kind === 'system') as DatabaseDescriptor;
    await onDatabase<SystemDatabase, void>(system, async (database) => {
      const levels = await database
        .selectFrom('school_levels')
        .select('code')
        .where('is_enabled', '=', true)
        .orderBy('code')
        .execute();
      assert.deepEqual(
        levels.map((level) => level.code),
        ['THCS', 'THPT'],
      );
      const year = await database.selectFrom('academic_years').selectAll().executeTakeFirstOrThrow();
      assert.equal(year.name, '2026-2027');
      assert.equal(year.status, 'open');
      const terms = await database.selectFrom('terms_acceptances').selectAll().execute();
      assert.equal(terms.length, 1);
      assert.equal(terms[0]?.terms_version, 'PL-04 v1');
    });
    const year = all.find((item) => item.kind === 'school-year') as DatabaseDescriptor;
    await onDatabase<SchoolYearDatabase, void>(year, async (database) => {
      const root = await database.selectFrom('org_units').selectAll().where('unit_type', '=', 'truong_chinh').execute();
      assert.equal(root.length, 1);
    });
    const identity = all.find((item) => item.kind === 'identity') as DatabaseDescriptor;
    await onDatabase<IdentityDatabase, void>(identity, async (database) => {
      const user = await database
        .selectFrom('users')
        .selectAll()
        .where('username', '=', 'quantri')
        .executeTakeFirstOrThrow();
      assert.equal(user.status, 'active');
      const roles = await database
        .selectFrom('user_roles')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .select('roles.code')
        .where('user_roles.user_id', '=', user.id)
        .execute();
      assert.deepEqual(
        roles.map((role) => role.code),
        ['VT-02'],
      );
    });
    // Lời mời chỉ lưu mã băm
    const invitation = await findInvitation(
      test.platform,
      result.schoolId,
      result.activationToken as string,
      new Date(),
    );
    assert.ok(invitation);
    assert.equal(invitation.token_hash, hashActivationToken(result.activationToken as string));
    assert.notEqual(invitation.token_hash, result.activationToken);
    assert.equal(await markInvitationUsed(test.platform, invitation.id, new Date()), true);
    assert.equal(await markInvitationUsed(test.platform, invitation.id, new Date()), false);
    assert.equal(
      await findInvitation(test.platform, result.schoolId, result.activationToken as string, new Date()),
      null,
    );
  });

  it('chạy lại việc đã xong không làm gì thêm; mã trường trùng bị từ chối', async () => {
    const job = await test.platform
      .selectFrom('provisioning_jobs')
      .select('id')
      .where('school_code', '=', code('gamma'))
      .executeTakeFirstOrThrow();
    const again = await runProvisioningJob(environment, job.id);
    assert.equal(again.status, 'done');
    assert.equal(again.activationToken, null);
    await assert.rejects(() => startProvisioning(environment, setup('gamma'), actor), LifecycleError);
  });

  it('lỗi giữa chừng thì chạy tiếp được, hoặc hoàn tác xóa sạch', async () => {
    const broken: LifecycleEnvironment = {
      ...environment,
      layout: {
        ...test.layout,
        kind: test.layout.kind,
        create: async (request) => {
          if (request.kind === 'system') {
            throw new Error('Lỗi giả khi tạo cơ sở dữ liệu hệ thống');
          }
          return test.layout.create(request);
        },
        drop: (descriptor) => test.layout.drop(descriptor),
        setReadOnly: (descriptor, readOnly) => test.layout.setReadOnly(descriptor, readOnly),
        dropSchoolRole: (schoolCode) => test.layout.dropSchoolRole(schoolCode),
      },
    };
    const started = await startProvisioning(broken, setup('delta'), actor);
    created.push(started.schoolId);
    const failed = await runProvisioningJob(broken, started.jobId);
    assert.equal(failed.status, 'failed');
    const job = await test.platform
      .selectFrom('provisioning_jobs')
      .selectAll()
      .where('id', '=', started.jobId)
      .executeTakeFirstOrThrow();
    assert.equal(job.current_step, 'database:system');
    assert.deepEqual(job.completed_steps, ['database:identity', 'migrate:identity']);
    // Chạy tiếp với bố cục đã sửa
    const resumed = await runProvisioningJob(environment, started.jobId);
    assert.equal(resumed.status, 'done', resumed.error ?? '');
    assert.equal((await descriptors(started.schoolId)).length, 3);

    const another = await startProvisioning(broken, setup('epsilon'), actor);
    created.push(another.schoolId);
    assert.equal((await runProvisioningJob(broken, another.jobId)).status, 'failed');
    await rollbackProvisioningJob(environment, another.jobId, actor);
    assert.equal(
      await test.platform.selectFrom('schools').select('id').where('id', '=', another.schoolId).executeTakeFirst(),
      undefined,
    );
    const roles = await sql<{
      count: number;
    }>`select count(*)::int as count from pg_roles where rolname like ${`%${code('epsilon').replaceAll('-', '_')}%`}`.execute(
      test.platform,
    );
    assert.equal(roles.rows[0]?.count, 0);
  });
});

describe('Vòng đời', () => {
  it('tạm dừng, mở lại, yêu cầu xóa, hủy xóa, xóa vĩnh viễn', async () => {
    const result = await provision('zeta', { first_year_start: null });
    assert.equal(result.status, 'done', result.error ?? '');
    const suspended = await suspendSchool(environment, code('zeta'), actor, 'Chưa thanh toán (giả)');
    assert.equal(suspended.status, 'suspended');
    await assert.rejects(() => suspendSchool(environment, code('zeta'), actor, null), LifecycleError);
    assert.equal((await resumeSchool(environment, code('zeta'), actor, null)).status, 'active');

    await requestDeletion(environment, code('zeta'), actor, 'Trường ngừng dùng (giả)', 30);
    await assert.rejects(() => purgeSchool(environment, code('zeta'), actor), /Chưa hết thời gian chờ/);
    await cancelDeletion(environment, code('zeta'), actor, null);
    await requestDeletion(environment, code('zeta'), actor, null, 30);

    const later: LifecycleEnvironment = { ...environment, now: () => new Date(Date.now() + 31 * 86_400_000) };
    assert.ok((await dueDeletions(later)).includes(code('zeta')));
    let purgedPrefix = '';
    const record = await purgeSchool(later, code('zeta'), actor, {
      purgeStorage: async (prefix) => {
        purgedPrefix = prefix;
        return 2;
      },
    });
    assert.equal(purgedPrefix, code('zeta'));
    assert.equal(record.files_deleted, 2);
    const school = await test.platform
      .selectFrom('schools')
      .selectAll()
      .where('id', '=', result.schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(school.status, 'deleted');
    assert.ok(school.deletion_record);
    for (const table of ['school_databases', 'school_keys', 'school_domains'] as const) {
      const left = await test.platform
        .selectFrom(table)
        .select('school_id')
        .where('school_id', '=', result.schoolId)
        .execute();
      assert.equal(left.length, 0, table);
    }
    const events = await test.platform
      .selectFrom('school_lifecycle_events')
      .select('event')
      .where('school_id', '=', result.schoolId)
      .orderBy('at')
      .execute();
    assert.deepEqual(
      events.map((event) => event.event),
      [
        'provisioned',
        'suspended',
        'resumed',
        'deletion-requested',
        'deletion-cancelled',
        'deletion-requested',
        'deleted',
      ],
    );
  });

  it('chuyển sang dữ liệu thật phải đủ hồ sơ', async () => {
    await assert.rejects(() => changeDataClass(environment, code('gamma'), 'consented', actor), /Chưa đủ hồ sơ/);
    for (const kind of ['dpa', 'consent', 'impact-assessment', 'risk-acceptance'] as const) {
      await addConsent(environment, code('gamma'), consent(kind), actor);
    }
    await assert.rejects(() => changeDataClass(environment, code('gamma'), 'consented', actor), /Chưa đủ hồ sơ/);
    await addHosting(
      environment,
      code('gamma'),
      { provider: 'Nhà cung cấp giả', service: 'Máy chủ', region: 'VN', started_on: '2026-10-01' },
      actor,
    );
    await changeDataClass(environment, code('gamma'), 'consented', actor);
    const school = await test.platform
      .selectFrom('schools')
      .select('data_class')
      .where('code', '=', code('gamma'))
      .executeTakeFirstOrThrow();
    assert.equal(school.data_class, 'consented');
  });

  it('cấp lại lời mời khi quản trị viên đã kích hoạt thì bị từ chối', async () => {
    await assert.rejects(() => reissueInvitation(environment, code('gamma'), actor), /đã kích hoạt/);
    const token = await reissueInvitation(environment, code('delta'), actor);
    const school = await test.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', code('delta'))
      .executeTakeFirstOrThrow();
    assert.ok(await findInvitation(test.platform, school.id, token, new Date()));
  });

  it('migrate cuốn chiếu ghi kết quả từng cơ sở dữ liệu, trường canary chạy đầu', async () => {
    const lines: string[] = [];
    const result = await migrateSchools(environment, {
      canaryCode: code('delta'),
      onProgress: (line) => lines.push(line),
    });
    assert.equal(result.failed.length, 0);
    assert.ok(result.schools >= 2);
    assert.ok(lines[0]?.startsWith(code('delta')));
    const rows = await test.platform
      .selectFrom('school_migrations')
      .selectAll()
      .where('wave_id', '=', result.waveId)
      .execute();
    assert.ok(rows.some((row) => row.canary));
    assert.ok(rows.every((row) => row.status === 'done'));
  });
});

describe('Tên miền riêng', () => {
  const records = new Map<string, { cname: string[]; txt: string[][] }>();
  const resolver: DnsResolver = {
    resolveCname: async (host) => {
      const found = records.get(host)?.cname;
      if (!found) {
        throw new Error('ENOTFOUND');
      }
      return found;
    },
    resolveTxt: async (host) => {
      const found = records.get(host.replace(/^_school-verify\./, ''))?.txt;
      if (!found) {
        throw new Error('ENOTFOUND');
      }
      return found;
    },
  };

  it('chờ kiểm tra DNS rồi mới hoạt động', async () => {
    const withDns: LifecycleEnvironment = { ...environment, domainProvider: new DnsCheckDomainProvider(resolver) };
    const school = await test.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', code('gamma'))
      .executeTakeFirstOrThrow();
    const host = `truong-${test.suffix}.example.test`;
    const pending = await requestCustomDomain(withDns, school.id, host);
    assert.equal(pending.status, 'pending');
    assert.equal(pending.cname_target, 'vao.truong.test.localhost');
    const first = await verifyCustomDomain(withDns, host, actor);
    assert.equal(first.verified, false);
    assert.equal(first.problems.length, 2);
    records.set(host, { cname: ['vao.truong.test.localhost.'], txt: [[pending.verification_token as string]] });
    const second = await verifyCustomDomain(withDns, host, actor);
    assert.equal(second.verified, true);
    const row = await test.platform
      .selectFrom('school_domains')
      .selectAll()
      .where('host', '=', host)
      .executeTakeFirstOrThrow();
    assert.equal(row.status, 'active');
    assert.equal(row.kind, 'custom');
  });

  it('bộ nối của S9 báo rõ là chưa có', async () => {
    await assert.rejects(() => createDomainProvider('cloudflare-saas').request('a.example.test', null), /S9/);
    assert.throws(() => createDomainProvider('khac'));
  });
});

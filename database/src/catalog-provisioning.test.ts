import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { IdentityDatabase } from '../identity/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import {
  catalogSchoolCode,
  claimProvisioningJob,
  completeCatalogSchool,
  currentSchoolYearStart,
  FREE_PLAN_CODE,
  readCatalogSchool,
  requestCatalogSchool,
} from './catalog-provisioning.js';
import { createDatabase } from './connection.js';
import { dropSchool } from './provision-school.js';
import { importSchoolCatalog } from './school-catalog.js';
import { connectionStringOf } from './school-database-layout.js';
import { LifecycleError, schoolDescriptors, type Actor, type LifecycleEnvironment } from './school-lifecycle.js';
import { loadCurrentPlan, vietnamDate } from './school-plans.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Khởi tạo trường ở lần mở đầu tiên từ danh mục (YCTD-314), CT-314-1 đến CT-314-3. Danh mục lấy từ tệp mẫu giả; mỗi tệp kiểm thử
// dùng mã đơn vị riêng vì tên cơ sở dữ liệu của trường suy ra từ mã Bộ
const actor: Actor = { type: 'cli', name: 'Kiểm thử YCTD-314' };
const SYSTEM_DOMAIN = 'truong.test.localhost';
let test: TenantTestPlatform;
let environment: LifecycleEnvironment;

async function cleanup() {
  const schools = await test.platform.selectFrom('schools').select('id').where('moet_code', 'is not', null).execute();
  for (const school of schools) {
    await dropSchool({ platform: test.platform, masterKey: test.masterKey, layout: test.layout, schoolId: school.id });
  }
}

before(async () => {
  test = await startTenantTestPlatform({ schools: [], label: 'dv' });
  environment = {
    platform: test.platform,
    masterKey: test.masterKey,
    layout: test.layout,
    systemDomain: SYSTEM_DOMAIN,
  };
  const sample = (name: string) => readFile(new URL(`../../platform/catalog-sample/${name}`, import.meta.url), 'utf8');
  await importSchoolCatalog(test.platform, {
    unitsCsv: await sample('don_vi_mau.csv'),
    communesCsv: await sample('phuong_xa_mau.csv'),
    source: 'mau',
    actor,
  });
});

after(async () => {
  await cleanup().catch(() => undefined);
  await test?.close();
});

describe('Mở mọi đơn vị trong danh mục (YCTD-314)', () => {
  it('mã trường, năm học hiện tại', () => {
    assert.equal(catalogSchoolCode('97000201'), 'dv-97000201');
    assert.equal(catalogSchoolCode('AB_12 / 3'), 'dv-ab-12-3');
    assert.ok(catalogSchoolCode('9'.repeat(40)).length <= 32);
    assert.equal(currentSchoolYearStart(new Date('2026-10-28T03:00:00Z')), 2026);
    assert.equal(currentSchoolYearStart(new Date('2027-03-01T03:00:00Z')), 2026);
  });

  it('CT-314-1: hai lần mở đầu cùng lúc chỉ tạo một trường, chỉ một bên chạy khởi tạo; xong thì phục vụ với gói miễn phí', async () => {
    assert.equal((await readCatalogSchool(test.platform, '97000201')).state, 'not_provisioned');
    const [first, second] = await Promise.all([
      requestCatalogSchool(environment, '97000201', actor),
      requestCatalogSchool(environment, '97000201', { type: 'system', name: 'Trang đăng nhập' }),
    ]);
    assert.equal(first.schoolId, second.schoolId);
    assert.equal(first.state, 'provisioning');
    assert.equal([first.claimed, second.claimed].filter(Boolean).length, 1, 'chỉ một bên nhận việc');
    const schools = await test.platform
      .selectFrom('schools')
      .select('id')
      .where('moet_code', '=', '97000201')
      .execute();
    assert.equal(schools.length, 1);
    const jobs = await test.platform
      .selectFrom('provisioning_jobs')
      .select('id')
      .where('school_id', '=', first.schoolId)
      .execute();
    assert.equal(jobs.length, 1);
    // Lần mở thứ ba khi việc đang chạy: không nhận lại
    const third = await requestCatalogSchool(environment, '97000201', actor);
    assert.equal(third.claimed, false);
    assert.equal(third.state, 'provisioning');

    const result = await completeCatalogSchool(environment, first.jobId as string);
    assert.equal(result.status, 'done', result.error ?? '');
    const ready = await requestCatalogSchool(environment, '97000201', actor);
    assert.equal(ready.state, 'ready');
    assert.equal(ready.claimed, false);
    assert.equal(ready.code, 'dv-97000201');

    const school = await test.platform
      .selectFrom('schools')
      .selectAll()
      .where('id', '=', first.schoolId as string)
      .executeTakeFirstOrThrow();
    assert.equal(school.status, 'active');
    assert.equal(school.trial_ends_on, null);
    assert.equal(school.paid_until, null);
    assert.equal(school.data_class, 'synthetic');
    const domain = await test.platform
      .selectFrom('school_domains')
      .select(['host', 'status'])
      .where('school_id', '=', school.id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(domain, { host: `dv-97000201.${SYSTEM_DOMAIN}`, status: 'active' });
    const plan = await loadCurrentPlan(test.platform, school.id, vietnamDate(new Date()));
    assert.equal(plan?.code, FREE_PLAN_CODE);
    assert.ok(plan?.modules?.includes('documents'));
    assert.ok(!plan?.modules?.includes('ai-assistant'));
    assert.ok(!plan?.modules?.includes('online-exam'));

    // Cơ sở dữ liệu định danh, hệ thống, năm học hiện tại; chưa có tài khoản nào, chưa ghi đồng ý điều khoản
    const descriptors = await schoolDescriptors(environment, school.id);
    assert.deepEqual(descriptors.map((item) => item.kind).sort(), ['identity', 'school-year', 'system']);
    const identityDescriptor = descriptors.find((item) => item.kind === 'identity');
    const identity = createDatabase<IdentityDatabase>(connectionStringOf(identityDescriptor!), { max: 1 });
    const systemDescriptor = descriptors.find((item) => item.kind === 'system');
    const system = createDatabase<SystemDatabase>(connectionStringOf(systemDescriptor!), { max: 1 });
    try {
      assert.equal((await identity.selectFrom('users').select('id').execute()).length, 0);
      assert.equal((await system.selectFrom('terms_acceptances').select('id').execute()).length, 0);
      const levels = await system.selectFrom('school_levels').select('code').where('is_enabled', '=', true).execute();
      assert.deepEqual(
        levels.map((level) => level.code),
        ['TH'],
      );
    } finally {
      await identity.destroy();
      await system.destroy();
    }

    // Tính năng trả phí bật riêng cộng vào gói
    await test.platform
      .updateTable('schools')
      .set({ addon_modules: JSON.stringify(['ai-assistant']) })
      .where('id', '=', school.id)
      .execute();
    const withAddon = await loadCurrentPlan(test.platform, school.id, vietnamDate(new Date()));
    assert.ok(withAddon?.modules?.includes('ai-assistant'));
    assert.ok(!withAddon?.modules?.includes('online-exam'));
    const audit = await test.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('school_id', '=', school.id)
      .execute();
    assert.ok(audit.some((row) => row.action === 'school.catalog-provision-requested'));
  });

  it('CT-314-2: việc lỗi hoặc bỏ dở nhận lại được; việc đang chạy không nhận hai lần', async () => {
    const opened = await requestCatalogSchool(environment, '97000101', actor);
    assert.equal(opened.claimed, true);
    const jobId = opened.jobId as string;
    const now = new Date();
    assert.equal(await claimProvisioningJob(test.platform, jobId, now), false);
    // Tiến trình chạy việc dừng giữa chừng: quá 10 phút không cập nhật thì nhận lại
    await test.platform
      .updateTable('provisioning_jobs')
      .set({ updated_at: new Date(now.getTime() - 11 * 60_000) })
      .where('id', '=', jobId)
      .execute();
    assert.equal(await claimProvisioningJob(test.platform, jobId, now), true);
    await test.platform.updateTable('provisioning_jobs').set({ status: 'failed' }).where('id', '=', jobId).execute();
    const retried = await requestCatalogSchool(environment, '97000101', actor);
    assert.equal(retried.claimed, true);
    assert.equal((await completeCatalogSchool(environment, jobId)).status, 'done');
    assert.equal((await readCatalogSchool(test.platform, '97000101')).state, 'ready');
  });

  it('CT-314-3: mã không có trong danh mục; giới hạn số trường tự khởi tạo mỗi giờ', async () => {
    await assert.rejects(
      requestCatalogSchool(environment, '00000000', actor),
      (error: unknown) => error instanceof LifecycleError && error.code === 'not_found',
    );
    await assert.rejects(
      requestCatalogSchool(environment, '97000301', actor, { maxPerHour: 2 }),
      (error: unknown) => error instanceof LifecycleError && /nhiều đơn vị mới/.test(error.message),
    );
    assert.equal((await readCatalogSchool(test.platform, '97000301')).state, 'not_provisioned');
  });
});

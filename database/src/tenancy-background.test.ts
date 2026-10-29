import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { currentTenant } from '@school-management/server/tenancy';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';
import type { TenancyRuntime } from './tenancy-runtime.js';

// Phần chạy nền và công khai của nền đa thuê bao (DT-SaaS phần S1b, tài liệu 47 mục 14.5, 14.7): duyệt các trường đang phục vụ,
// bộ nhớ đệm ngữ cảnh trường, tên miền được phục vụ, trang chọn trường, bảng trạng thái bộ lập lịch. Dùng nền tảng kiểm thử riêng
let environment: TenantTestPlatform;
let runtime: TenancyRuntime;
let rootDomain: string;

before(async () => {
  environment = await startTenantTestPlatform({ schools: ['alpha', 'beta', 'gamma'], label: 'bg' });
  rootDomain = `goc-${environment.suffix}.e2e.localhost`;
  runtime = environment.createRuntime({ PLATFORM_ROOT_DOMAIN: rootDomain });
});

after(async () => {
  await environment.close();
});

async function setStatus(name: string, status: 'active' | 'suspended' | 'deleted' | 'provisioning'): Promise<void> {
  await environment.platform
    .updateTable('schools')
    .set({ status })
    .where('id', '=', environment.school(name).schoolId)
    .execute();
  runtime.registry.invalidate();
}

describe('duyệt các trường đang phục vụ', () => {
  it('chạy việc trong ngữ cảnh của từng trường, kết quả xếp theo mã', async () => {
    const seen: string[] = [];
    const results = await runtime.forEachServingSchool(async (tenant) => {
      assert.equal(currentTenant()?.code, tenant.code);
      seen.push(tenant.code);
    });
    assert.deepEqual(
      results.map((result) => result.schoolCode),
      [...seen].sort(),
    );
    assert.equal(results.length, 3);
    assert.ok(results.every((result) => result.ok));
  });

  it('trường lỗi không chặn trường khác, lỗi được ghi lại', async () => {
    const failing = environment.school('beta').code;
    const results = await runtime.forEachServingSchool(async (tenant) => {
      if (tenant.code === failing) {
        throw new Error('hỏng một trường');
      }
    });
    assert.equal(results.length, 3);
    const failed = results.filter((result) => !result.ok);
    assert.deepEqual(
      failed.map((result) => [result.schoolCode, result.error]),
      [[failing, 'hỏng một trường']],
    );
  });

  it('bỏ qua trường tạm dừng, đang khởi tạo hoặc đã xóa', async () => {
    await setStatus('beta', 'suspended');
    await setStatus('gamma', 'provisioning');
    try {
      const results = await runtime.forEachServingSchool(async () => undefined);
      assert.deepEqual(
        results.map((result) => result.schoolCode),
        [environment.school('alpha').code],
      );
    } finally {
      await setStatus('beta', 'active');
      await setStatus('gamma', 'active');
    }
  });

  it('giới hạn số trường chạy song song', async () => {
    let running = 0;
    let peak = 0;
    await runtime.forEachServingSchool(
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 30));
        running -= 1;
      },
      { concurrency: 2 },
    );
    assert.equal(peak, 2);
  });
});

describe('ngữ cảnh trường có đệm', () => {
  it('nhiều lượt gọi cùng lúc dùng chung một lần nạp', async () => {
    runtime.registry.invalidate();
    const id = environment.school('alpha').schoolId;
    const [a, b, c] = await Promise.all([
      runtime.registry.contextOf(id),
      runtime.registry.contextOf(id),
      runtime.registry.contextOf(id),
    ]);
    assert.equal(a?.code, environment.school('alpha').code);
    assert.equal(a, b);
    assert.equal(b, c);
  });

  it('trường không có thì trả null', async () => {
    assert.equal(await runtime.registry.contextOf('00000000-0000-4000-8000-000000000000'), null);
  });
});

describe('tên miền được phục vụ và trang chọn trường', () => {
  it('tên miền của trường đang dùng và tên miền gốc được phục vụ, tên miền lạ thì không', async () => {
    assert.equal(await runtime.isServedHost(environment.school('alpha').host), true);
    assert.equal(await runtime.isServedHost(rootDomain), true);
    assert.equal(await runtime.isServedHost('khong-co.e2e.localhost'), false);
    assert.equal(await runtime.isServedHost(''), false);
  });

  it('tên miền chưa xác minh, đã tắt hoặc của trường đã xóa không được phục vụ', async () => {
    const host = environment.school('gamma').host;
    await environment.platform
      .updateTable('school_domains')
      .set({ status: 'pending' })
      .where('host', '=', host)
      .execute();
    assert.equal(await runtime.isServedHost(host), false);
    await environment.platform
      .updateTable('school_domains')
      .set({ status: 'verified' })
      .where('host', '=', host)
      .execute();
    assert.equal(await runtime.isServedHost(host), true);
    await setStatus('gamma', 'deleted');
    try {
      assert.equal(await runtime.isServedHost(host), false);
    } finally {
      await setStatus('gamma', 'active');
      await environment.platform
        .updateTable('school_domains')
        .set({ status: 'active' })
        .where('host', '=', host)
        .execute();
    }
  });

  it('đổi mã trường thành địa chỉ chỉ khi trường đang phục vụ', async () => {
    const alpha = environment.school('alpha');
    assert.equal(await runtime.resolveSchoolAddress(alpha.code), `https://${alpha.host}/`);
    assert.equal(await runtime.resolveSchoolAddress(` ${alpha.code.toUpperCase()} `), `https://${alpha.host}/`);
    assert.equal(await runtime.resolveSchoolAddress('khong-co'), null);
    assert.equal(await runtime.resolveSchoolAddress("a'; drop table schools; --"), null);
    await setStatus('beta', 'suspended');
    try {
      assert.equal(await runtime.resolveSchoolAddress(environment.school('beta').code), null);
    } finally {
      await setStatus('beta', 'active');
    }
  });

  it('không có tên miền gốc thì không có trang chọn trường', async () => {
    const plain = environment.createRuntime();
    assert.equal(await plain.resolveSchoolAddress(environment.school('alpha').code), null);
    assert.equal(await plain.isServedHost(rootDomain), false);
  });
});

describe('bảng trạng thái bộ lập lịch', () => {
  it('mỗi việc của mỗi trường một dòng, trạng thái sai bị từ chối', async () => {
    const schoolId = environment.school('alpha').schoolId;
    const insert = () =>
      environment.platform
        .insertInto('scheduler_state')
        .values({ school_id: schoolId, job: 'notification-dispatch', last_run_at: new Date() })
        .execute();
    await insert();
    await assert.rejects(insert);
    const row = await environment.platform
      .selectFrom('scheduler_state')
      .selectAll()
      .where('school_id', '=', schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(Number(row.run_count), 0);
    await assert.rejects(
      environment.platform
        .updateTable('scheduler_state')
        .set({ last_status: 'hỏng' as 'ok' })
        .where('school_id', '=', schoolId)
        .execute(),
    );
  });
});

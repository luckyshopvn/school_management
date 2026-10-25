import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { runAsSchool, SystemClock, currentTenant } from '@school-management/server';
import { AdmissionsRateLimiter } from './admissions/public-rate-limit.js';
import { JobScheduler } from './common/job-scheduler.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from './tenant-test-support.js';

// Việc nền, điểm tick và trang công khai ở chế độ nhiều trường (DT-SaaS phần S1b, tài liệu 32 mục 14.5, 14.7): bộ lập lịch chiếm
// việc đến hạn của từng trường qua cơ sở dữ liệu nền tảng, nhiều bản máy chủ không chạy trùng, trường lỗi không chặn trường khác;
// domain-check theo danh mục tên miền nền tảng; trang chọn trường; giới hạn tần suất công khai tách theo trường
const SECRET = 'bi-mat-kiem-thu-bo-lap-lich';

describe('bộ lập lịch việc nền nhiều trường', () => {
  let environment: MultiTenantApi;
  let rootDomain: string;
  let scheduler: JobScheduler;
  const runs: string[] = [];

  before(async () => {
    rootDomain = `goc-${Math.random().toString(36).slice(2, 8)}.e2e.localhost`;
    environment = await startMultiTenantApi({
      schools: ['alpha', 'beta'],
      label: 'job',
      rootDomain,
      configuration: { schedulerSecret: SECRET },
    });
    scheduler = environment.api.get(JobScheduler);
    scheduler.register({
      name: 'kiem-thu',
      intervalSeconds: 3600,
      run: async () => {
        runs.push(currentTenant()?.code ?? '?');
      },
    });
  });

  after(async () => {
    await environment?.close();
  });

  async function tickWith(secret: string | undefined) {
    const url = new URL(`${environment.apiOrigin}/api/v1/internal/jobs/tick`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(secret ? { 'x-internal-job-token': secret } : {}) },
      body: '{}',
    });
    return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  }

  const stateOf = async (name: string) =>
    environment.platform.platform
      .selectFrom('scheduler_state')
      .selectAll()
      .where('school_id', '=', environment.platform.school(name).schoolId)
      .where('job', '=', 'kiem-thu')
      .executeTakeFirst();

  it('điểm tick đòi bí mật dùng chung và không cần trường', async () => {
    assert.equal((await tickWith(undefined)).status, 401);
    assert.equal((await tickWith('sai-bi-mat')).status, 401);
    assert.equal((await tickWith(SECRET.slice(0, 5))).status, 401);
    // Gọi bằng địa chỉ nội bộ, không phải tên miền của trường nào
    assert.equal((await tickWith(SECRET)).status, 201);
  });

  it('lượt đầu chạy việc cho mọi trường, ghi trạng thái; lượt ngay sau không chạy lại', async () => {
    const first = await tickWith(SECRET);
    assert.equal(first.status, 201);
    assert.equal(first.body.schools, 2);
    assert.deepEqual(first.body.failed, []);
    assert.deepEqual(
      [...runs].sort(),
      [environment.platform.school('alpha').code, environment.platform.school('beta').code].sort(),
    );
    const alpha = await stateOf('alpha');
    assert.equal(Number(alpha?.run_count), 1);
    assert.equal(alpha?.last_status, 'ok');
    assert.ok((alpha?.last_duration_ms ?? -1) >= 0);

    await tickWith(SECRET);
    assert.equal(runs.length, 2);
    assert.equal(Number((await stateOf('alpha'))?.run_count), 1);
  });

  it('việc quá hạn được chạy bù ngay khi có lượt gọi (máy chủ ngủ rồi dậy)', async () => {
    await environment.platform.platform
      .updateTable('scheduler_state')
      .set({ last_run_at: new Date(Date.now() - 2 * 3600_000) })
      .where('job', '=', 'kiem-thu')
      .execute();
    runs.length = 0;
    await tickWith(SECRET);
    assert.equal(runs.length, 2);
    assert.equal(Number((await stateOf('beta'))?.run_count), 2);
  });

  it('hai bản máy chủ gọi cùng lúc: mỗi việc của mỗi trường chỉ chạy một lần', async () => {
    const other = new JobScheduler(
      { schedulerConcurrency: 2 } as ConstructorParameters<typeof JobScheduler>[0],
      environment.apiRuntime,
    );
    other.register({
      name: 'kiem-thu',
      intervalSeconds: 3600,
      run: async () => {
        runs.push(`khac:${currentTenant()?.code ?? '?'}`);
      },
    });
    await environment.platform.platform
      .updateTable('scheduler_state')
      .set({ last_run_at: new Date(Date.now() - 2 * 3600_000) })
      .where('job', '=', 'kiem-thu')
      .execute();
    runs.length = 0;
    await Promise.all([scheduler.tick(), other.tick()]);
    assert.equal(runs.length, 2);
  });

  it('một trường lỗi không chặn trường khác, lỗi ghi vào trạng thái', async () => {
    const failing = environment.platform.school('alpha').code;
    scheduler.register({
      name: 'kiem-thu-loi',
      intervalSeconds: 3600,
      run: async () => {
        if (currentTenant()?.code === failing) {
          throw new Error('trường alpha hỏng');
        }
        runs.push(`loi-ok:${currentTenant()?.code}`);
      },
    });
    runs.length = 0;
    await scheduler.tick();
    assert.deepEqual(runs, [`loi-ok:${environment.platform.school('beta').code}`]);
    const state = await environment.platform.platform
      .selectFrom('scheduler_state')
      .selectAll()
      .where('school_id', '=', environment.platform.school('alpha').schoolId)
      .where('job', '=', 'kiem-thu-loi')
      .executeTakeFirstOrThrow();
    assert.equal(state.last_status, 'error');
    assert.equal(state.last_error, 'trường alpha hỏng');
  });

  it('việc khởi động của tiến trình chạy một lần cho mỗi trường, không chiếm qua cơ sở dữ liệu', async () => {
    let started = 0;
    scheduler.register({
      name: 'khoi-dong',
      intervalSeconds: 3600,
      perProcess: true,
      run: async () => {
        started += 1;
      },
    });
    await scheduler.tick();
    await scheduler.tick();
    assert.equal(started, 2);
    const rows = await environment.platform.platform
      .selectFrom('scheduler_state')
      .select('job')
      .where('job', '=', 'khoi-dong')
      .execute();
    assert.equal(rows.length, 0);
  });
});

describe('công khai theo tên miền gốc', () => {
  let environment: MultiTenantApi;
  const rootDomain = `goc-${Math.random().toString(36).slice(2, 8)}.e2e.localhost`;

  before(async () => {
    environment = await startMultiTenantApi({ schools: ['alpha', 'beta'], label: 'pick', rootDomain });
  });

  after(async () => {
    await environment?.close();
  });

  const get = (path: string, host: string) => sendWithHost(environment.apiOrigin, { path: `/api/v1${path}`, host });

  it('điểm tick không có bí mật cấu hình thì không tồn tại', async () => {
    const reply = await sendWithHost(environment.apiOrigin, {
      method: 'POST',
      path: '/api/v1/internal/jobs/tick',
      body: {},
    });
    assert.equal(reply.status, 404);
  });

  it('domain-check theo danh mục tên miền nền tảng, không cần trường', async () => {
    const check = (domain: string) =>
      get(`/public/website/domain-check?domain=${encodeURIComponent(domain)}`, '127.0.0.1');
    assert.equal((await check(environment.hosts.alpha as string)).status, 200);
    assert.equal((await check(rootDomain)).status, 200);
    assert.equal((await check('khong-co.e2e.localhost')).status, 404);
    assert.equal((await get('/public/website/domain-check', '127.0.0.1')).status, 404);
  });

  it('trang chọn trường đổi mã thành địa chỉ, không liệt kê trường', async () => {
    const alpha = environment.platform.school('alpha');
    const picker = await get('/public/schools/picker', rootDomain);
    assert.equal(picker.status, 200);
    const found = await get(`/public/schools/resolve?code=${alpha.code}`, rootDomain);
    assert.equal(found.status, 200);
    assert.equal(found.body.url, `https://${alpha.host}/`);
    assert.equal((await get('/public/schools/resolve?code=khong-co', rootDomain)).status, 404);
    assert.equal((await get('/public/schools/resolve', rootDomain)).status, 404);
    await environment.platform.platform
      .updateTable('schools')
      .set({ status: 'suspended' })
      .where('id', '=', alpha.schoolId)
      .execute();
    environment.apiRuntime.registry.invalidate();
    assert.equal((await get(`/public/schools/resolve?code=${alpha.code}`, rootDomain)).status, 404);
  });

  it('giới hạn tần suất công khai tách theo trường', async () => {
    const limiter = new AdmissionsRateLimiter(new SystemClock());
    const beta = await environment.tenantOf('beta');
    const hits = (tenant: typeof beta, count: number) =>
      runAsSchool(tenant, async () => {
        for (let index = 0; index < count; index += 1) {
          limiter.hit('submit', '203.0.113.9');
        }
      });
    await hits(beta, 10);
    await assert.rejects(() => hits(beta, 1), /tối đa 10 hồ sơ/);
    // Cùng địa chỉ mạng ở trường khác còn nguyên hạn mức
    const other = { ...beta, code: `${beta.code}-khac` };
    await hits(other, 10);
  });
});

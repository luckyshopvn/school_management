import { request as playwrightRequest } from '@playwright/test';
import { readTenancyConfiguration, TenancyRuntime } from '@school-management/database';
import { E2E_MULTI_API_PORT, E2E_ROOT_DOMAIN, E2E_SCHEDULER_SECRET, schoolHost } from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S1b (YCTD-192, spec 131): việc nền theo từng trường và các điểm công khai theo tên miền gốc. Điểm tick của bộ lập
// lịch chạy việc đến hạn của mọi trường (việc thật: gửi thông báo, văn thư, xuất nền, đồng bộ máy xếp, nhắc việc) và ghi trạng thái
// vào cơ sở dữ liệu nền tảng; domain-check theo danh mục tên miền nền tảng; trang chọn trường đổi mã thành địa chỉ, không liệt kê
// trường. Chỉ chạy ở dự án nhiều trường (pnpm --filter @school-management/tests e2e:multi)
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const JOBS = ['archives', 'directives', 'export-jobs', 'notification-dispatch', 'timetable-sync'];

let runtime: TenancyRuntime;
const schoolIds: Record<string, string> = {};

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  for (const code of ['alpha', 'beta']) {
    const tenant = await runtime.registry.resolveHost(schoolHost(code));
    if (!tenant) {
      throw new Error(`Chưa dựng trường ${code}`);
    }
    schoolIds[code] = tenant.schoolId;
  }
});

test.afterAll(async () => {
  await runtime?.close();
});

async function tick(secret: string | null) {
  const context = await playwrightRequest.newContext();
  try {
    // Gọi bằng địa chỉ nội bộ, không mang tên miền của trường nào
    const response = await context.post(`${API}/api/v1/internal/jobs/tick`, {
      data: {},
      ...(secret ? { headers: { 'x-internal-job-token': secret } } : {}),
    });
    return { status: response.status(), body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  } finally {
    await context.dispose();
  }
}

test('Điểm tick đòi bí mật; có bí mật thì chạy việc nền của mọi trường và ghi trạng thái', async () => {
  expect((await tick(null)).status).toBe(401);
  expect((await tick('sai-bi-mat')).status).toBe(401);

  const response = await tick(E2E_SCHEDULER_SECRET);
  expect(response.status).toBe(201);
  const body = response.body as unknown as { jobs: string[]; schools: number; failed: string[] };
  expect(body.jobs).toEqual(expect.arrayContaining([...JOBS, 'emis-forms']));
  expect(body.schools).toBeGreaterThanOrEqual(2);
  expect(body.failed).toEqual([]);

  const rows = await runtime.platform
    .selectFrom('scheduler_state')
    .select(['school_id', 'job', 'run_count', 'last_status'])
    .where('school_id', 'in', Object.values(schoolIds))
    .execute();
  for (const id of Object.values(schoolIds)) {
    for (const job of JOBS) {
      const row = rows.find((candidate) => candidate.school_id === id && candidate.job === job);
      expect(row, `${job} của trường ${id}`).toBeTruthy();
      expect(row?.last_status).toBe('ok');
    }
  }
  // Việc khởi động của tiến trình không chiếm qua cơ sở dữ liệu
  expect(rows.some((row) => row.job === 'emis-forms')).toBe(false);

  // Lượt gọi ngay sau đó chưa đến hạn nên không chạy lại
  const before = new Map(rows.map((row) => [`${row.school_id}:${row.job}`, Number(row.run_count)]));
  expect((await tick(E2E_SCHEDULER_SECRET)).status).toBe(201);
  const after = await runtime.platform
    .selectFrom('scheduler_state')
    .select(['school_id', 'job', 'run_count'])
    .where('school_id', 'in', Object.values(schoolIds))
    .execute();
  for (const row of after) {
    expect(Number(row.run_count)).toBe(before.get(`${row.school_id}:${row.job}`));
  }
});

test('Domain-check theo danh mục tên miền nền tảng, không cần trường', async () => {
  const context = await playwrightRequest.newContext();
  try {
    const check = async (domain: string) =>
      (await context.get(`${API}/api/v1/public/website/domain-check?domain=${encodeURIComponent(domain)}`)).status();
    expect(await check(schoolHost('alpha'))).toBe(200);
    expect(await check(schoolHost('beta'))).toBe(200);
    expect(await check(E2E_ROOT_DOMAIN)).toBe(200);
    expect(await check('khong-co.e2e.localhost')).toBe(404);
  } finally {
    await context.dispose();
  }
});

test('Trang chọn trường đổi mã thành địa chỉ trường và không liệt kê trường', async () => {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: E2E_ROOT_DOMAIN } });
  try {
    const page = await context.get(`${API}/api/v1/public/schools/picker`);
    expect(page.status()).toBe(200);
    expect(await page.text()).not.toContain('alpha');
    const found = await context.get(`${API}/api/v1/public/schools/resolve?code=alpha`);
    expect(found.status()).toBe(200);
    expect(((await found.json()) as { url: string }).url).toBe(`https://${schoolHost('alpha')}/`);
    expect((await context.get(`${API}/api/v1/public/schools/resolve?code=khong-co`)).status()).toBe(404);
  } finally {
    await context.dispose();
  }
});

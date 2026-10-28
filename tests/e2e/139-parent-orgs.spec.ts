import { request as playwrightRequest } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  operatorOtp,
  totpCode,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_PORTAL_PORT,
  E2E_SCHEDULER_SECRET,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// DT-SaaS phần S6 (YCTD-202, spec 139), kịch bản CT-S6-9: người vận hành tạo tài khoản cấp Sở (khóa xác thực hai lớp hiện một lần);
// quản trị trường alpha đồng ý chia sẻ nhóm Quy mô với cấp Sở; tài khoản Sở đăng nhập trang Đơn vị cấp trên bằng mã TOTP, thấy
// alpha trong so sánh, beta (chưa đồng ý) không có; xuất Excel. Cuối kịch bản trả lại như cũ. Chỉ chạy ở dự án nhiều trường; dữ liệu
// giả
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const PASSWORD = 'MatKhauVanHanh2026';
const suffix = Math.random().toString(36).slice(2, 7);
const operatorLogin = `van-hanh-${suffix}`;
const parentLogin = `so-gia-${suffix}`;

let runtime: TenancyRuntime;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
let admin: TestUser;
const tenants: Record<string, TenantContext> = {};
const unitIds: string[] = [];

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
    tenants[code] = tenant;
  }
  admin = await createTestUser(
    runtime.connections.database<IdentityDatabase>(tenants.alpha as TenantContext, 'identity', 'identity'),
    {
      roles: [{ roleCode: 'VT-02', orgUnitId: null }],
    },
  );
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Người vận hành giả',
    password: PASSWORD,
  });
  // Cây giả: Bộ › Sở › hai Phòng; alpha thuộc Phòng 1, beta thuộc Phòng 2
  const insert = async (
    level: 'ministry' | 'department' | 'commune',
    code: string,
    name: string,
    parentId: string | null,
  ) => {
    const row = await runtime.platform
      .insertInto('admin_units')
      .values({ level, code: `${code}-${suffix}`, name, parent_id: parentId })
      .returning('id')
      .executeTakeFirstOrThrow();
    unitIds.unshift(row.id);
    return row.id;
  };
  const ministry = await insert('ministry', 'bo', `Bộ giả ${suffix}`, null);
  const department = await insert('department', 'so', `Sở giả ${suffix}`, ministry);
  const first = await insert('commune', 'phong-1', `Phòng giả 1 ${suffix}`, department);
  const second = await insert('commune', 'phong-2', `Phòng giả 2 ${suffix}`, department);
  await runtime.platform
    .updateTable('schools')
    .set({ admin_unit_id: first })
    .where('id', '=', tenants.alpha?.schoolId as string)
    .execute();
  await runtime.platform
    .updateTable('schools')
    .set({ admin_unit_id: second })
    .where('id', '=', tenants.beta?.schoolId as string)
    .execute();
});

test.afterAll(async () => {
  if (runtime) {
    const schoolIds = Object.values(tenants).map((tenant) => tenant.schoolId);
    await runtime.platform.updateTable('schools').set({ admin_unit_id: null }).where('id', 'in', schoolIds).execute();
    await runtime.platform
      .updateTable('school_aggregate_consents')
      .set({ revoked_at: new Date(), revoked_by_name: 'Kiểm thử e2e' })
      .where('school_id', 'in', schoolIds)
      .where('revoked_at', 'is', null)
      .execute();
    await runtime.platform.deleteFrom('parent_org_users').where('login', '=', parentLogin).execute();
    for (const id of unitIds) {
      await runtime.platform.deleteFrom('admin_units').where('id', '=', id).execute();
    }
    await runtime.close();
  }
});

async function signIn(page: Page, user: TestUser) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('CT-S6-9: tài khoản cấp Sở có xác thực hai lớp; trường đồng ý mới có trong số liệu; xuất Excel', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  // Bản chụp tổng hợp của mọi trường qua điểm tick của bộ lập lịch
  const api = await playwrightRequest.newContext();
  try {
    const tick = await api.post(`${API}/api/v1/internal/jobs/tick`, {
      headers: { 'x-internal-job-token': E2E_SCHEDULER_SECRET },
    });
    expect(tick.status()).toBe(201);
  } finally {
    await api.dispose();
  }

  // Người vận hành tạo tài khoản cấp Sở; khóa TOTP hiện một lần
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Đơn vị cấp trên' }).click();
  await expect(consolePage.getByRole('table', { name: 'Cây đơn vị' })).toContainText(`Sở giả ${suffix}`);
  const form = consolePage.getByRole('form', { name: 'Thêm tài khoản cấp trên' });
  await form.getByLabel('Tên đăng nhập').fill(parentLogin);
  await form.getByLabel('Họ tên').fill('Chuyên viên Sở giả');
  await form.getByLabel('Mật khẩu ban đầu').fill(PASSWORD);
  await form.getByLabel('Đơn vị').selectOption({ label: `Sở giả ${suffix}` });
  await form.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const secret = ((await consolePage.getByTestId('totp-secret').textContent()) ?? '').trim();
  expect(secret.length).toBeGreaterThan(10);
  await consoleContext.close();

  // Quản trị trường alpha đồng ý chia sẻ Quy mô với cấp Sở
  const schoolContext = await browser.newContext({ baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}` });
  const schoolPage = await schoolContext.newPage();
  await signIn(schoolPage, admin);
  await schoolPage.goto('/parent-org-consents');
  await expect(schoolPage.getByLabel('Đơn vị quản lý')).toContainText(`Sở giả ${suffix}`);
  await schoolPage.getByLabel('Quy mô cho Sở').check();
  await schoolPage.getByRole('button', { name: 'Lưu đồng ý' }).click();
  await expect(schoolPage.getByText('Đã lưu đồng ý chia sẻ số liệu')).toBeVisible();
  await schoolContext.close();

  // Tài khoản cấp Sở: đăng nhập có mã TOTP, thấy alpha, không thấy beta; xuất Excel
  const parentContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const parentPage = await parentContext.newPage();
  await parentPage.goto('/cap-tren');
  const login = parentPage.getByRole('form', { name: 'Đăng nhập cấp trên' });
  await login.getByLabel('Tên đăng nhập').fill(parentLogin);
  await login.getByLabel('Mật khẩu').fill(PASSWORD);
  await login.getByLabel('Mã xác thực hai lớp').fill(totpCode(secret, new Date()));
  await login.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(parentPage.getByRole('heading', { name: 'Số liệu tổng hợp' })).toBeVisible();
  const comparison = parentPage.getByRole('table', { name: 'So sánh trường' });
  await expect(comparison).toContainText(tenants.alpha?.name as string);
  await expect(comparison).not.toContainText(tenants.beta?.name as string);
  const download = parentPage.waitForEvent('download');
  await parentPage.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  await parentContext.close();
});

import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type SystemDatabase,
  type TenantContext,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  operatorOtp,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_PORTAL_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';

// DT-SaaS phần S4 (YCTD-197, spec 136), kịch bản CT-S4-9: quản trị trường alpha thấy biểu ngữ bảo trì, bật cho phép hỗ trợ chỉ
// đọc; người vận hành xem bảng điều khiển, mở phiên hỗ trợ ở trang chi tiết trường; đường liên kết một lần đưa vào cổng quản trị
// của trường với biểu ngữ "phiên hỗ trợ"; quản trị rút cho phép thì phiên hỗ trợ hết hiệu lực. Chỉ chạy ở dự án nhiều trường.
// Dữ liệu giả
const PASSWORD = 'MatKhauVanHanh2026';
const operatorLogin = `ho-tro-${Math.random().toString(36).slice(2, 8)}`;

let runtime: TenancyRuntime;
let admin: TestUser;
let tenant: TenantContext;
let noticeId = '';
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  const resolved = await runtime.registry.resolveHost(schoolHost('alpha'));
  if (!resolved) {
    throw new Error('Chưa dựng trường alpha');
  }
  tenant = resolved;
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  admin = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Nhân viên hỗ trợ giả',
    password: PASSWORD,
  });
  const notice = await runtime.platform
    .insertInto('maintenance_notices')
    .values({
      title: 'Nâng cấp hệ thống (e2e)',
      body: 'Hệ thống tạm ngừng 30 phút',
      severity: 'warning',
      starts_at: new Date(Date.now() + 3_600_000),
      ends_at: new Date(Date.now() + 5_400_000),
      audience: 'schools',
      school_codes: JSON.stringify([tenant.code]),
      created_by_name: 'Người vận hành giả',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  noticeId = notice.id;
});

test.afterAll(async () => {
  if (runtime) {
    await runtime.platform.deleteFrom('maintenance_notices').where('id', '=', noticeId).execute();
    const system = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
    await system
      .updateTable('support_access_grants')
      .set({ revoked_at: new Date() })
      .where('revoked_at', 'is', null)
      .execute();
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

test('CT-S4-9: bảo trì, cho phép hỗ trợ, phiên hỗ trợ chỉ đọc từ cổng nền tảng, rút cho phép', async ({ browser }) => {
  test.setTimeout(180_000);
  const schoolBase = `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}`;

  // Quản trị trường: biểu ngữ bảo trì, bật cho phép hỗ trợ chỉ đọc
  const adminContext = await browser.newContext({ baseURL: schoolBase });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin);
  await expect(adminPage.getByRole('note', { name: 'Thông báo bảo trì' })).toContainText('Nâng cấp hệ thống (e2e)');
  await adminPage.goto('/support-access');
  await expect(adminPage.getByRole('heading', { name: 'Cho phép hỗ trợ' })).toBeVisible();
  const grantForm = adminPage.getByRole('form', { name: 'Bật cho phép hỗ trợ' });
  await grantForm.getByLabel('Thời hạn (giờ, 1 đến 168)').fill('2');
  await grantForm.getByLabel('Lý do').fill('Nhờ kiểm tra báo cáo (e2e)');
  await grantForm.getByRole('button', { name: 'Cho phép hỗ trợ' }).click();
  await expect(adminPage.getByLabel('Cho phép đang hiệu lực')).toContainText('chỉ đọc');

  // Người vận hành: bảng điều khiển, mở phiên hỗ trợ ở trang chi tiết trường
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await consolePage.getByLabel('Tên đăng nhập').fill(operatorLogin);
  await consolePage.getByLabel('Mật khẩu').fill(PASSWORD);
  await consolePage
    .getByLabel('Mã xác thực hai lớp')
    .fill(await operatorOtp(runtime.platform, operator.id, operator.secret));
  await consolePage.getByRole('button', { name: 'Đăng nhập' }).click();
  const menu = consolePage.getByRole('navigation', { name: 'Menu' });
  await menu.getByRole('button', { name: 'Bảng điều khiển' }).click();
  await expect(consolePage.getByRole('heading', { name: 'Bảng điều khiển' })).toBeVisible();
  await expect(
    consolePage.getByRole('table', { name: 'Danh sách trường' }).getByRole('row', { name: new RegExp(tenant.code) }),
  ).toBeVisible();
  await menu.getByRole('button', { name: 'Bảo trì' }).click();
  await expect(consolePage.getByRole('table', { name: 'Danh sách thông báo bảo trì' })).toContainText(
    'Nâng cấp hệ thống (e2e)',
  );
  await menu.getByRole('button', { name: 'Trường' }).click();
  await consolePage.getByRole('button', { name: tenant.code, exact: true }).click();
  const support = consolePage.getByRole('region', { name: 'Phiên hỗ trợ' });
  await expect(support).toContainText('Trường đang cho phép hỗ trợ (chỉ đọc)');
  await support.getByLabel('Lý do hỗ trợ').fill('Kiểm tra báo cáo theo yêu cầu (e2e)');
  await support.getByRole('button', { name: 'Mở phiên hỗ trợ' }).click();
  const link = support.getByTestId('support-handoff');
  await expect(link).toBeVisible();
  const handoff = new URL((await link.textContent()) ?? '', schoolBase);
  await consoleContext.close();

  // Đường liên kết một lần: vào cổng quản trị của trường bằng tài khoản hỗ trợ, có biểu ngữ phiên hỗ trợ
  const supportContext = await browser.newContext({ baseURL: schoolBase });
  const supportPage = await supportContext.newPage();
  await supportPage.goto(`${handoff.pathname}${handoff.search}`);
  await expect(supportPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(supportPage.getByRole('status', { name: 'Phiên hỗ trợ' })).toContainText('Nhân viên hỗ trợ giả');

  // Quản trị thấy phiên đang mở rồi rút cho phép; phiên hỗ trợ hết hiệu lực
  await adminPage.reload();
  await expect(adminPage.getByRole('status', { name: 'Phiên hỗ trợ' })).toBeVisible();
  await adminPage.getByRole('button', { name: 'Rút cho phép' }).click();
  await expect(adminPage.getByText('Đã rút cho phép hỗ trợ')).toBeVisible();
  await supportPage.reload();
  await expect(supportPage.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await supportContext.close();
  await adminContext.close();
});

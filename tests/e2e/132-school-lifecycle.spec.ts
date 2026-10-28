import { request as playwrightRequest } from '@playwright/test';
import {
  dropSchool,
  lifecycleEnvironmentOf,
  lifecycleSettingsFrom,
  readTenancyConfiguration,
  TenancyRuntime,
} from '@school-management/database';
import { createPlatformOperatorWithTotp, operatorOtp } from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_PORTAL_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// DT-SaaS phần S2 (YCTD-193, spec 132): người vận hành khởi tạo trường gamma ở cổng nền tảng qua bước setup năm bước, quản trị
// viên đầu tiên kích hoạt bằng đường liên kết một lần ở tên miền của trường rồi đăng nhập; tạm dừng thì trường trả 503, mở lại thì
// phục vụ lại. Chỉ chạy ở dự án nhiều trường; dữ liệu giả hoàn toàn
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const CODE = 'gamma';
const PASSWORD = 'MatKhauVanHanh2026';
const ADMIN_PASSWORD = 'QuanTri2026';
const operatorLogin = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;

let runtime: TenancyRuntime;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

// Gỡ trường gamma của lần chạy trước (lần thử lại ở CI) để bước setup tạo lại được
async function removeGamma(): Promise<void> {
  const school = await runtime.platform.selectFrom('schools').select('id').where('code', '=', CODE).executeTakeFirst();
  if (school) {
    const environment = lifecycleEnvironmentOf(runtime, lifecycleSettingsFrom(process.env));
    await dropSchool({
      platform: runtime.platform,
      masterKey: environment.masterKey,
      layout: environment.layout,
      schoolId: school.id,
    });
  }
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  await removeGamma();
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Người vận hành giả',
    password: PASSWORD,
  });
});

test.afterAll(async () => {
  if (runtime) {
    await removeGamma();
    await runtime.close();
  }
});

async function loginOptionsStatus(): Promise<number> {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost(CODE) } });
  try {
    return (await context.get(`${IDENTITY}/api/v1/auth/login-options`)).status();
  } finally {
    await context.dispose();
  }
}

test('Khởi tạo trường ở cổng nền tảng, kích hoạt quản trị viên, tạm dừng và mở lại', async ({ browser }) => {
  test.setTimeout(180_000);
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Trường' }).click();
  await expect(consolePage.getByRole('row', { name: /alpha/ })).toBeVisible();

  // Bước setup
  await consolePage.getByRole('button', { name: 'Khởi tạo trường mới' }).click();
  const wizard = consolePage.getByRole('form', { name: 'Khởi tạo trường' });
  await wizard.getByLabel('Mã trường').fill(CODE);
  await wizard.getByLabel('Tên trường').fill('Trường Gamma (dữ liệu giả)');
  await wizard.getByLabel('Tiểu học').check();
  await wizard.getByRole('button', { name: 'Tiếp' }).click();
  await expect(wizard.getByText(`${CODE}.e2e.localhost`)).toBeVisible();
  await wizard.getByRole('button', { name: 'Tiếp' }).click();
  await expect(wizard.getByLabel('Dữ liệu giả')).toBeChecked();
  await wizard.getByRole('button', { name: 'Tiếp' }).click();
  await wizard.getByLabel('Họ tên').fill('Quản trị Gamma giả');
  await wizard.getByLabel('Tên đăng nhập').fill('quantri');
  await wizard.getByRole('button', { name: 'Tiếp' }).click();
  await wizard.getByLabel('Người đồng ý thay mặt trường').fill('Hiệu trưởng giả');
  // Chưa đồng ý điều khoản thì máy chủ từ chối
  await wizard.getByRole('button', { name: 'Khởi tạo trường' }).click();
  await expect(wizard.getByRole('alert')).toContainText('điều khoản');
  await wizard.getByLabel('Trường đã đồng ý điều khoản sử dụng').check();
  await wizard.getByRole('button', { name: 'Khởi tạo trường' }).click();

  const link = consolePage.getByTestId('activation-link');
  await expect(link).toBeVisible({ timeout: 90_000 });
  const token = new URL((await link.innerText()).trim()).searchParams.get('token');
  expect(token).toBeTruthy();
  await expect(consolePage.getByRole('row', { name: new RegExp(`${CODE} Trường Gamma`) })).toContainText('Dùng thử');

  // Kích hoạt quản trị viên đầu tiên ở tên miền của trường rồi đăng nhập
  const schoolContext = await browser.newContext({ baseURL: `http://${schoolHost(CODE)}:${E2E_MULTI_PORTAL_PORT}` });
  const schoolPage = await schoolContext.newPage();
  await schoolPage.goto(`/activate?token=${token}`);
  await expect(schoolPage.getByText('quantri')).toBeVisible();
  await schoolPage.getByLabel('Mật khẩu mới', { exact: true }).fill(ADMIN_PASSWORD);
  await schoolPage.getByLabel('Nhập lại mật khẩu mới').fill(ADMIN_PASSWORD);
  await schoolPage.getByRole('button', { name: 'Kích hoạt' }).click();
  await expect(schoolPage.getByText('Đã kích hoạt tài khoản')).toBeVisible();
  // Đường liên kết chỉ dùng một lần
  await schoolPage.goto(`/activate?token=${token}`);
  await expect(schoolPage.getByText(/đã dùng hoặc đã hết hạn/)).toBeVisible();
  await schoolPage.goto('/login');
  await schoolPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill('quantri');
  await schoolPage.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN_PASSWORD);
  await schoolPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(schoolPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  // Tạm dừng: trường trả 503; mở lại: phục vụ lại
  await consolePage.getByRole('button', { name: CODE, exact: true }).click();
  await expect(consolePage.getByTestId('school-status')).toHaveText('Dùng thử');
  await consolePage.getByLabel('Lý do').fill('Kiểm thử tạm dừng');
  await consolePage.getByRole('button', { name: 'Tạm dừng' }).click();
  await expect(consolePage.getByTestId('school-status')).toHaveText('Tạm dừng');
  expect(await loginOptionsStatus()).toBe(503);
  await consolePage.getByRole('button', { name: 'Mở lại' }).click();
  await expect(consolePage.getByTestId('school-status')).toHaveText('Hoạt động');
  expect(await loginOptionsStatus()).toBe(200);
  await expect(consolePage.getByText(/suspended \(Kiểm thử tạm dừng\)/)).toBeVisible();

  await schoolContext.close();
  await consoleContext.close();
});

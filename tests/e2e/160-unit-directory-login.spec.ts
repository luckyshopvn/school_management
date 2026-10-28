import { readFile } from 'node:fs/promises';
import type { Response } from '@playwright/test';
import {
  importSchoolCatalog,
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
  readCaptchaAnswerForTesting,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_PORTAL_PORT,
  E2E_ROOT_DOMAIN,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// DT-24 (YCTD-220, spec 160), kịch bản CT-24-9, CT-24-10: trang đăng nhập ở tên miền chung có ô chọn Sở → Cấp học → Trường đọc danh
// mục mẫu giả; đơn vị chưa dùng nền tảng báo rõ; đăng nhập đúng thì sang tên miền của trường alpha; tên miền của trường khóa đơn vị.
// Quản trị nền tảng vào trường alpha khi trường chưa cho phép: nhập lại mã xác thực hai lớp, lý do; cổng quản trị hiện biểu ngữ "đang
// truy cập với quyền quản trị nền tảng"; quản trị trường thấy phiên trong nhật ký. Chỉ chạy ở dự án nhiều trường. Dữ liệu giả
const OPERATOR_PASSWORD = 'MatKhauVanHanh2026';
const operatorLogin = `vh-dm-${Math.random().toString(36).slice(2, 8)}`;
const ALPHA_MOET_CODE = '98000301';

let runtime: TenancyRuntime;
let tenant: TenantContext;
let staff: TestUser;
let admin: TestUser;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

const sample = (name: string) =>
  readFile(new URL(`../../database/platform/catalog-sample/${name}`, import.meta.url), 'utf8');

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
  await importSchoolCatalog(runtime.platform, {
    unitsCsv: await sample('don_vi_mau.csv'),
    communesCsv: await sample('phuong_xa_mau.csv'),
    source: 'e2e-mau',
    actor: { type: 'cli', name: 'Kiểm thử giao diện' },
  });
  await runtime.platform
    .updateTable('schools')
    .set({ moet_code: null })
    .where('moet_code', '=', ALPHA_MOET_CODE)
    .execute();
  await runtime.platform
    .updateTable('schools')
    .set({ moet_code: ALPHA_MOET_CODE })
    .where('id', '=', tenant.schoolId)
    .execute();
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  staff = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  admin = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Quản trị nền tảng giả',
    password: OPERATOR_PASSWORD,
  });
  // Trường alpha không cho phép hỗ trợ: phiên của quản trị nền tảng đi theo chính sách nền tảng
  const system = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
  await system
    .updateTable('support_access_grants')
    .set({ revoked_at: new Date() })
    .where('revoked_at', 'is', null)
    .execute();
});

test.afterAll(async () => {
  if (runtime) {
    await runtime.platform.updateTable('schools').set({ moet_code: null }).where('id', '=', tenant.schoolId).execute();
    await runtime.close();
  }
});

async function choose(page: Page, label: string, text: string, option: string) {
  const box = page.getByRole('combobox', { name: label });
  await box.click();
  await box.fill(text);
  await page.getByRole('listbox', { name: label }).getByRole('option', { name: option }).click();
  await expect(box).toHaveValue(option);
}

test('CT-24-9: đăng nhập theo đơn vị ở tên miền chung sang đúng trường; tên miền của trường khóa đơn vị', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const rootContext = await browser.newContext({ baseURL: `http://${E2E_ROOT_DOMAIN}:${E2E_MULTI_PORTAL_PORT}` });
  const page = await rootContext.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
  await expect(page.getByTestId('login-title')).toHaveText('Hệ thống quản lý trường học');
  // Không dùng tên, biểu trưng của cơ quan nhà nước
  await expect(page.getByText(/Bộ Giáo dục|quốc gia/i)).toHaveCount(0);

  // Đơn vị chỉ có trong danh mục: báo chưa dùng nền tảng
  await choose(page, 'Sở GD&ĐT', 'mau bac', 'Sở GD&ĐT Tỉnh Mẫu Bắc');
  await choose(page, 'Cấp học', 'tieu', 'Tiểu học');
  await choose(page, 'Trường', 'binh minh', 'Trường Tiểu học Mẫu Bình Minh');
  await expect(page.getByRole('status').filter({ hasText: 'chưa sử dụng hệ thống' })).toBeVisible();

  // Đơn vị đã khởi tạo (trường alpha gắn mã Bộ mẫu): mã xác nhận của đúng trường, đăng nhập rồi sang tên miền của trường
  await choose(page, 'Sở GD&ĐT', 'nam', 'Sở GD&ĐT Thành phố Mẫu Nam');
  await choose(page, 'Cấp học', 'trung hoc co', 'Trung học cơ sở');
  const captchas: Array<Promise<{ captcha_id: string }>> = [];
  const listener = (response: Response) => {
    if (response.url().endsWith('/api/v1/auth/directory/captcha') && response.request().method() === 'POST') {
      captchas.push(response.json() as Promise<{ captcha_id: string }>);
    }
  };
  page.on('response', listener);
  await choose(page, 'Trường', 'alpha', 'Trường THCS Mẫu Alpha');
  await expect(page.getByAltText('Ảnh mã xác nhận')).toBeVisible();
  await expect.poll(() => captchas.length).toBeGreaterThan(0);
  await page.waitForLoadState('networkidle');
  page.off('response', listener);
  const last = await captchas[captchas.length - 1];
  const answer = await readCaptchaAnswerForTesting(last?.captcha_id ?? '', tenant.keyPrefix);
  expect(answer).toBeTruthy();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(staff.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(staff.password);
  await page.getByLabel('Mã xác nhận').fill(answer ?? '');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(new RegExp(`^http://${schoolHost('alpha').replaceAll('.', '\\.')}:${E2E_MULTI_PORTAL_PORT}/`));
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  expect(page.url()).not.toContain('code=');
  await rootContext.close();

  // Tên miền của trường: không có ô chọn đơn vị, hiện đơn vị đã khóa
  const schoolContext = await browser.newContext({
    baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}`,
  });
  const schoolPage = await schoolContext.newPage();
  await schoolPage.goto('/');
  await expect(schoolPage.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(schoolPage.getByTestId('login-school')).toContainText('Sở GD&ĐT Thành phố Mẫu Nam');
  await expect(schoolPage.getByTestId('login-school')).toContainText(`Mã Bộ: ${ALPHA_MOET_CODE}`);
  await expect(schoolPage.getByRole('combobox', { name: 'Sở GD&ĐT' })).toHaveCount(0);
  await schoolContext.close();
});

test('CT-24-10: quản trị nền tảng vào trường chưa cho phép: mã xác thực hai lớp, lý do, biểu ngữ, nhật ký của trường', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const schoolBase = `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}`;
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  const menu = consolePage.getByRole('navigation', { name: 'Menu' });
  await menu.getByRole('button', { name: 'Danh mục đơn vị' }).click();
  await expect(consolePage.getByRole('heading', { name: 'Danh mục đơn vị' })).toBeVisible();
  await expect(consolePage.getByTestId('catalog-units')).not.toHaveText('0');
  await menu.getByRole('button', { name: 'Trường' }).click();
  await consolePage.getByRole('button', { name: tenant.code, exact: true }).click();
  await expect(consolePage.getByTestId('school-moet-code')).toContainText(ALPHA_MOET_CODE);
  const support = consolePage.getByRole('region', { name: 'Phiên hỗ trợ' });
  await expect(support).toContainText('Trường chưa cho phép hỗ trợ');
  const access = support.getByRole('form', { name: 'Truy cập với quyền quản trị nền tảng' });
  await access.getByLabel('Mục đích truy cập').fill('Xử lý sự cố đồng bộ (e2e)');
  await access.getByLabel('Số giờ').fill('1');
  await access
    .getByLabel('Mã xác thực hai lớp')
    .fill(await operatorOtp(runtime.platform, operator.id, operator.secret));
  await access.getByRole('button', { name: 'Truy cập với quyền quản trị nền tảng' }).click();
  const link = support.getByTestId('support-handoff');
  await expect(link).toBeVisible();
  const handoff = new URL((await link.textContent()) ?? '', schoolBase);
  await expect(support.getByRole('table', { name: 'Lịch sử phiên hỗ trợ' })).toContainText('quyền quản trị nền tảng');
  await consoleContext.close();

  const operatorContext = await browser.newContext({ baseURL: schoolBase });
  const operatorPage = await operatorContext.newPage();
  await operatorPage.goto(`${handoff.pathname}${handoff.search}`);
  await expect(operatorPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(operatorPage.getByRole('status', { name: 'Phiên hỗ trợ' })).toContainText(
    'Đang truy cập với quyền quản trị nền tảng',
  );

  // Quản trị của trường thấy phiên và lý do ở trang Cho phép hỗ trợ
  const adminContext = await browser.newContext({ baseURL: schoolBase });
  const adminPage = await adminContext.newPage();
  await adminPage.goto('/');
  await adminPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(admin.username);
  await adminPage.getByLabel('Mật khẩu', { exact: true }).fill(admin.password);
  await adminPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(adminPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(adminPage.getByRole('status', { name: 'Phiên hỗ trợ' })).toContainText('quyền quản trị nền tảng');
  await adminPage.goto('/support-access');
  const entry = adminPage.locator('summary').filter({ hasText: 'Xử lý sự cố đồng bộ (e2e)' });
  await expect(entry).toContainText('quyền quản trị nền tảng, không cần trường cho phép');
  await adminContext.close();
  await operatorContext.close();
});

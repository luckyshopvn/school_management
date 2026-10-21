import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Quản trị và trình diễn (DT-18 phần 18h, YCTD-145): Hiệu trưởng đăng nhập thay một tài khoản ở 1.4 Danh sách người dùng,
// thấy thanh "Đang đăng nhập thay" ở mọi trang, thoát về nhật ký 4.1; tạo gói ZIP toàn bộ dữ liệu ở 4.2, chờ tác vụ nền
// xong rồi tải về; khi cơ sở dữ liệu có dấu bản trình diễn thì trang đăng nhập có trang chọn vai và mọi trang có dải "Bản
// trình diễn". Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);

test.afterAll(async () => {
  await system.deleteFrom('demo_environment').execute();
  await identity.destroy();
  await system.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

test('Đăng nhập thay có thanh báo và nút thoát, nhật ký đăng nhập thay; gói ZIP toàn bộ dữ liệu tạo nền rồi tải về', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const target = await createTestUser(identity, { roles: [{ roleCode: 'VT-19', orgUnitId: null }] });
  const targetName = `Người được hỗ trợ ${suffix}`;
  await identity.updateTable('users').set({ full_name: targetName }).where('id', '=', target.id).execute();

  const page = await signIn(browser, principal);
  await openMenu(page, '/accounts');
  const grid = page.getByRole('region', { name: 'Danh sách người dùng' });
  await grid.getByLabel('Tìm theo tên, số điện thoại, tên đăng nhập').fill(targetName);
  await grid.getByRole('cell', { name: targetName }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Đăng nhập thay' }).click();
  const dialog = page.getByRole('dialog', { name: `Đăng nhập thay ${targetName}` });
  await expect(dialog.getByRole('button', { name: 'Đăng nhập thay' })).toBeDisabled();
  await dialog.getByLabel('Lý do đăng nhập thay').fill('Hỗ trợ xem báo cáo tổng hợp');
  await dialog.getByRole('button', { name: 'Đăng nhập thay' }).click();

  const banner = page.getByRole('status', { name: 'Đang đăng nhập thay' });
  await expect(banner).toContainText(`Đang đăng nhập thay tài khoản ${targetName}`);
  await expect(page.getByRole('heading', { name: `Xin chào, ${targetName}` })).toBeVisible();
  // Thanh báo ở mọi trang
  await page.goto('/my-profile');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Thoát đăng nhập thay' }).click();
  await expect(page.getByRole('heading', { name: '4.1. Đăng nhập thay' })).toBeVisible();
  await expect(banner).toHaveCount(0);
  const log = page.getByRole('region', { name: 'Nhật ký đăng nhập thay' });
  await log.getByLabel('Tìm theo người, tài khoản, lý do').fill(targetName);
  const row = log.getByRole('row').filter({ hasText: targetName });
  await expect(row).toContainText('Hỗ trợ xem báo cáo tổng hợp');
  await expect(row).toContainText('Đã thoát');
  await row.getByRole('button', { name: 'Xem thao tác' }).click();
  await expect(page.getByRole('heading', { name: `Thao tác của` })).toContainText(targetName);

  // 4.2 Xuất toàn bộ dữ liệu
  await openMenu(page, '/school-data-export');
  await expect(page.getByRole('heading', { name: '4.2. Xuất toàn bộ dữ liệu' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo gói dữ liệu' }).click();
  await expect(page.getByText(/Gói dữ liệu đã tạo xong, tải về trước/)).toBeVisible({ timeout: 90_000 });
  const exports = page.getByRole('region', { name: 'Gói dữ liệu đã tạo' });
  const downloadPromise = page.waitForEvent('download');
  await exports.getByRole('button', { name: 'Tải về' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^du-lieu-truong-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByText('Đã tải gói dữ liệu; lần tải đã được ghi nhật ký.')).toBeVisible();
});

test('Bản trình diễn: trang chọn vai ở trang đăng nhập và dải "Bản trình diễn" khi cơ sở dữ liệu có dấu bản trình diễn', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const demoUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await system.deleteFrom('demo_environment').execute();
  await system
    .insertInto('demo_environment')
    .values({
      seed_version: 'e2e',
      seeded_at: new Date(),
      reset_interval_hours: 24,
      next_reset_at: new Date(Date.now() + 24 * 60 * 60_000),
      accounts: JSON.stringify([
        {
          login: demoUser.username,
          full_name: 'Hiệu trưởng trình diễn',
          role_code: 'VT-02',
          role_name: 'Hiệu trưởng',
          app: 'portal',
        },
      ]),
    })
    .execute();
  // Mật khẩu chung của bản trình diễn: tài khoản thử dùng mật khẩu kiểm thử nên chỉ kiểm tra trang chọn vai hiện đúng
  const page = await (await browser.newContext()).newPage();
  // Máy chủ nhớ trạng thái bản trình diễn 30 giây
  await expect(async () => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Bản trình diễn: chọn vai' })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  const picker = page.getByRole('region', { name: 'Bản trình diễn: chọn vai' });
  await expect(picker).toContainText('Mật khẩu chung: Demo@2026');
  await expect(picker.getByRole('button', { name: 'Hiệu trưởng: Hiệu trưởng trình diễn' })).toBeVisible();

  const signed = await signIn(browser, demoUser);
  await expect(signed.getByRole('note').filter({ hasText: 'Bản trình diễn: dữ liệu giả' })).toBeVisible();
  await openMenu(signed, '/demo-environment');
  await expect(signed.getByRole('heading', { name: '4.3. Bản trình diễn' })).toBeVisible();
  await expect(signed.getByRole('region', { name: 'Tài khoản trình diễn' })).toContainText(demoUser.username);

  await system.deleteFrom('demo_environment').execute();
  // Chờ máy chủ hết nhớ dấu bản trình diễn để các kịch bản sau không thấy dải trình diễn
  await expect(async () => {
    const response = await signed.request.get('/api/v1/public/demo');
    expect((await response.json()).enabled).toBe(false);
  }).toPass({ timeout: 60_000 });
});

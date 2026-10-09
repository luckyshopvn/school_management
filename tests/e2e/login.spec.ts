import { expect, test } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// MH-47 Đăng nhập, MH-48 Đổi mật khẩu trên cổng quản trị (YCTD-36)
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function fillLogin(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(loginIdentifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('Đăng nhập đúng thì vào trang chủ thấy tên và vai trò; tải lại trang vẫn giữ phiên; đăng xuất về màn hình đăng nhập', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await fillLogin(page, user.username, user.password);

  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByTestId('role-list')).toContainText('Hiệu trưởng');
  await expect(page.getByTestId('role-list')).toContainText('Toàn trường');

  await page.reload();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('Sai mật khẩu thì hiện thông báo của máy chủ, không vào được trang chủ', async ({ page }) => {
  const user = await createTestUser(database);
  await fillLogin(page, user.phone, 'SaiMatKhau1');
  await expect(page.getByRole('alert')).toContainText('mật khẩu không đúng');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('Tài khoản bắt buộc đổi mật khẩu được chuyển tới MH-48; đổi xong vào trang chủ', async ({ page }) => {
  const user = await createTestUser(database, {
    roles: [{ roleCode: 'VT-06', orgUnitId: null }],
    mustChangePassword: true,
  });
  await fillLogin(page, user.username, user.password);

  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();

  await page.getByLabel('Mật khẩu hiện tại').fill(user.password);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('ngan1');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('ngan1');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeVisible();

  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauMoi2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatKhauMoi2026');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
});

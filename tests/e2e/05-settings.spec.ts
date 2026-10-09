import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// Cấu hình theo đơn vị (P01-08) và MH-31 Nhật ký thao tác (P01-09). Chạy sau 03-org-units.spec.ts.
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function loginAsPrincipal(page: Page) {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('Hiệu trưởng đặt ngày chốt học phí của Phân hiệu A; nhật ký thao tác ghi lại thay đổi', async ({ page }) => {
  await loginAsPrincipal(page);
  await page.getByRole('link', { name: 'Cấu hình' }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });

  const row = page.getByRole('row').filter({ hasText: 'Ngày chốt học phí' });
  await expect(row).toContainText('Mùng 1 tháng sau');
  await expect(page.getByRole('row').filter({ hasText: 'Ngày chốt công' })).toHaveCount(0);
  await expect(row).toContainText('Mặc định');
  await expect(page.getByRole('row').filter({ hasText: 'Ngày đến hạn thanh toán' })).toContainText('Chưa cấu hình');

  await page.getByLabel('Ngày chốt học phí').fill('31');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByText('Ngày chốt là')).toBeVisible();

  await page.getByLabel('Ngày chốt học phí').fill('25');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình' })).toBeVisible();
  await expect(row).toContainText('Riêng của đơn vị');

  await expect(page.getByLabel('Số ngày không đăng nhập thì tự khóa tài khoản')).toHaveValue(/\d+/);

  await page.getByRole('link', { name: 'Nhật ký thao tác' }).click();
  await page.getByLabel('Đối tượng').selectOption({ label: 'Cấu hình' });
  const entry = page.getByRole('row').filter({ hasText: 'tuition_closing_day' }).first();
  await expect(entry).toContainText('Sửa');
  await expect(entry).toContainText('25');
  await expect(page.getByRole('tab', { name: 'Tài khoản và quyền' })).toBeVisible();
});

test('Giáo viên không thấy mục Cấu hình và Nhật ký thao tác', async ({ page }) => {
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cấu hình' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Nhật ký thao tác' })).toHaveCount(0);
});

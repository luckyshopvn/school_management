import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// MH-32 Cây đơn vị hai cấp (P01-01, QĐ-23). Chạy sau academic-years.spec.ts, khi năm học 2026–2027 đang dùng.
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

test('Hiệu trưởng tạo Trường chính, Phân hiệu, Điểm trường; lọc danh sách phẳng; ngừng sử dụng một Điểm trường', async ({
  page,
}) => {
  await loginAsPrincipal(page);
  await page.getByRole('link', { name: 'Cây đơn vị' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo Trường chính' })).toBeVisible();

  await page.getByLabel('Mã đơn vị').fill('TC');
  await page.getByLabel('Tên đơn vị').fill('Trường Mầm non Hoa Mai');
  await page.getByRole('button', { name: 'Tạo Trường chính' }).click();
  await expect(page.getByRole('heading', { name: 'Thêm Phân hiệu hoặc Điểm trường' })).toBeVisible();

  for (const [type, code, name] of [
    ['Phân hiệu', 'PH-A', 'Phân hiệu A'],
    ['Điểm trường', 'DT-A1', 'Điểm trường A1'],
    ['Điểm trường', 'DT-A2', 'Điểm trường A2'],
  ] as const) {
    await page.getByLabel('Loại đơn vị').selectOption({ label: type });
    await page.getByLabel('Mã đơn vị').fill(code);
    await page.getByLabel('Tên đơn vị').fill(name);
    await page.getByRole('button', { name: 'Thêm đơn vị' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Đã tạo ${type} ${name}` })).toBeVisible();
  }

  const list = page.getByRole('region', { name: 'Danh sách đơn vị' });
  await expect(list.getByText('Điểm trường A2', { exact: true })).toBeVisible();

  await page.getByLabel('Mã đơn vị').fill('PH-A');
  await page.getByLabel('Tên đơn vị').fill('Trùng mã');
  await page.getByRole('button', { name: 'Thêm đơn vị' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã đơn vị đã tồn tại');

  await page.getByRole('button', { name: 'Danh sách phẳng' }).click();
  await page.getByLabel('Lọc theo loại').selectOption({ label: 'Điểm trường' });
  await expect(list.getByText('Điểm trường A1', { exact: true })).toBeVisible();
  await expect(list.getByText('Phân hiệu A', { exact: true })).toHaveCount(0);

  const row = list.getByRole('listitem').filter({ hasText: 'Điểm trường A2' });
  await row.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await expect(row.getByRole('button', { name: 'Dùng lại' })).toBeVisible();
  await expect(row.getByText('Ngừng sử dụng', { exact: true })).toBeVisible();
});

test('Giáo viên xem cây đơn vị, không có biểu mẫu tạo và nút sửa', async ({ page }) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Cây đơn vị' }).click();
  await expect(page.getByText('Trường Mầm non Hoa Mai')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa' })).toHaveCount(0);
  await expect(page.getByLabel('Mã đơn vị')).toHaveCount(0);
});

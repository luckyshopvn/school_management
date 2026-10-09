import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// MH-45 Lịch năm học và MH-43 Mở năm học mới (P01-02, BR-91, BR-93)
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function loginAs(page: Page, roleCode: string, orgUnitId: string | null) {
  const user = await createTestUser(database, { roles: [{ roleCode, orgUnitId }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('Hiệu trưởng tạo năm học, lưu lịch, đánh dấu tuần nghỉ Tết và mở năm học', async ({ page }) => {
  await loginAs(page, 'VT-02', null);
  await page.getByRole('link', { name: 'Năm học' }).click();
  await expect(page.getByRole('heading', { name: 'Năm học', exact: true })).toBeVisible();

  await page.getByLabel('Tên năm học mới').fill('2026–2027');
  await page.getByRole('button', { name: 'Tạo năm học' }).click();
  await expect(page.getByRole('heading', { name: 'Năm học 2026–2027' })).toBeVisible();

  await page.getByRole('group', { name: 'Học kỳ 1' }).getByLabel('Từ ngày').fill('2026-09-05');
  await page.getByRole('group', { name: 'Học kỳ 1' }).getByLabel('Đến ngày').fill('2027-01-20');
  await page.getByRole('group', { name: 'Học kỳ 2' }).getByLabel('Từ ngày').fill('2027-01-18');
  await page.getByRole('group', { name: 'Học kỳ 2' }).getByLabel('Đến ngày').fill('2027-05-25');
  await page.getByRole('button', { name: 'Lưu lịch năm học' }).click();
  await expect(page.getByText('Học kỳ 2 phải bắt đầu sau khi học kỳ 1 kết thúc')).toBeVisible();

  await page.getByRole('group', { name: 'Học kỳ 1' }).getByLabel('Đến ngày').fill('2027-01-15');
  await page.getByLabel('Có kỳ hè').check();
  await page.getByRole('group', { name: 'Kỳ hè' }).getByLabel('Từ ngày').fill('2027-06-01');
  await page.getByRole('group', { name: 'Kỳ hè' }).getByLabel('Đến ngày').fill('2027-07-31');
  await page.getByRole('button', { name: 'Lưu lịch năm học' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu lịch năm học' })).toBeVisible();

  const tetRow = page.getByRole('row').filter({ hasText: '08/02/2027' });
  await expect(tetRow).toBeVisible();
  await tetRow.getByRole('checkbox').check();
  await tetRow.getByRole('textbox').fill('Nghỉ Tết');
  await page.getByRole('button', { name: 'Lưu tuần nghỉ' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu tuần nghỉ' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: '08/02/2027' }).getByRole('checkbox')).toBeChecked();

  await page.getByRole('button', { name: 'Mở năm học' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('không hoàn tác được');
  await dialog.getByRole('button', { name: 'Mở năm học' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã mở năm học 2026–2027' })).toBeVisible();
  await expect(page.getByLabel('Năm học 2026–2027').getByText('Đang dùng', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở năm học' })).toHaveCount(0);
});

test('Giáo viên chỉ xem lịch năm học, không có nút tạo, lưu, mở', async ({ page }) => {
  await loginAs(page, 'VT-07', '00000000-0000-0000-0000-0000000000a1');
  await page.getByRole('link', { name: 'Năm học' }).click();
  await expect(page.getByRole('heading', { name: 'Năm học 2026–2027' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Học kỳ 1' }).getByLabel('Từ ngày')).toHaveValue('2026-09-05');
  await expect(page.getByRole('group', { name: 'Học kỳ 1' }).getByLabel('Từ ngày')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu lịch năm học' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tạo năm học' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở năm học' })).toHaveCount(0);
});

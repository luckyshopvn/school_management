import { expect, test } from '@playwright/test';
import {
  createDatabase,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';

// Truy cập nhanh và năm học ở thanh đầu trang (DT-14 phần 14b, YCTD-102; CT-14b-9, CT-14b-10): thanh đầu trang hiện năm
// học đang dùng; Hiệu trưởng ghim hai trang vào Truy cập nhanh, tải lại vẫn còn, bỏ một trang
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);

test.afterAll(async () => {
  await system.destroy();
  await identity.destroy();
});

test('Thanh đầu trang hiện năm học đang dùng; ghim hai trang vào Truy cập nhanh, tải lại vẫn còn, bỏ một trang', async ({
  page,
}) => {
  const year = await system.selectFrom('academic_years').select('name').where('status', '=', 'open').executeTakeFirst();
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  // Năm học và học kỳ ở thanh đầu trang; danh sách năm học hiện năm đang dùng (năm học do 02-academic-years mở; chạy
  // riêng tệp này thì chưa có năm học)
  const yearContext = page.getByTestId('academic-year-context');
  if (year) {
    await expect(yearContext).toContainText(year.name);
    await yearContext.click();
    const yearDialog = page.getByRole('dialog', { name: 'Năm học và học kỳ' });
    await expect(yearDialog.getByRole('button', { name: `Năm học ${year.name}` })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(yearDialog).toContainText('Học kỳ I');
    await page.keyboard.press('Escape');
    await expect(yearDialog).toHaveCount(0);
  } else {
    await expect(yearContext).toHaveText(/Chưa có năm học đang dùng/);
  }

  // Ghim hai trang
  const quickAccess = page.getByRole('region', { name: 'Truy cập nhanh' });
  await expect(quickAccess.getByText('Chưa có lối tắt.', { exact: false })).toBeVisible();
  await quickAccess.getByRole('button', { name: 'Thêm truy cập nhanh' }).click();
  const picker = quickAccess.getByRole('dialog', { name: 'Chọn trang thêm vào truy cập nhanh' });
  await picker.getByRole('button', { name: 'Hồ sơ trẻ', exact: true }).click();
  const tiles = quickAccess.getByRole('list', { name: 'Lối tắt đã ghim' });
  await expect(tiles.getByRole('link', { name: 'Hồ sơ trẻ' })).toBeVisible();
  await picker.getByRole('button', { name: 'Công nợ', exact: true }).click();
  await expect(tiles.getByRole('link', { name: 'Công nợ' })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Hồ sơ trẻ Đã ghim' })).toBeDisabled();
  await picker.getByRole('button', { name: 'Đóng' }).click();

  // Đổi thứ tự: Công nợ lên trước
  await tiles.getByRole('button', { name: 'Đưa Công nợ lên trước' }).click();
  await expect(tiles.getByRole('link')).toHaveText(['Công nợ', 'Hồ sơ trẻ']);

  // Tải lại vẫn còn đúng thứ tự (lưu ở máy chủ)
  await page.reload();
  await expect(tiles.getByRole('link')).toHaveText(['Công nợ', 'Hồ sơ trẻ']);

  // Bỏ một trang; tải lại chỉ còn một
  await tiles.getByRole('button', { name: 'Bỏ Công nợ khỏi truy cập nhanh' }).click();
  await expect(tiles.getByRole('link')).toHaveText(['Hồ sơ trẻ']);
  await page.reload();
  await expect(tiles.getByRole('link')).toHaveText(['Hồ sơ trẻ']);

  // Bấm lối tắt mở trang
  await tiles.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await expect(page).toHaveURL(/\/children$/);
});

import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Nhóm "Hay dùng" trên trang chủ và ô tìm chung học sinh, cán bộ ở thanh đầu trang cổng quản trị (YCTD-337, GD-180).
// Học sinh Nguyễn Gia Bảo có từ kịch bản 09-children
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

test('CT-337-7: trang vừa mở vào Hay dùng ở trang chủ, bỏ được; ô tìm chung tìm được học sinh theo tên', async ({
  page,
}) => {
  const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  // Tài khoản mới chưa có trang nào trong Hay dùng
  await expect(page.getByRole('region', { name: 'Hay dùng' })).toHaveCount(0);

  await openMenu(page, '/attendance');
  await openMenu(page, '/children');
  await page.getByRole('link', { name: 'Trang chủ' }).first().click();
  const recent = page.getByRole('region', { name: 'Hay dùng' });
  await expect(recent.getByRole('link')).toHaveText(['4.1.1. Quản lý hồ sơ học sinh', '4.7. Điểm danh']);
  await recent.getByRole('button', { name: 'Bỏ 4.7. Điểm danh khỏi Hay dùng' }).click();
  await expect(recent.getByRole('link')).toHaveText(['4.1.1. Quản lý hồ sơ học sinh']);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Hay dùng' }).getByRole('link')).toHaveText([
    '4.1.1. Quản lý hồ sơ học sinh',
  ]);

  // Bấm vào ô tìm khi chưa gõ thì hiện Hay dùng; gõ tên thì có nhóm Học sinh, mở danh sách học sinh đã điền sẵn ô tìm
  const search = page.getByRole('combobox', { name: 'Tìm chức năng' });
  await search.click();
  const results = page.getByRole('listbox', { name: 'Chức năng tìm thấy' });
  await expect(results.getByRole('option', { name: /Quản lý hồ sơ học sinh/ })).toBeVisible();
  await search.fill('Gia Bảo');
  const student = results.getByRole('option', { name: /Nguyễn Gia Bảo/ });
  await expect(student).toBeVisible();
  await expect(student).toContainText('Học sinh');
  await student.click();
  await expect(page).toHaveURL(/\/children\?q=/);
  await expect(page.getByLabel('Tìm theo họ tên')).toHaveValue('Nguyễn Gia Bảo');
});

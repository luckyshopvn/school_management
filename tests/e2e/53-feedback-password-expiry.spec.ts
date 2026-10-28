import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser, TEST_PASSWORD, type TestUser } from '@school-management/identity/testing';
import { randomUUID } from 'node:crypto';
import { expectNoMenuLink, logout, openMenu, openUserMenu } from './menu.js';

// Gửi phản hồi ở chân trang, Danh sách ý kiến đã gửi, Ý kiến phản hồi và hết hạn mật khẩu (DT-15 phần 15g, YCTD-110;
// CT-15g-14 đến CT-15g-16)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const POLICY_KEYS = ['password_max_age_days', 'password_expiry_warning_days'];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const suffix = randomUUID().slice(0, 8);
const feedbackTitle = `Lỗi lưu hồ sơ ${suffix}`;

test.afterAll(async () => {
  // Trả chính sách mật khẩu về mặc định để các tệp kiểm thử khác không bị bắt đổi mật khẩu
  await identity.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
  await identity.destroy();
});

async function loginWith(page: Page, user: TestUser, password = user.password) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

// Lùi thời điểm đặt mật khẩu để giả lập mật khẩu đã dùng lâu
const setPasswordAge = (user: TestUser, days: number) =>
  identity
    .updateTable('users')
    .set({ password_changed_at: new Date(Date.now() - days * 24 * 60 * 60 * 1000) })
    .where('id', '=', user.id)
    .execute();

test.describe.serial('Ý kiến phản hồi', () => {
  let teacher: TestUser;

  test('CT-15g-14: giáo viên gửi phản hồi ở chân trang kèm ảnh, xem lại ở Danh sách ý kiến đã gửi', async ({
    page,
  }) => {
    teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    await loginWith(page, teacher);
    await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

    // YCTD-330 bỏ chân trang: Gửi phản hồi ở menu người dùng
    const userMenu = await openUserMenu(page);
    await userMenu.getByRole('menuitem', { name: 'Gửi phản hồi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gửi phản hồi' });
    await expect(dialog.getByLabel('Đường dẫn trang')).toHaveValue('/');
    // Thiếu loại, tiêu đề, nội dung thì máy chủ báo lỗi từng ô
    await dialog.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(dialog.getByText('Chọn loại ý kiến: góp ý, báo lỗi hoặc đề nghị')).toBeVisible();
    await expect(dialog.getByText('Bắt buộc nhập')).toHaveCount(2);

    await dialog.getByLabel('Loại ý kiến').selectOption({ label: 'Báo lỗi' });
    await dialog.getByLabel('Tiêu đề').fill(feedbackTitle);
    await dialog.getByLabel('Nội dung').fill('Bấm Ghi ở hồ sơ học sinh thì trang báo lỗi');
    await dialog.getByLabel('Thư điện tử').fill('giao.vien@vi-du.test');
    await dialog.getByLabel('Ảnh chụp màn hình').setInputFiles({
      name: 'man-hinh.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await dialog.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã gửi ý kiến phản hồi' })).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const menu = await openUserMenu(page);
    await menu.getByRole('menuitem', { name: 'Danh sách ý kiến đã gửi' }).click();
    await expect(page.getByRole('heading', { name: 'Danh sách ý kiến đã gửi' })).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: feedbackTitle });
    await expect(row).toContainText('Báo lỗi');
    await expect(row).toContainText('Mới');
    await row.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByText('Bấm Ghi ở hồ sơ học sinh thì trang báo lỗi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'man-hinh.png' })).toBeVisible();
    await expect(page.getByText('Chưa trả lời')).toBeVisible();

    // Giáo viên không có quyền xử lý ý kiến nên không có mục Ý kiến phản hồi
    await expectNoMenuLink(page, '/feedback');
  });

  test('CT-15g-15: Hiệu trưởng xử lý, trả lời ý kiến; người gửi thấy câu trả lời', async ({ page }) => {
    const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    await loginWith(page, principal);
    await openMenu(page, '/feedback');
    await expect(page.getByRole('heading', { name: 'Ý kiến phản hồi' })).toBeVisible();
    await page.getByLabel('Tìm theo tiêu đề, nội dung, người gửi').fill(suffix);
    const row = page.getByRole('row').filter({ hasText: feedbackTitle });
    await expect(row).toContainText('Mới');
    await row.getByRole('button', { name: 'Xử lý' }).click();
    const handle = page.getByRole('form', { name: 'Xử lý ý kiến' });
    await handle.getByLabel('Trạng thái', { exact: true }).selectOption({ label: 'Đã xử lý' });
    await handle.getByLabel('Trả lời', { exact: true }).fill('Đã sửa lỗi lưu hồ sơ, mời thầy cô thử lại');
    await handle.getByRole('button', { name: 'Ghi', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã ghi xử lý ý kiến' })).toBeVisible();
    await expect(row).toContainText('Đã xử lý');

    // Lọc theo trạng thái ở Mở rộng tìm kiếm
    await row.getByRole('button', { name: 'Ẩn' }).click();
    await page.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
    await page.getByLabel('Trạng thái', { exact: true }).selectOption({ label: 'Mới' });
    await expect(page.getByRole('row').filter({ hasText: feedbackTitle })).toHaveCount(0);
    await logout(page);

    await loginWith(page, teacher);
    await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
    const menu = await openUserMenu(page);
    await menu.getByRole('menuitem', { name: 'Danh sách ý kiến đã gửi' }).click();
    const own = page.getByRole('row').filter({ hasText: feedbackTitle });
    await expect(own).toContainText('Đã xử lý');
    await own.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByText(/Đã sửa lỗi lưu hồ sơ, mời thầy cô thử lại/)).toBeVisible();
  });
});

test('CT-15g-16: Quản trị nền tảng đặt hạn mật khẩu; mật khẩu quá hạn phải đổi khi đăng nhập, sắp hết hạn thì được báo', async ({
  page,
}) => {
  await identity.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
  const administrator = await createTestUser(identity, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
  await loginWith(page, administrator);
  await openMenu(page, '/accounts');
  const policy = page.getByRole('region', { name: 'Chính sách mật khẩu' });
  await expect(policy.getByLabel('Số ngày hết hạn mật khẩu')).toHaveValue('0');
  await expect(policy.getByLabel('Số ngày báo trước khi hết hạn')).toHaveValue('7');
  await policy.getByLabel('Số ngày hết hạn mật khẩu').fill('5000');
  await policy.getByRole('button', { name: 'Ghi' }).click();
  await expect(policy.getByText('Số ngày là số nguyên từ 0 đến 3650')).toBeVisible();
  await policy.getByLabel('Số ngày hết hạn mật khẩu').fill('90');
  await policy.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu chính sách mật khẩu' })).toBeVisible();
  await logout(page);

  // Mật khẩu đã dùng 100 ngày: đăng nhập phải đổi, mật khẩu mới phải khác mật khẩu cũ
  const expired = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  await setPasswordAge(expired, 100);
  await loginWith(page, expired);
  await page.waitForURL('**/change-password');
  await expect(page.getByText('Mật khẩu đã hết hạn, vui lòng đổi mật khẩu')).toBeVisible();
  await page.getByLabel('Mật khẩu hiện tại').fill(TEST_PASSWORD);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Nhập lại mật khẩu mới').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByText('Mật khẩu mới phải khác mật khẩu hiện tại')).toBeVisible();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauMoi2027');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('MatKhauMoi2027');
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByText(/Mật khẩu sẽ hết hạn sau/)).toHaveCount(0);
  await logout(page);

  // Mật khẩu đã dùng 85 ngày: vào được, có báo còn 5 ngày
  const warned = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
  await setPasswordAge(warned, 85);
  await loginWith(page, warned);
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(page.getByText('Mật khẩu sẽ hết hạn sau 5 ngày.')).toBeVisible();
  await page.getByRole('link', { name: 'Đổi mật khẩu' }).click();
  await page.waitForURL('**/change-password');
});

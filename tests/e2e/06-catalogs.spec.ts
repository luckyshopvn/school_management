import { expect, test, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// MH-33, MH-34, MH-49, MH-50 các danh mục của P01 (YCTD-42). Chạy sau 03-org-units.spec.ts, khi đã có cây đơn vị.
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

async function loginWithRole(page: Page, roleCode: string) {
  const user = await createTestUser(database, { roles: [{ roleCode, orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('Hiệu trưởng tạo phòng ban có phòng ban cha và chức danh của Phân hiệu A', async ({ page }) => {
  await loginWithRole(page, 'VT-02');
  await page.getByRole('link', { name: 'Phòng ban và chức danh' }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });

  const departments = page.getByRole('region', { name: 'Phòng ban' });
  await departments.getByLabel('Tên phòng ban').fill('Khối chuyên môn');
  await departments.getByRole('button', { name: 'Thêm' }).click();
  await expect(departments.getByRole('row').filter({ hasText: 'Khối chuyên môn' })).toBeVisible();

  await departments.getByLabel('Tên phòng ban').fill('Tổ chuyên môn');
  await departments.getByLabel('Phòng ban cha').selectOption({ label: 'Khối chuyên môn' });
  await departments.getByRole('button', { name: 'Thêm' }).click();
  const child = departments.getByRole('row').filter({ hasText: 'Tổ chuyên môn' });
  await expect(child).toContainText('Khối chuyên môn');

  // Không ngừng được phòng ban còn phòng ban con đang hoạt động (BR-75)
  const parent = departments.getByRole('row').filter({ hasText: /^Khối chuyên môn/ });
  await parent.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await expect(departments.getByText('Hãy ngừng sử dụng các phòng ban con trước')).toBeVisible();

  await page.getByRole('tab', { name: 'Chức danh' }).click();
  const jobTitles = page.getByRole('region', { name: 'Chức danh' });
  await jobTitles.getByLabel('Tên chức danh').fill('Giáo viên mầm non hạng III');
  await jobTitles.getByLabel('Cấp bậc').fill('Hạng III');
  await jobTitles.getByRole('button', { name: 'Thêm' }).click();
  await expect(jobTitles.getByRole('row').filter({ hasText: 'Giáo viên mầm non hạng III' })).toContainText('Hạng III');
});

test('Hiệu trưởng thêm mục danh mục dùng chung, đặt hạn mức phiếu chi, tạo phòng học và bậc học', async ({ page }) => {
  await loginWithRole(page, 'VT-02');

  await page.getByRole('link', { name: 'Danh mục dùng chung' }).click();
  await page.getByLabel('Loại danh mục').selectOption({ label: 'Quan hệ với trẻ' });
  const relationships = page.getByRole('region', { name: 'Quan hệ với trẻ' });
  await relationships.getByLabel('Mã', { exact: true }).fill('ME');
  await relationships.getByLabel('Tên', { exact: true }).fill('Mẹ');
  await relationships.getByRole('button', { name: 'Thêm' }).click();
  const mother = relationships.getByRole('row').filter({ hasText: 'Mẹ' });
  await expect(mother).toContainText('Đang dùng');
  await mother.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await expect(mother).toContainText('Ngừng sử dụng');

  await page.getByRole('link', { name: 'Hạn mức phê duyệt' }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });
  const payment = page.getByRole('row').filter({ hasText: /^Phiếu chi/ });
  await expect(payment).toContainText('Chưa cấu hình, Hiệu trưởng phê duyệt');
  await payment.getByLabel('Hạn mức Phiếu chi').fill('10000000');
  await payment.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByRole('row').filter({ hasText: /^Phiếu chi/ })).toContainText('10.000.000 đồng');

  await page.getByRole('link', { name: 'Phòng học và bậc học' }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Điểm trường A1' });
  const rooms = page.getByRole('region', { name: 'Phòng học' });
  await rooms.getByLabel('Mã phòng').fill('P101');
  await rooms.getByLabel('Tên phòng').fill('Phòng 101');
  await rooms.getByLabel('Sức chứa').fill('30');
  await rooms.getByRole('button', { name: 'Thêm' }).click();
  await expect(rooms.getByRole('row').filter({ hasText: 'P101' })).toContainText('30');

  await page.getByRole('tab', { name: 'Bậc học' }).click();
  const gradeLevels = page.getByRole('region', { name: 'Bậc học' });
  await gradeLevels.getByLabel('Mã bậc học').fill('MAM');
  await gradeLevels.getByLabel('Tên bậc học').fill('Mầm');
  await gradeLevels.getByLabel('Từ tháng tuổi').fill('48');
  await gradeLevels.getByLabel('Đến tháng tuổi').fill('59');
  await gradeLevels.getByRole('button', { name: 'Thêm' }).click();
  await expect(gradeLevels.getByRole('row').filter({ hasText: 'MAM' })).toContainText('48 đến 59 tháng');
});

test('Giáo viên không thấy các mục danh mục', async ({ page }) => {
  await loginWithRole(page, 'VT-07');
  for (const name of ['Phòng ban và chức danh', 'Danh mục dùng chung', 'Hạn mức phê duyệt', 'Phòng học và bậc học']) {
    await expect(page.getByRole('link', { name })).toHaveCount(0);
  }
});

import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { expectNoMenuLink, openMenu } from './menu.js';

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
  await openMenu(page, '/departments');
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });

  // Danh sách trên lưới dữ liệu chung, Thêm mới mở biểu mẫu với nút Ghi (DT-16 phần 16b)
  const departments = page.getByRole('region', { name: 'Phòng ban', exact: true });
  const addDepartment = page.getByRole('form', { name: 'Thêm mới phòng ban' });
  await departments.getByRole('button', { name: 'Thêm mới' }).click();
  await addDepartment.getByLabel('Tên phòng ban').fill('Khối chuyên môn');
  await addDepartment.getByRole('button', { name: 'Ghi' }).click();
  await expect(departments.getByRole('row').filter({ hasText: 'Khối chuyên môn' })).toBeVisible();

  await departments.getByRole('button', { name: 'Thêm mới' }).click();
  await addDepartment.getByLabel('Tên phòng ban').fill('Tổ chuyên môn');
  await addDepartment.getByLabel('Phòng ban cha').selectOption({ label: 'Khối chuyên môn' });
  await addDepartment.getByRole('button', { name: 'Ghi' }).click();
  const child = departments.getByRole('row').filter({ hasText: 'Tổ chuyên môn' });
  await expect(child).toContainText('Khối chuyên môn');

  // Không ngừng được phòng ban còn phòng ban con đang hoạt động (BR-75)
  const parent = departments.getByRole('row').filter({ hasText: /^Khối chuyên môn/ });
  await parent.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await expect(departments.getByText('Hãy ngừng sử dụng các phòng ban con trước')).toBeVisible();

  await page.getByRole('tab', { name: 'Chức danh' }).click();
  const jobTitles = page.getByRole('region', { name: 'Chức danh', exact: true });
  await jobTitles.getByRole('button', { name: 'Thêm mới' }).click();
  const addJobTitle = page.getByRole('form', { name: 'Thêm mới chức danh' });
  await addJobTitle.getByLabel('Tên chức danh').fill('Giáo viên mầm non hạng III');
  await addJobTitle.getByLabel('Cấp bậc').fill('Hạng III');
  await addJobTitle.getByRole('button', { name: 'Ghi' }).click();
  await expect(jobTitles.getByRole('row').filter({ hasText: 'Giáo viên mầm non hạng III' })).toContainText('Hạng III');
});

test('Hiệu trưởng thêm mục danh mục dùng chung, đặt hạn mức phiếu chi, tạo phòng học và bậc học', async ({ page }) => {
  await loginWithRole(page, 'VT-02');

  await openMenu(page, '/catalogs');
  await page.getByLabel('Loại danh mục').selectOption({ label: 'Quan hệ với trẻ' });
  const relationships = page.getByRole('region', { name: 'Quan hệ với trẻ' });
  await relationships.getByRole('button', { name: 'Thêm mới' }).click();
  const addRelationship = page.getByRole('form', { name: 'Thêm mới quan hệ với trẻ' });
  await addRelationship.getByLabel('Mã', { exact: true }).fill('ME');
  await addRelationship.getByLabel('Tên', { exact: true }).fill('Mẹ');
  await addRelationship.getByRole('button', { name: 'Ghi' }).click();
  await relationships.getByLabel('Tìm trong quan hệ với trẻ').fill('Mẹ');
  const mother = relationships.getByRole('row').filter({ hasText: 'Mẹ' });
  await expect(mother).toContainText('Đang dùng');
  await mother.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  await expect(mother).toContainText('Ngừng sử dụng');

  await openMenu(page, '/approval-thresholds');
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });
  const payment = page.getByRole('row').filter({ hasText: /^Phiếu chi/ });
  await expect(payment).toContainText('Chưa cấu hình, Hiệu trưởng phê duyệt');
  await payment.getByLabel('Hạn mức Phiếu chi').fill('10000000');
  await payment.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByRole('row').filter({ hasText: /^Phiếu chi/ })).toContainText('10.000.000 đồng');

  await openMenu(page, '/rooms');
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Điểm trường A1' });
  const rooms = page.getByRole('region', { name: 'Phòng học', exact: true });
  await rooms.getByRole('button', { name: 'Thêm mới' }).click();
  const addRoom = page.getByRole('form', { name: 'Thêm mới phòng học' });
  await addRoom.getByLabel('Mã phòng').fill('P101');
  await addRoom.getByLabel('Tên phòng').fill('Phòng 101');
  await addRoom.getByLabel('Sức chứa').fill('30');
  await addRoom.getByRole('button', { name: 'Ghi' }).click();
  await expect(rooms.getByRole('row').filter({ hasText: 'P101' })).toContainText('30');

  await page.getByRole('tab', { name: 'Bậc học' }).click();
  const gradeLevels = page.getByRole('region', { name: 'Bậc học', exact: true });
  await gradeLevels.getByRole('button', { name: 'Thêm mới' }).click();
  const addGradeLevel = page.getByRole('form', { name: 'Thêm mới bậc học' });
  await addGradeLevel.getByLabel('Mã bậc học').fill('MAM');
  await addGradeLevel.getByLabel('Tên bậc học').fill('Mầm');
  await addGradeLevel.getByLabel('Từ tháng tuổi').fill('48');
  await addGradeLevel.getByLabel('Đến tháng tuổi').fill('59');
  await addGradeLevel.getByRole('button', { name: 'Ghi' }).click();
  await expect(gradeLevels.getByRole('row').filter({ hasText: 'MAM' })).toContainText('48 đến 59 tháng');
});

test('Giáo viên không thấy các mục danh mục', async ({ page }) => {
  await loginWithRole(page, 'VT-07');
  for (const path of ['/departments', '/catalogs', '/approval-thresholds', '/rooms']) {
    await expectNoMenuLink(page, path);
  }
});

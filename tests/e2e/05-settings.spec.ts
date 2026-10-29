import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { expectNoMenuLink, openMenu } from './menu.js';

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
  await openMenu(page, '/settings');
  await page.getByLabel('Đơn vị', { exact: true }).selectOption({ label: 'Phân hiệu A' });

  // Danh sách nhóm của trang (YCTD-335): đủ bảy nhóm theo thứ tự; bấm nhóm thì cuộn tới khối của nhóm
  const groups = page.getByRole('navigation', { name: 'Nhóm cấu hình' });
  await expect(groups.getByRole('button')).toHaveText([
    'Thông tin chung',
    'Cấp học',
    'Học phí, dịch vụ',
    'Nhân sự, chấm công',
    'Y tế, bán trú, kho',
    'Nề nếp, thi đua',
    'Nhật ký, bảo mật',
  ]);
  await groups.getByRole('button', { name: 'Nhật ký, bảo mật' }).click();
  await expect(groups.getByRole('button', { name: 'Nhật ký, bảo mật' })).toHaveAttribute('aria-current', 'true');
  const securityGroup = page.getByRole('region', { name: 'Nhật ký, bảo mật', exact: true });
  await expect(securityGroup.getByRole('heading', { name: 'Nhật ký, bảo mật' })).toBeInViewport();
  await expect(securityGroup.getByRole('row').filter({ hasText: 'Ghi nhật ký truy cập dữ liệu' })).toHaveCount(1);
  await expect(securityGroup.getByRole('region', { name: 'Cấu hình tài khoản' })).toBeVisible();

  // Mục theo đơn vị nằm trong nhóm của mục; nguồn ghi gọn sau giá trị đang áp dụng, không còn cột Nguồn
  const feesGroup = page.getByRole('region', { name: 'Học phí, dịch vụ', exact: true });
  const row = feesGroup.getByRole('row').filter({ hasText: 'Ngày chốt học phí' });
  await expect(row).toContainText('Mùng 1 tháng sau · mặc định');
  await expect(page.getByRole('row').filter({ hasText: 'Ngày chốt công' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Nguồn' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Ngày đến hạn thanh toán' })).toContainText('Chưa cấu hình');
  await expect(
    page
      .getByRole('region', { name: 'Nhân sự, chấm công', exact: true })
      .getByRole('row')
      .filter({ hasText: 'Giờ vào làm' }),
  ).toHaveCount(1);

  await page.getByLabel('Ngày chốt học phí').fill('31');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByText('Ngày chốt là')).toBeVisible();

  await page.getByLabel('Ngày chốt học phí').fill('25');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình' })).toBeVisible();
  await expect(row).toContainText('25 · riêng của đơn vị');

  await expect(page.getByLabel('Số ngày không đăng nhập thì tự khóa tài khoản')).toHaveValue(/\d+/);

  await openMenu(page, '/audit-logs');
  // Nhật ký trên lưới dữ liệu chung, bộ lọc đối tượng ở Mở rộng tìm kiếm (DT-15 phần 15e)
  const logs = page.getByRole('region', { name: 'Nhật ký nghiệp vụ' });
  await logs.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await logs.getByLabel('Đối tượng').selectOption({ label: 'Cấu hình' });
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
  await expectNoMenuLink(page, '/settings');
  await expectNoMenuLink(page, '/audit-logs');
});

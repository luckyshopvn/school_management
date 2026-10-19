import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Báo cáo số liệu EMIS đủ bảy biểu theo hệ thống của Sở (DT-16 phần 16j; chỉ tiêu, mã số theo Sở từ DT-17 phần 17a): 1.1.1
// thẻ Ngân sách nhà nước theo Biểu 08.ĐN-NSNN; 1.2 Lấy dữ liệu rồi Ghi, Xuất file lỗi, "Gửi dữ liệu"; 1.3 cột theo Sở; 2.1
// theo mục của Sở; 2.2 ba biểu, Xuất Excel; 2.3 năm chỉ tiêu, chỉ tiêu 5 nhập tay, Đánh dấu đã gửi "Trường không có dữ liệu"
// rồi khóa ô nhập. Không có nút "Gửi" truyền đi. Dữ liệu là dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

async function signIn(page: Page, roleCode: string) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function downloadOf(page: Page, click: () => Promise<void>) {
  const downloading = page.waitForEvent('download');
  await click();
  return downloading;
}

test('CT-16j-8: 1.1.1 thẻ Ngân sách nhà nước; 1.2 Lấy dữ liệu, Ghi, Xuất file lỗi, Gửi dữ liệu', async ({ page }) => {
  await signIn(page, 'VT-02');
  await openMenu(page, '/emis');
  await expect(page.getByRole('heading', { name: '1.1.1 Lập báo cáo đầu năm' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Gửi lên cấp trên' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '1.1.2 Gửi báo cáo đầu năm' })).toBeVisible();

  await page.getByRole('tab', { name: '5. Ngân sách nhà nước' }).click();
  const budget = page.getByRole('region', { name: '5. Ngân sách nhà nước' });
  await expect(budget).toContainText('Thẻ chưa ghi');
  await budget.getByLabel('Dự toán 1', { exact: true }).fill('1250.5');
  await budget.getByLabel('Ước thực hiện 1', { exact: true }).fill('1300');
  await budget.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(budget).toContainText('Ghi lần cuối');
  await page.reload();
  await page.getByRole('tab', { name: '5. Ngân sách nhà nước' }).click();
  await expect(page.getByLabel('Dự toán 1', { exact: true })).toHaveValue('1250.5');

  await openMenu(page, '/emis/facilities');
  await expect(page.getByRole('heading', { name: '1.2 Báo cáo cơ sở vật chất' })).toBeVisible();
  for (const label of [
    '1. Cơ sở vật chất',
    '2. Nhà vệ sinh',
    '3. Cơ sở vật chất khác',
    '4. Thiết bị dạy học',
    '5. Thông tin khác',
  ]) {
    await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('tab', { name: '2. Nhà vệ sinh', exact: true }).click();
  const toilets = page.getByRole('region', { name: '2. Nhà vệ sinh' });
  await toilets.getByRole('button', { name: 'Lấy dữ liệu', exact: true }).click();
  await expect(toilets).toContainText('Đã điền số liệu từ dữ liệu của hệ thống');
  await expect(toilets).toContainText('Có thay đổi chưa ghi');
  await toilets.getByLabel('Tổng số VS.05').fill('2');
  await toilets.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(toilets).toContainText('Ghi lần cuối');
  await expect(toilets.getByLabel('Tổng số VS.05')).toHaveValue('2');
  await expect(toilets.getByRole('button', { name: 'Lấy dữ liệu năm trước' })).toBeVisible();

  const row = page.getByRole('region', { name: 'Gửi lên cấp trên' }).getByRole('row', {
    name: 'Biểu mẫu 1.2 Báo cáo cơ sở vật chất',
  });
  await expect(row).toContainText('Chưa hoàn thành');
  // 1.2.2 của Sở chỉ có "Gửi dữ liệu"
  await expect(row.getByRole('button', { name: 'Gửi dữ liệu' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Xuất tệp gửi' })).toHaveCount(0);
  const errors = await downloadOf(page, () => row.getByRole('button', { name: 'Xuất file lỗi' }).click());
  expect(errors.suggestedFilename()).toMatch(/^file-loi-emis-facilities-\d{8}-\d{4}\.xlsx$/);
});

test('CT-16j-9: 1.3, 2.1, 2.2, 2.4 xem và xuất Excel; 2.3 Đánh dấu đã gửi "Trường không có dữ liệu" thì khóa ô nhập', async ({
  page,
}) => {
  await signIn(page, 'VT-02');
  await openMenu(page, '/emis/health');
  await expect(page.getByRole('heading', { name: '1.3 Báo cáo sức khỏe học sinh đầu năm' })).toBeVisible();
  const health = page.getByRole('region', { name: 'Sức khỏe học sinh đầu năm' });
  await expect(health.getByRole('columnheader', { name: 'Dân tộc', exact: true })).toBeVisible();
  await expect(health).toContainText('Suy dinh dưỡng thể thấp còi');

  await openMenu(page, '/emis/end-of-year');
  await expect(page.getByRole('heading', { name: '2.1 Báo cáo EMIS cuối năm' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Báo cáo cuối năm' })).toContainText('Giáo viên nghỉ hưu trong năm');

  await openMenu(page, '/emis/staff');
  await page.getByRole('tab', { name: '2.2.3 – 2. Giáo viên' }).click();
  const standards = page.getByRole('region', { name: '2.2.3 – 2. Giáo viên' });
  await expect(standards.getByRole('columnheader', { name: 'Tốt' })).toBeVisible();
  await expect(standards).toContainText('Tiêu chí 15');
  const staffFile = await downloadOf(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
  expect(staffFile.suggestedFilename()).toMatch(/^emis-doi-ngu-\d{8}-\d{4}\.xlsx$/);

  await openMenu(page, '/emis/preschool-end-of-year');
  await expect(page.getByRole('heading', { name: '2.4 Báo cáo giáo dục mầm non cuối năm' })).toBeVisible();
  // Ở học kỳ I biểu trống như Sở; từ học kỳ II có thẻ Kết quả giáo dục
  await expect(
    page.getByText('ở học kỳ I biểu trống').or(page.getByRole('tab', { name: 'Kết quả giáo dục' })),
  ).toBeVisible();

  await openMenu(page, '/emis/foreign-language');
  const children = page.getByRole('region', { name: 'Thống kê số trường, số trẻ' });
  await expect(children).toContainText('Số trẻ mầm non được làm quen với tiếng Anh');
  await children.getByLabel('Tổng số 5', { exact: true }).fill('3');
  await children.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(children).toContainText('Ghi lần cuối');
  await expect(children.getByLabel('Tổng số 5', { exact: true })).toHaveValue('3');
  const row = page.getByRole('region', { name: 'Gửi lên cấp trên' }).getByRole('row', {
    name: 'Biểu mẫu 2.3 Đề án ngoại ngữ',
  });
  await row.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Đánh dấu đã gửi:' });
  await dialog.getByLabel('Trường không có dữ liệu').check();
  await dialog.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  await expect(row).toContainText('Đã gửi');
  await expect(row).toContainText('trường không có dữ liệu');
  await expect(page.getByText('Biểu đã đánh dấu đã gửi nên đang khóa')).toBeVisible();
  await expect(children.getByLabel('Tổng số 5', { exact: true })).toBeDisabled();
  await expect(children.getByRole('button', { name: 'Ghi', exact: true })).toBeDisabled();
});

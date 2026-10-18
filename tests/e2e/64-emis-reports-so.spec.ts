import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Báo cáo số liệu EMIS đủ bảy biểu theo hệ thống của Sở (DT-16 phần 16j): 1.1 thẻ Ngân sách nhà nước và danh sách gửi báo
// cáo (số đã gửi, số cần gửi, lần gửi cuối); 1.2 Lấy dữ liệu rồi Ghi, Xuất file lỗi; 1.3 cột theo Sở; 2.1 mục I–VI; 2.2 ba
// thẻ, Xuất Excel; 2.3 nhập số trẻ, Đánh dấu đã gửi "Trường không có dữ liệu" rồi khóa ô nhập. Nút gửi ghi đúng việc làm:
// "Xuất tệp gửi", "Đánh dấu đã gửi", không có nút "Gửi" truyền đi. Dữ liệu là dữ liệu giả
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

test('CT-16j-8: 1.1 thẻ Ngân sách nhà nước, danh sách gửi báo cáo bảy biểu; 1.2 Lấy dữ liệu, Ghi, Xuất file lỗi', async ({
  page,
}) => {
  await signIn(page, 'VT-02');
  await openMenu(page, '/emis');
  await expect(page.getByRole('heading', { name: '1.1 Báo cáo EMIS đầu năm' })).toBeVisible();
  const panel = page.getByRole('region', { name: 'Gửi lên cấp trên' });
  await expect(panel.getByLabel('Tổng hợp gửi báo cáo')).toContainText('Số cần gửi');
  await expect(panel.getByRole('row', { name: /^Biểu mẫu \d/ })).toHaveCount(7);
  await expect(panel.getByRole('row', { name: 'Biểu mẫu 2.3 Đề án ngoại ngữ' })).toContainText('Chưa gửi');
  await expect(panel.getByRole('button', { name: 'Gửi', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Ngân sách nhà nước' }).click();
  const budget = page.getByRole('region', { name: 'Ngân sách nhà nước' });
  await expect(budget).toContainText('Thẻ chưa ghi');
  await budget.getByLabel('Quyết toán năm trước 6.01').fill('1250.5');
  await budget.getByLabel('Dự toán năm nay 6.01').fill('1300');
  await budget.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(budget).toContainText('Ghi lần cuối');
  await page.reload();
  await page.getByRole('tab', { name: 'Ngân sách nhà nước' }).click();
  await expect(page.getByLabel('Quyết toán năm trước 6.01')).toHaveValue('1250.5');

  await openMenu(page, '/emis/facilities');
  await expect(page.getByRole('heading', { name: '1.2 Báo cáo cơ sở vật chất' })).toBeVisible();
  for (const label of ['Cơ sở vật chất', 'Nhà vệ sinh', 'Cơ sở vật chất khác', 'Thiết bị dạy học', 'Thông tin khác']) {
    await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('tab', { name: 'Nhà vệ sinh', exact: true }).click();
  const toilets = page.getByRole('region', { name: 'Nhà vệ sinh' });
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
  await page.getByRole('tab', { name: 'IV. Kết quả giáo dục' }).click();
  await expect(page.getByRole('region', { name: 'IV. Kết quả giáo dục' })).toContainText(
    'Hoàn thành chương trình giáo dục mầm non',
  );

  await openMenu(page, '/emis/staff');
  await page.getByRole('tab', { name: 'Chuẩn nghề nghiệp' }).click();
  await expect(
    page.getByRole('region', { name: 'Chuẩn nghề nghiệp' }).getByRole('columnheader', { name: 'Tốt' }),
  ).toBeVisible();
  const staffFile = await downloadOf(page, () => page.getByRole('button', { name: 'Xuất Excel' }).click());
  expect(staffFile.suggestedFilename()).toMatch(/^emis-doi-ngu-\d{8}-\d{4}\.xlsx$/);

  await openMenu(page, '/emis/preschool-end-of-year');
  await expect(page.getByRole('heading', { name: '2.4 Báo cáo giáo dục mầm non cuối năm' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Kết quả giáo dục' })).toBeVisible();

  await openMenu(page, '/emis/foreign-language');
  const children = page.getByRole('region', { name: 'Trẻ làm quen tiếng Anh' });
  await children.getByLabel('Số trẻ NN.03').fill('18');
  await children.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(children).toContainText('Ghi lần cuối');
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
  await expect(children.getByLabel('Số trẻ NN.03')).toBeDisabled();
  await expect(children.getByRole('button', { name: 'Ghi', exact: true })).toBeDisabled();
});

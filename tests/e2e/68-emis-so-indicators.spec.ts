import { expect, test, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// EMIS theo đúng chỉ tiêu, mã số, cột của Sở (DT-17 phần 17a): 1.1.1 năm thẻ của Biểu 01.ĐN-MN và Biểu 08.ĐN-NSNN, cột nhóm
// hai hàng, Xóa dữ liệu; 1.1.2 Gửi báo cáo đầu năm hai lưới (hồ sơ, biểu mẫu), Gửi hồ sơ, Xuất file lỗi, Đặt trạng thái gửi
// lại, Hủy; 1.2.1 thẻ 1 có cột Xây dựng mới. Dữ liệu là dữ liệu giả
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

test('CT-17a-6: 1.1.1 năm thẻ, mã 01 đến 217 và 1 đến 71, cột theo thẻ, Xóa dữ liệu; 1.2.1 cột Xây dựng mới', async ({
  page,
}) => {
  await signIn(page, 'VT-02');
  await openMenu(page, '/emis');
  await expect(page.getByRole('heading', { name: '1.1.1 Lập báo cáo đầu năm' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lấy dữ liệu từ hệ thống' })).toBeVisible();
  for (const label of ['1. Trường – Lớp', '2. Trẻ em', '3. Đội ngũ', '4. Cơ sở vật chất', '5. Ngân sách nhà nước']) {
    await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
  }
  const first = page.getByRole('region', { name: '1. Trường – Lớp' });
  await expect(first.getByRole('columnheader', { name: 'Công lập' })).toBeVisible();
  await expect(first).toContainText('Trường có chỗ rửa tay thuận tiện');

  await page.getByRole('tab', { name: '2. Trẻ em', exact: true }).click();
  const children = page.getByRole('region', { name: '2. Trẻ em' });
  await expect(children.getByRole('columnheader', { name: 'Dân tộc thiểu số' })).toBeVisible();
  await expect(children).toContainText('Trẻ em học MG được hỗ trợ ăn trưa (NĐ 105/2020/NĐ-CP)');

  await page.getByRole('tab', { name: '3. Đội ngũ', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '3. Đội ngũ' }).getByRole('columnheader', { name: 'HĐLV xác định thời hạn' }),
  ).toBeVisible();

  await page.getByRole('tab', { name: '4. Cơ sở vật chất', exact: true }).click();
  const rooms = page.getByRole('region', { name: '4. Cơ sở vật chất' });
  await expect(rooms.getByRole('row').filter({ hasText: 'Phòng tin học' }).last()).toContainText('217');

  await page.getByRole('tab', { name: '5. Ngân sách nhà nước', exact: true }).click();
  const budget = page.getByRole('region', { name: '5. Ngân sách nhà nước' });
  await expect(budget).toContainText('Đào tạo lại, bồi dưỡng nghiệp vụ');
  await budget.getByLabel('Dự toán 71', { exact: true }).fill('12');
  await budget.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(budget).toContainText('Ghi lần cuối');
  await budget.getByRole('button', { name: 'Xóa dữ liệu' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Xóa dữ liệu:' });
  await confirm.getByRole('button', { name: 'Xóa dữ liệu' }).click();
  await expect(budget).toContainText('Thẻ chưa ghi');
  await expect(budget.getByLabel('Dự toán 71', { exact: true })).toHaveValue('');

  await openMenu(page, '/emis/facilities');
  const facilities = page.getByRole('region', { name: '1. Cơ sở vật chất' });
  await expect(facilities.getByRole('columnheader', { name: 'Kiên cố', exact: true })).toBeVisible();
  await expect(facilities.getByRole('columnheader', { name: 'Kiên cố Xây dựng mới' })).toBeVisible();
  await expect(facilities).toContainText('Khối công trình công cộng');
});

test('CT-17a-7: 1.1.2 lưới hồ sơ, lưới biểu mẫu; Gửi hồ sơ, Xuất file lỗi, Đặt trạng thái gửi lại, Hủy', async ({
  page,
}) => {
  await signIn(page, 'VT-02');
  await openMenu(page, '/emis/send');
  await expect(page.getByRole('heading', { name: '1.1.2 Gửi báo cáo đầu năm' })).toBeVisible();
  const records = page.getByRole('region', { name: 'Hồ sơ cần gửi' });
  const forms = page.getByRole('region', { name: 'Biểu mẫu báo cáo' });
  await expect(records.getByRole('row', { name: /^Hồ sơ / })).toHaveCount(5);
  await expect(forms.getByRole('row', { name: /^Biểu mẫu / })).toHaveCount(5);
  await expect(records.getByRole('columnheader', { name: 'Số đã gửi thành công' })).toBeVisible();
  const budget = forms.getByRole('row', { name: 'Biểu mẫu Biểu 08.ĐN-NSNN: Ngân sách nhà nước' });
  await expect(budget).toContainText('Không có dữ liệu');

  // Hủy bỏ các dòng đã chọn
  await page.getByLabel('Chọn Hồ sơ lớp').check();
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByLabel('Chọn Hồ sơ lớp')).not.toBeChecked();

  await page.getByLabel('Chọn Hồ sơ học sinh').check();
  const errors = await downloadOf(page, () => page.getByRole('button', { name: 'Xuất file lỗi' }).click());
  expect(errors.suggestedFilename()).toMatch(/^file-loi-bao-cao-dau-nam-\d{8}-\d{4}\.xlsx$/);

  await page.getByLabel('Chọn Biểu 08.ĐN-NSNN: Ngân sách nhà nước').check();
  const sent = await downloadOf(page, () => page.getByRole('button', { name: 'Gửi hồ sơ' }).click());
  expect(sent.suggestedFilename()).toMatch(/^gui-bao-cao-dau-nam-\d{8}-\d{4}\.xlsx$/);
  await expect(budget).toContainText('Đã gửi');
  await expect(records.getByRole('row', { name: 'Hồ sơ Hồ sơ học sinh' })).toContainText(/Đã gửi đủ|Không có hồ sơ/);

  await page.getByLabel('Chọn Biểu 08.ĐN-NSNN: Ngân sách nhà nước').check();
  await page.getByRole('button', { name: 'Đặt trạng thái gửi lại' }).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Hồ sơ chọn bỏ đánh dấu' })
    .getByRole('button', { name: 'Đặt trạng thái gửi lại' })
    .click();
  await expect(budget).toContainText('Cần gửi lại');
});

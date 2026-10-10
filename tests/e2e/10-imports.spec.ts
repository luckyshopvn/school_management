import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser, hashForTesting } from '@school-management/identity/testing';

// MH-40 Nhập dữ liệu ban đầu từ Excel (P01-13, YCTD-46). Chạy sau 09-children.spec.ts, khi đã có Phân hiệu A,
// bậc học MAM và quan hệ "Bố"
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let savedSettings: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

test.beforeAll(async () => {
  savedSettings = await identity
    .selectFrom('identity_settings')
    .select(['key', 'value', 'updated_by'])
    .where('key', '=', 'parent_default_password_hash')
    .execute();
  await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
  await identity
    .insertInto('identity_settings')
    .values({
      key: 'parent_default_password_hash',
      value: JSON.stringify(await hashForTesting('PhuHuynh2026')),
      updated_by: null,
    })
    .execute();
});

test.afterAll(async () => {
  await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
  for (const row of savedSettings) {
    await identity
      .insertInto('identity_settings')
      .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
      .execute();
  }
  await identity.destroy();
});

async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Dữ liệu');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function upload(page: Page, section: string, buffer: Buffer, action: string) {
  const region = page.getByRole('region', { name: section });
  await region.getByLabel(`Tệp ${section}`).setInputFiles({
    name: 'du-lieu.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await region.getByRole('button', { name: action }).click();
  return region;
}

test('Hiệu trưởng nhập lớp rồi nhập trẻ kèm phụ huynh; trẻ nhập ở trạng thái đang học, thiếu giấy khai sinh', async ({
  page,
}) => {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Nhập dữ liệu' }).click();

  const classes = await upload(
    page,
    'Lớp học',
    await workbook(
      ['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Mã bậc học', 'Sĩ số tối đa', 'Mã phòng'],
      [['PH-A', 'MAM9', 'Mầm 9', 'MAM', '20', '']],
    ),
    'Kiểm tra tệp',
  );
  await expect(classes).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await classes.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(classes).toContainText('Đã ghi dữ liệu');

  const childHeaders = [
    'Mã đơn vị',
    'Mã lớp',
    'Họ tên trẻ',
    'Ngày sinh',
    'Giới tính',
    'Số định danh cá nhân',
    'Mã định danh ngành',
    'Nơi sinh',
    'Địa chỉ',
    'Dị ứng',
    'Bệnh nền',
    'Ngày vào lớp',
    'Họ tên phụ huynh 1',
    'Quan hệ phụ huynh 1',
    'Số điện thoại phụ huynh 1',
    'Họ tên phụ huynh 2',
    'Quan hệ phụ huynh 2',
    'Số điện thoại phụ huynh 2',
  ];
  const nationalId = `0793${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
  const phone = `09${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
  const row = [
    'PH-A',
    'MAM9',
    'Trần Minh Khang',
    '05/03/2022',
    'Nam',
    nationalId,
    '',
    '',
    '',
    'Không',
    '',
    '',
    'Trần Văn Hùng',
    'Bố',
    phone,
    '',
    '',
    '',
  ];

  const broken = await upload(
    page,
    'Trẻ và phụ huynh',
    await workbook(childHeaders, [[...row.slice(0, 9), '', ...row.slice(10)]]),
    'Kiểm tra tệp',
  );
  await expect(broken).toContainText('Còn dòng lỗi');
  await expect(broken.getByRole('table', { name: 'Báo cáo dòng lỗi' })).toContainText('Dị ứng');
  await expect(broken.getByRole('button', { name: 'Ghi dữ liệu' })).toHaveCount(0);

  const children = await upload(page, 'Trẻ và phụ huynh', await workbook(childHeaders, [row]), 'Kiểm tra tệp');
  await expect(children).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await children.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(children).toContainText('Đã ghi dữ liệu');

  await page.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await page.getByLabel('Thiếu giấy khai sinh').check();
  const imported = page.getByRole('row').filter({ hasText: 'Trần Minh Khang' });
  await expect(imported).toContainText('Đang học');
  await expect(imported).toContainText('Mầm 9');
  await imported.click();
  await expect(page.getByRole('region', { name: 'Hồ sơ Trần Minh Khang' })).toContainText('Thiếu giấy khai sinh');
});

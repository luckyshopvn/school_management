import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser, hashForTesting } from '@school-management/identity/testing';

// Nhập tệp xuất từ CSDL ngành cho trẻ (DT-13 phần 13a, YCTD-100). Chạy sau 10-imports.spec.ts, khi đã có lớp MAM9 "Mầm 9"
// ở Phân hiệu A. Tệp tổng hợp chỉ gồm vài cột của mẫu học sinh, dữ liệu không có thật
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

const digits = (length: number) =>
  Math.floor(Math.random() * 10 ** length)
    .toString()
    .padStart(length, '0');

test('Hiệu trưởng tải tệp học sinh của CSDL ngành, xem trước rồi ghi; hồ sơ trẻ có mục Thông tin theo CSDL ngành', async ({
  page,
}) => {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Sheet1');
  sheet.addRow([
    'STT',
    'Mã lớp',
    'Mã học sinh',
    'Họ tên',
    'Ngày sinh',
    'Giới tính',
    'Trạng thái HS',
    'Dân tộc',
    'Tỉnh/Thành phố\n(Theo địa chỉ thường trú)',
    '',
    'Số định danh cá nhân',
    'Họ tên mẹ',
    'Năm sinh mẹ',
    'Số điện thoại mẹ',
  ]);
  sheet.addRow([
    1,
    'mầm 9',
    digits(10),
    'Lê Thị Mai Anh',
    '12/06/2022',
    'Nữ',
    'Đang học',
    'Kinh',
    'Tỉnh Thử Nghiệm',
    'Huyện Cũ Thử',
    `0794${digits(8)}`,
    'Lê Thị Hoa',
    '1992',
    `09${digits(8)}`,
  ]);
  const buffer = Buffer.from(await book.xlsx.writeBuffer());

  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Nhập dữ liệu' }).click();

  const region = page.getByRole('region', { name: 'Trẻ từ CSDL ngành' });
  await region.getByLabel('Tệp Trẻ từ CSDL ngành').setInputFiles({
    name: 'hoc-sinh-csdl.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await region.getByRole('button', { name: 'Kiểm tra tệp' }).click();
  await expect(region).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await expect(region).toContainText('1 tạo mới, 0 cập nhật');
  await region.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(region).toContainText('Đã ghi dữ liệu');

  await page.getByRole('link', { name: 'Hồ sơ trẻ' }).click();
  await page.getByLabel('Thiếu giấy khai sinh').check();
  const imported = page.getByRole('row').filter({ hasText: 'Lê Thị Mai Anh' });
  await expect(imported).toContainText('Đang học');
  await expect(imported).toContainText('Mầm 9');
  await imported.click();
  const profile = page.getByRole('region', { name: 'Hồ sơ Lê Thị Mai Anh' });
  await profile.getByText('Thông tin theo CSDL ngành').click();
  const moet = profile.getByRole('group', { name: 'Thông tin theo CSDL ngành' });
  await expect(moet).toContainText('Dân tộc');
  await expect(moet).toContainText('Kinh');
  await expect(moet).toContainText('Huyện Cũ Thử');
});

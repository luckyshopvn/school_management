import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Cơ sở vật chất đủ theo hệ thống của Sở (DT-16 phần 16i, YCTD-128): Hiệu trưởng khai báo phòng vệ sinh (thông tin nhà vệ
// sinh chỉ hiện với Phòng vệ sinh), nhập phòng từ Excel bằng file mẫu tải về, xem 1.2 Báo cáo cơ sở vật chất, ghi mức độ
// đạt chuẩn, xuất tệp gửi; nhập 6.1 thực trạng và nhu cầu đầu tư; mở 2.2 riêng; 2.3 đánh dấu đã gửi khi trường không có dữ
// liệu; gắn tài sản với thiết bị ở Kho. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function downloadOf(page: Page, action: () => Promise<void>) {
  const downloading = page.waitForEvent('download');
  await action();
  return downloading;
}

test('Hiệu trưởng khai báo, nhập phòng, lập báo cáo cơ sở vật chất, nhu cầu đầu tư và gửi thiết bị lên cấp trên', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 6.2 Nhập liệu cơ sở vật chất mở màn hình khai báo; thông tin nhà vệ sinh chỉ hiện khi chọn Phòng vệ sinh
  await openMenu(page, '/facility-input');
  await expect(page.getByRole('heading', { name: '6.2. Nhập liệu cơ sở vật chất' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('region', { name: 'Thêm phòng' });
  await form.getByLabel('Mã phòng').fill(`WC65-${suffix}`);
  await form.getByLabel('Tên phòng').fill('Nhà vệ sinh học sinh thử 65');
  await form.getByLabel('Sức chứa').fill('12');
  await form.getByLabel('Khối phòng').selectOption('care_education');
  await expect(form.getByLabel('Đối tượng sử dụng nhà vệ sinh')).toHaveCount(0);
  await form.getByLabel('Loại phòng').selectOption('toilet');
  await form.getByLabel('Hiện trạng').selectOption('permanent');
  await form.getByLabel('Diện tích (m²)').fill('14');
  await form.getByLabel('Đối tượng sử dụng nhà vệ sinh').selectOption('children');
  await form.getByLabel('Nhà vệ sinh đạt chuẩn').selectOption('met');
  await form.getByLabel('Riêng nam, nữ').check();
  await form.getByLabel('Số chỗ (bệ xí, tiểu)').fill('6');
  await form.getByRole('button', { name: 'Lưu phòng' }).click();
  await expect(page.getByText('Đã lưu phòng')).toBeVisible();

  // 1.1 Nhập từ Excel: tải file mẫu, điền một phòng, tải lên, ghi dữ liệu
  await openMenu(page, '/facility-rooms');
  await expect(page.getByRole('heading', { name: '1.1. Khai báo cơ sở vật chất' })).toBeVisible();
  await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
  const importPanel = page.getByRole('region', { name: 'Nhập phòng từ Excel' });
  const template = await downloadOf(page, () =>
    importPanel.getByRole('button', { name: 'Tải file mẫu', exact: true }).click(),
  );
  expect(template.suggestedFilename()).toBe('mau-nhap-phong.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(await template.path())) as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const headers = ((sheet?.getRow(1).values as unknown[]) ?? []).slice(1).map(String);
  const root = await schoolYear
    .selectFrom('org_units')
    .select('code')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const values: Record<string, string> = {
    'Mã đơn vị': root.code,
    'Mã phòng': `GDTC65-${suffix}`,
    'Tên phòng': 'Phòng giáo dục thể chất thử 65',
    'Sức chứa': '40',
    'Loại phòng': 'Phòng giáo dục thể chất',
    'Hiện trạng': 'Bán kiên cố',
    'Diện tích (m²)': '72,5',
  };
  sheet?.addRow(headers.map((header) => values[header] ?? ''));
  const filled = Buffer.from(await workbook.xlsx.writeBuffer());
  await importPanel.getByLabel('Tệp Nhập phòng từ Excel').setInputFiles({
    name: 'phong-65.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: filled,
  });
  await importPanel.getByRole('button', { name: 'Tải lên' }).click();
  await expect(importPanel).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await importPanel.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(page.getByText('Đã ghi 1 phòng từ Excel')).toBeVisible();
  const list = page.getByRole('region', { name: 'Danh sách phòng' });
  await list.getByRole('searchbox', { name: 'Tìm theo tên, mã phòng, điểm trường' }).fill(`GDTC65-${suffix}`);
  await expect(list).toContainText('Phòng giáo dục thể chất thử 65');

  // 1.2 Báo cáo cơ sở vật chất: thẻ nhà vệ sinh, ghi mức độ đạt chuẩn, xuất tệp gửi
  await openMenu(page, '/facility-report');
  await expect(page.getByRole('heading', { name: '1.2. Báo cáo cơ sở vật chất' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Số liệu phòng' })).toContainText('Trong đó: Phòng giáo dục thể chất');
  await page.getByRole('tab', { name: 'Nhà vệ sinh' }).click();
  await expect(page.getByRole('region', { name: 'Nhà vệ sinh' })).toContainText('Nhà vệ sinh dùng cho học sinh');
  await page.getByRole('tab', { name: 'Mức độ đạt chuẩn' }).click();
  const standard = page.getByRole('region', { name: 'Mức độ đạt chuẩn' });
  for (const block of ['nuôi dưỡng', 'tổ chức ăn', 'phụ trợ', 'hành chính quản trị', 'Khối phòng khác']) {
    await standard
      .getByLabel(new RegExp(`^Mức độ đạt chuẩn .*${block}`))
      .selectOption(block === 'phụ trợ' ? 'level_1' : 'level_2');
  }
  await standard.getByRole('button', { name: 'Ghi mức độ đạt chuẩn' }).click();
  await expect(page.getByText('Đã ghi mức độ đạt chuẩn')).toBeVisible();
  await expect(standard.getByLabel('Mức độ đạt chuẩn của trường')).toContainText('Mức độ 1');
  const panel = page.getByRole('region', { name: 'Gửi lên cấp trên' });
  const reportRow = panel.getByRole('row', { name: 'Biểu mẫu Báo cáo cơ sở vật chất' });
  await expect(panel.getByRole('button', { name: 'Gửi', exact: true })).toHaveCount(0);
  await reportRow.getByRole('button', { name: 'Xuất tệp gửi' }).click();
  const sentFile = await downloadOf(page, () =>
    reportRow.getByRole('button', { name: /^bao-cao-co-so-vat-chat-.*\.xlsx$/ }).click(),
  );
  expect(sentFile.suggestedFilename()).toMatch(/^bao-cao-co-so-vat-chat-\d{8}-\d{4}\.xlsx$/);

  // 6.1 Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ
  await openMenu(page, '/facility-investments');
  await expect(
    page.getByRole('heading', { name: '6.1. Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Lấy số liệu từ khai báo phòng' }).click();
  await page.getByLabel('Cấp 4 xuống cấp Phòng học').fill('1');
  await page.getByLabel('Số phòng Phòng học').fill('2');
  await page.getByLabel('Kinh phí (triệu đồng) Phòng học').fill('2500');
  await page.getByLabel('Số phòng Nhà công vụ cho giáo viên').fill('1');
  await page.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi thực trạng và nhu cầu đầu tư')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Kinh phí (triệu đồng) Phòng học')).toHaveValue('2500');

  // 2.2 Thiết bị ngoài danh mục tối thiểu là mục riêng, có nhập từ Excel
  await openMenu(page, '/equipment-outside');
  await expect(page.getByRole('heading', { name: '2.2. Thiết bị ngoài danh mục tối thiểu' })).toBeVisible();
  await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
  await expect(page.getByRole('region', { name: 'Nhập danh mục thiết bị từ Excel' })).toBeVisible();

  // 2.3 Gửi thiết bị dạy học lên cấp trên: xuất tệp gửi, đánh dấu đã gửi khi trường không có dữ liệu
  await openMenu(page, '/equipment-submission');
  await expect(page.getByRole('heading', { name: '2.3. Gửi thiết bị dạy học lên cấp trên' })).toBeVisible();
  const equipmentRow = page
    .getByRole('region', { name: 'Gửi lên cấp trên' })
    .getByRole('row', { name: 'Biểu mẫu Tổng hợp thiết bị dạy học' });
  await equipmentRow.getByRole('button', { name: 'Xuất tệp gửi' }).click();
  await expect(equipmentRow.getByRole('button', { name: /^tong-hop-thiet-bi-day-hoc-.*\.xlsx$/ })).toBeVisible();
  await equipmentRow.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Đánh dấu đã gửi:' });
  await dialog.getByLabel('Trường không có dữ liệu').check();
  await dialog.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  await expect(equipmentRow).toContainText('Đã gửi');
  await expect(equipmentRow.getByRole('button', { name: 'Xuất tệp gửi' })).toHaveCount(0);

  // Kho, tài sản: gắn tài sản với thiết bị dạy học
  await openMenu(page, '/inventory');
  await page.getByRole('tab', { name: 'Tài sản' }).click();
  await expect(page.getByLabel('Gắn thiết bị dạy học')).toBeVisible();
});

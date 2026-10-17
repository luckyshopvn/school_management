import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên chạy nội bộ (DT-16 phần 16a, YCTD-121): Xuất PDF trên lưới, 3.5 Tệp
// đã tạo, 2.2 Nhập lớp học từ Excel với tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi; gửi
// Báo cáo EMIS đầu năm lên cấp trên. Chạy sau 03-org-units, 06-catalogs, 08-classes (Phân hiệu A mã PH-A, bậc học MAM,
// lớp Mầm 1). Dữ liệu là dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);
const suffix = Date.now() % 1_000_000;
const classCode = `NK${suffix}`;

test.afterAll(async () => {
  await identity.destroy();
  await system.destroy();
});

async function signIn(page: Page, roleCode: string, unit: string | null) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: unit }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return user;
}

async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Dữ liệu');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function downloadOf(page: Page, click: () => Promise<void>) {
  const downloading = page.waitForEvent('download');
  await click();
  return downloading;
}

async function sheetRows(path: string, sheetName?: string): Promise<string[][]> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path);
  const sheet = sheetName ? book.getWorksheet(sheetName) : book.worksheets[0];
  const rows: string[][] = [];
  sheet?.eachRow((row) => rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? ''))));
  return rows;
}

test('CT-16a-8: lưới dữ liệu dùng chung có nút Xuất PDF; tệp PDF theo bộ lọc và cột đang hiện', async ({ page }) => {
  await signIn(page, 'VT-02', null);
  await openMenu(page, '/classes');
  const grid = page.getByRole('region', { name: 'Danh sách lớp' });
  const download = await downloadOf(page, () => grid.getByRole('button', { name: 'Xuất PDF' }).click());
  expect(download.suggestedFilename()).toMatch(/^danh-sach-lop-\d{8}-\d{4}\.pdf$/);
  expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe('%PDF-');

  await openMenu(page, '/children');
  const students = page.getByRole('region', { name: 'Danh sách học sinh' });
  const studentPdf = await downloadOf(page, () => students.getByRole('button', { name: 'Xuất PDF' }).click());
  expect(studentPdf.suggestedFilename()).toMatch(/^danh-sach-hoc-sinh-\d{8}-\d{4}\.pdf$/);
});

test('CT-16a-9: 2.2 Nhập lớp học: file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập cập nhật lớp đã có, xuất file lỗi', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  await openMenu(page, '/class-imports');
  const region = page.getByRole('region', { name: 'Lớp học' });

  const withData = await downloadOf(page, () =>
    region.getByRole('button', { name: 'Tải file mẫu kèm dữ liệu' }).click(),
  );
  expect(withData.suggestedFilename()).toBe('mau-nhap-classes-kem-du-lieu.xlsx');
  const rows = await sheetRows(await withData.path());
  expect(rows[0]).toEqual(['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Mã bậc học', 'Sĩ số tối đa', 'Mã phòng']);
  expect(rows.some((row) => row[2] === 'Mầm 1')).toBe(true);
  expect(
    (await sheetRows(await withData.path(), 'Danh mục')).some((row) => row[0] === 'Bậc học' && row[2] === 'MAM'),
  ).toBe(true);

  await region.getByRole('button', { name: 'Tra cứu danh mục' }).click();
  const lookup = region.getByRole('region', { name: 'Tra cứu danh mục' });
  await lookup.getByRole('combobox', { name: 'Danh mục', exact: true }).selectOption({ label: 'Bậc học' });
  await expect(lookup.getByRole('table')).toContainText('MAM');

  // Thêm lớp mới đủ cột
  const file = async (headers: string[], data: string[][]) =>
    region.getByLabel('Tệp Lớp học').setInputFiles({
      name: 'lop-hoc.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook(headers, data),
    });
  await file(
    ['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Mã bậc học', 'Sĩ số tối đa', 'Mã phòng'],
    [['PH-A', classCode, `Nhập ${suffix}`, 'MAM', '20', '']],
  );
  await region.getByRole('button', { name: 'Tải lên', exact: true }).click();
  await expect(region).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await region.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(region).toContainText('Đã ghi dữ liệu');

  // Chỉ chọn cột Tên lớp: tệp chỉ cần cột khóa và Tên lớp; lớp đã có được đổi tên
  await region.getByRole('button', { name: 'Chọn cột để nhập' }).click();
  const columns = region.getByRole('group', { name: 'Chọn cột để nhập' });
  await expect(columns.getByLabel('Mã lớp')).toBeDisabled();
  for (const label of ['Mã bậc học', 'Sĩ số tối đa', 'Mã phòng']) {
    await columns.getByLabel(label).uncheck();
  }
  await file(['Mã đơn vị', 'Mã lớp', 'Tên lớp'], [['PH-A', classCode, `Đổi tên ${suffix}`]]);
  await region.getByRole('button', { name: 'Tải lên', exact: true }).click();
  await expect(region).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await region.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(region).toContainText('Đã ghi dữ liệu');
  await openMenu(page, '/classes');
  const classGrid = page.getByRole('region', { name: 'Danh sách lớp' });
  await classGrid.getByLabel('Tìm theo tên, mã lớp').fill(classCode);
  await expect(classGrid).toContainText(`Đổi tên ${suffix}`);

  // Lớp mới thiếu cột bắt buộc: báo lỗi từng dòng và xuất file lỗi có cột Nội dung lỗi
  await openMenu(page, '/class-imports');
  await region.getByRole('button', { name: 'Chọn cột để nhập' }).click();
  for (const label of ['Mã bậc học', 'Sĩ số tối đa', 'Mã phòng']) {
    await region.getByRole('group', { name: 'Chọn cột để nhập' }).getByLabel(label).uncheck();
  }
  await file(['Mã đơn vị', 'Mã lớp', 'Tên lớp'], [['PH-A', `${classCode}X`, 'Lớp thiếu cột']]);
  await region.getByRole('button', { name: 'Tải lên', exact: true }).click();
  await expect(region).toContainText('Còn dòng lỗi');
  await expect(region.getByRole('table', { name: 'Báo cáo dòng lỗi' })).toContainText(
    'Thêm lớp mới cần chọn nhập cột này',
  );
  const errorFile = await downloadOf(page, () => region.getByRole('button', { name: 'Xuất file lỗi' }).click());
  const errorRows = await sheetRows(await errorFile.path());
  expect(errorRows[0]).toEqual(['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Nội dung lỗi']);
  expect(errorRows[1]?.[3]).toContain('Mã bậc học: Thêm lớp mới cần chọn nhập cột này');
});

test('CT-16a-10: 3.5 Tệp đã tạo chỉ liệt kê tác vụ xuất nền của người đang đăng nhập kèm trạng thái, ghi chú lỗi', async ({
  page,
}) => {
  const user = await signIn(page, 'VT-02', null);
  // Danh sách lớn (trên 10 000 dòng) mới tạo tác vụ nền; giả lập một tác vụ lỗi và một tác vụ đang chờ của người dùng
  await system
    .insertInto('export_jobs')
    .values(
      (['failed', 'pending'] as const).map((status) => ({
        user_id: user.id,
        user_name: 'Người dùng thử',
        user_snapshot: JSON.stringify({ id: user.id, full_name: 'Người dùng thử', assignments: [] }),
        report_code: 'children',
        title: status === 'failed' ? `Danh sách học sinh lỗi ${suffix}` : `Danh sách học sinh chờ ${suffix}`,
        format: 'xlsx' as const,
        parameters: JSON.stringify({}),
        status,
        error_message: status === 'failed' ? 'Không tạo được tệp, vui lòng thử xuất lại' : null,
      })),
    )
    .execute();
  await openMenu(page, 'Tệp đã tạo', { exact: true });
  await expect(page.getByRole('heading', { name: '3.5. Tệp đã tạo', exact: true })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Tệp đã tạo' });
  const failed = grid.getByRole('row', { name: `Tệp Danh sách học sinh lỗi ${suffix}` });
  await expect(failed).toContainText('Lỗi');
  await expect(failed).toContainText('Không tạo được tệp, vui lòng thử xuất lại');
  await expect(failed.getByRole('button', { name: 'Tải về' })).toHaveCount(0);
  await expect(grid.getByRole('row', { name: `Tệp Danh sách học sinh chờ ${suffix}` })).toContainText('Đang chờ');
  // Không để tác vụ giả chờ tiến trình nền của các ca sau
  await system.deleteFrom('export_jobs').where('user_id', '=', user.id).execute();
});

test('CT-16a-11: 1.1 Báo cáo EMIS đầu năm gửi lên cấp trên: xuất tệp gửi, đánh dấu đã gửi, yêu cầu và mở khóa', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  await openMenu(page, '/emis');
  const panel = page.getByRole('region', { name: 'Gửi lên cấp trên' });
  const row = panel.getByRole('row', { name: 'Biểu mẫu Báo cáo EMIS đầu năm – Biểu 1' });
  await expect(row).toContainText('Chưa gửi');
  await expect(panel.getByRole('button', { name: 'Gửi', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: 'Xuất tệp gửi' }).click();
  await expect(row.getByRole('button', { name: /^emis-dau-nam-.*\.xlsx$/ })).toBeVisible();
  const sentFile = await downloadOf(page, () => row.getByRole('button', { name: /^emis-dau-nam-.*\.xlsx$/ }).click());
  expect(sentFile.suggestedFilename()).toMatch(/^emis-dau-nam-\d{8}-\d{4}\.xlsx$/);

  // Dữ liệu mẫu của e2e thiếu khai báo nên tệp gửi lập khi chưa hoàn thành; giả lập tệp lập khi dữ liệu đã hoàn thành
  await system.updateTable('upper_level_submissions').set({ data_complete: true }).execute();
  await page.reload();
  await row.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Đánh dấu đã gửi:' });
  await dialog.getByLabel('Ghi chú').fill('Nộp bản giấy');
  await dialog.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  await expect(row).toContainText('Đã gửi');
  await expect(row.getByRole('button', { name: 'Xuất tệp gửi' })).toHaveCount(0);

  await row.getByRole('button', { name: 'Gửi yêu cầu mở khóa' }).click();
  const request = page.getByRole('dialog').filter({ hasText: 'Gửi yêu cầu mở khóa:' });
  await request.getByLabel('Lý do mở khóa').fill('Bổ sung số trẻ');
  await request.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(row).toContainText('Đã gửi yêu cầu mở khóa');
  await expect(row).toContainText('Bổ sung số trẻ');

  await row.getByRole('button', { name: 'Xử lý yêu cầu mở khóa' }).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Xử lý yêu cầu mở khóa:' })
    .getByRole('button', { name: 'Mở khóa', exact: true })
    .click();
  await expect(row).toContainText('Cần gửi lại');
  await expect(row.getByRole('button', { name: 'Xuất tệp gửi' })).toBeVisible();
});

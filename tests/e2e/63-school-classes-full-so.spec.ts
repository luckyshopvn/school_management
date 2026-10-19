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
import ExcelJS from 'exceljs';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// DT-16 phần 16e (YCTD-127): 1.4 Cấu hình trường, 1.7 Rà soát kiểm định, 1.8 Tách trường, 2.1 Xóa lớp, 3.4 Khai báo tuần,
// 5.7 Chuyển hồ sơ lên năm học mới (chỉ xem, không chuyển năm vì các kiểm thử sau dùng năm học đang mở). Chạy sau 08-classes
// và 54-school-classes-so (Điểm trường A1, bậc học Mầm). Dữ liệu là dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const suffix = Date.now() % 1_000_000;

test.afterAll(async () => {
  await identity.destroy();
});

async function findUnitId(name: string): Promise<string> {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  const schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  try {
    return (await schoolYear.selectFrom('org_units').select('id').where('name', '=', name).executeTakeFirstOrThrow())
      .id;
  } finally {
    await schoolYear.destroy();
  }
}

async function signIn(page: Page) {
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test('CT-16e-16: 1.4 Cấu hình trường ghi tên trường hiển thị, thanh đầu trang đổi theo; xóa thì trở về tên Trường chính', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/settings');
  const block = page.getByRole('region', { name: 'Cấu hình trường' });
  const displayName = `Trường Mầm non Hiển Thị ${suffix}`;
  await block.getByLabel('Tên trường hiển thị').fill(displayName);
  await block.getByLabel('Tên đơn vị hành chính').fill('Phường Thử Nghiệm');
  await block.getByRole('button', { name: 'Ghi' }).click();
  await expect(toast(page, 'Đã ghi cấu hình trường')).toBeVisible();
  // Tên trường trên thanh đầu trang chỉ hiện ở màn hình rộng; kiểm tra theo thuộc tính title
  await expect(page.getByTestId('school-name')).toHaveAttribute('title', displayName);
  await block.getByLabel('Tên trường hiển thị').fill('');
  await block.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByTestId('school-name')).not.toHaveAttribute('title', displayName);
});

test('CT-16e-17: 2.1 chọn lớp chưa có dữ liệu rồi Xóa lớp qua hộp xác nhận của Sở', async ({ page }) => {
  await signIn(page);
  const siteId = await findUnitId('Điểm trường A1');
  await openMenu(page, '/classes');
  const grid = page.getByRole('region', { name: 'Danh sách lớp' });
  const className = `Lớp xóa ${suffix}`;
  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm mới lớp học' });
  await form.getByLabel('Đơn vị').selectOption(siteId);
  await form.getByLabel('Mã lớp').fill(`XL${suffix}`);
  await form.getByLabel('Tên lớp').fill(className);
  await form.getByLabel('Khối').selectOption({ label: 'Mầm' });
  await form.getByLabel('Sĩ số tối đa').fill('20');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(toast(page, `Đã tạo lớp ${className}`)).toBeVisible();
  // Lưới có nhiều lớp của các kiểm thử trước; tìm theo tên để lớp mới nằm ở trang đầu
  await grid.getByLabel('Tìm theo tên, mã lớp').fill(className);
  await grid.getByLabel(`Chọn ${className}`, { exact: true }).check();
  await grid.getByRole('button', { name: 'Xóa lớp', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa lớp' });
  await expect(dialog.getByRole('button', { name: 'Xóa', exact: true })).toBeDisabled();
  await dialog.getByLabel('Tôi đã đọc và đồng ý xóa 1 lớp đã chọn').check();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(toast(page, 'Đã xóa 1 lớp')).toBeVisible();
  await expect(grid.getByRole('row', { name: `Lớp ${className}`, exact: true })).toHaveCount(0);
});

test('CT-16e-18: 3.4 Khai báo tuần hiện học kỳ, hiển thị, tuần đệm; bỏ hiển thị một tuần rồi Ghi', async ({ page }) => {
  await signIn(page);
  await openMenu(page, '/school-weeks');
  const table = page.getByRole('table', { name: 'Danh sách tuần' });
  for (const header of [
    'Tuần học',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Học kỳ',
    'Hiển thị',
    'Tuần đệm',
    'Tên tuần đệm',
  ]) {
    await expect(table.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
  }
  await expect(table.getByLabel('Học kỳ của tuần 1', { exact: true })).toContainText('Theo lịch (Học kỳ 1)');
  const visible = table.getByLabel('Hiển thị tuần 2', { exact: true });
  await visible.uncheck();
  await page.getByRole('button', { name: 'Ghi' }).click();
  await expect(toast(page, 'Đã ghi 1 tuần')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('table', { name: 'Danh sách tuần' }).getByLabel('Hiển thị tuần 2', { exact: true }),
  ).not.toBeChecked();
  await page.getByRole('table', { name: 'Danh sách tuần' }).getByLabel('Hiển thị tuần 2', { exact: true }).check();
  await page.getByRole('button', { name: 'Ghi' }).click();
  await expect(toast(page, 'Đã ghi 1 tuần')).toBeVisible();
});

test('CT-16e-19: 1.7 Rà soát thông tin kiểm định CLGD: Lấy dữ liệu rồi Ghi', async ({ page }) => {
  await signIn(page);
  await openMenu(page, '/accreditation-review');
  const form = page.getByRole('region', { name: 'Thông tin kiểm định chất lượng giáo dục' });
  await form.getByRole('button', { name: 'Lấy dữ liệu' }).click();
  await expect(toast(page, 'Đã lấy dữ liệu')).toBeVisible();
  await expect(form.getByLabel('Số lớp', { exact: true })).not.toHaveValue('');
  // Loại hình bắt buộc từ DT-17 phần 17e; hồ sơ trường của e2e có thể chưa chọn
  await form.getByLabel('Loại hình', { exact: true }).selectOption('public');
  await form.getByLabel('Trường chưa đạt tiêu chí nào').fill('Rà soát thử');
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(toast(page, 'Đã ghi bản rà soát')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Trường chưa đạt tiêu chí nào')).toHaveValue('Rà soát thử');
});

test('CT-17e-7: 1.7 đủ ô như Sở: ô bắt buộc, chuẩn quốc gia, kiểm định, hai chỉ số trên học sinh, ghi chú 500 ký tự', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/accreditation-review');
  const form = page.getByRole('region', { name: 'Thông tin kiểm định chất lượng giáo dục' });
  for (const block of ['Thông tin trường', 'Chuẩn quốc gia', 'Kiểm định chất lượng giáo dục', 'Cơ sở vật chất và học sinh']) {
    await expect(form.getByRole('group', { name: block })).toBeVisible();
  }
  await expect(form.getByLabel('Cấp học')).toHaveValue('Mầm non');
  await form.getByRole('button', { name: 'Lấy dữ liệu' }).click();
  await expect(toast(page, 'Đã lấy dữ liệu')).toBeVisible();
  // Thiếu tên trường thì báo lỗi ở đúng ô
  await form.getByLabel('Tên trường', { exact: true }).fill('');
  await form.getByLabel('Loại hình', { exact: true }).selectOption('public');
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(form.getByText('Bắt buộc nhập tên trường')).toBeVisible();
  await form.getByLabel('Tên trường', { exact: true }).fill(`Trường Mầm non E2E ${suffix}`);
  await form.getByLabel('Mã trường', { exact: true }).fill(`E2E${suffix}`);
  await form.getByLabel('Năm công nhận chuẩn quốc gia').fill('2023');
  await form.getByLabel('Ngày công nhận chuẩn quốc gia').fill('2023-05-20');
  await form.getByLabel('Mức độ', { exact: true }).selectOption('2');
  await form.getByLabel('Năm công nhận kiểm định CLGD').fill('2024');
  await form.getByLabel('Cấp độ', { exact: true }).selectOption('3');
  await form.getByLabel('Diện tích sàn xây dựng (m²)').fill('400');
  await form.getByLabel('Số học sinh', { exact: true }).fill('80');
  await form.getByLabel('Diện tích sàn xây dựng/Học sinh (m²)').fill('5');
  await form.getByLabel('Thời điểm đăng ký chuẩn quốc gia').fill('Năm 2027');
  // Ô ghi chú chỉ nhận 500 ký tự như Sở
  const note = form.getByLabel('Trường chưa đạt tiêu chí nào');
  await note.fill('a'.repeat(510));
  await expect(note).toHaveValue('a'.repeat(500));
  await expect(form.getByText('500/500 ký tự')).toBeVisible();
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(toast(page, 'Đã ghi bản rà soát')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mã trường', { exact: true })).toHaveValue(`E2E${suffix}`);
  await expect(page.getByLabel('Mức độ', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Cấp độ', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Diện tích sàn xây dựng/Học sinh (m²)')).toHaveValue('5');
  await expect(page.getByLabel('Thời điểm đăng ký chuẩn quốc gia')).toHaveValue('Năm 2027');
});

test('CT-16e-20: 1.8 Tách trường: tạo yêu cầu, xác nhận đi, xuất hồ sơ 82 cột, đánh dấu đã tiếp nhận', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await openMenu(page, '/school-splits');
  await expect(page.getByText('Phần mềm không gửi dữ liệu sang trường khác')).toBeVisible();
  const grid = page.getByRole('region', { name: 'Danh sách yêu cầu tách hồ sơ' });
  await grid.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('region', { name: 'Tạo yêu cầu tách hồ sơ' });
  await form.getByLabel('Trường đến', { exact: true }).fill(`Trường Mầm non Tách ${suffix}`);
  await form.getByLabel('Lý do').fill('Thành lập trường mới');
  const children = form.getByRole('group', { name: 'Học sinh tách đi' });
  await children.getByRole('checkbox').first().check();
  await expect(children.getByText('Đã chọn 1')).toBeVisible();
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(toast(page, /Đã tạo yêu cầu TT-/)).toBeVisible();
  const row = grid.getByRole('row').filter({ hasText: `Trường Mầm non Tách ${suffix}` });
  await expect(row).toContainText('Chưa xác nhận');
  await row.getByRole('button', { name: 'Xác nhận đi' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận đi' }).click();
  await expect(row).toContainText('Đã xác nhận đi');

  const downloading = page.waitForEvent('download', { timeout: 20_000 });
  await row.getByRole('button', { name: 'Xuất hồ sơ học sinh' }).click();
  // Không ra tệp thì báo kèm nội dung thông báo lỗi trên trang để dễ tìm nguyên nhân
  const download = await downloading.catch(async (error: unknown) => {
    throw new Error(`Không tải được tệp: ${(await page.getByRole('alert').allTextContents()).join(' | ')}`, {
      cause: error,
    });
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(workbook.worksheets[0]?.getRow(1).cellCount).toBe(82);

  await row.getByRole('button', { name: 'Đánh dấu đã tiếp nhận' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Ghi chú tiếp nhận/).fill('Công văn báo nhận');
  await dialog.getByRole('button', { name: 'Đánh dấu' }).click();
  await expect(row).toContainText('Đã tiếp nhận');
  await expect(page.getByRole('region', { name: 'Tiếp nhận hồ sơ tách trường' })).toBeVisible();
});

test('CT-16e-21: 5.7 Chuyển hồ sơ lên năm học mới hiện năm đang dùng, nút Thực hiện, Hủy và lý do không hủy được', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/year-rollover');
  const section = page.getByRole('region', { name: 'Chuyển hồ sơ lên năm học mới' });
  await expect(section.getByRole('button', { name: 'Thực hiện' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
  await expect(section.getByText(/^Không hủy được:/)).toBeVisible();
});

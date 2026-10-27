import { randomUUID } from 'node:crypto';
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

// Học sinh đủ theo hệ thống của Sở (DT-16 phần 16g): 4.1.1 Thay đổi, Xóa, Cấp mã định danh Bộ, Xuất file lỗi, sửa dân tộc;
// 4.1.3 sắp xếp; 4.1.5 điện thoại nhận tin hàng loạt; 4.1.8 thu thập, đánh dấu xác thực số định danh; 4.1.10 tài khoản học
// và thi; 4.2 chuyển lớp hàng loạt, đề nghị chuyển đi; 4.1.2 nhập học sinh 82 cột; 5.5 tiến độ xác thực
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
const token = `Đủ${suffix}`;
const names = {
  an: `Trần ${token} An`,
  binh: `Lê ${token} Bình`,
  chi: `Phạm ${token} Chi`,
  draft: `Ngô ${token} Dung`,
};
const classNames = { first: `Lớp Đủ ${suffix}`, second: `Lớp Đủ B ${suffix}` };
const children: Record<string, string> = {};
const motherPhones: Record<string, string> = {};
const classIds: string[] = [];

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  for (const [code, name] of [
    [`DU-${suffix}`, classNames.first],
    [`DUB-${suffix}`, classNames.second],
  ] as const) {
    classIds.push(
      (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: reference.org_unit_id,
            academic_year_id: reference.academic_year_id,
            code,
            name,
            grade_level: 'MAM',
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id,
    );
  }
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('id')
    .where('catalog_type', '=', 'parent_relationship')
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  // Quan hệ "Mẹ" để chọn điện thoại nhận tin theo quan hệ
  const mother =
    (
      await schoolYear
        .selectFrom('catalog_items')
        .select('id')
        .where('catalog_type', '=', 'parent_relationship')
        .where('name', '=', 'Mẹ')
        .executeTakeFirst()
    )?.id ?? relationship.id;
  for (const [index, [key, fullName]] of Object.entries(names).entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: fullName,
        dob: '2022-06-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: `${4000 + index}`,
        photo_consent: 'pending',
        status: key === 'draft' ? 'draft' : 'active',
        enroll_date: '2026-01-01',
        birth_certificate_file_id: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    children[key] = child.id;
    if (key !== 'draft') {
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classIds[0] ?? '', from_date: '2026-01-01' })
        .execute();
    }
    motherPhones[key] = `06${String(suffix * 10 + index)
      .padStart(8, '0')
      .slice(-8)}`;
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: `Mẹ ${fullName}`, phone: motherPhones[key] })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: mother, is_primary: true })
      .execute();
  }
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(page: Page) {
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function search(page: Page, gridName: string) {
  const grid = page.getByRole('region', { name: gridName });
  await grid.getByLabel('Tìm theo họ tên').fill(token);
  return grid;
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

test('CT-16g-14: 4.1.1 Thay đổi mở hồ sơ, sửa dân tộc; Xóa hồ sơ nháp; Cấp mã định danh Bộ nhập tay; Xuất file lỗi', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/children');
  const grid = await search(page, 'Danh sách học sinh');
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(4);

  // Thay đổi: chọn đúng một dòng thì mở hồ sơ để sửa; dân tộc chọn từ danh mục
  await grid.getByLabel(`Chọn ${names.an}`).check();
  await grid.getByRole('button', { name: 'Thay đổi' }).click();
  const profile = page.getByRole('region', { name: `Hồ sơ ${names.an}` });
  const form = profile.getByRole('form', { name: 'Hồ sơ học sinh theo Sở' });
  await form.getByLabel('Dân tộc').selectOption('Tày');
  await form.getByLabel('Biết bơi').check();
  await form.getByLabel('Lý do sửa thông tin định danh').fill('Bổ sung theo giấy khai sinh');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã ghi hồ sơ học sinh')).toBeVisible();
  await expect(grid.getByRole('row', { name: `Học sinh ${names.an}` })).toContainText('Tày');

  // Cấp mã định danh Bộ nhập tay cho học sinh đã chọn
  await grid.getByRole('button', { name: 'Cấp mã định danh Bộ' }).click();
  const codes = page.getByRole('dialog').filter({ hasText: 'Cấp mã định danh Bộ' });
  await expect(codes).toContainText('Hệ thống chưa kết nối CSDL của Bộ');
  await codes.getByLabel(`Mã định danh Bộ của ${names.an}`).fill(`HS${suffix}`);
  await codes.getByRole('button', { name: 'Ghi mã đã cấp' }).click();
  await expect(page.getByText('Đã ghi mã định danh Bộ GD&ĐT cho 1 học sinh')).toBeVisible();
  await expect(grid.getByRole('row', { name: `Học sinh ${names.an}` })).toContainText(`HS${suffix}`);
  await grid.getByLabel(`Chọn ${names.an}`).uncheck();

  // Xóa chỉ bật với hồ sơ nháp; phải tích đồng ý trong hộp xác nhận
  await grid.getByLabel(`Chọn ${names.binh}`).check();
  await expect(grid.getByRole('button', { name: 'Xóa', exact: true })).toBeDisabled();
  await grid.getByLabel(`Chọn ${names.binh}`).uncheck();
  await grid.getByLabel(`Chọn ${names.draft}`).check();
  await grid.getByRole('button', { name: 'Xóa', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Xác nhận xóa' });
  await confirm.getByRole('checkbox').check();
  await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText(`Đã xóa hồ sơ của ${names.draft}`)).toBeVisible();
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(3);

  // Xuất file lỗi: hồ sơ thiếu ô bắt buộc của CSDL ngành
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất file lỗi' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^hoc-sinh-file-loi-.*\.xlsx$/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await download.path());
  const sheet = book.worksheets[0];
  expect(String(sheet?.getRow(1).getCell(6).value)).toBe('Nội dung lỗi');
  expect(sheet?.rowCount).toBe(4);
});

test('CT-16g-15: 4.1.3 Sắp xếp A–Z rồi đổi thứ tự, Ghi; 4.1.5 sửa hàng loạt điện thoại nhận tin', async ({ page }) => {
  await signIn(page);
  await openMenu(page, '/student-order');
  await page.getByRole('combobox', { name: 'Lớp', exact: true }).selectOption(classIds[0] ?? '');
  const order = page.getByRole('region', { name: 'Thứ tự học sinh trong lớp' });
  await page.getByRole('button', { name: 'Sắp xếp A–Z lớp đã chọn' }).click();
  await expect(page.getByText(/Đã sắp xếp A–Z 3 học sinh của 1 lớp/)).toBeVisible();
  const rows = order.getByRole('row').filter({ hasText: token });
  await expect(rows.nth(0)).toContainText(names.an);
  await expect(rows.nth(1)).toContainText(names.binh);
  await expect(rows.nth(2)).toContainText(names.chi);
  await rows.nth(2).getByRole('button', { name: 'Lên' }).click();
  await order.getByRole('button', { name: 'Ghi thứ tự' }).click();
  await expect(page.getByText('Đã ghi thứ tự học sinh trong lớp')).toBeVisible();
  await expect(rows.nth(1)).toContainText(names.chi);

  await openMenu(page, '/sms-phones');
  const grid = await search(page, 'Điện thoại nhận tin của học sinh');
  await expect(grid.getByRole('row').filter({ hasText: names.binh }).first()).toContainText('Chưa chọn');
  await grid.getByLabel(`Chọn ${names.binh}`).check();
  await grid.getByLabel(`Chọn ${names.chi}`).check();
  await grid.getByRole('button', { name: 'Sửa hàng loạt' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Sửa hàng loạt điện thoại nhận tin' });
  await dialog.getByRole('combobox', { name: 'Điện thoại nhận tin', exact: true }).selectOption('primary');
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã cập nhật 2 học sinh')).toBeVisible();
  await expect(grid.getByRole('row').filter({ hasText: names.binh }).first()).toContainText(motherPhones.binh ?? '-');
  // Mở dòng xem phụ huynh và bỏ chọn
  await grid.getByRole('row').filter({ hasText: names.chi }).getByRole('button', { name: 'Phụ huynh' }).click();
  await page.getByRole('table', { name: 'Cha, mẹ, người giám hộ' }).getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(page.getByText('Đã cập nhật điện thoại nhận tin')).toBeVisible();
  await expect(grid.getByRole('row').filter({ hasText: names.chi }).first()).toContainText('Chưa chọn');
});

test('CT-16g-16: 4.1.8 thu thập số định danh từ Excel, đánh dấu đã xác thực; 5.5 tiến độ; 4.1.10 khởi tạo tài khoản', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/national-ids');
  await expect(page.getByText('Hệ thống chưa kết nối CSDL quốc gia về dân cư')).toBeVisible();
  const grid = await search(page, 'Số định danh của học sinh');
  // Số định danh đang lưu không hợp lệ: đánh dấu đã xác thực bị từ chối
  await grid.getByLabel(`Chọn ${names.binh}`).check();
  await grid.getByRole('button', { name: 'Đánh dấu đã xác thực' }).click();
  await expect(page.getByText('Số định danh phải gồm mười hai chữ số')).toBeVisible();

  // Thu thập số định danh bằng bộ nhập chung rồi đánh dấu
  const nationalId = `0791${String(suffix).padStart(8, '0')}`;
  const region = page.getByRole('region', { name: 'Số định danh', exact: true });
  await region.getByLabel('Tệp Số định danh').setInputFiles({
    name: 'so-dinh-danh.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await workbook(
      ['Mã định danh Bộ GD&ĐT', 'Họ tên học sinh', 'Ngày sinh', 'Lớp', 'Số định danh cá nhân'],
      [['', names.binh, '01/06/2022', classNames.first, nationalId]],
    ),
  });
  await region.getByRole('button', { name: 'Tải lên' }).click();
  await expect(region).toContainText('Không có dòng lỗi, sẵn sàng ghi');
  await region.getByRole('button', { name: 'Ghi dữ liệu' }).click();
  await expect(region).toContainText('Đã ghi dữ liệu');
  await page.reload();
  const fresh = await search(page, 'Số định danh của học sinh');
  await fresh.getByLabel(`Chọn ${names.binh}`).check();
  await fresh.getByRole('button', { name: 'Đánh dấu đã xác thực' }).click();
  await expect(page.getByText('Đã đánh dấu đã xác thực 1 học sinh')).toBeVisible();
  await expect(fresh.getByRole('row').filter({ hasText: names.binh })).toContainText('Đã xác thực');

  await openMenu(page, '/national-id-progress');
  const progress = page.getByRole('region', { name: 'Tiến độ xác thực theo lớp' });
  // Lưới chia trang ở máy và không có ô lọc: các spec chạy trước thêm lớp làm dòng cần tìm rơi sang trang sau (như 45, 54),
  // nên hiện 200 dòng mỗi trang trước khi tìm lớp
  await progress.getByLabel('Số dòng mỗi trang', { exact: true }).selectOption('200');
  await expect(progress.getByRole('row').filter({ hasText: classNames.first })).toContainText('33,3');

  await openMenu(page, '/learning-accounts');
  const accounts = await search(page, 'Tài khoản học và thi của học sinh');
  await accounts.getByLabel(`Chọn ${names.chi}`).check();
  await accounts.getByRole('button', { name: 'Khởi tạo tài khoản' }).click();
  const issued = page.getByRole('dialog').filter({ hasText: 'Tài khoản vừa khởi tạo' });
  await expect(issued).toContainText('Mật khẩu chỉ hiện một lần');
  await expect(issued.getByRole('table', { name: 'Tài khoản vừa tạo' })).toContainText(names.chi);
  await issued.getByRole('button', { name: 'Hủy' }).click();
  await expect(accounts.getByRole('row').filter({ hasText: names.chi })).toContainText('Đã khởi tạo');
});

test('CT-16g-17: 4.2 chuyển lớp hàng loạt, đề nghị chuyển đi rồi từ chối; 4.1.2 công cụ nhập học sinh 82 cột', async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page, '/student-movements');
  await page.getByRole('button', { name: 'Chuyển lớp hàng loạt' }).click();
  const bulk = page.getByRole('dialog').filter({ hasText: 'Chuyển lớp hàng loạt' });
  await bulk.getByRole('combobox', { name: 'Lớp hiện tại', exact: true }).selectOption(classIds[0] ?? '');
  await bulk.getByLabel(`Lớp mới của ${names.an}`).selectOption({ label: classNames.second });
  await bulk.getByLabel('Lý do').fill('Cân đối sĩ số');
  await bulk.getByRole('button', { name: 'Chuyển lớp' }).click();
  await expect(page.getByText('Đã chuyển lớp cho 1 học sinh')).toBeVisible();

  await page.getByRole('button', { name: 'Đề nghị chuyển đi' }).click();
  const request = page.getByRole('dialog').filter({ hasText: 'Đề nghị chuyển đi' });
  await request.getByLabel('Tìm học sinh theo họ tên').fill(token);
  await request.getByRole('combobox', { name: 'Học sinh', exact: true }).selectOption({ index: 1 });
  await request.getByLabel('Trường chuyển đến').fill('Trường Mầm non Hoa Sen');
  await request.getByLabel('Tỉnh/Thành phố chuyển đến').fill('Thành phố Hồ Chí Minh');
  await request.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã lập đề nghị chuyển đi, chờ duyệt')).toBeVisible();
  const transfers = page.getByRole('region', { name: 'Danh sách chuyển trường' });
  const row = transfers.getByRole('row').filter({ hasText: 'Trường Mầm non Hoa Sen' }).filter({ hasText: token });
  await expect(row).toContainText('Chờ duyệt');
  await row.getByRole('button', { name: 'Từ chối' }).click();
  const reject = page.getByRole('dialog').filter({ hasText: 'Từ chối chuyển đi' });
  await reject.getByLabel('Lý do từ chối').fill('Phụ huynh rút đề nghị');
  await reject.getByRole('button', { name: 'Từ chối' }).click();
  await expect(row).toContainText('Từ chối');

  await openMenu(page, '/student-imports');
  await expect(page.getByRole('heading', { name: '4.1.2. Nhập học sinh từ Excel', exact: true })).toBeVisible();
  const moet = page.getByRole('region', { name: 'Trẻ từ CSDL ngành' });
  await moet.getByRole('button', { name: 'Tra cứu danh mục' }).click();
  const lookup = moet.getByRole('region', { name: 'Tra cứu danh mục' });
  await lookup.getByRole('combobox', { name: 'Danh mục', exact: true }).selectOption({ label: 'Dân tộc' });
  await lookup.getByLabel('Tìm mã, tên').fill('Tày');
  await expect(lookup.getByRole('table')).toContainText('Tày');
  const downloading = page.waitForEvent('download');
  await moet.getByRole('button', { name: 'Tải file mẫu', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('mau-nhap-hoc-sinh-82-cot.xlsx');
});

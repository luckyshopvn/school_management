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
import { expectNoMenuLink, openMenu } from './menu.js';
import { clickGridMoreItem } from './grid.js';

// Học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108): 4.1.1 lưới học sinh có cột, bộ lọc, sắp xếp A–Z, cập nhật
// hàng loạt, xuất Excel; hồ sơ theo khối có nút Ghi, điện thoại nhận tin, thẻ thông tin riêng của trường; 4.2 biến động
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
// Mã chung trong họ tên để lọc đúng học sinh của lần chạy; tên (từ cuối) khác nhau để kiểm tra sắp xếp
const token = `Sở${suffix}`;
const names = { an: `Trần ${token} An`, anh: `Bùi ${token} Ánh`, bao: `Lê ${token} Bảo` };
const classNames = { first: `Lớp Sở ${suffix}`, second: `Lớp Sở B ${suffix}` };
let orgUnitId = '';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  orgUnitId = reference.org_unit_id;
  const classIds: string[] = [];
  for (const [code, name] of [
    [`SO-${suffix}`, classNames.first],
    [`SOB-${suffix}`, classNames.second],
  ] as const) {
    classIds.push(
      (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: orgUnitId,
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
  for (const [index, fullName] of [names.bao, names.an, names.anh].entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: orgUnitId,
        full_name: fullName,
        dob: '2022-06-01',
        gender: index === 0 ? 'male' : 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: `${3000 + index}`,
        photo_consent: 'pending',
        status: 'active',
        enroll_date: '2026-01-01',
        birth_certificate_file_id: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classIds[0] ?? '', from_date: '2026-01-01' })
      .execute();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({
        full_name: `Mẹ ${fullName}`,
        phone: `07${String(suffix * 10 + index)
          .padStart(8, '0')
          .slice(-8)}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
      .execute();
  }
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(page: Page, roleCode: string, unit: string | null) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: unit }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function openStudents(page: Page) {
  await openMenu(page, '/children');
  await expect(page.getByRole('heading', { name: '4.1.1. Quản lý hồ sơ học sinh', exact: true })).toBeVisible();
  await page.getByLabel('Tìm theo họ tên').fill(token);
  const grid = page.getByRole('region', { name: 'Danh sách học sinh' });
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(3);
  return grid;
}

test('CT-15c-12: lưới học sinh theo Sở: cột, A–Z, cấu hình cột, cập nhật hàng loạt, mở rộng tìm kiếm, xuất Excel', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openStudents(page);
  const headers = grid.getByRole('columnheader');
  for (const header of ['Mã định danh Bộ GD&ĐT', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Dân tộc', 'Trạng thái']) {
    await expect(headers.filter({ hasText: header }).first()).toBeVisible();
  }
  await expect(headers.filter({ hasText: 'Số điện thoại liên hệ' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Điện thoại nhận tin' })).toHaveCount(0);
  // Sắp xếp theo tên rồi theo họ: An, Ánh, Bảo
  const rows = grid.getByRole('row').filter({ hasText: token });
  await expect(rows.nth(0)).toContainText(names.an);
  await expect(rows.nth(1)).toContainText(names.anh);
  await expect(rows.nth(2)).toContainText(names.bao);
  await expect(rows.nth(0)).toContainText('01/06/2022');

  // Bật cột Điện thoại nhận tin, Học 2 buổi/ngày
  await clickGridMoreItem(grid, 'Cấu hình cột hiển thị');
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await dialog.getByRole('checkbox', { name: 'Điện thoại nhận tin', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Học 2 buổi/ngày', exact: true }).check();
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(headers.filter({ hasText: 'Học 2 buổi/ngày' })).toBeVisible();

  // Chọn hai học sinh, cập nhật hàng loạt học 2 buổi/ngày
  await grid.getByLabel(`Chọn ${names.an}`).check();
  await grid.getByLabel(`Chọn ${names.bao}`).check();
  await expect(grid).toContainText('Đã chọn 2 dòng');
  await grid.getByRole('button', { name: 'Cập nhật hàng loạt' }).click();
  const bulk = page.getByRole('dialog').filter({ hasText: 'Cập nhật hàng loạt' });
  await bulk.getByLabel('Học 2 buổi/ngày').selectOption({ label: 'Có' });
  await bulk.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã cập nhật 2 học sinh')).toBeVisible();
  await expect(grid.getByRole('row').filter({ hasText: names.an })).toContainText('Có');

  // Mở rộng tìm kiếm: học 2 buổi/ngày
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await grid.getByRole('combobox', { name: /^Học 2 buổi\/ngày/ }).selectOption({ label: 'Có' });
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(2);
  await expect(grid.getByRole('row').filter({ hasText: names.anh })).toHaveCount(0);

  // Xuất Excel đúng các cột đang hiện, theo bộ lọc đang chọn
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^danh-sach-hoc-sinh-.*\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const sheet = workbook.worksheets[0];
  const header = Array.from((sheet?.getRow(1).values as unknown[]).slice(1), (value) => String(value ?? ''));
  expect(header).toContain('Điện thoại nhận tin');
  expect(header).toContain('Học 2 buổi/ngày');
  expect(header.slice(0, 3)).toEqual(['STT', 'Mã định danh Bộ GD&ĐT', 'Họ tên']);
  expect(sheet?.rowCount).toBe(3);
  expect(String(sheet?.getRow(2).getCell(3).value)).toBe(names.an);
});

test('CT-15c-13: hồ sơ theo khối có nút Ghi; điện thoại nhận tin; sửa thông tin định danh cần lý do; thẻ thông tin riêng', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openStudents(page);
  await grid.getByRole('row').filter({ hasText: names.anh }).getByRole('button', { name: 'Hồ sơ' }).click();
  const profile = page.getByRole('region', { name: `Hồ sơ ${names.anh}` });
  await expect(profile.getByRole('tab', { name: 'Hồ sơ học sinh' })).toHaveAttribute('aria-selected', 'true');
  const form = profile.getByRole('form', { name: 'Hồ sơ học sinh theo Sở' });
  for (const block of ['Thông tin chung', 'Địa chỉ', 'Thông tin khác', 'Thông tin gia đình']) {
    await expect(form.getByRole('group', { name: block })).toBeVisible();
  }
  await expect(profile).toContainText('Thiếu giấy khai sinh');

  // Điện thoại nhận tin chọn từ số của phụ huynh
  await form.getByLabel('Điện thoại nhận tin').selectOption({ index: 1 });
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi hồ sơ học sinh')).toBeVisible();
  const phone = await form.getByLabel('Điện thoại nhận tin').locator('option:checked').textContent();
  await clickGridMoreItem(grid, 'Cấu hình cột hiển thị');
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await dialog.getByRole('checkbox', { name: 'Điện thoại nhận tin', exact: true }).check();
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(grid.getByRole('row').filter({ hasText: names.anh }).first()).toContainText(
    (phone ?? '').split(' ')[0] ?? '',
  );

  // Học sinh đang học: sửa chỗ ở cần lý do
  await form.getByLabel('Chỗ ở hiện nay').fill('Phường Thử Nghiệm');
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(form).toContainText('cần nhập lý do');
  await form.getByLabel('Lý do sửa thông tin định danh').fill('Gia đình chuyển nhà');
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi hồ sơ học sinh')).toBeVisible();
  await expect(form.getByLabel('Chỗ ở hiện nay')).toHaveValue('Phường Thử Nghiệm');

  // Thẻ thông tin riêng của trường
  await profile.getByRole('tab', { name: 'Thông tin riêng của trường' }).click();
  const school = profile.getByRole('tabpanel', { name: 'Thông tin riêng của trường' });
  await expect(school).toContainText('Lịch sử lớp');
  await expect(school).toContainText(classNames.first);
  await expect(form).toBeHidden();
});

test('CT-15c-14: chuyển lớp hiện ở 4.2 Biến động học sinh; lọc theo loại; xuất Excel; giáo viên không có mục 4.2', async ({
  page,
  browser,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openStudents(page);
  await grid.getByRole('row').filter({ hasText: names.bao }).getByRole('button', { name: 'Hồ sơ' }).click();
  const profile = page.getByRole('region', { name: `Hồ sơ ${names.bao}` });
  await profile.getByLabel('Lý do chuyển lớp').fill('Cân đối sĩ số');
  await profile.getByRole('combobox', { name: /^Lớp đích/ }).selectOption({ label: `${classNames.second} (0/30)` });
  await profile.getByRole('button', { name: 'Chuyển lớp' }).click();
  await expect(page.getByText('Đã chuyển lớp')).toBeVisible();

  await openMenu(page, '/student-movements');
  await expect(page.getByRole('heading', { name: '4.2. Biến động học sinh', exact: true })).toBeVisible();
  const movements = page.getByRole('region', { name: 'Danh sách biến động học sinh' });
  // Trang có thêm lưới chuyển trường (DT-16 phần 16g) nên tìm trong lưới biến động
  await movements.getByLabel('Tìm theo họ tên').fill(token);
  const transfer = movements.getByRole('row').filter({ hasText: 'Chuyển lớp' });
  await expect(transfer).toHaveCount(1);
  await expect(transfer).toContainText(names.bao);
  await expect(transfer).toContainText(classNames.first);
  await expect(transfer).toContainText(classNames.second);
  await expect(transfer).toContainText('Cân đối sĩ số');

  await movements.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await movements.getByRole('combobox', { name: /^Loại biến động/ }).selectOption({ label: 'Chuyển lớp' });
  await expect(movements.getByRole('row').filter({ hasText: token })).toHaveCount(1);

  const downloading = page.waitForEvent('download');
  await movements.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^bien-dong-hoc-sinh-.*\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(String(workbook.worksheets[0]?.getRow(2).getCell(3).value)).toBe('Chuyển lớp');

  const teacher = await (await browser.newContext()).newPage();
  await signIn(teacher, 'VT-07', orgUnitId);
  await expectNoMenuLink(teacher, '/student-movements');
});

import { expect, test, type Page } from '@playwright/test';
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

// Nhân sự theo hệ thống của Sở (DT-15 phần 15d, YCTD-112): 3.1.1 lưới cán bộ, giáo viên có cột của Sở, A–Z, mở rộng tìm
// kiếm, xuất Excel; hồ sơ theo khối của Sở có nút Ghi, thẻ thông tin riêng của trường; cột và hợp đồng theo quyền (BR-46)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const suffix = Date.now() % 1_000_000;
// Mã chung trong họ tên để lọc đúng nhân sự của lần chạy; tên (từ cuối) khác nhau để kiểm tra sắp xếp
const token = `NS${suffix}`;
const names = { an: `Trần ${token} An`, anh: `Bùi ${token} Ánh`, bao: `Lê ${token} Bảo` };
let orgUnitId = '';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  orgUnitId = unit.id;
  for (const [index, fullName] of [names.bao, names.an, names.anh].entries()) {
    const created = await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: orgUnitId,
        code: `${token}-${index}`,
        full_name: fullName,
        gender: index === 0 ? 'male' : 'female',
        dob: `198${index}-03-15`,
        start_date: '2025-08-01',
        // Một nhân sự có thông tin theo CSDL ngành (YCTD-100)
        moet_profile:
          fullName === names.anh
            ? JSON.stringify({
                ethnicity: 'Tày',
                job_position: 'Giáo viên mẫu giáo',
                professional_qualification: 'Đại học',
                party_member: true,
              })
            : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (fullName === names.bao) {
      await schoolYear
        .insertInto('employment_contracts')
        .values({
          staff_id: created.id,
          contract_no: `HD-${token}`,
          contract_type: 'indefinite',
          start_date: '2025-08-01',
          end_date: null,
          base_salary: 8_500_000,
          allowances: JSON.stringify([]),
        })
        .execute();
    }
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

async function openStaff(page: Page) {
  await openMenu(page, '/staff');
  await expect(page.getByRole('heading', { name: '3.1.1. Hồ sơ cán bộ, giáo viên', exact: true })).toBeVisible();
  await page.getByLabel('Tìm theo tên hoặc mã').fill(token);
  const grid = page.getByRole('region', { name: 'Danh sách nhân sự' });
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(3);
  return grid;
}

test('CT-15d-10: lưới cán bộ, giáo viên theo Sở: cột, A–Z, mở rộng tìm kiếm Đảng viên, xuất Excel', async ({
  page,
}) => {
  await signIn(page, 'VT-02', null);
  const grid = await openStaff(page);
  const headers = grid.getByRole('columnheader');
  for (const header of [
    'Mã định danh Bộ GD&ĐT',
    'Họ tên',
    'Ngày sinh',
    'Giới tính',
    'Trạng thái',
    'Dân tộc',
    'Điện thoại',
    'Vị trí việc làm',
    'Nhóm chức vụ',
    'Hình thức hợp đồng',
    'Trình độ chuyên môn',
  ]) {
    await expect(headers.filter({ hasText: header }).first()).toBeVisible();
  }
  await expect(headers.filter({ hasText: 'Lương thỏa thuận' })).toHaveCount(0);
  // Sắp xếp theo tên rồi theo họ: An, Ánh, Bảo
  const rows = grid.getByRole('row').filter({ hasText: token });
  await expect(rows.nth(0)).toContainText(names.an);
  await expect(rows.nth(1)).toContainText(names.anh);
  await expect(rows.nth(2)).toContainText(names.bao);
  await expect(rows.nth(1)).toContainText('Giáo viên mẫu giáo');
  await expect(rows.nth(1)).toContainText('Tày');
  await expect(rows.nth(2)).toContainText('Không thời hạn');

  // Mở rộng tìm kiếm: Đảng viên
  await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await grid.getByRole('combobox', { name: /^Đảng viên/ }).selectOption({ label: 'Có' });
  await expect(grid.getByRole('row').filter({ hasText: token })).toHaveCount(1);
  await expect(grid.getByRole('row').filter({ hasText: names.anh })).toHaveCount(1);

  // Xuất Excel đúng các cột đang hiện, theo bộ lọc đang chọn
  const downloading = page.waitForEvent('download');
  await grid.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^danh-sach-can-bo-giao-vien-.*\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const sheet = workbook.worksheets[0];
  const header = Array.from((sheet?.getRow(1).values as unknown[]).slice(1), (value) => String(value ?? ''));
  expect(header.slice(0, 4)).toEqual(['STT', 'Mã định danh Bộ GD&ĐT', 'Mã nhân sự', 'Họ tên']);
  expect(header).toContain('Trình độ chuyên môn');
  expect(sheet?.rowCount).toBe(2);
  expect(String(sheet?.getRow(2).getCell(4).value)).toBe(names.anh);
});

test('CT-15d-11: phòng nhân sự ghi hồ sơ theo khối của Sở; lưới đổi theo; thẻ thông tin riêng có hợp đồng và lương', async ({
  page,
}) => {
  await signIn(page, 'VT-06', orgUnitId);
  const grid = await openStaff(page);
  await grid.getByRole('row').filter({ hasText: names.an }).getByRole('button', { name: 'Hồ sơ' }).click();
  const panel = page.getByRole('group', { name: `Hồ sơ của ${names.an}` });
  await expect(panel.getByRole('tab', { name: 'Hồ sơ cán bộ, giáo viên' })).toHaveAttribute('aria-selected', 'true');
  const form = panel.getByRole('form', { name: 'Hồ sơ cán bộ, giáo viên theo Sở' });
  for (const block of ['Thông tin chung', 'Địa chỉ', 'Đoàn, Đảng', 'Tuyển dụng, công tác', 'Trình độ']) {
    await expect(form.getByRole('group', { name: block })).toBeVisible();
  }
  await form.getByLabel('Dân tộc').fill('Kinh');
  await form.getByLabel('Là Đảng viên').check();
  await form.getByLabel('Vị trí việc làm').fill('Giáo viên nhà trẻ');
  await form.getByLabel('Ngày tuyển dụng').fill('2015-09-01');
  await form.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi hồ sơ cán bộ, giáo viên')).toBeVisible();
  const row = grid.getByRole('row').filter({ hasText: names.an }).first();
  await expect(row).toContainText('Giáo viên nhà trẻ');
  await expect(row).toContainText('Kinh');
  await expect(form.getByLabel('Ngày tuyển dụng')).toHaveValue('2015-09-01');

  // Thẻ thông tin riêng của trường
  await panel.getByRole('tab', { name: 'Thông tin riêng của trường' }).click();
  const school = panel.getByRole('tabpanel', { name: 'Thông tin riêng của trường' });
  await expect(school.getByRole('form', { name: 'Thông tin riêng của trường' })).toBeVisible();
  await expect(school.getByLabel('Mã nhân sự')).toHaveValue(`${token}-1`);
  await expect(school).toContainText('Hợp đồng lao động');
  await expect(form).toBeHidden();

  // Hợp đồng và lương thỏa thuận của nhân sự có hợp đồng
  await grid.getByRole('row').filter({ hasText: names.bao }).getByRole('button', { name: 'Hồ sơ' }).click();
  const baoPanel = page.getByRole('group', { name: `Hồ sơ của ${names.bao}` });
  await baoPanel.getByRole('tab', { name: 'Thông tin riêng của trường' }).click();
  await expect(baoPanel).toContainText(`HD-${token}`);
  await expect(baoPanel).toContainText('8.500.000');
});

test('CT-15d-12: quản lý đơn vị xem được lưới và hồ sơ nhưng không thấy hợp đồng, lương; không có Thêm mới, Xuất Excel, Ghi', async ({
  page,
}) => {
  await signIn(page, 'VT-03', orgUnitId);
  const grid = await openStaff(page);
  await expect(grid.getByRole('button', { name: 'Thêm mới' })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: 'Xuất Excel' })).toHaveCount(0);
  const row = grid.getByRole('row').filter({ hasText: names.bao });
  await expect(row).not.toContainText('Không thời hạn');
  await grid.getByRole('button', { name: 'Cấu hình cột hiển thị' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cột hiển thị' });
  await expect(dialog.getByRole('checkbox', { name: 'Phòng ban', exact: true })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Lương thỏa thuận', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Hủy' }).click();

  await row.getByRole('button', { name: 'Hồ sơ' }).click();
  const panel = page.getByRole('group', { name: `Hồ sơ của ${names.bao}` });
  await expect(panel.getByRole('form', { name: 'Hồ sơ cán bộ, giáo viên theo Sở' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Ghi', exact: true })).toHaveCount(0);
  await panel.getByRole('tab', { name: 'Thông tin riêng của trường' }).click();
  await expect(panel.getByRole('tabpanel', { name: 'Thông tin riêng của trường' })).toBeVisible();
  await expect(panel).not.toContainText('Hợp đồng lao động');
  await expect(panel).not.toContainText(`HD-${token}`);
});

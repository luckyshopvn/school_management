import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// DT-19 phần 19b (YCTD-152): cấu trúc theo cấp học. Hiệu trưởng nạp khối mẫu Tiểu học, thêm cấp Tiểu học cho Trường chính,
// mở lớp khối 1 (không có nhóm tuổi, ghép độ tuổi), xem lịch của cấp Tiểu học đang theo lịch chung. Dữ liệu Tiểu học xóa ở
// cuối để các spec khác vẫn chạy trên trường chỉ có Mầm non
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(readConnectionString('system'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
let rootId = '';
const suffix = Date.now() % 1_000_000;
const className = `Lớp 1A ${suffix}`;
const TEMPLATE_CODES = ['K1', 'K2', 'K3', 'K4', 'K5'];

async function loginAsPrincipal(page: Page) {
  const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  rootId = (
    await schoolYear
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirstOrThrow()
  ).id;
});

test.afterAll(async () => {
  await schoolYear.deleteFrom('classes').where('name', '=', className).execute();
  await schoolYear.deleteFrom('grade_levels').where('code', 'in', TEMPLATE_CODES).execute();
  await schoolYear.deleteFrom('org_unit_levels').where('school_level', '!=', 'MN').execute();
  for (const table of ['school_weeks', 'academic_terms', 'academic_year_level_settings'] as const) {
    await system.deleteFrom(table).where('school_level', 'is not', null).execute();
  }
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

test('Hiệu trưởng nạp khối Tiểu học, thêm cấp cho Trường chính, mở lớp khối 1 và xem lịch của cấp', async ({
  page,
}) => {
  await loginAsPrincipal(page);

  // Danh mục bậc học: nạp khối mẫu Tiểu học; chương trình mặc định Mầm non đã có sẵn
  await openMenu(page, '/rooms');
  await page.getByRole('tab', { name: 'Bậc học' }).click();
  const loader = page.getByRole('group', { name: 'Nạp khối mẫu theo cấp' });
  await loader.getByLabel('Cấp học của khối mẫu').selectOption({ label: 'Tiểu học' });
  await loader.getByRole('button', { name: 'Nạp khối mẫu' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã nạp 5 khối mẫu Tiểu học' })).toBeVisible();
  const gradeLevels = page.getByRole('region', { name: 'Bậc học', exact: true });
  await expect(gradeLevels.getByRole('row').filter({ hasText: 'Khối 1' })).toContainText('Tiểu học');
  await page.getByRole('tab', { name: 'Chương trình' }).click();
  const curricula = page.getByRole('region', { name: 'Chương trình', exact: true });
  await expect(curricula.getByRole('row').filter({ hasText: 'CT-GDMN' })).toContainText('Mầm non');

  // Cấp học của đơn vị hiện khi trường có khối ngoài Mầm non; Trường chính thêm Tiểu học
  await openMenu(page, '/org-units');
  const levels = page.getByRole('region', { name: 'Cấp học của đơn vị' });
  const rootRow = levels.getByRole('row').nth(1);
  await rootRow.getByRole('checkbox', { name: /: Tiểu học$/ }).check();
  await rootRow.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu cấp học của' })).toBeVisible();

  // Lớp khối 1 lấy cấp Tiểu học, không có nhóm tuổi, học 2 buổi/ngày, ghép độ tuổi, lớp ghép
  await openMenu(page, '/classes');
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm mới lớp học' });
  await form.getByLabel('Đơn vị').selectOption(rootId);
  await form.getByLabel('Mã lớp').fill(`1A${suffix}`);
  await form.getByLabel('Tên lớp').fill(className);
  await form.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 1' });
  await expect(form.getByText('Tiểu học', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Nhóm tuổi')).toHaveCount(0);
  await expect(form.getByLabel('Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi')).toHaveCount(0);
  await expect(form.getByLabel('Lớp bán trú')).toBeVisible();
  await form.getByLabel('Sĩ số tối đa').fill('35');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã tạo lớp ${className}` })).toBeVisible();
  const created = await schoolYear
    .selectFrom('classes')
    .select(['school_level', 'age_group'])
    .where('name', '=', className)
    .executeTakeFirstOrThrow();
  expect(created).toEqual({ school_level: 'TH', age_group: null });

  // Lịch năm học: cấp Tiểu học chưa khai báo riêng thì theo lịch chung
  await openMenu(page, '/academic-years');
  await page
    .getByRole('region', { name: 'Danh sách năm học' })
    .getByRole('row')
    .filter({ hasText: 'Đang dùng' })
    .click();
  await page.getByLabel('Lịch của cấp').selectOption({ label: 'Tiểu học' });
  await expect(page.getByRole('status').filter({ hasText: 'Cấp Tiểu học đang theo lịch chung' })).toBeVisible();
});

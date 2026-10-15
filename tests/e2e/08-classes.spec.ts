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

// MH-03 2.1. Hồ sơ lớp học và phân công giáo viên (P02-05, YCTD-44; lưới, biểu mẫu theo Sở YCTD-111). Chạy sau
// 03-org-units và 06-catalogs, khi đã có đơn vị và bậc học.
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await database.destroy();
});

// Mã của Phân hiệu A đọc từ cơ sở dữ liệu năm học của kiểm thử giao diện để tạo tài khoản giáo viên thuộc đơn vị đó
async function findUnitId(name: string): Promise<string> {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  if (!databaseName) {
    throw new Error('Chưa có cơ sở dữ liệu năm học của kiểm thử giao diện');
  }
  const schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName));
  try {
    const unit = await schoolYear
      .selectFrom('org_units')
      .select('id')
      .where('name', '=', name)
      .executeTakeFirstOrThrow();
    return unit.id;
  } finally {
    await schoolYear.destroy();
  }
}

async function loginWithRole(page: Page, roleCode: string, orgUnitId: string | null) {
  const user = await createTestUser(database, { roles: [{ roleCode, orgUnitId }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('Quản lý đơn vị tạo lớp của Phân hiệu A, phân công giáo viên chủ nhiệm, giải thể và mở lại lớp', async ({
  page,
}) => {
  const unitId = await findUnitId('Phân hiệu A');
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
  const teacherName = (
    await database.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;

  await loginWithRole(page, 'VT-03', unitId);
  await openMenu(page, '/classes');
  await expect(page.getByRole('heading', { name: '2.1. Hồ sơ lớp học', exact: true })).toBeVisible();

  // Biểu mẫu theo khối của Sở, nút Ghi (YCTD-111); đơn vị mặc định là đơn vị của người dùng
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm mới lớp học' });
  await expect(form.getByLabel('Đơn vị')).toHaveValue(unitId);
  await form.getByLabel('Mã lớp').fill('MAM1');
  await form.getByLabel('Tên lớp').fill('Mầm 1');
  await form.getByLabel('Khối').selectOption({ label: 'Mầm' });
  await form.getByLabel('Sĩ số tối đa').fill('25');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo lớp Mầm 1' })).toBeVisible();
  const grid = page.getByRole('region', { name: 'Danh sách lớp' });
  const row = grid.getByRole('row', { name: 'Lớp Mầm 1', exact: true });
  await expect(row).toContainText('0/25');
  await expect(row).toContainText('Phân hiệu A');

  await row.getByRole('button', { name: 'Giáo viên' }).click();
  const staff = page.getByRole('region', { name: 'Giáo viên lớp Mầm 1' });
  await staff.getByRole('combobox', { name: /^Giáo viên/ }).selectOption({ label: teacherName });
  await staff.getByRole('button', { name: 'Phân công' }).click();
  await expect(staff).toContainText(teacherName);
  await expect(row).toContainText(teacherName);

  await row.getByRole('button', { name: 'Giải thể lớp' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Giải thể lớp' }).click();
  await expect(row.getByRole('button', { name: 'Mở lại' })).toBeVisible();
  await row.getByRole('button', { name: 'Mở lại' }).click();
  await expect(row.getByRole('button', { name: 'Giải thể lớp' })).toBeVisible();
});

test('Giáo viên xem được danh sách lớp nhưng không thêm, sửa được lớp', async ({ page }) => {
  const unitId = await findUnitId('Phân hiệu A');
  await loginWithRole(page, 'VT-07', unitId);
  await openMenu(page, '/classes');
  await expect(page.getByRole('row', { name: 'Lớp Mầm 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm mới' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sửa' })).toHaveCount(0);
});

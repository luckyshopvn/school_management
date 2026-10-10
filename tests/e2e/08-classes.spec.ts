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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// MH-03 Lớp học và phân công giáo viên (P02-05, YCTD-44). Chạy sau 03-org-units và 06-catalogs, khi đã có đơn vị và bậc học.
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

test('Quản lý đơn vị tạo lớp của Phân hiệu A, phân công giáo viên chủ nhiệm, đóng và mở lại lớp', async ({ page }) => {
  const unitId = await findUnitId('Phân hiệu A');
  const teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
  const teacherName = (
    await database.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;

  await loginWithRole(page, 'VT-03', unitId);
  await page.getByRole('link', { name: 'Lớp học' }).click();
  await expect(page.getByLabel('Đơn vị', { exact: true })).toHaveValue(unitId);

  const form = page.getByRole('region', { name: 'Tạo lớp' });
  await form.getByLabel('Mã lớp').fill('MAM1');
  await form.getByLabel('Tên lớp').fill('Mầm 1');
  await form.getByLabel('Bậc học').selectOption({ label: 'Mầm' });
  await form.getByLabel('Sĩ số tối đa').fill('25');
  await form.getByRole('button', { name: 'Tạo lớp' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Mầm 1' });
  await expect(row).toContainText('25');
  await expect(row).toContainText('Đang dùng');

  await row.getByRole('button', { name: 'Giáo viên' }).click();
  const staff = page.getByRole('region', { name: 'Giáo viên lớp Mầm 1' });
  await staff.getByRole('combobox', { name: /^Giáo viên/ }).selectOption({ label: teacherName });
  await staff.getByRole('button', { name: 'Phân công' }).click();
  await expect(staff).toContainText(teacherName);
  await expect(row).toContainText(teacherName);

  await row.getByRole('button', { name: 'Đóng lớp' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng lớp' }).click();
  await expect(row).toContainText('Đã đóng');
  await row.getByRole('button', { name: 'Mở lại' }).click();
  await expect(row).toContainText('Đang dùng');
});

test('Giáo viên xem được danh sách lớp nhưng không có biểu mẫu tạo lớp', async ({ page }) => {
  const unitId = await findUnitId('Phân hiệu A');
  await loginWithRole(page, 'VT-07', unitId);
  await page.getByRole('link', { name: 'Lớp học' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Mầm 1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tạo lớp' })).toHaveCount(0);
});

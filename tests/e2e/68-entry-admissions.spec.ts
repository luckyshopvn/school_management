import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures.js';
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

// Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c, YCTD-134): Hiệu trưởng mở 1.1 Hồ sơ học sinh cuối cấp, cập nhật nơi ở của trẻ
// lớp năm cuối cấp, bấm "Đã chỉnh sửa thông tin", "Xác nhận hồ sơ", xuất PDF A5 hồ sơ chọn; 1.2 tích xác nhận hoàn thành
// của lớp và Ghi. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
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

test('CT-17c-13: 1.1 cập nhật, đánh dấu đã chỉnh sửa, xác nhận, xuất PDF A5; 1.2 xác nhận hoàn thành theo lớp', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const gradeCode = `TSDC${suffix}`;
  const className = `Lớp Lá ${suffix}`;
  const childName = `Trẻ Cuối Cấp ${suffix}`;
  await schoolYear
    .insertInto('grade_levels')
    .values({ code: gradeCode, name: `Lá ${suffix}`, age_from_months: 60, age_to_months: 71, created_by: null })
    .execute();
  const createdClass = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `LA-${suffix}`,
      name: className,
      grade_level: gradeCode,
      max_size: 30,
      created_by: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2020-05-05',
      gender: 'female',
      national_id_encrypted: 'e2e',
      national_id_hash: `e2e-${randomUUID()}`,
      national_id_last4: '4321',
      status: 'active',
      photo_consent: 'pending',
      created_by: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({
      child_id: child.id,
      class_id: createdClass.id,
      from_date: '2026-09-05',
      is_current: true,
      created_by: null,
    })
    .execute();

  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await openMenu(page, '/entry-admissions/final-year');
  await expect(page.getByRole('heading', { name: '1.1. Hồ sơ học sinh cuối cấp mầm non' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: childName });
  await expect(row).toContainText('PHHS chưa xác nhận');
  await expect(row).toContainText('Thiếu giấy khai sinh');
  await expect(row).toContainText('********4321');

  await row.getByRole('button', { name: 'Cập nhật' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nơi ở hiện tại (nhập theo VNeID)').fill('Số 1 Đường Kiểm Thử');
  await dialog.getByLabel('Phường/Xã').fill('Phường Kiểm Thử');
  await dialog.getByLabel('Thành phố (Tỉnh)').fill('TP. Hồ Chí Minh');
  await dialog.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã cập nhật hồ sơ của ${childName}` })).toBeVisible();
  await expect(row).toContainText('Phường Kiểm Thử');

  await page.getByLabel(`Chọn ${childName}`).check();
  await page.getByRole('button', { name: 'Đã chỉnh sửa thông tin' }).click();
  await expect(row).toContainText('Đã chỉnh sửa');
  await page.getByLabel(`Chọn ${childName}`).check();
  await page.getByRole('button', { name: 'Xác nhận hồ sơ' }).click();
  await expect(row).toContainText('PHHS đã xác nhận sau chỉnh sửa');

  await page.getByLabel(`Chọn ${childName}`).check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất PDF A5 hồ sơ chọn', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^ho-so-cuoi-cap-a5-.*\.pdf$/);

  await openMenu(page, '/entry-admissions/completion');
  await expect(
    page.getByRole('heading', { name: '1.2. Gửi xác nhận hoàn thành hồ sơ cuối cấp lên cấp trên' }),
  ).toBeVisible();
  const classRow = page.getByRole('row').filter({ hasText: className });
  await expect(classRow).toContainText('0/1');
  await page.getByLabel(`Xác nhận hoàn thành ${className}`).check();
  await page.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi xác nhận hoàn thành' })).toBeVisible();
  await expect(classRow).toContainText('Người kiểm thử');

  await openMenu(page, '/entry-admissions/support');
  await expect(page.getByRole('heading', { name: '5.1. Danh sách hỗ trợ tuyển sinh' })).toBeVisible();
});

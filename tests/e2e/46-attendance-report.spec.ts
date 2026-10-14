import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
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
import ExcelJS from 'exceljs';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Báo cáo điểm danh và suất ăn (DT-13 phần 13c, YCTD-100): Hiệu trưởng mở báo cáo, chuyển kỳ ngày, tuần, tháng, xuất
// Excel theo mẫu của nhà trường. Chạy sau 02-academic-years và 03-org-units (năm học đang mở, có đơn vị). Lớp và trẻ là
// dữ liệu giả của riêng kịch bản này
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const CLASS_NAME = 'Lớp thử điểm danh 46';

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

test('Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng và xuất Excel theo mẫu', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const year = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const classRecord = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: unit.id,
      academic_year_id: year.id,
      code: `DD46-${randomUUID().slice(0, 6)}`,
      name: CLASS_NAME,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: unit.id,
      full_name: 'Trẻ thử báo cáo 46',
      dob: '2022-05-20',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '0046',
      photo_consent: 'pending',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRecord.id, from_date: `${today.slice(0, 7)}-01` })
    .execute();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });

  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(page, '/reports');
  await page.getByRole('tab', { name: 'Điểm danh và suất ăn', exact: true }).click();
  await page.getByRole('button', { name: 'Xem báo cáo' }).click();
  const table = page.getByRole('region', { name: 'Điểm danh và suất ăn theo lớp' });
  await expect(table).toContainText(CLASS_NAME);
  await expect(table).toContainText('Toàn trường');

  await page.getByRole('button', { name: 'Ngày', exact: true }).click();
  await expect(page.getByLabel('Kỳ báo cáo đang xem')).toContainText(`Từ ${today} đến ${today}`);
  await page.getByRole('button', { name: 'Tuần', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tuần', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toContainText(CLASS_NAME);
  await page.getByRole('button', { name: 'Tháng', exact: true }).click();
  await expect(page.getByLabel('Kỳ báo cáo đang xem')).toContainText(`Từ ${today.slice(0, 7)}-01`);

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`diem-danh-suat-an-thang-${today.slice(0, 7)}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const summary = workbook.getWorksheet('Tổng hợp tháng');
  expect(summary).toBeTruthy();
  expect(String(summary?.getCell('A3').value)).toBe(
    `BẢNG TỔNG HỢP ĐIỂM DANH THÁNG ${Number(today.slice(5, 7))} NĂM ${today.slice(0, 4)}`,
  );
  expect(workbook.getWorksheet(CLASS_NAME)).toBeTruthy();
});

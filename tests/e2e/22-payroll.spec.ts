import { expect, test } from '@playwright/test';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';

// Bảng lương toàn trường (DT-06 phần 6c-1, YCTD-60): kế toán tính bảng lương tháng này sau khi tháng trước đã chốt công
// (kiểm thử 21), trình duyệt; Hiệu trưởng duyệt; giáo viên thấy phiếu lương của mình
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(browser: import('@playwright/test').Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Kế toán tính và trình bảng lương; Hiệu trưởng duyệt; giáo viên và phòng nhân sự xem phiếu lương (CTC-P08-049)', async ({
  browser,
}) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: unit.id }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unit.id }] });
  const suffix = Date.now() % 1_000_000;
  const fullName = `Hà Minh Châu ${suffix}`;
  for (const [userId, name, code, salary] of [
    [teacher.id, fullName, `BL-${suffix}`, 10_000_000],
    [personnel.id, `Đỗ Thu Hằng ${suffix}`, `BLNS-${suffix}`, 9_000_000],
  ] as const) {
    const staff = await schoolYear
      .insertInto('staff')
      .values({ org_unit_id: unit.id, code, full_name: name, start_date: '2026-01-01', user_id: userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('employment_contracts')
      .values({
        staff_id: staff.id,
        contract_no: `HD${code}`,
        contract_type: 'indefinite',
        start_date: '2026-01-01',
        base_salary: salary,
      })
      .execute();
  }

  const page = await signIn(browser, accountant);
  await page.getByRole('link', { name: 'Bảng lương' }).click();
  await page.getByLabel('Tháng lương').fill(vietnamToday.slice(0, 7));
  await page.getByRole('button', { name: 'Tính bảng lương' }).click();
  const row = page.getByRole('row', { name: `Lương của ${fullName}` });
  await expect(row).toContainText('10.000.000');
  await page.getByRole('button', { name: 'Trình duyệt' }).click();
  await expect(page.getByText('Cần Hiệu trưởng duyệt')).toBeVisible();

  const principalPage = await signIn(browser, principal);
  await principalPage.getByRole('link', { name: 'Bảng lương' }).click();
  await principalPage.getByRole('button', { name: 'Duyệt bảng lương' }).click();
  await expect(principalPage.getByText('Trạng thái: Đã duyệt')).toBeVisible();

  const teacherPage = await signIn(browser, teacher);
  await teacherPage.getByRole('link', { name: 'Phiếu lương của tôi' }).click();
  const month = Number(vietnamToday.slice(5, 7));
  const slip = teacherPage.getByRole('region', { name: `Phiếu lương tháng ${month}/${vietnamToday.slice(0, 4)}` });
  await expect(slip).toContainText('10.000.000');
  await slip.getByRole('button', { name: 'Chi tiết' }).click();
  await expect(slip).toContainText('Lương hợp đồng');
  await expect(teacherPage.getByRole('link', { name: 'Bảng lương' })).toHaveCount(0);

  const slipTitle = `Phiếu lương tháng ${month}/${vietnamToday.slice(0, 4)}`;
  const personnelPage = await signIn(browser, personnel);
  await personnelPage.getByRole('link', { name: 'Phiếu lương của tôi' }).click();
  await expect(personnelPage.getByRole('region', { name: slipTitle })).toContainText('9.000.000');

  const teacherApp = await (await browser.newContext()).newPage();
  await teacherApp.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherApp.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherApp.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherApp.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherApp.getByRole('button', { name: 'Phiếu lương' }).click();
  await expect(teacherApp.getByRole('region', { name: slipTitle })).toContainText('10.000.000');
});

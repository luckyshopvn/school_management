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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// Đơn nghỉ phép và chốt bảng công (DT-06 phần 6b-2, YCTD-59): giáo viên gửi đơn nghỉ không lương, Phó Hiệu trưởng
// duyệt; phòng nhân sự chốt bảng công tháng trước
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const nextMonday = (() => {
  let time = Date.parse(`${vietnamToday}T00:00:00Z`) + 7 * 86_400_000;
  while (new Date(time).getUTCDay() !== 1) {
    time += 86_400_000;
  }
  return new Date(time).toISOString().slice(0, 10);
})();
const previousMonth = new Date(Date.parse(`${vietnamToday.slice(0, 7)}-01T00:00:00Z`) - 86_400_000)
  .toISOString()
  .slice(0, 7);

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

test('Giáo viên gửi đơn nghỉ, Phó Hiệu trưởng duyệt; phòng nhân sự chốt bảng công tháng trước', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const vicePrincipal = await createTestUser(identity, { roles: [{ roleCode: 'VT-15', orgUnitId: unit.id }] });
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unit.id }] });
  const suffix = Date.now() % 1_000_000;
  const fullName = `Võ Thị Ngọc ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code: `NP-${suffix}`,
      full_name: fullName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();
  const leaveTypeName = `Nghỉ không lương ${suffix}`;
  await schoolYear
    .insertInto('catalog_items')
    .values({
      catalog_type: 'leave_type',
      code: `KL-${suffix}`,
      name: leaveTypeName,
      attributes: JSON.stringify({ is_paid: false, deducts_annual_leave: false, insurance_paid: false }),
    })
    .execute();
  for (const [key, value] of [
    ['work_start_time', '07:30'],
    ['work_end_time', '17:00'],
  ] as const) {
    await schoolYear.deleteFrom('settings').where('org_unit_id', '=', unit.id).where('key', '=', key).execute();
    await schoolYear
      .insertInto('settings')
      .values({ org_unit_id: unit.id, key, value: JSON.stringify(value), value_type: 'time_of_day' })
      .execute();
  }

  const teacherPage = await signIn(browser, teacher);
  await teacherPage.getByRole('link', { name: 'Đơn nghỉ phép' }).click();
  const form = teacherPage.getByRole('form', { name: 'Gửi đơn nghỉ của tôi' });
  await form.getByLabel('Loại nghỉ').selectOption({ label: leaveTypeName });
  await form.getByLabel('Từ ngày').fill(nextMonday);
  await form.getByLabel('Lý do nghỉ').fill('Đưa con đi khám');
  await form.getByRole('button', { name: 'Gửi đơn nghỉ' }).click();
  const mine = teacherPage.getByRole('region', { name: 'Đơn nghỉ của tôi' });
  await expect(mine.getByRole('row', { name: `Đơn nghỉ của ${fullName} ${nextMonday}` })).toContainText('Chờ duyệt');

  const vicePage = await signIn(browser, vicePrincipal);
  await vicePage.getByRole('link', { name: 'Đơn nghỉ phép' }).click();
  const unitSection = vicePage.getByRole('region', { name: 'Đơn nghỉ của đơn vị' });
  await unitSection.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: unit.name });
  await unitSection.getByLabel('Trạng thái đơn').selectOption('');
  const row = unitSection.getByRole('row', { name: `Đơn nghỉ của ${fullName} ${nextMonday}` });
  await row.getByRole('button', { name: 'Duyệt' }).click();
  await expect(row).toContainText('Đã duyệt');

  const page = await signIn(browser, personnel);
  await page.getByRole('link', { name: 'Chấm công' }).click();
  await page.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: unit.name });
  await page.getByLabel('Tháng của bảng').fill(previousMonth);
  const period = page.getByRole('region', { name: 'Kỳ công' });
  await period.getByRole('button', { name: 'Chốt bảng công' }).click();
  await expect(period).toContainText('Đã chốt');
  await expect(period.getByRole('form', { name: 'Đề nghị mở lại bảng công' })).toBeVisible();
});

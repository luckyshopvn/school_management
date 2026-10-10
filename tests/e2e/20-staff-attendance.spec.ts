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

// Lịch ngày lễ, nghỉ bù và chấm công nhân sự (DT-06 phần 6b-1, YCTD-59): phòng nhân sự Trường chính lập ngày lễ, Hiệu
// trưởng lập ngày nghỉ bù; giáo viên tự vào ca; phòng nhân sự đơn vị nhập giờ trên bảng chấm công
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const futureWeekday = (weekday: number, skip: number) => {
  let time = Date.parse(`${vietnamToday}T00:00:00Z`) + skip * 86_400_000;
  while (new Date(time).getUTCDay() !== weekday) {
    time += 86_400_000;
  }
  return new Date(time).toISOString().slice(0, 10);
};

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

test('Phòng nhân sự Trường chính lập ngày lễ, Hiệu trưởng lập ngày nghỉ bù rồi xóa', async ({ browser }) => {
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: root.id }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  // Ngày xa trong tương lai để không đổi ngày học của các kiểm thử khác
  const holidayDate = futureWeekday(2, 400);
  const dayOffDate = futureWeekday(3, 400);

  const page = await signIn(browser, personnel);
  await page.getByRole('link', { name: 'Ngày lễ và lịch bù' }).click();
  await page.getByLabel('Năm').fill(holidayDate.slice(0, 4));
  const holidayForm = page.getByRole('form', { name: 'Thêm ngày nghỉ lễ' });
  await holidayForm.getByLabel('Ngày lễ', { exact: true }).fill(holidayDate);
  await holidayForm.getByLabel('Tên ngày lễ').fill('Ngày lễ kiểm thử');
  await holidayForm.getByRole('button', { name: 'Thêm ngày lễ' }).click();
  const holidayRow = page.getByRole('row', { name: `Ngày lễ ${holidayDate}` });
  await expect(holidayRow).toContainText('Ngày lễ kiểm thử');
  await expect(page.getByRole('form', { name: 'Thêm ngày học bù hoặc nghỉ bù' })).toHaveCount(0);

  const principalPage = await signIn(browser, principal);
  await principalPage.getByRole('link', { name: 'Ngày lễ và lịch bù' }).click();
  await principalPage.getByLabel('Năm').fill(dayOffDate.slice(0, 4));
  const changeForm = principalPage.getByRole('form', { name: 'Thêm ngày học bù hoặc nghỉ bù' });
  await changeForm.getByLabel('Loại lịch').selectOption('compensatory_day_off');
  await changeForm.getByLabel('Ngày áp dụng').fill(dayOffDate);
  await changeForm.getByRole('button', { name: 'Thêm lịch' }).click();
  const changeRow = principalPage.getByRole('row', { name: `Lịch ngày ${dayOffDate}` });
  await expect(changeRow).toContainText('Nghỉ bù');
  await changeRow.getByRole('button', { name: 'Xóa' }).click();
  await principalPage.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click();
  await expect(changeRow).toHaveCount(0);

  await holidayRow.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click();
  await expect(holidayRow).toHaveCount(0);
});

test('Giáo viên tự vào ca; phòng nhân sự đơn vị nhập giờ ra trên bảng chấm công', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unit.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const fullName = `Phạm Thu ${Date.now() % 100_000}`;
  const code = `CC-${Date.now() % 1_000_000}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code,
      full_name: fullName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();

  const teacherPage = await signIn(browser, teacher);
  await teacherPage.getByRole('link', { name: 'Chấm công' }).click();
  const mine = teacherPage.getByRole('region', { name: 'Chấm công của tôi' });
  await expect(mine).toContainText('chưa vào ca');
  await mine.getByRole('button', { name: 'Vào ca' }).click();
  await expect(mine).toContainText('chưa ra ca');
  await expect(mine.getByRole('button', { name: 'Vào ca' })).toBeDisabled();
  await expect(teacherPage.getByRole('region', { name: 'Bảng chấm công' })).toHaveCount(0);

  const page = await signIn(browser, personnel);
  await page.getByRole('link', { name: 'Chấm công' }).click();
  await page.getByRole('combobox', { name: /^Đơn vị/ }).selectOption({ label: unit.name });
  const form = page.getByRole('form', { name: 'Nhập giờ chấm công' });
  await form.getByLabel('Nhân sự').selectOption({ label: `${code} – ${fullName}` });
  await form.getByLabel('Ngày chấm công').fill(vietnamToday);
  await form.getByLabel('Giờ vào').fill('07:25');
  await form.getByLabel('Giờ ra').fill('23:59');
  await form.getByRole('button', { name: 'Lưu chấm công' }).click();
  const row = page.getByRole('row', { name: `Chấm công của ${fullName}` });
  await expect(row).toContainText('07:25');
  await expect(row).toContainText('23:59');
});

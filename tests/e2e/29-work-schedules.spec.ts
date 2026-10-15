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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Lịch nghỉ và lịch công tác (DT-09 phần 9c, YCTD-68): phòng nhân sự lập và công bố trên cổng quản trị; giáo viên xem trên
// ứng dụng giáo viên
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const nextMonth = new Date(Date.parse(`${vietnamToday.slice(0, 7)}-01T00:00:00Z`) + 32 * 86_400_000)
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

test('Phòng nhân sự lập và công bố lịch công tác; giáo viên thấy lịch của mình', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const personnel = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: unit.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const suffix = Date.now() % 1_000_000;
  const fullName = `Lê Công Tác ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code: `CT-${suffix}`,
      full_name: fullName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();
  const tripDate = `${nextMonth}-1${suffix % 9}`;

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(personnel.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(personnel.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(page, '/work-schedules');
  await page.getByLabel('Tháng của lịch').fill(nextMonth);
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm lịch' });
  await form.getByLabel('Nhân sự').selectOption({ label: fullName });
  await form.getByLabel('Ngày').fill(tripDate);
  await form.getByLabel('Ghi chú lịch').fill('Tập huấn tại Sở');
  await form.getByRole('button', { name: 'Ghi' }).click();
  const row = page.getByRole('row', { name: `Lịch của ${fullName} ngày ${tripDate}` });
  await expect(row).toContainText('Nháp');
  await page.getByRole('button', { name: 'Công bố lịch tháng' }).click();
  await expect(row).toContainText('Đã công bố');

  const teacherApp = await (await browser.newContext()).newPage();
  await teacherApp.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherApp.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherApp.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherApp.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherApp.getByRole('button', { name: 'Lịch công tác' }).click();
  await expect(teacherApp.getByRole('list', { name: 'Lịch công tác của tôi' })).toContainText(`${tripDate}: Công tác`);
});

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

// Giao việc và theo dõi tiến độ (DT-10 phần 10h, YCTD-81): quản lý đơn vị giao việc trên cổng quản trị; giáo viên cập nhật
// tiến độ trên ứng dụng giáo viên; quản lý thấy việc đã hoàn thành
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

test('Quản lý giao việc trên cổng quản trị; giáo viên cập nhật hoàn thành trên ứng dụng giáo viên', async ({
  browser,
}) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .where('status', '=', 'active')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: unit.id }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  const suffix = Date.now() % 1_000_000;
  const fullName = `Vũ Thị Việc ${suffix}`;
  const title = `Chuẩn bị góc học tập ${suffix}`;
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code: `GV-${suffix}`,
      full_name: fullName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: 'Công việc và kế hoạch' }).click();
  const form = page.getByRole('form', { name: 'Giao việc' });
  await form.getByLabel('Người nhận').selectOption({ label: fullName });
  await form.getByLabel('Nội dung việc').fill(title);
  await form.getByRole('button', { name: 'Giao việc' }).click();
  const unitTasks = page.getByRole('table', { name: 'Việc đã giao trong đơn vị' });
  await expect(unitTasks.getByRole('row', { name: `Việc ${title}` })).toContainText('Chưa làm');

  const teacherApp = await (await browser.newContext()).newPage();
  await teacherApp.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherApp.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherApp.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherApp.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherApp.getByRole('button', { name: 'Công việc của tôi' }).click();
  const item = teacherApp.getByRole('listitem', { name: `Việc ${title}` });
  await item.getByLabel('Phần trăm hoàn thành').selectOption('100');
  await item.getByRole('button', { name: 'Cập nhật' }).click();
  await expect(item).toContainText('Hoàn thành · 100%');

  await page.reload();
  await expect(
    page.getByRole('table', { name: 'Việc đã giao trong đơn vị' }).getByRole('row', { name: `Việc ${title}` }),
  ).toContainText('Hoàn thành');
});

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

// Giảng dạy (DT-10 phần 10g, YCTD-80): giáo viên tạo bài học, soạn giáo án và gửi duyệt trên ứng dụng giáo viên; tổ
// trưởng chuyên môn duyệt trên cổng quản trị, giáo án chuyển sang chờ quản lý đơn vị duyệt
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

test('Giáo viên soạn giáo án và gửi duyệt; tổ trưởng chuyên môn duyệt trên cổng quản trị', async ({ browser }) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const leader = await createTestUser(identity, { roles: [{ roleCode: 'VT-17', orgUnitId: reference.org_unit_id }] });
  const className = `Lớp giảng dạy ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `GD-${suffix}`,
      name: className,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: 'Giáo viên giảng dạy',
      assignment_role: 'homeroom',
      from_date: '2026-01-01',
    })
    .execute();
  const lessonName = `Đếm đến năm ${suffix}`;

  const teacherPage = await (await browser.newContext()).newPage();
  await teacherPage.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await teacherPage.getByRole('button', { name: `Giảng dạy lớp ${className}` }).click();
  const plans = teacherPage.getByRole('region', { name: 'Giáo án' });
  await plans.getByLabel('Tên bài học mới').fill(lessonName);
  await plans.getByLabel('Mục tiêu bài học').fill('Trẻ đếm được đến 5');
  await plans.getByRole('button', { name: 'Tạo bài học' }).click();
  await expect(teacherPage.getByText(`Đã tạo bài học ${lessonName}`)).toBeVisible();
  await expect(plans.getByLabel('Bài học', { exact: true })).toHaveValue(/.+/);
  await plans.getByLabel('Hoạt động', { exact: true }).fill('Đếm đồ chơi; trò chơi tìm số');
  await plans.getByRole('button', { name: 'Lưu giáo án' }).click();
  await expect(teacherPage.getByText('Đã lưu giáo án nháp')).toBeVisible();
  const planItem = plans.getByRole('listitem').filter({ hasText: lessonName });
  await expect(planItem).toContainText('Nháp');
  await planItem.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(teacherPage.getByText('Đã gửi giáo án chờ tổ trưởng duyệt')).toBeVisible();
  await expect(planItem).toContainText('Chờ tổ trưởng duyệt');

  const leaderPage = await (await browser.newContext()).newPage();
  await leaderPage.goto('/');
  await leaderPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(leader.username);
  await leaderPage.getByLabel('Mật khẩu', { exact: true }).fill(leader.password);
  await leaderPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(leaderPage, '/teaching');
  await leaderPage.getByRole('tab', { name: 'Giáo án chờ duyệt' }).click();
  const row = leaderPage.getByRole('row').filter({ hasText: lessonName });
  await expect(row).toContainText(className);
  await expect(row).toContainText('Chờ tổ trưởng duyệt');
  await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(leaderPage.getByText('Giáo án: Tổ trưởng đã duyệt, chờ quản lý duyệt')).toBeVisible();
  await expect(leaderPage.getByRole('row').filter({ hasText: lessonName })).toHaveCount(0);

  const stored = await schoolYear
    .selectFrom('lesson_plans')
    .select(['status', 'leader_reviewed_by'])
    .where('class_id', '=', classRow.id)
    .executeTakeFirstOrThrow();
  expect(stored).toEqual({ status: 'leader_approved', leader_reviewed_by: leader.id });
});

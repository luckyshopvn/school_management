import { expect, test, type Browser, type Page } from './fixtures.js';
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

// Mô hình nhóm dùng chung (DT-28 phần 28a, YCTD-271), kịch bản CT-28a-13: giáo viên chủ nhiệm chia lớp theo kiểu cân bằng nam
// nữ trong công cụ lớp học (máy chủ chia), bản chia lưu thành bộ nhóm của công cụ lớp học; rồi chọn một bộ nhóm hoạt động có
// sẵn của lớp, công cụ dùng đúng các nhóm của bộ đó và bộ cũ được lưu trữ. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page;
}

test('CT-28a-13: chia nhóm cân bằng nam nữ thành bộ nhóm, chọn bộ nhóm hoạt động có sẵn của lớp', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id', 'grade_level'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const className = `Lớp bộ nhóm ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `BN-${suffix}`,
      name: className,
      grade_level: reference.grade_level,
      school_level: 'MN',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  // Sáu bé, ba nam ba nữ
  const childIds: string[] = [];
  const genders = new Map<string, 'male' | 'female'>();
  for (const [index, name] of ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà'].entries()) {
    const gender = index % 2 === 0 ? 'male' : 'female';
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: `Bé ${name} ${suffix}`,
        dob: '2021-03-01',
        gender,
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `bn-${suffix}-${index}`,
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds.push(child.id);
    genders.set(child.id, gender);
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-09-05', order_number: index + 1 })
      .execute();
  }
  const teacher = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }],
  });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: teacherName,
      assignment_role: 'homeroom',
      from_date: '2026-09-05',
    })
    .execute();

  const page = await signIn(browser, teacher);
  await page.getByRole('button', { name: 'Hộp công cụ giảng dạy' }).click();
  await expect(page.getByRole('heading', { name: 'Hộp công cụ giảng dạy' })).toBeVisible();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
  await page.getByRole('tab', { name: 'Chia nhóm' }).click();

  // Cân bằng nam nữ, ba nhóm: mỗi nhóm một nam một nữ, lưu thành bộ nhóm của công cụ lớp học
  await page.getByLabel('Kiểu chia').selectOption({ label: 'Cân bằng nam nữ' });
  await page.getByLabel('Số nhóm', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Chia nhóm', exact: true }).click();
  await expect(page.getByText('Đã chia 3 nhóm')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các nhóm' }).getByRole('listitem')).toHaveCount(3);
  const classroomSet = await schoolYear
    .selectFrom('group_sets')
    .select('id')
    .where('class_id', '=', classRow.id)
    .where('purpose', '=', 'classroom')
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  const members = await schoolYear
    .selectFrom('child_group_members')
    .innerJoin('child_groups', 'child_groups.id', 'child_group_members.group_id')
    .select(['child_groups.id as group_id', 'child_group_members.child_id'])
    .where('child_groups.group_set_id', '=', classroomSet.id)
    .execute();
  expect(members).toHaveLength(6);
  for (const groupId of new Set(members.map((row) => row.group_id))) {
    const own = members.filter((row) => row.group_id === groupId).map((row) => genders.get(row.child_id));
    expect(own.sort()).toEqual(['female', 'male']);
  }

  // Bộ nhóm hoạt động có sẵn của lớp (lập ở màn hình khác): công cụ chọn được, dùng đúng hai nhóm của bộ
  const activity = await schoolYear
    .insertInto('group_sets')
    .values({
      org_unit_id: reference.org_unit_id,
      class_id: classRow.id,
      name: `Trò chơi vận động ${suffix}`,
      purpose: 'activity',
      method: 'manual',
      owner_user_id: teacher.id,
      owner_name: teacherName,
      replaces_id: null,
      archived_at: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const [position, [name, ids]] of [
    ['Đội Sao', childIds.slice(0, 3)],
    ['Đội Trăng', childIds.slice(3)],
  ].entries() as IterableIterator<[number, [string, string[]]]>) {
    const group = await schoolYear
      .insertInto('child_groups')
      .values({
        org_unit_id: reference.org_unit_id,
        name,
        created_by: teacher.id,
        group_set_id: activity.id,
        class_id: classRow.id,
        position: position + 1,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_group_members')
      .values(ids.map((childId) => ({ group_id: group.id, child_id: childId, added_by: teacher.id })))
      .execute();
  }
  await page.getByRole('tab', { name: 'Gọi tên' }).click();
  await page.getByRole('tab', { name: 'Chia nhóm' }).click();
  await page.getByLabel('Dùng bộ nhóm có sẵn của lớp').selectOption({ label: `Trò chơi vận động ${suffix} (2 nhóm)` });
  await expect(page.getByText('Đã chia 2 nhóm')).toBeVisible();
  const items = page.getByRole('list', { name: 'Các nhóm' }).getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Đội Sao');
  const sets = await schoolYear
    .selectFrom('group_sets')
    .select(['id', 'status', 'params'])
    .where('class_id', '=', classRow.id)
    .where('purpose', '=', 'classroom')
    .execute();
  expect(sets.find((row) => row.id === classroomSet.id)?.status).toBe('archived');
  const current = sets.find((row) => row.status === 'active');
  expect((current?.params as { source_group_set_id?: string }).source_group_set_id).toBe(activity.id);
});

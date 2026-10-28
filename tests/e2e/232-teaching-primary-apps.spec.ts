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

// Mini app Tiểu học của Hộp công cụ giảng dạy (DT-29 phần 29c, YCTD-327), kịch bản CT-29c-5: giáo viên lớp Tiểu học dùng bảng cửu
// chương, học xem đồng hồ, phân số trực quan, khung ô li; lớp Mầm non không có các mini app này. Dữ liệu giả
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

test('CT-29c-5: mini app Tiểu học: bảng cửu chương, đồng hồ, phân số, khung ô li; lớp Mầm non không có', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id', 'grade_level'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'T230',
      name: 'Khối hộp công cụ thử',
      age_from_months: null,
      age_to_months: null,
      school_level: 'TH',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const preschool = `Lớp mầm 232 ${suffix}`;
  const primary = `Lớp tiểu học 232 ${suffix}`;
  const teacher = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }],
  });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  const classes = [
    { name: preschool, level: 'MN', grade: reference.grade_level },
    { name: primary, level: 'TH', grade: 'T230' },
  ] as const;
  // Lớp, trẻ thử xoá khi xong để kịch bản đếm lớp theo cấp (84) không lệch
  const created: Array<{ classId: string; childId: string }> = [];
  for (const [index, { name, level, grade }] of classes.entries()) {
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `TH-${suffix}-${index}`,
        name,
        grade_level: grade,
        school_level: level,
        max_size: 30,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: `Học sinh 232 ${suffix} ${index}`,
        dob: '2020-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `th-${suffix}-${index}`,
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    created.push({ classId: classRow.id, childId: child.id });
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-09-05', order_number: 1 })
      .execute();
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
  }

  const page = await signIn(browser, teacher);
  await page.getByRole('button', { name: 'Hộp công cụ giảng dạy' }).click();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });

  // Bảng cửu chương: bảng 7, hiện đáp án câu hỏi
  await page.getByRole('tab', { name: /Bảng cửu chương/ }).click();
  await page.getByRole('button', { name: 'Bảng 7' }).click();
  await expect(page.getByRole('list', { name: 'Bảng nhân 7' })).toContainText('7 × 8 = 56');
  await expect(page.getByLabel('Câu hỏi')).toContainText('= ?');
  await page.getByRole('button', { name: 'Hiện đáp án' }).click();
  await expect(page.getByLabel('Câu hỏi')).not.toContainText('?');

  // Học xem đồng hồ: 7 giờ, tiến 15 phút
  await page.getByRole('tab', { name: /Học xem đồng hồ/ }).click();
  await expect(page.getByRole('img', { name: 'Đồng hồ chỉ 7 giờ' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiến' }).click();
  await expect(page.getByRole('img', { name: 'Đồng hồ chỉ 7 giờ 15 phút' })).toBeVisible();

  // Phân số: 2/4 tối giản là 1/2
  await page.getByRole('tab', { name: /Phân số trực quan/ }).click();
  await page.getByLabel('Tử số').fill('2');
  await expect(page.getByRole('img', { name: 'Hình tròn chia 4 phần, tô 2 phần' })).toBeVisible();
  await expect(page.getByText('= 1/2 (tối giản)')).toBeVisible();

  // Khung ô li
  await page.getByRole('tab', { name: /Khung ô li/ }).click();
  await expect(page.getByLabel('Khung ô li')).toBeVisible();

  // Lớp Mầm non: không có mini app Tiểu học
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: preschool });
  await expect(page.getByRole('tab', { name: /Gọi tên ngẫu nhiên/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Bảng cửu chương/ })).toHaveCount(0);
  await page.context().close();
  for (const { classId, childId } of created) {
    await schoolYear.deleteFrom('class_staff_assignments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('class_enrollments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('children').where('id', '=', childId).execute();
    await schoolYear.deleteFrom('classes').where('id', '=', classId).execute();
  }
});

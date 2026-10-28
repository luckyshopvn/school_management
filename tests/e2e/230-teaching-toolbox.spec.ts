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

// Hộp công cụ giảng dạy (DT-29 phần 29a, YCTD-325), kịch bản CT-29a-5: giáo viên dạy một lớp Mầm non và một lớp Tiểu học; trang
// chủ chỉ hiện Đón trả, Dặn thuốc ở hai lớp này, nút Hộp công cụ giảng dạy thay Công cụ lớp học; Hộp công cụ lọc theo cấp của lớp
// (Mầm non không có trò chơi kiến thức); trường tắt một công cụ thì công cụ đó ẩn; đường dẫn cũ ?man=cong-cu-lop-hoc mở Hộp công
// cụ và đổi sang ?man=hop-cong-cu. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.deleteFrom('settings').where('key', '=', 'teaching_tools_disabled').execute();
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

test('CT-29a-5: Hộp công cụ lọc theo cấp của lớp, công cụ trường tắt, đường dẫn cũ chuyển sang mới', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id', 'grade_level'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
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
  const preschool = `Lớp mầm hộp công cụ ${suffix}`;
  const primary = `Lớp tiểu học hộp công cụ ${suffix}`;
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
  for (const [index, { name, level, grade }] of classes.entries()) {
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `HC-${suffix}-${index}`,
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
        full_name: `Học sinh hộp công cụ ${suffix} ${index}`,
        dob: '2020-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `hc-${suffix}-${index}`,
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
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
  // Đón trả ở cả lớp Mầm non và Tiểu học; nút mới thay Công cụ lớp học
  await expect(page.getByRole('button', { name: `Đón trả lớp ${preschool}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Đón trả lớp ${primary}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Công cụ lớp học' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hộp công cụ giảng dạy' }).click();
  await expect(page.getByRole('heading', { name: 'Hộp công cụ giảng dạy' })).toBeVisible();
  await expect(page).toHaveURL(/[?&]man=hop-cong-cu/);

  // Lớp Mầm non: công cụ trên lớp, không có trò chơi kiến thức
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: preschool });
  await expect(page.getByRole('tab', { name: /Gọi tên ngẫu nhiên/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Đếm ngược, bấm giờ/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Trò chơi kiến thức/ })).toHaveCount(0);
  // Lớp Tiểu học: có trò chơi kiến thức và lối vào sổ đầu bài
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });
  await expect(page.getByRole('tab', { name: /Trò chơi kiến thức/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sổ đầu bài, bài về nhà/ })).toBeVisible();

  // Trường tắt đếm ngược, bấm giờ: mở lại thì công cụ đó ẩn
  await schoolYear
    .insertInto('settings')
    .values({
      org_unit_id: root.id,
      key: 'teaching_tools_disabled',
      value_type: 'teaching_tool_list',
      value: JSON.stringify(['timer']),
    })
    .onConflict((conflict) =>
      conflict.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(['timer']) }),
    )
    .execute();
  // Đường dẫn cũ mở Hộp công cụ và đổi sang tên mới
  await page.goto(`${TEACHER_URL}/?man=cong-cu-lop-hoc`);
  await expect(page.getByRole('heading', { name: 'Hộp công cụ giảng dạy' })).toBeVisible();
  await expect(page).toHaveURL(/[?&]man=hop-cong-cu/);
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });
  await expect(page.getByRole('tab', { name: /Gọi tên ngẫu nhiên/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Đếm ngược, bấm giờ/ })).toHaveCount(0);

  // Quay lại trang chủ: đường dẫn bỏ tham số của Hộp công cụ
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  await expect(page).not.toHaveURL(/man=/);
  await page.context().close();
});

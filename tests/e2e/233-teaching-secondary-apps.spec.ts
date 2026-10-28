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

// Mini app THCS, THPT của Hộp công cụ giảng dạy (DT-29 phần 29d, YCTD-328), kịch bản CT-29d-6: giáo viên lớp THCS dùng máy tính khoa
// học, vẽ đồ thị, bảng tuần hoàn, hình học động, đổi đơn vị; lớp Tiểu học không có các mini app này. Dữ liệu giả
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

test('CT-29d-6: mini app THCS, THPT: máy tính, đồ thị, bảng tuần hoàn, hình học, đổi đơn vị; lớp Tiểu học không có', async ({
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
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'T233',
      name: 'Khối hộp công cụ THCS thử',
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const secondary = `Lớp 7 thử 233 ${suffix}`;
  const primary = `Lớp tiểu học 233 ${suffix}`;
  const teacher = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }],
  });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  const classes = [
    { name: secondary, level: 'THCS', grade: 'T233' },
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
        code: `SC-${suffix}-${index}`,
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
        full_name: `Học sinh 233 ${suffix} ${index}`,
        dob: '2020-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `sc-${suffix}-${index}`,
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
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: secondary });

  // Máy tính khoa học
  await page.getByRole('tab', { name: /Máy tính khoa học/ }).click();
  await page.getByLabel('Biểu thức').fill('2^10 + sin(30)');
  await page.getByRole('button', { name: '=', exact: true }).click();
  await expect(page.getByLabel('Kết quả')).toHaveText('= 1024,5');
  await page.getByLabel('Biểu thức').fill('1 / 0');
  await page.getByRole('button', { name: '=', exact: true }).click();
  await expect(page.getByText('Không chia được cho 0')).toBeVisible();

  // Vẽ đồ thị: hàm mặc định và một hàm thêm
  await page.getByRole('tab', { name: /Vẽ đồ thị hàm số/ }).click();
  await page.getByLabel('Hàm 2: y =').fill('2x + 1');
  await expect(page.getByRole('img', { name: 'Đồ thị y = x^2 - 2x - 3, y = 2x + 1' })).toBeVisible();

  // Bảng tuần hoàn
  await page.getByRole('tab', { name: /Bảng tuần hoàn/ }).click();
  await expect(page.getByRole('group', { name: 'Bảng tuần hoàn' }).getByRole('button')).toHaveCount(90);
  await page.getByLabel('Tìm nguyên tố (kí hiệu, tên, số hiệu)').fill('Na');
  await expect(page.getByRole('region', { name: 'Nguyên tố đang chọn' })).toContainText('sodium');

  // Hình học động
  await page.getByRole('tab', { name: /Hình học động/ }).click();
  await page.getByLabel('Đường tròn ngoại tiếp, tâm O').check();
  await expect(page.getByText(/^Tam giác (nhọn|vuông|tù|đều)/)).toBeVisible();

  // Đổi đơn vị
  await page.getByRole('tab', { name: /Bảng hằng số, đơn vị/ }).click();
  await page.getByLabel('Giá trị').fill('2,5');
  await expect(page.getByLabel('Kết quả đổi')).toHaveText('2,5 km = 2.500 m');

  // Lớp Tiểu học: không có
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });
  await expect(page.getByRole('tab', { name: /Bảng cửu chương/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Máy tính khoa học/ })).toHaveCount(0);
  await page.context().close();
  for (const { classId, childId } of created) {
    await schoolYear.deleteFrom('class_staff_assignments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('class_enrollments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('children').where('id', '=', childId).execute();
    await schoolYear.deleteFrom('classes').where('id', '=', classId).execute();
  }
});

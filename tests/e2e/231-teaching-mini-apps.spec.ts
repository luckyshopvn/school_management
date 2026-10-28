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

// Mini app chung và Mầm non của Hộp công cụ giảng dạy (DT-29 phần 29b, YCTD-326), kịch bản CT-29b-5: giáo viên dạy một lớp Mầm non và
// một lớp Tiểu học dùng hình và màu, đếm và số, chữ cái, bảng thưởng sao, xúc xắc ở lớp Mầm non; lớp Tiểu học không có mini app
// Mầm non. Dữ liệu giả
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

test('CT-29b-5: mini app chung và Mầm non: hình và màu, đếm và số, chữ cái, bảng sao, xúc xắc; lớp Tiểu học không có mini app Mầm non', async ({
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
  const preschool = `Lớp mầm mini app ${suffix}`;
  const primary = `Lớp tiểu học mini app ${suffix}`;
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
        code: `MA-${suffix}-${index}`,
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
        full_name: `Học sinh mini app ${suffix} ${index}`,
        dob: '2020-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `ma-${suffix}-${index}`,
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
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: preschool });

  // Hình và màu: chọn hình, màu, ẩn tên để hỏi
  await page.getByRole('tab', { name: /Hình và màu/ }).click();
  await page.getByRole('button', { name: 'Hình tam giác' }).click();
  await page.getByRole('button', { name: 'Màu đỏ' }).click();
  await expect(page.getByRole('img', { name: 'Hình tam giác màu đỏ' })).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn tên để hỏi' }).click();
  await expect(page.getByRole('img', { name: 'Hình gì, màu gì?' })).toBeVisible();

  // Đếm và số: ba đồ vật, đếm đủ thì hiện số và tên số
  await page.getByRole('tab', { name: /Đếm và số/ }).click();
  await page.getByRole('group', { name: 'Số đồ vật' }).getByRole('button', { name: '3', exact: true }).click();
  const objects = page.getByRole('list', { name: 'Đồ vật để đếm' }).getByRole('button');
  await expect(objects).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await objects.nth(index).click();
  }
  await expect(page.getByText('3: ba')).toBeVisible();

  // Làm quen chữ cái: 29 chữ, chọn chữ Đ
  await page.getByRole('tab', { name: /Làm quen chữ cái/ }).click();
  const letters = page.getByRole('group', { name: 'Bảng chữ cái' }).getByRole('button');
  await expect(letters).toHaveCount(29);
  await letters.filter({ hasText: /^Đ$/ }).click();
  await expect(page.getByRole('region', { name: 'Chữ đang chiếu' })).toContainText('đ');

  // Bảng thưởng sao: thêm sao cho Nhóm 1, mở lại vẫn còn trong ngày
  await page.getByRole('tab', { name: /Bảng thưởng sao/ }).click();
  await page.getByRole('button', { name: 'Thêm một sao cho Nhóm 1' }).click();
  await page.getByRole('button', { name: 'Thêm một sao cho Nhóm 1' }).click();
  await expect(page.getByRole('img', { name: 'Nhóm 1: 2 trên 10 sao' })).toBeVisible();
  await page.getByRole('tab', { name: /Gọi tên ngẫu nhiên/ }).click();
  await page.getByRole('tab', { name: /Bảng thưởng sao/ }).click();
  await expect(page.getByRole('img', { name: 'Nhóm 1: 2 trên 10 sao' })).toBeVisible();

  // Xúc xắc: tung hai con
  await page.getByRole('tab', { name: /Xúc xắc, bốc số/ }).click();
  await page.getByRole('button', { name: '2 con' }).click();
  await page.getByRole('button', { name: 'Tung xúc xắc' }).click();
  await expect(page.getByRole('img', { name: /^Mặt [1-6]$/ })).toHaveCount(2);

  // Lớp Tiểu học: có bảng sao, không có mini app Mầm non
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });
  await expect(page.getByRole('tab', { name: /Bảng thưởng sao/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Hình và màu/ })).toHaveCount(0);
  await page.context().close();
  for (const { classId, childId } of created) {
    await schoolYear.deleteFrom('class_staff_assignments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('class_enrollments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('children').where('id', '=', childId).execute();
    await schoolYear.deleteFrom('classes').where('id', '=', classId).execute();
  }
});

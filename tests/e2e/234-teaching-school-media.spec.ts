import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME, E2E_TEACHER_PORT } from '../e2e-environment.mjs';

// Bài hát, câu chuyện của trường (DT-29 phần 29e, YCTD-329), kịch bản CT-29e-3: kho học liệu có một bài hát Mầm non đã công bố (liên
// kết), một bài hát chưa công bố và một bài hát Tiểu học; giáo viên lớp Mầm non chỉ thấy bài đã công bố của cấp mình và mở được;
// lớp Tiểu học không có mini app này. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
let system: ReturnType<typeof createDatabase<SystemDatabase>>;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
  system = createDatabase<SystemDatabase>(replaceDatabaseName(systemUrl, E2E_SYSTEM_DATABASE_NAME));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
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

test('CT-29e-3: bài hát, câu chuyện của trường chỉ hiện học liệu đã công bố của cấp lớp, mở được liên kết', async ({
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
  const preschool = `Lớp mầm bài hát ${suffix}`;
  const primary = `Lớp tiểu học bài hát ${suffix}`;
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
        code: `BH-${suffix}-${index}`,
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
        full_name: `Học sinh bài hát ${suffix} ${index}`,
        dob: '2020-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `bh-${suffix}-${index}`,
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

  // Học liệu loại Bài hát: một bài Mầm non đã công bố (liên kết), một bài chưa công bố, một bài Tiểu học
  const songType = await system
    .selectFrom('resource_types')
    .select('id')
    .where('code', '=', 'song')
    .executeTakeFirstOrThrow();
  const songs = [
    { title: `Bài hát Bé đến trường ${suffix}`, level: 'MN', published: true },
    { title: `Bài hát nháp ${suffix}`, level: 'MN', published: false },
    { title: `Bài hát Tiểu học ${suffix}`, level: 'TH', published: true },
  ];
  for (const song of songs) {
    const row = await system
      .insertInto('learning_resources')
      .values({
        title: song.title,
        description: null,
        type_id: songType.id,
        school_level: song.level,
        grade_level_code: null,
        subject_code: null,
        subject_name: null,
        topic_id: null,
        week_no: null,
        author_name: 'Tổ Mầm non thử',
        duration_minutes: null,
        license_id: null,
        license_source: null,
        origin: null,
        responsible_name: null,
        license_expires_on: null,
        visibility: 'school',
        status: song.published ? 'published' : 'draft',
        owner_user_id: teacher.id,
        owner_name: teacherName,
        department_id: null,
        department_name: null,
        published_version: song.published ? 1 : null,
        submitted_at: null,
        published_at: song.published ? new Date() : null,
        return_note: null,
        ai_request_id: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await system
      .insertInto('learning_resource_versions')
      .values({
        resource_id: row.id,
        version_no: 1,
        kind: 'link',
        storage_key: null,
        file_name: null,
        content_type: null,
        size_bytes: null,
        sha256: null,
        url: 'https://example.org/bai-hat-thu',
        link_title: song.title,
        lesson_plan_id: null,
        lesson_plan_database: null,
        note: null,
        created_by: teacher.id,
      })
      .execute();
  }

  const page = await signIn(browser, teacher);
  await page.getByRole('button', { name: 'Hộp công cụ giảng dạy' }).click();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: preschool });
  await page.getByRole('tab', { name: /Bài hát, câu chuyện của trường/ }).click();
  const list = page.getByRole('region', { name: 'Danh sách bài hát, câu chuyện' });
  await expect(list.getByRole('button', { name: songs[0]?.title ?? '' })).toBeVisible();
  // Bài nháp (chủ học liệu vẫn thấy ở kho nhưng không phát trên lớp) và bài Tiểu học không hiện
  await expect(list.getByRole('button', { name: songs[1]?.title ?? '' })).toHaveCount(0);
  await expect(list.getByRole('button', { name: songs[2]?.title ?? '' })).toHaveCount(0);
  await list.getByRole('button', { name: songs[0]?.title ?? '' }).click();
  await expect(
    page.getByRole('region', { name: 'Đang phát' }).getByRole('button', { name: 'Mở liên kết' }),
  ).toBeVisible();

  // Lớp Tiểu học: không có mini app này
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: primary });
  await expect(page.getByRole('tab', { name: /Gọi tên ngẫu nhiên/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Bài hát, câu chuyện của trường/ })).toHaveCount(0);
  await page.context().close();
  for (const { classId, childId } of created) {
    await schoolYear.deleteFrom('class_staff_assignments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('class_enrollments').where('class_id', '=', classId).execute();
    await schoolYear.deleteFrom('children').where('id', '=', childId).execute();
    await schoolYear.deleteFrom('classes').where('id', '=', classId).execute();
  }
});

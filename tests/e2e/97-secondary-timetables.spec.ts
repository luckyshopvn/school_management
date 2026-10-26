import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu, selectSchoolLevel } from './menu.js';

// Thời khoá biểu THPT (DT-21 phần 21b, YCTD-169), kịch bản CT-21b-7: trường bật thêm THPT, chọn cấp THPT; Hiệu trưởng tạo bản
// nháp, xếp tiết cả lớp và hai tiết học nhóm cùng ô (Vật lí, Địa lí), kiểm tra xung đột, ban hành; phụ huynh con học tổ hợp
// khoa học tự nhiên chỉ thấy tiết Vật lí. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
let system: ReturnType<typeof createDatabase<SystemDatabase>>;

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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const level = card.getByLabel('Bật cấp THPT', { exact: true });
  if (enabled) {
    await level.check();
  } else {
    await level.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-21b-7: tiết cả lớp và tiết nhóm cùng ô, kiểm tra xung đột, ban hành; phụ huynh thấy tiết theo tổ hợp của con', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const unit = await schoolYear.selectFrom('org_units').select('id').orderBy('created_at').executeTakeFirstOrThrow();
  const openYear = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teachers = await Promise.all(
    [1, 2, 3].map(() => createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: unit.id }] })),
  );
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unit.id }] });
  const parentPhone = `06${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();

  // Khối 10, lớp 10, ba môn (Toán cả lớp; Vật lí, Địa lí là môn học lựa chọn), chương trình mặc định THPT
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K10',
      name: 'Khối 10',
      order_no: 110,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THPT',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 10A ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: unit.id,
      academic_year_id: openYear.id,
      code: `10A-${suffix}`,
      name: className,
      grade_level: 'K10',
      school_level: 'THPT',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const subject = async (code: string, name: string, optionGroup: 'natural_science' | 'social_science' | null) =>
    (
      await schoolYear
        .insertInto('subjects')
        .values({
          code: `E97-${code}-${suffix}`,
          name,
          school_level: 'THPT',
          assessment: 'score',
          option_group: optionGroup,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  const mathName = `Toán ${suffix}`;
  const physicsName = `Vật lí ${suffix}`;
  const geographyName = `Địa lí ${suffix}`;
  const math = await subject('TOAN', mathName, null);
  const physics = await subject('VL', physicsName, 'natural_science');
  const geography = await subject('DL', geographyName, 'social_science');
  const existingCurriculum = await schoolYear
    .selectFrom('curricula')
    .select('id')
    .where('school_level', '=', 'THPT')
    .where('is_default', '=', true)
    .executeTakeFirst();
  const curriculumId =
    existingCurriculum?.id ??
    (
      await schoolYear
        .insertInto('curricula')
        .values({ code: `CT-E97-${suffix}`, name: 'Chương trình THPT thử', school_level: 'THPT', is_default: true })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  await schoolYear
    .insertInto('curriculum_subjects')
    .values([
      { curriculum_id: curriculumId, subject_id: math, grade_level_code: 'K10', periods_per_week: 1 },
      {
        curriculum_id: curriculumId,
        subject_id: physics,
        grade_level_code: 'K10',
        periods_per_week: 1,
        is_elective: true,
      },
      {
        curriculum_id: curriculumId,
        subject_id: geography,
        grade_level_code: 'K10',
        periods_per_week: 1,
        is_elective: true,
      },
    ])
    .execute();
  for (const [index, [subjectId, subjectName]] of [
    [math, mathName],
    [physics, physicsName],
    [geography, geographyName],
  ].entries()) {
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classRow.id,
        staff_user_id: teachers[index]?.id ?? '',
        staff_name: `Giáo viên ${suffix}-${index}`,
        assignment_role: 'subject',
        subject_name: subjectName,
        subject_id: subjectId,
        from_date: '2026-01-01',
      })
      .execute();
  }
  // Tổ hợp khoa học tự nhiên (Vật lí) và khoa học xã hội (Địa lí); con của phụ huynh học khoa học tự nhiên
  const combination = async (code: string, subjectId: string) => {
    const row = await schoolYear
      .insertInto('subject_combinations')
      .values({ code: `${code}-${suffix}`, name: `Tổ hợp ${code}`, school_level: 'THPT' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('subject_combination_subjects')
      .values({ combination_id: row.id, subject_id: subjectId })
      .execute();
    return row.id;
  };
  const naturalCombination = await combination('TN', physics);
  await combination('XH', geography);
  const childName = `Học Sinh Tổ Hợp ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: unit.id,
      full_name: childName,
      dob: '2010-06-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '9797',
      photo_consent: 'granted',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
    .execute();
  await schoolYear
    .insertInto('child_subject_combinations')
    .values({ child_id: child.id, combination_id: naturalCombination, status: 'approved' })
    .execute();
  const relationship = await schoolYear
    .insertInto('catalog_items')
    .values({ catalog_type: 'parent_relationship', code: `E97-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: 'Phụ huynh tổ hợp', phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
    .execute();
  // Khung giờ tiết học của THPT (năm học đang mở)
  await system
    .deleteFrom('period_slots')
    .where('academic_year_id', '=', openYear.id)
    .where('school_level', '=', 'THPT')
    .execute();
  await system
    .insertInto('period_slots')
    .values(
      [1, 2, 3].map((period) => ({
        academic_year_id: openYear.id,
        school_level: 'THPT' as const,
        period_no: period,
        session: 'morning' as const,
        start_time: `0${6 + period}:00`,
        end_time: `0${6 + period}:45`,
      })),
    )
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setSecondaryEnabled(page, true);
  try {
    await selectSchoolLevel(page, 'THPT');
    await openMenu(page, '/timetables');
    const form = page.getByRole('form', { name: 'Tạo bản thời khoá biểu' });
    await form.getByLabel('Tên bản', { exact: true }).fill(`TKB THPT ${suffix}`);
    await form.getByLabel('Áp dụng từ ngày', { exact: true }).fill(today);
    await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
    await expect(toast(page, `Đã tạo bản nháp TKB THPT ${suffix}`)).toBeVisible();
    await page.getByLabel('Chọn lớp', { exact: true }).selectOption({ label: className });
    await page.getByLabel('Thứ Hai tiết 1', { exact: true }).selectOption({ label: mathName });
    // Hai nhóm học môn lựa chọn cùng ô Thứ Hai tiết 2
    await page.getByRole('button', { name: 'Thêm tiết nhóm' }).click();
    await page.getByLabel('Tiết của tiết nhóm 1', { exact: true }).selectOption({ label: 'Tiết 2' });
    await page.getByLabel('Môn của tiết nhóm 1', { exact: true }).selectOption({ label: physicsName });
    await page.getByRole('button', { name: 'Thêm tiết nhóm' }).click();
    await page.getByLabel('Tiết của tiết nhóm 2', { exact: true }).selectOption({ label: 'Tiết 2' });
    await page.getByLabel('Nhóm của tiết nhóm 2', { exact: true }).selectOption({ label: 'Nhóm 2' });
    await page.getByLabel('Môn của tiết nhóm 2', { exact: true }).selectOption({ label: geographyName });
    // Chương trình THPT mặc định của kịch bản khác có thể sinh cảnh báo số tiết; chỉ cần không có xung đột phải sửa
    const instant = page.getByRole('region', { name: 'Kiểm tra ngay' });
    await expect(instant).toBeVisible();
    await expect(instant).not.toContainText('Phải sửa:');
    await page.getByRole('button', { name: 'Ghi thời khoá biểu của lớp' }).click();
    await expect(toast(page, 'Đã ghi thời khoá biểu của lớp')).toBeVisible();
    const saved = await schoolYear
      .selectFrom('timetable_lessons')
      .select(['period_no', 'group_no'])
      .where('class_id', '=', classRow.id)
      .orderBy('period_no')
      .orderBy('group_no')
      .execute();
    expect(saved.map((row) => [row.period_no, row.group_no])).toEqual([
      [1, 0],
      [2, 1],
      [2, 2],
    ]);
    // Thêm tiết cả lớp vào ô đã có tiết nhóm: kiểm tra ngay báo phải sửa
    await page.getByLabel('Thứ Hai tiết 2', { exact: true }).selectOption({ label: mathName });
    await expect(page.getByRole('region', { name: 'Kiểm tra ngay' })).toContainText(
      'vừa có tiết cả lớp vừa có tiết nhóm',
    );
    await page.getByLabel('Thứ Hai tiết 2', { exact: true }).selectOption({ label: '—' });
    await page.getByRole('button', { name: 'Ban hành' }).click();
    await expect(toast(page, 'Đã ban hành thời khoá biểu')).toBeVisible();

    // Ứng dụng phụ huynh: con học khoa học tự nhiên chỉ thấy Vật lí ở tiết nhóm
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Thời khoá biểu', exact: true }).click();
    const region = card.getByRole('region', { name: `Thời khoá biểu của ${childName}` });
    await expect(region).toContainText(mathName);
    await expect(region).toContainText(physicsName);
    await expect(region).not.toContainText(geographyName);
  } finally {
    await setSecondaryEnabled(page, false);
  }
});

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
import { openMenu } from './menu.js';

// Tiến độ, bảng điểm hoạt động, báo cáo (DT-28 phần 28d, YCTD-274), kịch bản CT-28d-13: giáo viên mở Tiến độ và bảng điểm của
// lớp học trực tuyến ở ứng dụng giáo viên, thấy em quá hạn trong danh sách cần chú ý và điểm trung bình tham khảo; Hiệu trưởng
// mở 9.4 Báo cáo học tập trực tuyến, xem số liệu toàn trường, lập báo cáo tổng kết học kỳ (Thông tư 09/2021 Điều 15 khoản 6).
// Dữ liệu giả
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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function signInPortal(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const secondary = card.getByLabel('Bật cấp THCS', { exact: true });
  if (enabled) {
    await secondary.check();
  } else {
    await secondary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-28d-13: giáo viên xem tiến độ, học sinh cần chú ý, bảng điểm hoạt động; Hiệu trưởng xem báo cáo toàn trường, lập tổng kết học kỳ', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K7',
      name: 'Khối 7',
      order_no: 107,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const subjectName = `Toán TĐ ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-TD-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lớp 7P ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7P-${suffix}`,
      name: className,
      grade_level: 'K7',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: `Cô Toán ${suffix}`,
      assignment_role: 'subject',
      subject_name: subjectName,
      subject_id: subject.id,
      from_date: '2026-01-01',
    })
    .execute();
  const names = [`Học sinh Hoa ${suffix}`, `Học sinh Khang ${suffix}`];
  const childIds: string[] = [];
  for (const [index, name] of names.entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2014-03-01',
        gender: index === 0 ? 'female' : 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `td-${suffix}-${index}`,
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds.push(child.id);
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-09-05', order_number: index + 1 })
      .execute();
  }

  const head = await signInPortal(browser, principal);
  await setSecondaryEnabled(head, true);
  try {
    // Giáo viên: lớp học trực tuyến tự có từ phân công; chương và hoạt động ghi thẳng (soạn ở e2e 211, 212)
    const page = await (await browser.newContext()).newPage();
    await page.goto(TEACHER_URL);
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    const spaceTitle = `${subjectName} - ${className}`;
    const spaceButton = page.getByRole('button', { name: new RegExp(spaceTitle) });
    await expect(spaceButton).toBeVisible();
    const space = await schoolYear
      .selectFrom('course_spaces')
      .select('id')
      .where('class_id', '=', classRow.id)
      .executeTakeFirstOrThrow();
    await schoolYear
      .updateTable('course_spaces')
      .set({ visible_to_students: true })
      .where('id', '=', space.id)
      .execute();
    const section = await schoolYear
      .insertInto('course_sections')
      .values({ space_id: space.id, title: 'Chương 1', position: 1, planned_week: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const past = new Date(Date.now() - 3 * 86_400_000);
    const activityIds: string[] = [];
    for (const [position, title, graded, weight] of [
      [1, 'Đọc bài mở đầu', false, 1],
      [2, 'Đọc bài mở rộng', false, 1],
      [3, 'Bài luyện tập 1', true, 1],
      [4, 'Bài luyện tập 2', true, 2],
    ] as const) {
      const row = await schoolYear
        .insertInto('course_activities')
        .values({
          space_id: space.id,
          section_id: section.id,
          kind: 'page',
          title,
          position,
          status: 'published',
          due_at: graded ? null : past,
          graded,
          weight,
          completion_rule: graded ? 'teacher' : 'view',
          open_rules: null,
          settings: JSON.stringify({ body: title }),
          created_by: teacher.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      activityIds.push(row.id);
    }
    const [firstChild] = childIds as [string];
    for (const [activityId, childId, score] of [
      [activityIds[0], firstChild, null],
      [activityIds[1], firstChild, null],
      [activityIds[2], firstChild, 8],
      [activityIds[3], firstChild, 9],
    ] as const) {
      await schoolYear
        .insertInto('activity_results')
        .values({ activity_id: activityId ?? '', child_id: childId, status: 'completed', score, source: 'teacher' })
        .execute();
    }
    await spaceButton.click();
    await page.getByRole('button', { name: 'Tiến độ và bảng điểm' }).click();
    const progress = page.getByRole('list', { name: 'Tiến độ từng em' });
    const hoa = progress.getByRole('listitem').filter({ hasText: names[0] ?? '' });
    await expect(hoa).toContainText('Xong 4/4 (100%)');
    const khang = progress.getByRole('listitem').filter({ hasText: names[1] ?? '' });
    await expect(khang).toContainText('Cần chú ý');
    await expect(khang).toContainText('Quá hạn 2 hoạt động');
    const book = page.getByRole('region', { name: 'Bảng điểm hoạt động' });
    await expect(book).toContainText('chỉ để tham khảo');
    await expect(book.getByRole('listitem').filter({ hasText: names[0] ?? '' })).toContainText(
      'trung bình tham khảo 8.7',
    );

    // Hiệu trưởng: 9.4 Báo cáo học tập trực tuyến
    await openMenu(head, '/online-learning-reports');
    await head.getByRole('tab', { name: 'Toàn trường' }).click();
    await expect(head.getByRole('list', { name: 'Số liệu toàn trường' })).toContainText('Hoạt động đã giao');
    await head.getByRole('tab', { name: 'Tổng kết học kỳ' }).click();
    const term = head.getByRole('region', { name: 'Báo cáo tổng kết học kỳ' });
    await term.getByLabel('Khó khăn').fill(`Một số học sinh thiếu thiết bị ${suffix}`);
    await term.getByRole('button', { name: 'Lưu báo cáo tổng kết' }).click();
    await expect(toast(head, 'Đã lưu báo cáo tổng kết')).toBeVisible();
    await head.reload();
    await head.getByRole('tab', { name: 'Tổng kết học kỳ' }).click();
    await expect(head.getByRole('region', { name: 'Báo cáo tổng kết học kỳ' }).getByLabel('Khó khăn')).toHaveValue(
      `Một số học sinh thiếu thiết bị ${suffix}`,
    );
  } finally {
    await setSecondaryEnabled(head, false);
  }
});

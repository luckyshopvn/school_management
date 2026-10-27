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
import {
  E2E_API_PORT,
  E2E_IDENTITY_PORT,
  E2E_PARENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_TEACHER_PORT,
} from '../e2e-environment.mjs';

// Bài tập trực tuyến (DT-28 phần 28c, YCTD-273), kịch bản CT-28c-16: giáo viên tạo bài tập ở ứng dụng giáo viên từ câu đã duyệt
// của ngân hàng câu hỏi và một câu tự luận, giao cho lớp; học sinh làm, nộp ở kênh student; giáo viên chấm câu tự luận, nhận
// xét bằng câu của ngân hàng nhận xét, trả bài; học sinh thấy điểm và nhận xét; phụ huynh xem nhận xét của con. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const IDENTITY_API = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const MAIN_API = `http://localhost:${E2E_API_PORT}/api/v1`;

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

async function issueAccount(principal: { username: string; password: string }, childId: string) {
  const login = await fetch(`${IDENTITY_API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: principal.username, password: principal.password, channel: 'portal' }),
  });
  const token = ((await login.json()) as { access_token: string }).access_token;
  const issued = await fetch(`${MAIN_API}/learning-accounts/issue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ child_ids: [childId], mode: 'create' }),
  });
  expect(issued.status).toBe(200);
  return ((await issued.json()) as { items: Array<{ username: string; password: string }> }).items[0] as {
    username: string;
    password: string;
  };
}

test('CT-28c-16: giáo viên soạn, giao bài; học sinh làm, nộp; giáo viên chấm, nhận xét, trả bài; học sinh và phụ huynh xem nhận xét', async ({
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
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `0908${String(suffix).padStart(6, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
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
  const subjectName = `Toán BT ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-BT-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const questionText = `Số nào là số nguyên tố? (${suffix})`;
  await schoolYear
    .insertInto('questions')
    .values({
      school_level: 'THCS',
      subject_id: subject.id,
      grade_level_code: 'K7',
      topic_id: null,
      cognitive_level: 'recognition',
      question_type: 'multiple_choice',
      content: questionText,
      options: JSON.stringify([
        { key: 'A', content: 'Số 4' },
        { key: 'B', content: 'Số 7' },
      ]),
      answer: JSON.stringify(['B']),
      guidance: null,
      score: 1,
      status: 'approved',
      author_user_id: teacher.id,
      author_name: 'Cô Toán',
    })
    .execute();
  const className = `Lớp 7T ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7T-${suffix}`,
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
  const childName = `Học sinh Mai ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `bt-${suffix}`,
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
  const relationship = await schoolYear
    .insertInto('catalog_items')
    .values({ catalog_type: 'parent_relationship', code: `ME-BT-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: `Mẹ Mai ${suffix}`, phone: parentPhone, user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
    .execute();

  const head = await signInPortal(browser, principal);
  await setSecondaryEnabled(head, true);
  try {
    const account = await issueAccount(principal, child.id);
    const assignmentTitle = `Bài tập số nguyên tố ${suffix}`;
    const spaceTitle = `${subjectName} - ${className}`;

    // Giáo viên: lớp học trực tuyến tự có từ phân công; thêm chương ở cổng quản trị (ở đây ghi thẳng), mở lớp
    const page = await (await browser.newContext()).newPage();
    await page.goto(TEACHER_URL);
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    const spaceButton = page.getByRole('button', { name: new RegExp(spaceTitle) });
    await expect(spaceButton).toBeVisible();
    const space = await schoolYear
      .selectFrom('course_spaces')
      .select('id')
      .where('class_id', '=', classRow.id)
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('course_sections')
      .values({ space_id: space.id, title: 'Chương 1. Số nguyên tố', position: 1, planned_week: 1 })
      .execute();
    await spaceButton.click();
    await page.getByRole('button', { name: 'Mở lớp cho học sinh' }).click();
    await expect(page.getByRole('button', { name: 'Ẩn lớp với học sinh' })).toBeVisible();

    // Tạo bài tập: câu đã duyệt của ngân hàng câu hỏi và một câu tự luận, giao cho cả lớp
    const create = page.getByRole('form', { name: 'Thêm bài tập' });
    await create.getByLabel('Tên bài tập').fill(assignmentTitle);
    await create.getByRole('button', { name: 'Tạo bài tập' }).click();
    const composer = page.getByRole('region', { name: 'Soạn bài tập' });
    await composer.getByLabel('Tìm câu đã duyệt trong ngân hàng câu hỏi').fill(String(suffix));
    await composer.getByRole('button', { name: 'Tìm câu hỏi' }).click();
    await composer.getByRole('button', { name: `Thêm câu ${questionText}` }).click();
    await composer.getByLabel('Yêu cầu', { exact: true }).fill('Giải thích vì sao em chọn đáp án đó');
    await composer.getByRole('button', { name: 'Thêm yêu cầu' }).click();
    await composer.getByLabel('Điểm câu 2').fill('4');
    await composer.getByRole('button', { name: 'Lưu bài tập' }).click();
    await expect(page.getByText('Đã lưu bài tập')).toBeVisible();
    await page.getByRole('button', { name: 'Giao bài cho học sinh' }).click();
    await expect(page.getByText('Đã giao cho 1 học sinh')).toBeVisible();

    // Học sinh: đăng nhập kênh student, đặt mật khẩu mới, mở bài, làm và nộp
    const student = await (await browser.newContext()).newPage();
    await student.goto(`${PARENT_URL}/#hoc-sinh`);
    await student.getByLabel('Tên đăng nhập').fill(account.username);
    await student.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
    await student.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(student.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
    await student.getByLabel('Mật khẩu mới', { exact: true }).fill(`MatKhauMoi${suffix}`);
    await student.getByLabel('Nhập lại mật khẩu mới').fill(`MatKhauMoi${suffix}`);
    await student.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await student.getByRole('button', { name: `Mở ${assignmentTitle}` }).click();
    const work = student.getByRole('region', { name: `Bài tập ${assignmentTitle}` });
    await work.getByLabel(/^B\. Số 7/).check();
    await work.getByLabel('Trả lời câu 2').fill('Vì 7 chỉ chia hết cho 1 và chính nó');
    await work.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(work.getByText('Đã lưu nháp')).toBeVisible();
    await work.getByRole('button', { name: 'Nộp bài', exact: true }).click();
    await expect(work.getByText('Đã nộp bài')).toBeVisible();
    await expect(work).toContainText('Đã nộp, chờ chấm');

    // Giáo viên: chấm câu tự luận, nhận xét bằng câu của mình trong ngân hàng nhận xét, trả bài
    await page.reload();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await page.getByRole('button', { name: new RegExp(spaceTitle) }).click();
    await page.getByRole('button', { name: `Mở bài tập ${assignmentTitle}` }).click();
    await page.getByRole('button', { name: `Chấm bài của ${childName}` }).click();
    const grading = page.getByRole('region', { name: 'Chấm bài' });
    await expect(grading).toContainText('Vì 7 chỉ chia hết cho 1 và chính nó');
    await grading.getByLabel('Điểm câu 2').fill('3');
    await grading.getByLabel('Nhận xét').fill('Em chọn đúng và giải thích rõ ràng.');
    await grading.getByRole('button', { name: 'Lưu điểm, nhận xét' }).click();
    await expect(grading.getByText('Đã lưu điểm và nhận xét')).toBeVisible();
    await grading.getByRole('button', { name: 'Quay lại danh sách bài nộp' }).click();
    await page.getByRole('button', { name: 'Trả các bài đã chấm' }).click();
    await expect(page.getByText('Đã trả 1 bài')).toBeVisible();

    // Học sinh thấy điểm (4/5 quy về thang 10 là 8) và nhận xét
    await student.reload();
    await student.getByRole('button', { name: `Mở ${assignmentTitle}` }).click();
    const returned = student.getByRole('region', { name: `Bài tập ${assignmentTitle}` });
    await expect(returned).toContainText('Đã trả bài');
    await expect(returned).toContainText('Điểm: 8');
    await expect(returned).toContainText('Em chọn đúng và giải thích rõ ràng.');

    // Phụ huynh xem nhận xét của con
    const home = await (await browser.newContext()).newPage();
    await home.goto(PARENT_URL);
    await home.getByLabel('Số điện thoại').fill(parentPhone);
    await home.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await home.getByRole('button', { name: 'Đăng nhập' }).click();
    const childCard = home.getByRole('listitem', { name: childName });
    await childCard.getByRole('button', { name: 'Học trực tuyến' }).click();
    const learning = home.getByRole('region', { name: `Học trực tuyến của ${childName}` });
    await learning.getByRole('button', { name: 'Xem bài và nhận xét' }).click();
    await expect(learning.getByRole('list', { name: `Bài nộp ${assignmentTitle}` })).toContainText(
      'nhận xét: Em chọn đúng và giải thích rõ ràng.',
    );
  } finally {
    await setSecondaryEnabled(head, false);
  }
});

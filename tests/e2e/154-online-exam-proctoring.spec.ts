import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
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
  E2E_STUDENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
} from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Giám thị camera cho thi trực tuyến (DT-23 phần 23e, YCTD-215), kịch bản CT-23e-5: trường bật xem trực tiếp và ghi hình; phụ
// huynh đồng ý trên ứng dụng phụ huynh; giáo viên giao đề có giám sát và mở phòng thi; học sinh (dưới 16 tuổi) phải đọc thông báo
// mới vào được; giáo viên xem camera trực tiếp qua WebRTC (camera giả, hai trình duyệt cùng máy), học sinh thấy thông báo có người
// xem; học sinh nộp bài, bản ghi lên kho mã hoá; giáo viên xem lại bản ghi, nhật ký người xem ghi cả hai lần xem. Dữ liệu giả
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--disable-features=WebRtcHideLocalIpsWithMdns',
    ],
  },
});

const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const IDENTITY_API = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const MAIN_API = `http://localhost:${E2E_API_PORT}/api/v1`;
const PARENT_APP = `http://localhost:${E2E_PARENT_PORT}`;
// Ứng dụng học sinh riêng (YCTD-300)
const STUDENT_URL = `http://localhost:${E2E_STUDENT_PORT}`;

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

async function signIn(page: Page, user: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
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
  const item = ((await issued.json()) as { items: Array<{ username: string; password: string }> }).items[0];
  return item as { username: string; password: string };
}

test('CT-23e-5: bật giám sát, phụ huynh đồng ý, học sinh đọc thông báo, giáo viên xem camera trực tiếp và xem lại bản ghi', async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `07${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K6',
      name: 'Khối 6',
      order_no: 106,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, principal);
  await setSecondaryEnabled(page, true);
  try {
    const existing = await schoolYear
      .selectFrom('subjects')
      .select('id')
      .where('code', '=', 'THCS-TOAN')
      .executeTakeFirst();
    if (!existing) {
      await openMenu(page, '/subjects');
      await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
      await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    }
    const subject = await schoolYear
      .selectFrom('subjects')
      .select('id')
      .where('code', '=', 'THCS-TOAN')
      .executeTakeFirstOrThrow();
    const className = `Lớp 6G ${suffix}`;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `6G-${suffix}`,
        name: className,
        grade_level: 'K6',
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
        subject_name: 'Toán',
        subject_id: subject.id,
        from_date: '2026-01-01',
      })
      .execute();
    const childName = `Học Sinh Giám Thị ${suffix}`;
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: childName,
        dob: '2014-06-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '5555',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `GT-${suffix}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Phụ huynh giám thị', phone: parentPhone, user_id: parent.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();

    // Đề đã khoá chỉ có một câu nhiều lựa chọn
    const question = await schoolYear
      .insertInto('questions')
      .values({
        school_level: 'THCS',
        subject_id: subject.id,
        grade_level_code: 'K6',
        cognitive_level: 'recognition',
        question_type: 'multiple_choice',
        content: `Câu giám thị ${suffix}`,
        options: JSON.stringify(['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Phương án ${key}` }))),
        answer: JSON.stringify(['B']),
        score: 10,
        status: 'approved',
        author_user_id: teacher.id,
        author_name: `Cô Toán ${suffix}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const examTitle = `Đề giám thị ${suffix}`;
    const exam = await schoolYear
      .insertInto('exams')
      .values({
        school_level: 'THCS',
        subject_id: subject.id,
        grade_level_code: 'K6',
        title: examTitle,
        status: 'locked',
        author_user_id: teacher.id,
        author_name: `Cô Toán ${suffix}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('exam_questions')
      .values({
        exam_id: exam.id,
        question_id: question.id,
        order_no: 1,
        score: 10,
        snapshot: JSON.stringify({
          content: `Câu giám thị ${suffix}`,
          question_type: 'multiple_choice',
          cognitive_level: 'recognition',
          topic_name: 'Số tự nhiên',
          options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Phương án ${key}` })),
          answer: ['B'],
          guidance: null,
        }),
      })
      .execute();
    await schoolYear
      .insertInto('exam_variants')
      .values({
        exam_id: exam.id,
        code: '101',
        items: JSON.stringify([
          { question_id: question.id, number: 1, option_order: ['A', 'B', 'C', 'D'], answer: ['B'] },
        ]),
      })
      .execute();
    await schoolYear
      .insertInto('question_usages')
      .values({ question_id: question.id, exam_id: exam.id, used_on: '2026-10-20' })
      .execute();

    // Hiệu trưởng bật xem camera trực tiếp và ghi hình ở cấu hình thi trực tuyến (mặc định tắt)
    await openMenu(page, '/online-exams/settings');
    await expect(page.getByLabel('Cho phép giáo viên xem camera trực tiếp')).not.toBeChecked();
    await expect(page.getByLabel('Cho phép ghi hình camera')).not.toBeChecked();
    await page.getByLabel('Cho phép giáo viên xem camera trực tiếp').check();
    await page.getByLabel('Cho phép ghi hình camera').check();
    await page.getByRole('button', { name: 'Ghi chế độ thi' }).click();
    await expect(toast(page, 'Đã ghi chế độ thi của trường')).toBeVisible();

    const account = await issueAccount(principal, child.id);

    // Phụ huynh đồng ý trên ứng dụng phụ huynh
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(PARENT_APP);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const childCard = parentPage.getByRole('listitem', { name: childName });
    await childCard.getByRole('button', { name: 'Giám sát thi trực tuyến' }).click();
    const consentPanel = childCard.getByRole('region', { name: `Đồng ý giám sát thi của ${childName}` });
    for (const scope of ['Giáo viên coi thi xem camera trực tiếp', 'Ghi hình camera trong lúc thi']) {
      const row = consentPanel.getByRole('listitem', { name: scope });
      await expect(row).toContainText('Chưa đồng ý');
      await row.getByRole('button', { name: 'Đồng ý' }).click();
      await expect(row).toContainText('Đã đồng ý');
    }

    // Giáo viên giao đề có giám sát (ô chọn chỉ hiện khi trường đã bật), mở phòng thi
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/online-exams');
    const assign = teacherPage.getByRole('region', { name: 'Giao đề thi trực tuyến' });
    await assign.getByLabel('Đề đã khoá').selectOption({ label: `${examTitle} (Toán K6)` });
    await assign.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await assign.getByLabel('Phát mã đề').selectOption({ label: 'Một mã đề cố định' });
    await assign.getByLabel('Mã đề', { exact: true }).fill('101');
    await assign.getByLabel('Hiện kết quả').selectOption({ label: 'Hiện ngay sau khi nộp' });
    await assign.getByLabel('Loại điểm').selectOption({ label: 'Giữa kỳ' });
    await assign.getByLabel(/Giáo viên xem camera trực tiếp/).check();
    await assign.getByLabel(/Ghi hình camera/).check();
    await assign.getByRole('button', { name: 'Giao đề' }).click();
    await expect(toast(teacherPage, `Đã giao đề "${examTitle}"`)).toBeVisible();
    await openMenu(teacherPage, '/online-exams/monitor');
    await teacherPage.getByLabel('Bài thi', { exact: true }).selectOption({ label: `${examTitle} (Toán)` });
    await expect(teacherPage.getByRole('region', { name: 'Đồng ý của cha mẹ' })).toContainText(childName);
    await expect(teacherPage.getByRole('table', { name: 'Tình trạng đồng ý' })).toContainText('Đã đồng ý (ứng dụng)');
    await teacherPage.getByRole('button', { name: 'Mở phòng thi' }).click();
    await expect(toast(teacherPage, 'Đã mở phòng thi')).toBeVisible();
    const roomCode = (await teacherPage.getByLabel('Mã phòng thi').first().innerText()).trim();

    // Học sinh: phải đọc thông báo giám sát mới vào được
    const studentContext = await browser.newContext({ permissions: ['camera'] });
    const student = await studentContext.newPage();
    await student.goto(`${STUDENT_URL}/`);
    await student.getByLabel('Tên đăng nhập').fill(account.username);
    await student.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
    await student.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(student.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
    await student.getByLabel('Mật khẩu mới', { exact: true }).fill(`MatKhauMoi${suffix}`);
    await student.getByLabel('Nhập lại mật khẩu mới').fill(`MatKhauMoi${suffix}`);
    await student.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await student.getByRole('article', { name: examTitle }).getByRole('button', { name: 'Vào làm bài' }).click();
    await expect(student.getByRole('region', { name: 'Điều cần biết trước khi làm bài' })).toContainText(
      'giáo viên coi thi có thể xem hình camera của em trực tiếp',
    );
    const startButton = student.getByRole('button', { name: 'Bắt đầu làm bài' });
    await student.getByLabel('Mã phòng thi').fill(roomCode);
    await expect(startButton).toBeDisabled();
    await student.getByLabel('Em đã đọc thông báo giám sát bằng camera').check();
    await startButton.click();
    await expect(student.getByRole('timer')).toBeVisible();
    await student.getByRole('group', { name: 'Đáp án Câu 1' }).getByLabel(/^B\./).check();
    await expect(student.getByText(/Đã lưu lúc/)).toBeVisible();

    // Giáo viên xem camera trực tiếp của học sinh đang làm bài (WebRTC giữa hai trình duyệt)
    await teacherPage.reload();
    await teacherPage.getByLabel('Bài thi', { exact: true }).selectOption({ label: `${examTitle} (Toán)` });
    const grid = teacherPage.getByRole('region', { name: 'Camera trực tiếp' });
    await grid.getByRole('button', { name: `Xem camera của ${childName}` }).click();
    const tile = grid.getByRole('figure', { name: `Camera của ${childName}` });
    await expect(tile).toContainText('Đang xem', { timeout: 60_000 });
    await expect(
      student.getByRole('status').filter({ hasText: 'Giáo viên coi thi đang xem camera của em' }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(
        async () => tile.locator('video').evaluate((video) => (video as unknown as { videoWidth: number }).videoWidth),
        {
          timeout: 30_000,
        },
      )
      .toBeGreaterThan(0);
    await tile.getByRole('button', { name: 'Ngừng xem' }).click();
    await expect(
      student.getByRole('status').filter({ hasText: 'Giáo viên coi thi đang xem camera của em' }),
    ).toBeHidden({
      timeout: 30_000,
    });

    // Học sinh nộp bài; đoạn bản ghi cuối lên kho trước khi nộp
    await student.getByRole('button', { name: 'Nộp bài' }).first().click();
    await student
      .getByRole('alertdialog', { name: 'Xác nhận nộp bài' })
      .getByRole('button', { name: 'Xác nhận nộp bài' })
      .click();
    await expect(student.getByRole('heading', { name: 'Đã nộp bài' })).toBeVisible();
    const attempt = await schoolYear
      .selectFrom('exam_attempts')
      .select(['id', 'proctor_notice_at'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect(attempt.proctor_notice_at).not.toBeNull();
    await expect
      .poll(
        async () =>
          (
            await schoolYear
              .selectFrom('exam_recording_chunks')
              .select('seq')
              .where('attempt_id', '=', attempt.id)
              .execute()
          ).length,
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    // Giáo viên xem lại bản ghi; nhật ký người xem có cả xem trực tiếp lẫn xem lại
    await openMenu(teacherPage, '/online-exams/monitor');
    await teacherPage.getByLabel('Bài thi', { exact: true }).selectOption({ label: `${examTitle} (Toán)` });
    await teacherPage
      .getByRole('table', { name: 'Học sinh được giao' })
      .getByRole('row', { name: new RegExp(childName) })
      .getByRole('button', { name: `Xem bài ${childName} lần 1` })
      .click();
    const panel = teacherPage.getByRole('region', { name: 'Giám sát bằng camera' });
    await expect(panel).toContainText('Bản ghi:');
    await panel.getByRole('button', { name: 'Xem lại bản ghi' }).click();
    await expect(panel.getByLabel('Bản ghi camera')).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Nhật ký người xem' })).toContainText('xem trực tiếp');
    await expect
      .poll(async () => panel.getByRole('list', { name: 'Nhật ký người xem' }).innerText(), { timeout: 20_000 })
      .toContain('xem lại bản ghi');
  } finally {
    // Trả cấu hình giám sát và công tắc theo cấp về mặc định để lần chạy lại và kịch bản khác không bị ảnh hưởng
    await schoolYear
      .updateTable('online_exam_school_settings')
      .set({ allow_live_proctoring: false, allow_recording: false })
      .execute();
    await schoolYear.deleteFrom('online_exam_settings').execute();
    await setSecondaryEnabled(page, false);
  }
});

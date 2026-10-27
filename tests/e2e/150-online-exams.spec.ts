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
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
} from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211), kịch bản CT-23a-10: trường bật THCS; có đề đã khoá của 22g1 (nhiều
// lựa chọn, đúng sai, trả lời ngắn, tự luận); trường cấp tài khoản học và thi cho học sinh; giáo viên giao đề; học sinh đăng
// nhập ở kênh student, đặt mật khẩu mới, làm bài ở chế độ toàn màn hình với camera giả (nhận diện khuôn mặt chạy ngay trên
// máy), tải lại trang vẫn làm tiếp được, thoát toàn màn hình bị ghi lại, nộp bài; giáo viên theo dõi, chấm tự luận; Hiệu trưởng
// khoá điểm, chuyển vào sổ điểm theo luồng 22g2. Cuối kịch bản tắt lại THCS. Dữ liệu giả
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const IDENTITY_API = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const MAIN_API = `http://localhost:${E2E_API_PORT}/api/v1`;
const PARENT_APP = `http://localhost:${E2E_PARENT_PORT}`;

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

// "Khởi tạo" tài khoản học và thi của học sinh bằng quyền của Hiệu trưởng; mật khẩu chỉ hiện một lần ở phản hồi này
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

test('CT-23a-10: giao đề, học sinh làm bài toàn màn hình có camera, theo dõi, chấm tự luận, khoá điểm, chuyển sổ điểm', async ({
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
    const className = `Lớp 6T ${suffix}`;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `6T-${suffix}`,
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
    const childName = `Học Sinh Thi Online ${suffix}`;
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: childName,
        dob: '2014-06-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '3333',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();

    // Đề đã khoá (chèn thẳng): nhiều lựa chọn 2 điểm (mã 101 đáp án B), đúng sai 2 điểm, trả lời ngắn 2 điểm, tự luận 4 điểm
    const specs = [
      {
        type: 'multiple_choice',
        level: 'recognition',
        score: 2,
        answer: ['B'],
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Phương án ${key}` })),
      },
      {
        type: 'true_false',
        level: 'comprehension',
        score: 2,
        answer: ['Đ', 'S', 'Đ', 'S'],
        options: ['a', 'b', 'c', 'd'].map((key) => ({ key, content: `Ý ${key}` })),
      },
      { type: 'short_answer', level: 'application', score: 2, answer: ['12,5'], options: [] },
      { type: 'essay', level: 'high_application', score: 4, answer: [] as string[], options: [] },
    ] as const;
    const questionIds: string[] = [];
    for (const spec of specs) {
      const row = await schoolYear
        .insertInto('questions')
        .values({
          school_level: 'THCS',
          subject_id: subject.id,
          grade_level_code: 'K6',
          cognitive_level: spec.level,
          question_type: spec.type,
          content: `Câu ${spec.type} ${suffix}`,
          options: JSON.stringify(spec.options),
          answer: JSON.stringify(spec.answer),
          score: spec.score,
          status: 'approved',
          author_user_id: teacher.id,
          author_name: `Cô Toán ${suffix}`,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      questionIds.push(row.id);
    }
    const examTitle = `Đề thi trực tuyến ${suffix}`;
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
      .values(
        specs.map((spec, index) => ({
          exam_id: exam.id,
          question_id: questionIds[index] as string,
          order_no: index + 1,
          score: spec.score,
          snapshot: JSON.stringify({
            content: `Câu ${spec.type} ${suffix}`,
            question_type: spec.type,
            cognitive_level: spec.level,
            topic_name: 'Số tự nhiên',
            options: spec.options,
            answer: spec.answer,
            guidance: null,
          }),
        })),
      )
      .execute();
    await schoolYear
      .insertInto('exam_variants')
      .values({
        exam_id: exam.id,
        code: '101',
        items: JSON.stringify(
          specs.map((spec, index) => ({
            question_id: questionIds[index],
            number: index + 1,
            option_order: spec.type === 'multiple_choice' ? ['A', 'B', 'C', 'D'] : [],
            answer: spec.type === 'multiple_choice' ? ['B'] : spec.answer,
          })),
        ),
      })
      .execute();
    await schoolYear
      .insertInto('question_usages')
      .values(questionIds.map((id) => ({ question_id: id, exam_id: exam.id, used_on: '2026-10-20' })))
      .execute();

    // Hiệu trưởng: cấu hình thi trực tuyến, học sinh đăng nhập làm bài bật ở mọi cấp
    await openMenu(page, '/online-exams/settings');
    await expect(page.getByRole('heading', { name: '3. Cấu hình thi trực tuyến' })).toBeVisible();
    const toggles = page.getByRole('checkbox', { name: /^Cho học sinh .* đăng nhập làm bài$/ });
    await expect(toggles).toHaveCount(3);
    for (const toggle of await toggles.all()) {
      await expect(toggle).toBeChecked();
    }

    const account = await issueAccount(principal, child.id);

    // Giáo viên: giao đề cho lớp
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/online-exams');
    const assign = teacherPage.getByRole('region', { name: 'Giao đề thi trực tuyến' });
    await assign.getByLabel('Đề đã khoá').selectOption({ label: `${examTitle} (Toán K6)` });
    await assign.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await assign.getByLabel('Phát mã đề').selectOption({ label: 'Một mã đề cố định' });
    await assign.getByLabel('Mã đề', { exact: true }).fill('101');
    await assign.getByLabel('Hiện kết quả').selectOption({ label: 'Hiện ngay sau khi nộp' });
    await assign.getByLabel('Đảo thứ tự câu hỏi').uncheck();
    await assign.getByLabel('Đảo thứ tự đáp án').uncheck();
    await assign.getByLabel('Loại điểm').selectOption({ label: 'Giữa kỳ' });
    await assign.getByRole('button', { name: 'Giao đề' }).click();
    await expect(toast(teacherPage, `Đã giao đề "${examTitle}"`)).toBeVisible();
    await expect(
      teacherPage.getByRole('table', { name: 'Bài thi đã giao' }).getByRole('row', { name: new RegExp(examTitle) }),
    ).toContainText('Đang mở');

    // Chế độ mặc định là thi tại trường: giám thị (giáo viên) mở phòng thi, đọc mã cho học sinh
    await openMenu(teacherPage, '/online-exams/monitor');
    await teacherPage.getByLabel('Bài thi', { exact: true }).selectOption({ label: `${examTitle} (Toán)` });
    await teacherPage.getByRole('button', { name: 'Mở phòng thi' }).click();
    await expect(toast(teacherPage, 'Đã mở phòng thi')).toBeVisible();
    const roomCode = (await teacherPage.getByLabel('Mã phòng thi').first().innerText()).trim();
    expect(roomCode).toMatch(/^\d{6}$/);

    // Học sinh: đăng nhập ở kênh student, đặt mật khẩu mới, làm bài (camera giả, toàn màn hình)
    const studentContext = await browser.newContext({ permissions: ['camera'] });
    const student = await studentContext.newPage();
    await student.goto(`${PARENT_APP}/#hoc-sinh`);
    await student.getByLabel('Tên đăng nhập').fill(account.username);
    await student.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
    await student.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(student.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
    await student.getByLabel('Mật khẩu mới', { exact: true }).fill(`MatKhauMoi${suffix}`);
    await student.getByLabel('Nhập lại mật khẩu mới').fill(`MatKhauMoi${suffix}`);
    await student.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    const card = student.getByRole('article', { name: examTitle });
    await expect(card).toContainText('Đang mở');
    await card.getByRole('button', { name: 'Vào làm bài' }).click();
    await expect(student.getByRole('region', { name: 'Điều cần biết trước khi làm bài' })).toContainText(
      'không gửi hình hay video lên máy chủ',
    );
    const startButton = student.getByRole('button', { name: 'Bắt đầu làm bài' });
    await expect(startButton).toBeDisabled();
    await student.getByLabel('Mã phòng thi').fill('000000');
    await startButton.click();
    await expect(student.getByRole('alert')).toContainText('Mã phòng thi không đúng');
    await student.getByLabel('Mã phòng thi').fill(roomCode);
    await startButton.click();
    await expect(student.getByRole('timer')).toBeVisible();
    await expect(student.getByRole('region', { name: 'Câu 1' })).not.toContainText('Đáp án đúng');

    const answerAll = async () => {
      await student.getByRole('group', { name: 'Đáp án Câu 1' }).getByLabel(/^B\./).check();
      await student.getByLabel('Câu 2 ý a đúng').check();
      await student.getByLabel('Câu 2 ý b sai').check();
      await student.getByLabel('Câu 2 ý c đúng').check();
      await student.getByLabel('Câu 2 ý d sai').check();
      await student.getByLabel('Đáp số Câu 3').fill('12,5');
      await student.getByLabel('Bài làm Câu 4').fill('Bài tự luận của em');
    };
    await answerAll();
    await expect(student.getByText(/Đã lưu lúc/)).toBeVisible();

    // Tải lại trang: vẫn đăng nhập, vào làm tiếp, câu đã chọn còn nguyên, đồng hồ theo máy chủ
    await student.reload();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await expect(student.getByRole('article', { name: examTitle })).toContainText('Đang làm dở');
    await student.getByRole('article', { name: examTitle }).getByRole('button', { name: 'Làm tiếp bài' }).click();
    await student.getByLabel('Mã phòng thi').fill(roomCode);
    await student.getByRole('button', { name: 'Làm tiếp bài' }).click();
    await expect(student.getByRole('timer')).toBeVisible();
    await expect(student.getByRole('group', { name: 'Đáp án Câu 1' }).getByLabel(/^B\./)).toBeChecked();
    await expect(student.getByLabel('Bài làm Câu 4')).toHaveValue('Bài tự luận của em');

    // Thoát toàn màn hình được ghi lại; học sinh quay lại toàn màn hình
    // Tệp kiểm thử không nạp kiểu của trình duyệt; đoạn này chạy trong trang
    await student.evaluate(() =>
      (globalThis as unknown as { document: { exitFullscreen(): Promise<void> } }).document.exitFullscreen(),
    );
    const overlay = student.getByRole('alertdialog', { name: 'Quay lại toàn màn hình' });
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button', { name: 'Quay lại toàn màn hình' }).click();
    await expect(overlay).toBeHidden();
    const attempt = await schoolYear
      .selectFrom('exam_attempts')
      .select('id')
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    await expect
      .poll(
        async () =>
          (
            await schoolYear
              .selectFrom('exam_attempt_events')
              .select('event_type')
              .where('attempt_id', '=', attempt.id)
              .execute()
          ).map((row) => row.event_type),
        { timeout: 20_000 },
      )
      .toContain('fullscreen_exit');
    // Camera giả không có khuôn mặt: bộ nhận diện chạy ngay trên máy, máy chủ chỉ nhận sự kiện (không nhận hình)
    await expect
      .poll(
        async () =>
          (
            await schoolYear
              .selectFrom('exam_attempt_events')
              .select('event_type')
              .where('attempt_id', '=', attempt.id)
              .execute()
          ).map((row) => row.event_type),
        { timeout: 120_000, intervals: [2_000] },
      )
      .toContain('no_face');

    await student.getByRole('button', { name: 'Nộp bài' }).first().click();
    await student
      .getByRole('alertdialog', { name: 'Xác nhận nộp bài' })
      .getByRole('button', { name: 'Xác nhận nộp bài' })
      .click();
    await expect(student.getByRole('heading', { name: 'Đã nộp bài' })).toBeVisible();
    await expect(student.getByText(/đang chờ giáo viên chấm/)).toBeVisible();
    await student.getByRole('button', { name: 'Về danh sách bài thi' }).click();
    await expect(student.getByRole('article', { name: examTitle })).toContainText('Đã xong hoặc đã đóng');

    // Giáo viên theo dõi: học sinh đã nộp, số lần rời bài, sự kiện; chấm câu tự luận
    await openMenu(teacherPage, '/online-exams/monitor');
    await teacherPage.getByLabel('Bài thi', { exact: true }).selectOption({ label: `${examTitle} (Toán)` });
    const row = teacherPage
      .getByRole('table', { name: 'Học sinh được giao' })
      .getByRole('row', { name: new RegExp(childName) });
    // Trang theo dõi vẫn mở từ lúc mở phòng thi (mở lại menu cùng trang không tải lại) và tự tải lại 15 giây một lần: lần tải ngay
    // trước khi nộp thì phải chờ lần kế tiếp
    await expect(row).toContainText('Đã nộp', { timeout: 20_000 });
    await expect(row).toContainText(/Thoát toàn màn hình: [1-9]/);
    await expect(row).toContainText('Không thấy khuôn mặt trong khung hình');
    await row.getByRole('button', { name: `Xem bài ${childName} lần 1` }).click();
    const panel = teacherPage.getByRole('region', { name: `Bài làm của ${childName}` });
    await expect(panel).toContainText('Bài tự luận của em');
    await expect(panel).toContainText('chờ chấm tự luận');
    await panel.getByLabel('Điểm câu 4').fill('3');
    await panel.getByRole('button', { name: 'Lưu điểm tự luận' }).click();
    await expect(toast(teacherPage, 'Đã lưu điểm tự luận')).toBeVisible();
    // 2 + 2 + 2 + 3
    await expect(panel).toContainText('Điểm: 9 / 10');
    await expect(panel).toContainText('đã vào phiếu chấm 8.5');

    // Hiệu trưởng: khoá điểm, chuyển vào sổ điểm theo luồng 22g2
    await openMenu(page, '/exam-grading');
    await page
      .getByRole('table', { name: 'Bài kiểm tra của lớp' })
      .getByRole('row', { name: new RegExp(className) })
      .getByRole('button', { name: 'Mở' })
      .click();
    const review = page.getByRole('region', { name: `Bài kiểm tra ${examTitle} lớp ${className}` });
    await expect(review.getByRole('table', { name: 'Bài làm của học sinh' })).toContainText('9');
    await review.getByRole('button', { name: 'Khoá điểm' }).click();
    await expect(toast(page, 'Đã khoá điểm bài kiểm tra')).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await review.getByRole('button', { name: 'Chuyển vào sổ điểm' }).click();
    await expect(toast(page, 'Đã chuyển 1 điểm vào sổ điểm')).toBeVisible();
    const entry = await schoolYear
      .selectFrom('score_entries')
      .select(['score', 'kind', 'source'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect([Number(entry.score), entry.kind, entry.source]).toEqual([9, 'mid', 'exam']);

    // Hiệu trưởng tắt thi trực tuyến cho cấp THCS: học sinh không vào được nữa
    await openMenu(page, '/online-exams/settings');
    // Ô chọn đổi trạng thái sau khi máy chủ ghi xong nên bấm rồi chờ thông báo
    await page.getByRole('checkbox', { name: /^Cho học sinh .*(THCS|Trung học cơ sở).* đăng nhập làm bài$/ }).click();
    await expect(toast(page, 'Đã tắt đăng nhập làm bài của học sinh cấp này')).toBeVisible();
    await student.reload();
    await expect(student.getByText('Nhà trường chưa mở thi trực tuyến cho học sinh cấp học này')).toBeVisible();
  } finally {
    // Trả công tắc theo cấp về mặc định (bật) để lần chạy lại không bị ảnh hưởng
    await schoolYear.deleteFrom('online_exam_settings').execute();
    await setSecondaryEnabled(page, false);
  }
});

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

// Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213), kịch bản CT-23c-7: giáo viên chủ nhiệm mở Trò chơi trong công cụ
// lớp học, lấy câu đã duyệt của khối, chơi hỏi đáp theo vòng rồi chuyển điểm nhóm sang Bảng điểm; thẻ đáp án giấy: in thẻ (không
// in họ tên), nhập đáp án của từng số thẻ (thay cho quét camera), chấm và lưu; ô chữ từ câu trả lời ngắn. Kết quả vào lịch sử sử
// dụng câu hỏi kèm tỷ lệ đúng. Dữ liệu giả
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

test('CT-23c-7: hỏi đáp theo vòng, thẻ đáp án giấy, ô chữ; kết quả vào lịch sử sử dụng câu hỏi', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id', 'grade_level', 'school_level'])
    .executeTakeFirstOrThrow();
  const grade = `TC${suffix}`;
  // Trò chơi kiến thức chỉ có ở lớp cấp phổ thông (Hộp công cụ giảng dạy, DT-29, YCTD-325): lớp thử là lớp Tiểu học
  const level = 'TH';
  const className = `Lớp trò chơi ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `TC-${suffix}`,
      name: className,
      grade_level: grade,
      school_level: level,
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const names = ['Học sinh An', 'Học sinh Bình', 'Học sinh Chi'].map((name) => `${name} ${suffix}`);
  const childIds: string[] = [];
  for (const [index, name] of names.entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2018-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `tc-${suffix}-${index}`,
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
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }] });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
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
  // Ngân hàng câu hỏi đã duyệt của khối giả: ba câu nhiều lựa chọn (đáp án B), hai câu trả lời ngắn; một câu nháp không được dùng
  const subject = await schoolYear
    .insertInto('subjects')
    .values({ code: `TC-${suffix}`, name: `Môn trò chơi ${suffix}`, school_level: level })
    .returning('id')
    .executeTakeFirstOrThrow();
  const questionIds: string[] = [];
  const insertQuestion = async (
    type: 'multiple_choice' | 'short_answer',
    content: string,
    answer: string[],
    status: 'approved' | 'draft' = 'approved',
  ) => {
    const row = await schoolYear
      .insertInto('questions')
      .values({
        school_level: level,
        subject_id: subject.id,
        grade_level_code: grade,
        cognitive_level: 'recognition',
        question_type: type,
        content,
        options: JSON.stringify(
          type === 'multiple_choice' ? ['A', 'B', 'C', 'D'].map((key) => ({ key, content: `Lựa chọn ${key}` })) : [],
        ),
        answer: JSON.stringify(answer),
        score: 1,
        status,
        author_user_id: teacher.id,
        author_name: teacherName,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    questionIds.push(row.id);
  };
  for (let index = 1; index <= 3; index += 1)
    await insertQuestion('multiple_choice', `Câu trắc nghiệm ${index} ${suffix}`, ['B']);
  await insertQuestion('short_answer', `Thủ đô của Việt Nam ${suffix}`, ['Hà Nội']);
  await insertQuestion('short_answer', `Thành phố cảng phía Bắc ${suffix}`, ['Hải Phòng']);
  await insertQuestion('multiple_choice', `Câu nháp ${suffix}`, ['A'], 'draft');

  const page = await signIn(browser, teacher);
  await page.getByRole('button', { name: 'Hộp công cụ giảng dạy' }).click();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
  await page.getByRole('tab', { name: 'Trò chơi kiến thức' }).click();
  const games = page.getByRole('region', { name: 'Trò chơi' });
  await expect(games.getByLabel('Môn')).toContainText(`Môn trò chơi ${suffix}`);

  // Hỏi đáp theo vòng: hai câu, Đội 1 đúng cả hai
  await games.getByRole('radio', { name: /Hỏi đáp theo vòng/ }).click();
  await games.getByLabel('Môn').selectOption({ label: `Môn trò chơi ${suffix}` });
  await games.getByLabel('Số câu').fill('2');
  await games.getByRole('button', { name: 'Lấy câu hỏi' }).click();
  await games.getByRole('button', { name: /Bắt đầu với 2 câu/ }).click();
  const playing = page.getByRole('region', { name: 'Trò chơi đang chơi' });
  await playing.getByLabel('Số vòng').fill('2');
  await playing.getByRole('button', { name: 'Vào vòng 1' }).click();
  for (let question = 0; question < 2; question += 1) {
    await playing.getByRole('button', { name: 'Mở đáp án' }).click();
    await expect(playing.getByRole('status')).toContainText('Đáp án:');
    await playing.getByRole('button', { name: 'Đội 1 đúng' }).click();
    await playing.getByRole('button', { name: question === 0 ? 'Câu tiếp' : 'Kết thúc và lưu' }).click();
  }
  await expect(games.getByText('Đã lưu kết quả lượt chơi')).toBeVisible();
  // Vòng 1 một điểm, vòng 2 hai điểm
  await expect(games.getByLabel('Điểm lượt vừa chơi')).toContainText('Đội 1: 3');
  await games.getByRole('button', { name: 'Chuyển điểm nhóm sang Bảng điểm' }).click();
  await expect(games.getByText(/Đã chuyển 1 dòng điểm sang Bảng điểm/)).toBeVisible();
  const board = await page.evaluate(() => localStorage.getItem('cong-cu-lop-hoc:bang-diem') ?? '');
  expect(board).toContain('Đội 1');

  // Thẻ đáp án giấy: bản in không có họ tên; nhập tay đáp án của ba số thẻ, chấm, lưu
  await games.getByRole('radio', { name: /Thẻ đáp án giấy/ }).click();
  await games.getByLabel('Số câu').fill('1');
  await games.getByRole('button', { name: 'Lấy câu hỏi' }).click();
  await games.getByRole('button', { name: /Bắt đầu với 1 câu/ }).click();
  const [printPage] = await Promise.all([
    page.waitForEvent('popup'),
    playing.getByRole('button', { name: 'In thẻ (12 thẻ một trang)' }).click(),
  ]);
  await expect(printPage.getByLabel('Thẻ số 1')).toBeVisible();
  await expect(printPage.getByLabel('Thẻ số 3')).toBeVisible();
  expect(await printPage.content()).not.toContain(names[0] as string);
  await printPage.close();
  await playing.getByLabel('Đáp án của số 1').selectOption('B');
  await playing.getByLabel('Đáp án của số 2').selectOption('B');
  await playing.getByLabel('Đáp án của số 3').selectOption('C');
  await playing.getByRole('button', { name: 'Chấm câu này' }).click();
  await expect(playing.getByText(/Đã nhận 3 \/ 3 thẻ; đúng 2 \(67%\)/)).toBeVisible();
  await playing.getByRole('button', { name: 'Kết thúc và lưu' }).click();
  await expect(games.getByText('Đã lưu kết quả lượt chơi')).toBeVisible();

  // Ô chữ từ câu trả lời ngắn: mở một hàng cho Đội 2
  await games.getByRole('radio', { name: /Ô chữ/ }).click();
  await games.getByLabel('Số câu').fill('5');
  await games.getByRole('button', { name: 'Lấy câu hỏi' }).click();
  await games.getByRole('button', { name: /Bắt đầu với 2 câu/ }).click();
  await expect(playing.getByRole('table', { name: 'Lưới ô chữ' })).toContainText('H');
  await playing.getByRole('button', { name: 'Bắt đầu chơi (ẩn chữ)' }).click();
  await playing.getByRole('button', { name: 'Chọn hàng này' }).first().click();
  await playing.getByRole('button', { name: 'Đội 2 đúng' }).click();
  await playing.getByRole('button', { name: 'Kết thúc và lưu' }).click();
  await expect(games.getByText('Đã lưu kết quả lượt chơi')).toBeVisible();

  // Lịch sử sử dụng câu hỏi: ba lượt chơi, câu thẻ đáp án có tỷ lệ đúng 66,67%; câu nháp không được dùng
  const sessions = await schoolYear
    .selectFrom('classroom_game_sessions')
    .select(['id', 'kind'])
    .where('class_id', '=', classRow.id)
    .execute();
  expect(sessions.map((row) => row.kind).sort()).toEqual(['answer_cards', 'crossword', 'quiz_rounds']);
  const cards = sessions.find((row) => row.kind === 'answer_cards');
  const usage = await schoolYear
    .selectFrom('question_usages')
    .select(['source', 'attempts', 'correct_rate'])
    .where('game_session_id', '=', cards?.id ?? '')
    .executeTakeFirstOrThrow();
  expect(usage.source).toBe('game');
  expect(usage.attempts).toBe(3);
  expect(Number(usage.correct_rate)).toBeCloseTo(66.67, 2);
  const answers = await schoolYear
    .selectFrom('classroom_game_answers')
    .select(['child_id', 'answer', 'correct'])
    .where('session_id', '=', cards?.id ?? '')
    .orderBy('answer')
    .execute();
  expect(answers.filter((row) => row.correct).length).toBe(2);
  expect(answers.every((row) => childIds.includes(row.child_id ?? ''))).toBe(true);
  const draftUsed = await schoolYear
    .selectFrom('question_usages')
    .select('id')
    .where('question_id', '=', questionIds.at(-1) as string)
    .execute();
  expect(draftUsed).toHaveLength(0);
});

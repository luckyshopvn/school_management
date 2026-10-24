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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173), kịch bản CT-22g2-7: trường bật THCS; có đề đã khoá của 22g1 (chèn thẳng:
// nhiều lựa chọn, đúng sai, tự luận; hai mã đề); giáo viên tạo bài kiểm tra giữa kỳ của lớp, tải phiếu trả lời, nhập bài;
// Hiệu trưởng khoá điểm, chuyển vào sổ điểm, xem báo cáo. Cuối kịch bản tắt lại THCS. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

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

test('CT-22g2-7: tạo bài kiểm tra của lớp, phiếu trả lời, nhập bài, khoá điểm, chuyển sổ điểm, báo cáo', async ({
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
    // Môn Toán của chương trình mặc định THCS (sổ điểm đọc môn theo chương trình của lớp)
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
    const className = `Lớp 6E ${suffix}`;
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `6E-${suffix}`,
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
    const childName = `Học Sinh Chấm Bài ${suffix}`;
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: childName,
        dob: '2014-06-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '2222',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-01-01' })
      .execute();
    const specs = [
      { type: 'multiple_choice', level: 'recognition', score: 2, answer: ['B'] },
      { type: 'true_false', level: 'comprehension', score: 2, answer: ['Đ', 'S', 'Đ', 'S'] },
      { type: 'essay', level: 'application', score: 6, answer: [] },
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
          options: JSON.stringify([]),
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
    const examTitle = `Đề chấm ${suffix}`;
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
            options: [],
            answer: spec.answer,
            guidance: null,
          }),
        })),
      )
      .execute();
    const items = (first: string) =>
      JSON.stringify(
        specs.map((spec, index) => ({
          question_id: questionIds[index],
          number: index + 1,
          option_order: spec.type === 'multiple_choice' ? ['A', 'B', 'C', 'D'] : [],
          answer: spec.type === 'multiple_choice' ? [first] : spec.answer,
        })),
      );
    await schoolYear
      .insertInto('exam_variants')
      .values([
        { exam_id: exam.id, code: '101', items: items('B') },
        { exam_id: exam.id, code: '102', items: items('D') },
      ])
      .execute();
    await schoolYear
      .insertInto('question_usages')
      .values(questionIds.map((id) => ({ question_id: id, exam_id: exam.id, used_on: '2026-10-20' })))
      .execute();

    // Giáo viên: 8.5 tạo bài kiểm tra giữa kỳ của lớp, tải phiếu trả lời, nhập bài
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/exam-grading');
    const create = teacherPage.getByRole('region', { name: 'Tạo bài kiểm tra của lớp' });
    await create.getByLabel('Đề đã khoá').selectOption({ label: `${examTitle} (Toán K6)` });
    await create.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await create.getByLabel('Loại điểm').selectOption({ label: 'Giữa kỳ' });
    await create.getByRole('button', { name: 'Tạo bài kiểm tra' }).click();
    await expect(toast(teacherPage, `Đã tạo bài kiểm tra lớp ${className}`)).toBeVisible();
    const panel = teacherPage.getByRole('region', { name: `Bài kiểm tra ${examTitle} lớp ${className}` });
    const sheetDownload = teacherPage.waitForEvent('download');
    await panel.getByRole('button', { name: 'Tải phiếu trả lời' }).click();
    expect((await sheetDownload).suggestedFilename()).toBe('phieu-tra-loi.pdf');
    const sheets = panel.getByRole('table', { name: 'Bài làm của học sinh' });
    await sheets
      .getByRole('row', { name: new RegExp(childName) })
      .getByRole('button', { name: 'Nhập bài' })
      .click();
    const editor = panel.getByRole('region', { name: `Bài của ${childName}` });
    await editor.getByLabel('Mã đề').selectOption('101');
    await editor.getByLabel('Câu 1', { exact: true }).fill('B');
    await editor.getByLabel('Câu 2', { exact: true }).fill('ĐSĐĐ');
    await editor.getByLabel('Câu 3 người chấm 1').fill('4,5');
    await editor.getByRole('button', { name: 'Lưu bài' }).click();
    await expect(toast(teacherPage, `Đã lưu bài của ${childName}`)).toBeVisible();
    // 2 + 0,5 × 2 (đúng sai 3 ý) + 4,5
    await expect(sheets.getByRole('row', { name: new RegExp(childName) })).toContainText('7.5');

    // Hiệu trưởng: khoá điểm, chuyển vào sổ điểm, xem báo cáo
    await openMenu(page, '/exam-grading');
    await page
      .getByRole('table', { name: 'Bài kiểm tra của lớp' })
      .getByRole('row', { name: new RegExp(className) })
      .getByRole('button', { name: 'Mở' })
      .click();
    const review = page.getByRole('region', { name: `Bài kiểm tra ${examTitle} lớp ${className}` });
    await review.getByRole('button', { name: 'Khoá điểm' }).click();
    await expect(toast(page, 'Đã khoá điểm bài kiểm tra')).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await review.getByRole('button', { name: 'Chuyển vào sổ điểm' }).click();
    await expect(toast(page, 'Đã chuyển 1 điểm vào sổ điểm')).toBeVisible();
    await expect(review.getByRole('heading')).toContainText('Đã chuyển sổ điểm');
    const entry = await schoolYear
      .selectFrom('score_entries')
      .select(['score', 'kind', 'source'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect([Number(entry.score), entry.kind, entry.source]).toEqual([7.5, 'mid', 'exam']);

    await openMenu(page, '/exam-reports');
    await page.getByLabel('Đề', { exact: true }).selectOption({ label: `${examTitle} (Toán K6)` });
    await expect(page.getByText('1 bài đã khoá; điểm trung bình 7.5')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Kết quả theo câu' }).getByRole('row')).toHaveCount(4);
    await expect(page.getByRole('table', { name: 'Kết quả theo lớp' })).toContainText(className);
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất Excel' }).click();
    expect((await reportDownload).suggestedFilename()).toBe('bao-cao-ket-qua-kiem-tra.xlsx');
  } finally {
    await setSecondaryEnabled(page, false);
  }
});

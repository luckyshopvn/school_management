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

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168), kịch bản CT-22g1-9: trường bật THCS; Hiệu trưởng soạn và duyệt
// câu hỏi, lập ma trận, kế hoạch kiểm tra, giao đề; giáo viên bốc câu theo ma trận, trộn mã đề, gửi thẩm định; Hiệu trưởng
// duyệt, khoá đề, tải đề. Cuối kịch bản tắt lại THCS. Dữ liệu giả
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

test('CT-22g1-9: ngân hàng câu hỏi, ma trận, kế hoạch, giao đề, bốc câu, trộn mã đề, thẩm định, khoá, tải đề', async ({
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
  const teacherName = `Thầy Toán ${suffix}`;
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
  const subjectName = `Toán ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `6G-${suffix}`,
      name: `Lớp 6G ${suffix}`,
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
      staff_name: teacherName,
      assignment_role: 'subject',
      subject_name: subjectName,
      subject_id: subject.id,
      from_date: '2026-01-01',
    })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, principal);
  await setSecondaryEnabled(page, true);
  try {
    // 8.1 Ngân hàng câu hỏi: chủ đề; hai câu nhiều lựa chọn, một câu tự luận; gửi thẩm định, duyệt
    await openMenu(page, '/question-bank');
    await page.getByLabel('Môn', { exact: true }).selectOption({ label: subjectName });
    await page.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 6' });
    await page.getByLabel('Tên chủ đề').fill('Số tự nhiên');
    await page.getByRole('button', { name: 'Thêm chủ đề' }).click();
    await expect(toast(page, 'Đã thêm chủ đề')).toBeVisible();
    const form = page.getByRole('region', { name: 'Soạn câu hỏi' });
    for (const [content, answer] of [
      ['Số liền sau của 9 là', 'B'],
      ['Số nhỏ nhất có hai chữ số là', 'C'],
    ]) {
      await form.getByLabel('Chủ đề của câu').selectOption({ label: 'Số tự nhiên' });
      await form.getByLabel('Nội dung câu hỏi').fill(content as string);
      for (const [key, value] of [
        ['A', '8'],
        ['B', '10'],
        ['C', '11'],
        ['D', '12'],
      ]) {
        await form.getByLabel(`Lựa chọn ${key}`, { exact: true }).fill(value as string);
      }
      await form.getByLabel('Đáp án').fill(answer as string);
      await form.getByLabel('Điểm của câu').fill('2');
      await form.getByRole('button', { name: 'Lưu câu hỏi' }).click();
      await expect(toast(page, 'Đã lưu câu hỏi')).toBeVisible();
    }
    await form.getByLabel('Mức nhận thức').selectOption({ label: 'Vận dụng' });
    await form.getByLabel('Dạng câu hỏi').selectOption({ label: 'Tự luận' });
    await form.getByLabel('Nội dung câu hỏi').fill('Tìm số tự nhiên x biết x + 5 = 12');
    await form.getByLabel('Hướng dẫn chấm').fill('Ra x = 7 được 6 điểm');
    await form.getByLabel('Điểm của câu').fill('6');
    await form.getByRole('button', { name: 'Lưu câu hỏi' }).click();
    await expect(toast(page, 'Đã lưu câu hỏi')).toBeVisible();
    const questions = page.getByRole('table', { name: 'Câu hỏi' });
    for (let index = 0; index < 3; index += 1) {
      await questions.getByRole('button', { name: 'Gửi thẩm định' }).first().click();
      await expect(toast(page, 'Đã gửi thẩm định')).toBeVisible();
      await questions.getByRole('button', { name: 'Duyệt', exact: true }).first().click();
      await expect(toast(page, 'Đã duyệt câu hỏi')).toBeVisible();
    }
    await expect(page.getByRole('region', { name: 'Thống kê câu dùng được' })).toContainText(
      'Số tự nhiên · Nhận biết · Nhiều lựa chọn: 2 câu',
    );

    // 8.2 Ma trận: hai câu nhận biết 2 điểm, một câu vận dụng 6 điểm; tỉ lệ 40 và 60
    await openMenu(page, '/exam-matrices');
    const matrix = page.getByRole('region', { name: 'Soạn ma trận' });
    await matrix.getByLabel('Môn', { exact: true }).selectOption({ label: subjectName });
    await matrix.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 6' });
    await matrix.getByLabel('Tên ma trận').fill(`Giữa kỳ I ${suffix}`);
    await matrix.getByLabel('Tỉ lệ Thông hiểu').fill('0');
    await matrix.getByLabel('Tỉ lệ Vận dụng', { exact: true }).fill('60');
    await matrix.getByLabel('Tỉ lệ Vận dụng cao').fill('0');
    await matrix.getByLabel('Chủ đề dòng 1').selectOption({ label: 'Số tự nhiên' });
    await matrix.getByLabel('Số câu dòng 1').fill('2');
    await matrix.getByLabel('Điểm mỗi câu dòng 1').fill('2');
    await matrix.getByRole('button', { name: 'Thêm dòng' }).click();
    await matrix.getByLabel('Mức dòng 2').selectOption({ label: 'Vận dụng' });
    await matrix.getByLabel('Dạng dòng 2').selectOption({ label: 'Tự luận' });
    await matrix.getByLabel('Điểm mỗi câu dòng 2').fill('6');
    await matrix.getByRole('button', { name: 'Lưu ma trận' }).click();
    await expect(toast(page, 'Đã lưu ma trận, ma trận hợp lệ')).toBeVisible();

    // 8.3 Kế hoạch kiểm tra: thêm, gửi duyệt, duyệt
    await openMenu(page, '/assessment-plans');
    const plan = page.getByRole('region', { name: 'Thêm kế hoạch kiểm tra' });
    await plan.getByLabel('Môn', { exact: true }).selectOption({ label: subjectName });
    await plan.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 6' });
    await plan.getByRole('button', { name: 'Thêm kế hoạch' }).click();
    await expect(toast(page, 'Đã thêm kế hoạch kiểm tra')).toBeVisible();
    const planRow = page
      .getByRole('table', { name: 'Kế hoạch kiểm tra' })
      .getByRole('row', { name: new RegExp(subjectName) });
    await planRow.getByRole('button', { name: 'Gửi duyệt' }).click();
    await expect(toast(page, 'Đã gửi duyệt kế hoạch')).toBeVisible();
    await planRow.getByRole('button', { name: 'Duyệt' }).click();
    await expect(planRow).toContainText('Đã duyệt');

    // 8.4 Giao đề cho giáo viên
    await openMenu(page, '/exams');
    const assign = page.getByRole('region', { name: 'Giao đề' });
    await assign.getByLabel('Môn', { exact: true }).selectOption({ label: subjectName });
    await assign.getByLabel('Khối', { exact: true }).selectOption({ label: 'Khối 6' });
    await assign.getByLabel('Kế hoạch').selectOption({ label: `HK1 K6 ${subjectName}` });
    await assign.getByLabel('Ma trận').selectOption({ label: `Giữa kỳ I ${suffix}` });
    await assign.getByLabel('Người ra đề').selectOption({ label: teacherName });
    await assign.getByLabel('Tên đề').fill(`Đề giữa kỳ ${suffix}`);
    await assign.getByLabel('Số mã đề').fill('2');
    await assign.getByRole('button', { name: 'Giao đề' }).click();
    await expect(toast(page, `Đã giao đề Đề giữa kỳ ${suffix}`)).toBeVisible();

    // Giáo viên: bốc câu, trộn mã đề, gửi thẩm định
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await teacherPage.goto('/exams');
    const examRow = teacherPage.getByRole('table', { name: 'Đề kiểm tra' }).getByRole('row', {
      name: new RegExp(`Đề giữa kỳ ${suffix}`),
    });
    await examRow.getByRole('button', { name: 'Mở' }).click();
    const detail = teacherPage.getByRole('region', { name: `Đề Đề giữa kỳ ${suffix}` });
    await detail.getByRole('button', { name: 'Bốc câu theo ma trận' }).click();
    await expect(toast(teacherPage, 'Đã bốc câu theo ma trận')).toBeVisible();
    await expect(detail.getByRole('table', { name: 'Câu của đề' }).getByRole('row')).toHaveCount(4);
    await detail.getByRole('button', { name: 'Trộn mã đề' }).click();
    await expect(detail).toContainText('Mã đề: 101, 102');
    await detail.getByRole('button', { name: 'Gửi thẩm định' }).click();
    await expect(toast(teacherPage, 'Đã gửi thẩm định đề')).toBeVisible();

    // Hiệu trưởng: duyệt, khoá, tải đề mã 102
    await page.reload();
    await page
      .getByRole('table', { name: 'Đề kiểm tra' })
      .getByRole('row', { name: new RegExp(`Đề giữa kỳ ${suffix}`) })
      .getByRole('button', { name: 'Mở' })
      .click();
    const review = page.getByRole('region', { name: `Đề Đề giữa kỳ ${suffix}` });
    await review.getByRole('button', { name: 'Duyệt đề' }).click();
    await expect(toast(page, 'Đã thẩm định đề')).toBeVisible();
    await review.getByRole('button', { name: 'Khoá đề' }).click();
    await expect(toast(page, 'Đã khoá đề')).toBeVisible();
    await expect(review.getByRole('heading')).toContainText('Đã khoá');
    await review.getByLabel('Mã đề tải').selectOption('102');
    const downloadPromise = page.waitForEvent('download');
    await review.getByRole('button', { name: 'Tải đề PDF' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('de-102.pdf');
  } finally {
    await setSecondaryEnabled(page, false);
  }
});

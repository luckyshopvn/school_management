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
  E2E_STUDENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_TEACHER_PORT,
} from '../e2e-environment.mjs';

// Giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275), kịch bản CT-28e-11: giáo viên đăng thông báo lớp ở ứng dụng giáo viên;
// học sinh đọc thông báo, đặt câu hỏi riêng, trả lời có số điện thoại thì bị che; giáo viên thấy câu hỏi chờ trả lời, trả lời và
// xác nhận câu trả lời; phụ huynh đọc thông báo lớp của con. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
// Ứng dụng học sinh riêng (YCTD-300)
const STUDENT_URL = `http://localhost:${E2E_STUDENT_PORT}`;
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

test('CT-28e-11: thông báo lớp, hỏi đáp có câu hỏi riêng, lọc số điện thoại, giáo viên xác nhận câu trả lời, phụ huynh đọc thông báo', async ({
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
  const parentPhone = `0906${String(suffix).padStart(6, '0')}`;
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
  const subjectName = `Toán TL ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-TL-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lớp 7D ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7D-${suffix}`,
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
  const childName = `Học sinh Lam ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `tl-${suffix}`,
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
    .values({ catalog_type: 'parent_relationship', code: `ME-TL-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await schoolYear
    .insertInto('guardians')
    .values({ full_name: `Mẹ Lam ${suffix}`, phone: parentPhone, user_id: parent.id })
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
    const spaceTitle = `${subjectName} - ${className}`;
    const announcement = `Lịch kiểm tra ${suffix}`;
    const question = `Em chưa hiểu bài 2 ${suffix}`;

    // Giáo viên: mở lớp cho học sinh, đăng thông báo lớp
    const page = await (await browser.newContext()).newPage();
    await page.goto(TEACHER_URL);
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await page.getByRole('button', { name: new RegExp(spaceTitle) }).click();
    await page.getByRole('button', { name: 'Mở lớp cho học sinh' }).click();
    await expect(page.getByRole('button', { name: 'Ẩn lớp với học sinh' })).toBeVisible();
    await page.getByRole('button', { name: 'Thông báo, thảo luận, hỏi đáp' }).click();
    const create = page.getByRole('form', { name: 'Đăng thông báo lớp' });
    await create.getByLabel('Tiêu đề').fill(announcement);
    await create.getByLabel('Nội dung').fill('Thứ Sáu kiểm tra 15 phút');
    await create.getByRole('button', { name: 'Đăng thông báo' }).click();
    await expect(page.getByText('Đã đăng thông báo lớp')).toBeVisible();

    // Học sinh: đọc thông báo, đặt câu hỏi riêng, trả lời có số điện thoại bị che
    const student = await (await browser.newContext()).newPage();
    await student.goto(`${STUDENT_URL}/`);
    await student.getByLabel('Tên đăng nhập').fill(account.username);
    await student.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
    await student.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(student.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
    await student.getByLabel('Mật khẩu mới', { exact: true }).fill(`MatKhauMoi${suffix}`);
    await student.getByLabel('Nhập lại mật khẩu mới').fill(`MatKhauMoi${suffix}`);
    await student.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await student.getByRole('button', { name: `Thảo luận ${spaceTitle}` }).click();
    const board = student.getByRole('region', { name: `Thảo luận ${spaceTitle}` });
    await expect(board).toContainText(announcement);
    await board.getByRole('tab', { name: 'Hỏi đáp' }).click();
    const ask = board.getByRole('form', { name: 'Đặt câu hỏi' });
    await ask.getByLabel('Câu hỏi').fill(question);
    await ask.getByLabel('Nội dung').fill('Vì sao 2/4 bằng 1/2?');
    await ask.getByLabel('Chỉ hỏi riêng thầy cô').check();
    await ask.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(board.getByText('Đã gửi câu hỏi')).toBeVisible();
    await board.getByRole('button', { name: new RegExp(question) }).click();
    const thread = student.getByRole('region', { name: `Chủ đề ${question}` });
    await expect(thread).toContainText('Chỉ em và thầy cô thấy');
    await thread.getByLabel('Trả lời', { exact: true }).fill('Cô gọi em số 0912 345 678 nhé');
    await thread.getByRole('button', { name: 'Gửi trả lời' }).click();
    await expect(thread.getByText('thông tin liên lạc trong bài đã được che')).toBeVisible();
    await expect(thread.getByRole('list', { name: 'Các trả lời' })).toContainText('Cô gọi em số *** nhé');

    // Giáo viên: câu hỏi chờ trả lời, trả lời, xác nhận câu trả lời đúng
    await page.reload();
    await page.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await page.getByRole('button', { name: new RegExp(spaceTitle) }).click();
    await page.getByRole('button', { name: 'Thông báo, thảo luận, hỏi đáp' }).click();
    const pending = page.getByRole('region', { name: 'Câu hỏi chờ trả lời' });
    await pending.getByRole('button', { name: new RegExp(question) }).click();
    const detail = page.getByRole('region', { name: `Chủ đề ${question}` });
    await detail.getByLabel('Trả lời', { exact: true }).fill('Chia cả tử và mẫu cho 2');
    await detail.getByRole('button', { name: 'Gửi trả lời' }).click();
    await expect(detail.getByText('Đã gửi trả lời')).toBeVisible();
    await detail
      .getByRole('button', { name: /^Xác nhận câu trả lời của/ })
      .last()
      .click();
    await expect(detail.getByText('Câu trả lời đúng')).toBeVisible();

    // Phụ huynh đọc thông báo lớp của con
    const home = await (await browser.newContext()).newPage();
    await home.goto(PARENT_URL);
    await home.getByLabel('Số điện thoại').fill(parentPhone);
    await home.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await home.getByRole('button', { name: 'Đăng nhập' }).click();
    const childCard = home.getByRole('listitem', { name: childName });
    await childCard.getByRole('button', { name: 'Học trực tuyến' }).click();
    const learning = home.getByRole('region', { name: `Học trực tuyến của ${childName}` });
    await expect(learning.getByLabel('Thông báo lớp')).toContainText(announcement);
  } finally {
    await setSecondaryEnabled(head, false);
  }
});

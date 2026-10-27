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

// Huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279), kịch bản CT-28i-6: Ban Giám hiệu bật ở mục 9.3; học sinh học xong
// khoá tự chọn thấy huy hiệu "Hoàn thành khoá học"; giáo viên trao huy hiệu kèm lý do, cấp chứng nhận; trang kiểm tra công khai
// chỉ hiện họ tên viết tắt. Dữ liệu giả
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

async function tokenOf(user: { username: string; password: string }) {
  const login = await fetch(`${IDENTITY_API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: user.username, password: user.password, channel: 'portal' }),
  });
  return ((await login.json()) as { access_token: string }).access_token;
}

async function call(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${MAIN_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

test('CT-28i-6: bật huy hiệu, chứng nhận; học sinh có huy hiệu hoàn thành khoá; giáo viên trao huy hiệu, cấp chứng nhận; trang kiểm tra công khai', async ({
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
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7H-${suffix}`,
      name: `Lớp 7H ${suffix}`,
      grade_level: 'K7',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Nguyễn Thị Lan ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `hh-${suffix}`,
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

  const head = await signInPortal(browser, principal);
  await setSecondaryEnabled(head, true);
  try {
    // Ban Giám hiệu bật huy hiệu, chứng nhận ở mục 9.3
    await head.goto('/online-teaching');
    const settings = head.getByRole('region', { name: 'Huy hiệu và chứng nhận hoàn thành' });
    await settings.getByLabel('Bật huy hiệu').check();
    await settings.getByLabel('Bật chứng nhận hoàn thành khoá tự chọn').check();
    await settings.getByLabel('Họ tên người ký').fill(`Hiệu trưởng thử ${suffix}`);
    await settings.getByRole('button', { name: 'Lưu cấu hình huy hiệu, chứng nhận' }).click();
    await expect(toast(head, 'Đã lưu cấu hình huy hiệu, chứng nhận')).toBeVisible();

    const principalToken = await tokenOf(principal);
    const issued = await call(principalToken, 'POST', '/learning-accounts/issue', {
      child_ids: [child.id],
      mode: 'create',
    });
    expect(issued.status).toBe(200);
    const account = (issued.body.items as Array<{ username: string; password: string }>)[0] as {
      username: string;
      password: string;
    };
    const courseTitle = `Câu lạc bộ khoa học ${suffix}`;
    const elective = await call(principalToken, 'POST', '/learning/spaces', {
      title: courseTitle,
      school_level: 'THCS',
      teacher_user_ids: [teacher.id],
    });
    expect(elective.status).toBe(201);
    const spaceId = elective.body.id as string;
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: spaceId, user_id: teacher.id, user_name: `Cô Khoa học ${suffix}`, source: 'manual' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    const teacherToken = await tokenOf(teacher);
    expect([200, 201]).toContain(
      (await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/enrollments`, { child_ids: [child.id] })).status,
    );
    expect(
      (await call(teacherToken, 'PATCH', `/learning/spaces/${spaceId}`, { visible_to_students: true })).status,
    ).toBe(200);
    const section = await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/sections`, { title: 'Khám phá' });
    const activityTitle = `Bài mở đầu ${suffix}`;
    const page = await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/activities`, {
      section_id: section.body.id,
      kind: 'page',
      title: activityTitle,
      settings: { body: 'Đọc giới thiệu câu lạc bộ' },
    });
    expect(page.status).toBe(201);
    expect(
      (await call(teacherToken, 'POST', `/learning/activities/${page.body.id as string}/publish`, {})).status,
    ).toBe(200);

    // Học sinh mở bài, học xong khoá, thấy huy hiệu
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
    await student.getByRole('button', { name: new RegExp(activityTitle) }).click();
    await student.reload();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    const mine = student.getByRole('region', { name: 'Huy hiệu, chứng nhận của em' });
    await expect(mine).toContainText('Hoàn thành khoá học');

    // Giáo viên: trao huy hiệu kèm lý do, cấp chứng nhận
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(TEACHER_URL);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(teacherPage.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await teacherPage.getByRole('button', { name: new RegExp(courseTitle) }).click();
    await teacherPage.getByRole('button', { name: 'Huy hiệu, chứng nhận' }).click();
    const row = teacherPage.getByRole('listitem', { name: childName });
    await expect(row).toContainText('Đã hoàn thành khoá');
    await row.getByRole('button', { name: 'Trao huy hiệu' }).click();
    const award = row.getByRole('form', { name: `Trao huy hiệu cho ${childName}` });
    await award.getByLabel('Tên huy hiệu').fill('Nhà khoa học nhỏ');
    await award.getByLabel('Lý do').fill('Đặt nhiều câu hỏi hay');
    await award.getByRole('button', { name: 'Trao' }).click();
    await expect(teacherPage.getByText(`Đã trao huy hiệu cho ${childName}`)).toBeVisible();
    await row.getByRole('button', { name: 'Cấp chứng nhận' }).click();
    await expect(teacherPage.getByText(`Đã cấp chứng nhận cho ${childName}`)).toBeVisible();
    await expect(row).toContainText(/Chứng nhận CN-[A-Z0-9]{10}/);
    const certificate = await schoolYear
      .selectFrom('course_certificates')
      .select(['code', 'holder_short_name'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect(certificate.holder_short_name).toBe(`N. T. L. ${suffix}`);

    // Trang kiểm tra công khai: hợp lệ, chỉ tên viết tắt
    const publicPage = await (await browser.newContext()).newPage();
    await publicPage.goto(`${MAIN_API}/public/certificates/${certificate.code}`);
    await expect(publicPage.getByRole('heading', { name: 'Chứng nhận hợp lệ' })).toBeVisible();
    await expect(publicPage.getByText(courseTitle)).toBeVisible();
    await expect(publicPage.getByText(childName)).toHaveCount(0);
  } finally {
    await call(await tokenOf(principal), 'PUT', '/learning/recognition/config', {
      badges_enabled: false,
      certificates_enabled: false,
    });
    await setSecondaryEnabled(head, false);
  }
});

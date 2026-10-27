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
} from '../e2e-environment.mjs';

// Học khi mạng yếu (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27), kịch bản CT-28j-5: trường bật; học sinh làm bài, mất mạng thì bấm
// nộp được giữ trên máy kèm thời điểm bấm nộp; có mạng lại tự nộp đúng một lần; đăng xuất xoá dữ liệu trên máy. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
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

test('CT-28j-5: mất mạng khi nộp bài: bài giữ trên máy, có mạng tự nộp một lần; đăng xuất xoá dữ liệu trên máy', async ({
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
      code: `7K-${suffix}`,
      name: `Lớp 7K ${suffix}`,
      grade_level: 'K7',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học sinh Phong ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `mn-${suffix}`,
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
  const principalToken = await tokenOf(principal);
  try {
    expect(
      (await call(principalToken, 'PUT', '/learning/offline/config', { enabled: true, retention_days: 7 })).status,
    ).toBe(200);
    const issued = await call(principalToken, 'POST', '/learning-accounts/issue', {
      child_ids: [child.id],
      mode: 'create',
    });
    expect(issued.status).toBe(200);
    const account = (issued.body.items as Array<{ username: string; password: string }>)[0] as {
      username: string;
      password: string;
    };
    const elective = await call(principalToken, 'POST', '/learning/spaces', {
      title: `Ôn tập ${suffix}`,
      school_level: 'THCS',
    });
    expect(elective.status).toBe(201);
    const spaceId = elective.body.id as string;
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: spaceId, user_id: teacher.id, user_name: `Thầy Ôn tập ${suffix}`, source: 'manual' })
      .execute();
    const teacherToken = await tokenOf(teacher);
    expect([200, 201]).toContain(
      (await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/enrollments`, { child_ids: [child.id] })).status,
    );
    expect(
      (await call(teacherToken, 'PATCH', `/learning/spaces/${spaceId}`, { visible_to_students: true })).status,
    ).toBe(200);
    const section = await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/sections`, { title: 'Chương 1' });
    const title = `Bài luyện ${suffix}`;
    const activity = await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/activities`, {
      section_id: section.body.id,
      kind: 'assignment',
      title,
    });
    expect(activity.status).toBe(201);
    const activityId = activity.body.id as string;
    expect(
      (
        await call(teacherToken, 'PUT', `/learning/activities/${activityId}/assignment`, {
          grading: 'score',
          items: [{ kind: 'essay', prompt: 'Viết cảm nghĩ', score: 10 }],
        })
      ).status,
    ).toBe(200);
    expect((await call(teacherToken, 'POST', `/learning/activities/${activityId}/assignment/release`, {})).status).toBe(
      200,
    );

    const context = await browser.newContext();
    const student = await context.newPage();
    await student.goto(`${PARENT_URL}/#hoc-sinh`);
    await student.getByLabel('Tên đăng nhập').fill(account.username);
    await student.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
    await student.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(student.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible();
    await student.getByLabel('Mật khẩu mới', { exact: true }).fill(`MatKhauMoi${suffix}`);
    await student.getByLabel('Nhập lại mật khẩu mới').fill(`MatKhauMoi${suffix}`);
    await student.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await student.getByRole('button', { name: `Mở ${title}` }).click();
    const work = student.getByRole('region', { name: `Bài tập ${title}` });
    await expect(work.getByText('Bản nháp tự lưu trên máy này')).toBeVisible();
    await work.getByLabel('Trả lời câu 1').fill('Em làm bài lúc mất mạng');
    const pressedAfter = Date.now() - 60_000;
    await context.setOffline(true);
    await work.getByRole('button', { name: 'Nộp bài' }).click();
    await expect(work.getByText('Chưa có mạng: bài đã lưu trên máy và sẽ tự nộp khi có mạng')).toBeVisible();
    await context.setOffline(false);
    await expect(student.getByText('Đã gửi 1 phần bài làm lưu trên máy')).toBeVisible();
    const submissions = await schoolYear
      .selectFrom('assignment_submissions')
      .innerJoin('assignments', 'assignments.id', 'assignment_submissions.assignment_id')
      .select(['assignment_submissions.status', 'assignment_submissions.client_submitted_at'])
      .where('assignments.activity_id', '=', activityId)
      .where('assignment_submissions.status', '<>', 'draft')
      .execute();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.client_submitted_at?.getTime() ?? 0).toBeGreaterThan(pressedAfter);
    await student.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(student.getByLabel('Tên đăng nhập')).toBeVisible();
    const remaining = await student.evaluate(
      `new Promise((resolve) => { const open = indexedDB.open('hoc-khi-mang-yeu', 1); open.onsuccess = () => { const request = open.result.transaction('records').objectStore('records').count(); request.onsuccess = () => resolve(request.result); }; })`,
    );
    expect(remaining).toBe(0);
  } finally {
    await call(principalToken, 'PUT', '/learning/offline/config', { enabled: false, retention_days: 7 });
    await setSecondaryEnabled(head, false);
  }
});

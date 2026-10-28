import { createHmac } from 'node:crypto';
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

// Giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277), kịch bản CT-28g-9 với bộ giả lập lớp video của 27a
// (VIDEO_PROVIDER=mock): giáo viên tạo giờ học ở ứng dụng giáo viên, mở phòng; học sinh vào giờ học, thấy "giáo viên đang xem";
// giáo viên chia phòng ngẫu nhiên, học sinh sang phòng chia nhỏ, gọi giáo viên; giáo viên gọi tất cả về, xác nhận điểm danh từ nhật
// ký phòng; giáo viên bật cho nhóm tự mở phòng, học sinh mở phòng nhóm, giáo viên vào xem, học sinh báo cáo. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const IDENTITY_API = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const MAIN_API = `http://localhost:${E2E_API_PORT}/api/v1`;
const MOCK_VIDEO_SECRET = 'mock-video-secret';

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

// Sự kiện gọi lại của máy chủ video giả lập (chữ ký HMAC như bộ giả lập của 27a)
async function videoEvent(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  const response = await fetch(`${MAIN_API}/video/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/webhook+json',
      authorization: `Mock ${createHmac('sha256', MOCK_VIDEO_SECRET).update(body).digest('base64url')}`,
    },
    body,
  });
  return response.status;
}

// Giờ địa phương của trình duyệt cho ô datetime-local (trình duyệt chạy cùng múi giờ với tiến trình kiểm thử)
function localInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test('CT-28g-9: giờ học trực tuyến có phòng chia nhỏ, điểm danh từ nhật ký phòng; phòng nhóm học sinh tự mở, giáo viên vào xem', async ({
  browser,
}) => {
  test.setTimeout(360_000);
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
      code: 'K8',
      name: 'Khối 8',
      order_no: 108,
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
      code: `8T-${suffix}`,
      name: `Lớp 8T ${suffix}`,
      grade_level: 'K8',
      school_level: 'THCS',
      max_size: 45,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Lê Minh Khang ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2013-04-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `tt-${suffix}`,
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
    const courseTitle = `Câu lạc bộ hùng biện ${suffix}`;
    const elective = await call(principalToken, 'POST', '/learning/spaces', {
      title: courseTitle,
      school_level: 'THCS',
      teacher_user_ids: [teacher.id],
    });
    expect(elective.status).toBe(201);
    const spaceId = elective.body.id as string;
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: spaceId, user_id: teacher.id, user_name: `Thầy Hùng biện ${suffix}`, source: 'manual' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    const teacherToken = await tokenOf(teacher);
    expect([200, 201]).toContain(
      (await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/enrollments`, { child_ids: [child.id] })).status,
    );
    expect(
      (await call(teacherToken, 'PATCH', `/learning/spaces/${spaceId}`, { visible_to_students: true })).status,
    ).toBe(200);
    expect((await call(teacherToken, 'POST', `/learning/spaces/${spaceId}/sections`, { title: 'Tuần 1' })).status).toBe(
      201,
    );
    // Bộ nhóm của lớp do giáo viên lập (28a)
    const setName = `Nhóm tranh biện ${suffix}`;
    const groupName = `Nhóm Phương Đông ${suffix}`;
    const groupSet = await schoolYear
      .insertInto('group_sets')
      .values({
        org_unit_id: reference.org_unit_id,
        class_id: classRow.id,
        name: setName,
        purpose: 'activity',
        method: 'manual',
        params: '{}',
        owner_user_id: teacher.id,
        owner_name: `Thầy Hùng biện ${suffix}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const group = await schoolYear
      .insertInto('child_groups')
      .values({
        org_unit_id: reference.org_unit_id,
        name: groupName,
        created_by: teacher.id,
        group_set_id: groupSet.id,
        class_id: classRow.id,
        position: 1,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_group_members')
      .values({ group_id: group.id, child_id: child.id, added_by: teacher.id })
      .execute();

    // Giáo viên tạo giờ học ở ứng dụng giáo viên và mở phòng
    const teacherPage = await (await browser.newContext()).newPage();
    await teacherPage.goto(TEACHER_URL);
    await teacherPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await teacherPage.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(teacherPage.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await teacherPage.getByRole('button', { name: new RegExp(courseTitle) }).click();
    await teacherPage.getByRole('button', { name: 'Giờ học trực tuyến, phòng nhóm' }).click();
    const sessionTitle = `Luyện nói ${suffix}`;
    const form = teacherPage.getByRole('form', { name: 'Thêm giờ học trực tuyến' });
    await form.getByLabel('Tên giờ học').fill(sessionTitle);
    await form.getByLabel('Bắt đầu lúc').fill(localInput(new Date(Date.now() - 5 * 60_000)));
    await form.getByLabel('Thời lượng (phút)').fill('2');
    await form.getByRole('button', { name: 'Tạo giờ học' }).click();
    await expect(teacherPage.getByRole('heading', { name: sessionTitle })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Mở phòng giờ học' }).click();
    await expect(teacherPage.getByRole('region', { name: `Lớp video ${sessionTitle}` })).toContainText('Phòng giả lập');
    const activity = await schoolYear
      .selectFrom('course_activities')
      .select('id')
      .where('space_id', '=', spaceId)
      .where('kind', '=', 'live_session')
      .executeTakeFirstOrThrow();
    const mainRoom = await schoolYear
      .selectFrom('learning_live_rooms')
      .select('id')
      .where('activity_id', '=', activity.id)
      .where('kind', '=', 'live_session')
      .executeTakeFirstOrThrow();

    // Học sinh vào giờ học, thấy giáo viên đang xem
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
    const live = student.getByRole('region', { name: 'Học trực tuyến trực tiếp' });
    await live.getByRole('button', { name: `Vào giờ học ${sessionTitle}` }).click();
    await expect(student.getByRole('region', { name: `Lớp video ${sessionTitle}` })).toBeVisible();
    await expect(student.getByRole('status').filter({ hasText: 'Giáo viên đang xem phòng này' })).toBeVisible({
      timeout: 15_000,
    });
    // Máy chủ video báo học sinh vào phòng giờ học (đủ nửa thời lượng 2 phút)
    const start = Date.now() - 90_000;
    expect(
      await videoEvent({
        kind: 'join',
        room: `local--${mainRoom.id}`,
        identity: `s:${child.id}`,
        at: new Date(start).toISOString(),
      }),
    ).toBe(200);
    expect(
      await videoEvent({
        kind: 'leave',
        room: `local--${mainRoom.id}`,
        identity: `s:${child.id}`,
        at: new Date(start + 70_000).toISOString(),
      }),
    ).toBe(200);

    // Giáo viên chia hai phòng ngẫu nhiên; học sinh sang phòng của em và gọi giáo viên
    const breakouts = teacherPage.getByRole('region', { name: 'Phòng chia nhỏ' });
    await breakouts.getByLabel('Số phòng').fill('2');
    await breakouts.getByLabel('Thời lượng phòng chia nhỏ (phút)').fill('10');
    await breakouts.getByRole('button', { name: 'Chia phòng' }).click();
    await expect(student.getByText('Giáo viên đã chia phòng.')).toBeVisible({ timeout: 15_000 });
    await student.getByRole('button', { name: /^Sang phòng / }).click();
    await expect(student.getByText(/Phòng kết thúc lúc/)).toBeVisible();
    await student.getByRole('button', { name: 'Gọi giáo viên' }).click();
    await expect(student.getByText('Đã gọi giáo viên, thầy cô sẽ vào phòng')).toBeVisible();
    await expect(breakouts.getByText(`${childName} đang gọi giáo viên`)).toBeVisible({ timeout: 15_000 });
    await breakouts.getByRole('button', { name: 'Đã đến hỗ trợ' }).click();
    await breakouts.getByRole('button', { name: 'Gọi tất cả về phòng chính' }).click();
    await expect(student.getByText('Phòng chia nhỏ đã kết thúc.')).toBeVisible({ timeout: 15_000 });
    await student.getByRole('button', { name: 'Về phòng giờ học' }).click();
    await expect(student.getByRole('region', { name: `Lớp video ${sessionTitle}` })).toBeVisible();

    // Điểm danh gợi ý từ nhật ký phòng; giáo viên xác nhận
    const attendance = teacherPage.getByRole('region', { name: 'Điểm danh giờ học' });
    await expect(attendance).toContainText(childName);
    await expect(attendance).toContainText('Có mặt');
    await attendance.getByLabel(`Điểm danh ${childName}`).selectOption('present');
    await attendance.getByRole('button', { name: 'Xác nhận điểm danh' }).click();
    await expect(teacherPage.getByText('Đã ghi điểm danh')).toBeVisible();
    const result = await schoolYear
      .selectFrom('activity_results')
      .select('status')
      .where('activity_id', '=', activity.id)
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect(result.status).toBe('completed');
    await teacherPage.getByRole('button', { name: 'Kết thúc giờ học' }).click();
    await student.getByRole('button', { name: 'Rời phòng' }).click();

    // Phòng nhóm: giáo viên bật cho nhóm tự mở; học sinh mở phòng nhóm; giáo viên vào xem; học sinh báo cáo
    await teacherPage.getByRole('button', { name: 'Quay lại' }).click();
    const groups = teacherPage.getByRole('region', { name: 'Phòng nhóm' });
    await groups.getByLabel(`Cho học sinh tự mở phòng của ${setName}`).check();
    await expect(groups.getByLabel(`Cho học sinh tự mở phòng của ${setName}`)).toBeChecked();
    await student.reload();
    await expect(student.getByRole('heading', { name: `Xin chào, ${childName}` })).toBeVisible();
    await student
      .getByRole('region', { name: 'Học trực tuyến trực tiếp' })
      .getByRole('button', { name: `Mở phòng nhóm ${groupName}` })
      .click();
    await expect(student.getByRole('region', { name: `Lớp video Phòng nhóm ${groupName}` })).toBeVisible();
    await expect(student.getByRole('status').filter({ hasText: 'Giáo viên đang xem phòng này' })).toHaveCount(0);
    await teacherPage.reload();
    await expect(teacherPage.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Lớp học trực tuyến' }).click();
    await teacherPage.getByRole('button', { name: new RegExp(courseTitle) }).click();
    await teacherPage.getByRole('button', { name: 'Giờ học trực tuyến, phòng nhóm' }).click();
    await teacherPage
      .getByRole('region', { name: 'Phòng nhóm' })
      .getByRole('button', { name: `Vào xem ${groupName}` })
      .click();
    await expect(teacherPage.getByRole('region', { name: `Lớp video Phòng nhóm ${groupName}` })).toBeVisible();
    await expect(student.getByRole('status').filter({ hasText: 'Giáo viên đang xem phòng này' })).toBeVisible({
      timeout: 15_000,
    });
    await student.getByRole('button', { name: 'Báo cáo phòng này' }).click();
    await student.getByLabel('Lý do báo cáo').fill('Có bạn nói lời không hay');
    await student.getByRole('button', { name: 'Gửi báo cáo' }).click();
    await expect(student.getByText('Đã gửi báo cáo tới nhà trường')).toBeVisible();
    const report = await schoolYear
      .selectFrom('discussion_reports')
      .innerJoin('discussion_threads', 'discussion_threads.id', 'discussion_reports.thread_id')
      .select('discussion_reports.reason')
      .where('discussion_threads.group_id', '=', group.id)
      .executeTakeFirstOrThrow();
    expect(report.reason).toContain('Có bạn nói lời không hay');
  } finally {
    await setSecondaryEnabled(head, false);
  }
});

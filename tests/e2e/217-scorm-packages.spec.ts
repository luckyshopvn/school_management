import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { deflateRawSync, crc32 } from 'node:zlib';
import {
  E2E_API_PORT,
  E2E_IDENTITY_PORT,
  E2E_STUDENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_SYSTEM_DATABASE_NAME,
} from '../e2e-environment.mjs';

// Gói SCORM (DT-28 phần 28h, YCTD-278), kịch bản CT-28h-9: giáo viên tải gói SCORM lên học liệu ở cổng quản trị và xem trước
// trong khung cô lập; học sinh mở hoạt động gói SCORM ở ứng dụng học sinh, gói chạy trong khung sandbox, gọi API SCORM 1.2 qua bộ chuyển
// (postMessage), không đọc được trang cha; kết quả "Đạt" và điểm ghi về máy chủ. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
// Ứng dụng học sinh riêng (YCTD-300)
const STUDENT_URL = `http://localhost:${E2E_STUDENT_PORT}`;
const IDENTITY_API = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const MAIN_API = `http://localhost:${E2E_API_PORT}/api/v1`;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

// Gói zip nhỏ viết tay (deflate): bản kê SCORM 1.2 một SCO; mã của gói thử đọc trang cha (phải bị chặn), báo đạt 90 điểm
function scormZip(): Buffer {
  const files: Record<string, string> = {
    'imsmanifest.xml': `<?xml version="1.0"?><manifest identifier="goi-e2e"><metadata><schemaversion>1.2</schemaversion></metadata>
<organizations default="O"><organization identifier="O"><title>Bài giảng phân số</title>
<item identifier="BAI1" identifierref="R1"><title>Bài 1</title></item></organization></organizations>
<resources><resource identifier="R1" adlcp:scormtype="sco" href="index.html"/></resources></manifest>`,
    'index.html':
      '<!DOCTYPE html><html><head><title>Bài 1</title><script src="bai.js"></script></head><body><p id="chu">Đang học</p></body></html>',
    'bai.js': `window.addEventListener('load', function () {
  var api = window.API;
  api.LMSInitialize('');
  var blocked = 'khong-doc-duoc';
  try { blocked = String(parent.document.title); } catch (e) { blocked = 'bi-chan'; }
  api.LMSSetValue('cmi.suspend_data', blocked);
  api.LMSSetValue('cmi.core.score.raw', '90');
  api.LMSSetValue('cmi.core.lesson_status', 'passed');
  api.LMSCommit('');
  api.LMSFinish('');
  document.getElementById('chu').textContent = 'Đã học xong';
});`,
  };
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const body = Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(body);
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

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

test('CT-28h-9: giáo viên tải gói SCORM và xem trước; học sinh học gói trong khung cô lập, kết quả ghi về máy chủ', async ({
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
  const subjectName = `Toán SC ${suffix}`;
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `THCS-TOAN-SC-${suffix}`,
      name: subjectName,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const className = `Lớp 7G ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `7G-${suffix}`,
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
  const childName = `Học sinh Hoa ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2014-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: `sc-${suffix}`,
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
    const teacherToken = await tokenOf(teacher);
    const catalog = await call(teacherToken, 'GET', '/learning-resources/catalog');
    const typeId = (catalog.body.types as Array<{ id: string; code: string }>).find((row) => row.code === 'scorm')?.id;
    const licenseId = (catalog.body.licenses as Array<{ id: string; code: string }>).find(
      (row) => row.code === 'SELF',
    )?.id;
    const resourceTitle = `Gói bài giảng phân số ${suffix}`;
    const resource = await call(teacherToken, 'POST', '/learning-resources', {
      title: resourceTitle,
      type_id: typeId,
      school_level: 'THCS',
      keywords: [],
      license_id: licenseId,
      visibility: 'school',
    });
    expect(resource.status).toBe(201);
    const resourceId = resource.body.id as string;

    // Giáo viên ở cổng quản trị: tải gói SCORM lên học liệu, xem trước trong khung cô lập
    const portal = await signInPortal(browser, teacher);
    await portal.goto('/learning-resources/mine');
    await portal
      .getByRole('row', { name: new RegExp(resourceTitle) })
      .getByRole('button', { name: 'Mở' })
      .click();
    const panel = portal.getByRole('region', { name: 'Gói SCORM' });
    await panel.getByLabel('Tệp zip của gói SCORM').setInputFiles({
      name: 'phan-so.zip',
      mimeType: 'application/zip',
      buffer: scormZip(),
    });
    await panel.getByRole('button', { name: 'Tải gói SCORM' }).click();
    await expect(toast(portal, 'Đã tải gói SCORM 1.2: Bài giảng phân số')).toBeVisible();
    await panel.getByRole('button', { name: 'Xem trước' }).click();
    const preview = panel.locator('iframe');
    await expect(preview).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(portal.frameLocator('iframe[title="Xem trước Bài 1"]').getByText('Đã học xong')).toBeVisible();

    // Học liệu được duyệt (luồng duyệt 22h1 đã có kiểm thử riêng): công bố phiên bản 1, gắn hoạt động gói SCORM
    await system
      .updateTable('learning_resources')
      .set({ status: 'published', published_version: 1, published_at: new Date() })
      .where('id', '=', resourceId)
      .execute();
    const spaces = await call(teacherToken, 'GET', '/learning/spaces');
    const space = (spaces.body as unknown as Array<{ id: string; title: string }>).find((row) =>
      row.title.includes(className),
    );
    expect(space).toBeTruthy();
    expect(
      (await call(teacherToken, 'PATCH', `/learning/spaces/${space?.id}`, { visible_to_students: true })).status,
    ).toBe(200);
    const section = await call(teacherToken, 'POST', `/learning/spaces/${space?.id}/sections`, { title: 'Chương 1' });
    const activityTitle = `Học gói phân số ${suffix}`;
    const activity = await call(teacherToken, 'POST', `/learning/spaces/${space?.id}/activities`, {
      section_id: section.body.id,
      kind: 'scorm',
      title: activityTitle,
      completion_rule: 'pass',
      settings: { resource_id: resourceId },
    });
    expect(activity.status).toBe(201);
    expect(
      (await call(teacherToken, 'POST', `/learning/activities/${activity.body.id as string}/publish`, {})).status,
    ).toBe(200);

    // Học sinh: mở hoạt động, gói chạy trong khung sandbox, báo đạt qua bộ chuyển API
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
    await student.getByRole('button', { name: new RegExp(activityTitle) }).click();
    const player = student.getByRole('region', { name: `Bài giảng ${activityTitle}` });
    await expect(player.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(student.frameLocator('iframe[title="Nội dung Bài 1"]').getByText('Đã học xong')).toBeVisible();
    await expect(player.getByText('Đạt', { exact: true })).toBeVisible();
    await expect(player.getByText('Điểm 9')).toBeVisible();
    const attempt = await schoolYear
      .selectFrom('scorm_attempts')
      .select(['success', 'score', 'suspend_data', 'session_count'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    expect(attempt.success).toBe('passed');
    expect(Number(attempt.score)).toBe(9);
    expect(attempt.suspend_data).toBe('bi-chan');
    expect(attempt.session_count).toBe(1);
  } finally {
    await setSecondaryEnabled(head, false);
  }
});

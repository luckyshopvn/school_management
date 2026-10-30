import { randomUUID } from 'node:crypto';
import { request as playwrightRequest, type Page } from '@playwright/test';
import {
  readTenancyConfiguration,
  savePlatformAiKey,
  savePlatformAiSettings,
  TenancyRuntime,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';

import {
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_STUDENT_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// YCTD-383 lát L3 (spec 144), kịch bản CT-1787: học sinh có gói của trường alpha mở trang Gia sư AI khi lớp đang có bài kiểm tra trực
// tuyến mở thì thấy "Đang trong giờ kiểm tra." và không gửi được câu hỏi; khi đang trong khung giờ khóa của trường thì thấy "Ngoài giờ
// dùng." kèm giờ mở lại. Khóa AI của nền tảng trỏ tới bộ giả lập, không gọi dịch vụ AI thật. Dữ liệu giả. Chỉ chạy ở dự án nhiều trường
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const STUDENT_URL = `http://${schoolHost('alpha')}:${E2E_MULTI_STUDENT_PORT}/`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const month = `${today.slice(0, 7)}-01`;
const nextMonth = (() => {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return value === 12 ? `${year + 1}-01-01` : `${year}-${String(value + 1).padStart(2, '0')}-01`;
})();
const pad = (value: number) => String(value).padStart(2, '0');
// Giờ Việt Nam hiện tại cộng `offset` giờ, dạng HH:00
const vietnamHour = (offset: number) => `${pad((Math.floor(Date.now() / 3_600_000) + 7 + offset + 24) % 24)}:00`;

let runtime: TenancyRuntime;
let tenant: TenantContext;
const systemDatabase = () => runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
const yearDatabase = (context: TenantContext, name: string) =>
  runtime.connections.database<SchoolYearDatabase>(context, 'school-year', name);
let year: ReturnType<typeof yearDatabase>;
let system: ReturnType<typeof systemDatabase>;
let student: TestUser;
let classId = '';
let examAssignmentId = '';
let savedSettings: { value: unknown } | undefined;
let savedSecret: Record<string, unknown> | undefined;

async function setQuietWindow(start: string, end: string) {
  const values = { quiet_start: start, quiet_end: end };
  await system
    .insertInto('ai_tutor_school_settings')
    .values({ id: 1, ...values })
    .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
    .execute();
}

const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function call(token: string, method: string, path: string, data?: unknown) {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const response = await context.fetch(`${API}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  await context.dispose();
  return { status: response.status(), body };
}

// Năm học đang mở của alpha (spec khác có thể đã mở, không thì mở), đơn vị trường
async function openYear() {
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const login = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: principal.username, password: principal.password, channel: 'portal' },
  });
  expect(login.status(), await login.text()).toBe(200);
  const token = ((await login.json()) as { access_token: string }).access_token;
  await context.dispose();
  const list = await call(token, 'GET', '/academic-years');
  const items = list.body as unknown as Array<{ id: string; name: string; status: string }>;
  if (!items.some((item) => item.status === 'open')) {
    let id = items.find((item) => item.name === '2026–2027' && item.status === 'draft')?.id;
    if (!id) {
      const created = await call(token, 'POST', '/academic-years', { name: '2026–2027' });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      id = created.body.id as string;
    }
    const saved = await call(token, 'PUT', `/academic-years/${id}/calendar`, {
      first_term: { start_date: addDays(today, -60), end_date: addDays(today, 90) },
      second_term: { start_date: addDays(today, 95), end_date: addDays(today, 200) },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await call(token, 'POST', `/academic-years/${id}/open`)).status).toBe(200);
  }
  const registry = await system
    .selectFrom('academic_year_databases')
    .innerJoin('academic_years', 'academic_years.id', 'academic_year_databases.academic_year_id')
    .select(['academic_year_databases.database_name', 'academic_years.id'])
    .where('academic_years.status', '=', 'open')
    .executeTakeFirstOrThrow();
  const reloaded = await runtime.registry.loadSchool(tenant.schoolId);
  year = yearDatabase(reloaded?.context ?? tenant, registry.database_name);
  let unit = await year.selectFrom('org_units').select('id').where('unit_type', '=', 'truong_chinh').executeTakeFirst();
  if (!unit) {
    const created = await call(token, 'POST', '/org-units', {
      code: 'TRUONG',
      name: 'Trường alpha',
      unit_type: 'truong_chinh',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    unit = { id: created.body.id as string };
  }
  return { yearId: registry.id, unitId: unit.id };
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  const resolved = await runtime.registry.resolveHost(schoolHost('alpha'));
  if (!resolved) {
    throw new Error('Chưa dựng trường alpha');
  }
  tenant = resolved;
  system = systemDatabase();
  savedSettings = await runtime.platform
    .selectFrom('platform_settings')
    .select('value')
    .where('key', '=', 'ai')
    .executeTakeFirst();
  savedSecret = (await runtime.platform
    .selectFrom('platform_integration_secrets')
    .selectAll()
    .where('connector', '=', 'ai')
    .executeTakeFirst()) as Record<string, unknown> | undefined;
  await savePlatformAiKey(
    runtime.platform,
    configuration.masterKey,
    { enabled: true, apiKey: 'khoa-gia-lap-e2e-144' },
    {
      type: 'cli',
    },
  );
  await savePlatformAiSettings(
    runtime.platform,
    { provider: 'mock', model: 'mo-hinh-e2e', endpoint: null },
    { type: 'cli' },
  );
  const { yearId, unitId } = await openYear();
  let subject = await year
    .selectFrom('subjects')
    .select('id')
    .where('school_level', '=', 'THCS')
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!subject) {
    subject = await year
      .insertInto('subjects')
      .values({ code: 'TOAN-THCS-E2E144', name: 'Toán', school_level: 'THCS' })
      .returning('id')
      .executeTakeFirstOrThrow();
  }
  const suffix = randomUUID().slice(0, 6);
  const schoolClass = await year
    .insertInto('classes')
    .values({
      org_unit_id: unitId,
      academic_year_id: yearId,
      code: `8KH-${suffix}`,
      name: `8KH-${suffix}`,
      grade_level: 'K8',
      school_level: 'THCS',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  classId = schoolClass.id;
  const child = await year
    .insertInto('children')
    .values({
      org_unit_id: unitId,
      full_name: `Học sinh khóa gia sư ${suffix}`,
      dob: '2013-03-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '0000',
      photo_consent: 'granted',
      status: 'active',
      enroll_date: today,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await year
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classId, from_date: today })
    .execute();
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  student = await createTestUser(identity, { roles: [{ roleCode: 'VT-21', orgUnitId: unitId }] });
  await year
    .insertInto('student_learning_accounts')
    .values({
      child_id: child.id,
      username: student.username,
      password_hash: 'khong-dung',
      issued_at: new Date(),
      issued_by_name: 'Hiệu trưởng thử',
      identity_user_id: student.id,
    })
    .execute();
  await system
    .insertInto('ai_tutor_subscriptions')
    .values({
      child_id: child.id,
      plan_source: 'school',
      plan_id: randomUUID(),
      plan_kind: 'monthly',
      plan_name: 'Cơ bản e2e 144',
      price: 79000,
      allow_images: false,
      period_month: month,
      status: 'active',
      buyer_user_id: randomUUID(),
      buyer_name: 'Phụ huynh e2e',
      turns: 10,
      valid_from: new Date(`${month}T00:00:00+07:00`),
      valid_until: new Date(`${nextMonth}T00:00:00+07:00`),
      activated_at: new Date(),
    })
    .execute();
  // Bài kiểm tra trực tuyến của lớp đang mở (một giờ trước đến một giờ sau)
  const exam = await year
    .insertInto('exams')
    .values({
      school_level: 'THCS',
      subject_id: subject.id,
      grade_level_code: 'K8',
      title: `Đề e2e 144 ${suffix}`,
      status: 'locked',
      author_user_id: randomUUID(),
      author_name: 'Giáo viên e2e',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const assignment = await year
    .insertInto('exam_assignments')
    .values({
      exam_id: exam.id,
      school_level: 'THCS',
      title: 'Kiểm tra giữa kỳ Toán',
      opens_at: new Date(Date.now() - 3_600_000),
      closes_at: new Date(Date.now() + 3_600_000),
      duration_minutes: 45,
      created_by: randomUUID(),
      created_by_name: 'Giáo viên e2e',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  examAssignmentId = assignment.id;
  await year
    .insertInto('exam_assignment_targets')
    .values({ assignment_id: assignment.id, kind: 'class', class_id: classId })
    .execute();
  // Khung giờ khóa không trùng giờ chạy
  await setQuietWindow(vietnamHour(6), vietnamHour(7));
});

test.afterAll(async () => {
  if (!runtime) {
    return;
  }
  await system.deleteFrom('ai_tutor_school_settings').execute();
  if (examAssignmentId) {
    await year
      .updateTable('exam_assignments')
      .set({ status: 'cancelled' })
      .where('id', '=', examAssignmentId)
      .execute();
  }
  await runtime.platform.deleteFrom('platform_settings').where('key', '=', 'ai').execute();
  if (savedSettings) {
    await runtime.platform
      .insertInto('platform_settings')
      .values({ key: 'ai', value: JSON.stringify(savedSettings.value) })
      .execute();
  }
  await runtime.platform.deleteFrom('platform_integration_secrets').where('connector', '=', 'ai').execute();
  if (savedSecret) {
    await runtime.platform
      .insertInto('platform_integration_secrets')
      .values({ ...savedSecret, hints: JSON.stringify(savedSecret.hints) } as never)
      .execute();
  }
  await runtime.close();
});

async function openTutor(page: Page) {
  await page.goto(STUDENT_URL);
  await page.getByLabel('Tên đăng nhập').fill(student.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(student.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('region', { name: 'Gia sư AI' }).getByRole('button', { name: 'Mở gia sư AI' }).click();
  await expect(page.getByRole('heading', { name: 'Gia sư AI', level: 1 })).toBeVisible();
}

test('CT-1787: lớp đang có bài kiểm tra trực tuyến mở thì gia sư AI khóa, em không gửi được câu hỏi', async ({
  page,
}) => {
  await openTutor(page);
  await expect(page.getByText('Đang trong giờ kiểm tra.')).toBeVisible();
  await expect(page.getByText('Gia sư AI tạm khóa đến khi em nộp bài Kiểm tra giữa kỳ Toán.')).toBeVisible();
  await page.getByRole('group', { name: 'Chọn môn' }).getByRole('button').first().click();
  await expect(page.getByLabel('Câu hỏi của em')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Gửi', exact: true })).toBeDisabled();
  await expect(page.getByText(/Còn\s*10\s*\/10 lượt hỏi/)).toBeVisible();
});

test('CT-1787: trong khung giờ khóa của trường thì gia sư AI báo ngoài giờ dùng và giờ mở lại', async ({ page }) => {
  await year.updateTable('exam_assignments').set({ status: 'cancelled' }).where('id', '=', examAssignmentId).execute();
  await setQuietWindow(vietnamHour(-1), vietnamHour(2));
  await openTutor(page);
  await expect(page.getByText('Ngoài giờ dùng.')).toBeVisible();
  await expect(page.getByText(`Gia sư AI mở lại lúc ${vietnamHour(2).replace(/^0(\d)/, '$1')}.`)).toBeVisible();
});

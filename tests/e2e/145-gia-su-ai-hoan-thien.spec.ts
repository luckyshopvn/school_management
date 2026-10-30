import { randomUUID } from 'node:crypto';
import { request as playwrightRequest } from '@playwright/test';
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
  E2E_MULTI_PORTAL_PORT,
  E2E_MULTI_STUDENT_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// YCTD-383 lát L5 (spec 145), kịch bản CT-2034, CT-2035: luồng chính của gia sư AI sau khi hoàn thiện. Em chưa có gói bấm "Gửi lời nhờ cha
// mẹ" ở trang chủ, cha mẹ nhận thông báo; em có gói một lượt hỏi xong thì hết lượt, gửi lời nhờ mua thêm; cha mẹ xem số lượt và chủ đề
// nhiều nhất (không có nội dung câu hỏi); Hiệu trưởng xem báo cáo tháng ở trang Gia sư AI của cổng quản trị. Ứng dụng phụ huynh không
// chạy ở dự án nhiều trường nên phần cha mẹ gọi thẳng máy chủ API (như spec 142). Khóa AI của nền tảng trỏ tới bộ giả lập, không gọi
// dịch vụ AI thật. Dữ liệu giả. Chỉ chạy ở dự án nhiều trường
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const STUDENT_URL = `http://${schoolHost('alpha')}:${E2E_MULTI_STUDENT_PORT}/`;
const PORTAL_URL = `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const month = `${today.slice(0, 7)}-01`;
const nextMonth = (() => {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return value === 12 ? `${year + 1}-01-01` : `${year}-${String(value + 1).padStart(2, '0')}-01`;
})();

let runtime: TenancyRuntime;
let tenant: TenantContext;
let principal: TestUser;
let parent: TestUser;
const students: Record<'newcomer' | 'oneTurn', { user: TestUser; childId: string; name: string }> = {} as never;
let savedSettings: { value: unknown } | undefined;
let savedSecret: Record<string, unknown> | undefined;

async function login(user: TestUser, channel: 'portal' | 'parent') {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: user.username, password: user.password, channel },
  });
  expect(response.status(), await response.text()).toBe(200);
  const token = ((await response.json()) as { access_token: string }).access_token;
  await context.dispose();
  return token;
}

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

// Năm học đang mở của alpha (spec khác có thể đã mở), đơn vị trường
async function schoolYearOf() {
  const token = await login(principal, 'portal');
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
  const system = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
  const registry = await system
    .selectFrom('academic_year_databases')
    .innerJoin('academic_years', 'academic_years.id', 'academic_year_databases.academic_year_id')
    .select(['academic_year_databases.database_name', 'academic_years.id'])
    .where('academic_years.status', '=', 'open')
    .executeTakeFirstOrThrow();
  const reloaded = await runtime.registry.loadSchool(tenant.schoolId);
  const year = runtime.connections.database<SchoolYearDatabase>(
    reloaded?.context ?? tenant,
    'school-year',
    registry.database_name,
  );
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
  return { year, yearId: registry.id, unitId: unit.id };
}

// Một học sinh lớp 8 có tài khoản học, mẹ có tài khoản ứng dụng phụ huynh; `turns` thì có gói tháng của trường với số lượt đó
async function prepareStudent(
  context: Awaited<ReturnType<typeof schoolYearOf>>,
  guardianId: string,
  relationshipId: string,
  turns: number | null,
) {
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  const suffix = randomUUID().slice(0, 6);
  const name = `Học sinh nhờ cha mẹ ${suffix}`;
  const schoolClass = await context.year
    .insertInto('classes')
    .values({
      org_unit_id: context.unitId,
      academic_year_id: context.yearId,
      code: `8NH-${suffix}`,
      name: `8NH-${suffix}`,
      grade_level: 'K8',
      school_level: 'THCS',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const child = await context.year
    .insertInto('children')
    .values({
      org_unit_id: context.unitId,
      full_name: name,
      dob: '2013-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '0000',
      photo_consent: 'granted',
      status: 'active',
      enroll_date: addDays(today, -30),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await context.year
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: schoolClass.id, from_date: addDays(today, -30) })
    .execute();
  await context.year
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardianId, relationship_item_id: relationshipId, is_primary: true })
    .execute();
  const account = await createTestUser(identity, { roles: [{ roleCode: 'VT-21', orgUnitId: context.unitId }] });
  await context.year
    .insertInto('student_learning_accounts')
    .values({
      child_id: child.id,
      username: account.username,
      password_hash: 'khong-dung',
      issued_at: new Date(),
      issued_by_name: 'Hiệu trưởng thử',
      identity_user_id: account.id,
    })
    .execute();
  if (turns !== null) {
    await runtime.connections
      .database<SystemDatabase>(tenant, 'system', 'system')
      .insertInto('ai_tutor_subscriptions')
      .values({
        child_id: child.id,
        plan_source: 'school',
        plan_id: randomUUID(),
        plan_kind: 'monthly',
        plan_name: 'Cơ bản e2e 145',
        price: 79000,
        allow_images: false,
        period_month: month,
        status: 'active',
        buyer_user_id: randomUUID(),
        buyer_name: 'Phụ huynh e2e',
        turns,
        valid_from: new Date(`${month}T00:00:00+07:00`),
        valid_until: new Date(`${nextMonth}T00:00:00+07:00`),
        activated_at: new Date(),
      })
      .execute();
  }
  return { user: account, childId: child.id, name };
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
  // Giữ thiết lập AI của nền tảng để trả lại sau khi chạy (spec 143, 153 dùng cùng nền tảng)
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
    { enabled: true, apiKey: 'khoa-gia-lap-e2e-145' },
    {
      type: 'cli',
    },
  );
  await savePlatformAiSettings(
    runtime.platform,
    { provider: 'mock', model: 'mo-hinh-e2e', endpoint: null },
    { type: 'cli' },
  );
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const context = await schoolYearOf();
  const subject = await context.year
    .selectFrom('subjects')
    .select('id')
    .where('school_level', '=', 'THCS')
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!subject) {
    await context.year
      .insertInto('subjects')
      .values({ code: 'TOAN-THCS-E2E145', name: 'Toán', school_level: 'THCS' })
      .execute();
  }
  const relationship =
    (await context.year
      .selectFrom('catalog_items')
      .select('id')
      .where('catalog_type', '=', 'parent_relationship')
      .executeTakeFirst()) ??
    (await context.year
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `ME-E2E145-${randomUUID().slice(0, 4)}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow());
  parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: context.unitId }] });
  const guardian = await context.year
    .insertInto('guardians')
    .values({ full_name: 'Mẹ thử e2e 145', phone: '0900000145', user_id: parent.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  students.newcomer = await prepareStudent(context, guardian.id, relationship.id, null);
  students.oneTurn = await prepareStudent(context, guardian.id, relationship.id, 1);
  // Khung giờ khóa cách giờ chạy sáu tiếng để spec không phụ thuộc giờ chạy (khung giờ khóa kiểm ở spec 144)
  const hour = (Math.floor(Date.now() / 3_600_000) + 7 + 6) % 24;
  const pad = (value: number) => String(value).padStart(2, '0');
  const values = { quiet_start: `${pad(hour)}:00`, quiet_end: `${pad((hour + 1) % 24)}:00` };
  await runtime.connections
    .database<SystemDatabase>(tenant, 'system', 'system')
    .insertInto('ai_tutor_school_settings')
    .values({ id: 1, ...values })
    .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
    .execute();
});

test.afterAll(async () => {
  if (!runtime) {
    return;
  }
  await runtime.connections
    .database<SystemDatabase>(tenant, 'system', 'system')
    .deleteFrom('ai_tutor_school_settings')
    .execute();
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

async function signInStudent(page: import('@playwright/test').Page, user: TestUser) {
  await page.goto(STUDENT_URL);
  await page.getByLabel('Tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

async function parentInbox() {
  const reply = await call(await login(parent, 'parent'), 'GET', '/notifications');
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body.notifications as Array<{ title: string; body: string }>;
}

test('CT-2034: em chưa có gói gửi lời nhờ cha mẹ ở trang chủ; cha mẹ nhận thông báo', async ({ page }) => {
  await signInStudent(page, students.newcomer.user);
  const card = page.getByRole('region', { name: 'Gia sư AI' });
  await expect(card.getByText('Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh.')).toBeVisible();
  await card.getByRole('button', { name: 'Gửi lời nhờ cha mẹ' }).click();
  await expect(card.getByText(/Đã gửi lời nhờ cha mẹ lúc/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Gửi lời nhờ cha mẹ' })).toHaveCount(0);

  const received = (await parentInbox()).find((item) => item.body.includes(students.newcomer.name));
  expect(received?.title).toBe('Gia sư AI: con nhờ cha mẹ');
  expect(received?.body).toContain('nhờ cha mẹ đăng ký gói Gia sư AI');
});

test('CT-2034: em hỏi hết lượt rồi gửi lời nhờ mua thêm; cha mẹ thấy số lượt và chủ đề, không thấy câu hỏi', async ({
  page,
}) => {
  await signInStudent(page, students.oneTurn.user);
  const card = page.getByRole('region', { name: 'Gia sư AI' });
  await expect(card.getByText(/Còn\s*1\s*\/1 lượt hỏi/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Gửi lời nhờ cha mẹ' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Mở gia sư AI' }).click();
  await page.getByRole('group', { name: 'Chọn môn' }).getByRole('button').first().click();
  await page.getByLabel('Câu hỏi của em').fill('Giải giúp em phương trình 3x - 7 = 2x + 5');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Tin nhắn' }).getByText('Nhắc khái niệm')).toBeVisible();

  await expect(
    page.getByText('Em đã dùng hết lượt hỏi. Nhờ cha mẹ mua thêm lượt hoặc gói tháng trong ứng dụng phụ huynh.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lời nhờ cha mẹ' }).click();
  await expect(page.getByText(/Đã gửi lời nhờ cha mẹ lúc/)).toBeVisible();

  const received = (await parentInbox()).find((item) => item.body.includes(students.oneTurn.name));
  expect(received?.body).toContain('đã dùng hết lượt hỏi Gia sư AI và nhờ cha mẹ mua thêm lượt hoặc gia hạn gói');

  const topics = await call(
    await login(parent, 'parent'),
    'GET',
    `/children/${students.oneTurn.childId}/ai-tutor/topics`,
  );
  expect(topics.status, JSON.stringify(topics.body)).toBe(200);
  expect(topics.body.turns_this_month).toBe(1);
  expect(topics.body.top_topics).toEqual([{ topic: 'Phương trình bậc nhất một ẩn', turns: 1 }]);
  expect(JSON.stringify(topics.body)).not.toContain('3x - 7');
});

test('CT-2035: Hiệu trưởng xem báo cáo tháng ở trang Gia sư AI của cổng quản trị', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: PORTAL_URL });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await page.goto('/ai-tutor');
  const report = page.getByRole('region', { name: 'Báo cáo tháng' });
  const monthNumber = Number(month.slice(5, 7));
  const questions = report.getByLabel('Lượt hỏi tháng');
  await expect(questions.getByText(`Lượt hỏi tháng ${monthNumber}`)).toBeVisible();
  // Spec khác cũng hỏi gia sư ở trường alpha trong tháng, nên chỉ kiểm có ít nhất lượt của spec này
  const shown = Number(((await questions.locator('span').nth(1).textContent()) ?? '0').replace(/\./g, ''));
  expect(shown).toBeGreaterThanOrEqual(1);
  await expect(
    report.getByLabel('Token tháng').getByText(`Token tháng ${monthNumber} (vào hóa đơn dịch vụ)`),
  ).toBeVisible();
  await expect(report.getByText(/không tính cho trường/)).toBeVisible();
  await context.close();
});

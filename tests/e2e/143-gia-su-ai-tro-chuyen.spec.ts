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
  E2E_MULTI_STUDENT_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// YCTD-383 lát L2 (spec 143), kịch bản CT-1778: học sinh lớp 8 của trường alpha có gói tháng của trường mở ứng dụng học sinh, thấy thẻ
// "Gia sư AI" ở trang chủ, chọn môn, hỏi bài và nhận gợi ý từng bước (không có đáp án), số lượt giảm một; nút "Xem lời giải đầy đủ" chỉ
// mở sau hai lượt tự làm; báo câu trả lời sai; xem lại hội thoại cũ. Học sinh chưa có gói thấy lời nhờ cha mẹ đăng ký. Khóa AI của nền
// tảng trỏ tới bộ giả lập (máy chủ API chạy với AI_MOCK=true), không gọi dịch vụ AI thật. Dữ liệu giả. Chỉ chạy ở dự án nhiều trường
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const STUDENT_URL = `http://${schoolHost('alpha')}:${E2E_MULTI_STUDENT_PORT}/`;
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
let subscribedStudent: TestUser;
let newcomer: TestUser;
let savedSettings: { value: unknown } | undefined;
let savedSecret: Record<string, unknown> | undefined;

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

async function portalToken(user: TestUser): Promise<string> {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: user.username, password: user.password, channel: 'portal' },
  });
  expect(response.status(), await response.text()).toBe(200);
  const token = ((await response.json()) as { access_token: string }).access_token;
  await context.dispose();
  return token;
}

// Năm học đang mở của alpha (spec khác có thể đã mở), đơn vị trường, môn Toán cấp THCS
async function schoolYearOf(principal: TestUser) {
  const token = await portalToken(principal);
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

// Một học sinh lớp 8 có tài khoản học; `withPlan` thì có gói tháng 10 lượt của trường cho tháng này
async function prepareStudent(context: Awaited<ReturnType<typeof schoolYearOf>>, withPlan: boolean): Promise<TestUser> {
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  const suffix = randomUUID().slice(0, 6);
  const schoolClass = await context.year
    .insertInto('classes')
    .values({
      org_unit_id: context.unitId,
      academic_year_id: context.yearId,
      code: `8GS-${suffix}`,
      name: `8GS-${suffix}`,
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
      full_name: `Học sinh gia sư AI ${suffix}`,
      dob: '2013-03-01',
      gender: 'male',
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
  if (withPlan) {
    const system = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
    const now = new Date();
    await system
      .insertInto('ai_tutor_subscriptions')
      .values({
        child_id: child.id,
        plan_source: 'school',
        plan_id: randomUUID(),
        plan_kind: 'monthly',
        plan_name: 'Cơ bản e2e',
        price: 79000,
        allow_images: false,
        period_month: month,
        status: 'active',
        buyer_user_id: randomUUID(),
        buyer_name: 'Phụ huynh e2e',
        turns: 10,
        valid_from: new Date(`${month}T00:00:00+07:00`),
        valid_until: new Date(`${nextMonth}T00:00:00+07:00`),
        activated_at: now,
      })
      .execute();
  }
  return account;
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
  // Giữ thiết lập AI của nền tảng để trả lại sau khi chạy (spec 153 dùng cùng nền tảng)
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
    { enabled: true, apiKey: 'khoa-gia-lap-e2e-143' },
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
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const context = await schoolYearOf(principal);
  const subject = await context.year
    .selectFrom('subjects')
    .select('id')
    .where('school_level', '=', 'THCS')
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!subject) {
    await context.year
      .insertInto('subjects')
      .values({ code: 'TOAN-THCS-E2E143', name: 'Toán', school_level: 'THCS' })
      .execute();
  }
  subscribedStudent = await prepareStudent(context, true);
  newcomer = await prepareStudent(context, false);
});

test.afterAll(async () => {
  if (!runtime) {
    return;
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

async function signInStudent(page: import('@playwright/test').Page, user: TestUser) {
  await page.goto(STUDENT_URL);
  await page.getByLabel('Tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('CT-1778: học sinh chưa có gói thấy lời nhờ cha mẹ đăng ký', async ({ page }) => {
  await signInStudent(page, newcomer);
  const card = page.getByRole('region', { name: 'Gia sư AI' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh.')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Mở gia sư AI' })).toHaveCount(0);
});

test('CT-1778: học sinh hỏi bài, được gợi ý từng bước, mở lời giải sau hai lượt tự làm', async ({ page }) => {
  await signInStudent(page, subscribedStudent);
  const card = page.getByRole('region', { name: 'Gia sư AI' });
  await expect(card.getByText(/Còn\s*10\s*\/10 lượt hỏi/)).toBeVisible();
  await card.getByRole('button', { name: 'Mở gia sư AI' }).click();

  await expect(page.getByRole('heading', { name: 'Gia sư AI', level: 1 })).toBeVisible();
  await page.getByRole('group', { name: 'Chọn môn' }).getByRole('button').first().click();
  await page.getByLabel('Câu hỏi của em').fill('Giải giúp em phương trình 3x - 7 = 2x + 5');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();

  const messages = page.getByRole('list', { name: 'Tin nhắn' });
  await expect(messages.getByText('Nhắc khái niệm')).toBeVisible();
  await expect(messages.getByText(/đưa các hạng tử chứa/)).toBeVisible();
  await expect(messages).not.toContainText('12');
  // Công thức hiển thị bằng KaTeX
  await expect(messages.locator('.katex').first()).toBeVisible();
  await expect(page.getByText(/Còn\s*9\s*\/10 lượt hỏi/)).toBeVisible();

  const solution = page.getByRole('button', { name: 'Xem lời giải đầy đủ' });
  await expect(solution).toBeDisabled();
  await expect(page.getByText('Em tự làm thêm 2 lượt để mở lời giải đầy đủ')).toBeVisible();
  for (const attempt of ['3x - 2x - 7 = 5', 'x - 7 = 5']) {
    await page.getByLabel('Câu trả lời hoặc câu hỏi tiếp của em').fill(attempt);
    await page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(messages.getByText(attempt, { exact: true })).toBeVisible();
  }
  await expect(solution).toBeEnabled();
  await solution.click();
  await expect(messages.getByText('Lời giải đầy đủ', { exact: true })).toBeVisible();
  await expect(messages.getByText(/Lời giải: chuyển vế được/)).toBeVisible();
  await expect(page.getByText(/Còn\s*6\s*\/10 lượt hỏi/)).toBeVisible();

  await messages.getByRole('button', { name: 'Báo câu trả lời sai' }).first().click();
  await expect(page.getByText('Cảm ơn em đã báo. Nhà trường sẽ xem lại câu trả lời này.')).toBeVisible();
  await expect(messages.getByText('Em đã báo câu trả lời này sai')).toBeVisible();

  // Hội thoại cũ: bắt đầu câu hỏi mới rồi mở lại hội thoại vừa rồi
  await page.getByRole('button', { name: 'Hỏi bài mới' }).click();
  await expect(page.getByLabel('Câu hỏi của em')).toBeVisible();
  const history = page.getByRole('region', { name: 'Hội thoại cũ' });
  await history.getByRole('button', { name: /Phương trình bậc nhất một ẩn/ }).click();
  await expect(messages.getByText('Giải giúp em phương trình 3x - 7 = 2x + 5')).toBeVisible();
});

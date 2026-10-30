import { randomUUID } from 'node:crypto';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
  type TenantContext,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_IDENTITY_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// YCTD-383 lát L1b (spec 142), kịch bản CT-383-L1b-8: luồng mua trực tiếp gói gia sư AI của nền tảng. Người vận hành tạo gói ở trang "Gia
// sư AI" của cổng vận hành; phụ huynh của một học sinh Trung học cơ sở ở trường alpha mua gói qua cổng giả lập của nền tảng (giao dịch chờ,
// mã QR giả lập, tiền vào giả lập, biên lai); người vận hành thấy giao dịch đã thu và biên lai, ghi hoàn tiền có lý do; lần mua của con
// chuyển đã hoàn tiền. Phần của phụ huynh gọi thẳng máy chủ API vì khung trang phụ huynh thuộc lát L1a. Chỉ chạy ở dự án nhiều trường.
// Dữ liệu giả, không có tiền thật
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PLAN_NAME = `Cơ bản tháng e2e ${Math.random().toString(36).slice(2, 6)}`;
const operatorLogin = `ke-toan-${Math.random().toString(36).slice(2, 8)}`;

let runtime: TenancyRuntime;
let tenant: TenantContext;
let principal: TestUser;
let parentUser: TestUser;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

async function signedIn(user: TestUser, channel: 'portal' | 'parent') {
  // Kết nối thẳng 127.0.0.1 và đặt tiêu đề Host như spec 130, 182
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: user.username, password: user.password, channel },
  });
  expect(response.status(), await response.text()).toBe(200);
  return { context, token: ((await response.json()) as { access_token: string }).access_token };
}

async function call(context: APIRequestContext, token: string, method: string, path: string, data?: unknown) {
  const response = await context.fetch(`${API}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

async function ensureOpenYear(context: APIRequestContext, token: string) {
  const list = await call(context, token, 'GET', '/academic-years');
  const items = list.body as unknown as Array<{ id: string; name: string; status: string }>;
  if (items.some((item) => item.status === 'open')) {
    return;
  }
  let id = items.find((item) => item.name === '2026–2027' && item.status === 'draft')?.id;
  if (!id) {
    const created = await call(context, token, 'POST', '/academic-years', { name: '2026–2027' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    id = created.body.id as string;
  }
  const saved = await call(context, token, 'PUT', `/academic-years/${id}/calendar`, {
    first_term: { start_date: addDays(today, -60), end_date: addDays(today, 90) },
    second_term: { start_date: addDays(today, 95), end_date: addDays(today, 200) },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect((await call(context, token, 'POST', `/academic-years/${id}/open`)).status).toBe(200);
}

// Một học sinh lớp 8 của alpha, phụ huynh là parentUser; trả mã con
async function prepareChild(): Promise<string> {
  const admin = await signedIn(principal, 'portal');
  await ensureOpenYear(admin.context, admin.token);
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
    const created = await call(admin.context, admin.token, 'POST', '/org-units', {
      code: 'TRUONG',
      name: 'Trường alpha',
      unit_type: 'truong_chinh',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    unit = { id: created.body.id as string };
  }
  const suffix = randomUUID().slice(0, 6);
  const schoolClass = await year
    .insertInto('classes')
    .values({
      org_unit_id: unit.id,
      academic_year_id: registry.id,
      code: `8E2E-${suffix}`,
      name: `8E2E-${suffix}`,
      grade_level: 'K8',
      school_level: 'THCS',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const child = await year
    .insertInto('children')
    .values({
      org_unit_id: unit.id,
      full_name: 'Học sinh gia sư AI (e2e)',
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
  await year
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: schoolClass.id, from_date: addDays(today, -30) })
    .execute();
  const relationship = await year
    .insertInto('catalog_items')
    .values({ catalog_type: 'parent_relationship', code: `ME-${suffix}`, name: 'Mẹ' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const guardian = await year
    .insertInto('guardians')
    .values({
      full_name: 'Phụ huynh gia sư AI (e2e)',
      phone: `0900${Math.floor(Math.random() * 900_000 + 100_000)}`,
      user_id: parentUser.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await year
    .insertInto('child_guardians')
    .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
    .execute();
  return child.id;
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
  const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  parentUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: null }] });
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Kế toán nền tảng giả',
    password: OPERATOR_TEST_PASSWORD,
    role: 'ke_toan',
  });
});

test.afterAll(async () => {
  if (runtime) {
    await runtime.platform
      .updateTable('platform_ai_tutor_plans')
      .set({ status: 'archived' })
      .where('name', '=', PLAN_NAME)
      .execute();
    await runtime.close();
  }
});

test('CT-383-L1b-8: vận hành tạo gói, phụ huynh mua trực tiếp qua cổng giả lập và nhận biên lai, vận hành hoàn tiền', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const childId = await prepareChild();

  // Người vận hành (kế toán) tạo gói tháng cho Trung học cơ sở
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_TEST_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Gia sư AI' }).click();
  const page = consolePage.getByRole('region', { name: 'Gia sư AI bán trực tiếp' });
  await page.getByRole('button', { name: 'Tạo gói' }).click();
  const form = consolePage.getByRole('form', { name: 'Tạo gói' });
  await form.getByLabel('Tên gói').fill(PLAN_NAME);
  await form.getByLabel('Giá (đồng)').fill('89000');
  await form.getByLabel('Số lượt hỏi').fill('100');
  await form.getByLabel('Tiểu học').uncheck();
  await form.getByRole('button', { name: 'Lưu gói' }).click();
  await expect(page.getByText(`Đã tạo gói ${PLAN_NAME}.`)).toBeVisible();
  const planRow = page.getByRole('table', { name: 'Gói nền tảng' }).getByRole('row').filter({ hasText: PLAN_NAME });
  await expect(planRow).toContainText('89.000 đ');
  await expect(planRow).toContainText('Trung học cơ sở, Trung học phổ thông');
  await expect(planRow).toContainText('Đang bán');

  // Phụ huynh mua cho con qua cổng giả lập của nền tảng
  const parent = await signedIn(parentUser, 'parent');
  const overview = await call(parent.context, parent.token, 'GET', `/ai-tutor/direct/children/${childId}`);
  expect(overview.status, JSON.stringify(overview.body)).toBe(200);
  const plan = (overview.body.plans as Array<{ id: string; name: string }>).find((item) => item.name === PLAN_NAME);
  expect(plan).toBeTruthy();
  const created = await call(parent.context, parent.token, 'POST', `/ai-tutor/direct/children/${childId}/orders`, {
    plan_id: plan?.id,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect(created.body.status).toBe('pending');
  expect(String(created.body.qr_content)).toMatch(/^GIA-LAP\|/);
  const code = created.body.code as string;
  const paid = await call(
    parent.context,
    parent.token,
    'POST',
    `/ai-tutor/direct/orders/${String(created.body.id)}/simulate-payment`,
  );
  expect(paid.body.status).toBe('paid');
  const receipt = paid.body.receipt as { number: string; amount: number };
  expect(receipt.amount).toBe(89_000);
  const balance = await call(parent.context, parent.token, 'GET', `/ai-tutor/direct/children/${childId}`);
  expect(balance.body.balance).toEqual({ monthly: 100, topUp: 0 });

  // Người vận hành thấy giao dịch đã thu, mở biên lai, ghi hoàn tiền
  await page.getByRole('tab', { name: 'Giao dịch' }).click();
  const row = page.getByRole('table', { name: 'Danh sách giao dịch' }).getByRole('row').filter({ hasText: code });
  await expect(row).toContainText('Đã thu');
  await expect(row).toContainText(receipt.number);
  await row.getByRole('button', { name: `Xem giao dịch ${code}` }).click();
  const dialog = consolePage.getByRole('dialog', { name: `Giao dịch ${code}` });
  await expect(dialog.getByRole('region', { name: 'Biên lai' })).toContainText(`Biên lai ${receipt.number}`);
  const refund = dialog.getByRole('form', { name: 'Hoàn tiền' });
  await refund.getByLabel('Lý do hoàn tiền').fill('Phụ huynh mua nhầm (e2e)');
  await refund.getByRole('button', { name: 'Ghi hoàn tiền' }).click();
  await expect(dialog).toContainText('Đã hoàn tiền');
  await expect(dialog).toContainText('Kế toán nền tảng giả');

  const system = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
  const order = await runtime.platform
    .selectFrom('platform_ai_tutor_orders')
    .select('subscription_id')
    .where('code', '=', code)
    .executeTakeFirstOrThrow();
  const subscription = await system
    .selectFrom('ai_tutor_subscriptions')
    .select('status')
    .where('id', '=', order.subscription_id)
    .executeTakeFirstOrThrow();
  expect(subscription.status).toBe('refunded');
  const after = await call(parent.context, parent.token, 'GET', `/ai-tutor/direct/children/${childId}`);
  expect(after.body.balance).toEqual({ monthly: 0, topUp: 0 });
  await consoleContext.close();
});

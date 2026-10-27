import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readNativePushCredentials,
  readTenancyConfiguration,
  retireNativePushKey,
  storeNativePushKey,
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
  E2E_PUSH_OUTBOX_FILE,
  E2E_SCHEDULER_SECRET,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-26 phần 26g (YCTD-237, spec 186), kịch bản CT-26g-6: cách ly mã thiết bị đẩy gốc FCM, APNs giữa hai trường. Cùng một máy (cùng mã
// thiết bị) đăng ký ở alpha và beta thành hai đăng ký tách nhau ở cơ sở dữ liệu của từng trường; beta không thấy, không gỡ được đăng ký
// của alpha; thông báo của alpha chỉ tới mã thiết bị đăng ký ở alpha, kèm địa chỉ ứng dụng của alpha. Khóa FCM của nền tảng lưu mã
// hóa ở cơ sở dữ liệu nền tảng, không xuống cơ sở dữ liệu trường. Đẩy qua bộ giả lập (PUSH_NATIVE_PROVIDER=development). Chỉ chạy ở
// dự án nhiều trường. Dữ liệu giả, khóa sinh trong lúc chạy
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

let runtime: TenancyRuntime;
const tenants: Record<string, TenantContext> = {};
const parents: Record<string, TestUser> = {};
let principal: TestUser;

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  for (const code of ['alpha', 'beta']) {
    const tenant = await runtime.registry.resolveHost(schoolHost(code));
    if (!tenant) {
      throw new Error(`Chưa dựng trường ${code}`);
    }
    tenants[code] = tenant;
    const identity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    parents[code] = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    if (code === 'alpha') {
      principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    }
  }
});

test.afterAll(async () => {
  await runtime?.close();
});

async function signedIn(code: string, user: TestUser, channel: 'portal' | 'teacher') {
  // Kết nối thẳng 127.0.0.1 và đặt tiêu đề Host như spec 130, 182
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost(code) } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: user.username, password: user.password, channel },
  });
  expect(response.status(), await response.text()).toBe(200);
  const token = ((await response.json()) as { access_token: string }).access_token;
  return { context, token };
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
  const opened = await call(context, token, 'POST', `/academic-years/${id}/open`);
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
}

test('CT-26g-6: mã thiết bị đẩy gốc của hai trường tách nhau; thông báo của alpha chỉ tới máy đăng ký ở alpha', async () => {
  test.setTimeout(240_000);
  // Khóa FCM của nền tảng: lưu mã hóa ở cơ sở dữ liệu nền tảng, đọc lại được, thôi dùng được
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const summary = await storeNativePushKey(runtime.platform, runtime.configuration.masterKey, 'fcm', {
    projectId: 'truong-gia-lap-e2e',
    clientEmail: 'day@truong-gia-lap-e2e.iam.gserviceaccount.com',
    privateKey: privatePem,
  });
  expect(summary).toEqual({
    project_id: 'truong-gia-lap-e2e',
    client_email: 'day@truong-gia-lap-e2e.iam.gserviceaccount.com',
  });
  const stored = await runtime.platform
    .selectFrom('platform_native_push_keys')
    .select('credentials_encrypted')
    .where('provider', '=', 'fcm')
    .where('retired_at', 'is', null)
    .executeTakeFirstOrThrow();
  expect(stored.credentials_encrypted).not.toContain('PRIVATE KEY');
  const read = await readNativePushCredentials(runtime.platform, runtime.configuration.masterKey);
  expect(read.fcm?.privateKey).toBe(privatePem);
  expect(await retireNativePushKey(runtime.platform, 'fcm')).toBe(true);
  expect((await readNativePushCredentials(runtime.platform, runtime.configuration.masterKey)).fcm).toBeNull();

  const alpha = await signedIn('alpha', parents.alpha as TestUser, 'teacher');
  const beta = await signedIn('beta', parents.beta as TestUser, 'teacher');
  for (const side of [alpha, beta]) {
    const reply = await call(side.context, side.token, 'GET', '/public/push/vapid-public-key');
    expect(reply.body.native).toEqual({ fcm: true, apns: true });
  }

  // Cùng một máy Android (một mã FCM) đăng ký ở cả hai trường
  const token = `${randomBytes(11).toString('base64url')}:APA91b${randomBytes(100).toString('base64url')}`;
  const originA = `http://${schoolHost('alpha')}/giao-vien/`;
  const originB = `http://${schoolHost('beta')}/giao-vien/`;
  const subscribedA = await call(alpha.context, alpha.token, 'POST', '/push/subscriptions', {
    kind: 'fcm',
    token,
    app: 'teacher',
    origin: originA,
  });
  expect(subscribedA.status, JSON.stringify(subscribedA.body)).toBe(200);
  const subscribedB = await call(beta.context, beta.token, 'POST', '/push/subscriptions', {
    kind: 'fcm',
    token,
    app: 'teacher',
    origin: originB,
  });
  expect(subscribedB.status, JSON.stringify(subscribedB.body)).toBe(200);
  // Đăng ký ở beta không thu hồi đăng ký ở alpha (hai cơ sở dữ liệu)
  expect(subscribedB.body.created).toBe(true);
  const alphaList = await call(alpha.context, alpha.token, 'GET', '/push/subscriptions');
  expect((alphaList.body.items as Array<{ id: string; kind: string }>).map((item) => [item.id, item.kind])).toEqual([
    [subscribedA.body.id, 'fcm'],
  ]);
  expect(
    (await call(beta.context, beta.token, 'DELETE', `/push/subscriptions/${subscribedA.body.id as string}`)).status,
  ).toBe(404);
  const betaSystem = runtime.connections.database<SystemDatabase>(tenants.beta as TenantContext, 'system', 'system');
  expect(
    await betaSystem
      .selectFrom('push_subscriptions')
      .select('id')
      .where('id', '=', subscribedA.body.id as string)
      .execute(),
  ).toHaveLength(0);

  // Thông báo của alpha: chỉ đăng ký ở alpha nhận, kèm địa chỉ ứng dụng của alpha, không có nội dung gốc
  const admin = await signedIn('alpha', principal, 'portal');
  await ensureOpenYear(admin.context, admin.token);
  const alphaSystem = runtime.connections.database<SystemDatabase>(tenants.alpha as TenantContext, 'system', 'system');
  const registry = await alphaSystem
    .selectFrom('academic_year_databases')
    .innerJoin('academic_years', 'academic_years.id', 'academic_year_databases.academic_year_id')
    .select('academic_year_databases.database_name')
    .where('academic_years.status', '=', 'open')
    .executeTakeFirstOrThrow();
  const reloaded = await runtime.registry.loadSchool((tenants.alpha as TenantContext).schoolId);
  const year = runtime.connections.database<SchoolYearDatabase>(
    reloaded?.context ?? (tenants.alpha as TenantContext),
    'school-year',
    registry.database_name,
  );
  const secret = `Nội dung riêng ${randomUUID()}`;
  const notification = await year
    .insertInto('notifications')
    .values({
      template_code: 'news_published',
      title: 'Thông báo thử đẩy gốc (e2e)',
      body: secret,
      target_type: 'test',
      target_id: randomUUID(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await year
    .insertInto('notification_recipients')
    .values({ notification_id: notification.id, user_id: parents.alpha?.id as string, channel: 'push' })
    .execute();

  rmSync(E2E_PUSH_OUTBOX_FILE, { force: true });
  await runtime.platform.deleteFrom('scheduler_state').where('job', '=', 'notification-dispatch').execute();
  const jobs = await playwrightRequest.newContext();
  try {
    const ticked = await jobs.post(`${API}/api/v1/internal/jobs/tick`, {
      data: {},
      headers: { 'x-internal-job-token': E2E_SCHEDULER_SECRET },
    });
    expect(ticked.status()).toBe(201);
  } finally {
    await jobs.dispose();
  }
  await expect
    .poll(
      async () =>
        (
          await year
            .selectFrom('notification_recipients')
            .select('channel_status')
            .where('notification_id', '=', notification.id)
            .executeTakeFirstOrThrow()
        ).channel_status,
    )
    .toBe('sent');
  const deliveries = existsSync(E2E_PUSH_OUTBOX_FILE)
    ? readFileSync(E2E_PUSH_OUTBOX_FILE, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as {
              school: string;
              kind: string;
              endpoint: string;
              message: { data: { notification_id: string; app_url?: string } };
            },
        )
    : [];
  const mine = deliveries.filter((delivery) => delivery.message.data.notification_id === notification.id);
  expect(mine.map((delivery) => [delivery.kind, delivery.endpoint, delivery.school])).toEqual([
    ['fcm', token, (tenants.alpha as TenantContext).code],
  ]);
  expect(mine[0]?.message.data.app_url).toBe(originA);
  expect(JSON.stringify(mine)).not.toContain(secret);

  // Đăng xuất ở alpha: thu hồi theo mã thiết bị; đăng ký ở beta vẫn còn
  expect(
    (await call(alpha.context, alpha.token, 'POST', '/push/subscriptions/unsubscribe', { kind: 'fcm', token })).body,
  ).toEqual({ revoked: true });
  const betaList = await call(beta.context, beta.token, 'GET', '/push/subscriptions');
  expect((betaList.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([subscribedB.body.id]);

  for (const side of [alpha, beta, admin]) {
    await side.context.dispose();
  }
});

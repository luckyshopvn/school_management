import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  operatorOtp,
  totpCode,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S8b (YCTD-201, spec 138): bảo mật mã ở nhiều trường. Xác thực hai lớp bắt buộc cho tài khoản vận hành nền tảng và tuỳ chọn theo
// trường cho người dùng của trường (bật ở trường này không ảnh hưởng trường kia); chính sách độ dài mật khẩu riêng từng trường; tiêu đề bảo
// mật, không lưu đệm phản hồi xác thực, cookie mã làm mới có tiền tố __Secure-. Chỉ chạy ở dự án nhiều trường
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const OPERATOR_LOGIN = `van-hanh-bao-mat-${Math.random().toString(36).slice(2, 8)}`;
const OPERATOR_PASSWORD = 'MatKhauVanHanh2026';

let runtime: TenancyRuntime;
const tenants: Record<string, TenantContext> = {};
const admins: Record<string, TestUser> = {};
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

async function tenantRequest(host: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ extraHTTPHeaders: { Host: host } });
}

async function login(code: string, user: TestUser, extra: Record<string, unknown> = {}, channel = 'portal') {
  const context = await tenantRequest(schoolHost(code));
  try {
    const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
      data: { login: user.username, password: user.password, channel, ...extra },
    });
    return {
      status: response.status(),
      body: (await response.json().catch(() => ({}))) as Record<string, unknown>,
      headers: response.headers(),
      cookies: response
        .headersArray()
        .filter((header) => header.name.toLowerCase() === 'set-cookie')
        .map((header) => header.value),
    };
  } finally {
    await context.dispose();
  }
}

async function identity(code: string, method: 'GET' | 'PUT' | 'POST', path: string, token: string, data?: unknown) {
  const context = await tenantRequest(schoolHost(code));
  try {
    const response = await context.fetch(`${IDENTITY}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  } finally {
    await context.dispose();
  }
}

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
    const database = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    admins[code] = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  }
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: OPERATOR_LOGIN,
    fullName: 'Người vận hành bảo mật giả',
    password: OPERATOR_PASSWORD,
  });
});

test.afterAll(async () => {
  await runtime?.close();
});

test('Tài khoản vận hành nền tảng bắt buộc xác thực hai lớp', async () => {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: E2E_CONSOLE_HOST } });
  try {
    const attempt = (otp?: string) =>
      context.post(`${IDENTITY}/api/v1/auth/platform/login`, {
        data: { login: OPERATOR_LOGIN, password: OPERATOR_PASSWORD, ...(otp ? { otp_code: otp } : {}) },
      });
    const missing = await attempt();
    expect(missing.status()).toBe(401);
    expect(JSON.stringify(await missing.json())).toContain('otp_code');
    expect((await attempt('000000')).status()).toBe(401);
    const good = await attempt(await operatorOtp(runtime.platform, operator.id, operator.secret));
    expect(good.status()).toBe(200);
    // Mã đã dùng không dùng lại được trong cùng bước thời gian
    const used = totpCode(operator.secret, new Date());
    expect((await attempt(used)).status()).toBe(401);
    // Khóa TOTP không có bản rõ ở cơ sở dữ liệu nền tảng
    const stored = await runtime.platform
      .selectFrom('platform_operator_totp')
      .select('secret_encrypted')
      .where('operator_id', '=', operator.id)
      .executeTakeFirstOrThrow();
    expect(stored.secret_encrypted).not.toContain(operator.secret);
  } finally {
    await context.dispose();
  }
});

test('Xác thực hai lớp theo trường: bật ở alpha không ảnh hưởng beta', async () => {
  const alphaAdmin = (await login('alpha', admins.alpha as TestUser)).body.access_token as string;
  const betaAdmin = (await login('beta', admins.beta as TestUser)).body.access_token as string;
  expect((await identity('alpha', 'POST', '/auth/totp/setup', alphaAdmin)).status).toBe(422);
  expect((await identity('alpha', 'PUT', '/auth/settings', alphaAdmin, { totp_enabled: true })).status).toBe(200);

  const setup = await identity('alpha', 'POST', '/auth/totp/setup', alphaAdmin);
  expect(setup.status).toBe(200);
  const secret = setup.body.secret as string;
  const confirmed = await identity('alpha', 'POST', '/auth/totp/confirm', alphaAdmin, {
    code: totpCode(secret, new Date()),
  });
  expect(confirmed.status).toBe(200);
  expect((confirmed.body.recovery_codes as string[]).length).toBe(8);

  // Alpha: cần mã; beta (chưa bật) đăng nhập như cũ và không đăng ký được
  const withoutCode = await login('alpha', admins.alpha as TestUser);
  expect(withoutCode.status).toBe(401);
  expect(JSON.stringify(withoutCode.body)).toContain('otp_code');
  expect((await login('beta', admins.beta as TestUser)).status).toBe(200);
  expect((await identity('beta', 'POST', '/auth/totp/setup', betaAdmin)).status).toBe(422);
  const status = await identity('beta', 'GET', '/auth/totp', betaAdmin);
  expect(status.body.feature_enabled).toBe(false);

  // Dọn: tắt cả trường để không ảnh hưởng spec khác
  const recovery = (confirmed.body.recovery_codes as string[])[0] as string;
  const afterRecovery = await login('alpha', admins.alpha as TestUser, { otp_code: recovery });
  expect(afterRecovery.status).toBe(200);
  const token = afterRecovery.body.access_token as string;
  expect((await identity('alpha', 'PUT', '/auth/settings', token, { totp_enabled: false })).status).toBe(200);
  expect((await login('alpha', admins.alpha as TestUser)).status).toBe(200);
});

test('Chính sách độ dài mật khẩu riêng từng trường', async () => {
  const alphaToken = (await login('alpha', admins.alpha as TestUser)).body.access_token as string;
  const betaToken = (await login('beta', admins.beta as TestUser)).body.access_token as string;
  expect(
    (await identity('alpha', 'PUT', '/auth/settings/password-policy', alphaToken, { password_min_length: 14 })).status,
  ).toBe(200);
  try {
    const change = (code: string, token: string, user: TestUser) =>
      identity(code, 'POST', '/auth/change-password', token, {
        current_password: user.password,
        new_password: 'MatKhauMoi2027A',
      });
    // 15 ký tự: đạt cả hai; dùng chính sách 20 để thấy khác biệt
    expect(
      (await identity('alpha', 'PUT', '/auth/settings/password-policy', alphaToken, { password_min_length: 20 }))
        .status,
    ).toBe(200);
    const rejected = await change('alpha', alphaToken, admins.alpha as TestUser);
    expect(rejected.status).toBe(400);
    const accepted = await change('beta', betaToken, admins.beta as TestUser);
    expect(accepted.status).toBe(200);
    admins.beta = { ...(admins.beta as TestUser), password: 'MatKhauMoi2027A' };
  } finally {
    expect(
      (await identity('alpha', 'PUT', '/auth/settings/password-policy', alphaToken, { password_min_length: 8 })).status,
    ).toBe(200);
  }
});

test('Tiêu đề bảo mật, không lưu đệm phản hồi xác thực, cookie mã làm mới có tiền tố __Secure-', async () => {
  const reply = await login('alpha', admins.alpha as TestUser);
  expect(reply.status).toBe(200);
  expect(reply.headers['cache-control']).toBe('no-store');
  expect(reply.headers['x-content-type-options']).toBe('nosniff');
  expect(reply.headers['x-frame-options']).toBe('DENY');
  expect(reply.headers['x-powered-by']).toBeUndefined();
  const cookie = reply.cookies.find((value) => value.includes('refresh_token'));
  expect(cookie?.startsWith('__Secure-refresh_token__')).toBe(true);
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');

  for (const base of [IDENTITY, API]) {
    const context = await playwrightRequest.newContext();
    try {
      const plain = await context.get(`${base}/api/v1/health`);
      expect(plain.headers()['x-content-type-options']).toBe('nosniff');
      expect(plain.headers()['strict-transport-security']).toBeUndefined();
      const secure = await context.get(`${base}/api/v1/health`, { headers: { 'x-forwarded-proto': 'https' } });
      expect(secure.headers()['strict-transport-security']).toContain('max-age=31536000');
    } finally {
      await context.dispose();
    }
  }
});

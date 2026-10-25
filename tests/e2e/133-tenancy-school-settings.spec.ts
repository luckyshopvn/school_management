import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';
import { E2E_MULTI_API_PORT, E2E_MULTI_IDENTITY_PORT, schoolHost } from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S3 (YCTD-195, spec 133): cấu hình kết nối riêng từng trường. Hai trường trên một nền tảng; quản trị của mỗi trường tự nhập khóa
// qua API cấu hình trường, máy chủ lưu mã hóa và không trả lại giá trị bí mật; trường này không thấy cấu hình của trường kia và cổng thanh
// toán của trường chưa cấu hình không nhận thông báo; thương hiệu riêng từng trường ở trang đăng nhập. Chỉ chạy ở dự án nhiều trường
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const MARKER = 'KHOA-E2E-ALPHA-4321';

let runtime: TenancyRuntime;
const users: Record<string, TestUser> = {};
const tokens: Record<string, string> = {};
const tenants: Record<string, TenantContext> = {};

async function tenantRequest(host: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ extraHTTPHeaders: { Host: host } });
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
    users[code] = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    const context = await tenantRequest(schoolHost(code));
    const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
      data: { login: users[code]?.username, password: users[code]?.password, channel: 'portal' },
    });
    expect(response.status()).toBe(200);
    tokens[code] = ((await response.json()) as { access_token: string }).access_token;
    await context.dispose();
  }
});

test.afterAll(async () => {
  await runtime?.close();
});

async function api(code: string, method: 'GET' | 'PUT' | 'DELETE' | 'POST', path: string, data?: unknown) {
  const context = await tenantRequest(schoolHost(code));
  try {
    const response = await context.fetch(`${API}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${tokens[code]}` },
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  } finally {
    await context.dispose();
  }
}

test('Trường tự nhập khóa SePay: lưu mã hóa, không trả lại giá trị, trường kia không thấy', async () => {
  const saved = await api('alpha', 'PUT', '/school-settings/integrations/sepay', {
    enabled: true,
    values: { webhook_api_key: MARKER },
  });
  expect(saved.status).toBe(200);
  expect(JSON.stringify(saved.body)).not.toContain(MARKER);
  expect(JSON.stringify(saved.body)).toContain('4321');

  const listed = await api('alpha', 'GET', '/school-settings/integrations');
  expect(JSON.stringify(listed.body)).not.toContain(MARKER);
  const alphaSepay = (
    listed.body as unknown as Array<{ connector: string; configured: boolean; webhook_url: string }>
  ).find((item) => item.connector === 'sepay');
  expect(alphaSepay?.configured).toBe(true);
  expect(alphaSepay?.webhook_url).toContain('/api/v1/payment-webhooks/sepay');

  const beta = await api('beta', 'GET', '/school-settings/integrations');
  const betaSepay = (beta.body as unknown as Array<{ connector: string; configured: boolean }>).find(
    (item) => item.connector === 'sepay',
  );
  expect(betaSepay?.configured).toBe(false);
  expect(JSON.stringify(beta.body)).not.toContain('4321');
});

test('Cổng thanh toán theo trường: trường chưa cấu hình không nhận thông báo, trường đã cấu hình xác thực khóa', async () => {
  const betaContext = await tenantRequest(schoolHost('beta'));
  const alphaContext = await tenantRequest(schoolHost('alpha'));
  try {
    expect((await betaContext.post(`${API}/api/v1/payment-webhooks/sepay`, { data: {} })).status()).toBe(404);
    const alpha = await alphaContext.post(`${API}/api/v1/payment-webhooks/sepay`, { data: {} });
    expect(alpha.status()).not.toBe(404);
    expect(alpha.status()).toBeLessThan(500);
  } finally {
    await betaContext.dispose();
    await alphaContext.dispose();
  }
  expect((await api('alpha', 'POST', '/school-settings/integrations/sepay/test')).status).toBe(200);
  expect((await api('beta', 'POST', '/school-settings/integrations/sepay/test')).status).toBe(422);
  expect((await api('alpha', 'DELETE', '/school-settings/integrations/sepay')).status).toBe(200);
});

test('Thương hiệu riêng từng trường, trang đăng nhập đọc công khai theo tên miền', async () => {
  const saved = await api('alpha', 'PUT', '/school-settings/branding', {
    display_name: 'Trường Alpha (dữ liệu giả)',
    primary_color: '#2255AA',
  });
  expect(saved.status).toBe(200);
  const alpha = await tenantRequest(schoolHost('alpha'));
  const beta = await tenantRequest(schoolHost('beta'));
  try {
    const alphaInfo = (await (await alpha.get(`${API}/api/v1/public/branding`)).json()) as Record<string, unknown>;
    const betaInfo = (await (await beta.get(`${API}/api/v1/public/branding`)).json()) as Record<string, unknown>;
    expect(alphaInfo.display_name).toBe('Trường Alpha (dữ liệu giả)');
    expect(alphaInfo.primary_color).toBe('#2255AA');
    expect(betaInfo.display_name).not.toBe('Trường Alpha (dữ liệu giả)');
    expect(betaInfo.primary_color).not.toBe('#2255AA');
  } finally {
    await alpha.dispose();
    await beta.dispose();
  }
  expect((await api('alpha', 'PUT', '/school-settings/branding', { primary_color: 'xanh' })).status).toBe(400);
});

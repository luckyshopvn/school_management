import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type SystemDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';
import {
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_PORTAL_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-23 phần 23d (YCTD-214, spec 153): cách ly khóa trợ lý AI giữa các trường. Hai trường trên một nền tảng; quản trị mỗi trường tự nhập khóa AI
// và bật trợ lý (bộ giả lập `mock`, không gọi dịch vụ ngoài); trường này không dùng được khóa của trường kia, trường xóa khóa thì đóng chặt,
// không rơi về khóa của trường khác; khóa lưu mã hóa và không trả lại giá trị; màn hình quản trị AI nhập khóa, bật, kiểm tra kết nối. Chỉ chạy
// ở dự án nhiều trường (pnpm --filter @school-management/tests e2e:multi). Dữ liệu giả
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const KEYS = { alpha: 'KHOA-E2E-AI-ALPHA-7001', beta: 'KHOA-E2E-AI-BETA-8002' } as const;

let runtime: TenancyRuntime;
const users: Record<string, TestUser> = {};
const tokens: Record<string, string> = {};
const tenants: Record<string, TenantContext> = {};

const tenantRequest = (host: string): Promise<APIRequestContext> =>
  playwrightRequest.newContext({ extraHTTPHeaders: { Host: host } });

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

test('Khóa AI theo trường: mỗi trường dùng khóa của mình, xóa khóa thì đóng chặt, khóa không lộ', async () => {
  for (const code of ['alpha', 'beta'] as const) {
    const saved = await api(code, 'PUT', '/school-settings/integrations/ai', {
      enabled: true,
      values: { api_key: KEYS[code] },
    });
    expect(saved.status).toBe(200);
    expect(JSON.stringify(saved.body)).not.toContain(KEYS[code]);
    const settings = await api(code, 'PUT', '/ai/settings', {
      enabled: true,
      key_mode: 'school',
      provider: 'mock',
      per_user_daily_requests: null,
    });
    expect(settings.status).toBe(200);
  }
  const alpha = await api('alpha', 'POST', '/ai/check');
  expect(alpha.status).toBe(200);
  expect(String(alpha.body.detail)).toContain('7001');
  expect(String(alpha.body.detail)).not.toContain('8002');
  const beta = await api('beta', 'POST', '/ai/check');
  expect(beta.status).toBe(200);
  expect(String(beta.body.detail)).toContain('8002');
  expect(String(beta.body.detail)).not.toContain('7001');

  // Khóa lưu mã hóa ở cơ sở dữ liệu hệ thống của chính trường, không có bản rõ và không có ở trường kia
  for (const code of ['alpha', 'beta'] as const) {
    const system = runtime.connections.database<SystemDatabase>(tenants[code] as TenantContext, 'system', 'system');
    const rows = await system.selectFrom('integration_secrets').selectAll().where('connector', '=', 'ai').execute();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(KEYS[code]);
  }

  // Beta xóa khóa: không rơi về khóa của alpha; alpha vẫn dùng được
  expect((await api('beta', 'DELETE', '/school-settings/integrations/ai')).status).toBe(200);
  const closed = await api('beta', 'POST', '/ai/check');
  expect(closed.status).toBe(422);
  expect(JSON.stringify(closed.body)).not.toContain('7001');
  expect((await api('beta', 'GET', '/ai/status')).body.ready).toBe(false);
  expect((await api('alpha', 'POST', '/ai/check')).status).toBe(200);
  expect((await api('alpha', 'GET', '/ai/status')).body.ready).toBe(true);

  // Cấu hình do nền tảng cấp khóa chưa dùng được khi gói chưa có đơn giá AI: không ai dùng được khóa chung ngoài ý định
  const platformMode = await api('alpha', 'PUT', '/ai/settings', {
    enabled: true,
    key_mode: 'platform',
    provider: 'mock',
    per_user_daily_requests: null,
  });
  expect(platformMode.status).toBe(200);
  expect((await api('alpha', 'GET', '/ai/status')).body.ready).toBe(false);
  expect((await api('alpha', 'POST', '/ai/check')).status).toBe(422);
  await api('alpha', 'PUT', '/ai/settings', { enabled: false, key_mode: 'school', provider: 'mock' });
  await api('beta', 'PUT', '/ai/settings', { enabled: false, key_mode: 'school', provider: 'mock' });
  await api('alpha', 'DELETE', '/school-settings/integrations/ai');
});

test('Màn hình quản trị AI: bật, nhập khóa, kiểm tra kết nối ở trường alpha', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}` });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill((users.alpha as TestUser).username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill((users.alpha as TestUser).password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await page.goto('/ai-assistant');
  await expect(page.getByRole('heading', { name: '3.8. Trợ lý AI' })).toBeVisible();
  await expect(page.getByText(/Trợ lý AI chưa dùng được/)).toBeVisible();

  const settings = page.getByRole('form', { name: 'Thiết lập trợ lý AI' });
  await settings.getByLabel('Bật trợ lý AI').check();
  await page.getByLabel('Đã đọc thông báo bật AI').check();
  await page.getByLabel('Nhà cung cấp AI', { exact: true }).selectOption('mock');
  await settings.getByRole('button', { name: 'Lưu thiết lập' }).click();
  await expect(page.getByText('Đã lưu thiết lập trợ lý AI')).toBeVisible();

  await page.getByLabel('Khóa API của nhà cung cấp AI').fill(KEYS.alpha);
  await page.getByRole('button', { name: 'Lưu khóa' }).click();
  await expect(page.getByText('Đã lưu khóa AI của trường')).toBeVisible();
  await expect(page.getByText('Trợ lý AI đang bật và sẵn sàng.')).toBeVisible();
  // Khóa không bao giờ hiện lại, chỉ bốn ký tự cuối
  await expect(page.getByText(KEYS.alpha)).toHaveCount(0);
  await expect(page.getByText(/••••7001/)).toBeVisible();

  await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
  await expect(page.getByText(/Bộ giả lập nhận khóa ••••7001/)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Yêu cầu AI' }).getByText('Kiểm tra kết nối').first()).toBeVisible();
  await context.close();

  // Dọn: tắt AI và xóa khóa để các spec khác không bị ảnh hưởng
  await api('alpha', 'PUT', '/ai/settings', { enabled: false, key_mode: 'school', provider: 'mock' });
  await api('alpha', 'DELETE', '/school-settings/integrations/ai');
});

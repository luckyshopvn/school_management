import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_PORTAL_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S1a (YCTD-191, spec 130): hai trường trên một nền tảng, mỗi trường một tên miền con `*.e2e.localhost`. Dịch vụ định
// danh và máy chủ API nhận diện trường theo tên miền; dữ liệu và phiên không lẫn giữa hai trường. Chỉ chạy ở dự án nhiều trường
// (pnpm --filter @school-management/tests e2e:multi); dự án một trường bỏ qua tệp này
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;

let runtime: TenancyRuntime;
const users: Record<string, TestUser> = {};
const tenants: Record<string, TenantContext> = {};

// Kết nối thẳng 127.0.0.1 và đặt tiêu đề Host: không phụ thuộc việc hệ điều hành phân giải `*.localhost`
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
  }
});

test.afterAll(async () => {
  await runtime?.close();
});

async function apiLogin(host: string, user: TestUser): Promise<string> {
  const context = await tenantRequest(host);
  try {
    const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
      data: { login: user.username, password: user.password, channel: 'portal' },
    });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { access_token: string }).access_token;
  } finally {
    await context.dispose();
  }
}

test('Tên miền lạ và địa chỉ nội bộ trả 404 chung, kiểm tra sức khỏe không cần trường', async () => {
  for (const base of [IDENTITY, API]) {
    const unknown = await tenantRequest('khong-co.e2e.localhost');
    expect((await unknown.get(`${base}/api/v1/org-units`)).status()).toBe(404);
    expect((await unknown.get(`${base}/api/v1/health`)).status()).toBe(200);
    await unknown.dispose();
  }
});

test('Mã phiên của trường A bị từ chối ở máy chủ API và dịch vụ định danh của trường B', async () => {
  const token = await apiLogin(schoolHost('alpha'), users.alpha as TestUser);
  const headers = { authorization: `Bearer ${token}` };
  const alpha = await tenantRequest(schoolHost('alpha'));
  const beta = await tenantRequest(schoolHost('beta'));
  try {
    expect((await alpha.get(`${API}/api/v1/org-units`, { headers })).status()).toBe(200);
    expect((await beta.get(`${API}/api/v1/org-units`, { headers })).status()).toBe(401);
    expect((await alpha.get(`${IDENTITY}/api/v1/auth/me`, { headers })).status()).toBe(200);
    expect((await beta.get(`${IDENTITY}/api/v1/auth/me`, { headers })).status()).toBe(401);
  } finally {
    await alpha.dispose();
    await beta.dispose();
  }
});

test('Cổng nền tảng chỉ phục vụ ở tên miền riêng của nó', async () => {
  const school = await tenantRequest(schoolHost('alpha'));
  const consoleHost = await tenantRequest(E2E_CONSOLE_HOST);
  try {
    const body = { data: { login: 'khong-co', password: 'MatKhau2026' } };
    expect((await school.post(`${IDENTITY}/api/v1/auth/platform/login`, body)).status()).toBe(404);
    // Ở tên miền cổng nền tảng yêu cầu được xử lý (tài khoản không có thì 401), không phải 404
    expect((await consoleHost.post(`${IDENTITY}/api/v1/auth/platform/login`, body)).status()).toBe(401);
  } finally {
    await school.dispose();
    await consoleHost.dispose();
  }
});

async function signIn(page: import('@playwright/test').Page, user: TestUser, password = user.password) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('Hai trường đăng nhập đồng thời ở hai tên miền con: phiên và cookie không lẫn, tài khoản không đăng nhập chéo', async ({
  browser,
}) => {
  const alphaContext = await browser.newContext({ baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}` });
  const betaContext = await browser.newContext({ baseURL: `http://${schoolHost('beta')}:${E2E_MULTI_PORTAL_PORT}` });
  const alphaPage = await alphaContext.newPage();
  const betaPage = await betaContext.newPage();

  await signIn(alphaPage, users.alpha as TestUser);
  await signIn(betaPage, users.beta as TestUser);
  await expect(alphaPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await expect(betaPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  const alphaGreeting = await alphaPage.getByRole('heading', { name: /^Xin chào,/ }).innerText();
  const betaGreeting = await betaPage.getByRole('heading', { name: /^Xin chào,/ }).innerText();
  expect(alphaGreeting).not.toBe(betaGreeting);

  // Cookie mã làm mới mang mã trường của tên miền đã đăng nhập
  const alphaCookies = (await alphaContext.cookies()).map((cookie) => cookie.name);
  const betaCookies = (await betaContext.cookies()).map((cookie) => cookie.name);
  expect(alphaCookies.some((name) => name.includes('__alpha'))).toBe(true);
  expect(alphaCookies.some((name) => name.includes('__beta'))).toBe(false);
  expect(betaCookies.some((name) => name.includes('__beta'))).toBe(true);
  expect(betaCookies.some((name) => name.includes('__alpha'))).toBe(false);

  // Tải lại trang vẫn giữ phiên đúng trường
  await alphaPage.reload();
  await expect(alphaPage.getByRole('heading', { name: /^Xin chào,/ })).toHaveText(alphaGreeting);

  // Tài khoản của trường alpha không đăng nhập được ở tên miền của trường beta
  const crossContext = await browser.newContext({ baseURL: `http://${schoolHost('beta')}:${E2E_MULTI_PORTAL_PORT}` });
  const crossPage = await crossContext.newPage();
  await signIn(crossPage, users.alpha as TestUser);
  await expect(crossPage.getByRole('alert')).toContainText('mật khẩu không đúng');
  await expect(crossPage.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

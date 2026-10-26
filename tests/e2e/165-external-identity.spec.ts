import { expect, test } from './fixtures.js';
import type { APIRequestContext } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser, MockOidcServer, type MockIdentity, type TestUser } from '@school-management/identity/testing';
import { logout } from './menu.js';
import {
  E2E_IDENTITY_PORT,
  E2E_OIDC_CLIENT_ID,
  E2E_OIDC_CLIENT_SECRET,
  E2E_OIDC_MOCK_PORT,
  E2E_OIDC_PROVIDER_CODE,
  E2E_PORTAL_PORT,
} from '../e2e-environment.mjs';

// Bộ nối nhà cung cấp định danh OIDC, sẵn cho VNeID (DT-25, YCTD-225; tài liệu 32 mục 17): luồng máy chủ chạy trên dịch vụ định danh e2e
// thật với nhà cung cấp OIDC giả lập cục bộ (không gọi dịch vụ thật, khóa ký sinh mới mỗi lượt). Nút "Đăng nhập bằng ..." trên màn hình
// đăng nhập làm sau khi DT-24 gộp; spec này kiểm phần máy chủ: bật theo trường, liên kết bằng mật khẩu, đăng nhập, chữ ký sai, nonce sai,
// subject đã liên kết với người khác, trường tắt nhà cung cấp
const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const identity = `http://localhost:${E2E_IDENTITY_PORT}/api/v1`;
const redirectUri = `http://localhost:${E2E_PORTAL_PORT}/dang-nhap/ben-ngoai`;
const CODE = E2E_OIDC_PROVIDER_CODE;
let mock: MockOidcServer;
let manager: TestUser;
let teacher: TestUser;
let other: TestUser;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  mock = await new MockOidcServer({
    port: E2E_OIDC_MOCK_PORT,
    clientId: E2E_OIDC_CLIENT_ID,
    clientSecret: E2E_OIDC_CLIENT_SECRET,
  }).start();
  await database.deleteFrom('external_identity_providers').where('provider_code', '=', CODE).execute();
  manager = await createTestUser(database, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
  teacher = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  other = await createTestUser(database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
});

test.afterAll(async () => {
  await database.deleteFrom('external_identity_providers').where('provider_code', '=', CODE).execute();
  await database.destroy();
  await mock?.stop();
});

async function passwordLogin(request: APIRequestContext, user: TestUser): Promise<string> {
  const reply = await request.post(`${identity}/auth/login`, {
    data: { login: user.username, password: user.password, channel: 'portal' },
  });
  expect(reply.status()).toBe(200);
  return (await reply.json()).access_token as string;
}

async function externalLogin(request: APIRequestContext, who: MockIdentity) {
  const started = await request.post(`${identity}/auth/external/${CODE}/start`, {
    data: { channel: 'portal', redirect_uri: redirectUri },
  });
  expect(started.status()).toBe(200);
  const issued = mock.authorize((await started.json()).authorization_url as string, who);
  return request.post(`${identity}/auth/external/callback`, { data: { state: issued.state, code: issued.code } });
}

async function link(request: APIRequestContext, user: TestUser, subject: string) {
  const token = await passwordLogin(request, user);
  const started = await request.post(`${identity}/auth/external/${CODE}/link`, {
    data: { password: user.password, redirect_uri: redirectUri },
    headers: { authorization: `Bearer ${token}` },
  });
  expect(started.status()).toBe(200);
  const issued = mock.authorize((await started.json()).authorization_url as string, { subject });
  return request.post(`${identity}/auth/external/callback`, {
    data: { state: issued.state, code: issued.code },
    headers: { authorization: `Bearer ${token}` },
  });
}

test('Mặc định tắt: không có nút; quản lý tài khoản bật thì có nút đăng nhập bằng nhà cung cấp', async ({
  request,
}) => {
  expect((await (await request.get(`${identity}/auth/external/providers`)).json()).providers).toEqual([]);
  const token = await passwordLogin(request, manager);
  const saved = await request.put(`${identity}/auth/external/settings/${CODE}`, {
    data: { enabled: true },
    headers: { authorization: `Bearer ${token}` },
  });
  expect(saved.status()).toBe(200);
  const providers = (await (await request.get(`${identity}/auth/external/providers`)).json()).providers;
  expect(providers).toEqual([{ code: CODE, display_name: 'Định danh giả lập', profile: 'oidc' }]);
});

test('Chưa liên kết thì bị từ chối; liên kết bằng mật khẩu rồi đăng nhập được bằng nhà cung cấp', async ({
  request,
}) => {
  expect((await externalLogin(request, { subject: 'e2e-giao-vien-1' })).status()).toBe(401);
  const linked = await link(request, teacher, 'e2e-giao-vien-1');
  expect(linked.status()).toBe(200);
  expect((await linked.json()).status).toBe('linked');
  const signedIn = await externalLogin(request, { subject: 'e2e-giao-vien-1' });
  expect(signedIn.status()).toBe(200);
  const body = await signedIn.json();
  expect(body.status).toBe('signed_in');
  const me = await request.get(`${identity}/auth/me`, { headers: { authorization: `Bearer ${body.access_token}` } });
  expect((await me.json()).id).toBe(teacher.id);
});

test('Chữ ký sai và nonce sai bị từ chối; subject đã liên kết với người khác không liên kết được', async ({
  request,
}) => {
  expect((await externalLogin(request, { subject: 'e2e-giao-vien-1', tamper: 'signature' })).status()).toBe(401);
  expect((await externalLogin(request, { subject: 'e2e-giao-vien-1', tamper: 'nonce' })).status()).toBe(401);
  expect((await link(request, other, 'e2e-giao-vien-1')).status()).toBe(409);
});

// Giao diện (bước 25b): liên kết ở Tài khoản của tôi rồi đăng nhập bằng nút trên màn hình đăng nhập; nhà cung cấp giả lập chuyển
// trình duyệt về /dang-nhap/ben-ngoai với danh tính đặt trước
test('Giao diện: liên kết ở Tài khoản của tôi, đăng nhập bằng nút nhà cung cấp, gỡ liên kết', async ({ page }) => {
  const principal = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  await page.goto('/my-profile');
  const panel = page.getByRole('region', { name: 'Liên kết tài khoản' });
  await expect(panel).toContainText('Định danh giả lập: chưa liên kết');
  await panel.getByRole('button', { name: 'Liên kết Định danh giả lập' }).click();
  await panel.getByLabel('Mật khẩu hiện tại').fill(principal.password);
  // Subject riêng mỗi lần chạy (kể cả lần chạy lại của CI)
  mock.nextIdentity = { subject: `e2e-giao-dien-${Date.now()}` };
  await panel.getByRole('button', { name: 'Tiếp tục tới nhà cung cấp' }).click();
  await page.waitForURL((url) => url.pathname === '/my-profile');
  await expect(panel).toContainText('Định danh giả lập: đã liên kết');

  await logout(page);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng nhập bằng Định danh giả lập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();

  // Gỡ liên kết cần mật khẩu; sau đó đăng nhập bằng nhà cung cấp bị từ chối
  await page.goto('/my-profile');
  await panel.getByRole('button', { name: 'Gỡ liên kết Định danh giả lập' }).click();
  await panel.getByLabel('Mật khẩu hiện tại').fill(principal.password);
  await panel.getByRole('button', { name: 'Gỡ liên kết', exact: true }).click();
  await expect(panel).toContainText('Đã gỡ liên kết Định danh giả lập');
  await logout(page);
  await page.getByRole('button', { name: 'Đăng nhập bằng Định danh giả lập' }).click();
  await expect(page.getByRole('alert')).toContainText('chưa liên kết');
  mock.nextIdentity = null;
});

test('Trường tắt nhà cung cấp thì không đăng nhập được và nút biến mất', async ({ request, page }) => {
  const token = await passwordLogin(request, manager);
  await request.put(`${identity}/auth/external/settings/${CODE}`, {
    data: { enabled: false },
    headers: { authorization: `Bearer ${token}` },
  });
  expect((await (await request.get(`${identity}/auth/external/providers`)).json()).providers).toEqual([]);
  const started = await request.post(`${identity}/auth/external/${CODE}/start`, {
    data: { channel: 'portal', redirect_uri: redirectUri },
  });
  expect(started.status()).toBe(422);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập bằng Định danh giả lập' })).toHaveCount(0);
});

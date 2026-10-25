import { request as playwrightRequest } from '@playwright/test';
import {
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';
import { E2E_MULTI_API_PORT, E2E_MULTI_PORTAL_PORT, schoolHost } from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';

// DT-SaaS phần S5a (YCTD-194, spec 134), kịch bản CT-S5a-8: trường alpha gán gói chỉ có phân hệ Quản lý giáo dục: menu không có
// phân hệ ngoài gói, máy chủ trả 403 MODULE_NOT_IN_PLAN; trường beta quá hạn ở chế độ chỉ đọc: dải báo chỉ đọc, ghi bị chặn
// 403 SCHOOL_READ_ONLY. Cuối kịch bản trả lại như cũ. Chỉ chạy ở dự án nhiều trường (pnpm --filter @school-management/tests
// e2e:multi). Dữ liệu giả
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;

let runtime: TenancyRuntime;
const users: Record<string, TestUser> = {};
const tenants: Record<string, TenantContext> = {};
let planId = '';

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
  const platform = runtime.platform;
  const plan = await platform
    .insertInto('plans')
    .values({
      code: `e2e-${Date.now() % 1_000_000}`,
      name: 'Gói chỉ quản lý giáo dục (e2e)',
      modules: JSON.stringify(['education']),
      max_active_students: 500,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  planId = plan.id;
  await platform
    .insertInto('school_plans')
    .values({ school_id: tenants.alpha?.schoolId as string, plan_id: planId, effective_from: '2020-01-01' })
    .execute();
  await platform
    .updateTable('schools')
    .set({ status: 'read_only', paid_until: '2020-01-01' })
    .where('id', '=', tenants.beta?.schoolId as string)
    .execute();
});

test.afterAll(async () => {
  if (runtime) {
    await runtime.platform.deleteFrom('school_plans').where('plan_id', '=', planId).execute();
    await runtime.platform.deleteFrom('plans').where('id', '=', planId).execute();
    await runtime.platform
      .updateTable('schools')
      .set({ status: 'active', paid_until: null })
      .where('id', '=', tenants.beta?.schoolId as string)
      .execute();
    await runtime.close();
  }
});

async function signIn(page: Page, user: TestUser) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function apiCall(code: string, method: 'GET' | 'POST', path: string, token: string) {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost(code) } });
  try {
    const response = await context.fetch(`${API}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      ...(method === 'POST' ? { data: { code: 'E2E-RO', name: 'Chỉ đọc', unit_type: 'truong_chinh' } } : {}),
    });
    return { status: response.status(), body: (await response.json()) as { error?: { code?: string } } };
  } finally {
    await context.dispose();
  }
}

test('CT-S5a-8: phân hệ ngoài gói không hiện, máy chủ chặn; trường chỉ đọc có dải báo, ghi bị chặn', async ({
  browser,
}) => {
  const alphaContext = await browser.newContext({ baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}` });
  const alpha = await alphaContext.newPage();
  const tokens: string[] = [];
  alpha.on('request', (request) => {
    const header = request.headers().authorization;
    if (header?.startsWith('Bearer ')) {
      tokens.push(header.slice(7));
    }
  });
  await signIn(alpha, users.alpha as TestUser);
  const workspaces = alpha.getByLabel('Phân hệ', { exact: true });
  await expect(workspaces).toBeVisible();
  const labels = await workspaces.locator('option').allInnerTexts();
  expect(labels.some((label) => label.includes('Quản lý giáo dục'))).toBe(true);
  expect(labels.some((label) => label.includes('Kho học liệu'))).toBe(false);
  expect(labels.some((label) => label.includes('Tài chính'))).toBe(false);
  const alphaToken = tokens.at(-1) ?? '';
  const blocked = await apiCall('alpha', 'GET', '/learning-resources/catalog', alphaToken);
  expect(blocked.status).toBe(403);
  expect(blocked.body.error?.code).toBe('MODULE_NOT_IN_PLAN');
  await alphaContext.close();

  const betaContext = await browser.newContext({ baseURL: `http://${schoolHost('beta')}:${E2E_MULTI_PORTAL_PORT}` });
  const beta = await betaContext.newPage();
  const betaTokens: string[] = [];
  beta.on('request', (request) => {
    const header = request.headers().authorization;
    if (header?.startsWith('Bearer ')) {
      betaTokens.push(header.slice(7));
    }
  });
  await signIn(beta, users.beta as TestUser);
  await expect(beta.getByRole('alert', { name: 'Chế độ chỉ đọc' })).toContainText('chế độ chỉ đọc');
  const betaToken = betaTokens.at(-1) ?? '';
  expect((await apiCall('beta', 'GET', '/org-units', betaToken)).status).toBe(200);
  const write = await apiCall('beta', 'POST', '/org-units', betaToken);
  expect(write.status).toBe(403);
  expect(write.body.error?.code).toBe('SCHOOL_READ_ONLY');
  await betaContext.close();
});

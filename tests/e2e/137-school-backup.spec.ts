import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupSchool,
  dropSchool,
  readTenancyConfiguration,
  resumeSchool,
  restoreSchool,
  TenancyRuntime,
  type IdentityDatabase,
  type LifecycleEnvironment,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  operatorOtp,
  type TestUser,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_PORTAL_PORT,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S7b (YCTD-199, spec 137): sao lưu logic trường alpha, khôi phục thành trường mới alpha-kp (bản để xem lại) ở bố cục
// đang chạy (database hoặc schema theo E2E_TENANT_LAYOUT), mở lại; người dùng của alpha đăng nhập được ở tên miền của bản khôi
// phục; cổng nền tảng hiện lịch sử sao lưu, khôi phục của từng trường. Dữ liệu giả hoàn toàn
const RESTORED = 'alpha-kp';
const PASSPHRASE = 'cum-tu-kiem-thu-e2e-gia-du-dai';
const PASSWORD = 'MatKhauVanHanh2026';
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
const operatorLogin = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;

let runtime: TenancyRuntime;
let environment: LifecycleEnvironment;
let directory: string;
let user: TestUser;

async function removeRestored(): Promise<void> {
  const school = await runtime.platform
    .selectFrom('schools')
    .select('id')
    .where('code', '=', RESTORED)
    .executeTakeFirst();
  if (school) {
    await dropSchool({
      platform: runtime.platform,
      masterKey: environment.masterKey,
      layout: environment.layout,
      schoolId: school.id,
    });
  }
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration || !configuration.adminDatabaseUrl) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  if (!runtime.layout) {
    throw new Error('Thiếu PLATFORM_ADMIN_DATABASE_URL');
  }
  environment = {
    platform: runtime.platform,
    masterKey: configuration.masterKey,
    layout: runtime.layout,
    systemDomain: 'e2e.localhost',
  };
  await removeRestored();
  directory = await mkdtemp(join(tmpdir(), 'e2e-s7b-'));
  const tenant = await runtime.registry.resolveHost(schoolHost('alpha'));
  if (!tenant) {
    throw new Error('Chưa dựng trường alpha');
  }
  user = await createTestUser(runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity'), {
    roles: [{ roleCode: 'VT-02', orgUnitId: null }],
  });
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Người vận hành giả',
    password: PASSWORD,
  });
});

test.afterAll(async () => {
  if (runtime) {
    await removeRestored();
    await runtime.close();
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Sao lưu một trường, khôi phục thành trường mới; người dùng đăng nhập được ở bản khôi phục; cổng nền tảng hiện lịch sử', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const actor = { type: 'cli' as const, name: 'Kiểm thử e2e S7b' };
  const summary = await backupSchool({
    platform: runtime.platform,
    masterKey: environment.masterKey,
    code: 'alpha',
    passphrase: PASSPHRASE,
    directory,
    actor,
  });
  expect(summary.databases).toBeGreaterThanOrEqual(2);
  const restored = await restoreSchool({
    environment,
    file: summary.file,
    passphrase: PASSPHRASE,
    target: { mode: 'new', code: RESTORED },
    actor,
  });
  expect(restored.tables).toBe(summary.tables);
  await resumeSchool(environment, RESTORED, actor, 'Mở bản khôi phục để xem lại (giả)');

  // Người dùng của alpha đăng nhập được ở tên miền của bản khôi phục
  const schoolContext = await browser.newContext({
    baseURL: `http://${schoolHost(RESTORED)}:${E2E_MULTI_PORTAL_PORT}`,
  });
  const schoolPage = await schoolContext.newPage();
  await schoolPage.goto('/login');
  await schoolPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await schoolPage.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await schoolPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(schoolPage.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible({ timeout: 20_000 });
  await schoolContext.close();

  // Cổng nền tảng: lịch sử sao lưu của alpha, khôi phục của bản mới
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await consolePage.getByLabel('Tên đăng nhập').fill(operatorLogin);
  await consolePage.getByLabel('Mật khẩu').fill(PASSWORD);
  await consolePage
    .getByLabel('Mã xác thực hai lớp')
    .fill(await operatorOtp(runtime.platform, operator.id, operator.secret));
  await consolePage.getByRole('button', { name: 'Đăng nhập' }).click();
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Trường' }).click();
  await consolePage.getByRole('button', { name: 'alpha', exact: true }).click();
  const alphaHistory = consolePage.getByRole('table', { name: 'Sao lưu và khôi phục' });
  await expect(alphaHistory.getByRole('row', { name: /Sao lưu Đạt/ }).first()).toBeVisible();
  await consolePage.getByRole('button', { name: '← Danh sách trường' }).click();
  await consolePage.getByRole('button', { name: RESTORED, exact: true }).click();
  await expect(
    consolePage.getByRole('table', { name: 'Sao lưu và khôi phục' }).getByRole('row', { name: /Khôi phục Đạt/ }),
  ).toBeVisible();
  await consoleContext.close();
});

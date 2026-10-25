import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { replaceDatabaseName, testAdminDatabaseUrl } from '@school-management/database';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_PORTAL_PORT,
  E2E_MULTI_STATE_FILE,
  E2E_PLATFORM_DATABASE_NAME,
  E2E_SHARED_DATABASE_NAME,
  MULTI_TENANT_SPEC,
} from './e2e-multi-environment.mjs';

// Kiểm thử giao diện nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14.7): một dịch vụ định danh, một máy chủ API, một cổng quản trị
// phục vụ nhiều trường theo tên miền con `*.e2e.localhost`; nền tảng và các trường giả do e2e-multi-setup.mjs dựng trước mỗi lần chạy.
// Chạy: pnpm --filter @school-management/tests e2e:multi
if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const isContinuousIntegration = Boolean(process.env.CI);
const identityBaseUrl = `http://localhost:${E2E_MULTI_IDENTITY_PORT}`;
const apiBaseUrl = `http://localhost:${E2E_MULTI_API_PORT}`;

// Trạng thái do e2e-multi-setup.mjs ghi (khóa gốc của lần chạy, bố cục); chưa có thì chưa chạy bước dựng
const state = existsSync(E2E_MULTI_STATE_FILE)
  ? (JSON.parse(readFileSync(E2E_MULTI_STATE_FILE, 'utf8')) as { masterKey: string; layout: 'database' | 'schema' })
  : { masterKey: '', layout: 'database' as const };
const adminUrl = testAdminDatabaseUrl();
const platformEnvironment: Record<string, string> = {
  PLATFORM_DATABASE_URL: replaceDatabaseName(adminUrl, E2E_PLATFORM_DATABASE_NAME),
  PLATFORM_MASTER_KEY: state.masterKey,
  PLATFORM_ADMIN_DATABASE_URL: adminUrl,
  TENANT_DB_LAYOUT: state.layout,
  ...(state.layout === 'schema' ? { PLATFORM_SHARED_DATABASE: E2E_SHARED_DATABASE_NAME } : {}),
  TENANT_HOST_SOURCE: 'host',
};
// Tệp kiểm thử cũng dựng thời gian chạy nền tảng để tạo tài khoản cho từng trường
Object.assign(process.env, platformEnvironment);

export default defineConfig({
  testDir: './e2e',
  testMatch: MULTI_TENANT_SPEC,
  fullyParallel: false,
  workers: 1,
  forbidOnly: isContinuousIntegration,
  retries: isContinuousIntegration ? 1 : 0,
  timeout: isContinuousIntegration ? 60_000 : 30_000,
  reporter: isContinuousIntegration ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium-multi', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../apps/identity/dist/main.js',
      url: `${identityBaseUrl}/api/v1/health`,
      env: {
        ...platformEnvironment,
        IDENTITY_PORT: String(E2E_MULTI_IDENTITY_PORT),
        API_BASE_URL: apiBaseUrl,
        LOGIN_REQUESTS_PER_MINUTE: '60',
        PLATFORM_CONSOLE_HOST: E2E_CONSOLE_HOST,
      },
    },
    {
      command: 'node ../apps/api/dist/main.js',
      url: `${apiBaseUrl}/api/v1/health`,
      env: {
        ...platformEnvironment,
        API_PORT: String(E2E_MULTI_API_PORT),
        IDENTITY_BASE_URL: identityBaseUrl,
        PAYMENT_GATEWAY: 'development,vietqr-static',
        FACEBOOK_PUBLISHER: 'development',
        ZALO_SENDER: 'development',
      },
    },
    {
      command: `pnpm --filter @school-management/portal exec vite --port ${E2E_MULTI_PORTAL_PORT} --strictPort`,
      url: `http://localhost:${E2E_MULTI_PORTAL_PORT}`,
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
  ],
});

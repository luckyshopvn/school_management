import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { replaceDatabaseName } from '@school-management/database';
import {
  E2E_API_PORT,
  E2E_IDENTITY_PORT,
  E2E_PARENT_PORT,
  E2E_TEACHER_PORT,
  E2E_PORTAL_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_SYSTEM_DATABASE_NAME,
} from './e2e-environment.mjs';

// Kiểm thử giao diện chạy trên dịch vụ định danh, máy chủ API và cổng quản trị thật (YCTD-36);
// cơ sở dữ liệu hệ thống riêng do e2e-setup.mjs chuẩn bị trước mỗi lần chạy
if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const isContinuousIntegration = Boolean(process.env.CI);
const identityBaseUrl = `http://localhost:${E2E_IDENTITY_PORT}`;
const apiBaseUrl = `http://localhost:${E2E_API_PORT}`;
const systemDatabaseUrl = replaceDatabaseName(process.env.SYSTEM_DATABASE_URL ?? '', E2E_SYSTEM_DATABASE_NAME);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isContinuousIntegration,
  retries: 0,
  reporter: isContinuousIntegration ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORTAL_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../apps/identity/dist/main.js',
      url: `${identityBaseUrl}/api/v1/health`,
      env: { IDENTITY_PORT: String(E2E_IDENTITY_PORT), API_BASE_URL: apiBaseUrl, LOGIN_REQUESTS_PER_MINUTE: '60' },
    },
    {
      command: 'node ../apps/api/dist/main.js',
      url: `${apiBaseUrl}/api/v1/health`,
      env: {
        API_PORT: String(E2E_API_PORT),
        IDENTITY_BASE_URL: identityBaseUrl,
        SYSTEM_DATABASE_URL: systemDatabaseUrl,
        SCHOOL_YEAR_DATABASE_PREFIX: E2E_SCHOOL_YEAR_DATABASE_PREFIX,
      },
    },
    {
      command: `pnpm --filter @school-management/portal exec vite --port ${E2E_PORTAL_PORT} --strictPort`,
      url: `http://localhost:${E2E_PORTAL_PORT}`,
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
    {
      command: `pnpm --filter @school-management/teacher exec vite --port ${E2E_TEACHER_PORT} --strictPort`,
      url: `http://localhost:${E2E_TEACHER_PORT}`,
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
    {
      command: `pnpm --filter @school-management/parent exec vite --port ${E2E_PARENT_PORT} --strictPort`,
      url: `http://localhost:${E2E_PARENT_PORT}`,
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
  ],
});

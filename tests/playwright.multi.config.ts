import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { replaceDatabaseName, testAdminDatabaseUrl } from '@school-management/database';
import {
  E2E_CONSOLE_HOST,
  E2E_ROOT_DOMAIN,
  E2E_SCHEDULER_SECRET,
  E2E_MULTI_API_PORT,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_PORTAL_PORT,
  E2E_MULTI_STATE_FILE,
  E2E_PUSH_OUTBOX_FILE,
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
  // Trường mới khởi tạo ở cổng nền tảng có tên miền <mã>.e2e.localhost (DT-SaaS phần S2, dịch vụ định danh đọc tên miền hệ thống);
  // trạng thái trường đổi thì máy chủ API đọc lại sau 1 giây
  PLATFORM_ROOT_DOMAIN: E2E_ROOT_DOMAIN,
  TENANT_CACHE_SECONDS: '1',
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
        // Spec 134 (S5a) đổi gói, trạng thái trường ở cơ sở dữ liệu nền tảng giữa chừng: nạp lại ngữ cảnh trường sau 2 giây
        TENANT_CACHE_SECONDS: '2',
        API_BASE_URL: apiBaseUrl,
        LOGIN_REQUESTS_PER_MINUTE: '60',
        PLATFORM_CONSOLE_HOST: E2E_CONSOLE_HOST,
        // Chính sách dữ liệu của hồ sơ thử nghiệm (DT-SaaS phần S9, spec 140): dữ liệu thật chỉ khi đủ hồ sơ, không nhận production
        PLATFORM_DATA_POLICY: 'consent-required',
      },
    },
    {
      command: 'node ../apps/api/dist/main.js',
      url: `${apiBaseUrl}/api/v1/health`,
      env: {
        ...platformEnvironment,
        API_PORT: String(E2E_MULTI_API_PORT),
        TENANT_CACHE_SECONDS: '2',
        // Phần S1b: tên miền gốc cho trang chọn trường; việc nền do spec gọi điểm tick (tắt hẹn giờ trong tiến trình) để chạy xác định
        PLATFORM_ROOT_DOMAIN: E2E_ROOT_DOMAIN,
        INTERNAL_JOB_TOKEN: E2E_SCHEDULER_SECRET,
        SCHEDULER_MODE: 'external',
        // Số liệu cho tài khoản cấp trên (S6) chỉ phục vụ ở tên miền của cổng nền tảng
        PLATFORM_CONSOLE_HOST: E2E_CONSOLE_HOST,
        IDENTITY_BASE_URL: identityBaseUrl,
        PAYMENT_GATEWAY: 'development,vietqr-static',
        FACEBOOK_PUBLISHER: 'development',
        ZALO_SENDER: 'development',
        // Bộ giả lập nhà cung cấp AI (DT-23 phần 23d, spec 153): không gọi dịch vụ AI thật
        AI_MOCK: 'true',
        // Bộ giả lập lớp video (DT-27 phần 27a)
        VIDEO_PROVIDER: 'mock',
        // Thông báo đẩy qua bộ giả lập, ghi ra tệp cho spec 182 đọc (DT-26 phần 26b)
        PUSH_PROVIDER: 'development',
        PUSH_DEVELOPMENT_OUTBOX: fileURLToPath(E2E_PUSH_OUTBOX_FILE),
      },
    },
    {
      command: `pnpm --filter @school-management/portal exec vite --port ${E2E_MULTI_PORTAL_PORT} --strictPort`,
      url: `http://localhost:${E2E_MULTI_PORTAL_PORT}`,
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
    {
      command: `pnpm --filter @school-management/platform exec vite --port ${E2E_MULTI_CONSOLE_PORT} --strictPort`,
      url: `http://localhost:${E2E_MULTI_CONSOLE_PORT}`,
      // Trang của tài khoản cấp trên (S6) đọc số liệu tổng hợp ở máy chủ API
      env: { IDENTITY_BASE_URL: identityBaseUrl, API_BASE_URL: apiBaseUrl },
    },
  ],
});

import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { replaceDatabaseName } from '@school-management/database';
import {
  E2E_API_PORT,
  E2E_IDENTITY_PORT,
  E2E_OIDC_CLIENT_ID,
  E2E_OIDC_CLIENT_SECRET,
  E2E_OIDC_MOCK_PORT,
  E2E_OIDC_PROVIDER_CODE,
  E2E_PARENT_PORT,
  E2E_STUDENT_PORT,
  E2E_TEACHER_PORT,
  E2E_PORTAL_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_SYSTEM_DATABASE_NAME,
} from './e2e-environment.mjs';
import { MULTI_TENANT_SPEC } from './e2e-multi-environment.mjs';

// Kiểm thử giao diện chạy trên dịch vụ định danh, máy chủ API và cổng quản trị thật (YCTD-36);
// cơ sở dữ liệu hệ thống riêng do e2e-setup.mjs chuẩn bị trước mỗi lần chạy
if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const isContinuousIntegration = Boolean(process.env.CI);
const identityBaseUrl = `http://localhost:${E2E_IDENTITY_PORT}`;
const apiBaseUrl = `http://localhost:${E2E_API_PORT}`;
const systemDatabaseUrl = replaceDatabaseName(process.env.SYSTEM_DATABASE_URL ?? '', E2E_SYSTEM_DATABASE_NAME);

// Khung kiểm thử theo khổ thiết bị (DT-26 phần 26c, YCTD-233). Mặc định (biến E2E_DEVICES trống) chỉ chạy dự án `chromium` khổ máy tính cho mọi
// spec như trước. E2E_DEVICES=pr (việc kiem-thu-thiet-bi ở yêu cầu kéo): `dien-thoai` và `may-tinh-bang-doc`, chỉ Chromium, chỉ spec có nhãn
// @thiet-bi-pr. E2E_DEVICES=full (nhánh chính, hằng đêm): bốn dự án thiết bị (thêm `may-tinh-bang-ngang` và `dien-thoai-webkit`), mọi spec có
// nhãn @thiet-bi. Spec cũ không tự chạy ở khổ mới; mỗi phần gắn nhãn cho spec mình rà
const deviceMode =
  process.env.E2E_DEVICES === 'pr' || process.env.E2E_DEVICES === 'full' ? process.env.E2E_DEVICES : null;
const deviceGrep = deviceMode === 'pr' ? /@thiet-bi-pr/ : /@thiet-bi/;
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } };
const deviceProjects = [
  { name: 'dien-thoai', grep: deviceGrep, use: phone },
  {
    name: 'may-tinh-bang-doc',
    grep: deviceGrep,
    use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
  },
  ...(deviceMode === 'full'
    ? [
        {
          name: 'may-tinh-bang-ngang',
          grep: deviceGrep,
          use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true },
        },
        {
          name: 'dien-thoai-webkit',
          grep: deviceGrep,
          use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: './e2e',
  // Spec nhiều trường (130 đến 140) chạy riêng bằng playwright.multi.config.ts (pnpm e2e:multi)
  testIgnore: MULTI_TENANT_SPEC,
  fullyParallel: false,
  workers: 1,
  forbidOnly: isContinuousIntegration,
  // Máy chạy kiểm thử liên tục đôi lúc chậm bất thường ngay sau đăng nhập; chạy lại một lần, ca hỏng cả hai lần mới tính lỗi
  retries: isContinuousIntegration ? 1 : 0,
  // Máy chạy kiểm thử liên tục chậm hơn máy phát triển, các ca chuẩn bị nhiều dữ liệu có lúc quá 30 giây
  timeout: isContinuousIntegration ? 60_000 : 30_000,
  reporter: isContinuousIntegration ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORTAL_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: deviceMode ? deviceProjects : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../apps/identity/dist/main.js',
      url: `${identityBaseUrl}/api/v1/health`,
      env: {
        IDENTITY_PORT: String(E2E_IDENTITY_PORT),
        API_BASE_URL: apiBaseUrl,
        LOGIN_REQUESTS_PER_MINUTE: '60',
        // Nhà cung cấp OIDC giả lập của spec 165 (DT-25): nền tảng khai, mỗi trường vẫn tắt cho tới khi bật nên spec khác không đổi.
        // Liên kết tài khoản cần khóa mã hóa ở chế độ một trường: dùng khóa của .env nếu có, không thì sinh khóa ngẫu nhiên cho lượt chạy
        EXTERNAL_IDENTITY_PROVIDERS: JSON.stringify([
          {
            code: E2E_OIDC_PROVIDER_CODE,
            profile: 'oidc',
            display_name: 'Định danh giả lập',
            issuer: `http://127.0.0.1:${E2E_OIDC_MOCK_PORT}/oidc-gia-lap`,
            client_id: E2E_OIDC_CLIENT_ID,
            jwks_cooldown_seconds: 0,
          },
        ]),
        [`EXTERNAL_IDENTITY_${E2E_OIDC_PROVIDER_CODE.toUpperCase().replaceAll('-', '_')}_CLIENT_SECRET`]:
          E2E_OIDC_CLIENT_SECRET,
        TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY || randomBytes(32).toString('base64'),
      },
    },
    {
      command: 'node ../apps/api/dist/main.js',
      url: `${apiBaseUrl}/api/v1/health`,
      env: {
        API_PORT: String(E2E_API_PORT),
        IDENTITY_BASE_URL: identityBaseUrl,
        SYSTEM_DATABASE_URL: systemDatabaseUrl,
        SCHOOL_YEAR_DATABASE_PREFIX: E2E_SCHOOL_YEAR_DATABASE_PREFIX,
        // Bộ giả lập nhà cung cấp tài khoản ảo và mã QR (YCTD-57)
        PAYMENT_GATEWAY: 'development,vietqr-static',
        // Bộ giả lập đăng Fanpage và gửi Zalo (YCTD-90)
        FACEBOOK_PUBLISHER: 'development',
        ZALO_SENDER: 'development',
        // Bộ giả lập lớp video (DT-27 phần 27a)
        VIDEO_PROVIDER: 'mock',
      },
    },
    // Tiến trình chạy nền: máy xếp thời khoá biểu (DT-20 phần 22c2); không mở cổng nên chờ dòng báo đã nối Redis
    {
      command: 'node ../apps/worker/dist/main.js',
      wait: { stdout: /Tiến trình chạy nền đã kết nối Redis/ },
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
      env: {
        IDENTITY_BASE_URL: identityBaseUrl,
        API_BASE_URL: apiBaseUrl,
        STUDENT_APP_URL: `http://localhost:${E2E_STUDENT_PORT}/`,
      },
    },
    // Ứng dụng học sinh (YCTD-300)
    {
      command: `pnpm --filter @school-management/student exec vite --port ${E2E_STUDENT_PORT} --strictPort`,
      url: `http://localhost:${E2E_STUDENT_PORT}`,
      env: {
        IDENTITY_BASE_URL: identityBaseUrl,
        API_BASE_URL: apiBaseUrl,
        PARENT_APP_URL: `http://localhost:${E2E_PARENT_PORT}/`,
      },
    },
  ],
});

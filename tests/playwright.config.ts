import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Kiểm thử giao diện chạy trên dịch vụ định danh, máy chủ API và cổng quản trị thật (YCTD-36)
if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

const isContinuousIntegration = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isContinuousIntegration,
  retries: 0,
  reporter: isContinuousIntegration ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../apps/identity/dist/main.js',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: !isContinuousIntegration,
    },
    {
      command: 'node ../apps/api/dist/main.js',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !isContinuousIntegration,
    },
    {
      command: 'pnpm --filter @school-management/portal exec vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !isContinuousIntegration,
    },
  ],
});

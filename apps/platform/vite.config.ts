import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Cổng vận hành nền tảng nhiều trường (DT-SaaS phần S1a): giao diện riêng, không thuộc trường nào. Khi phát triển, đăng nhập vận hành
// nằm ở nhóm /api/v1/auth của dịch vụ định danh (nhận tên miền của cổng nền tảng, cấu hình PLATFORM_CONSOLE_HOST)
const identityTarget = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';
// Số liệu tổng hợp cho tài khoản cấp trên (DT-SaaS phần S6) ở máy chủ API
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    // Cổng nền tảng và các trường dùng tên miền con `*.localhost` khi phát triển và kiểm thử
    allowedHosts: ['.localhost'],
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1/parent-org': { target: apiTarget },
    },
  },
});

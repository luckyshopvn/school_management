import { pwaServiceWorker } from '@school-management/pwa/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ứng dụng Gia sư của chợ gia sư (DT-27, YCTD-262; quyết định của Eric ngày 2026-10-28): ứng dụng riêng trên tên miền con dành riêng
// của nền tảng, không thuộc trường nào; mọi điểm cuối ở /api/v1/market của máy chủ API (phiên riêng của chợ). Giáo viên dạy kèm ngoài
// trường (kênh ngoài) cũng dùng ứng dụng này bằng tài khoản chợ riêng; dạy kèm học sinh trong trường mình (27a đến 27e) vẫn ở ứng
// dụng giáo viên (Eric làm rõ ngày 2026-10-28)
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';
const base = process.env.APP_BASE_PATH?.trim() || '/';

export default defineConfig({
  base,
  // Service worker dùng chung (DT-26 phần 26a), tiền tố bộ nhớ đệm riêng của ứng dụng Gia sư
  plugins: [react(), tailwindcss(), pwaServiceWorker({ cachePrefix: 'gia-su-v-' })],
  server: {
    port: 5179,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api/v1/market': { target: apiTarget },
    },
  },
});

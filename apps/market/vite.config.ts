import { pwaServiceWorker } from '@school-management/pwa/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Chợ gia sư (DT-27 phần 27f, YCTD-256): ứng dụng riêng trên tên miền con dành riêng của nền tảng, không thuộc trường nào. Mọi điểm
// cuối của chợ nằm ở /api/v1/market của máy chủ API (đường dẫn không cần trường, phiên riêng của chợ). Từ YCTD-368 là ứng dụng chung
// của phụ huynh và gia sư (gộp apps/tutor), cài được như ứng dụng Gia sư cũ
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';
const base = process.env.APP_BASE_PATH?.trim() || '/';

export default defineConfig({
  base,
  // Service worker dùng chung (DT-26 phần 26a), tiền tố bộ nhớ đệm riêng của Chợ gia sư
  plugins: [react(), tailwindcss(), pwaServiceWorker({ cachePrefix: 'cho-gia-su-v-' })],
  server: {
    port: 5178,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api/v1/market': { target: apiTarget },
    },
  },
});

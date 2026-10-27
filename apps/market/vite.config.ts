import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Chợ gia sư (DT-27 phần 27f, YCTD-256): ứng dụng riêng trên tên miền con dành riêng của nền tảng, không thuộc trường nào. Mọi điểm
// cuối của chợ nằm ở /api/v1/market của máy chủ API (đường dẫn không cần trường, phiên riêng của chợ)
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5178,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api/v1/market': { target: apiTarget },
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Khi phát triển, chuyển nhóm điểm cuối của dịch vụ định danh sang dịch vụ định danh,
// phần còn lại của /api/v1 sang máy chủ API (17_DAC_TA_API.md quy ước 8)
const identityTarget = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

// Đường dẫn gốc khi dựng (DT-SaaS phần S9): hồ sơ thử nghiệm phục vụ ba ứng dụng dưới /quan-ly, /giao-vien, /phu-huynh trên
// cùng tên miền của trường; mặc định / như trước
const base = process.env.APP_BASE_PATH?.trim() || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1': { target: apiTarget },
    },
  },
});

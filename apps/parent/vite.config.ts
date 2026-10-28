import { pwaServiceWorker } from '@school-management/pwa/vite';
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

// Ứng dụng học sinh tách riêng (YCTD-300): địa chỉ cũ `#hoc-sinh` và liên kết ở màn hình đăng nhập chuyển sang ứng dụng này. Ảnh `web`
// và hồ sơ thử nghiệm phục vụ nó ở /hoc-sinh/ cùng tên miền; khi phát triển là máy chủ của apps/student (cổng 5179)
const studentAppUrl = (command: string) =>
  process.env.STUDENT_APP_URL?.trim() || (command === 'serve' ? 'http://localhost:5179/' : '/hoc-sinh/');

export default defineConfig(({ command }) => ({
  base,
  define: { 'import.meta.env.VITE_STUDENT_APP_URL': JSON.stringify(studentAppUrl(command)) },
  // Service worker dùng chung (DT-26 phần 26a, YCTD-231)
  plugins: [react(), tailwindcss(), pwaServiceWorker({ cachePrefix: 'phu-huynh-v-' })],
  server: {
    port: 5175,
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1': { target: apiTarget },
    },
  },
}));

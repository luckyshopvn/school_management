import { pwaServiceWorker } from '@school-management/pwa/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ứng dụng học sinh tách khỏi ứng dụng phụ huynh (quyết định ngày 2026-10-28, YCTD-300). Khi phát triển, chuyển nhóm điểm cuối
// của dịch vụ định danh sang dịch vụ định danh, phần còn lại của /api/v1 sang máy chủ API (17_DAC_TA_API.md quy ước 8)
const identityTarget = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

// Đường dẫn gốc khi dựng: ảnh `web` và hồ sơ thử nghiệm phục vụ ứng dụng ở /hoc-sinh/ (cùng tên miền với ứng dụng phụ huynh nên
// địa chỉ cũ `#hoc-sinh` chuyển sang được, cookie của kênh student vẫn cùng tên miền); mặc định / khi phát triển
const base = process.env.APP_BASE_PATH?.trim() || '/';

// Liên kết "Ứng dụng phụ huynh" ở màn hình đăng nhập: ảnh `web` đặt ứng dụng phụ huynh ở gốc tên miền phụ huynh (học sinh ở
// /hoc-sinh/ của cùng tên miền), hồ sơ thử nghiệm dựng với PARENT_APP_URL=/phu-huynh/; khi phát triển là cổng 5175
const parentAppUrl = (command: string) =>
  process.env.PARENT_APP_URL?.trim() || (command === 'serve' ? 'http://localhost:5175/' : '/');

export default defineConfig(({ command }) => ({
  base,
  define: { 'import.meta.env.VITE_PARENT_APP_URL': JSON.stringify(parentAppUrl(command)) },
  // Service worker dùng chung (DT-26 phần 26a), tiền tố bộ nhớ đệm riêng để không xoá nhầm của ứng dụng phụ huynh cùng tên miền
  plugins: [react(), tailwindcss(), pwaServiceWorker({ cachePrefix: 'hoc-sinh-v-' })],
  server: {
    port: 5179,
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1': { target: apiTarget },
    },
  },
}));

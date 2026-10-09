import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Khi phát triển, chuyển nhóm điểm cuối của dịch vụ định danh (auth, users, roles, permissions) sang dịch vụ định danh,
// phần còn lại của /api/v1 sang máy chủ API (17_DAC_TA_API.md quy ước 8)
const identityTarget = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1/users': { target: identityTarget },
      '/api/v1/roles': { target: identityTarget },
      '/api/v1/permissions': { target: identityTarget },
      '/api/v1': { target: apiTarget },
    },
  },
});

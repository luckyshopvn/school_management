import { applyBrandedManifest } from '@school-management/pwa';
import { StrictMode } from 'react';
import { isSupportSignInLocation, SupportSignIn } from '@school-management/ui';
import { createRoot } from 'react-dom/client';
import { Application } from './Application.js';
import './index.css';

// Tên, biểu tượng, màu của trường khi cài lên màn hình chính (DT-26 phần 26a, YCTD-231). Service worker của ứng dụng giáo viên
// bật, tắt theo cấu hình ngoại tuyến của trường (23b, ClassroomOfflineManager)
void applyBrandedManifest('teacher', import.meta.env.BASE_URL);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử gốc');
}

createRoot(rootElement).render(
  <StrictMode>
    {/* Đường liên kết hỗ trợ của quản trị nền tảng (YCTD-315) */}
    {isSupportSignInLocation(import.meta.env.BASE_URL) ? (
      <SupportSignIn channel="teacher" basePath={import.meta.env.BASE_URL} />
    ) : (
      <Application />
    )}
  </StrictMode>,
);

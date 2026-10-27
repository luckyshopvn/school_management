import { registerServiceWorker } from '@school-management/pwa';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TutorApplication } from './TutorApplication.js';
import './index.css';

// Ứng dụng web cài được (DT-26 phần 26a): manifest tĩnh của ứng dụng Gia sư (không theo trường), service worker giữ vỏ ứng dụng,
// không bao giờ giữ lời gọi /api
void registerServiceWorker({ base: import.meta.env.BASE_URL, cachePrefix: 'gia-su-v-' });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử gốc');
}

createRoot(rootElement).render(
  <StrictMode>
    <TutorApplication />
  </StrictMode>,
);

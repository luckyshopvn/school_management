import { applyBrandedManifest, registerServiceWorker } from '@school-management/pwa';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudentApplication } from './StudentApplication.js';
import './index.css';

// Ứng dụng web cài được của học sinh (tách khỏi ứng dụng phụ huynh ngày 2026-10-28): tên "… – Học sinh", biểu tượng, màu của
// trường; service worker riêng giữ vỏ ứng dụng, không bao giờ giữ lời gọi /api (bài làm ngoại tuyến của 28j nằm ở IndexedDB)
const CACHE_PREFIX = 'hoc-sinh-v-';
void applyBrandedManifest('student', import.meta.env.BASE_URL);
void registerServiceWorker({ base: import.meta.env.BASE_URL, cachePrefix: CACHE_PREFIX });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử gốc');
}

createRoot(rootElement).render(
  <StrictMode>
    <StudentApplication />
  </StrictMode>,
);

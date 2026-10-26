import { applyBrandedManifest, registerServiceWorker } from '@school-management/pwa';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Application } from './Application.js';
import './index.css';

// Ứng dụng web cài được (DT-26 phần 26a, YCTD-231): tên, biểu tượng, màu của trường khi cài lên màn hình chính; service worker
// giữ vỏ ứng dụng để mở nhanh và mở được khi mất mạng, không bao giờ giữ lời gọi /api (thông tin của con, học phí vẫn cần mạng)
const CACHE_PREFIX = 'phu-huynh-v-';
void applyBrandedManifest('parent', import.meta.env.BASE_URL);
void registerServiceWorker({ base: import.meta.env.BASE_URL, cachePrefix: CACHE_PREFIX });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử gốc');
}

createRoot(rootElement).render(
  <StrictMode>
    <Application />
  </StrictMode>,
);

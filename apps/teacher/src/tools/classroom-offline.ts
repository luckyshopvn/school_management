import { registerServiceWorker, serviceWorkerSupported, unregisterServiceWorker } from '@school-management/pwa';

// Ngoại tuyến của công cụ lớp học (DT-23 phần 23b, YCTD-212, GD-108): bật, tắt service worker theo cấu hình của trường. Đăng
// ký, cập nhật, gỡ nằm ở gói chung `@school-management/pwa` (DT-26 phần 26a, YCTD-231); service worker chỉ giữ vỏ ứng dụng,
// mọi lời gọi /api đi thẳng ra mạng, danh sách lớp lưu ở classroom-store.ts. Tiền tố bộ nhớ đệm giữ tên của 23b
export const CACHE_PREFIX = 'cong-cu-lop-hoc-v-';
const options = { base: import.meta.env.BASE_URL, cachePrefix: CACHE_PREFIX };

export function offlineSupported(): boolean {
  return serviceWorkerSupported();
}

export function enableOffline(): Promise<void> {
  return registerServiceWorker(options);
}

// Trường tắt ngoại tuyến: gỡ service worker và xóa bộ nhớ đệm của vỏ ứng dụng
export function disableOffline(): Promise<void> {
  return unregisterServiceWorker(options);
}

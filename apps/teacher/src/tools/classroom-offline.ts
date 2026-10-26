// Ngoại tuyến của công cụ lớp học (DT-23 phần 23b, YCTD-212, GD-108): đăng ký, cập nhật, gỡ service worker. Service worker
// chỉ giữ vỏ ứng dụng (trang, tệp dựng); mọi lời gọi /api đi thẳng ra mạng, danh sách lớp lưu ở classroom-store.ts. Phiên bản
// bộ nhớ đệm đặt theo bản phát hành ở public/sw.js, bản mới được tải nền rồi hỏi giáo viên tải lại (không tự thay giữa buổi)
const CACHE_PREFIX = 'cong-cu-lop-hoc-v-';
const scriptUrl = `${import.meta.env.BASE_URL}sw.js`;
const scope = import.meta.env.BASE_URL;

type UpdateListener = (available: boolean) => void;
const listeners = new Set<UpdateListener>();
let updateAvailable = false;
let waitingWorker: ServiceWorker | null = null;

function setUpdateAvailable(worker: ServiceWorker | null) {
  waitingWorker = worker;
  updateAvailable = worker !== null;
  listeners.forEach((listener) => listener(updateAvailable));
}

export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(updateAvailable);
  return () => {
    listeners.delete(listener);
  };
}

export function offlineSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

// Tệp trang đã tải trước khi service worker kiểm soát trang (lần mở đầu): gửi cho service worker lưu để lần sau mở được khi
// mất mạng, không phải chờ tải lại một lần
function warmCache(worker: ServiceWorker | null | undefined) {
  if (!worker) {
    return;
  }
  const urls = [
    location.href,
    ...performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(location.origin) && !name.includes('/api/')),
  ];
  worker.postMessage({ type: 'CACHE_URLS', urls });
}

export async function enableOffline(): Promise<void> {
  if (!offlineSupported()) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(scriptUrl, { scope });
    // Có bản mới đã cài xong, đang chờ: hỏi giáo viên tải lại
    if (registration.waiting && navigator.serviceWorker.controller) {
      setUpdateAvailable(registration.waiting);
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateAvailable(installing);
        }
      });
    });
    const ready = await navigator.serviceWorker.ready;
    warmCache(ready.active);
  } catch {
    // Trình duyệt không cho đăng ký (chế độ riêng tư, địa chỉ không an toàn): ứng dụng vẫn chạy khi có mạng
  }
}

// Trường tắt ngoại tuyến: gỡ service worker và xóa bộ nhớ đệm của vỏ ứng dụng
export async function disableOffline(): Promise<void> {
  if (!offlineSupported()) {
    return;
  }
  try {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      if (registration.scope === new URL(scope, location.origin).href) {
        await registration.unregister();
      }
    }
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX)) {
        await caches.delete(name);
      }
    }
  } catch {
    // bỏ qua
  }
  setUpdateAvailable(null);
}

// Giáo viên bấm tải lại: bản chờ nhận quyền rồi trang tải lại một lần
export function applyUpdate(): void {
  if (!waitingWorker) {
    location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

/* global self, caches, fetch, URL */
// Service worker của ứng dụng giáo viên (DT-23 phần 23b, YCTD-212, GD-108): chỉ để trang công cụ lớp học mở được khi mất mạng
// sau lần tải đầu. Giữ vỏ ứng dụng (trang, tệp dựng); KHÔNG bao giờ giữ lời gọi /api (dữ liệu, điểm, học bạ vẫn cần mạng),
// các phân hệ khác của ứng dụng giáo viên không dùng ngoại tuyến được. Gặp mạng thì lấy bản mới nhất và cập nhật bộ nhớ đệm,
// mất mạng mới dùng bản đã giữ. Phiên bản bộ nhớ đệm đặt theo bản phát hành: khi dựng, vite.config.ts thay hai dòng đánh
// dấu bên dưới (mã bản dựng và danh sách tệp dựng); lúc phát triển giữ giá trị mặc định
const VERSION = 'phat-trien';
/* precache */ const PRECACHE = ['./']; /* end-precache */
const CACHE_PREFIX = 'cong-cu-lop-hoc-v-';
const CACHE = `${CACHE_PREFIX}${VERSION}`;

self.addEventListener('install', (event) => {
  // Không tự giành quyền ngay: bản mới chờ giáo viên đồng ý tải lại (SKIP_WAITING), trừ lần cài đầu tiên
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            const response = await fetch(new URL(path, self.registration.scope), { cache: 'reload' });
            if (response.ok) {
              await cache.put(new URL(path, self.registration.scope), response);
            }
          } catch {
            // Tệp không tải được lúc cài thì lần mở có mạng sau sẽ lưu
          }
        }),
      );
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
  // Trang gửi danh sách tệp đã tải trước khi service worker kiểm soát trang để lưu thêm
  if (message?.type === 'CACHE_URLS' && Array.isArray(message.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        for (const url of message.urls) {
          try {
            const target = new URL(url, self.location.origin);
            if (target.origin !== self.location.origin || target.pathname.includes('/api/')) {
              continue;
            }
            if (!(await cache.match(target))) {
              const response = await fetch(target);
              if (response.ok) {
                await cache.put(target, response);
              }
            }
          } catch {
            // bỏ qua tệp không lưu được
          }
        }
      })(),
    );
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) {
      return hit;
    }
    if (request.mode === 'navigate') {
      const shell = await cache.match(new URL('./', self.registration.scope));
      if (shell) {
        return shell;
      }
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) {
    return;
  }
  event.respondWith(networkFirst(request));
});

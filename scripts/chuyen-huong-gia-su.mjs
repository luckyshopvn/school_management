// Chuyển hướng tên miền cũ của ứng dụng Gia sư về Chợ gia sư (YCTD-368, GD-181): từ khi gộp hai ứng dụng, gia-su.<tên miền> không còn
// ứng dụng riêng. Mọi đường dẫn chuyển 308 sang cùng đường dẫn, cùng truy vấn ở địa chỉ của chợ, để liên kết cũ không gãy: lượt quay về
// từ nhà cung cấp định danh (/xac-minh?code=…), liên kết mời vào phòng học, dấu trang của gia sư. Riêng /sw.js trả một service worker
// tự gỡ: trình duyệt đã cài ứng dụng Gia sư cũ kiểm bản mới thì nhận bản này, xóa bộ nhớ đệm 'gia-su-v-' rồi tự hủy đăng ký (service
// worker không được phép chuyển hướng). Dùng ở máy phát triển (scripts/chay-nhieu-truong.mjs) và kiểm thử e2e; môi trường chạy thật
// chuyển hướng ở Caddy hoặc tầng biên (deploy/profiles).
//
// Chạy riêng: node scripts/chuyen-huong-gia-su.mjs --port 5196 --target http://cho-gia-su.truong.localhost:5195
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export const SELF_UNREGISTER_WORKER = `// Ứng dụng Gia sư đã gộp vào Chợ gia sư (YCTD-368): gỡ service worker cũ
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('gia-su-v-')) await caches.delete(key);
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
`;

// Địa chỉ đích của một yêu cầu: gốc của chợ (không có dấu / cuối) nối đường dẫn và truy vấn gốc
export function redirectTarget(target, url) {
  return `${target.replace(/\/+$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

export function startLegacyTutorRedirect({ port, target, host = 'localhost' }) {
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (url.split('?')[0] === '/sw.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      response.end(SELF_UNREGISTER_WORKER);
      return;
    }
    response.writeHead(308, { location: redirectTarget(target, url), 'cache-control': 'no-store' });
    response.end();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const port = Number(option('port'));
  const target = option('target');
  if (!Number.isInteger(port) || !target) {
    console.error('Cách dùng: node scripts/chuyen-huong-gia-su.mjs --port <cổng> --target <địa chỉ của chợ>');
    process.exit(1);
  }
  await startLegacyTutorRedirect({ port, target, host: option('host') ?? 'localhost' });
  console.log(`Chuyển hướng tên miền cũ của ứng dụng Gia sư ở cổng ${port} về ${target}`);
}

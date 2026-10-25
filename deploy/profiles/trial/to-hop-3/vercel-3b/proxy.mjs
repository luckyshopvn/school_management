import { next, rewrite } from '@vercel/functions';

// Cổng biên tổ hợp 3b (DT-SaaS phần S9, YCTD-203): Vercel Routing Middleware viết lại /api/v1 và website công khai về máy chủ, thêm
// tên miền gốc (x-school-host) và bí mật cổng biên (x-edge-auth) như Cloudflare Worker ở tổ hợp 1. Tệp tĩnh của ba ứng dụng nằm ở
// thư mục public (quan-ly, giao-vien, phu-huynh, nen-tang) và đi tiếp `next()`. Kiểm theo README tổ hợp 3 bước 1 trước khi dùng:
// không thêm được tiêu đề thì không dùng tổ hợp này. Biến dự án: ORIGIN_URL, EDGE_SHARED_SECRET, CONSOLE_HOST, ROOT_DOMAIN
const APP_PREFIXES = ['/quan-ly/', '/giao-vien/', '/phu-huynh/'];

function originRequest(request, path) {
  const url = new URL(request.url);
  const target = new URL(`${path}${url.search}`, process.env.ORIGIN_URL);
  const headers = new Headers(request.headers);
  headers.delete('x-edge-auth');
  headers.set('x-school-host', url.hostname);
  headers.set('x-edge-auth', process.env.EDGE_SHARED_SECRET ?? '');
  return rewrite(target, { request: { headers } });
}

export default function proxy(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (url.pathname.startsWith('/api/v1/')) {
    return originRequest(request, url.pathname);
  }
  if (host === process.env.CONSOLE_HOST) {
    return rewrite(new URL(`/nen-tang${url.pathname.includes('.') ? url.pathname : '/index.html'}`, request.url));
  }
  if (host === process.env.ROOT_DOMAIN) {
    return url.pathname === '/' ? originRequest(request, '/api/v1/public/schools/picker') : next();
  }
  if (APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    // Đường dẫn của ứng dụng một trang không có tệp thì trả index.html của ứng dụng đó
    if (!url.pathname.includes('.')) {
      const prefix = APP_PREFIXES.find((item) => url.pathname.startsWith(item));
      return rewrite(new URL(`${prefix}index.html`, request.url));
    }
    return next();
  }
  return originRequest(request, `/api/v1/public/site${url.pathname}`);
}

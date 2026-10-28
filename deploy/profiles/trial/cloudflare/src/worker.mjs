// Cổng biên của hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203; tài liệu 32 mục 14.5 "Thiết kế dùng chung"): một Cloudflare Worker
// đứng trước máy chủ gộp (Render hoặc Koyeb) cho mọi tên miền của nền tảng:
// - tên miền của trường (tên miền con `<mã>.<tên miền hệ thống>` hoặc tên miền riêng qua Cloudflare for SaaS):
//   /quan-ly, /giao-vien, /phu-huynh, /hoc-sinh là bốn ứng dụng tĩnh (dựng với APP_BASE_PATH tương ứng), /api/v1 chuyển về máy chủ, phần
//   còn lại là website công khai của trường (chuyển về /api/v1/public/site như Caddy của hồ sơ vận hành);
// - tên miền cổng nền tảng (CONSOLE_HOST): ứng dụng `apps/platform` ở gốc, /api/v1 chuyển về máy chủ;
// - tên miền của chợ gia sư (MARKET_HOST, `apps/market`) và của ứng dụng Gia sư (TUTOR_HOST, `apps/tutor`; DT-27, YCTD-262): ứng
//   dụng ở gốc như cổng nền tảng, /api/v1 chuyển về máy chủ;
// - tên miền hệ thống (ROOT_DOMAIN): trang đăng nhập theo đơn vị (DT-24: ứng dụng cổng quản trị ở /quan-ly, gốc chuyển về đó);
//   trang chọn trường cũ của S1b vẫn ở /api/v1/public/schools/picker.
// Khi chuyển về máy chủ, Worker xóa tiêu đề do người dùng tự đặt rồi đặt tên miền gốc vào EDGE_HOST_HEADER kèm bí mật
// `x-edge-auth` (máy chủ chạy TENANT_HOST_SOURCE=header:<tên>, EDGE_SHARED_SECRET): máy chủ có địa chỉ công khai nên gọi thẳng
// không có bí mật thì không nhận ra trường nào. Máy chủ ngủ khi rảnh (Render sau 15 phút, Koyeb sau 1 giờ): quá thời gian chờ
// hoặc lỗi cổng thì trả trang "đang khởi động" tự thử lại, đồng thời gọi kiểm tra sức khỏe để đánh thức. Cron Triggers gọi
// `tick` của bộ lập lịch (S1b) theo lịch ở wrangler.toml, việc này cũng đánh thức máy chủ và giữ dự án Supabase không tạm dừng.
// Biến (wrangler.toml [vars] và secret): ORIGIN_URL, ROOT_DOMAIN, CONSOLE_HOST, MARKET_HOST, TUTOR_HOST, EDGE_HOST_HEADER, EDGE_SHARED_SECRET (secret),
// INTERNAL_JOB_TOKEN (secret), STATIC_ORIGIN (tổ hợp 3a: tệp tĩnh lấy từ dự án Vercel), ORIGIN_TIMEOUT_MS, DATA_POLICY.

export const EDGE_AUTH_HEADER = 'x-edge-auth';
export const APPS = [
  { prefix: '/quan-ly', directory: 'quan-ly' },
  { prefix: '/giao-vien', directory: 'giao-vien' },
  { prefix: '/phu-huynh', directory: 'phu-huynh' },
  // Ứng dụng học sinh (YCTD-300)
  { prefix: '/hoc-sinh', directory: 'hoc-sinh' },
];
const CONSOLE_DIRECTORY = 'nen-tang';
// Chợ gia sư (DT-27): thư mục tệp tĩnh theo biến tên miền
const HOST_APPS = [
  { setting: 'MARKET_HOST', directory: 'cho-gia-su' },
  { setting: 'TUTOR_HOST', directory: 'gia-su' },
];
const WAKING_STATUSES = new Set([502, 504, 520, 521, 522, 523, 524]);
const WAKING_RETRY_SECONDS = 10;

function setting(env, name, fallback = '') {
  const value = env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hostOf(request) {
  return new URL(request.url).hostname.toLowerCase();
}

// Biểu ngữ "môi trường thử nghiệm" theo chính sách dữ liệu của nền tảng (tài liệu 32 mục 14.5 S9, biện pháp 8)
export function bannerHtml(policy) {
  if (policy === 'synthetic-only') {
    return '<div data-trial-banner role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:4px 12px;font:12px/1.4 system-ui,sans-serif;background:#7a3e00;color:#fff;text-align:center">Môi trường thử nghiệm, máy chủ đặt ngoài Việt Nam: chỉ dùng dữ liệu giả.</div>';
  }
  if (policy === 'consent-required') {
    return '<div data-trial-banner role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:4px 12px;font:12px/1.4 system-ui,sans-serif;background:#7a3e00;color:#fff;text-align:center">Môi trường thử nghiệm, máy chủ đặt ngoài Việt Nam: dữ liệu thật chỉ dùng khi trường đã có văn bản đồng ý.</div>';
  }
  return '';
}

export function injectBanner(html, policy) {
  const banner = bannerHtml(policy);
  if (!banner || html.includes('data-trial-banner')) {
    return html;
  }
  return html.includes('</body>') ? html.replace('</body>', `${banner}</body>`) : `${html}${banner}`;
}

async function withBanner(response, env) {
  const policy = setting(env, 'DATA_POLICY', 'consent-required');
  const type = response.headers.get('content-type') ?? '';
  if (!bannerHtml(policy) || !type.includes('text/html')) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(injectBanner(await response.text(), policy), { status: response.status, headers });
}

/** @returns {Response} */
export function wakingResponse(request, env) {
  const accept = request.headers.get('accept') ?? '';
  const headers = { 'retry-after': String(WAKING_RETRY_SECONDS), 'cache-control': 'no-store' };
  if (request.method === 'GET' && accept.includes('text/html')) {
    const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="${WAKING_RETRY_SECONDS}"><title>Hệ thống đang khởi động</title><style>body{font:16px/1.5 system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f6f8;color:#1c2430}main{max-width:28rem;padding:24px;text-align:center}</style></head><body><main data-waking><h1>Hệ thống đang khởi động</h1><p>Máy chủ thử nghiệm ngủ khi không có người dùng và cần khoảng một phút để chạy lại. Trang sẽ tự tải lại sau ${WAKING_RETRY_SECONDS} giây.</p></main></body></html>`;
    return new Response(injectBanner(page, setting(env, 'DATA_POLICY', 'consent-required')), {
      status: 503,
      headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return new Response(
    JSON.stringify({
      error: {
        code: 'ERR_SERVICE_WAKING',
        message: 'Máy chủ đang khởi động, vui lòng thử lại sau ít giây',
        details: [],
      },
    }),
    { status: 503, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } },
  );
}

function wakeOrigin(env, context) {
  const origin = setting(env, 'ORIGIN_URL');
  if (origin) {
    context?.waitUntil?.(fetch(new URL('/api/v1/health', origin)).catch(() => undefined));
  }
}

// Chuyển yêu cầu về máy chủ: đường dẫn có thể viết lại (website, trang chọn trường), thêm tiêu đề của cổng biên
/** @returns {Promise<Response>} */
export async function forwardToOrigin(request, env, context, options = {}) {
  const origin = setting(env, 'ORIGIN_URL');
  if (!origin) {
    return new Response('Chưa cấu hình ORIGIN_URL', { status: 500 });
  }
  const incoming = new URL(request.url);
  const target = new URL(`${options.path ?? incoming.pathname}${incoming.search}`, origin);
  const hostHeader = setting(env, 'EDGE_HOST_HEADER', 'x-school-host').toLowerCase();
  const headers = new Headers(request.headers);
  for (const name of [EDGE_AUTH_HEADER, hostHeader, 'x-forwarded-host', 'x-website-root', 'host']) {
    headers.delete(name);
  }
  headers.set(hostHeader, incoming.hostname);
  const secret = setting(env, 'EDGE_SHARED_SECRET');
  if (secret) {
    headers.set(EDGE_AUTH_HEADER, secret);
  }
  const client = request.headers.get('cf-connecting-ip');
  if (client) {
    headers.set('x-forwarded-for', client);
  }
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''));
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(setting(env, 'ORIGIN_TIMEOUT_MS', '10000')));
  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const response = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: request.body, duplex: 'half' } : {}),
      redirect: 'manual',
      signal: controller.signal,
    });
    if (WAKING_STATUSES.has(response.status)) {
      wakeOrigin(env, context);
      return wakingResponse(request, env);
    }
    return withBanner(response, env);
  } catch {
    wakeOrigin(env, context);
    return wakingResponse(request, env);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAsset(env, request, assetPath) {
  const staticOrigin = setting(env, 'STATIC_ORIGIN');
  if (staticOrigin) {
    return fetch(new URL(assetPath, staticOrigin), { headers: { accept: request.headers.get('accept') ?? '*/*' } });
  }
  if (!env.ASSETS) {
    return new Response('Chưa cấu hình tệp tĩnh (ASSETS hoặc STATIC_ORIGIN)', { status: 500 });
  }
  return env.ASSETS.fetch(new Request(new URL(assetPath, request.url), { headers: request.headers }));
}

// Ứng dụng một trang: tệp có thật thì trả, đường dẫn khác (trừ /assets/) trả index.html để bộ định tuyến phía trình duyệt xử lý
/** @returns {Promise<Response>} */
export async function serveApp(request, env, directory, subpath) {
  const path = subpath === '' || subpath === '/' ? '/index.html' : subpath;
  let response = await fetchAsset(env, request, `/${directory}${path}`);
  if (response.status === 404 && !path.startsWith('/assets/')) {
    response = await fetchAsset(env, request, `/${directory}/index.html`);
  }
  const headers = new Headers(response.headers);
  headers.set('cache-control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  return withBanner(new Response(response.body, { status: response.status, headers }), env);
}

/** @returns {Promise<Response>} */
export async function handleRequest(request, env, context) {
  const url = new URL(request.url);
  const host = hostOf(request);
  const path = url.pathname;
  if (path === '/api/v1' || path.startsWith('/api/v1/')) {
    return forwardToOrigin(request, env, context);
  }
  const rootDomain = setting(env, 'ROOT_DOMAIN').toLowerCase();
  const consoleHost = setting(env, 'CONSOLE_HOST').toLowerCase();
  if (consoleHost && host === consoleHost) {
    return serveApp(request, env, CONSOLE_DIRECTORY, path);
  }
  for (const app of HOST_APPS) {
    const appHost = setting(env, app.setting).toLowerCase();
    if (appHost && host === appHost) {
      return serveApp(request, env, app.directory, path);
    }
  }
  if (rootDomain && host === rootDomain) {
    const portal = APPS[0];
    if (path === '/' || path === portal.prefix) {
      return Response.redirect(`${url.origin}${portal.prefix}/${url.search}`, 308);
    }
    return path.startsWith(`${portal.prefix}/`)
      ? serveApp(request, env, portal.directory, path.slice(portal.prefix.length))
      : new Response('Không tìm thấy', { status: 404 });
  }
  for (const app of APPS) {
    if (path === app.prefix) {
      return Response.redirect(`${url.origin}${app.prefix}/${url.search}`, 308);
    }
    if (path.startsWith(`${app.prefix}/`)) {
      return serveApp(request, env, app.directory, path.slice(app.prefix.length));
    }
  }
  // Website công khai của trường (18f): như khối `website` của Caddy ở hồ sơ vận hành
  return forwardToOrigin(request, env, context, {
    path: `/api/v1/public/site${path}`,
    headers: { 'x-website-root': '1' },
  });
}

// Cron Triggers: gọi điểm tick của bộ lập lịch (S1b) bằng bí mật dùng chung
export async function runScheduled(env) {
  const origin = setting(env, 'ORIGIN_URL');
  const token = setting(env, 'INTERNAL_JOB_TOKEN');
  if (!origin || !token) {
    throw new Error('Cron cần ORIGIN_URL và INTERNAL_JOB_TOKEN');
  }
  const response = await fetch(new URL('/api/v1/internal/jobs/tick', origin), {
    method: 'POST',
    headers: { 'x-internal-job-token': token, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    throw new Error(`Điểm tick trả ${response.status}`);
  }
  return response.json();
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
  scheduled(_controller, env, context) {
    context.waitUntil(runScheduled(env));
  },
};

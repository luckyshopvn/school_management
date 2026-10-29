import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import worker, { injectBanner, runScheduled } from '../../deploy/profiles/trial/cloudflare/src/worker.mjs';

// Cổng biên của hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203): chạy Worker bằng Node (Request, Response, fetch chuẩn) trước một
// máy chủ giả ghi lại yêu cầu và một bộ tệp tĩnh giả; không gọi dịch vụ thật. Giá trị cấu hình, bí mật đều giả
const requests = [];
let originStatus = 200;
let origin;
let originUrl;
let staticServer;
let staticUrl;

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)),
  );
}

before(async () => {
  origin = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, headers: request.headers, body });
      if (request.url.startsWith('/api/v1/public/site')) {
        response.writeHead(originStatus, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<html><body><h1>Website giả</h1></body></html>');
        return;
      }
      response.writeHead(originStatus, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: originStatus === 200, path: request.url }));
    });
  });
  originUrl = await listen(origin);
  staticServer = createServer((request, response) => {
    if (request.url === '/quan-ly/index.html') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>Cổng quản trị từ Vercel</body></html>');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  staticUrl = await listen(staticServer);
});

after(() => {
  origin.close();
  staticServer.close();
});

const files = {
  '/quan-ly/index.html': ['text/html', '<html><body><div id="root"></div></body></html>'],
  '/quan-ly/assets/app-1.js': ['text/javascript', 'console.log(1)'],
  '/giao-vien/index.html': ['text/html', '<html><body>Giáo viên</body></html>'],
  '/nen-tang/index.html': ['text/html', '<html><body>Cổng nền tảng</body></html>'],
  '/cho-gia-su/index.html': ['text/html', '<html><body>Chợ gia sư</body></html>'],
};

const assets = {
  async fetch(request) {
    const file = files[new URL(request.url).pathname];
    return file
      ? new Response(file[1], { headers: { 'content-type': file[0] } })
      : new Response('Không có', { status: 404 });
  },
};

function environment(extra = {}) {
  return {
    ORIGIN_URL: originUrl,
    ROOT_DOMAIN: 'thu.example.test',
    CONSOLE_HOST: 'platform.thu.example.test',
    MARKET_HOST: 'cho-gia-su.thu.example.test',
    TUTOR_HOST: 'gia-su.thu.example.test',
    EDGE_HOST_HEADER: 'x-school-host',
    EDGE_SHARED_SECRET: 'bi-mat-canh-gia',
    INTERNAL_JOB_TOKEN: 'ma-tick-gia',
    DATA_POLICY: 'consent-required',
    ORIGIN_TIMEOUT_MS: '2000',
    ASSETS: assets,
    ...extra,
  };
}

const waited = [];
const context = { waitUntil: (promise) => waited.push(promise) };

function call(url, init = {}, env = environment()) {
  return worker.fetch(new Request(url, init), env, context);
}

describe('cổng biên Cloudflare Worker', () => {
  it('chuyển /api/v1 về máy chủ với tên miền gốc và bí mật cổng biên; bỏ tiêu đề người dùng tự đặt', async () => {
    requests.length = 0;
    const response = await call('https://alpha.thu.example.test/api/v1/auth/me?x=1', {
      headers: {
        'x-edge-auth': 'gia-mao',
        'x-school-host': 'beta.thu.example.test',
        'cf-connecting-ip': '203.0.113.5',
      },
    });
    assert.equal(response.status, 200);
    const seen = requests.at(-1);
    assert.equal(seen.url, '/api/v1/auth/me?x=1');
    assert.equal(seen.headers['x-school-host'], 'alpha.thu.example.test');
    assert.equal(seen.headers['x-edge-auth'], 'bi-mat-canh-gia');
    assert.equal(seen.headers['x-forwarded-for'], '203.0.113.5');
  });

  it('chuyển cả thân yêu cầu POST', async () => {
    requests.length = 0;
    await call('https://alpha.thu.example.test/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'gia' }),
    });
    assert.equal(requests.at(-1).method, 'POST');
    assert.equal(requests.at(-1).body, '{"login":"gia"}');
  });

  it('ba ứng dụng theo tiền tố; đường dẫn ứng dụng trả index.html, tệp băm không rơi về index; biểu ngữ thử nghiệm', async () => {
    const redirect = await call('https://alpha.thu.example.test/quan-ly');
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), 'https://alpha.thu.example.test/quan-ly/');
    const deep = await call('https://alpha.thu.example.test/quan-ly/hoc-sinh', { headers: { accept: 'text/html' } });
    assert.equal(deep.status, 200);
    const html = await deep.text();
    assert.match(html, /id="root"/);
    assert.match(html, /data-trial-banner/);
    assert.match(html, /văn bản đồng ý/);
    assert.equal(deep.headers.get('cache-control'), 'no-cache');
    const script = await call('https://alpha.thu.example.test/quan-ly/assets/app-1.js');
    assert.equal(script.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(await script.text(), 'console.log(1)');
    assert.equal((await call('https://alpha.thu.example.test/quan-ly/assets/khong-co.js')).status, 404);
    assert.match(await (await call('https://alpha.thu.example.test/giao-vien/')).text(), /Giáo viên/);
  });

  it('cổng nền tảng ở tên miền riêng; tên miền hệ thống là trang đăng nhập theo đơn vị (DT-24)', async () => {
    assert.match(await (await call('https://platform.thu.example.test/truong')).text(), /Cổng nền tảng/);
    // Chợ gia sư ở tên miền riêng, ứng dụng ở gốc (DT-27); tên miền cũ của ứng dụng Gia sư chuyển 308 về chợ, giữ đường dẫn và truy
    // vấn, kể cả /api/v1 (YCTD-368)
    assert.match(await (await call('https://cho-gia-su.thu.example.test/ho-so')).text(), /Chợ gia sư/);
    const legacy = await call('https://gia-su.thu.example.test/xac-minh?code=abc&state=xyz');
    assert.equal(legacy.status, 308);
    assert.equal(legacy.headers.get('location'), 'https://cho-gia-su.thu.example.test/xac-minh?code=abc&state=xyz');
    const legacyApi = await call('https://gia-su.thu.example.test/api/v1/market/me');
    assert.equal(legacyApi.status, 308);
    assert.equal(legacyApi.headers.get('location'), 'https://cho-gia-su.thu.example.test/api/v1/market/me');
    const root = await call('https://thu.example.test/');
    assert.equal(root.status, 308);
    assert.equal(root.headers.get('location'), 'https://thu.example.test/quan-ly/');
    assert.match(await (await call('https://thu.example.test/quan-ly/')).text(), /id="root"/);
    requests.length = 0;
    await call('https://thu.example.test/api/v1/auth/directory/context');
    assert.equal(requests.at(-1).url, '/api/v1/auth/directory/context');
    assert.equal((await call('https://thu.example.test/khac')).status, 404);
  });

  it('website công khai của trường chuyển về /api/v1/public/site kèm tiêu đề gốc website', async () => {
    requests.length = 0;
    const response = await call('https://alpha.thu.example.test/gioi-thieu?trang=2', {
      headers: { 'x-website-root': 'gia-mao', accept: 'text/html' },
    });
    assert.equal(requests.at(-1).url, '/api/v1/public/site/gioi-thieu?trang=2');
    assert.equal(requests.at(-1).headers['x-website-root'], '1');
    assert.match(await response.text(), /Website giả.*data-trial-banner/s);
  });

  it('máy chủ ngủ hoặc lỗi cổng: trang đang khởi động cho trình duyệt, JSON 503 cho lời gọi API; lỗi 503 của ứng dụng giữ nguyên', async () => {
    const asleep = environment({ ORIGIN_URL: 'http://127.0.0.1:9', ORIGIN_TIMEOUT_MS: '500' });
    const page = await call('https://alpha.thu.example.test/gioi-thieu', { headers: { accept: 'text/html' } }, asleep);
    assert.equal(page.status, 503);
    assert.equal(page.headers.get('retry-after'), '10');
    assert.match(await page.text(), /đang khởi động/);
    const api = await call(
      'https://alpha.thu.example.test/api/v1/auth/me',
      { headers: { accept: 'application/json' } },
      asleep,
    );
    assert.equal(api.status, 503);
    assert.equal((await api.json()).error.code, 'ERR_SERVICE_WAKING');

    originStatus = 502;
    const gateway = await call('https://alpha.thu.example.test/api/v1/auth/me');
    assert.equal((await gateway.json()).error.code, 'ERR_SERVICE_WAKING');
    originStatus = 503;
    const suspended = await call('https://alpha.thu.example.test/api/v1/auth/me');
    assert.equal(suspended.status, 503);
    assert.equal((await suspended.json()).ok, false);
    originStatus = 200;
  });

  it('tổ hợp 3a: tệp tĩnh lấy từ dự án Vercel', async () => {
    const response = await call(
      'https://alpha.thu.example.test/quan-ly/',
      {},
      environment({ STATIC_ORIGIN: staticUrl, ASSETS: undefined }),
    );
    assert.match(await response.text(), /từ Vercel/);
  });

  it('Cron Triggers gọi điểm tick bằng bí mật dùng chung', async () => {
    requests.length = 0;
    await runScheduled(environment());
    const seen = requests.at(-1);
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/api/v1/internal/jobs/tick');
    assert.equal(seen.headers['x-internal-job-token'], 'ma-tick-gia');
    await assert.rejects(() => runScheduled(environment({ INTERNAL_JOB_TOKEN: '' })), /INTERNAL_JOB_TOKEN/);
  });

  it('chính sách any không có biểu ngữ; synthetic-only ghi rõ chỉ dữ liệu giả', () => {
    assert.equal(injectBanner('<body></body>', 'any'), '<body></body>');
    assert.match(injectBanner('<body></body>', 'synthetic-only'), /chỉ dùng dữ liệu giả/);
  });
});

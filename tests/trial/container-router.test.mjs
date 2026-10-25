import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createRouter, upstreamOf } from '../../deploy/profiles/trial/container/router.mjs';

// Bộ định tuyến của container gộp (DT-SaaS phần S9, YCTD-203): cùng bảng tuyến với Caddy ở hồ sơ vận hành; hai dịch vụ con giả
function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function fakeService(name) {
  return createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json', 'x-service': name });
      response.end(
        JSON.stringify({ service: name, url: request.url, host: request.headers['x-school-host'] ?? null, body }),
      );
    });
  });
}

let identity;
let api;
let router;
let base;

before(async () => {
  identity = fakeService('identity');
  api = fakeService('api');
  const ports = { identity: await listen(identity), api: await listen(api) };
  router = createRouter(ports);
  base = `http://127.0.0.1:${await listen(router)}`;
});

after(() => {
  identity.close();
  api.close();
  router.close();
});

describe('bộ định tuyến container gộp', () => {
  it('bảng tuyến khớp Caddy: nhóm định danh sang identity, còn lại sang api', () => {
    for (const path of [
      '/api/v1/auth/login',
      '/api/v1/auth',
      '/api/v1/users/1',
      '/api/v1/roles',
      '/api/v1/permissions',
      '/api/v1/api-clients/x',
    ]) {
      assert.equal(upstreamOf(path), 'identity', path);
    }
    for (const path of [
      '/api/v1/health',
      '/api/v1/students',
      '/api/v1/authority',
      '/api/v1/public/site/',
      '/api/v1/usersettings',
    ]) {
      assert.equal(upstreamOf(path), 'api', path);
    }
  });

  it('chuyển yêu cầu, giữ tiêu đề và thân', async () => {
    const login = await fetch(`${base}/api/v1/auth/login?x=1`, {
      method: 'POST',
      headers: { 'x-school-host': 'alpha.thu.example.test', 'content-type': 'application/json' },
      body: '{"login":"gia"}',
    });
    assert.deepEqual(await login.json(), {
      service: 'identity',
      url: '/api/v1/auth/login?x=1',
      host: 'alpha.thu.example.test',
      body: '{"login":"gia"}',
    });
    const health = await fetch(`${base}/api/v1/health`);
    assert.equal((await health.json()).service, 'api');
  });

  it('dịch vụ con chưa chạy thì trả 503 để cổng biên hiện trang đang khởi động', async () => {
    const down = createRouter({ identity: 9, api: 9 });
    const port = await listen(down);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'ERR_SERVICE_WAKING');
    } finally {
      down.close();
    }
  });
});

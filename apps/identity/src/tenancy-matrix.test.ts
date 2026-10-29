import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import { PUBLIC_ROUTES } from './tenancy-route-policy.js';
import { createTestUser, startTenantTestApplication, TEST_PASSWORD, type TenantTestContext } from './test-support.js';

// Ma trận cách ly cấp yêu cầu của dịch vụ định danh (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 3): liệt kê tự động mọi tuyến; tuyến
// nào không khai công khai ở tenancy-route-policy.ts thì mã phiên của trường A gọi ở tên miền trường B phải bị từ chối 401, không có
// mã phiên cũng 401, tên miền lạ 404. Tuyến công khai mới chưa khai báo thì kiểm thử đỏ
interface RouteLayer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
}

function listRoutes(context: TenantTestContext): Array<{ method: string; path: string }> {
  const instance = context.application.getHttpAdapter().getInstance() as {
    router?: { stack: RouteLayer[] };
    _router?: { stack: RouteLayer[] };
  };
  const stack = instance.router?.stack ?? instance._router?.stack ?? [];
  const routes: Array<{ method: string; path: string }> = [];
  for (const layer of stack) {
    if (!layer.route) {
      continue;
    }
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const path of paths) {
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled && method !== '_all') {
          routes.push({ method: method.toUpperCase(), path });
        }
      }
    }
  }
  return routes;
}

function concretePath(path: string): string {
  return path
    .replace(/:[A-Za-z0-9_]+\??/g, '00000000-0000-4000-8000-000000000000')
    .replace(/\{\*[A-Za-z0-9_]+\}/g, 'x')
    .replace(/\*[A-Za-z0-9_]*/g, 'x');
}

function send(
  context: TenantTestContext,
  options: { method: string; path: string; host?: string; token?: string; body?: unknown },
): Promise<number> {
  const url = new URL(`${context.origin}${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: options.method,
        headers: {
          ...(options.host ? { host: options.host } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    request.on('error', reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

describe('ma trận cách ly mọi tuyến của dịch vụ định danh giữa hai trường', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let routes: Array<{ method: string; path: string }>;
  const hosts: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const body = (method: string) => (['POST', 'PUT', 'PATCH'].includes(method) ? {} : undefined);

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'idmx' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime, { loginRequestsPerMinutePerAddress: 100_000 });
    for (const name of ['alpha', 'beta']) {
      hosts[name] = platform.school(name).host;
      const tenant = await runtime.registry.resolveHost(hosts[name] as string);
      assert.ok(tenant);
      const database = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
      const user = await createTestUser(database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
      tokens[name] = await loginToken(name, user.username);
    }
    routes = listRoutes(context);
  });

  async function loginToken(name: string, username: string): Promise<string> {
    const url = new URL(`${context.origin}/api/v1/auth/login`);
    const payload = JSON.stringify({ login: username, password: TEST_PASSWORD, channel: 'portal' });
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { host: hosts[name] as string, 'content-type': 'application/json' },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { access_token?: string };
            if (!parsed.access_token) {
              reject(new Error('Đăng nhập kiểm thử thất bại'));
              return;
            }
            resolve(parsed.access_token);
          });
        },
      );
      request.on('error', reject);
      request.write(payload);
      request.end();
    });
  }

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const isPublic = (route: { method: string; path: string }) =>
    PUBLIC_ROUTES.some((entry) => entry.method === route.method && entry.path === route.path);

  it('liệt kê được các tuyến của dịch vụ định danh', () => {
    assert.ok(routes.length > 30, `chỉ thấy ${routes.length} tuyến`);
  });

  it('mọi tuyến công khai đều đã khai báo kèm lý do; khai báo thừa cũng bị bắt', async () => {
    const observed: string[] = [];
    await inBatches(routes, 15, async (route) => {
      const status = await send(context, {
        method: route.method,
        path: concretePath(route.path),
        host: hosts.beta,
        token: tokens.alpha,
        body: body(route.method),
      });
      if (status !== 401) {
        observed.push(`${route.method} ${route.path}`);
      }
    });
    const declared = PUBLIC_ROUTES.map((entry) => `${entry.method} ${entry.path}`);
    const undeclared = observed.filter((route) => !declared.includes(route)).sort();
    assert.deepEqual(
      undeclared,
      [],
      `Tuyến không đòi mã phiên đúng trường mà chưa khai là công khai:\n${undeclared.join('\n')}`,
    );
    const stale = declared.filter((route) => !observed.includes(route)).sort();
    assert.deepEqual(stale, [], `Tuyến khai là công khai nhưng thực tế đòi mã phiên: ${stale.join(', ')}`);
  });

  it('mã phiên trường A ở tên miền trường B bị từ chối 401 ở mọi tuyến không công khai (cả hai chiều); không mã phiên cũng 401', async () => {
    const protectedRoutes = routes.filter((route) => !isPublic(route));
    assert.ok(protectedRoutes.length > 20);
    const wrong: string[] = [];
    await inBatches(protectedRoutes, 15, async (route) => {
      const attempts: Array<[string | undefined, string]> = [
        [tokens.alpha, hosts.beta as string],
        [tokens.beta, hosts.alpha as string],
        [undefined, hosts.alpha as string],
      ];
      for (const [token, host] of attempts) {
        const status = await send(context, {
          method: route.method,
          path: concretePath(route.path),
          host,
          ...(token ? { token } : {}),
          body: body(route.method),
        });
        if (status !== 401) {
          wrong.push(`${route.method} ${route.path} -> ${status}`);
        }
      }
    });
    assert.deepEqual(wrong, []);
  });

  it('tên miền lạ trả 404 ở mọi tuyến (trừ tuyến không cần trường)', async () => {
    const wrong: string[] = [];
    await inBatches(routes, 15, async (route) => {
      const status = await send(context, {
        method: route.method,
        path: concretePath(route.path),
        host: 'khong-co.e2e.localhost',
        body: body(route.method),
      });
      const tenantFree = route.path === '/api/v1/health' || route.path.startsWith('/api/v1/auth/platform/');
      if (!tenantFree && status !== 404) {
        wrong.push(`${route.method} ${route.path} -> ${status}`);
      }
    });
    assert.deepEqual(wrong, []);
  });
});

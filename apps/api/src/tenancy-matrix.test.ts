import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PUBLIC_ROUTES } from './tenancy-route-policy.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from './tenant-test-support.js';

// Ma trận cách ly ở cấp yêu cầu (DT-SaaS phần S1a, tài liệu 32 mục 14.7 lớp 3): liệt kê TỰ ĐỘNG mọi tuyến của máy chủ API; tuyến
// nào không khai là công khai ở tenancy-route-policy.ts thì mã phiên của trường A gọi ở tên miền trường B phải bị từ chối 401,
// không có mã phiên cũng 401, tên miền lạ 404. Thêm tuyến công khai mới mà chưa khai báo thì kiểm thử đỏ
interface RouteLayer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
}

function listRoutes(environment: MultiTenantApi): Array<{ method: string; path: string }> {
  const instance = environment.api.getHttpAdapter().getInstance() as {
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

// Thay tham số đường dẫn bằng giá trị mẫu để gọi được
function concretePath(path: string): string {
  return path
    .replace(/:[A-Za-z0-9_]+\??/g, '00000000-0000-4000-8000-000000000000')
    .replace(/\{\*[A-Za-z0-9_]+\}/g, 'x')
    .replace(/\*[A-Za-z0-9_]*/g, 'x');
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

describe('ma trận cách ly mọi tuyến API giữa hai trường', () => {
  let environment: MultiTenantApi;
  let routes: Array<{ method: string; path: string }>;

  before(async () => {
    environment = await startMultiTenantApi({ label: 'mx' });
    routes = listRoutes(environment);
  });

  after(async () => {
    await environment?.close();
  });

  const isPublic = (route: { method: string; path: string }) =>
    PUBLIC_ROUTES.some((entry) => entry.method === route.method && entry.path === route.path);

  it('liệt kê được các tuyến của máy chủ API', () => {
    assert.ok(routes.length > 200, `chỉ thấy ${routes.length} tuyến`);
  });

  it('mọi tuyến công khai đều đã khai báo kèm lý do; khai báo thừa cũng bị bắt', async () => {
    const observed: string[] = [];
    await inBatches(routes, 25, async (route) => {
      const reply = await sendWithHost(environment.apiOrigin, {
        method: route.method,
        path: concretePath(route.path),
        host: environment.hosts.beta,
        token: environment.tokens.alpha,
        body: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {} : undefined,
      });
      if (reply.status !== 401) {
        observed.push(`${route.method} ${route.path}`);
      }
    });
    const declared = PUBLIC_ROUTES.map((entry) => `${entry.method} ${entry.path}`);
    const undeclared = observed.filter((route) => !declared.includes(route)).sort();
    assert.deepEqual(
      undeclared,
      [],
      `Tuyến không đòi mã phiên đúng trường mà chưa khai là công khai (tenancy-route-policy.ts):\n${undeclared.join('\n')}`,
    );
    const stale = declared.filter((route) => !observed.includes(route)).sort();
    assert.deepEqual(stale, [], `Tuyến khai là công khai nhưng thực tế đòi mã phiên: ${stale.join(', ')}`);
  });

  it('mã phiên của trường A gọi ở tên miền trường B bị từ chối 401 ở mọi tuyến không công khai (cả hai chiều)', async () => {
    const protectedRoutes = routes.filter((route) => !isPublic(route));
    assert.ok(protectedRoutes.length > 150);
    const wrong: string[] = [];
    await inBatches(protectedRoutes, 25, async (route) => {
      for (const [token, host] of [
        [environment.tokens.alpha, environment.hosts.beta],
        [environment.tokens.beta, environment.hosts.alpha],
      ] as const) {
        const reply = await sendWithHost(environment.apiOrigin, {
          method: route.method,
          path: concretePath(route.path),
          host,
          token,
          body: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {} : undefined,
        });
        if (reply.status !== 401) {
          wrong.push(`${route.method} ${route.path} -> ${reply.status}`);
        }
      }
    });
    assert.deepEqual(wrong, []);
  });

  it('không có mã phiên thì mọi tuyến không công khai trả 401 ở tên miền của trường', async () => {
    const protectedRoutes = routes.filter((route) => !isPublic(route));
    const wrong: string[] = [];
    await inBatches(protectedRoutes, 25, async (route) => {
      const reply = await sendWithHost(environment.apiOrigin, {
        method: route.method,
        path: concretePath(route.path),
        host: environment.hosts.alpha,
        body: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {} : undefined,
      });
      if (reply.status !== 401) {
        wrong.push(`${route.method} ${route.path} -> ${reply.status}`);
      }
    });
    assert.deepEqual(wrong, []);
  });

  it('tên miền lạ trả 404 ở mọi tuyến (trừ kiểm tra sức khỏe) và không lộ gì của trường nào', async () => {
    const wrong: string[] = [];
    await inBatches(routes, 25, async (route) => {
      const reply = await sendWithHost(environment.apiOrigin, {
        method: route.method,
        path: concretePath(route.path),
        host: 'khong-co.e2e.localhost',
        body: ['POST', 'PUT', 'PATCH'].includes(route.method) ? {} : undefined,
      });
      const expected = route.path === '/api/v1/health' ? 200 : 404;
      if (reply.status !== expected) {
        wrong.push(`${route.method} ${route.path} -> ${reply.status}`);
      }
    });
    assert.deepEqual(wrong, []);
  });
});

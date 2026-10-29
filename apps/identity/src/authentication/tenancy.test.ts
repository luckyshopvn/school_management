import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import type { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { Infrastructure } from '../common/infrastructure.js';
import {
  createTestUser,
  startTenantTestApplication,
  TEST_PASSWORD,
  type TenantTestContext,
  type TestUser,
} from '../test-support.js';

// Dịch vụ định danh ở chế độ nhiều trường (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 3, 6): cơ sở dữ liệu định danh theo trường,
// mã phiên mang mã trường, cookie mã làm mới và khóa Redis không lẫn giữa các trường

interface Reply {
  status: number;
  body: Record<string, unknown>;
  cookies: string[];
}

function send(
  context: TenantTestContext,
  options: { method?: string; path: string; host?: string; body?: unknown; token?: string; cookie?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method ?? (payload ? 'POST' : 'GET'),
        headers: {
          ...(options.host ? { host: options.host } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          ...(options.cookie ? { cookie: options.cookie } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: response.statusCode ?? 0,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
            cookies: response.headers['set-cookie'] ?? [],
          });
        });
      },
    );
    request.on('error', reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

function decodeClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1] as string, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

describe('dịch vụ định danh nhiều trường', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let alphaHost: string;
  let betaHost: string;
  let alphaUser: TestUser;
  let betaUser: TestUser;
  let alphaId: string;
  let betaId: string;
  let alphaCode: string;
  let betaCode: string;

  async function identityDatabase(host: string): Promise<Kysely<IdentityDatabase>> {
    const tenant = await runtime.registry.resolveHost(host);
    assert.ok(tenant);
    return runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  }

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'idn' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime, { loginRequestsPerMinutePerAddress: 1000 });
    alphaHost = platform.school('alpha').host;
    betaHost = platform.school('beta').host;
    alphaId = platform.school('alpha').schoolId;
    betaId = platform.school('beta').schoolId;
    alphaCode = platform.school('alpha').code;
    betaCode = platform.school('beta').code;
    alphaUser = await createTestUser(await identityDatabase(alphaHost));
    betaUser = await createTestUser(await identityDatabase(betaHost));
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  async function login(host: string | undefined, user: TestUser, password = TEST_PASSWORD) {
    return send(context, { path: '/auth/login', host, body: { login: user.username, password, channel: 'portal' } });
  }

  it('tên miền lạ hoặc không phải của trường nào trả 404 chung, kể cả địa chỉ nội bộ khi không có mã phiên', async () => {
    for (const host of ['khong-co.e2e.localhost', undefined]) {
      const reply = await login(host, alphaUser);
      assert.equal(reply.status, 404);
      assert.equal((reply.body.error as { code: string }).code, 'ERR_NOT_FOUND');
    }
    const health = await send(context, { path: '/health' });
    assert.equal(health.status, 200);
  });

  it('đăng nhập đúng trường: mã phiên mang mã trường, cookie mã làm mới có mã trường', async () => {
    const reply = await login(alphaHost, alphaUser);
    assert.equal(reply.status, 200);
    const claims = decodeClaims(reply.body.access_token as string);
    assert.equal(claims.tid, alphaId);
    assert.notEqual(claims.sid, alphaId);
    const cookie = reply.cookies.find((item) => item.startsWith('__Secure-refresh_token'));
    assert.ok(cookie?.startsWith(`__Secure-refresh_token__${alphaCode}=`), cookie);
  });

  it('tài khoản của trường này không đăng nhập được ở tên miền của trường khác', async () => {
    assert.equal((await login(betaHost, alphaUser)).status, 401);
    assert.equal((await login(alphaHost, betaUser)).status, 401);
    assert.equal((await login(betaHost, betaUser)).status, 200);
  });

  it('mã phiên của trường A bị từ chối ở tên miền trường B, dùng được ở tên miền A và ở địa chỉ nội bộ', async () => {
    const token = (await login(alphaHost, alphaUser)).body.access_token as string;
    assert.equal((await send(context, { path: '/auth/me', host: alphaHost, token })).status, 200);
    assert.equal((await send(context, { path: '/auth/me', host: betaHost, token })).status, 401);
    // Địa chỉ nội bộ (máy chủ API gọi): lấy trường theo mã trường trong mã phiên đã ký
    const internal = await send(context, { path: '/auth/me', token });
    assert.equal(internal.status, 200);
    assert.equal(internal.body.id, alphaUser.id);
  });

  it('mã phiên giả mã trường hoặc bỏ mã trường bị từ chối', async () => {
    const token = (await login(alphaHost, alphaUser)).body.access_token as string;
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    forged.tid = betaId;
    const forgedToken = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    assert.equal((await send(context, { path: '/auth/me', host: betaHost, token: forgedToken })).status, 401);
    delete forged.tid;
    const strippedToken = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    assert.equal((await send(context, { path: '/auth/me', host: alphaHost, token: strippedToken })).status, 401);
  });

  it('cookie mã làm mới của trường A không làm mới được phiên ở trường B', async () => {
    const loggedIn = await login(alphaHost, alphaUser);
    const cookiePair = (loggedIn.cookies.find((item) => item.startsWith('__Secure-refresh_token')) as string).split(
      ';',
    )[0] as string;
    const refreshed = await send(context, {
      path: '/auth/refresh',
      host: alphaHost,
      body: { channel: 'portal' },
      cookie: cookiePair,
    });
    assert.equal(refreshed.status, 200);
    // Cùng giá trị nhưng đặt dưới tên cookie của trường B (kẻ tấn công đặt từ tên miền anh em), hoặc gửi nguyên cookie của A tới B
    const value = cookiePair.slice(cookiePair.indexOf('=') + 1);
    const asBeta = await send(context, {
      path: '/auth/refresh',
      host: betaHost,
      body: { channel: 'portal' },
      cookie: `__Secure-refresh_token__${betaCode}=${value}`,
    });
    assert.equal(asBeta.status, 401);
    const raw = await send(context, {
      path: '/auth/refresh',
      host: betaHost,
      body: { channel: 'portal' },
      cookie: cookiePair,
    });
    assert.equal(raw.status, 401);
  });

  it('giới hạn đăng nhập theo địa chỉ tính riêng từng trường', async () => {
    // Sang phút mới để bộ đếm của hai trường bắt đầu từ không, đặt giới hạn nhỏ
    context.clock.advanceMinutes(2);
    context.configuration.loginRequestsPerMinutePerAddress = 3;
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        statuses.push((await login(alphaHost, alphaUser, 'sai-mat-khau')).status);
      }
      assert.ok(statuses.includes(429), statuses.join(','));
      // Trường B cùng địa chỉ nguồn vẫn đăng nhập được vì bộ đếm là của riêng trường
      assert.equal((await login(betaHost, betaUser)).status, 200);
    } finally {
      context.configuration.loginRequestsPerMinutePerAddress = 1000;
      context.clock.advanceMinutes(2);
    }
  });

  it('khóa Redis có tiền tố của từng trường', async () => {
    // Kiểm thử chạy với Redis thật (REDIS_URL), không phải kho trong bộ nhớ
    const redis = context.application.get(Infrastructure).redis as Redis;
    const prefix = context.configuration.redisKeyPrefix;
    const alphaKeys = await redis.keys(`${prefix}:t:${alphaCode}:*`);
    const betaKeys = await redis.keys(`${prefix}:t:${betaCode}:*`);
    assert.ok(alphaKeys.some((key) => key.includes('login-rate')));
    assert.ok(betaKeys.some((key) => key.includes('login-rate')));
    const bare = (await redis.keys(`${prefix}:login-rate:*`)).length;
    assert.equal(bare, 0);
  });

  it('dữ liệu định danh mỗi trường nằm ở cơ sở dữ liệu riêng', async () => {
    const alphaDb = await identityDatabase(alphaHost);
    const betaDb = await identityDatabase(betaHost);
    const inAlpha = await alphaDb
      .selectFrom('users')
      .select('username')
      .where('username', '=', betaUser.username)
      .execute();
    const inBeta = await betaDb
      .selectFrom('users')
      .select('username')
      .where('username', '=', alphaUser.username)
      .execute();
    assert.deepEqual(inAlpha, []);
    assert.deepEqual(inBeta, []);
  });

  it('trường tạm dừng trả 503, mở lại thì phục vụ tiếp', async () => {
    await platform.platform.updateTable('schools').set({ status: 'suspended' }).where('id', '=', betaId).execute();
    runtime.registry.invalidate();
    assert.equal((await login(betaHost, betaUser)).status, 503);
    await platform.platform.updateTable('schools').set({ status: 'active' }).where('id', '=', betaId).execute();
    runtime.registry.invalidate();
    assert.equal((await login(betaHost, betaUser)).status, 200);
  });
});

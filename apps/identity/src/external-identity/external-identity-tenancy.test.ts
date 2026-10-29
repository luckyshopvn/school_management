import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  createTestUser,
  MockOidcServer,
  parseProviderDefinition,
  startTenantTestApplication,
  TEST_PASSWORD,
  type TenantTestContext,
  type TestUser,
} from '../test-support.js';

// Cách ly giữa các trường của bộ nối nhà cung cấp định danh (DT-25, YCTD-225; tài liệu 47 mục 14.7, 17): cấu hình bật tắt, liên kết, state
// đều theo trường; subject mã hóa và băm bằng khóa của từng trường (kho khóa S3), nên cùng một subject ở hai trường cho hai bản băm khác
// nhau và liên kết ở trường này không đăng nhập được ở trường kia
const CODE = 'oidc-thu';

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

describe('bộ nối nhà cung cấp định danh ở chế độ nhiều trường', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let mock: MockOidcServer;
  let alphaHost: string;
  let betaHost: string;
  let alphaManager: TestUser;
  let betaManager: TestUser;
  let alphaUser: TestUser;

  function send(host: string, method: string, path: string, body?: unknown, token?: string): Promise<Reply> {
    const target = new URL(`${context.origin}/api/v1${path}`);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: target.pathname,
          method,
          headers: {
            host,
            ...(payload ? { 'content-type': 'application/json' } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
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

  async function identityDatabase(host: string): Promise<Kysely<IdentityDatabase>> {
    const tenant = await runtime.registry.resolveHost(host);
    assert.ok(tenant);
    return runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  }

  const login = async (host: string, user: TestUser) =>
    (await send(host, 'POST', '/auth/login', { login: user.username, password: TEST_PASSWORD, channel: 'portal' })).body
      .access_token as string;
  const redirect = (host: string) => `http://${host}/dang-nhap/ben-ngoai`;

  async function externalLogin(host: string, subject: string): Promise<Reply> {
    const started = await send(host, 'POST', `/auth/external/${CODE}/start`, {
      channel: 'portal',
      redirect_uri: redirect(host),
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const issued = mock.authorize(started.body.authorization_url as string, { subject });
    return send(host, 'POST', '/auth/external/callback', { state: issued.state, code: issued.code });
  }

  before(async () => {
    mock = await new MockOidcServer().start();
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'dt25' });
    runtime = platform.createRuntime();
    const definition = parseProviderDefinition(
      { code: CODE, issuer: mock.issuer, client_id: mock.clientId, jwks_cooldown_seconds: 0 },
      { [CODE]: mock.clientSecret },
    );
    context = await startTenantTestApplication(runtime, { externalIdentityProviders: [definition] });
    alphaHost = platform.school('alpha').host;
    betaHost = platform.school('beta').host;
    alphaManager = await createTestUser(await identityDatabase(alphaHost), {
      roles: [{ roleCode: 'VT-01', orgUnitId: null }],
    });
    betaManager = await createTestUser(await identityDatabase(betaHost), {
      roles: [{ roleCode: 'VT-01', orgUnitId: null }],
    });
    alphaUser = await createTestUser(await identityDatabase(alphaHost), {
      roles: [{ roleCode: 'VT-07', orgUnitId: null }],
    });
  });

  after(async () => {
    await context?.close();
    await platform?.close();
    await mock?.stop();
  });

  it('bật ở trường A không bật ở trường B', async () => {
    const saved = await send(
      alphaHost,
      'PUT',
      `/auth/external/settings/${CODE}`,
      { enabled: true },
      await login(alphaHost, alphaManager),
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(((await send(alphaHost, 'GET', '/auth/external/providers')).body.providers as unknown[]).length, 1);
    assert.deepEqual((await send(betaHost, 'GET', '/auth/external/providers')).body.providers, []);
    const started = await send(betaHost, 'POST', `/auth/external/${CODE}/start`, {
      channel: 'portal',
      redirect_uri: redirect(betaHost),
    });
    assert.equal(started.status, 422);
  });

  it('địa chỉ quay về của trường khác bị từ chối', async () => {
    const started = await send(alphaHost, 'POST', `/auth/external/${CODE}/start`, {
      channel: 'portal',
      redirect_uri: redirect(betaHost),
    });
    assert.equal(started.status, 400);
  });

  it('liên kết ở trường A chỉ đăng nhập được ở trường A; subject băm bằng khóa riêng của trường', async () => {
    const token = await login(alphaHost, alphaUser);
    const started = await send(
      alphaHost,
      'POST',
      `/auth/external/${CODE}/link`,
      { password: TEST_PASSWORD, redirect_uri: redirect(alphaHost) },
      token,
    );
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const issued = mock.authorize(started.body.authorization_url as string, { subject: 'chung-hai-truong' });
    const linked = await send(
      alphaHost,
      'POST',
      '/auth/external/callback',
      { state: issued.state, code: issued.code },
      token,
    );
    assert.equal(linked.status, 200, JSON.stringify(linked.body));

    assert.equal((await externalLogin(alphaHost, 'chung-hai-truong')).status, 200);

    // Trường B bật cùng nhà cung cấp nhưng không có liên kết: từ chối, không tự tạo tài khoản
    const betaSaved = await send(
      betaHost,
      'PUT',
      `/auth/external/settings/${CODE}`,
      { enabled: true },
      await login(betaHost, betaManager),
    );
    assert.equal(betaSaved.status, 200);
    assert.equal((await externalLogin(betaHost, 'chung-hai-truong')).status, 401);

    const alphaRows = await (
      await identityDatabase(alphaHost)
    )
      .selectFrom('external_identities')
      .select('subject_hash')
      .execute();
    const betaRows = await (
      await identityDatabase(betaHost)
    )
      .selectFrom('external_identities')
      .select('subject_hash')
      .execute();
    assert.equal(alphaRows.length, 1);
    assert.equal(betaRows.length, 0);
  });

  it('state của trường A không dùng được ở trường B', async () => {
    const started = await send(alphaHost, 'POST', `/auth/external/${CODE}/start`, {
      channel: 'portal',
      redirect_uri: redirect(alphaHost),
    });
    const issued = mock.authorize(started.body.authorization_url as string, { subject: 'chung-hai-truong' });
    const crossed = await send(betaHost, 'POST', '/auth/external/callback', { state: issued.state, code: issued.code });
    assert.equal(crossed.status, 401);
  });

  it('mã phiên của trường A không đọc được cấu hình của trường B', async () => {
    const reply = await send(
      betaHost,
      'GET',
      '/auth/external/settings',
      undefined,
      await login(alphaHost, alphaManager),
    );
    assert.equal(reply.status, 401);
  });
});

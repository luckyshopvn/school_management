import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  dropSchool,
  startTenantTestPlatform,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import { startTenantTestApplication, TEST_PASSWORD, type TenantTestContext } from '../test-support.js';
import { createPlatformOperator } from './platform-operators.js';

// Quản lý trường ở cổng nền tảng và kích hoạt quản trị viên đầu tiên (DT-SaaS phần S2, YCTD-193): khởi tạo qua bước setup, tạm
// dừng thì trường trả 503, mở lại, kích hoạt bằng đường liên kết một lần rồi đăng nhập. Dữ liệu giả hoàn toàn

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

function send(
  context: TenantTestContext,
  options: { path: string; host?: string; body?: unknown; token?: string; method?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? (payload ? 'POST' : 'GET'),
        headers: {
          ...(options.host ? { host: options.host } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : {} });
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

const CONSOLE_HOST = 'platform.e2e.localhost';
const SYSTEM_DOMAIN = 's2.e2e.localhost';

describe('quản lý trường ở cổng nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let token: string;
  let schoolCode: string;
  let activationToken: string;
  const login = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'sch' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    context.configuration.platformLifecycle = {
      systemDomain: SYSTEM_DOMAIN,
      ingressHost: null,
      domainProvider: 'dns-check',
      deletionGraceDays: 30,
    };
    await createPlatformOperator(platform.platform, { login, fullName: 'Người vận hành giả', password: TEST_PASSWORD });
    const reply = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: { login, password: TEST_PASSWORD },
    });
    token = reply.body.access_token as string;
    schoolCode = `gamma-${platform.suffix}`;
  });

  after(async () => {
    const created = await platform?.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', schoolCode)
      .executeTakeFirst();
    if (created) {
      await dropSchool({
        platform: platform.platform,
        masterKey: platform.masterKey,
        layout: platform.layout,
        schoolId: created.id,
      }).catch(() => undefined);
    }
    await context?.close();
    await platform?.close();
  });

  const consoleApi = (path: string, body?: unknown) =>
    send(context, {
      path: `/auth/platform/schools${path}`,
      host: CONSOLE_HOST,
      token,
      ...(body !== undefined ? { body } : {}),
    });

  it('cần mã phiên vận hành và tên miền cổng nền tảng', async () => {
    assert.equal((await send(context, { path: '/auth/platform/schools', host: CONSOLE_HOST })).status, 401);
    assert.equal(
      (await send(context, { path: '/auth/platform/schools', host: platform.school('alpha').host, token })).status,
      404,
    );
    const list = await consoleApi('');
    assert.equal(list.status, 200);
    assert.equal((list.body.items as unknown[]).length, 1);
    const settings = await consoleApi('/settings');
    assert.equal(settings.body.system_domain, SYSTEM_DOMAIN);
  });

  it('bước setup báo lỗi từng trường', async () => {
    const reply = await consoleApi('', { code: 'X', levels: [], domain: { mode: 'system' }, data_class: 'consented' });
    assert.equal(reply.status, 400);
    const fields = (reply.body.error as { details: Array<{ field: string }> }).details.map((detail) => detail.field);
    for (const field of ['code', 'name', 'levels', 'consents', 'admin.login', 'terms']) {
      assert.ok(fields.includes(field), field);
    }
  });

  it('khởi tạo trường, trả đường kích hoạt một lần', async () => {
    const reply = await consoleApi('', {
      code: schoolCode,
      name: 'Trường Gamma (dữ liệu giả)',
      levels: ['TH'],
      first_year_start: 2026,
      domain: { mode: 'system' },
      data_class: 'synthetic',
      admin: { full_name: 'Quản trị Gamma giả', login: 'quantri' },
      terms: { version: 'PL-04 v1', accepted: true, accepted_by_name: 'Hiệu trưởng giả' },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.status, 'done');
    const activation = reply.body.activation as { path: string; host: string };
    assert.equal(activation.host, `${schoolCode}.${SYSTEM_DOMAIN}`);
    activationToken = new URLSearchParams(activation.path.split('?')[1]).get('token') as string;
    assert.ok(activationToken);
    const detail = await consoleApi(`/${schoolCode}`);
    assert.equal(detail.body.status, 'trial');
    assert.equal((detail.body.invitations as unknown[]).length, 1);
    assert.ok(!JSON.stringify(detail.body).includes(activationToken));
  });

  it('kích hoạt quản trị viên ở tên miền của trường rồi đăng nhập', async () => {
    const host = `${schoolCode}.${SYSTEM_DOMAIN}`;
    // Quản trị viên chưa kích hoạt không đăng nhập được
    assert.equal(
      (
        await send(context, {
          path: '/auth/login',
          host,
          body: { login: 'quantri', password: TEST_PASSWORD, channel: 'portal' },
        })
      ).status,
      401,
    );
    // Mã kích hoạt không dùng được ở trường khác
    assert.equal(
      (await send(context, { path: `/auth/activate?token=${activationToken}`, host: platform.school('alpha').host }))
        .status,
      401,
    );
    const preview = await send(context, { path: `/auth/activate?token=${activationToken}`, host });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.login, 'quantri');
    const weak = await send(context, {
      path: '/auth/activate',
      host,
      body: { token: activationToken, new_password: 'ngan' },
    });
    assert.equal(weak.status, 400);
    const done = await send(context, {
      path: '/auth/activate',
      host,
      body: { token: activationToken, new_password: TEST_PASSWORD },
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const again = await send(context, {
      path: '/auth/activate',
      host,
      body: { token: activationToken, new_password: TEST_PASSWORD },
    });
    assert.equal(again.status, 401);
    const signIn = await send(context, {
      path: '/auth/login',
      host,
      body: { login: 'quantri', password: TEST_PASSWORD, channel: 'portal' },
    });
    assert.equal(signIn.status, 200, JSON.stringify(signIn.body));
  });

  it('tạm dừng thì trường trả 503, mở lại thì phục vụ lại', async () => {
    const host = `${schoolCode}.${SYSTEM_DOMAIN}`;
    const suspended = await consoleApi(`/${schoolCode}/suspend`, { reason: 'Kiểm thử tạm dừng' });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, 'suspended');
    const blocked = await send(context, { path: '/auth/login-options', host });
    assert.equal(blocked.status, 503);
    assert.equal((await consoleApi(`/${schoolCode}/suspend`, {})).status, 422);
    assert.equal((await consoleApi(`/${schoolCode}/resume`, {})).body.status, 'active');
    assert.equal((await send(context, { path: '/auth/login-options', host })).status, 200);
  });

  it('yêu cầu xóa có hạn chờ, hủy được; ghi sự kiện vòng đời', async () => {
    const requested = await consoleApi(`/${schoolCode}/request-deletion`, { reason: 'Kiểm thử' });
    assert.equal(requested.body.status, 'pending_deletion');
    const detail = await consoleApi(`/${schoolCode}`);
    assert.ok(detail.body.delete_after);
    assert.equal((await consoleApi(`/${schoolCode}/cancel-deletion`, {})).body.status, 'suspended');
    const events = ((await consoleApi(`/${schoolCode}`)).body.events as Array<{ event: string }>).map(
      (event) => event.event,
    );
    for (const event of ['provisioned', 'suspended', 'resumed', 'deletion-requested', 'deletion-cancelled']) {
      assert.ok(events.includes(event), event);
    }
  });

  it('tên miền riêng chờ kiểm tra DNS; không được thuộc tên miền hệ thống', async () => {
    assert.equal((await consoleApi(`/${schoolCode}/domains`, { host: `abc.${SYSTEM_DOMAIN}` })).status, 400);
    const added = await consoleApi(`/${schoolCode}/domains`, { host: `gamma-${platform.suffix}.example.invalid` });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.equal(added.body.status, 'pending');
    assert.ok(String(added.body.verification_token).startsWith('school-verify='));
    const checked = await consoleApi(`/${schoolCode}/domains/gamma-${platform.suffix}.example.invalid/verify`, {});
    assert.equal(checked.status, 200);
    assert.equal(checked.body.verified, false);
  });
});

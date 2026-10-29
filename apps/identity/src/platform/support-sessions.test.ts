import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  SUPPORT_USERNAME,
  startTenantTestPlatform,
  type IdentityDatabase,
  type SystemDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import { startTenantTestApplication, TEST_PASSWORD, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Bảng điều khiển nền tảng, phiên hỗ trợ, thông báo bảo trì ở dịch vụ định danh (DT-SaaS phần S4, YCTD-197), kịch bản CT-S4-1 đến
// CT-S4-4. Dữ liệu giả
interface Reply {
  status: number;
  body: unknown;
  cookies: string[];
}

const CONSOLE_HOST = 'platform.e2e.localhost';

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
        path: `${url.pathname}${url.search}`,
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
            body: text ? JSON.parse(text) : {},
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

describe('bảng điều khiển nền tảng và phiên hỗ trợ', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let token = '';
  let technicianToken = '';
  let alphaSystem: Kysely<SystemDatabase>;
  let alphaIdentity: Kysely<IdentityDatabase>;
  const login = `ho-tro-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'support' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login,
      fullName: 'Nhân viên hỗ trợ giả',
      password: OPERATOR_TEST_PASSWORD,
      // Vai trò hỗ trợ đi theo cho phép của trường; quan_tri vào thẳng mọi trường (YCTD-314)
      role: 'ho_tro',
    });
    const reply = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, created.id, created.secret, context.clock.now()),
      },
    });
    token = (reply.body as { access_token: string }).access_token;
    // Thông báo bảo trì do kỹ thuật hoặc quản trị làm (YCTD-323, bảng quyền vận hành)
    const technicianLogin = `ky-thuat-${Math.random().toString(36).slice(2, 8)}`;
    const technicianAccount = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login: technicianLogin,
      fullName: 'Nhân viên kỹ thuật giả',
      password: OPERATOR_TEST_PASSWORD,
      role: 'ky_thuat',
    });
    technicianToken = (
      (
        await send(context, {
          path: '/auth/platform/login',
          host: CONSOLE_HOST,
          body: {
            login: technicianLogin,
            password: OPERATOR_TEST_PASSWORD,
            otp_code: await operatorOtp(
              platform.platform,
              technicianAccount.id,
              technicianAccount.secret,
              context.clock.now(),
            ),
          },
        })
      ).body as { access_token: string }
    ).access_token;
    const tenant = await runtime.registry.resolveHost(platform.school('alpha').host);
    assert.ok(tenant);
    alphaSystem = runtime.connections.database<SystemDatabase>(tenant, 'system', 'system');
    alphaIdentity = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const operator = (method: string, path: string, body?: unknown) =>
    send(context, {
      method,
      path: `/auth/platform/${path}`,
      host: CONSOLE_HOST,
      token,
      ...(body !== undefined ? { body } : {}),
    });
  const technician = (method: string, path: string, body?: unknown) =>
    send(context, {
      method,
      path: `/auth/platform/${path}`,
      host: CONSOLE_HOST,
      token: technicianToken,
      ...(body !== undefined ? { body } : {}),
    });

  const grant = async (scope: 'read' | 'full', hours = 24) => {
    await alphaSystem
      .updateTable('support_access_grants')
      .set({ revoked_at: new Date() })
      .where('revoked_at', 'is', null)
      .execute();
    return alphaSystem
      .insertInto('support_access_grants')
      .values({
        granted_by_user_id: '00000000-0000-4000-8000-000000000001',
        granted_by_name: 'Quản trị giả',
        scope,
        reason: 'Kiểm thử hỗ trợ',
        expires_at: new Date(Date.now() + hours * 3_600_000),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
  };

  const code = () => platform.school('alpha').code;

  it('CT-S4-1: chưa có cho phép của trường thì không mở được phiên hỗ trợ; ngoài cổng nền tảng 404', async () => {
    assert.equal(
      (
        await send(context, {
          path: `/auth/platform/schools/${code()}/support`,
          host: platform.school('alpha').host,
          token,
        })
      ).status,
      404,
    );
    const missingReason = await operator('POST', `schools/${code()}/support-sessions`, { reason: '' });
    assert.equal(missingReason.status, 400);
    const refused = await operator('POST', `schools/${code()}/support-sessions`, { reason: 'Kiểm tra lỗi báo cáo' });
    assert.equal(refused.status, 422, JSON.stringify(refused.body));
    const overview = await operator('GET', `schools/${code()}/support`);
    assert.equal(overview.status, 200);
    assert.equal((overview.body as { active_grant: unknown }).active_grant, null);
  });

  it('CT-S4-2: phiên chỉ đọc: đường liên kết một lần đúng trường, chặn ghi, ghi thao tác; trường rút cho phép thì phiên kết thúc', async () => {
    const { id: grantId } = await grant('read');
    const started = await operator('POST', `schools/${code()}/support-sessions`, { reason: 'Kiểm tra lỗi báo cáo' });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const handoff = (started.body as { session_id: string; handoff: { path: string } }).handoff;
    const supportCode = new URL(handoff.path, 'http://x').searchParams.get('code') ?? '';
    assert.ok(supportCode.length > 20);

    // Mã của trường alpha không dùng được ở trường beta
    const wrongSchool = await send(context, {
      path: '/auth/support/exchange',
      host: platform.school('beta').host,
      body: { code: supportCode },
    });
    assert.equal(wrongSchool.status, 401);

    const exchanged = await send(context, {
      path: '/auth/support/exchange',
      host: platform.school('alpha').host,
      body: { code: supportCode },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    const access = (exchanged.body as { access_token: string; support_scope: string }).access_token;
    assert.equal((exchanged.body as { support_scope: string }).support_scope, 'read');
    const cookie = exchanged.cookies.map((item) => item.split(';')[0]).join('; ');
    assert.ok(cookie.includes(code()), 'cookie mã làm mới theo trường');

    // Dùng lại đường liên kết thì bị từ chối
    const reused = await send(context, {
      path: '/auth/support/exchange',
      host: platform.school('alpha').host,
      body: { code: supportCode },
    });
    assert.equal(reused.status, 401);

    const host = platform.school('alpha').host;
    const me = await send(context, { path: '/auth/me', host, token: access });
    assert.equal(me.status, 200);
    const description = me.body as { username: string; support: { scope: string; operator_name: string } | null };
    assert.equal(description.username, SUPPORT_USERNAME);
    assert.equal(description.support?.scope, 'read');
    // Phiên theo cho phép của trường không mang quyền đầy đủ của Admin (YCTD-315)
    assert.equal((description.support as { full_access?: boolean } | null)?.full_access, false);
    assert.equal(description.support?.operator_name, 'Nhân viên hỗ trợ giả');

    // Phiên chỉ đọc: không ghi; phiên hỗ trợ nào cũng không đăng nhập thay
    const write = await send(context, {
      method: 'PUT',
      path: '/auth/me/working-school-level',
      host,
      token: access,
      body: { school_level: null },
    });
    assert.equal(write.status, 403);
    const impersonate = await send(context, {
      path: '/auth/impersonation',
      host,
      token: access,
      body: { user_id: description.username },
    });
    assert.equal(impersonate.status, 403);
    // Tài khoản hỗ trợ không đăng nhập được bằng mật khẩu
    const passwordLogin = await send(context, {
      path: '/auth/login',
      host,
      body: { login: SUPPORT_USERNAME, password: TEST_PASSWORD, channel: 'portal' },
    });
    assert.equal(passwordLogin.status, 401);

    const refreshed = await send(context, { path: '/auth/refresh', host, cookie, body: { channel: 'portal' } });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));

    const audit = await alphaIdentity
      .selectFrom('identity_audit_logs')
      .select('action')
      .where('action', '=', 'support_start')
      .execute();
    assert.equal(audit.length, 1, 'nhật ký của trường ghi bắt đầu phiên hỗ trợ');

    // Trường rút cho phép: phiên hỗ trợ không còn hiệu lực
    await alphaSystem
      .updateTable('support_access_grants')
      .set({ revoked_at: new Date() })
      .where('id', '=', grantId)
      .execute();
    const sessionId = (started.body as { session_id: string }).session_id;
    await runtime.platform
      .updateTable('support_sessions')
      .set({ ended_at: new Date(), end_reason: 'revoked' })
      .where('id', '=', sessionId)
      .execute();
    assert.equal((await send(context, { path: '/auth/me', host, token: access })).status, 401);
    const rotated = refreshed.cookies.map((item) => item.split(';')[0]).join('; ');
    const refreshAfter = await send(context, {
      path: '/auth/refresh',
      host,
      cookie: rotated,
      body: { channel: 'portal' },
    });
    assert.equal(refreshAfter.status, 401);

    const actions = await runtime.platform
      .selectFrom('support_session_actions')
      .select(['method', 'route', 'status'])
      .where('support_session_id', '=', sessionId)
      .execute();
    assert.ok(
      actions.some((action) => action.method === 'PUT' && action.status === 403),
      JSON.stringify(actions),
    );
  });

  it('CT-S4-3: phiên toàn quyền ghi được; người vận hành kết thúc phiên thì thu hồi phiên đăng nhập và ghi nhật ký hai phía', async () => {
    await grant('full');
    const started = await operator('POST', `schools/${code()}/support-sessions`, {
      reason: 'Sửa cấu hình giúp trường',
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const supportCode = new URL(
      (started.body as { handoff: { path: string } }).handoff.path,
      'http://x',
    ).searchParams.get('code');
    const host = platform.school('alpha').host;
    const exchanged = await send(context, { path: '/auth/support/exchange', host, body: { code: supportCode } });
    assert.equal(exchanged.status, 200);
    const access = (exchanged.body as { access_token: string }).access_token;
    const write = await send(context, {
      method: 'PUT',
      path: '/auth/me/working-school-level',
      host,
      token: access,
      body: { school_level: null },
    });
    assert.notEqual(write.status, 403, JSON.stringify(write.body));

    const sessionId = (started.body as { session_id: string }).session_id;
    const ended = await operator('POST', `support-sessions/${sessionId}/end`, {});
    assert.equal(ended.status, 200);
    assert.equal((await send(context, { path: '/auth/me', host, token: access })).status, 401);
    const endAudit = await alphaIdentity
      .selectFrom('identity_audit_logs')
      .select('action')
      .where('action', '=', 'support_end')
      .execute();
    assert.ok(endAudit.length >= 1);
    const platformAudit = await runtime.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'support.%')
      .execute();
    for (const action of ['support.session-requested', 'support.session-started', 'support.session-ended']) {
      assert.ok(
        platformAudit.some((row) => row.action === action),
        action,
      );
    }
    const overview = (await operator('GET', `schools/${code()}/support`)).body as {
      sessions: Array<{ id: string; ended_at: string | null }>;
    };
    assert.ok(overview.sessions.find((session) => session.id === sessionId)?.ended_at);
  });

  it('CT-S4-4: bảng điều khiển đọc số liệu, lỗi, việc định kỳ lỗi và cảnh báo; thông báo bảo trì tạo, kiểm tra, hủy', async () => {
    const alpha = platform.school('alpha');
    await runtime.platform
      .insertInto('school_metrics')
      .values({
        school_id: alpha.schoolId,
        captured_at: new Date(),
        users_total: 12,
        users_active: 10,
        active_students: 120,
        storage_mb: 50,
        database_mb: 30,
        last_login_at: new Date(),
        schema_versions: JSON.stringify({ identity: 'cu' }),
        schema_current: false,
      })
      .execute();
    const bucket = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    await runtime.platform
      .insertInto('school_error_counts')
      .values({
        school_id: alpha.schoolId,
        service: 'api',
        bucket,
        route: '/api/v1/children/:id',
        status: 500,
        count: 25,
        last_code: 'ERR_INTERNAL',
        last_at: new Date(),
      })
      .execute();
    const overview = await operator('GET', 'dashboard');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    const body = overview.body as {
      items: Array<{
        code: string;
        metrics: { users_total: number } | null;
        errors: { last_hour: number };
        alerts: Array<{ kind: string }>;
      }>;
    };
    const row = body.items.find((item) => item.code === alpha.code);
    assert.ok(row);
    assert.equal(row.metrics?.users_total, 12);
    assert.equal(row.errors.last_hour, 25);
    assert.deepEqual(row.alerts.map((alert) => alert.kind).sort(), ['errors', 'schema']);
    const beta = body.items.find((item) => item.code === platform.school('beta').code);
    assert.ok(
      beta?.alerts.some((alert) => alert.kind === 'stale-metrics'),
      'trường chưa có số liệu bị cảnh báo',
    );

    const errors = await operator('GET', `dashboard/errors?school=${alpha.code}&hours=24`);
    assert.equal(errors.status, 200);
    assert.equal((errors.body as { items: unknown[] }).items.length, 1);

    assert.equal((await operator('POST', 'maintenance-notices', {})).status, 403, 'hỗ trợ không tạo thông báo bảo trì');
    const invalid = await technician('POST', 'maintenance-notices', {
      title: '',
      body: 'x',
      starts_at: 'sai',
      ends_at: 'sai',
    });
    assert.equal(invalid.status, 400);
    const unknownSchool = await technician('POST', 'maintenance-notices', {
      title: 'Bảo trì',
      body: 'Nâng cấp máy chủ',
      starts_at: new Date(Date.now() + 3_600_000).toISOString(),
      ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      audience: 'schools',
      school_codes: ['khong-co'],
    });
    assert.equal(unknownSchool.status, 400);
    const created = await technician('POST', 'maintenance-notices', {
      title: 'Bảo trì',
      body: 'Nâng cấp máy chủ',
      severity: 'warning',
      starts_at: new Date(Date.now() + 3_600_000).toISOString(),
      ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      audience: 'schools',
      school_codes: [alpha.code],
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const noticeId = (created.body as { id: string }).id;
    const listed = (await operator('GET', 'maintenance-notices')).body as {
      items: Array<{ id: string; state: string }>;
    };
    assert.equal(listed.items.find((item) => item.id === noticeId)?.state, 'scheduled');
    assert.equal((await technician('POST', `maintenance-notices/${noticeId}/cancel`, {})).status, 200);
    const afterCancel = (await operator('GET', 'maintenance-notices')).body as {
      items: Array<{ id: string; state: string }>;
    };
    assert.equal(afterCancel.items.find((item) => item.id === noticeId)?.state, 'cancelled');
  });

  it('CT-1713: khóa hoặc hạ vai trò nhân viên vận hành thì phiên hỗ trợ đang mở của người đó kết thúc (YCTD-374)', async () => {
    const signIn = async (role: 'quan_tri' | 'ho_tro') => {
      const account = `nv-${role}-${Math.random().toString(36).slice(2, 8)}`;
      const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login: account,
        fullName: 'Nhân viên giả',
        password: OPERATOR_TEST_PASSWORD,
        role,
      });
      const reply = await send(context, {
        path: '/auth/platform/login',
        host: CONSOLE_HOST,
        body: {
          login: account,
          password: OPERATOR_TEST_PASSWORD,
          otp_code: await operatorOtp(platform.platform, created.id, created.secret, context.clock.now()),
        },
      });
      return { id: created.id, token: (reply.body as { access_token: string }).access_token };
    };
    const host = platform.school('alpha').host;
    const openSession = async (staffToken: string) => {
      const started = await send(context, {
        path: `/auth/platform/schools/${code()}/support-sessions`,
        host: CONSOLE_HOST,
        token: staffToken,
        body: { reason: 'Hỗ trợ trường cấu hình' },
      });
      assert.equal(started.status, 200, JSON.stringify(started.body));
      const supportCode = new URL(
        (started.body as { handoff: { path: string } }).handoff.path,
        'http://x',
      ).searchParams.get('code');
      const exchanged = await send(context, { path: '/auth/support/exchange', host, body: { code: supportCode } });
      assert.equal(exchanged.status, 200);
      const access = (exchanged.body as { access_token: string }).access_token;
      assert.equal((await send(context, { path: '/auth/me', host, token: access })).status, 200);
      return { id: (started.body as { session_id: string }).session_id, access };
    };
    const endedAt = async (sessionId: string) =>
      (
        await runtime.platform
          .selectFrom('support_sessions')
          .select('ended_at')
          .where('id', '=', sessionId)
          .executeTakeFirstOrThrow()
      ).ended_at;
    const admin = await signIn('quan_tri');
    const changeOperator = (id: string, body: unknown) =>
      send(context, {
        method: 'PATCH',
        path: `/auth/platform/operators/${id}`,
        host: CONSOLE_HOST,
        token: admin.token,
        body,
      });

    await grant('full');
    // Khóa nhân viên: phiên hỗ trợ kết thúc, phiên đăng nhập ở trường bị thu hồi
    const locked = await signIn('ho_tro');
    const lockedSession = await openSession(locked.token);
    assert.equal((await changeOperator(locked.id, { status: 'locked' })).status, 200);
    assert.ok(await endedAt(lockedSession.id));
    assert.equal((await send(context, { path: '/auth/me', host, token: lockedSession.access })).status, 401);

    // Hạ sang vai trò không được mở phiên hỗ trợ: phiên kết thúc
    const demoted = await signIn('ho_tro');
    const demotedSession = await openSession(demoted.token);
    assert.equal((await changeOperator(demoted.id, { role: 'ke_toan' })).status, 200);
    assert.ok(await endedAt(demotedSession.id));
    assert.equal((await send(context, { path: '/auth/me', host, token: demotedSession.access })).status, 401);

    // Đổi sang vai trò vẫn mở được phiên hỗ trợ: phiên giữ nguyên
    const kept = await signIn('ho_tro');
    const keptSession = await openSession(kept.token);
    assert.equal((await changeOperator(kept.id, { role: 'ky_thuat' })).status, 200);
    assert.equal(await endedAt(keptSession.id), null);
    assert.equal((await send(context, { path: '/auth/me', host, token: keptSession.access })).status, 200);

    // Nhân viên bị khóa trực tiếp trong cơ sở dữ liệu (chưa qua thao tác khóa): phiên không còn dùng được
    await runtime.platform
      .updateTable('platform_operators')
      .set({ status: 'locked' })
      .where('id', '=', kept.id)
      .execute();
    assert.equal((await send(context, { path: '/auth/me', host, token: keptSession.access })).status, 401);
  });
});

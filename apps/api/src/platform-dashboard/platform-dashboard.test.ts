import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createPlatformOperator } from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import { startMultiTenantApi, sendWithHost, type MultiTenantApi } from '../tenant-test-support.js';
import { SchoolMetricsService } from './platform-dashboard.js';

// Bảng điều khiển nền tảng ở máy chủ API (DT-SaaS phần S4, YCTD-197), kịch bản CT-S4-6 đến CT-S4-8: thu số liệu theo trường; quản trị
// của trường bật, rút cho phép hỗ trợ; phiên hỗ trợ chỉ đọc bị chặn ghi và được ghi thao tác; thông báo bảo trì theo trường. Hai
// trường giả, dữ liệu giả
const CONSOLE_HOST = 'platform.e2e.localhost';
const PASSWORD = 'MatKhauGia#2026';

describe('bảng điều khiển nền tảng ở máy chủ API nhiều trường', () => {
  let environment: MultiTenantApi;
  let operatorToken = '';

  before(async () => {
    environment = await startMultiTenantApi({ label: 'dash' });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    const login = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;
    await createPlatformOperator(environment.platform.platform, {
      login,
      fullName: 'Nhân viên hỗ trợ giả',
      password: PASSWORD,
    });
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/platform/login',
      host: CONSOLE_HOST,
      body: { login, password: PASSWORD },
    });
    operatorToken = reply.body.access_token as string;
  });

  after(async () => {
    await environment?.close();
  });

  const call = (name: string, method: string, path: string, body?: unknown, token?: string) =>
    environment.call(name, method, path, body, token);

  it('CT-S4-6: việc định kỳ thu số liệu của trường: tài khoản, phiên bản cấu trúc dữ liệu mới nhất', async () => {
    const tenant = await environment.tenantOf('alpha');
    await runAsSchool(tenant, () => environment.api.get(SchoolMetricsService).capture());
    const row = await environment.platform.platform
      .selectFrom('school_metrics')
      .selectAll()
      .where('school_id', '=', tenant.schoolId)
      .executeTakeFirstOrThrow();
    assert.ok(row.users_total >= 1);
    assert.ok(row.last_login_at, 'đã có lần đăng nhập');
    assert.equal(row.schema_current, true, JSON.stringify(row.schema_versions));
    assert.ok(row.schema_versions.identity && row.schema_versions.system);
  });

  it('CT-S4-7: cho phép hỗ trợ chỉ đọc: phiên hỗ trợ đọc được, ghi bị chặn, thao tác được ghi; rút cho phép thì phiên kết thúc', async () => {
    const empty = await call('alpha', 'GET', '/support-access');
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.equal(empty.body.active_grant, null);
    assert.equal(
      (await call('alpha', 'POST', '/support-access', { scope: 'read', hours: 500, reason: 'x' })).status,
      400,
    );
    const granted = await call('alpha', 'POST', '/support-access', {
      scope: 'read',
      hours: 2,
      reason: 'Nhờ kiểm tra báo cáo',
    });
    assert.equal(granted.status, 200, JSON.stringify(granted.body));
    const grantId = granted.body.id as string;

    const alphaCode = environment.platform.school('alpha').code;
    const started = await sendWithHost(environment.identityOrigin, {
      path: `/api/v1/auth/platform/schools/${alphaCode}/support-sessions`,
      host: CONSOLE_HOST,
      token: operatorToken,
      body: { reason: 'Kiểm tra báo cáo theo yêu cầu' },
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const handoff = (started.body.handoff as { path: string }).path;
    const exchanged = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/support/exchange',
      host: environment.hosts.alpha,
      body: { code: new URL(handoff, 'http://x').searchParams.get('code') },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    const support = exchanged.body.access_token as string;

    assert.equal((await call('alpha', 'GET', '/school-plan', undefined, support)).status, 200);
    const write = await call(
      'alpha',
      'POST',
      '/support-access',
      { scope: 'full', hours: 2, reason: 'Tự cấp quyền' },
      support,
    );
    assert.equal(write.status, 403);
    const notices = await call('alpha', 'GET', '/platform-notices', undefined, support);
    assert.equal((notices.body.support as { operator_name: string }).operator_name, 'Nhân viên hỗ trợ giả');
    const adminNotices = await call('alpha', 'GET', '/platform-notices');
    assert.ok(adminNotices.body.support, 'quản trị của trường thấy phiên hỗ trợ đang mở');

    const overview = await call('alpha', 'GET', '/support-access');
    const sessions = overview.body.sessions as Array<{
      actions: Array<{ service: string; method: string; status: number }>;
    }>;
    assert.equal(sessions.length, 1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const actions = await environment.platform.platform
      .selectFrom('support_session_actions')
      .select(['service', 'method', 'route', 'status'])
      .execute();
    assert.ok(
      actions.some((action) => action.service === 'api' && action.method === 'GET' && action.status === 200),
      JSON.stringify(actions),
    );
    assert.ok(actions.some((action) => action.service === 'api' && action.method === 'POST' && action.status === 403));

    const revoked = await call('alpha', 'POST', `/support-access/${grantId}/revoke`, {});
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    assert.equal(revoked.body.ended_sessions, 1);
    assert.equal((await call('alpha', 'GET', '/school-plan', undefined, support)).status, 401);
    assert.equal((await call('alpha', 'GET', '/support-access')).body.active_grant, null);
    // Trường beta không thấy gì của trường alpha
    const beta = await call('beta', 'GET', '/support-access');
    assert.equal((beta.body.sessions as unknown[]).length, 0);
    assert.equal((beta.body.grants as unknown[]).length, 0);
  });

  it('CT-S4-8: thông báo bảo trì hiện cho đúng trường', async () => {
    const now = Date.now();
    await environment.platform.platform
      .insertInto('maintenance_notices')
      .values({
        title: 'Nâng cấp hệ thống',
        body: 'Hệ thống tạm ngừng 30 phút',
        severity: 'warning',
        starts_at: new Date(now + 3_600_000),
        ends_at: new Date(now + 5_400_000),
        audience: 'schools',
        school_codes: JSON.stringify([environment.platform.school('beta').code]),
        created_by_name: 'Người vận hành giả',
      })
      .execute();
    const beta = await call('beta', 'GET', '/platform-notices');
    assert.equal(beta.status, 200);
    assert.deepEqual(
      (beta.body.maintenance as Array<{ title: string }>).map((item) => item.title),
      ['Nâng cấp hệ thống'],
    );
    const alpha = await call('alpha', 'GET', '/platform-notices');
    assert.deepEqual(alpha.body.maintenance, []);
  });
});

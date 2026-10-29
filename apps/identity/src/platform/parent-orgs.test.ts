import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenancyRuntime, type TenantTestPlatform } from '@school-management/database';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp, totpCode } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Đơn vị cấp trên ở dịch vụ định danh (DT-SaaS phần S6, YCTD-202), kịch bản CT-S6-3 đến CT-S6-5: cây đơn vị, gắn trường, tài khoản
// cấp trên có xác thực hai lớp bắt buộc, phạm vi cây con, đề nghị xem chi tiết đi qua phiên hỗ trợ chỉ đọc khi trường đã duyệt. Dữ
// liệu giả
interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const CONSOLE_HOST = 'platform.e2e.localhost';

function send(
  context: TenantTestContext,
  options: { method?: string; path: string; host: string; body?: unknown; token?: string },
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
          host: options.host,
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
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
    if (payload) request.write(payload);
    request.end();
  });
}

describe('đơn vị cấp trên ở dịch vụ định danh', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let operatorToken = '';
  const units: Record<string, string> = {};
  let secret = '';
  let parentToken = '';

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'porgid' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const login = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login,
      fullName: 'Người vận hành giả',
      password: OPERATOR_TEST_PASSWORD,
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
    operatorToken = reply.body.access_token as string;
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
      token: operatorToken,
      ...(body !== undefined ? { body } : {}),
    });

  it('CT-S6-3: cây đơn vị: thêm đúng cấp, sai cấp bị từ chối, nạp mặc định, gộp, gắn trường; ngoài cổng nền tảng 404', async () => {
    assert.equal(
      (
        await send(context, {
          path: '/auth/platform/admin-units',
          host: platform.school('alpha').host,
          token: operatorToken,
        })
      ).status,
      404,
    );
    const ministry = await operator('POST', 'admin-units', { level: 'ministry', code: 'bo-thu', name: 'Bộ giả' });
    assert.equal(ministry.status, 200, JSON.stringify(ministry.body));
    units.ministry = ministry.body.id as string;
    const wrong = await operator('POST', 'admin-units', {
      level: 'commune',
      code: 'sai',
      name: 'Sai cấp',
      parent_id: units.ministry,
    });
    assert.equal(wrong.status, 400);
    const department = await operator('POST', 'admin-units', {
      level: 'department',
      code: 'so-thu',
      name: 'Sở giả',
      parent_id: units.ministry,
    });
    units.department = department.body.id as string;
    for (const code of ['phong-a', 'phong-b', 'phong-c']) {
      const created = await operator('POST', 'admin-units', {
        level: 'commune',
        code,
        name: `Phòng ${code}`,
        parent_id: units.department,
      });
      units[code] = created.body.id as string;
    }
    const imported = await operator('POST', 'admin-units/import', { preset: 'default' });
    assert.equal(imported.status, 200);
    assert.equal(imported.body.created, 170);
    assert.equal(
      (await operator('POST', 'admin-units/import', { preset: 'default' })).body.created,
      0,
      'nạp lại không trùng',
    );

    await operator('PUT', `schools/${platform.school('alpha').code}/admin-unit`, { admin_unit_id: units['phong-c'] });
    await operator('PUT', `schools/${platform.school('beta').code}/admin-unit`, { admin_unit_id: units['phong-b'] });
    const merged = await operator('POST', `admin-units/${units['phong-c']}/merge`, { into_id: units['phong-a'] });
    assert.equal(merged.status, 200, JSON.stringify(merged.body));
    const alpha = await platform.platform
      .selectFrom('schools')
      .select('admin_unit_id')
      .where('id', '=', platform.school('alpha').schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(alpha.admin_unit_id, units['phong-a'], 'trường đi theo nút nhận khi gộp');
    const overview = await operator('GET', 'admin-units');
    const mergedUnit = (overview.body.units as Array<{ id: string; status: string }>).find(
      (unit) => unit.id === units['phong-c'],
    );
    assert.equal(mergedUnit?.status, 'merged');
  });

  it('CT-S6-4: tài khoản cấp trên: xác thực hai lớp bắt buộc; phạm vi là cây con; đăng nhập ở tên miền trường 404', async () => {
    const created = await operator('POST', 'parent-org-users', {
      login: 'phong-a-gia',
      full_name: 'Chuyên viên Phòng A giả',
      password: OPERATOR_TEST_PASSWORD,
      admin_unit_id: units['phong-a'],
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    secret = (created.body.totp as { secret: string }).secret;
    assert.ok((created.body.totp as { recovery_codes: string[] }).recovery_codes.length >= 8);
    const weak = await operator('POST', 'parent-org-users', {
      login: 'yeu',
      full_name: 'Mật khẩu yếu',
      password: 'ngan',
      admin_unit_id: units['phong-a'],
    });
    assert.equal(weak.status, 400);

    const body = { login: 'phong-a-gia', password: OPERATOR_TEST_PASSWORD };
    assert.equal(
      (await send(context, { path: '/auth/parent-org/login', host: platform.school('alpha').host, body })).status,
      404,
    );
    const missing = await send(context, { path: '/auth/parent-org/login', host: CONSOLE_HOST, body });
    assert.equal(missing.status, 401);
    const wrongCode = await send(context, {
      path: '/auth/parent-org/login',
      host: CONSOLE_HOST,
      body: { ...body, otp_code: '000000' },
    });
    assert.equal(wrongCode.status, 401);
    const ok = await send(context, {
      path: '/auth/parent-org/login',
      host: CONSOLE_HOST,
      body: { ...body, otp_code: totpCode(secret, context.clock.now()) },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    parentToken = ok.body.access_token as string;
    const me = await send(context, { path: '/auth/parent-org/me', host: CONSOLE_HOST, token: parentToken });
    assert.equal(me.status, 200);
    const schools = (me.body.schools as Array<{ code: string }>).map((school) => school.code);
    assert.deepEqual(schools, [platform.school('alpha').code], 'beta thuộc Phòng B, ngoài phạm vi');
    // Mã phiên vận hành không dùng được như mã phiên cấp trên và ngược lại
    assert.equal(
      (await send(context, { path: '/auth/parent-org/me', host: CONSOLE_HOST, token: operatorToken })).status,
      401,
    );
    assert.equal(
      (await send(context, { path: '/auth/platform/admin-units', host: CONSOLE_HOST, token: parentToken })).status,
      401,
    );
  });

  it('CT-S6-5: đề nghị xem chi tiết: ngoài phạm vi 403; chưa duyệt không mở được; đã duyệt mở phiên chỉ đọc ở trường; rút thì hết', async () => {
    const outside = await send(context, {
      path: '/auth/parent-org/access-requests',
      host: CONSOLE_HOST,
      token: parentToken,
      body: { school_code: platform.school('beta').code, categories: ['scale'], reason: 'Kiểm tra số liệu', hours: 2 },
    });
    assert.equal(outside.status, 403);
    const created = await send(context, {
      path: '/auth/parent-org/access-requests',
      host: CONSOLE_HOST,
      token: parentToken,
      body: {
        school_code: platform.school('alpha').code,
        categories: ['scale', 'staff'],
        reason: 'Kiểm tra số liệu',
        hours: 2,
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const requestId = created.body.id as string;
    const early = await send(context, {
      path: `/auth/parent-org/access-requests/${requestId}/open`,
      host: CONSOLE_HOST,
      token: parentToken,
      body: {},
    });
    assert.equal(early.status, 422);

    // Trường duyệt (ở máy chủ API); ở đây ghi thẳng như kết quả duyệt
    await platform.platform
      .updateTable('parent_org_access_requests')
      .set({
        status: 'approved',
        decided_at: new Date(),
        decided_by_name: 'Quản trị giả',
        expires_at: new Date(Date.now() + 2 * 3_600_000),
      })
      .where('id', '=', requestId)
      .execute();
    const opened = await send(context, {
      path: `/auth/parent-org/access-requests/${requestId}/open`,
      host: CONSOLE_HOST,
      token: parentToken,
      body: {},
    });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const code = new URL((opened.body.handoff as { path: string }).path, 'http://x').searchParams.get('code');
    const exchanged = await send(context, {
      path: '/auth/support/exchange',
      host: platform.school('alpha').host,
      body: { code },
    });
    assert.equal(exchanged.status, 200, JSON.stringify(exchanged.body));
    assert.equal(exchanged.body.support_scope, 'read');
    const access = exchanged.body.access_token as string;
    const me = await send(context, { path: '/auth/me', host: platform.school('alpha').host, token: access });
    assert.equal(me.status, 200);
    assert.match(
      (me.body.support as { operator_name: string }).operator_name,
      /Chuyên viên Phòng A giả \(Phòng phong-a\)/,
    );
    const session = await platform.platform
      .selectFrom('support_sessions')
      .select(['requester_kind', 'grant_id', 'access_request_id'])
      .where('access_request_id', '=', requestId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(session, { requester_kind: 'parent_org', grant_id: null, access_request_id: requestId });

    await platform.platform
      .updateTable('parent_org_access_requests')
      .set({ status: 'revoked', revoked_at: new Date() })
      .where('id', '=', requestId)
      .execute();
    const again = await send(context, {
      path: `/auth/parent-org/access-requests/${requestId}/open`,
      host: CONSOLE_HOST,
      token: parentToken,
      body: {},
    });
    assert.equal(again.status, 422);
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'parent-org.%')
      .execute();
    for (const action of ['parent-org.login', 'parent-org.access-requested', 'parent-org.detail-session-requested']) {
      assert.ok(
        audit.some((row) => row.action === action),
        action,
      );
    }

    // Khóa tài khoản cấp trên: phiên xem chi tiết đang mở kết thúc (CT-1713, YCTD-377)
    assert.equal(
      (await send(context, { path: '/auth/me', host: platform.school('alpha').host, token: access })).status,
      200,
    );
    const parentUser = await platform.platform
      .selectFrom('parent_org_users')
      .select('id')
      .where('login', '=', 'phong-a-gia')
      .executeTakeFirstOrThrow();
    assert.equal(
      (await operator('POST', `parent-org-users/${parentUser.id}/status`, { status: 'locked' })).status,
      200,
    );
    assert.equal(
      (await send(context, { path: '/auth/me', host: platform.school('alpha').host, token: access })).status,
      401,
    );
    const ended = await platform.platform
      .selectFrom('support_sessions')
      .select('ended_at')
      .where('access_request_id', '=', requestId)
      .executeTakeFirstOrThrow();
    assert.ok(ended.ended_at);
  });
});

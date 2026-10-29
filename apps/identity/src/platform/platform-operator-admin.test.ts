import assert from 'node:assert/strict';
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenancyRuntime, type TenantTestPlatform } from '@school-management/database';
import { totpCode } from '@school-management/server';
import { OPERATOR_ROLES, operatorCan, type OperatorCapability, type OperatorRole } from '@school-management/shared';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Nhân viên vận hành của công ty (YCTD-311, CT-1521): quản trị tạo, phân vai, khóa; xác thực hai lớp bắt buộc; kế toán không mở phiên hỗ trợ.
// YCTD-323: đổi mật khẩu tạm (CT-1521), bảng quyền theo từng điểm cuối (CT-1525)
const CONSOLE_HOST = 'platform.e2e.localhost';

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

function send(
  context: TenantTestContext,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${path}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          host: CONSOLE_HOST,
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
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

describe('nhân viên vận hành nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let adminId: string;
  let adminSecret: string;
  let adminToken: string;
  const adminLogin = `quan-tri-${Math.random().toString(36).slice(2, 8)}`;

  const adminOtp = () => operatorOtp(platform.platform, adminId, adminSecret, context.clock.now());

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'opa' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login: adminLogin,
      fullName: 'Quản trị giả',
      password: OPERATOR_TEST_PASSWORD,
    });
    adminId = created.id;
    adminSecret = created.secret;
    const reply = await send(context, 'POST', '/auth/platform/login', undefined, {
      login: adminLogin,
      password: OPERATOR_TEST_PASSWORD,
      otp_code: await adminOtp(),
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    adminToken = reply.body.access_token as string;
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  it('CT-1521: quản trị tạo nhân viên theo số CCCD kèm khóa hai lớp; nhân viên đăng nhập được, đúng vai trò, không quản lý nhân viên; khóa thì không vào được', async () => {
    const nationalId = `001090${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
    const wrongLogin = await send(context, 'POST', '/auth/platform/operators', adminToken, {
      login: 'nhan-vien',
      full_name: 'Sai tên',
      role: 'ho_tro',
      otp_code: await adminOtp(),
    });
    assert.equal(wrongLogin.status, 400);
    const noOtp = await send(context, 'POST', '/auth/platform/operators', adminToken, {
      login: nationalId,
      full_name: 'Nhân viên kế toán',
      role: 'ke_toan',
    });
    assert.equal(noOtp.status, 401);

    const created = await send(context, 'POST', '/auth/platform/operators', adminToken, {
      login: nationalId,
      full_name: 'Nhân viên kế toán',
      role: 'ke_toan',
      otp_code: await adminOtp(),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const staffId = created.body.id as string;
    const password = created.body.temporary_password as string;
    assert.ok(password.length >= 12);
    assert.equal((created.body.recovery_codes as string[]).length > 0, true);

    const list = await send(context, 'GET', '/auth/platform/operators', adminToken);
    assert.equal(list.status, 200);
    const row = (list.body.items as Array<{ id: string; login: string; role: string; totp_enrolled: boolean }>).find(
      (item) => item.id === staffId,
    );
    assert.deepEqual(
      { login: row?.login, role: row?.role, totp: row?.totp_enrolled },
      { login: `********${nationalId.slice(-4)}`, role: 'ke_toan', totp: true },
    );

    const staffReply = await send(context, 'POST', '/auth/platform/login', undefined, {
      login: nationalId,
      password,
      otp_code: totpCode(created.body.totp_secret as string, context.clock.now()),
    });
    assert.equal(staffReply.status, 200, JSON.stringify(staffReply.body));
    const staffToken = staffReply.body.access_token as string;
    const me = await send(context, 'GET', '/auth/platform/me', staffToken);
    assert.equal(me.body.role, 'ke_toan');

    // Mật khẩu tạm phải đổi trước khi dùng cổng (YCTD-323, T-P1): đổi cần mã hai lớp, mật khẩu mới từ 12 ký tự, có nhật ký
    assert.equal(me.body.must_change_password, true);
    assert.equal((await send(context, 'GET', '/auth/platform/schools', staffToken)).status, 403);
    const staffOtp = () =>
      operatorOtp(platform.platform, staffId, created.body.totp_secret as string, context.clock.now());
    const changePassword = (body: Record<string, unknown>) =>
      send(context, 'POST', '/auth/platform/password', staffToken, { current_password: password, ...body });
    assert.equal((await changePassword({ new_password: 'MatKhauRieng2027' })).status, 401, 'thiếu mã hai lớp');
    assert.equal(
      (await changePassword({ new_password: 'Ngan2027', otp_code: await staffOtp() })).status,
      400,
      'ngắn hơn 12 ký tự',
    );
    assert.equal(
      (
        await send(context, 'POST', '/auth/platform/password', staffToken, {
          current_password: 'SaiMatKhau2027',
          new_password: 'MatKhauRieng2027',
          otp_code: await staffOtp(),
        })
      ).status,
      400,
      'sai mật khẩu hiện tại',
    );
    const changed = await changePassword({ new_password: 'MatKhauRieng2027', otp_code: await staffOtp() });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((await send(context, 'GET', '/auth/platform/me', staffToken)).body.must_change_password, false);
    assert.equal((await send(context, 'GET', '/auth/platform/schools', staffToken)).status, 200);
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('actor_id', '=', staffId)
      .execute();
    assert.ok(audit.some((entry) => entry.action === 'operator.password-change'));
    assert.ok(audit.some((entry) => entry.action === 'operator.password-change-failed'));
    assert.equal((await send(context, 'GET', '/auth/platform/operators', staffToken)).status, 403);
    // Kế toán không mở phiên hỗ trợ vào dữ liệu trường
    const support = await send(
      context,
      'POST',
      `/auth/platform/schools/${platform.school('alpha').code}/support-sessions`,
      staffToken,
      {
        reason: 'Thử',
      },
    );
    assert.equal(support.status, 403);

    assert.equal(
      (await send(context, 'PATCH', `/auth/platform/operators/${adminId}`, adminToken, { status: 'locked' })).status,
      403,
    );
    const locked = await send(context, 'PATCH', `/auth/platform/operators/${staffId}`, adminToken, {
      status: 'locked',
    });
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    assert.equal((await send(context, 'GET', '/auth/platform/me', staffToken)).status, 401);
  });

  // Mọi điểm cuối của cổng vận hành ở dịch vụ định danh và việc nó cần (YCTD-323). Mã trường, mã bản ghi không có nên vai trò được phép
  // nhận 400 hoặc 404 (không đổi dữ liệu thật), vai trò không được phép nhận 403 với lời báo về vai trò
  const NO_SCHOOL = 'khong-co-truong';
  const NO_ID = '00000000-0000-4000-8000-000000000000';
  const ENDPOINTS: Array<[string, string, OperatorCapability, unknown?]> = [
    ['GET', '/auth/platform/schools', 'schools.view'],
    ['GET', '/auth/platform/schools/settings', 'schools.view'],
    ['GET', `/auth/platform/schools/${NO_SCHOOL}`, 'schools.view'],
    ['POST', '/auth/platform/schools', 'schools.provision', {}],
    ['PUT', `/auth/platform/schools/${NO_SCHOOL}/addon-modules`, 'schools.addons', { modules: [] }],
    ['POST', `/auth/platform/schools/jobs/${NO_ID}/resume`, 'schools.provision', {}],
    ['POST', `/auth/platform/schools/jobs/${NO_ID}/rollback`, 'schools.provision', {}],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/suspend`, 'schools.lifecycle', { reason: 'Thử' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/resume`, 'schools.lifecycle', { reason: 'Thử' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/request-deletion`, 'schools.lifecycle', { reason: 'Thử' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/cancel-deletion`, 'schools.lifecycle', { reason: 'Thử' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/invitation`, 'schools.invitation', {}],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/consents`, 'schools.data-governance', {}],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/hosting`, 'schools.data-governance', {}],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/data-class`, 'schools.data-governance', { data_class: 'consented' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/domains`, 'schools.domains', { host: '' }],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/domains/a.example/verify`, 'schools.domains', {}],
    ['GET', '/auth/platform/admin-units', 'parent-orgs.view'],
    ['POST', '/auth/platform/admin-units', 'parent-orgs.manage', {}],
    ['POST', '/auth/platform/admin-units/import', 'parent-orgs.manage', {}],
    ['PUT', `/auth/platform/admin-units/${NO_ID}`, 'parent-orgs.manage', {}],
    ['POST', `/auth/platform/admin-units/${NO_ID}/merge`, 'parent-orgs.manage', {}],
    ['POST', `/auth/platform/admin-units/${NO_ID}/split`, 'parent-orgs.manage', {}],
    ['PUT', `/auth/platform/schools/${NO_SCHOOL}/admin-unit`, 'parent-orgs.manage', {}],
    ['POST', '/auth/platform/parent-org-users', 'parent-orgs.manage', {}],
    ['POST', `/auth/platform/parent-org-users/${NO_ID}/totp`, 'parent-orgs.manage', {}],
    ['POST', `/auth/platform/parent-org-users/${NO_ID}/status`, 'parent-orgs.manage', {}],
    ['GET', '/auth/platform/catalog', 'catalog.view'],
    ['GET', '/auth/platform/catalog/units', 'catalog.view'],
    ['GET', '/auth/platform/catalog/unit?code=khong-co', 'catalog.view'],
    ['POST', '/auth/platform/catalog/import', 'catalog.manage', {}],
    ['PUT', `/auth/platform/schools/${NO_SCHOOL}/catalog-unit`, 'catalog.manage', {}],
    ['GET', '/auth/platform/login-page', 'catalog.view'],
    ['PUT', '/auth/platform/login-page', 'catalog.manage', { hotline: 'x'.repeat(500) }],
    ['GET', '/auth/platform/dashboard', 'overview.view'],
    ['GET', '/auth/platform/dashboard/errors', 'dashboard.errors'],
    // Nhật ký truy cập, số liệu Tổng quan (YCTD-324)
    ['GET', '/auth/platform/audit-log', 'audit.view'],
    ['GET', '/auth/platform/overview', 'overview.view'],
    ['GET', '/auth/platform/maintenance-notices', 'maintenance.view'],
    ['POST', '/auth/platform/maintenance-notices', 'maintenance.manage', {}],
    ['POST', `/auth/platform/maintenance-notices/${NO_ID}/cancel`, 'maintenance.manage', {}],
    ['GET', `/auth/platform/schools/${NO_SCHOOL}/support`, 'support.view'],
    ['POST', `/auth/platform/schools/${NO_SCHOOL}/support-sessions`, 'support.open', {}],
    ['GET', '/auth/platform/support-policy', 'support.view'],
    ['PUT', '/auth/platform/support-policy', 'support.policy', { mode: 'khong-co' }],
    ['POST', `/auth/platform/support-sessions/${NO_ID}/end`, 'support.open', {}],
    ['GET', '/auth/platform/plan-modules', 'plans.view'],
    ['GET', '/auth/platform/plans', 'plans.view'],
    ['POST', '/auth/platform/plans', 'plans.manage', {}],
    ['PUT', `/auth/platform/plans/${NO_ID}`, 'plans.manage', {}],
    ['GET', '/auth/platform/plan-schools', 'plans.view'],
    ['PUT', `/auth/platform/plan-schools/${NO_ID}`, 'plans.manage', {}],
    ['GET', '/auth/platform/ai', 'ai.view'],
    ['PUT', '/auth/platform/ai/settings', 'ai.settings', { enabled: 'khong' }],
    ['PUT', '/auth/platform/ai/key', 'ai.settings', {}],
    ['PUT', `/auth/platform/ai/pricing/${NO_ID}`, 'ai.pricing', {}],
    ['GET', '/auth/platform/ai/usage', 'ai.view'],
    ['GET', '/auth/platform/billing', 'billing.view'],
    ['PUT', '/auth/platform/billing/settings', 'billing.manage', { invoice_prefix: '' }],
    ['PUT', '/auth/platform/billing/connectors/khong-co', 'billing.connectors', {}],
    ['GET', '/auth/platform/billing/price-rules', 'billing.view'],
    ['POST', '/auth/platform/billing/price-rules', 'billing.manage', {}],
    ['PUT', `/auth/platform/billing/price-rules/${NO_ID}`, 'billing.manage', {}],
    ['GET', '/auth/platform/billing/invoices', 'billing.view'],
    ['POST', '/auth/platform/billing/invoices', 'billing.manage', {}],
    ['GET', `/auth/platform/billing/invoices/${NO_ID}`, 'billing.view'],
    ['POST', `/auth/platform/billing/invoices/${NO_ID}/void`, 'billing.manage', {}],
    ['POST', `/auth/platform/billing/payments/${NO_ID}/assign`, 'billing.manage', {}],
    ['POST', `/auth/platform/billing/schools/${NO_ID}/free-period`, 'billing.manage', {}],
    ['GET', '/auth/platform/operators', 'operators.manage'],
    ['POST', '/auth/platform/operators', 'operators.manage', {}],
    ['PATCH', `/auth/platform/operators/${NO_ID}`, 'operators.manage', {}],
    ['POST', `/auth/platform/operators/${NO_ID}/totp-reset`, 'operators.manage', {}],
  ];

  it('CT-1525: mỗi điểm cuối của cổng vận hành chỉ cho đúng vai trò theo bảng quyền (YCTD-323)', async () => {
    const tokens = {} as Record<OperatorRole, string>;
    for (const role of OPERATOR_ROLES) {
      const login = `vai-tro-${role.replace('_', '-')}-${Math.random().toString(36).slice(2, 8)}`;
      const operator = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
        login,
        fullName: `Nhân viên ${role}`,
        password: OPERATOR_TEST_PASSWORD,
        role,
      });
      const reply = await send(context, 'POST', '/auth/platform/login', undefined, {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, operator.id, operator.secret, context.clock.now()),
      });
      assert.equal(reply.status, 200, JSON.stringify(reply.body));
      tokens[role] = reply.body.access_token as string;
    }
    const problems: string[] = [];
    for (const [method, path, capability, body] of ENDPOINTS) {
      for (const role of OPERATOR_ROLES) {
        const reply = await send(context, method, path, tokens[role], body);
        const roleDenied =
          reply.status === 403 && JSON.stringify(reply.body).includes('Vai trò vận hành của bạn không được làm');
        if (roleDenied === operatorCan(role, capability)) {
          problems.push(`${method} ${path} ${role}: ${reply.status} ${JSON.stringify(reply.body).slice(0, 120)}`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });
});

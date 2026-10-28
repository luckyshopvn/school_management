import assert from 'node:assert/strict';
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenancyRuntime, type TenantTestPlatform } from '@school-management/database';
import { totpCode } from '@school-management/server';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Nhân viên vận hành của công ty (YCTD-311, CT-1521): quản trị tạo, phân vai, khóa; xác thực hai lớp bắt buộc; kế toán không mở phiên hỗ trợ
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
});

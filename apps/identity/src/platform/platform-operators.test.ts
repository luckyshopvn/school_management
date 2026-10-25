import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startTenantTestPlatform,
  type IdentityDatabase,
  type TenancyRuntime,
  type TenantTestPlatform,
} from '@school-management/database';
import { createTestUser, startTenantTestApplication, TEST_PASSWORD, type TenantTestContext } from '../test-support.js';
import { generateRecoveryCodes, totpCode } from '@school-management/server';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperator, createPlatformOperatorWithTotp } from './platform-operators.js';

// Đăng nhập vận hành nền tảng (DT-SaaS phần S1a): chỉ ở tên miền của cổng nền tảng, tách hẳn đăng nhập của trường

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

function send(
  context: TenantTestContext,
  options: { path: string; host?: string; body?: unknown; token?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: payload ? 'POST' : 'GET',
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

describe('đăng nhập vận hành nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  const login = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;
  let operatorId: string;
  let totpSecret: string;
  let recoveryCodes: string[];

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha'], label: 'op' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login,
      fullName: 'Người vận hành giả',
      password: OPERATOR_TEST_PASSWORD,
    });
    operatorId = created.id;
    totpSecret = created.secret;
    recoveryCodes = created.recoveryCodes;
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const operatorLogin = async (host: string | undefined, password = OPERATOR_TEST_PASSWORD, otp?: string | null) =>
    send(context, {
      path: '/auth/platform/login',
      host,
      body: {
        login,
        password,
        ...(otp === null
          ? {}
          : { otp_code: otp ?? (await operatorOtp(platform.platform, operatorId, totpSecret, context.clock.now())) }),
      },
    });

  it('chưa đặt tên miền cổng nền tảng thì tắt: 404', async () => {
    assert.equal((await operatorLogin(CONSOLE_HOST)).status, 404);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
  });

  it('chỉ phục vụ ở tên miền của cổng nền tảng, không ở tên miền của trường hay tên miền lạ', async () => {
    assert.equal((await operatorLogin(platform.school('alpha').host)).status, 404);
    assert.equal((await operatorLogin('la.e2e.localhost')).status, 404);
    assert.equal((await operatorLogin(undefined)).status, 404);
  });

  it('đăng nhập đúng, đọc thông tin kèm số trường', async () => {
    const reply = await operatorLogin(CONSOLE_HOST);
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    const token = reply.body.access_token as string;
    const me = await send(context, { path: '/auth/platform/me', host: CONSOLE_HOST, token });
    assert.equal(me.status, 200);
    assert.equal(me.body.login, login);
    assert.ok(Number(me.body.school_count) >= 1);
    assert.equal((await send(context, { path: '/auth/platform/me', host: CONSOLE_HOST })).status, 401);
  });

  it('mã phiên vận hành không dùng được ở trường, mã phiên của trường không dùng được ở cổng nền tảng', async () => {
    const operatorToken = (await operatorLogin(CONSOLE_HOST)).body.access_token as string;
    assert.equal(
      (await send(context, { path: '/auth/me', host: platform.school('alpha').host, token: operatorToken })).status,
      401,
    );

    const tenant = await runtime.registry.resolveHost(platform.school('alpha').host);
    assert.ok(tenant);
    const database = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const user = await createTestUser(database);
    const schoolLogin = await send(context, {
      path: '/auth/login',
      host: platform.school('alpha').host,
      body: { login: user.username, password: TEST_PASSWORD, channel: 'portal' },
    });
    assert.equal(schoolLogin.status, 200);
    const schoolToken = schoolLogin.body.access_token as string;
    assert.equal(
      (await send(context, { path: '/auth/platform/me', host: CONSOLE_HOST, token: schoolToken })).status,
      401,
    );
  });

  it('tài khoản của trường không đăng nhập được ở cổng nền tảng và ngược lại', async () => {
    const tenant = await runtime.registry.resolveHost(platform.school('alpha').host);
    assert.ok(tenant);
    const database = runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const user = await createTestUser(database);
    const asOperator = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: { login: user.username, password: TEST_PASSWORD },
    });
    assert.equal(asOperator.status, 401);
    const asSchool = await send(context, {
      path: '/auth/login',
      host: platform.school('alpha').host,
      body: { login, password: TEST_PASSWORD, channel: 'portal' },
    });
    assert.equal(asSchool.status, 401);
  });

  it('sai mật khẩu năm lần thì khóa tạm, mở lại sau thời gian khóa, ghi nhật ký nền tảng', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await operatorLogin(CONSOLE_HOST, 'sai-mat-khau-1')).status, 401);
    }
    assert.equal((await operatorLogin(CONSOLE_HOST)).status, 401);
    context.clock.advanceMinutes(16);
    assert.equal((await operatorLogin(CONSOLE_HOST)).status, 200);
    const actions = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'operator.%')
      .execute();
    const names = new Set(actions.map((row) => row.action));
    for (const expected of ['operator.create', 'operator.login', 'operator.login-failed', 'operator.login-locked']) {
      assert.ok(names.has(expected), expected);
    }
  });

  it('tạo tài khoản: trùng tên đăng nhập và mật khẩu yếu bị từ chối', async () => {
    await assert.rejects(
      createPlatformOperator(platform.platform, { login, fullName: 'X', password: OPERATOR_TEST_PASSWORD }),
      /đã tồn tại/,
    );
    await assert.rejects(
      createPlatformOperator(platform.platform, { login: 'khac-ten', fullName: 'X', password: 'ngan' }),
      /Mật khẩu/,
    );
    // Mật khẩu vận hành tối thiểu 12 ký tự (chặt hơn mặc định 8 của trường)
    await assert.rejects(
      createPlatformOperator(platform.platform, { login: 'khac-ten', fullName: 'X', password: TEST_PASSWORD }),
      /ít nhất 12 ký tự/,
    );
  });

  describe('xác thực hai lớp bắt buộc (DT-SaaS phần S8b)', () => {
    it('đúng mật khẩu nhưng thiếu mã: 401 yêu cầu mã, chưa tính là lần nhập sai', async () => {
      const reply = await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, null);
      assert.equal(reply.status, 401);
      const details = (reply.body.error as { details: Array<{ field: string }> }).details;
      assert.ok(details.some((detail) => detail.field === 'otp_code'));
      const row = await platform.platform
        .selectFrom('platform_operators')
        .select('failed_login_count')
        .where('id', '=', operatorId)
        .executeTakeFirstOrThrow();
      assert.equal(row.failed_login_count, 0);
    });

    it('mã sai bị từ chối; mã đúng dùng lại trong cùng bước thời gian cũng bị từ chối', async () => {
      assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, '000000')).status, 401);
      await operatorOtp(platform.platform, operatorId, totpSecret, context.clock.now());
      const code = totpCode(totpSecret, context.clock.now());
      assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, code)).status, 200);
      assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, code)).status, 401);
      await platform.platform
        .updateTable('platform_operators')
        .set({ failed_login_count: 0 })
        .where('id', '=', operatorId)
        .execute();
    });

    it('mã khôi phục dùng được một lần', async () => {
      const code = recoveryCodes[0] as string;
      assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, code)).status, 200);
      assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, code)).status, 401);
      assert.equal(
        (await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, generateRecoveryCodes(1)[0])).status,
        401,
      );
      await platform.platform
        .updateTable('platform_operators')
        .set({ failed_login_count: 0 })
        .where('id', '=', operatorId)
        .execute();
    });

    it('khóa tạm thời sau 5 lần mã sai', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await operatorLogin(CONSOLE_HOST, OPERATOR_TEST_PASSWORD, '111111')).status, 401);
      }
      assert.equal((await operatorLogin(CONSOLE_HOST)).status, 401);
      await platform.platform
        .updateTable('platform_operators')
        .set({ locked_until: null, failed_login_count: 0 })
        .where('id', '=', operatorId)
        .execute();
      assert.equal((await operatorLogin(CONSOLE_HOST)).status, 200);
    });

    it('tài khoản chưa đăng ký xác thực hai lớp không đăng nhập được', async () => {
      const bare = `khong-totp-${Math.random().toString(36).slice(2, 8)}`;
      await createPlatformOperator(platform.platform, {
        login: bare,
        fullName: 'Chưa có TOTP',
        password: OPERATOR_TEST_PASSWORD,
      });
      const reply = await send(context, {
        path: '/auth/platform/login',
        host: CONSOLE_HOST,
        body: {
          login: bare,
          password: OPERATOR_TEST_PASSWORD,
          otp_code: totpCode('JBSWY3DPEHPK3PXP', context.clock.now()),
        },
      });
      assert.equal(reply.status, 401);
      assert.match(JSON.stringify(reply.body), /xác thực hai lớp/);
    });

    it('khóa TOTP lưu mã hóa bằng khóa gốc, không có bản rõ ở cơ sở dữ liệu', async () => {
      const row = await platform.platform
        .selectFrom('platform_operator_totp')
        .select('secret_encrypted')
        .where('operator_id', '=', operatorId)
        .executeTakeFirstOrThrow();
      assert.ok(!row.secret_encrypted.includes(totpSecret));
      const hashes = await platform.platform
        .selectFrom('platform_operator_recovery_codes')
        .select('code_hash')
        .where('operator_id', '=', operatorId)
        .execute();
      assert.ok(hashes.every((entry) => !recoveryCodes.some((code) => entry.code_hash.includes(code))));
    });
  });
});

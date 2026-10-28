import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { totpCode } from '@school-management/server';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  solvedCaptcha,
  startTestApplication,
  TEST_PASSWORD,
  type TestContext,
  type TestUser,
} from '../test-support.js';

// Xác thực hai lớp tuỳ chọn theo trường và chính sách mật khẩu theo trường (DT-SaaS phần S8b, YCTD-201; tài liệu 32 mục 14.5, GD-97).
// Mặc định tắt cả trường nên đăng nhập hiện có không đổi; trường bật thì người dùng tự đăng ký bằng ứng dụng xác thực
const POLICY_KEYS = ['totp_enabled', 'password_min_length', 'login_max_failed_attempts', 'login_lock_minutes'];

async function putJson(url: string, accessToken: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

describe('Dịch vụ định danh: xác thực hai lớp tuỳ chọn và chính sách mật khẩu theo trường', () => {
  let context: TestContext;
  let principalToken: string;
  let user: TestUser;

  const login = (target: TestUser, otp?: string, password = target.password, channel = 'portal') =>
    postJson(`${context.baseUrl}/auth/login`, {
      login: target.username,
      password,
      channel,
      ...(otp === undefined ? {} : { otp_code: otp }),
    });
  const settingsUrl = () => `${context.baseUrl}/auth/settings`;
  const policyUrl = () => `${context.baseUrl}/auth/settings/password-policy`;
  const code = () => totpCode(secret, context.clock.now());
  let secret = '';
  let recoveryCodes: string[] = [];

  before(async () => {
    context = await startTestApplication();
    await context.database.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    principalToken = (await login(principal)).body.access_token as string;
    user = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
  });

  after(async () => {
    await context.database.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
    await context.close();
  });

  it('mặc định tắt: không đăng ký được, đăng nhập như cũ', async () => {
    const token = (await login(user)).body.access_token as string;
    const status = await getJson(`${context.baseUrl}/auth/totp`, token);
    assert.equal(status.status, 200);
    assert.equal(status.body.feature_enabled, false);
    const setup = await postJson(`${context.baseUrl}/auth/totp/setup`, {}, token);
    assert.equal(setup.status, 422);
  });

  it('chỉ người có quyền cấu hình toàn trường bật; chỉ nhận true hoặc false', async () => {
    const otherToken = (await login(user)).body.access_token as string;
    assert.equal((await putJson(settingsUrl(), otherToken, { totp_enabled: true })).status, 403);
    assert.equal((await putJson(settingsUrl(), principalToken, { totp_enabled: 'có' })).status, 400);
    const saved = await putJson(settingsUrl(), principalToken, { totp_enabled: true });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.totp_enabled, true);
  });

  it('đăng ký: khóa và địa chỉ cấu hình, mã sai bị từ chối, mã đúng bật và cấp mã khôi phục một lần', async () => {
    const token = (await login(user)).body.access_token as string;
    const setup = await postJson(`${context.baseUrl}/auth/totp/setup`, {}, token);
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    secret = setup.body.secret as string;
    assert.match(secret, /^[A-Z2-7]{32}$/);
    assert.match(setup.body.otpauth_uri as string, /^otpauth:\/\/totp\//);
    // Đã đăng ký dở nhưng chưa xác nhận: đăng nhập chưa đòi mã
    assert.equal((await login(user)).status, 200);
    assert.equal((await postJson(`${context.baseUrl}/auth/totp/confirm`, { code: '000000' }, token)).status, 400);
    const confirmed = await postJson(`${context.baseUrl}/auth/totp/confirm`, { code: code() }, token);
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    recoveryCodes = confirmed.body.recovery_codes as string[];
    assert.equal(recoveryCodes.length, 8);
    const status = await getJson(`${context.baseUrl}/auth/totp`, token);
    assert.equal(status.body.enrolled, true);
    assert.equal(status.body.recovery_codes_left, 8);
    // Khóa lưu mã hóa, không có bản rõ ở cơ sở dữ liệu
    const row = await context.database
      .selectFrom('user_totp')
      .select('secret_encrypted')
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow();
    assert.ok(!row.secret_encrypted.includes(secret));
    const hashes = await context.database
      .selectFrom('user_recovery_codes')
      .select('code_hash')
      .where('user_id', '=', user.id)
      .execute();
    assert.ok(hashes.every((entry) => !recoveryCodes.some((item) => entry.code_hash.includes(item))));
    // Đăng ký lại khi đã bật bị từ chối
    assert.equal((await postJson(`${context.baseUrl}/auth/totp/setup`, {}, token)).status, 422);
  });

  it('đăng nhập: thiếu mã thì đòi mã (chưa tính nhập sai), sai thì từ chối, đúng thì vào, mã dùng một lần', async () => {
    const missing = await login(user);
    assert.equal(missing.status, 401);
    const details = (missing.body.error as { details: Array<{ field: string }> }).details;
    assert.ok(details.some((detail) => detail.field === 'otp_code'));
    const before = await context.database
      .selectFrom('users')
      .select('failed_login_count')
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    assert.equal(before.failed_login_count, 0);

    assert.equal((await login(user, '000000')).status, 401);
    context.clock.advanceMinutes(1);
    const good = code();
    assert.equal((await login(user, good)).status, 200);
    assert.equal((await login(user, good)).status, 401);
    // Mật khẩu sai kèm mã đúng vẫn bị từ chối
    context.clock.advanceMinutes(1);
    assert.equal((await login(user, code(), 'MatKhauSai2026')).status, 401);
    await context.database
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null })
      .where('id', '=', user.id)
      .execute();
  });

  it('mã khôi phục dùng được một lần', async () => {
    context.clock.advanceMinutes(1);
    const recovery = recoveryCodes[0] as string;
    assert.equal((await login(user, recovery.toLowerCase())).status, 200);
    assert.equal((await login(user, recovery)).status, 401);
    await context.database
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null })
      .where('id', '=', user.id)
      .execute();
    context.clock.advanceMinutes(1);
    const token = (await login(user, code())).body.access_token as string;
    const status = await getJson(`${context.baseUrl}/auth/totp`, token);
    assert.equal(status.body.recovery_codes_left, 7);
  });

  it('mã sai nhiều lần thì tạm khóa theo ngưỡng riêng của trường', async () => {
    assert.equal(
      (await putJson(policyUrl(), principalToken, { login_max_failed_attempts: 3, login_lock_minutes: 5 })).status,
      200,
    );
    const other = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    assert.equal((await login(other, undefined, 'sai-1', 'teacher')).status, 401);
    assert.equal((await login(other, undefined, 'sai-2', 'teacher')).status, 401);
    assert.equal((await login(other, undefined, 'sai-3', 'teacher')).status, 401);
    // Kênh giáo viên đòi mã xác nhận sau 3 lần sai (YCTD-353): gửi kèm mã đúng để thấy riêng việc tạm khóa
    const locked = await postJson(`${context.baseUrl}/auth/login`, {
      login: other.username,
      password: other.password,
      channel: 'teacher',
      ...(await solvedCaptcha(context)),
    });
    assert.equal(locked.status, 401);
    assert.match(JSON.stringify(locked.body), /khóa/);
    const row = await context.database
      .selectFrom('users')
      .select('locked_until')
      .where('id', '=', other.id)
      .executeTakeFirstOrThrow();
    assert.ok(row.locked_until);
    const minutes = (row.locked_until.getTime() - context.clock.now().getTime()) / 60_000;
    assert.ok(minutes > 3 && minutes <= 5.5, `khóa ${minutes} phút`);
    assert.equal(
      (await putJson(policyUrl(), principalToken, { login_max_failed_attempts: 5, login_lock_minutes: 15 })).status,
      200,
    );
  });

  it('chính sách độ dài mật khẩu riêng của trường áp dụng khi đổi mật khẩu; giới hạn hợp lệ', async () => {
    for (const body of [
      { password_min_length: 7 },
      { password_min_length: 65 },
      { login_max_failed_attempts: 2 },
      { login_lock_minutes: 0 },
    ]) {
      const rejected = await putJson(policyUrl(), principalToken, body);
      assert.equal(rejected.status, 400);
      assert.equal(errorCode(rejected.body), 'ERR_VALIDATION');
    }
    assert.equal((await putJson(policyUrl(), principalToken, { password_min_length: 12 })).status, 200);
    const target = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    const token = (await login(target)).body.access_token as string;
    const change = (newPassword: string) =>
      postJson(
        `${context.baseUrl}/auth/change-password`,
        { current_password: TEST_PASSWORD, new_password: newPassword },
        token,
      );
    assert.equal((await change('NganHon11')).status, 400);
    assert.equal((await change('DaiHonMuoiHai12')).status, 200);
    assert.equal((await putJson(policyUrl(), principalToken, { password_min_length: 8 })).status, 200);
  });

  it('tắt: cần mã đúng; người quản lý tài khoản đặt lại hộ khi mất điện thoại; tắt cả trường thì bỏ qua mã', async () => {
    const token = (
      await (async () => {
        context.clock.advanceMinutes(1);
        return login(user, code());
      })()
    ).body.access_token as string;
    assert.equal((await postJson(`${context.baseUrl}/auth/totp/disable`, { code: '123456' }, token)).status, 400);
    // Người không có quyền không đặt lại hộ được
    assert.equal((await postJson(`${context.baseUrl}/auth/totp/reset`, { user_id: user.id }, token)).status, 403);
    // Tắt cả trường: đăng nhập không đòi mã dù người dùng đã đăng ký
    assert.equal((await putJson(settingsUrl(), principalToken, { totp_enabled: false })).status, 200);
    assert.equal((await login(user)).status, 200);
    assert.equal((await putJson(settingsUrl(), principalToken, { totp_enabled: true })).status, 200);
    assert.equal((await login(user)).status, 401);
    const reset = await postJson(`${context.baseUrl}/auth/totp/reset`, { user_id: user.id }, principalToken);
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal((await login(user)).status, 200);
    const left = await context.database.selectFrom('user_totp').select('id').where('user_id', '=', user.id).execute();
    assert.equal(left.length, 0);
    // Đăng ký lại rồi tự tắt bằng mã
    const newToken = (await login(user)).body.access_token as string;
    const setup = await postJson(`${context.baseUrl}/auth/totp/setup`, {}, newToken);
    secret = setup.body.secret as string;
    context.clock.advanceMinutes(1);
    assert.equal((await postJson(`${context.baseUrl}/auth/totp/confirm`, { code: code() }, newToken)).status, 200);
    context.clock.advanceMinutes(1);
    const disabled = await postJson(`${context.baseUrl}/auth/totp/disable`, { code: code() }, newToken);
    assert.equal(disabled.status, 200, JSON.stringify(disabled.body));
    assert.equal(disabled.body.enrolled, false);
    assert.equal((await login(user)).status, 200);
  });
});

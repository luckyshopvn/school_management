import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  startTestApplication,
  TEST_PASSWORD,
  type TestContext,
  type TestUser,
} from '../test-support.js';

// Hết hạn mật khẩu của tài khoản nhân sự (DT-15 phần 15g, YCTD-110); kịch bản CT-15g-9 đến CT-15g-13
const POLICY_KEYS = [
  'password_max_age_days',
  'password_expiry_warning_days',
  'password_min_length',
  'login_max_failed_attempts',
  'login_lock_minutes',
];
// Mặc định của ba mục chính sách theo trường thêm ở DT-SaaS phần S8b
const SCHOOL_POLICY_DEFAULTS = { password_min_length: 8, login_max_failed_attempts: 5, login_lock_minutes: 15 };
const NEW_PASSWORD = 'MatKhauMoi2027';

async function putJson(url: string, accessToken: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

describe('Dịch vụ định danh: hết hạn mật khẩu', () => {
  let context: TestContext;
  let administratorToken: string;

  const login = (user: TestUser, password = user.password) =>
    postJson(`${context.baseUrl}/auth/login`, { login: user.username, password, channel: 'portal' });
  const policyUrl = () => `${context.baseUrl}/auth/settings/password-policy`;
  // Lùi thời điểm đặt mật khẩu để giả lập mật khẩu đã dùng lâu
  const setPasswordAge = (user: TestUser, days: number) =>
    sql`update users set password_changed_at = now() - make_interval(days => ${days}) where id = ${user.id}`.execute(
      context.database,
    );

  before(async () => {
    context = await startTestApplication();
    await context.database.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
    const administrator = await createTestUser(context.database, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
    administratorToken = (await login(administrator)).body.access_token as string;
  });

  after(async () => {
    // Trả chính sách về mặc định để không ảnh hưởng kiểm thử khác dùng chung cơ sở dữ liệu định danh
    await context.database.deleteFrom('identity_settings').where('key', 'in', POLICY_KEYS).execute();
    await context.close();
  });

  it('CT-15g-9: chỉ người quản lý mọi tài khoản đọc, sửa chính sách; mặc định tắt, báo trước 7 ngày', async () => {
    const initial = await getJson(policyUrl(), administratorToken);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body, {
      password_max_age_days: 0,
      password_expiry_warning_days: 7,
      ...SCHOOL_POLICY_DEFAULTS,
    });

    for (const roleCode of ['VT-07', 'VT-03']) {
      const other = await createTestUser(context.database, { roles: [{ roleCode, orgUnitId: null }] });
      const token = (await login(other)).body.access_token as string;
      assert.equal((await getJson(policyUrl(), token)).status, 403);
      assert.equal((await putJson(policyUrl(), token, { password_max_age_days: 30 })).status, 403);
    }
    for (const body of [
      { password_max_age_days: -1 },
      { password_max_age_days: 4000 },
      { password_expiry_warning_days: 'a' },
      {},
    ]) {
      const rejected = await putJson(policyUrl(), administratorToken, body);
      assert.equal(rejected.status, 400);
      assert.equal(errorCode(rejected.body), 'ERR_VALIDATION');
    }
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    const principalToken = (await login(principal)).body.access_token as string;
    const saved = await putJson(policyUrl(), principalToken, { password_max_age_days: 90 });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, {
      password_max_age_days: 90,
      password_expiry_warning_days: 7,
      ...SCHOOL_POLICY_DEFAULTS,
    });
  });

  it('CT-15g-10: mật khẩu quá hạn thì đăng nhập phải đổi mật khẩu; mật khẩu mới phải khác mật khẩu cũ', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    await setPasswordAge(staff, 100);
    const expired = await login(staff);
    assert.equal(expired.status, 200);
    assert.equal(expired.body.password_change_required, true);
    assert.equal(expired.body.password_expired, true);
    const token = expired.body.access_token as string;
    // Phiên phải đổi mật khẩu không dùng được điểm cuối khác
    assert.equal((await getJson(policyUrl(), token)).status, 403);
    const events = await context.database
      .selectFrom('security_events')
      .select('event_type')
      .where('user_id', '=', staff.id)
      .execute();
    assert.ok(events.some((event) => event.event_type === 'login_password_expired'));

    // Phiên làm mới vẫn bắt buộc đổi mật khẩu
    const refreshed = await postJson(
      `${context.baseUrl}/auth/refresh`,
      { channel: 'portal' },
      undefined,
      expired.refreshToken,
    );
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.password_change_required, true);
    assert.equal(refreshed.body.password_expired, true);

    const same = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: TEST_PASSWORD, new_password: TEST_PASSWORD },
      token,
    );
    assert.equal(same.status, 400);
    const changed = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: TEST_PASSWORD, new_password: NEW_PASSWORD },
      token,
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.password_change_required, false);
    assert.equal(changed.body.password_expired, false);

    const again = await login(staff, NEW_PASSWORD);
    assert.equal(again.body.password_change_required, false);
    assert.equal(again.body.password_expired, false);
    assert.equal(again.body.password_expires_in_days, null);
  });

  it('CT-15g-11: trong khoảng báo trước thì trả số ngày còn lại, chưa bắt buộc đổi', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    await setPasswordAge(staff, 85);
    const warned = await login(staff);
    assert.equal(warned.body.password_change_required, false);
    assert.equal(warned.body.password_expired, false);
    assert.equal(warned.body.password_expires_in_days, 5);

    await setPasswordAge(staff, 80);
    assert.equal((await login(staff)).body.password_expires_in_days, null);

    await putJson(policyUrl(), administratorToken, { password_expiry_warning_days: 0 });
    await setPasswordAge(staff, 85);
    assert.equal((await login(staff)).body.password_expires_in_days, null);
    await putJson(policyUrl(), administratorToken, { password_expiry_warning_days: 7 });
  });

  it('CT-15g-12: tài khoản chỉ có vai trò Phụ huynh không áp hạn mật khẩu; tài khoản có thêm vai trò nhân sự thì áp', async () => {
    const parent = await createTestUser(context.database, { roles: [{ roleCode: 'VT-14', orgUnitId: null }] });
    await setPasswordAge(parent, 400);
    // Tài khoản chỉ có vai trò Phụ huynh đăng nhập ở ứng dụng phụ huynh (YCTD-311)
    const parentLogin = await postJson(`${context.baseUrl}/auth/login`, {
      login: parent.username,
      password: parent.password,
      channel: 'parent',
    });
    assert.equal(parentLogin.body.password_change_required, false);
    assert.equal(parentLogin.body.password_expired, false);

    const parentAndTeacher = await createTestUser(context.database, {
      roles: [
        { roleCode: 'VT-14', orgUnitId: null },
        { roleCode: 'VT-07', orgUnitId: null },
      ],
    });
    await setPasswordAge(parentAndTeacher, 400);
    assert.equal((await login(parentAndTeacher)).body.password_expired, true);
  });

  it('CT-15g-13: số ngày tối đa bằng 0 thì tắt hạn mật khẩu', async () => {
    await putJson(policyUrl(), administratorToken, { password_max_age_days: 0 });
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    await setPasswordAge(staff, 1000);
    const response = await login(staff);
    assert.equal(response.body.password_change_required, false);
    assert.equal(response.body.password_expired, false);
    assert.equal(response.body.password_expires_in_days, null);
  });
});

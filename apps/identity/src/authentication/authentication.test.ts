import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  startTestApplication,
  TEST_PASSWORD,
  type JsonResponse,
  type TestContext,
} from '../test-support.js';

// Ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md

async function login(context: TestContext, loginIdentifier: string, password: string, channel = 'portal') {
  return postJson(`${context.baseUrl}/auth/login`, { login: loginIdentifier, password, channel });
}

function readTokens(response: JsonResponse): { accessToken: string; refreshToken: string } {
  assert.equal(typeof response.body.access_token, 'string');
  assert.equal(response.body.refresh_token, undefined);
  assert.ok(response.refreshToken);
  return { accessToken: response.body.access_token as string, refreshToken: response.refreshToken };
}

function refresh(context: TestContext, refreshToken: string) {
  return postJson(`${context.baseUrl}/auth/refresh`, {}, undefined, refreshToken);
}

describe('Dịch vụ định danh: đăng nhập và phiên', () => {
  let context: TestContext;
  const branchA = randomUUID();

  before(async () => {
    context = await startTestApplication();
  });

  after(async () => {
    await context.close();
  });

  it('CTC-DD-001: đăng nhập bằng số điện thoại, /auth/me trả đúng vai trò và đơn vị', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: branchA }] });
    const response = await login(context, staff.phone, staff.password);
    assert.equal(response.status, 200);
    const { accessToken } = readTokens(response);
    assert.equal(response.body.password_change_required, false);

    const me = await getJson(`${context.baseUrl}/auth/me`, accessToken);
    assert.equal(me.status, 200);
    assert.equal(me.body.id, staff.id);
    const assignments = me.body.assignments as Array<{ role_code: string; org_unit_id: string; permissions: string[] }>;
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0]?.role_code, 'VT-06');
    assert.equal(assignments[0]?.org_unit_id, branchA);
    assert.ok(assignments[0]?.permissions.includes('P07.edit'));
  });

  it('CTC-DD-002: đăng nhập bằng tên đăng nhập', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: branchA }] });
    const response = await login(context, staff.username, staff.password);
    assert.equal(response.status, 200);
    readTokens(response);
  });

  it('BM-71: mã làm mới chỉ nằm trong cookie httpOnly, Secure, SameSite=Strict; đăng xuất xóa cookie', async () => {
    const staff = await createTestUser(context.database);
    const response = await login(context, staff.phone, staff.password);
    assert.equal(response.status, 200);
    assert.equal(response.body.refresh_token, undefined);
    const attributes = (response.setCookie ?? '').toLowerCase();
    for (const attribute of ['httponly', 'secure', 'samesite=strict', 'path=/api/v1/auth']) {
      assert.ok(attributes.includes(attribute), attribute);
    }
    const { accessToken } = readTokens(response);
    const logout = await postJson(`${context.baseUrl}/auth/logout`, {}, accessToken);
    assert.equal(logout.status, 204);
    assert.match(logout.setCookie ?? '', /refresh_token=;/);
  });

  it('CTC-DD-003: sai mật khẩu bị từ chối, phản hồi không chứa thông tin nội bộ', async () => {
    const staff = await createTestUser(context.database);
    const response = await login(context, staff.phone, 'SaiMatKhau1');
    assert.equal(response.status, 401);
    assert.equal(errorCode(response.body), 'ERR_UNAUTHENTICATED');
    assert.equal(response.body.access_token, undefined);
    const error = response.body.error as Record<string, unknown>;
    assert.deepEqual(Object.keys(error).sort(), ['code', 'correlation_id', 'details', 'message']);
  });

  it('CTC-DD-004: sai 5 lần thì tạm khóa 15 phút rồi tự mở, nhật ký ghi theo tài khoản và địa chỉ mạng', async () => {
    const staff = await createTestUser(context.database);
    for (let attempt = 0; attempt < 5; attempt++) {
      const failed = await login(context, staff.phone, 'SaiMatKhau1');
      assert.equal(failed.status, 401);
    }
    const locked = await login(context, staff.phone, staff.password);
    assert.equal(locked.status, 401);
    assert.match(String((locked.body.error as Record<string, unknown>).message), /thử lại sau 15 phút/);

    const events = await context.database
      .selectFrom('security_events')
      .select(['event_type', 'ip_address'])
      .where('user_id', '=', staff.id)
      .where('event_type', '=', 'login_failed')
      .execute();
    assert.equal(events.length, 5);
    assert.ok(events.every((event) => event.ip_address !== null));

    context.clock.advanceMinutes(15);
    const unlocked = await login(context, staff.phone, staff.password);
    assert.equal(unlocked.status, 200);
  });

  it('CTC-DD-007: tài khoản có ngày hết hiệu lực là hôm qua bị từ chối và chuyển sang khóa', async () => {
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(context.clock.now().getTime() - 24 * 60 * 60 * 1000),
    );
    const auditor = await createTestUser(context.database, {
      roles: [{ roleCode: 'VT-20', orgUnitId: null }],
      validUntil: yesterday,
    });
    const response = await login(context, auditor.phone, auditor.password);
    assert.equal(response.status, 401);
    const user = await context.database
      .selectFrom('users')
      .select('status')
      .where('id', '=', auditor.id)
      .executeTakeFirstOrThrow();
    assert.equal(user.status, 'locked');
  });

  it('CTC-DD-009: mật khẩu lưu dạng băm argon2id có muối, không có bản rõ', async () => {
    const { hashPassword } = await import('./password.js');
    const first = await createTestUser(context.database, { passwordHash: await hashPassword(TEST_PASSWORD) });
    const second = await createTestUser(context.database, { passwordHash: await hashPassword(TEST_PASSWORD) });
    const rows = await context.database
      .selectFrom('users')
      .select('password_hash')
      .where('id', 'in', [first.id, second.id])
      .execute();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0]?.password_hash, rows[1]?.password_hash);
    for (const row of rows) {
      assert.ok(row.password_hash.startsWith('$argon2id$'));
      assert.ok(!row.password_hash.includes(TEST_PASSWORD));
    }
  });

  it('CTC-DD-031: mã phiên hết hạn sau 15 phút, làm mới thì dùng được mã mới', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: branchA }] });
    const { accessToken, refreshToken } = readTokens(await login(context, staff.phone, staff.password));
    context.clock.advanceMinutes(16);
    const expired = await getJson(`${context.baseUrl}/auth/me`, accessToken);
    assert.equal(expired.status, 401);
    assert.equal(errorCode(expired.body), 'ERR_UNAUTHENTICATED');

    const refreshed = await refresh(context, refreshToken);
    assert.equal(refreshed.status, 200);
    const renewed = readTokens(refreshed);
    const me = await getJson(`${context.baseUrl}/auth/me`, renewed.accessToken);
    assert.equal(me.status, 200);
  });

  it('CTC-DD-032: cổng quản trị không làm mới được sau 8 giờ 1 phút', async () => {
    const staff = await createTestUser(context.database);
    const { refreshToken } = readTokens(await login(context, staff.phone, staff.password, 'portal'));
    context.clock.advanceMinutes(8 * 60 + 1);
    const refreshed = await refresh(context, refreshToken);
    assert.equal(refreshed.status, 401);
  });

  for (const channel of ['teacher', 'parent']) {
    it(`CTC-DD-033: kênh ${channel} làm mới được sau 29 ngày, bị từ chối sau 30 ngày 1 phút`, async () => {
      const user = await createTestUser(context.database);
      let { refreshToken } = readTokens(await login(context, user.phone, user.password, channel));
      context.clock.advanceMinutes(29 * 24 * 60);
      const first = await refresh(context, refreshToken);
      assert.equal(first.status, 200);
      refreshToken = readTokens(first).refreshToken;
      context.clock.advanceMinutes(24 * 60 + 1);
      const second = await refresh(context, refreshToken);
      assert.equal(second.status, 401);
    });
  }

  it('CTC-DD-034: đăng xuất rồi làm mới bằng mã làm mới cũ bị từ chối', async () => {
    const staff = await createTestUser(context.database);
    const { accessToken, refreshToken } = readTokens(await login(context, staff.phone, staff.password));
    const logout = await postJson(`${context.baseUrl}/auth/logout`, {}, accessToken);
    assert.equal(logout.status, 204);
    const refreshed = await refresh(context, refreshToken);
    assert.equal(refreshed.status, 401);
  });

  it('Dùng lại mã làm mới đã đổi thì thu hồi cả phiên', async () => {
    const staff = await createTestUser(context.database);
    const { refreshToken } = readTokens(await login(context, staff.phone, staff.password));
    const first = await refresh(context, refreshToken);
    assert.equal(first.status, 200);
    const newRefreshToken = readTokens(first).refreshToken;
    const reused = await refresh(context, refreshToken);
    assert.equal(reused.status, 401);
    const afterReuse = await refresh(context, newRefreshToken);
    assert.equal(afterReuse.status, 401);
  });

  it('CTC-DD-043: HT, PHT, KTT, QTNT đăng nhập bằng mật khẩu được cấp phiên đầy đủ; verify-otp không còn', async () => {
    for (const roleCode of ['VT-02', 'VT-15', 'VT-05', 'VT-01']) {
      const user = await createTestUser(context.database, {
        roles: [{ roleCode, orgUnitId: roleCode === 'VT-15' ? branchA : null }],
      });
      const response = await login(context, user.username, user.password);
      assert.equal(response.status, 200, roleCode);
      assert.equal(response.body.password_change_required, false);
      const me = await getJson(`${context.baseUrl}/auth/me`, readTokens(response).accessToken);
      assert.equal(me.status, 200);
    }
    const verifyOtp = await postJson(`${context.baseUrl}/auth/verify-otp`, { code: '123456' });
    assert.equal(verifyOtp.status, 404);
  });

  it('PQ-10: VT-01 chỉ có quyền quản lý tài khoản, không có quyền nghiệp vụ', async () => {
    const administrator = await createTestUser(context.database, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
    const { accessToken } = readTokens(await login(context, administrator.username, administrator.password));
    const me = await getJson(`${context.baseUrl}/auth/me`, accessToken);
    const assignments = me.body.assignments as Array<{ permissions: string[] }>;
    assert.deepEqual(assignments[0]?.permissions, ['P01.account.manage']);
  });

  it('BM-07: tài khoản bắt buộc đổi mật khẩu chỉ dùng được đổi mật khẩu; đổi xong cấp mã đầy đủ', async () => {
    const user = await createTestUser(context.database, { mustChangePassword: true });
    const response = await login(context, user.phone, user.password);
    assert.equal(response.status, 200);
    assert.equal(response.body.password_change_required, true);
    const { accessToken, refreshToken } = readTokens(response);

    const weak = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: user.password, new_password: 'ngan1' },
      accessToken,
    );
    assert.equal(weak.status, 400);
    assert.equal(errorCode(weak.body), 'ERR_VALIDATION');

    const noDigit = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: user.password, new_password: 'KhongCoSoNao' },
      accessToken,
    );
    assert.equal(noDigit.status, 400);

    const changed = await postJson(
      `${context.baseUrl}/auth/change-password`,
      { current_password: user.password, new_password: 'MatKhauMoi2026' },
      accessToken,
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.password_change_required, false);

    const oldPassword = await login(context, user.phone, user.password);
    assert.equal(oldPassword.status, 401);
    const newPassword = await login(context, user.phone, 'MatKhauMoi2026');
    assert.equal(newPassword.status, 200);
    const refreshed = await refresh(context, refreshToken);
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.password_change_required, false);
  });

  it('Mã phiên bị sửa chữ ký bị từ chối', async () => {
    const staff = await createTestUser(context.database);
    const { accessToken } = readTokens(await login(context, staff.phone, staff.password));
    const [header, payload, signature] = accessToken.split('.');
    const tampered = `${header}.${payload}.${signature?.startsWith('A') ? 'B' : 'A'}${signature?.slice(1)}`;
    const me = await getJson(`${context.baseUrl}/auth/me`, tampered);
    assert.equal(me.status, 401);
  });

  it('CTC-DD-036: tài khoản bị khóa thì /auth/me từ chối ngay dù mã phiên còn hạn', async () => {
    const staff = await createTestUser(context.database);
    const { accessToken } = readTokens(await login(context, staff.phone, staff.password));
    await context.database.updateTable('users').set({ status: 'locked' }).where('id', '=', staff.id).execute();
    const me = await getJson(`${context.baseUrl}/auth/me`, accessToken);
    assert.equal(me.status, 401);
  });
});

describe('Dịch vụ định danh: giới hạn tần suất đăng nhập', () => {
  let context: TestContext;

  before(async () => {
    context = await startTestApplication({ loginRequestsPerMinutePerAddress: 10 });
  });

  after(async () => {
    await context.close();
  });

  it('CTC-DD-008: yêu cầu đăng nhập thứ 11 trong một phút trả ERR_RATE_LIMIT kèm thời gian chờ', async () => {
    context.clock.freeze();
    const user = await createTestUser(context.database);
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await login(context, `khong_ton_tai_${attempt}`, 'SaiMatKhau1');
      assert.equal(response.status, 401);
    }
    const limited = await login(context, user.phone, user.password);
    assert.equal(limited.status, 429);
    assert.equal(errorCode(limited.body), 'ERR_RATE_LIMIT');
    assert.ok(Number((limited.body.error as Record<string, unknown>).retry_after_seconds) > 0);
  });
});

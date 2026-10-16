import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createTestUser,
  errorCode,
  getJson,
  postJson,
  solvedCaptcha,
  startTestApplication,
  type TestContext,
} from '../test-support.js';

// DT-16 phần 16c: mã xác nhận dạng ảnh, quên mật khẩu tự phục vụ, lịch sử mật khẩu, thông tin trang đăng nhập
function fieldsOf(body: Record<string, unknown>): string[] {
  const details = ((body.error as Record<string, unknown> | undefined)?.details ?? []) as Array<{ field: string }>;
  return details.map((detail) => detail.field);
}

async function putJson(url: string, body: unknown, accessToken: string) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

describe('Dịch vụ định danh: bảo mật đăng nhập cổng quản trị (DT-16 phần 16c)', () => {
  let context: TestContext;

  before(async () => {
    context = await startTestApplication();
  });

  after(async () => {
    await context.close();
  });

  async function login(loginIdentifier: string, password: string, extra: Record<string, unknown> = {}) {
    return postJson(`${context.baseUrl}/auth/login`, { login: loginIdentifier, password, channel: 'portal', ...extra });
  }

  async function principalToken(): Promise<string> {
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    const response = await login(principal.username, principal.password);
    assert.equal(response.status, 200);
    return response.body.access_token as string;
  }

  it('CT-16c-1: ảnh mã xác nhận là ảnh PNG tự sinh, không chứa đáp án dạng chữ; mỗi lần lấy là mã mới', async () => {
    const first = await postJson(`${context.baseUrl}/auth/captcha`, {});
    const second = await postJson(`${context.baseUrl}/auth/captcha`, {});
    assert.equal(first.status, 200);
    assert.notEqual(first.body.captcha_id, second.body.captcha_id);
    const image = String(first.body.image);
    assert.match(image, /^data:image\/png;base64,/);
    const bytes = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    const solved = await solvedCaptcha(context);
    assert.equal(solved.captcha_text.length, 5);
    assert.ok(!bytes.toString('latin1').includes(solved.captcha_text));
  });

  it('CT-16c-2: sai mật khẩu 3 lần thì phải nhập mã xác nhận; mã dùng một lần; đăng nhập đúng thì không cần mã nữa', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await login(staff.username, 'SaiMatKhau1')).status, 401);
    }
    const missing = await login(staff.username, staff.password);
    assert.equal(missing.status, 400);
    assert.deepEqual(fieldsOf(missing.body), ['captcha']);

    const captcha = await solvedCaptcha(context);
    const wrong = await login(staff.username, staff.password, { captcha_id: captcha.captcha_id, captcha_text: 'XXXXX' });
    assert.equal(wrong.status, 400);
    // Mã đã so một lần thì hết hiệu lực dù lần trước nhập sai
    const reused = await login(staff.username, staff.password, captcha);
    assert.equal(reused.status, 400);

    const fresh = await solvedCaptcha(context);
    const accepted = await login(staff.username, staff.password, {
      captcha_id: fresh.captcha_id,
      captcha_text: fresh.captcha_text.toLowerCase(),
    });
    assert.equal(accepted.status, 200);
    assert.equal((await login(staff.username, staff.password)).status, 200);
  });

  it('CT-16c-3: tên đăng nhập không tồn tại cũng phải nhập mã sau 3 lần sai; ứng dụng giáo viên không áp dụng mã', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await login('khong_co_tai_khoan_16c', 'SaiMatKhau1')).status, 401);
    }
    assert.deepEqual(fieldsOf((await login('khong_co_tai_khoan_16c', 'SaiMatKhau1')).body), ['captcha']);

    const teacher = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await postJson(`${context.baseUrl}/auth/login`, {
        login: teacher.username,
        password: 'SaiMatKhau1',
        channel: 'teacher',
      });
      assert.equal(response.status, 401);
    }
  });

  it('CT-16c-4: cấu hình đường dây nóng, luôn hiện mã xác nhận; trang đăng nhập đọc được không cần đăng nhập', async () => {
    const token = await principalToken();
    const invalid = await putJson(`${context.baseUrl}/auth/settings`, { login_hotline: 'x'.repeat(101) }, token);
    assert.equal(invalid.status, 400);
    const saved = await putJson(
      `${context.baseUrl}/auth/settings`,
      { login_hotline: '1900 0000 (giờ hành chính)', captcha_always: true, captcha_failure_threshold: 4 },
      token,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.login_hotline, '1900 0000 (giờ hành chính)');
    assert.equal(saved.body.captcha_always, true);
    try {
      const options = await getJson(`${context.baseUrl}/auth/login-options`);
      assert.equal(options.status, 200);
      assert.deepEqual(options.body, { hotline: '1900 0000 (giờ hành chính)', captcha_always: true });
      const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
      assert.deepEqual(fieldsOf((await login(staff.username, staff.password)).body), ['captcha']);
      assert.equal((await login(staff.username, staff.password, await solvedCaptcha(context))).status, 200);
    } finally {
      const restored = await putJson(
        `${context.baseUrl}/auth/settings`,
        { login_hotline: '', captcha_always: false, captcha_failure_threshold: 3 },
        token,
      );
      assert.equal(restored.status, 200);
    }
    assert.deepEqual((await getJson(`${context.baseUrl}/auth/login-options`)).body, {
      hotline: null,
      captcha_always: false,
    });
  });

  it('CT-16c-5: quên mật khẩu cần mã xác nhận; phản hồi như nhau dù tài khoản có hay không; chỉ tài khoản nhân sự nhận mã', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    const parent = await createTestUser(context.database, { roles: [{ roleCode: 'VT-14', orgUnitId: null }] });
    const withoutCaptcha = await postJson(`${context.baseUrl}/auth/password-reset/request`, { login: staff.username });
    assert.equal(withoutCaptcha.status, 400);
    assert.deepEqual(fieldsOf(withoutCaptcha.body), ['captcha']);

    const responses = [];
    for (const loginIdentifier of [staff.username, 'khong_co_tai_khoan_reset', parent.phone]) {
      const response = await postJson(`${context.baseUrl}/auth/password-reset/request`, {
        login: loginIdentifier,
        ...(await solvedCaptcha(context)),
      });
      assert.equal(response.status, 200);
      responses.push(response.body);
    }
    assert.deepEqual(responses[0], responses[1]);
    assert.deepEqual(responses[0], responses[2]);
    assert.match(context.smsSender.lastTo(staff.phone) ?? '', /Mã đặt lại mật khẩu cổng quản trị: \d{6}/);
    assert.equal(context.smsSender.lastTo(parent.phone), undefined);
  });

  it('CT-16c-6: đặt lại bằng mã: sai mã bị từ chối; mật khẩu cũ bị từ chối; đặt xong thu hồi phiên, mở khóa, mã không dùng lại được', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    const session = await login(staff.username, staff.password);
    assert.equal(session.status, 200);
    await context.database
      .updateTable('users')
      .set({ locked_until: new Date(Date.now() + 10 * 60 * 1000) })
      .where('id', '=', staff.id)
      .execute();
    await postJson(`${context.baseUrl}/auth/password-reset/request`, {
      login: staff.phone,
      ...(await solvedCaptcha(context)),
    });
    const code = /: (\d{6})\./.exec(context.smsSender.lastTo(staff.phone) ?? '')?.[1] ?? '';
    const confirm = (body: Record<string, unknown>) =>
      postJson(`${context.baseUrl}/auth/password-reset/confirm`, { login: staff.phone, ...body });

    const wrongCode = code === '000000' ? '111111' : '000000';
    assert.equal((await confirm({ code: wrongCode, new_password: 'MatKhauMoi2026' })).status, 401);
    const weak = await confirm({ code, new_password: 'ngan' });
    assert.equal(weak.status, 400);
    const reused = await confirm({ code, new_password: staff.password });
    assert.equal(reused.status, 400);
    assert.deepEqual(fieldsOf(reused.body), ['new_password']);

    const accepted = await confirm({ code, new_password: 'MatKhauMoi2026' });
    assert.equal(accepted.status, 200);
    assert.equal((await confirm({ code, new_password: 'MatKhauKhac2026' })).status, 401);

    const me = await getJson(`${context.baseUrl}/auth/me`, session.body.access_token as string);
    assert.equal(me.status, 401);
    assert.equal((await login(staff.username, staff.password)).status, 401);
    assert.equal((await login(staff.username, 'MatKhauMoi2026', await solvedCaptcha(context))).status, 200);
    const events = await context.database
      .selectFrom('security_events')
      .select('event_type')
      .where('user_id', '=', staff.id)
      .where('event_type', 'in', ['password_reset_code_sent', 'password_reset'])
      .execute();
    assert.equal(events.length, 2);
  });

  it('CT-16c-7: yêu cầu mã quá số lần mỗi giờ bị chặn như nhau cho tài khoản có và không có', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    for (const loginIdentifier of [staff.username, 'khong_co_tai_khoan_gioi_han']) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await postJson(`${context.baseUrl}/auth/password-reset/request`, {
          login: loginIdentifier,
          ...(await solvedCaptcha(context)),
        });
        assert.equal(response.status, 200);
      }
      const limited = await postJson(`${context.baseUrl}/auth/password-reset/request`, {
        login: loginIdentifier,
        ...(await solvedCaptcha(context)),
      });
      assert.equal(limited.status, 429);
      assert.equal(errorCode(limited.body), 'ERR_RATE_LIMIT');
    }
  });

  it('CT-16c-8: đổi mật khẩu không được dùng lại các mật khẩu gần nhất theo cấu hình', async () => {
    const staff = await createTestUser(context.database, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
    let token = (await login(staff.username, staff.password)).body.access_token as string;
    const change = async (current: string, next: string) => {
      const response = await postJson(
        `${context.baseUrl}/auth/change-password`,
        { current_password: current, new_password: next },
        token,
      );
      if (response.status === 200) {
        token = response.body.access_token as string;
      }
      return response;
    };
    assert.equal((await change(staff.password, 'MatKhauMot2026')).status, 200);
    assert.equal((await change('MatKhauMot2026', 'MatKhauHai2026')).status, 200);
    const back = await change('MatKhauHai2026', 'MatKhauMot2026');
    assert.equal(back.status, 400);
    assert.match(JSON.stringify(back.body), /5 mật khẩu gần nhất/);
    const history = await context.database
      .selectFrom('password_history')
      .select('password_hash')
      .where('user_id', '=', staff.id)
      .execute();
    assert.equal(history.length, 2);
    assert.ok(history.every((row) => row.password_hash.startsWith('$argon2id$')));
  });
});

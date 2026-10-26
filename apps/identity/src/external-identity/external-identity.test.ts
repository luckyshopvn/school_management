import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { totpCode } from '@school-management/server';
import {
  clearOidcCaches,
  createTestUser,
  errorCode,
  getJson,
  MockOidcServer,
  parseProviderDefinition,
  postJson,
  startTestApplication,
  TEST_PASSWORD,
  type MockIdentity,
  type TestContext,
  type TestUser,
} from '../test-support.js';

// Bộ nối nhà cung cấp định danh OIDC, sẵn cho VNeID (DT-25, YCTD-225; tài liệu 32 mục 17). Nhà cung cấp là máy chủ OIDC giả lập chạy
// cục bộ, khóa ký sinh mới mỗi lần chạy; không gọi dịch vụ thật
const CODE = 'vneid';
const PROVIDER_KEYS = ['totp_enabled'];

async function putJson(url: string, accessToken: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

describe('Dịch vụ định danh: đăng nhập và liên kết bằng nhà cung cấp định danh bên ngoài (OIDC)', () => {
  let context: TestContext;
  let mock: MockOidcServer;
  let manager: TestUser;
  let managerToken: string;
  let teacher: TestUser;
  let other: TestUser;
  let redirectUri: string;

  const url = (path: string) => `${context.baseUrl}/auth/external${path}`;
  const passwordLogin = async (target: TestUser, otp?: string) =>
    (
      await postJson(`${context.baseUrl}/auth/login`, {
        login: target.username,
        password: target.password,
        channel: 'portal',
        ...(otp ? { otp_code: otp } : {}),
      })
    ).body.access_token as string;
  const setSettings = (body: Record<string, unknown>) => putJson(url(`/settings/${CODE}`), managerToken, body);

  // Đăng nhập ở trang của nhà cung cấp (giả lập) rồi trang quay về gửi state, code
  async function loginWith(identity: MockIdentity, channel = 'portal') {
    const started = await postJson(url(`/${CODE}/start`), { channel, redirect_uri: redirectUri });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const issued = mock.authorize(started.body.authorization_url as string, identity);
    return postJson(url('/callback'), { state: issued.state, code: issued.code });
  }

  async function link(target: TestUser, identity: MockIdentity, extra: Record<string, unknown> = {}) {
    const token = await passwordLogin(target);
    const started = await postJson(
      url(`/${CODE}/link`),
      { password: target.password, redirect_uri: redirectUri, ...extra },
      token,
    );
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const issued = mock.authorize(started.body.authorization_url as string, identity);
    return { token, reply: await postJson(url('/callback'), { state: issued.state, code: issued.code }, token) };
  }

  before(async () => {
    mock = await new MockOidcServer().start();
    const definition = parseProviderDefinition(
      {
        code: CODE,
        profile: 'vneid',
        issuer: mock.issuer,
        client_id: mock.clientId,
        jwks_cooldown_seconds: 0,
      },
      { [CODE]: mock.clientSecret },
    );
    context = await startTestApplication({ externalIdentityProviders: [definition] });
    redirectUri = `${context.origin}/dang-nhap/ben-ngoai`;
    manager = await createTestUser(context.database, { roles: [{ roleCode: 'VT-01', orgUnitId: null }] });
    managerToken = await passwordLogin(manager);
    teacher = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    other = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    await context.database.deleteFrom('external_identity_providers').execute();
  });

  beforeEach(() => {
    clearOidcCaches();
  });

  after(async () => {
    await context.database.deleteFrom('external_identity_providers').execute();
    await context.database.deleteFrom('identity_settings').where('key', 'in', PROVIDER_KEYS).execute();
    await context.close();
    await mock.stop();
  });

  it('mặc định tắt: không có nút đăng nhập, bắt đầu bị từ chối; nhà cung cấp nền tảng không khai trả 404', async () => {
    const providers = await getJson(url('/providers'));
    assert.deepEqual(providers.body.providers, []);
    const started = await postJson(url(`/${CODE}/start`), { channel: 'portal', redirect_uri: redirectUri });
    assert.equal(started.status, 422);
    assert.equal(
      (await postJson(url('/khong-co/start'), { channel: 'portal', redirect_uri: redirectUri })).status,
      404,
    );
  });

  it('chỉ người quản lý tài khoản sửa cấu hình; cấu hình có mục chờ tài liệu RAR; bật thì hiện nút', async () => {
    const teacherToken = await passwordLogin(teacher);
    assert.equal((await putJson(url(`/settings/${CODE}`), teacherToken, { enabled: true })).status, 403);
    assert.equal((await setSettings({ enabled: 'có' })).status, 400);
    assert.equal((await setSettings({ allowed_roles: ['VT-99'] })).status, 400);
    const saved = await setSettings({ enabled: true });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.enabled, true);
    const settings = await getJson(url('/settings'), managerToken);
    assert.ok((settings.body.pending_rar_documentation as string[]).includes('subject_claim'));
    const providers = await getJson(url('/providers'));
    assert.deepEqual(providers.body.providers, [{ code: CODE, display_name: 'VNeID', profile: 'vneid' }]);
  });

  it('địa chỉ quay về phải đúng tên miền và đường dẫn; ủy quyền dùng PKCE S256, state, nonce', async () => {
    for (const bad of ['https://ke-gian.example/dang-nhap/ben-ngoai', `${context.origin}/khac`, 'khong-phai-url']) {
      const reply = await postJson(url(`/${CODE}/start`), { channel: 'portal', redirect_uri: bad });
      assert.equal(reply.status, 400, bad);
    }
    const started = await postJson(url(`/${CODE}/start`), { channel: 'portal', redirect_uri: redirectUri });
    const query = new URL(started.body.authorization_url as string).searchParams;
    assert.equal(query.get('code_challenge_method'), 'S256');
    assert.ok(query.get('state') && query.get('nonce') && query.get('code_challenge'));
    assert.equal(query.get('client_id'), mock.clientId);
  });

  it('chưa liên kết thì không đăng nhập được và không tự tạo tài khoản', async () => {
    const before = await context.database
      .selectFrom('users')
      .select((b) => b.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const reply = await loginWith({ subject: 'chua-lien-ket-001' });
    assert.equal(reply.status, 401);
    const afterCount = await context.database
      .selectFrom('users')
      .select((b) => b.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    assert.equal(afterCount.n, before.n);
    const event = await context.database
      .selectFrom('external_identity_events')
      .select(['event_type', 'reason'])
      .where('reason', '=', 'not_linked')
      .executeTakeFirst();
    assert.equal(event?.event_type, 'login_rejected');
  });

  it('liên kết cần mật khẩu; chỉ lưu subject mã hóa và băm, rồi đăng nhập được bằng nhà cung cấp', async () => {
    const token = await passwordLogin(teacher);
    const wrong = await postJson(url(`/${CODE}/link`), { password: 'sai-mat-khau', redirect_uri: redirectUri }, token);
    assert.equal(wrong.status, 400);
    const { reply } = await link(teacher, { subject: 'giao-vien-001' });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.status, 'linked');
    const row = await context.database
      .selectFrom('external_identities')
      .selectAll()
      .where('user_id', '=', teacher.id)
      .executeTakeFirstOrThrow();
    assert.notEqual(row.subject_encrypted, 'giao-vien-001');
    assert.ok(!row.subject_encrypted.includes('giao-vien-001'));
    assert.match(row.subject_hash, /^[0-9a-f]{64}$/);

    const signedIn = await loginWith({ subject: 'giao-vien-001' });
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
    assert.equal(signedIn.body.status, 'signed_in');
    assert.equal(signedIn.body.password_change_required, false);
    assert.ok(signedIn.refreshToken);
    const me = await getJson(`${context.baseUrl}/auth/me`, signedIn.body.access_token as string);
    assert.equal(me.body.id, teacher.id);
    const session = await context.database
      .selectFrom('sessions')
      .select('login_method')
      .where('user_id', '=', teacher.id)
      .orderBy('issued_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.equal(session.login_method, 'external_provider');
    // Làm mới phiên bằng cookie vẫn dùng được
    const refreshed = await postJson(
      `${context.baseUrl}/auth/refresh`,
      { channel: 'portal' },
      undefined,
      signedIn.refreshToken,
    );
    assert.equal(refreshed.status, 200);
    const links = await getJson(url('/links'), signedIn.body.access_token as string);
    assert.equal((links.body.links as unknown[]).length, 1);
    assert.ok(!JSON.stringify(links.body).includes('giao-vien-001'));
  });

  it('chữ ký sai, nonce sai, sai đối tượng, sai bên phát hành, hết hạn đều bị từ chối và ghi nhật ký', async () => {
    const cases: Array<[MockIdentity['tamper'], string]> = [
      ['signature', 'invalid_id_token'],
      ['nonce', 'nonce_mismatch'],
      ['audience', 'invalid_id_token'],
      ['issuer', 'invalid_id_token'],
      ['expired', 'invalid_id_token'],
    ];
    for (const [tamper, reason] of cases) {
      const reply = await loginWith({ subject: 'giao-vien-001', tamper });
      assert.equal(reply.status, 401, tamper);
      const event = await context.database
        .selectFrom('external_identity_events')
        .select('reason')
        .where('event_type', '=', 'login_rejected')
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.equal(event.reason, reason, tamper);
    }
  });

  it('state chỉ dùng một lần; lượt liên kết phải hoàn tất trong đúng phiên đã bắt đầu', async () => {
    const started = await postJson(url(`/${CODE}/start`), { channel: 'portal', redirect_uri: redirectUri });
    const issued = mock.authorize(started.body.authorization_url as string, { subject: 'giao-vien-001' });
    assert.equal((await postJson(url('/callback'), { state: issued.state, code: issued.code })).status, 200);
    assert.equal((await postJson(url('/callback'), { state: issued.state, code: issued.code })).status, 401);

    const token = await passwordLogin(other);
    const linkStart = await postJson(
      url(`/${CODE}/link`),
      { password: other.password, redirect_uri: redirectUri },
      token,
    );
    const linkIssued = mock.authorize(linkStart.body.authorization_url as string, { subject: 'giao-vien-002' });
    const noSession = await postJson(url('/callback'), { state: linkIssued.state, code: linkIssued.code });
    assert.equal(noSession.status, 401);
  });

  it('subject đã liên kết với người khác thì không liên kết được; mỗi tài khoản một liên kết mỗi nhà cung cấp', async () => {
    const { reply } = await link(other, { subject: 'giao-vien-001' });
    assert.equal(reply.status, 409);
    const event = await context.database
      .selectFrom('external_identity_events')
      .select(['event_type', 'reason'])
      .where('user_id', '=', other.id)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.deepEqual(event, { event_type: 'link_rejected', reason: 'subject_linked_to_other' });
    const second = await link(teacher, { subject: 'giao-vien-khac' });
    assert.equal(second.reply.status, 409);
  });

  it('quay khóa ở nhà cung cấp: tải lại bộ khóa khi gặp mã khóa lạ, đăng nhập vẫn được', async () => {
    assert.equal((await loginWith({ subject: 'giao-vien-001' })).status, 200);
    const loads = mock.jwksRequests;
    await mock.rotateKeys();
    const reply = await loginWith({ subject: 'giao-vien-001' });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.ok(mock.jwksRequests > loads);
  });

  it('nhóm vai trò được dùng: vai trò ngoài danh sách bị từ chối; người dưới 14 tuổi bị từ chối', async () => {
    assert.equal((await setSettings({ allowed_roles: ['VT-14'] })).status, 200);
    const rejected = await loginWith({ subject: 'giao-vien-001' });
    assert.equal(rejected.status, 403);
    assert.equal(errorCode(rejected.body), 'ERR_FORBIDDEN');
    assert.equal((await setSettings({ allowed_roles: null })).status, 200);
    const child = await loginWith({ subject: 'giao-vien-001', birthdate: '2020-01-01' });
    assert.equal(child.status, 422);
    assert.equal((await loginWith({ subject: 'giao-vien-001', birthdate: '1990-05-05' })).status, 200);
  });

  it('người đã bật xác thực hai lớp vẫn nhập mã; trường bật "coi là đạt" thì không cần', async () => {
    const principal = await createTestUser(context.database, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
    const principalToken = await passwordLogin(principal);
    assert.equal(
      (await putJson(`${context.baseUrl}/auth/settings`, principalToken, { totp_enabled: true })).status,
      200,
    );
    const user = await createTestUser(context.database, { roles: [{ roleCode: 'VT-07', orgUnitId: null }] });
    const userToken = await passwordLogin(user);
    const setup = await postJson(`${context.baseUrl}/auth/totp/setup`, {}, userToken);
    const secret = setup.body.secret as string;
    await postJson(`${context.baseUrl}/auth/totp/confirm`, { code: totpCode(secret, context.clock.now()) }, userToken);
    context.clock.advanceMinutes(1);

    // Liên kết cần cả mật khẩu và mã
    const token = await passwordLogin(user, totpCode(secret, context.clock.now()));
    const noOtp = await postJson(url(`/${CODE}/link`), { password: user.password, redirect_uri: redirectUri }, token);
    assert.equal(noOtp.status, 400);
    context.clock.advanceMinutes(1);
    const started = await postJson(
      url(`/${CODE}/link`),
      { password: user.password, otp_code: totpCode(secret, context.clock.now()), redirect_uri: redirectUri },
      token,
    );
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const issued = mock.authorize(started.body.authorization_url as string, { subject: 'co-hai-lop-001' });
    assert.equal((await postJson(url('/callback'), { state: issued.state, code: issued.code }, token)).status, 200);

    const pending = await loginWith({ subject: 'co-hai-lop-001', acr: 'muc-2' });
    assert.equal(pending.body.status, 'otp_required');
    const ticket = pending.body.ticket as string;
    assert.equal((await postJson(url('/complete'), { ticket, otp_code: '000000' })).status, 401);
    context.clock.advanceMinutes(1);
    const completed = await postJson(url('/complete'), { ticket, otp_code: totpCode(secret, context.clock.now()) });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.status, 'signed_in');

    assert.equal((await setSettings({ satisfies_mfa: true })).status, 200);
    const direct = await loginWith({ subject: 'co-hai-lop-001', acr: 'muc-2' });
    assert.equal(direct.body.status, 'signed_in');
    assert.equal((await setSettings({ satisfies_mfa: false })).status, 200);
    await context.database.deleteFrom('identity_settings').where('key', 'in', PROVIDER_KEYS).execute();
  });

  it('trường tắt nhà cung cấp: đăng nhập dở dang bị từ chối, nút biến mất', async () => {
    const started = await postJson(url(`/${CODE}/start`), { channel: 'portal', redirect_uri: redirectUri });
    const issued = mock.authorize(started.body.authorization_url as string, { subject: 'giao-vien-001' });
    assert.equal((await setSettings({ enabled: false })).status, 200);
    const reply = await postJson(url('/callback'), { state: issued.state, code: issued.code });
    assert.equal(reply.status, 422);
    assert.deepEqual((await getJson(url('/providers'))).body.providers, []);
    assert.equal((await setSettings({ enabled: true })).status, 200);
  });

  it('gỡ liên kết cần mật khẩu; sau đó không đăng nhập được bằng nhà cung cấp; nhật ký đủ các bước', async () => {
    const token = await passwordLogin(teacher);
    assert.equal((await postJson(url(`/${CODE}/unlink`), { password: 'sai' }, token)).status, 400);
    const removed = await postJson(url(`/${CODE}/unlink`), { password: TEST_PASSWORD }, token);
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.links, []);
    assert.equal((await loginWith({ subject: 'giao-vien-001' })).status, 401);
    const events = await getJson(url('/events'), token);
    const types = (events.body.events as Array<{ event_type: string }>).map((event) => event.event_type);
    for (const type of ['linked', 'login', 'unlinked']) {
      assert.ok(types.includes(type), type);
    }
  });
});

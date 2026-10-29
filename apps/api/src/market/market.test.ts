import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { canConnect, startMarketplaceTestDatabase, type MarketplaceTestDatabase } from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import { startMultiTenantApi, sendWithHost, type MultiTenantApi, type Reply } from '../tenant-test-support.js';
import { signMarketLinkCode } from './market-link-code.js';
import { MarketMessenger } from './market-messenger.js';
import { hashStudentForMarket } from './market-tokens.js';

// Nền chợ gia sư (DT-27 phần 27f, YCTD-256), kịch bản CT-27f-2 đến CT-27f-5: cách ly chợ với các trường (đường dẫn, tên miền, mã phiên,
// vai trò cơ sở dữ liệu), cấu hình ở cổng nền tảng với thu tiền thật bị chặn, tài khoản phụ huynh và hồ sơ con có đồng ý theo phiên bản,
// liên kết với trường bằng mã ký, tài khoản gia sư. Hai trường giả, dữ liệu giả, không gọi dịch vụ thật
const CONSOLE_HOST = 'platform.e2e.localhost';
const MARKET_HOST = 'cho-gia-su.e2e.localhost';
// Ứng dụng Gia sư (YCTD-262): tên miền riêng, chỉ nhận tài khoản gia sư
const TUTOR_HOST = 'gia-su.e2e.localhost';
const LINK_SECRET = 'bi-mat-lien-ket-kiem-thu-khong-dung-that';

describe('chợ gia sư: nền (27f)', () => {
  let environment: MultiTenantApi;
  let market: MarketplaceTestDatabase;
  let operatorToken = '';
  const documents: Record<string, string> = {};

  const marketCall = (
    method: string,
    path: string,
    body?: unknown,
    token?: string,
    host = MARKET_HOST,
  ): Promise<Reply> =>
    sendWithHost(environment.apiOrigin, {
      method,
      path: `/api/v1/market${path}`,
      host,
      ...(token ? { token } : {}),
      ...(body !== undefined ? { body } : {}),
    });
  const admin = (method: string, path: string, body?: unknown) =>
    marketCall(method, `/admin${path}`, body, operatorToken, CONSOLE_HOST);

  async function register(kind: 'parent' | 'tutor', email: string, extra: string[] = []) {
    const accepted = [documents.terms, documents.privacy, ...extra];
    const host = kind === 'tutor' ? TUTOR_HOST : MARKET_HOST;
    const reply = await marketCall(
      'POST',
      '/auth/register',
      {
        kind,
        email,
        display_name: kind === 'parent' ? 'Phụ huynh giả' : 'Gia sư giả',
        password: 'matkhau123',
        accepted_document_ids: accepted,
      },
      undefined,
      host,
    );
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const token = reply.body.session_token as string;
    const message = environment.api.get(MarketMessenger).lastTo(email);
    const code = /(\d{6})/.exec(message?.text ?? '')?.[1];
    assert.ok(code, 'đã gửi mã xác nhận vào hộp thư giả lập');
    const verified = await marketCall('POST', '/auth/verify', { code }, token, host);
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    return token;
  }

  before(async () => {
    market = await startMarketplaceTestDatabase('api');
    environment = await startMultiTenantApi({
      label: 'cho',
      configuration: {
        platformConsoleHost: CONSOLE_HOST,
        marketplaceDatabaseUrl: market.url,
        marketLinkSecret: LINK_SECRET,
      },
    });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    const login = `van-hanh-cho-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(
      environment.platform.platform,
      environment.platform.masterKey,
      {
        login,
        fullName: 'Nhân viên chợ giả',
        password: OPERATOR_TEST_PASSWORD,
      },
    );
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(
          environment.platform.platform,
          created.id,
          created.secret,
          environment.identity.clock.now(),
        ),
      },
    });
    operatorToken = reply.body.access_token as string;
  });

  after(async () => {
    await environment?.close();
    await market?.close();
  });

  it('CT-27f-2: cấu hình ở cổng nền tảng, thu tiền thật bị chặn; chợ tắt hoặc sai tên miền thì 404', async () => {
    // Chợ tắt mặc định: tên miền của chợ cũng 404
    assert.equal((await marketCall('GET', '/public/site')).status, 404);
    const overview = await admin('GET', '');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal((overview.body.settings as { real_payments_enabled: boolean }).real_payments_enabled, false);
    // Quản trị chỉ ở tên miền cổng nền tảng với mã phiên vận hành
    assert.equal((await marketCall('GET', '/admin', undefined, operatorToken)).status, 404);
    assert.equal((await marketCall('GET', '/admin', undefined, environment.tokens.alpha, CONSOLE_HOST)).status, 401);

    const blocked = await admin('PUT', '/settings', {
      enabled: true,
      host: MARKET_HOST,
      tutor_host: TUTOR_HOST,
      real_payments_enabled: true,
    });
    assert.equal(blocked.status, 400, JSON.stringify(blocked.body));
    assert.match(JSON.stringify(blocked.body), /E-01 đến E-07/);
    const saved = await admin('PUT', '/settings', {
      enabled: true,
      host: MARKET_HOST,
      tutor_host: TUTOR_HOST,
      default_commission_percent: 10,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const settings = saved.body.settings as Record<string, unknown>;
    assert.equal(settings.enabled, true);
    assert.equal(settings.real_payments_enabled, false);
    // Ghi thẳng giá trị bật vào cơ sở dữ liệu nền tảng cũng không mở được
    await environment.platform.platform
      .updateTable('platform_settings')
      .set({ value: JSON.stringify({ ...settings, real_payments_enabled: true }) })
      .where('key', '=', 'market')
      .execute();
    const reread = await admin('GET', '');
    assert.equal((reread.body.settings as { real_payments_enabled: boolean }).real_payments_enabled, false);

    for (const kind of ['terms', 'privacy', 'parent_consent', 'tutor_terms']) {
      const published = await admin('POST', '/documents', {
        kind,
        title: `Văn bản ${kind}`,
        body: `Nội dung giả của ${kind}`,
      });
      assert.equal(published.status, 201, JSON.stringify(published.body));
      assert.equal(published.body.version, 1);
      documents[kind] = published.body.id as string;
    }
    const site = await marketCall('GET', '/public/site');
    assert.equal(site.status, 200, JSON.stringify(site.body));
    assert.equal(site.body.real_payments, false);
    assert.equal((site.body.documents as unknown[]).length, 4);
    // Tên miền của trường không phục vụ chợ
    const onSchool = await sendWithHost(environment.apiOrigin, {
      path: '/api/v1/market/public/site',
      host: environment.hosts.alpha,
    });
    assert.equal(onSchool.status, 404);
  });

  it('CT-27f-3: cách ly: vai trò của chợ không vào được cơ sở dữ liệu trường, mã phiên hai bên không dùng chéo', async () => {
    const tenant = await environment.tenantOf('alpha');
    const schoolUrl = new URL(environment.apiRuntime.registry.connectionString(tenant, 'system', 'system'));
    const marketUrl = new URL(market.url);
    schoolUrl.username = marketUrl.username;
    schoolUrl.password = marketUrl.password;
    assert.equal(
      await canConnect(schoolUrl.toString()),
      false,
      'vai trò của chợ không kết nối được cơ sở dữ liệu trường',
    );
    assert.equal(await canConnect(market.url), true);

    const parent = await register('parent', `phu-huynh-cach-ly-${Date.now()}@example.test`);
    // Mã phiên của trường không dùng được ở chợ, phiên chợ không dùng được ở trường
    assert.equal((await marketCall('GET', '/me', undefined, environment.tokens.alpha)).status, 401);
    assert.equal((await environment.call('alpha', 'GET', '/parent-org-consents', undefined, parent)).status, 401);
  });

  it('CT-27f-4: phụ huynh: đồng ý theo phiên bản, mã xác nhận, hồ sơ con tối thiểu, rút đồng ý, liên kết với trường', async () => {
    const email = `phu-huynh-${Date.now()}@example.test`;
    // Thiếu đồng ý văn bản bắt buộc thì không đăng ký được
    const missing = await marketCall('POST', '/auth/register', {
      kind: 'parent',
      email,
      display_name: 'Phụ huynh giả',
      password: 'matkhau123',
      accepted_document_ids: [documents.terms],
    });
    assert.equal(missing.status, 400);
    const pending = await marketCall('POST', '/auth/register', {
      kind: 'parent',
      email: `cho-xac-nhan-${email}`,
      display_name: 'Chưa xác nhận',
      password: 'matkhau123',
      accepted_document_ids: [documents.terms, documents.privacy],
    });
    const pendingToken = pending.body.session_token as string;
    assert.equal((await marketCall('GET', '/children', undefined, pendingToken)).status, 403);
    assert.equal((await marketCall('POST', '/auth/verify', { code: '000000' }, pendingToken)).status, 400);

    const token = await register('parent', email);
    const me = await marketCall('GET', '/me', undefined, token);
    assert.equal(me.body.status, 'active');
    assert.deepEqual(me.body.consents_needed, []);

    // Hồ sơ con cần đồng ý của cha mẹ; Tiểu học chỉ lớp 1 đến 5
    const child = { display_name: 'Bé An', birth_year: new Date().getFullYear() - 12, school_level: 'THCS', grade: 7 };
    assert.equal((await marketCall('POST', '/children', child, token)).status, 400);
    assert.equal(
      (
        await marketCall(
          'POST',
          '/children',
          { ...child, school_level: 'TH', consent_document_id: documents.parent_consent },
          token,
        )
      ).status,
      400,
    );
    const created = await marketCall(
      'POST',
      '/children',
      { ...child, consent_document_id: documents.parent_consent },
      token,
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const childId = created.body.id as string;
    let list = await marketCall('GET', '/children', undefined, token);
    let row = (list.body.children as Array<Record<string, unknown>>)[0];
    assert.equal(row?.consent_current, true);
    assert.deepEqual(Object.keys(row ?? {}).sort(), [
      'birth_year',
      'consent_current',
      'created_at',
      'display_name',
      'grade',
      'id',
      'reads_messages',
      'school_level',
      'school_link',
    ]);
    assert.equal((await marketCall('POST', `/children/${childId}/consent/withdraw`, {}, token)).status, 200);
    list = await marketCall('GET', '/children', undefined, token);
    assert.equal((list.body.children as Array<Record<string, unknown>>)[0]?.consent_current, false);

    // Liên kết với trường bằng mã ký ở trường: mã sai, hết hạn bị từ chối; mã đúng chỉ để lại mã trường, mã băm, lớp
    assert.equal((await marketCall('POST', `/children/${childId}/school-link`, { code: 'sai.ma' }, token)).status, 400);
    const schoolCode = environment.platform.school('alpha').code;
    const studentHash = hashStudentForMarket(LINK_SECRET, schoolCode, '00000000-0000-4000-8000-000000000001');
    const expired = signMarketLinkCode(LINK_SECRET, {
      schoolCode,
      studentHash,
      schoolLevel: 'THCS',
      grade: 8,
      expiresAt: Date.now() - 1000,
    });
    assert.equal((await marketCall('POST', `/children/${childId}/school-link`, { code: expired }, token)).status, 400);
    const code = signMarketLinkCode(LINK_SECRET, {
      schoolCode,
      studentHash,
      schoolLevel: 'THCS',
      grade: 8,
      expiresAt: Date.now() + 60_000,
    });
    const linked = await marketCall('POST', `/children/${childId}/school-link`, { code }, token);
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    const link = await marketCall('GET', '/children', undefined, token);
    row = (link.body.children as Array<Record<string, unknown>>)[0];
    assert.deepEqual(row?.school_link && { ...(row.school_link as object), linked_at: undefined }, {
      school_code: schoolCode,
      grade: 8,
      linked_at: undefined,
    });
    assert.equal(row?.grade, 8);

    // Phần ở trường: nút chỉ hiện khi nền tảng đã nối chợ; người không phải cha mẹ không lấy được mã (trường giả chưa mở năm học nên bị
    // chặn ở bước đọc năm học, 422, trước bước kiểm cha mẹ, 403; cả hai đều không cấp mã)
    const available = await environment.call(
      'alpha',
      'GET',
      '/children/00000000-0000-4000-8000-000000000001/market-link',
    );
    assert.equal(available.status, 200, JSON.stringify(available.body));
    assert.equal(available.body.available, true);
    const notGuardian = await environment.call(
      'alpha',
      'POST',
      '/children/00000000-0000-4000-8000-000000000001/market-link',
      {},
    );
    assert.ok([403, 422].includes(notGuardian.status), JSON.stringify(notGuardian.body));
    assert.equal(notGuardian.body.code, undefined);

    // Hồ sơ con của phụ huynh khác: 404
    const other = await register('parent', `phu-huynh-khac-${Date.now()}@example.test`);
    assert.equal((await marketCall('PUT', `/children/${childId}`, child, other)).status, 404);
    assert.equal((await marketCall('DELETE', `/children/${childId}`, undefined, token)).status, 204);
  });

  it('CT-27f-5: gia sư: thêm điều khoản của gia sư, hồ sơ và cơ sở dạy thêm tối thiểu; phiên bản văn bản mới cần đồng ý lại', async () => {
    const email = `gia-su-${Date.now()}@example.test`;
    const tutorCall = (method: string, path: string, body?: unknown, token?: string) =>
      marketCall(method, path, body, token, TUTOR_HOST);
    // Mỗi ứng dụng một vai (YCTD-262): gia sư không đăng ký ở Chợ gia sư
    const onMarket = await marketCall('POST', '/auth/register', {
      kind: 'tutor',
      email,
      display_name: 'Gia sư giả',
      password: 'matkhau123',
      accepted_document_ids: [documents.terms, documents.privacy, documents.tutor_terms],
    });
    assert.equal(onMarket.status, 400, JSON.stringify(onMarket.body));
    const noTutorTerms = await tutorCall('POST', '/auth/register', {
      kind: 'tutor',
      email,
      display_name: 'Gia sư giả',
      password: 'matkhau123',
      accepted_document_ids: [documents.terms, documents.privacy],
    });
    assert.equal(noTutorTerms.status, 400);
    const token = await register('tutor', email, [documents.tutor_terms as string]);
    assert.equal((await tutorCall('GET', '/children', undefined, token)).status, 403);
    const profile = await tutorCall(
      'PUT',
      '/tutor/profile',
      { headline: 'Dạy Toán THCS', bio: 'Giới thiệu giả' },
      token,
    );
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    const provider = await tutorCall('PUT', '/tutor/provider', { kind: 'individual', name: 'Gia sư giả' }, token);
    assert.equal(provider.status, 200, JSON.stringify(provider.body));
    assert.equal((provider.body.provider as { business_registration_no: unknown }).business_registration_no, null);

    // Nền tảng đăng điều khoản phiên bản 2: phải đồng ý lại mới dùng tiếp
    const v2 = await admin('POST', '/documents', {
      kind: 'terms',
      title: 'Điều khoản sửa đổi',
      body: 'Nội dung giả 2',
    });
    assert.equal(v2.body.version, 2);
    assert.equal((await tutorCall('GET', '/tutor/profile', undefined, token)).status, 409);
    const me = await tutorCall('GET', '/me', undefined, token);
    assert.deepEqual(
      (me.body.consents_needed as Array<{ id: string }>).map((row) => row.id),
      [v2.body.id],
    );
    assert.equal((await tutorCall('POST', `/me/consents/${v2.body.id as string}`, {}, token)).status, 200);
    assert.equal((await tutorCall('GET', '/tutor/profile', undefined, token)).status, 200);

    // Phiên gia sư không dùng được ở tên miền của chợ; đăng nhập đúng mật khẩu ở chợ chỉ được dẫn sang ứng dụng Gia sư
    assert.equal((await marketCall('GET', '/me', undefined, token)).status, 401);
    const wrongApp = await marketCall('POST', '/auth/login', { login: email, password: 'matkhau123' });
    assert.equal(wrongApp.status, 403, JSON.stringify(wrongApp.body));
    assert.match(JSON.stringify(wrongApp.body), /ứng dụng Gia sư/);

    // Đăng nhập lại; sai mật khẩu 5 lần thì khóa 15 phút
    assert.equal((await tutorCall('POST', '/auth/login', { login: email, password: 'matkhau123' })).status, 200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await tutorCall('POST', '/auth/login', { login: email, password: 'sai12345' })).status, 401);
    }
    assert.equal((await tutorCall('POST', '/auth/login', { login: email, password: 'matkhau123' })).status, 403);
  });
});

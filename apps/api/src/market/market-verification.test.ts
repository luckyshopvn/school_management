import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startMarketplaceTestDatabase, type MarketplaceTestDatabase } from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  MockOidcServer,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import { parseProviderDefinition } from '@school-management/server/external-identity';
import { startMultiTenantApi, sendWithHost, type MultiTenantApi, type Reply } from '../tenant-test-support.js';
import { MarketMessenger } from './market-messenger.js';

// Hồ sơ, xác minh gia sư, hàng chờ duyệt, tìm gia sư (DT-27 phần 27g, YCTD-257), CT-27g-2 đến CT-27g-4: xác minh danh tính qua OIDC giả
// lập (đủ 18 tuổi, một người một tài khoản), đăng nhập OIDC; giáo viên công lập không có môn của chương trình; nộp lý lịch tư pháp có mã
// hóa, nhân viên nền tảng xem tệp (có nhật ký) và duyệt; hồ sơ đã duyệt hiện ở tìm kiếm theo Mẫu 02, không lộ liên hệ. Dữ liệu giả
const CONSOLE_HOST = 'platform.e2e.localhost';
const MARKET_HOST = 'cho-gia-su.e2e.localhost';
const TUTOR_HOST = 'gia-su.e2e.localhost';
const RETURN_URL = `http://${TUTOR_HOST}:5388/xac-minh`;
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(64)]);

function adultBirthdate(): string {
  return `${new Date().getFullYear() - 30}-01-15`;
}

function minorBirthdate(): string {
  return `${new Date().getFullYear() - 16}-01-15`;
}

describe('chợ gia sư: hồ sơ và xác minh gia sư (27g)', () => {
  let environment: MultiTenantApi;
  let market: MarketplaceTestDatabase;
  let mock: MockOidcServer;
  let operatorToken = '';
  const documents: Record<string, string> = {};

  const call = (host: string, method: string, path: string, body?: unknown, token?: string): Promise<Reply> =>
    sendWithHost(environment.apiOrigin, {
      method,
      path: `/api/v1/market${path}`,
      host,
      ...(token ? { token } : {}),
      ...(body !== undefined ? { body } : {}),
    });
  const tutorCall = (method: string, path: string, body?: unknown, token?: string) =>
    call(TUTOR_HOST, method, path, body, token);
  const admin = (method: string, path: string, body?: unknown) =>
    call(CONSOLE_HOST, method, `/admin${path}`, body, operatorToken);

  // Gửi biểu mẫu nhiều phần có tiêu đề Host (fetch của Node không cho đặt Host)
  function upload(path: string, token: string, fields: Record<string, string>, file: Buffer): Promise<Reply> {
    const boundary = `----bien${randomBytes(8).toString('hex')}`;
    const parts: Buffer[] = [];
    for (const [name, value] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="giay-to.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    );
    const payload = Buffer.concat(parts);
    const url = new URL(`${environment.apiOrigin}/api/v1/market${path}`);
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            host: TUTOR_HOST,
            authorization: `Bearer ${token}`,
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': payload.length,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
            }),
          );
        },
      );
      request.on('error', reject);
      request.end(payload);
    });
  }

  async function registerTutor(email: string): Promise<{ token: string; id: string }> {
    const reply = await tutorCall('POST', '/auth/register', {
      kind: 'tutor',
      email,
      display_name: `Gia sư giả ${email.slice(0, 6)}`,
      password: 'matkhau123',
      accepted_document_ids: [documents.terms, documents.privacy, documents.tutor_terms],
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const token = reply.body.session_token as string;
    const code = /(\d{6})/.exec(environment.api.get(MarketMessenger).lastTo(email)?.text ?? '')?.[1];
    assert.equal((await tutorCall('POST', '/auth/verify', { code }, token)).status, 200);
    const me = await tutorCall('GET', '/me', undefined, token);
    return { token, id: me.body.id as string };
  }

  // Một lượt OIDC: bắt đầu ở máy chủ, nhà cung cấp giả cấp mã cho danh tính đã chọn, ứng dụng gửi mã và state về máy chủ
  async function oidc(purpose: 'verify' | 'login', identity: { subject: string; birthdate?: string }, token?: string) {
    const started = await tutorCall(
      'POST',
      '/identity/start',
      { provider: 'gia-lap', purpose, return_url: RETURN_URL },
      token,
    );
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const { code, state } = mock.authorize(started.body.authorization_url as string, identity);
    return { state, reply: await tutorCall('POST', '/identity/complete', { state, code }, token) };
  }

  before(async () => {
    mock = await new MockOidcServer().start();
    market = await startMarketplaceTestDatabase('xm');
    environment = await startMultiTenantApi({
      label: 'xm',
      configuration: {
        platformConsoleHost: CONSOLE_HOST,
        marketplaceDatabaseUrl: market.url,
        marketFilesKey: randomBytes(32),
        marketIdentityProviders: [
          parseProviderDefinition(
            {
              code: 'gia-lap',
              profile: 'oidc',
              issuer: mock.issuer,
              client_id: mock.clientId,
              birthdate_claim: 'birthdate',
              jwks_cooldown_seconds: 0,
            },
            { 'gia-lap': mock.clientSecret },
          ),
        ],
      },
    });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    const login = `van-hanh-xm-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(
      environment.platform.platform,
      environment.platform.masterKey,
      {
        login,
        fullName: 'Nhân viên duyệt giả',
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
    assert.equal(
      (await admin('PUT', '/settings', { enabled: true, host: MARKET_HOST, tutor_host: TUTOR_HOST })).status,
      200,
    );
    for (const kind of ['terms', 'privacy', 'tutor_terms']) {
      const published = await admin('POST', '/documents', { kind, title: `Văn bản ${kind}`, body: 'Nội dung giả' });
      documents[kind] = published.body.id as string;
    }
  });

  after(async () => {
    await environment?.close();
    await market?.close();
    await mock?.stop();
  });

  it('CT-27g-2: xác minh danh tính qua OIDC giả lập: dưới 18 tuổi bị từ chối, một người một tài khoản, đăng nhập OIDC', async () => {
    const first = await registerTutor(`gia-su-dd-${Date.now()}@example.test`);
    assert.equal((await tutorCall('GET', '/identity/providers')).status, 200);
    const badReturn = await tutorCall(
      'POST',
      '/identity/start',
      { provider: 'gia-lap', purpose: 'verify', return_url: `http://${MARKET_HOST}/xac-minh` },
      first.token,
    );
    assert.equal(badReturn.status, 400);
    // Ứng dụng phụ huynh không có xác minh gia sư
    assert.equal((await call(MARKET_HOST, 'GET', '/identity/providers')).status, 404);

    const minor = await oidc(
      'verify',
      { subject: `vi-thanh-nien-${Date.now()}`, birthdate: minorBirthdate() },
      first.token,
    );
    assert.equal(minor.reply.body.status, 'rejected', JSON.stringify(minor.reply.body));
    const noBirthdate = await oidc('verify', { subject: `khong-ngay-sinh-${Date.now()}` }, first.token);
    assert.equal(noBirthdate.reply.body.status, 'rejected');

    const subject = `nguoi-lon-${Date.now()}`;
    const adult = await oidc('verify', { subject, birthdate: adultBirthdate() }, first.token);
    assert.equal(adult.reply.body.status, 'approved', JSON.stringify(adult.reply.body));
    // State chỉ dùng một lần
    assert.equal(
      (await tutorCall('POST', '/identity/complete', { state: adult.state, code: 'x' }, first.token)).status,
      400,
    );
    const listing = await tutorCall('GET', '/tutor/listing', undefined, first.token);
    assert.equal((listing.body.verification_state as Record<string, string>).identity, 'approved');
    assert.equal((listing.body.badges as Record<string, boolean>).identity, true);

    // Cùng một người không xác minh cho tài khoản gia sư thứ hai
    const second = await registerTutor(`gia-su-hai-${Date.now()}@example.test`);
    const reused = await oidc('verify', { subject, birthdate: adultBirthdate() }, second.token);
    assert.equal(reused.reply.body.status, 'rejected');
    assert.match(String(reused.reply.body.note), /tài khoản gia sư khác/);

    // Đăng nhập OIDC: đúng tài khoản đã xác minh; định danh chưa gắn tài khoản thì bị từ chối
    const login = await oidc('login', { subject, birthdate: adultBirthdate() });
    assert.equal(login.reply.status, 200, JSON.stringify(login.reply.body));
    const me = await tutorCall('GET', '/me', undefined, login.reply.body.session_token as string);
    assert.equal(me.body.id, first.id);
    const stranger = await oidc('login', { subject: `nguoi-la-${Date.now()}`, birthdate: adultBirthdate() });
    assert.equal(stranger.reply.status, 403);
  });

  it('CT-27g-3: giáo viên công lập không có môn của chương trình; hồ sơ gửi duyệt cần danh tính, giờ trống, đăng ký kinh doanh', async () => {
    const tutor = await registerTutor(`gia-su-gv-${Date.now()}@example.test`);
    const subject = {
      subject: 'Toán',
      school_level: 'THCS',
      grade_from: 6,
      grade_to: 9,
      content_kind: 'curriculum',
      price_per_session: 200_000,
      session_minutes: 60,
    };
    const slot = { weekday: 3, start_minute: 1080, end_minute: 1200 };
    assert.equal(
      (await tutorCall('PUT', '/tutor/listing', { subjects: [subject], availability: [slot] }, tutor.token)).status,
      200,
    );
    // Đang có môn của chương trình thì không khai là giáo viên công lập được
    const role = { school_name: 'Trường THCS giả', is_public: true, subjects: 'Toán', grades: '7A, 8B' };
    assert.equal((await tutorCall('PUT', '/tutor/school-role', role, tutor.token)).status, 400);
    assert.equal(
      (
        await tutorCall(
          'PUT',
          '/tutor/listing',
          { subjects: [{ ...subject, content_kind: 'enrichment', subject: 'Cờ vua' }], availability: [slot] },
          tutor.token,
        )
      ).status,
      200,
    );
    assert.equal((await tutorCall('PUT', '/tutor/school-role', role, tutor.token)).status, 200);
    const blocked = await tutorCall(
      'PUT',
      '/tutor/listing',
      { subjects: [subject], availability: [slot] },
      tutor.token,
    );
    assert.equal(blocked.status, 400);
    assert.match(JSON.stringify(blocked.body), /Thông tư 29/);
    const form03 = await tutorCall('GET', '/tutor/form-03', undefined, tutor.token);
    assert.equal(form03.status, 200);
    assert.equal(form03.body.school_name, 'Trường THCS giả');
    // Chưa xác minh danh tính thì không gửi duyệt được
    const submit = await tutorCall('POST', '/tutor/listing/submit', undefined, tutor.token);
    assert.equal(submit.status, 409);
    assert.match(JSON.stringify(submit.body), /danh tính/);
  });

  it('CT-27g-4: lý lịch tư pháp mã hóa, nhân viên xem và duyệt; hồ sơ duyệt hiện ở tìm kiếm theo Mẫu 02, không lộ liên hệ', async () => {
    const email = `gia-su-duyet-${Date.now()}@example.test`;
    const tutor = await registerTutor(email);
    await oidc('verify', { subject: `duyet-${Date.now()}`, birthdate: adultBirthdate() }, tutor.token);
    const subject = {
      subject: 'Tiếng Anh giao tiếp',
      school_level: 'THCS',
      grade_from: 6,
      grade_to: 9,
      content_kind: 'enrichment',
      price_per_session: 150_000,
      session_minutes: 60,
    };
    await tutorCall(
      'PUT',
      '/tutor/listing',
      { subjects: [subject], availability: [{ weekday: 6, start_minute: 540, end_minute: 660 }] },
      tutor.token,
    );

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const old = await upload('/tutor/verifications/criminal_record', tutor.token, { issued_on: '2020-01-01' }, PDF);
    assert.equal(old.status, 400);
    const notPdf = await upload(
      '/tutor/verifications/criminal_record',
      tutor.token,
      { issued_on: today },
      Buffer.from('khong phai pdf'),
    );
    assert.equal(notPdf.status, 400);
    const uploaded = await upload('/tutor/verifications/criminal_record', tutor.token, { issued_on: today }, PDF);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal((await tutorCall('POST', '/tutor/listing/submit', undefined, tutor.token)).status, 200);

    // Hàng chờ của nhân viên: hồ sơ chờ duyệt, giấy tờ chờ duyệt; tệp mở ra đúng bản gốc (kho tệp chỉ giữ bản mã hóa)
    const queue = await admin('GET', '/reviews');
    assert.ok((queue.body.profiles as Array<{ id: string }>).some((row) => row.id === tutor.id));
    const detail = await admin('GET', `/reviews/tutors/${tutor.id}`);
    const document = (detail.body.documents as Array<{ id: string }>)[0];
    assert.ok(document);
    const file = await new Promise<Buffer>((resolve, reject) => {
      const url = new URL(`${environment.apiOrigin}/api/v1/market/admin/reviews/documents/${document.id}`);
      http
        .get(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { host: CONSOLE_HOST, authorization: `Bearer ${operatorToken}` },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
          },
        )
        .on('error', reject);
    });
    assert.ok(file.equals(PDF), 'tệp giải mã đúng bản gốc');
    // Chưa duyệt lý lịch thì không duyệt hồ sơ được; từ chối phải có lý do
    assert.equal((await admin('POST', `/reviews/tutors/${tutor.id}/profile`, { decision: 'approve' })).status, 409);
    assert.equal(
      (await admin('POST', `/reviews/tutors/${tutor.id}/verifications/criminal_record`, { decision: 'reject' })).status,
      400,
    );
    assert.equal(
      (await admin('POST', `/reviews/tutors/${tutor.id}/verifications/criminal_record`, { decision: 'approve' }))
        .status,
      200,
    );
    assert.equal((await admin('POST', `/reviews/tutors/${tutor.id}/profile`, { decision: 'approve' })).status, 200);

    // Tìm kiếm ở ứng dụng phụ huynh; ứng dụng Gia sư không có tìm kiếm
    const found = await call(MARKET_HOST, 'GET', '/public/tutors?subject=anh&school_level=THCS&grade=7&weekday=6');
    assert.equal(found.status, 200, JSON.stringify(found.body));
    const card = (found.body.tutors as Array<Record<string, unknown>>).find((row) => row.id === tutor.id);
    assert.ok(card, 'gia sư đã duyệt hiện ở tìm kiếm');
    assert.equal(card.min_price, 150_000);
    assert.equal((await call(MARKET_HOST, 'GET', '/public/tutors?subject=hoa')).body.tutors instanceof Array, true);
    assert.equal((await call(TUTOR_HOST, 'GET', '/public/tutors')).status, 404);
    const page = await call(MARKET_HOST, 'GET', `/public/tutors/${tutor.id}`);
    assert.equal(page.status, 200);
    assert.equal((page.body.form02 as { place: string }).place, 'Trực tuyến qua Chợ gia sư');
    assert.equal(JSON.stringify(page.body).includes(email), false, 'không lộ thư điện tử');

    // Sửa hồ sơ đã duyệt: về chờ duyệt, ẩn khỏi tìm kiếm
    await tutorCall(
      'PUT',
      '/tutor/listing',
      {
        subjects: [{ ...subject, price_per_session: 180_000 }],
        availability: [{ weekday: 6, start_minute: 540, end_minute: 660 }],
      },
      tutor.token,
    );
    assert.equal((await call(MARKET_HOST, 'GET', `/public/tutors/${tutor.id}`)).status, 404);
  });
});

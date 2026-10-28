import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  startMarketplaceTestDatabase,
  type MarketplaceDatabase,
  type MarketplaceTestDatabase,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { startMultiTenantApi, sendWithHost, type MultiTenantApi, type Reply } from '../tenant-test-support.js';
import { MarketContext } from './market-context.js';
import { MarketMessenger } from './market-messenger.js';
import { MarketplacePaymentProvider, type MockMarketplacePaymentProvider } from './market-payment-provider.js';

// An toàn trẻ em và kiểm duyệt ở chợ gia sư (DT-27 phần 27i, YCTD-259), CT-27i-2 đến CT-27i-5. Gia sư đã duyệt dựng thẳng trong cơ sở
// dữ liệu chợ như kiểm thử 27h; phòng video là bộ giả lập (dừng ghi trả ngay một tệp nhỏ). Dữ liệu giả, không có tiền thật
const CONSOLE_HOST = 'platform.e2e.localhost';
const MARKET_HOST = 'cho-gia-su.e2e.localhost';
const TUTOR_HOST = 'gia-su.e2e.localhost';
const HOUR = 3_600_000;

describe('chợ gia sư: an toàn trẻ em và kiểm duyệt (27i)', () => {
  let environment: MultiTenantApi;
  let market: MarketplaceTestDatabase;
  let database: Kysely<MarketplaceDatabase>;
  let provider: MockMarketplacePaymentProvider;
  const operators: string[] = [];
  const documents: Record<string, string> = {};

  const call = (host: string, method: string, path: string, body?: unknown, token?: string): Promise<Reply> =>
    sendWithHost(environment.apiOrigin, {
      method,
      path: `/api/v1/market${path}`,
      host,
      ...(token ? { token } : {}),
      ...(body !== undefined ? { body } : {}),
    });
  const admin = (method: string, path: string, body?: unknown, operator = 0) =>
    call(CONSOLE_HOST, method, `/admin${path}`, body, operators[operator]);

  // Tải nhị phân kèm tiêu đề phản hồi (bản ghi)
  function raw(host: string, path: string, token: string) {
    const url = new URL(`/api/v1/market${path}`, environment.apiOrigin);
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      const request = http.request(
        url,
        { method: 'GET', headers: { host, authorization: `Bearer ${token}` } },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
          );
        },
      );
      request.on('error', reject);
      request.end();
    });
  }

  async function operatorToken(name: string): Promise<string> {
    const login = `kiem-duyet-${name}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(
      environment.platform.platform,
      environment.platform.masterKey,
      { login, fullName: `Nhân viên ${name}`, password: OPERATOR_TEST_PASSWORD },
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
    return reply.body.access_token as string;
  }

  async function registerParent(): Promise<{ id: string; token: string; childId: string; email: string }> {
    const email = `phu-huynh-${Math.random().toString(36).slice(2, 10)}@example.test`;
    const reply = await call(MARKET_HOST, 'POST', '/auth/register', {
      kind: 'parent',
      email,
      display_name: 'Phụ huynh giả',
      password: 'matkhau123',
      accepted_document_ids: [documents.terms, documents.privacy],
    });
    const token = reply.body.session_token as string;
    const code = /(\d{6})/.exec(environment.api.get(MarketMessenger).lastTo(email)?.text ?? '')?.[1];
    assert.equal((await call(MARKET_HOST, 'POST', '/auth/verify', { code }, token)).status, 200);
    const child = await call(
      MARKET_HOST,
      'POST',
      '/children',
      {
        display_name: 'Bé Thử',
        birth_year: new Date().getFullYear() - 12,
        school_level: 'THCS',
        grade: 7,
        consent_document_id: documents.parent_consent,
      },
      token,
    );
    assert.equal(child.status, 201, JSON.stringify(child.body));
    const account = await database
      .selectFrom('market_accounts')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    return { id: account.id, token, childId: child.body.id as string, email };
  }

  async function seedTutor() {
    const email = `gia-su-${Math.random().toString(36).slice(2, 10)}@example.test`;
    const { hash } = await import('@node-rs/argon2');
    const account = await database
      .insertInto('market_accounts')
      .values({
        kind: 'tutor',
        email,
        phone: null,
        password_hash: await hash('matkhau123'),
        display_name: 'Gia sư dựng sẵn',
        status: 'active',
        verified_at: new Date(),
        locked_until: null,
        last_login_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database
      .insertInto('market_tutor_profiles')
      .values({ account_id: account.id, status: 'approved', published_at: new Date() })
      .execute();
    const subject = await database
      .insertInto('market_tutor_subjects')
      .values({
        account_id: account.id,
        subject: 'Cờ vua',
        school_level: 'THCS',
        grade_from: 6,
        grade_to: 9,
        content_kind: 'enrichment',
        price_per_session: 150_000,
        session_minutes: 60,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await database
      .insertInto('market_tutor_availability')
      .values(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          account_id: account.id,
          weekday,
          start_minute: 0,
          end_minute: 1440,
        })),
      )
      .execute();
    await database
      .insertInto('market_tutor_verifications')
      .values(
        (['identity', 'criminal_record'] as const).map((kind) => ({
          account_id: account.id,
          kind,
          status: 'approved' as const,
          details: '{}',
          document_id: null,
          decided_at: new Date(),
          decided_by: 'thu',
          note: null,
          valid_until: kind === 'criminal_record' ? `${new Date().getFullYear() + 1}-12-31` : null,
        })),
      )
      .execute();
    await database
      .insertInto('market_consents')
      .values(
        ['terms', 'privacy', 'tutor_terms'].map((kind) => ({
          account_id: account.id,
          document_id: documents[kind] as string,
          child_id: null,
        })),
      )
      .execute();
    const login = await call(TUTOR_HOST, 'POST', '/auth/login', { login: email, password: 'matkhau123' });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return { id: account.id, token: login.body.session_token as string, subject: subject.id };
  }

  async function paidBooking(
    parent: { token: string; childId: string },
    tutor: { id: string; subject: string },
    hours: number,
  ) {
    const at = new Date(Date.now() + hours * HOUR);
    at.setUTCMinutes(0, 0, 0);
    const created = await call(
      MARKET_HOST,
      'POST',
      '/bookings',
      {
        tutor_id: tutor.id,
        child_id: parent.childId,
        subject_id: tutor.subject,
        starts_at: at.toISOString(),
        recording_consented: true,
      },
      parent.token,
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.recording_required, true);
    const id = created.body.id as string;
    assert.equal((await call(MARKET_HOST, 'POST', `/bookings/${id}/mock-pay`, {}, parent.token)).status, 200);
    return id;
  }

  before(async () => {
    market = await startMarketplaceTestDatabase('db');
    environment = await startMultiTenantApi({
      label: 'db',
      configuration: {
        platformConsoleHost: CONSOLE_HOST,
        marketplaceDatabaseUrl: market.url,
        marketJobIntervalSeconds: 0,
        marketFilesKey: Buffer.alloc(32, 7),
        video: {
          provider: 'mock',
          apiUrl: '',
          clientUrl: 'mock://video',
          apiKey: 'mock',
          apiSecret: 'mock-video-secret',
        },
      },
    });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    database = environment.api.get(MarketContext).database;
    provider = environment.api.get(MarketplacePaymentProvider) as MockMarketplacePaymentProvider;
    operators.push(await operatorToken('mot'), await operatorToken('hai'));
    assert.equal(
      (await admin('PUT', '/settings', { enabled: true, host: MARKET_HOST, tutor_host: TUTOR_HOST })).status,
      200,
    );
    for (const kind of ['terms', 'privacy', 'parent_consent', 'tutor_terms']) {
      const published = await admin('POST', '/documents', { kind, title: `Văn bản ${kind}`, body: 'Nội dung giả' });
      documents[kind] = published.body.id as string;
    }
  });

  after(async () => {
    await environment?.close();
    await market?.close();
  });

  it('CT-27i-2: tin nhắn chỉ giữa phụ huynh và gia sư, thông tin liên lạc ngoài bị che, lần thứ 3 gắn cờ và vào hàng chờ', async () => {
    const parent = await registerParent();
    const other = await registerParent();
    const tutor = await seedTutor();
    assert.equal(
      (await call(TUTOR_HOST, 'POST', '/messages/threads', { tutor_id: tutor.id }, tutor.token)).status,
      403,
      'gia sư không tự mở luồng',
    );
    const opened = await call(MARKET_HOST, 'POST', '/messages/threads', { tutor_id: tutor.id }, parent.token);
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    const thread = opened.body.id as string;
    const normal = await call(MARKET_HOST, 'POST', `/messages/threads/${thread}`, { body: 'Chào thầy' }, parent.token);
    assert.equal(normal.status, 201);
    assert.equal(normal.body.warning, null);
    const reply = await call(
      TUTOR_HOST,
      'POST',
      `/messages/threads/${thread}`,
      { body: 'Anh nhắn zalo 0912345678 cho nhanh' },
      tutor.token,
    );
    assert.equal(reply.status, 201);
    assert.match(String(reply.body.warning), /ngoài chợ/);
    const seen = await call(MARKET_HOST, 'GET', `/messages/threads/${thread}`, undefined, parent.token);
    assert.doesNotMatch(JSON.stringify(seen.body), /0912345678/, 'phụ huynh chỉ thấy chữ đã che');
    assert.equal(
      (await call(MARKET_HOST, 'GET', `/messages/threads/${thread}`, undefined, other.token)).status,
      404,
      'phụ huynh khác không xem được',
    );
    await call(TUTOR_HOST, 'POST', `/messages/threads/${thread}`, { body: 'mail gs@example.com' }, tutor.token);
    const third = await call(
      TUTOR_HOST,
      'POST',
      `/messages/threads/${thread}`,
      { body: 'facebook.com/giasu' },
      tutor.token,
    );
    assert.equal(third.body.flagged, true);
    const overview = await admin('GET', '/safety');
    const reports = overview.body.reports as Array<{ id: string; category: string; subject_name: string }>;
    const flagged = reports.find((row) => row.category === 'fee_evasion');
    assert.ok(flagged, 'báo cáo né hoa hồng tự tạo');
    assert.ok((overview.body.metrics as { flagged_threads: number }).flagged_threads >= 1);
    const detail = await admin('GET', `/safety/reports/${flagged.id}`);
    assert.match(JSON.stringify(detail.body), /0912345678/, 'nhân viên kiểm duyệt xem được chữ gốc');
  });

  it('CT-27i-3: báo cáo nghiêm trọng tạm khóa gia sư ngay, giữ tiền; nhân viên xác nhận thì hủy buổi hoàn đủ, báo phụ huynh một lần', async () => {
    const parent = await registerParent();
    const other = await registerParent();
    const tutor = await seedTutor();
    const upcoming = await paidBooking(parent, tutor, 72);
    const taught = await paidBooking(other, tutor, 96);
    // Buổi của phụ huynh kia đã dạy, hết hạn khiếu nại: bình thường sẽ giải ngân
    await database
      .updateTable('market_bookings')
      .set({
        starts_at: new Date(Date.now() - 100 * HOUR),
        status: 'completed',
        complaint_deadline: new Date(Date.now() - HOUR),
      })
      .where('id', '=', taught)
      .execute();
    const report = await call(
      MARKET_HOST,
      'POST',
      '/reports',
      {
        subject_id: tutor.id,
        target_kind: 'session',
        target_id: upcoming,
        category: 'child_safety',
        severity: 'critical',
        description: 'Gia sư đề nghị con gặp riêng',
      },
      parent.token,
    );
    assert.equal(report.status, 201, JSON.stringify(report.body));
    assert.equal(report.body.suspended, true);
    assert.match(String(report.body.hotline), /111/);
    const bookingOf = async () => {
      const bookings = await call(MARKET_HOST, 'GET', '/bookings', undefined, parent.token);
      return (bookings.body.bookings as Array<{ id: string; status: string; refunded_amount: number }>).find(
        (row) => row.id === upcoming,
      );
    };
    // Hệ thống tự khóa chỉ giữ: chưa hủy buổi, chưa báo phụ huynh khác, chờ nhân viên xác nhận (YCTD-322)
    assert.equal((await bookingOf())?.status, 'paid');
    assert.doesNotMatch(environment.api.get(MarketMessenger).lastTo(other.email)?.text ?? '', /tạm ngừng hoạt động/);
    const confirmed = await admin('POST', `/safety/reports/${report.body.id as string}/suspend`, {
      note: 'Xác nhận tạm khóa trong lúc xét',
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    const cancelled = await bookingOf();
    assert.equal(cancelled?.status, 'refunded');
    assert.equal(cancelled?.refunded_amount, 150_000);
    assert.ok(provider.ledger.some((entry) => entry.action === 'refund' && entry.amount === 150_000));
    // Quyết định tạm khóa sau đó không báo phụ huynh lần nữa
    await admin('POST', `/safety/reports/${report.body.id as string}/decide`, {
      decision: 'suspend',
      note: 'Có bằng chứng',
    });
    const notices = await database
      .selectFrom('market_moderation_log')
      .select('id')
      .where('subject_account_id', '=', tutor.id)
      .where('action', '=', 'tutor.suspend.notify')
      .execute();
    assert.equal(notices.length, 1);
    assert.equal((await call(MARKET_HOST, 'GET', `/public/tutors/${tutor.id}`)).status, 404, 'ẩn khỏi chợ');
    const rebook = await call(
      MARKET_HOST,
      'POST',
      '/bookings',
      {
        tutor_id: tutor.id,
        child_id: parent.childId,
        subject_id: tutor.subject,
        starts_at: new Date(Date.now() + 120 * HOUR).toISOString(),
        recording_consented: true,
      },
      parent.token,
    );
    assert.equal(rebook.status, 404, 'không đặt được gia sư đang tạm khóa');
    assert.match(environment.api.get(MarketMessenger).lastTo(other.email)?.text ?? '', /tạm ngừng hoạt động.*111/s);
    const safety = await call(TUTOR_HOST, 'GET', '/tutor/safety', undefined, tutor.token);
    assert.ok(safety.body.suspension, 'gia sư thấy mình đang bị tạm khóa');
    // Giữ tiền: không giải ngân buổi đã dạy trong lúc tạm khóa
    await admin('POST', '/payments/run-due');
    const held = await database
      .selectFrom('market_bookings')
      .select('status')
      .where('id', '=', taught)
      .executeTakeFirstOrThrow();
    assert.equal(held.status, 'completed');
  });

  it('CT-27i-7: báo cáo nghiêm trọng của phụ huynh chưa học với gia sư chỉ vào hàng chờ 4 giờ, không tạm khóa (YCTD-322)', async () => {
    const tutor = await seedTutor();
    const critical = (token: string) =>
      call(
        MARKET_HOST,
        'POST',
        '/reports',
        {
          subject_id: tutor.id,
          target_kind: 'profile',
          category: 'harassment',
          severity: 'critical',
          description: 'Báo cáo thử',
        },
        token,
      );
    // Người lạ: không buổi, không tin nhắn
    const stranger = await registerParent();
    const queued = await critical(stranger.token);
    assert.equal(queued.status, 201, JSON.stringify(queued.body));
    assert.equal(queued.body.suspended, false);
    assert.equal(queued.body.severity, 'critical');
    assert.ok(new Date(queued.body.due_at as string).getTime() - Date.now() <= 4 * HOUR, 'hạn xử lý 4 giờ');
    assert.equal((await call(MARKET_HOST, 'GET', `/public/tutors/${tutor.id}`)).status, 200, 'vẫn hiện ở chợ');
    // Tự mở luồng nhưng gia sư chưa trả lời, hoặc chỉ giữ chỗ chưa trả tiền: ai cũng tự tạo được nên không tính
    const opener = await registerParent();
    const thread = await call(MARKET_HOST, 'POST', '/messages/threads', { tutor_id: tutor.id }, opener.token);
    assert.equal(thread.status, 201);
    await call(
      MARKET_HOST,
      'POST',
      `/messages/threads/${thread.body.id as string}`,
      { body: 'Chào thầy' },
      opener.token,
    );
    const unpaid = await call(
      MARKET_HOST,
      'POST',
      '/bookings',
      {
        tutor_id: tutor.id,
        child_id: opener.childId,
        subject_id: tutor.subject,
        starts_at: new Date(Math.ceil((Date.now() + 80 * HOUR) / HOUR) * HOUR).toISOString(),
        recording_consented: true,
      },
      opener.token,
    );
    assert.equal(unpaid.status, 201, JSON.stringify(unpaid.body));
    assert.equal((await critical(opener.token)).body.suspended, false);
    assert.equal(
      await database
        .selectFrom('market_tutor_suspensions')
        .select('id')
        .where('tutor_account_id', '=', tutor.id)
        .executeTakeFirst(),
      undefined,
    );
    // Gia sư đã trả lời trong luồng: có quan hệ thật nên tạm khóa ngay
    await call(TUTOR_HOST, 'POST', `/messages/threads/${thread.body.id as string}`, { body: 'Chào anh' }, tutor.token);
    const related = await critical(opener.token);
    assert.equal(related.body.suspended, true);
    // Nhân viên bác thì gỡ khóa của hệ thống
    const dismissed = await admin('POST', `/safety/reports/${related.body.id as string}/decide`, {
      decision: 'dismiss',
      note: 'Không có căn cứ',
    });
    assert.equal(dismissed.status, 200, JSON.stringify(dismissed.body));
    assert.equal((await call(MARKET_HOST, 'GET', `/public/tutors/${tutor.id}`)).status, 200);
  });

  it('CT-27i-4: quyết định có lý do, kháng nghị do nhân viên khác xét, xuất hồ sơ cho cơ quan có nhật ký', async () => {
    const parent = await registerParent();
    const stranger = await registerParent();
    const tutor = await seedTutor();
    assert.equal(
      (
        await call(
          TUTOR_HOST,
          'POST',
          '/reports',
          {
            subject_id: stranger.id,
            target_kind: 'profile',
            category: 'harassment',
            severity: 'low',
            description: 'Dò tài khoản',
          },
          tutor.token,
        )
      ).status,
      404,
      'gia sư không báo phụ huynh chưa từng liên hệ',
    );
    const created = await call(
      MARKET_HOST,
      'POST',
      '/reports',
      {
        subject_id: tutor.id,
        target_kind: 'profile',
        category: 'child_safety',
        severity: 'low',
        description: 'Hồ sơ có ảnh không phù hợp',
      },
      parent.token,
    );
    assert.equal(created.body.severity, 'high', 'an toàn trẻ em không thấp hơn mức cao');
    assert.equal(created.body.suspended, false);
    const id = created.body.id as string;
    assert.equal(
      (await admin('POST', `/safety/reports/${id}/decide`, { decision: 'dismiss' })).status,
      400,
      'cần lý do',
    );
    const first = await admin('POST', `/safety/reports/${id}/decide`, {
      decision: 'dismiss',
      note: 'Ảnh là ảnh lớp học bình thường',
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.status, 'decided');
    assert.equal(
      (await call(TUTOR_HOST, 'POST', `/reports/${id}/appeal`, { reason: 'Tôi muốn' }, tutor.token)).status,
      409,
      'gia sư không kháng nghị quyết định bác',
    );
    const appealed = await call(
      MARKET_HOST,
      'POST',
      `/reports/${id}/appeal`,
      { reason: 'Ảnh có trẻ khác không được phép' },
      parent.token,
    );
    assert.equal(appealed.status, 200);
    assert.equal(
      (await admin('POST', `/safety/reports/${id}/decide`, { decision: 'suspend', note: 'Xét lại' }, 0)).status,
      403,
      'người quyết định lần đầu không xét kháng nghị',
    );
    const final = await admin(
      'POST',
      `/safety/reports/${id}/decide`,
      { decision: 'suspend', note: 'Ảnh có trẻ khác chưa có đồng ý' },
      1,
    );
    assert.equal(final.status, 200);
    assert.equal(final.body.status, 'final');
    assert.ok(final.body.suspension, 'tạm khóa theo quyết định cuối');
    assert.equal((await admin('POST', `/safety/reports/${id}/export`, { authority: 'Công an' })).status, 400);
    const exported = await admin('POST', `/safety/reports/${id}/export`, {
      authority: 'Công an quận giả',
      request_reference: '123/CV-GIA',
    });
    assert.equal(exported.status, 200);
    const exports = await database
      .selectFrom('market_evidence_exports')
      .select('request_reference')
      .where('report_id', '=', id)
      .execute();
    assert.deepEqual(
      exports.map((row) => row.request_reference),
      ['123/CV-GIA'],
    );
    const log = (final.body.log as Array<{ action: string }>).map((entry) => entry.action);
    assert.ok(log.includes('report.decide') && log.includes('report.appeal') && log.includes('report.final'));
  });

  it('CT-27i-5: buổi có trẻ vị thành niên chỉ mở khi đang ghi; bản ghi chỉ người của buổi và nhân viên xem, không tải, giữ 30 ngày', async () => {
    const parent = await registerParent();
    const other = await registerParent();
    const tutor = await seedTutor();
    const id = await paidBooking(parent, tutor, 48);
    assert.equal(
      (await call(TUTOR_HOST, 'POST', `/tutor/bookings/${id}/session/start`, undefined, tutor.token)).status,
      409,
      'chưa tới giờ mở phòng',
    );
    await database
      .updateTable('market_bookings')
      .set({ starts_at: new Date(Date.now() - 5 * 60_000) })
      .where('id', '=', id)
      .execute();
    assert.equal(
      (await call(MARKET_HOST, 'POST', `/bookings/${id}/session/join`, undefined, parent.token)).status,
      409,
      'phụ huynh chỉ vào khi gia sư đã mở và đang ghi',
    );
    const started = await call(TUTOR_HOST, 'POST', `/tutor/bookings/${id}/session/start`, undefined, tutor.token);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    assert.equal(started.body.recording, true);
    const joined = await call(MARKET_HOST, 'POST', `/bookings/${id}/session/join`, undefined, parent.token);
    assert.equal(joined.status, 200);
    assert.match(String(joined.body.token), /^mock\./);
    const ended = await call(TUTOR_HOST, 'POST', `/tutor/bookings/${id}/session/end`, undefined, tutor.token);
    assert.equal(ended.body.recording, 'ready');
    const stored = await database
      .selectFrom('market_session_recordings')
      .select(['file_key', 'retain_until', 'ended_at'])
      .where('booking_id', '=', id)
      .executeTakeFirstOrThrow();
    assert.equal(
      (stored.retain_until?.getTime() ?? 0) - (stored.ended_at?.getTime() ?? 0),
      30 * 24 * HOUR,
      'giữ 30 ngày',
    );
    const viewed = await raw(MARKET_HOST, `/bookings/${id}/recording/stream`, parent.token);
    assert.equal(viewed.status, 200);
    assert.equal(viewed.headers['content-disposition'], 'inline');
    assert.equal(viewed.headers['cache-control'], 'no-store');
    assert.equal(viewed.body.toString(), 'ban ghi gia lap');
    assert.equal((await raw(TUTOR_HOST, `/tutor/bookings/${id}/recording/stream`, tutor.token)).status, 200);
    assert.equal((await raw(MARKET_HOST, `/bookings/${id}/recording/stream`, other.token)).status, 404);
    assert.equal((await raw(CONSOLE_HOST, `/admin/safety/recordings/${id}`, operators[0] as string)).status, 200);
    const views = await database
      .selectFrom('market_recording_views')
      .innerJoin('market_session_recordings', 'market_session_recordings.id', 'market_recording_views.recording_id')
      .select('market_recording_views.viewer_type')
      .where('market_session_recordings.booking_id', '=', id)
      .execute();
    assert.deepEqual(views.map((row) => row.viewer_type).sort(), ['account', 'account', 'operator']);
    // Hết hạn giữ nhưng buổi đang tranh chấp: giữ tiếp; hết tranh chấp thì xóa
    await database
      .updateTable('market_session_recordings')
      .set({ retain_until: new Date(Date.now() - HOUR) })
      .where('booking_id', '=', id)
      .execute();
    await database.updateTable('market_bookings').set({ status: 'disputed' }).where('id', '=', id).execute();
    assert.equal((await admin('POST', '/safety/run-due')).body.purged, 0);
    await database.updateTable('market_bookings').set({ status: 'disbursed' }).where('id', '=', id).execute();
    assert.equal((await admin('POST', '/safety/run-due')).body.purged, 1);
    assert.equal((await raw(MARKET_HOST, `/bookings/${id}/recording/stream`, parent.token)).status, 404);
  });
});

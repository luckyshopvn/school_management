import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createServer as createHttp2Server, type Http2Server } from 'node:http2';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  parseApnsKey,
  parseFcmServiceAccount,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import { decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import type { Kysely } from 'kysely';
import { queueNotification } from '../../common/notification-queue.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';
import { NotificationDispatcher } from '../notification-dispatcher.js';
import { ApnsSender } from './apns-sender.js';
import { FcmSender } from './fcm-sender.js';
import { buildPushMessage } from './push-groups.js';
import {
  createPushSender,
  DevelopmentPushSender,
  PUSH_SENDER,
  type PushCredentials,
  type PushSenderRouter,
} from './push-sender.js';

// Thông báo đẩy gốc (DT-26 phần 26g, YCTD-237), kịch bản CT-26g-1 đến CT-26g-5: bộ nối FCM, APNs gọi máy chủ giả lập trả các mã lỗi
// thật của Google, Apple (hết hạn thì thu hồi, lỗi xác thực, quá tải thì thử lại); đọc khóa của nền tảng; đăng ký mã thiết bị qua cùng
// điểm cuối với Web Push; tiến trình gửi chọn bộ nối theo loại đăng ký. Khóa sinh trong lúc chạy, không có khóa thật
const message = buildPushMessage({
  notificationId: '00000000-0000-4000-8000-000000000007',
  templateCode: 'invoice_issued',
  schoolName: 'Trường Mầm non Giả',
});

function rsaKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

function ecKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of request) {
    text += String(chunk);
  }
  return text;
}

const NO_CREDENTIALS: PushCredentials = { vapid: null, fcm: null, apns: null };

describe('khóa đẩy gốc của nền tảng', () => {
  it('CT-26g-1: đọc tệp tài khoản dịch vụ Firebase, khóa APNs .p8; tệp sai thì báo lỗi rõ', () => {
    const rsa = rsaKeys();
    const account = parseFcmServiceAccount(
      JSON.stringify({
        type: 'service_account',
        project_id: 'truong-gia-lap',
        client_email: 'day@truong-gia-lap.iam.gserviceaccount.com',
        private_key: rsa.privatePem,
      }),
    );
    assert.equal(account.projectId, 'truong-gia-lap');
    assert.throws(() => parseFcmServiceAccount('khong phai json'), /không phải JSON/);
    assert.throws(
      () => parseFcmServiceAccount(JSON.stringify({ type: 'authorized_user', project_id: 'x' })),
      /service_account/,
    );
    const ec = ecKeys();
    const apns = parseApnsKey({
      privateKey: ec.privatePem,
      keyId: 'ABCDE12345',
      teamId: 'TEAM123456',
      bundleId: 'vn.schoolmanagement.demo',
      environment: 'sandbox',
    });
    assert.equal(apns.environment, 'sandbox');
    assert.throws(() => parseApnsKey({ ...apns, keyId: 'ngan', privateKey: ec.privatePem }), /10 ký tự/);
    assert.throws(() => parseApnsKey({ ...apns, privateKey: 'khong phai khoa' }), /không đọc được/);
  });
});

describe('bộ nối FCM gọi máy chủ giả lập', () => {
  let server: Server;
  let baseUrl = '';
  const rsa = rsaKeys();
  const tokenRequests: string[] = [];
  const sends: { authorization: string; body: { message: Record<string, unknown> } }[] = [];
  // Mã thiết bị quyết định phản hồi của máy chủ giả lập (theo tài liệu lỗi của FCM HTTP v1)
  const replies: Record<string, [number, unknown]> = {
    'may-het-han': [404, { error: { code: 404, status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }],
    'may-sai-ma': [
      400,
      {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'The registration token is not a valid FCM registration token',
          details: [{ errorCode: 'INVALID_ARGUMENT' }],
        },
      },
    ],
    'may-khoa-sai': [401, { error: { code: 401, status: 'UNAUTHENTICATED' } }],
    'may-qua-tai': [503, { error: { code: 503, status: 'UNAVAILABLE', details: [{ errorCode: 'UNAVAILABLE' }] } }],
  };

  before(async () => {
    server = createServer(async (request, response) => {
      const body = await readBody(request);
      if (request.url === '/token') {
        tokenRequests.push(new URLSearchParams(body).get('assertion') ?? '');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ access_token: `ma-truy-cap-${tokenRequests.length}`, expires_in: 3600 }));
        return;
      }
      const parsed = JSON.parse(body) as { message: Record<string, unknown> };
      sends.push({ authorization: request.headers.authorization ?? '', body: parsed });
      const [status, reply] = replies[parsed.message.token as string] ?? [200, { name: 'projects/x/messages/1' }];
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(reply));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('CT-26g-2: ký JWT RS256 đổi mã truy cập, gửi nội dung không có dữ liệu cá nhân; mã hết hạn thì thu hồi, lỗi khác thử lại', async () => {
    const sender = new FcmSender({ baseUrl, tokenUrl: `${baseUrl}/token` });
    const credentials: PushCredentials = {
      ...NO_CREDENTIALS,
      fcm: {
        projectId: 'truong-gia-lap',
        clientEmail: 'day@gia-lap.iam.gserviceaccount.com',
        privateKey: rsa.privatePem,
      },
    };
    assert.equal(await sender.send({ kind: 'fcm', token: 'may-binh-thuong' }, message, NO_CREDENTIALS), 'unavailable');
    assert.equal(await sender.send({ kind: 'fcm', token: 'may-binh-thuong' }, message, credentials), 'sent');
    const assertion = tokenRequests[0] as string;
    const verified = await jwtVerify(assertion, await importSPKI(rsa.publicPem, 'RS256'), {
      issuer: 'day@gia-lap.iam.gserviceaccount.com',
      audience: `${baseUrl}/token`,
    });
    assert.equal(verified.payload.scope, 'https://www.googleapis.com/auth/firebase.messaging');
    const sent = sends[0] as (typeof sends)[number];
    assert.equal(sent.authorization, 'Bearer ma-truy-cap-1');
    const payload = sent.body.message as {
      token: string;
      notification: { title: string };
      data: Record<string, unknown>;
      android: { collapse_key: string };
    };
    assert.equal(payload.token, 'may-binh-thuong');
    assert.match(payload.notification.title, /Học phí/);
    assert.equal(payload.android.collapse_key, message.tag);
    assert.ok(
      Object.values(payload.data).every((value) => typeof value === 'string'),
      'dữ liệu FCM chỉ là chuỗi',
    );

    assert.equal(await sender.send({ kind: 'fcm', token: 'may-het-han' }, message, credentials), 'expired');
    assert.equal(await sender.send({ kind: 'fcm', token: 'may-sai-ma' }, message, credentials), 'expired');
    await assert.rejects(
      sender.send({ kind: 'fcm', token: 'may-qua-tai' }, message, credentials),
      /FCM trả lỗi 503 UNAVAILABLE/,
    );
    // Mã truy cập dùng lại; máy chủ báo 401 thì lần sau lấy mã mới
    assert.equal(tokenRequests.length, 1);
    await assert.rejects(sender.send({ kind: 'fcm', token: 'may-khoa-sai' }, message, credentials), /401/);
    await sender.send({ kind: 'fcm', token: 'may-binh-thuong' }, message, credentials);
    assert.equal(tokenRequests.length, 2);
    assert.equal(sends.at(-1)?.authorization, 'Bearer ma-truy-cap-2');
  });
});

describe('bộ nối APNs gọi máy chủ HTTP/2 giả lập', () => {
  let server: Http2Server;
  let host = '';
  const ec = ecKeys();
  const requests: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  // Theo tài liệu lỗi của APNs: mã thiết bị quyết định phản hồi
  const replies: Record<string, [number, string | null]> = {
    ['a'.repeat(64)]: [410, 'Unregistered'],
    ['b'.repeat(64)]: [400, 'BadDeviceToken'],
    ['c'.repeat(64)]: [403, 'ExpiredProviderToken'],
    ['d'.repeat(64)]: [429, 'TooManyRequests'],
  };

  before(async () => {
    server = createHttp2Server();
    server.on('stream', (stream, headers) => {
      let text = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        text += chunk;
      });
      stream.on('end', () => {
        const token = String(headers[':path']).replace('/3/device/', '');
        requests.push({
          headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)])),
          body: JSON.parse(text) as Record<string, unknown>,
        });
        const [status, reason] = replies[token] ?? [200, null];
        stream.respond({ ':status': status, 'apns-id': randomUUID() });
        stream.end(reason ? JSON.stringify({ reason }) : '');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('CT-26g-3: ký JWT ES256 theo mã khóa, mã đội; gửi đúng tiêu đề APNs; 410, BadDeviceToken thì thu hồi; 403, 429 thử lại', async () => {
    const sender = new ApnsSender({ host });
    const credentials: PushCredentials = {
      ...NO_CREDENTIALS,
      apns: {
        keyId: 'ABCDE12345',
        teamId: 'TEAM123456',
        bundleId: 'vn.schoolmanagement.demo',
        privateKey: ec.privatePem,
        environment: 'sandbox',
      },
    };
    const healthy = 'e'.repeat(64);
    try {
      assert.equal(await sender.send({ kind: 'apns', token: healthy }, message, NO_CREDENTIALS), 'unavailable');
      assert.equal(await sender.send({ kind: 'apns', token: healthy }, message, credentials), 'sent');
      const first = requests[0] as (typeof requests)[number];
      assert.equal(first.headers['apns-topic'], 'vn.schoolmanagement.demo');
      assert.equal(first.headers['apns-push-type'], 'alert');
      assert.equal(first.headers['apns-collapse-id'], message.tag);
      const jwt = String(first.headers.authorization).replace('bearer ', '');
      assert.deepEqual(decodeProtectedHeader(jwt), { alg: 'ES256', kid: 'ABCDE12345' });
      assert.equal(decodeJwt(jwt).iss, 'TEAM123456');
      await jwtVerify(jwt, await importSPKI(ec.publicPem, 'ES256'));
      const aps = first.body.aps as { alert: { title: string }; 'thread-id': string };
      assert.match(aps.alert.title, /Học phí/);
      assert.equal(first.body.notification_id, message.data.notification_id);

      assert.equal(await sender.send({ kind: 'apns', token: 'a'.repeat(64) }, message, credentials), 'expired');
      assert.equal(await sender.send({ kind: 'apns', token: 'b'.repeat(64) }, message, credentials), 'expired');
      await assert.rejects(
        sender.send({ kind: 'apns', token: 'd'.repeat(64) }, message, credentials),
        /APNs trả lỗi 429 TooManyRequests/,
      );
      // Mã xác thực dùng lại; 403 ExpiredProviderToken thì lần sau ký mã mới
      assert.equal(requests[1]?.headers.authorization, first.headers.authorization);
      await assert.rejects(
        sender.send({ kind: 'apns', token: 'c'.repeat(64) }, message, credentials),
        /403 ExpiredProviderToken/,
      );
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await sender.send({ kind: 'apns', token: healthy }, message, credentials);
      assert.notEqual(requests.at(-1)?.headers.authorization, first.headers.authorization);
    } finally {
      sender.close();
    }
  });

  it('CT-26g-4: bộ định tuyến chọn bộ nối theo loại đăng ký; loại chưa bật trả unavailable', async () => {
    assert.equal(createPushSender(null, null, { outbox: null, schoolOf: () => null }), null);
    const webOnly = createPushSender('web-push', null, { outbox: null, schoolOf: () => null });
    assert.equal(webOnly?.senderFor('fcm'), null);
    assert.equal(await webOnly?.send({ kind: 'apns', token: 'e'.repeat(64) }, message, NO_CREDENTIALS), 'unavailable');
    const native = createPushSender(null, 'native', { outbox: null, schoolOf: () => null });
    assert.equal(native?.senderFor('fcm')?.provider, 'fcm');
    assert.equal(native?.senderFor('apns')?.provider, 'apns');
    assert.equal(native?.senderFor('web_push'), null);
    const development = createPushSender('development', 'development', { outbox: null, schoolOf: () => null });
    assert.equal(development?.senderFor('fcm'), development?.senderFor('web_push'));
  });
});

describe('đăng ký mã thiết bị và tiến trình gửi', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let parent: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let dispatcher: NotificationDispatcher;
  let sender: DevelopmentPushSender;
  let unitA = '';
  const call = (user: LoggedInUser, method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body);
  const fcmToken = () => `${randomBytes(11).toString('base64url')}:APA91b${randomBytes(100).toString('base64url')}`;

  before(async () => {
    environment = await startApiTestEnvironment();
    dispatcher = environment.api.get(NotificationDispatcher);
    sender = (environment.api.get(PUSH_SENDER) as PushSenderRouter).senderFor('fcm') as DevelopmentPushSender;
    principal = await environment.loginAs('VT-02', null);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const shift = (days: number) =>
      new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: shift(-60), end_date: shift(90) },
      second_term: { start_date: shift(95), end_date: shift(200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await call(principal, 'POST', '/org-units', { code: 'TC', name: 'Trường chính', unit_type: 'truong_chinh' });
    unitA = (await call(principal, 'POST', '/org-units', { code: 'DT-A1', name: 'DT-A1', unit_type: 'diem_truong' }))
      .body.id as string;
    parent = await environment.loginAs('VT-14', unitA);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  async function queue(userId: string, title: string) {
    await queueNotification(schoolYear, {
      orgUnitId: unitA,
      templateCode: 'news_published',
      title,
      body: 'Bé Nguyễn Văn Giả có tin mới',
      targetType: 'test',
      targetId: randomUUID(),
      recipients: [{ userId, channel: 'in_app' }],
    });
    return schoolYear.selectFrom('notifications').select('id').where('title', '=', title).executeTakeFirstOrThrow();
  }

  const pushRowOf = (notificationId: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .select(['channel_status', 'last_error'])
      .where('notification_id', '=', notificationId)
      .where('channel', '=', 'push')
      .executeTakeFirst();

  it('CT-26g-5: đăng ký mã FCM, APNs kiểm tra dữ liệu, lưu mã hóa; gửi qua bộ nối theo loại kèm địa chỉ ứng dụng; hết hạn thì thu hồi; đăng xuất thu hồi', async () => {
    const publicKey = await sendJson('GET', `${environment.baseUrl}/public/push/vapid-public-key`, undefined);
    assert.deepEqual(publicKey.body.native, { fcm: true, apns: true });

    const invalid = await call(parent, 'POST', '/push/subscriptions', {
      kind: 'apns',
      token: 'khong-phai-ma',
      app: 'parent',
      origin: 'javascript:alert(1)',
    });
    assert.equal(invalid.status, 400);
    const fields = ((invalid.body.error as { details: Array<{ field: string }> }).details ?? []).map(
      (error) => error.field,
    );
    assert.deepEqual(fields.sort(), ['origin', 'token']);

    const token = fcmToken();
    const origin = 'https://truong-gia.example.test/phu-huynh/';
    const created = await call(parent, 'POST', '/push/subscriptions', {
      kind: 'fcm',
      token,
      app: 'parent',
      origin,
      device_label: 'Android · Ứng dụng',
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.created, true);
    assert.equal(
      (await call(parent, 'POST', '/push/subscriptions', { kind: 'fcm', token, app: 'parent', origin })).body.created,
      false,
    );
    const stored = await environment.system
      .selectFrom('push_subscriptions')
      .select(['kind', 'endpoint_encrypted'])
      .where('id', '=', created.body.id as string)
      .executeTakeFirstOrThrow();
    assert.equal(stored.kind, 'fcm');
    assert.ok(!stored.endpoint_encrypted.includes('APA91b'), 'mã thiết bị lưu mã hóa');
    const apnsToken = 'F'.repeat(64);
    const apns = await call(parent, 'POST', '/push/subscriptions', {
      kind: 'apns',
      token: apnsToken,
      app: 'parent',
      origin,
    });
    assert.equal(apns.status, 200, JSON.stringify(apns.body));

    const before = sender.deliveries.length;
    const notice = await queue(parent.userId, `Tin ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    assert.equal((await pushRowOf(notice.id))?.channel_status, 'sent');
    const deliveries = sender.deliveries.slice(before);
    assert.deepEqual(deliveries.map((delivery) => delivery.kind).sort(), ['apns', 'fcm']);
    const fcmDelivery = deliveries.find((delivery) => delivery.kind === 'fcm');
    assert.equal(fcmDelivery?.endpoint, token);
    assert.equal(fcmDelivery?.message.data.app_url, origin);
    assert.equal(deliveries.find((delivery) => delivery.kind === 'apns')?.endpoint, apnsToken.toLowerCase());
    assert.ok(!JSON.stringify(fcmDelivery?.message).includes('Nguyễn Văn Giả'));

    // Đăng xuất trên máy: thu hồi theo loại và mã thiết bị (mã APNs không phân biệt hoa thường)
    const out = await call(parent, 'POST', '/push/subscriptions/unsubscribe', { kind: 'apns', token: apnsToken });
    assert.equal(out.body.revoked, true);
    assert.equal(
      (await call(parent, 'POST', '/push/subscriptions/unsubscribe', { kind: 'fcm', token })).body.revoked,
      true,
    );

    // Mã hết hạn (bộ giả lập trả hết hạn) thì thu hồi
    const user = await environment.loginAs('VT-14', unitA);
    const expired = await call(user, 'POST', '/push/subscriptions', {
      kind: 'fcm',
      token: `het-han-${fcmToken()}`.replace(/[^A-Za-z0-9_:-]/g, ''),
      app: 'parent',
      origin,
    });
    assert.equal(expired.status, 200, JSON.stringify(expired.body));
    const lost = await queue(user.userId, `Hết hạn ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    assert.equal((await pushRowOf(lost.id))?.channel_status, 'failed');
    const row = await environment.system
      .selectFrom('push_subscriptions')
      .select('revoked_reason')
      .where('id', '=', expired.body.id as string)
      .executeTakeFirstOrThrow();
    assert.equal(row.revoked_reason, 'expired');
  });
});

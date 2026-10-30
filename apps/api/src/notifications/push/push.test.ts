import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
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
import { buildPushMessage, pushGroupOf } from './push-groups.js';
import { createPushSender, DevelopmentPushSender, PUSH_SENDER, type PushSenderRouter } from './push-sender.js';

// Thông báo đẩy Web Push (DT-26 phần 26b, YCTD-232), kịch bản CT-26b-1 đến CT-26b-6: nhóm loại, nội dung không có dữ liệu cá nhân,
// đăng ký theo máy (mã hóa, chống trùng, thu hồi), tuỳ chọn tắt theo nhóm, loại khẩn, kênh push của tiến trình gửi, gộp, thu hồi khi
// hết hạn, chọn bộ nối theo cấu hình. Dữ liệu giả; đẩy qua bộ giả lập `development`
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function fakeKeys() {
  return {
    p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
}

describe('nhóm loại và nội dung đẩy', () => {
  it('CT-26b-1: ánh xạ nhóm theo mã loại; nội dung không có tiêu đề, nội dung gốc của thông báo; chọn bộ nối theo cấu hình', () => {
    assert.equal(pushGroupOf('invoice_issued').code, 'fees');
    assert.equal(pushGroupOf('medication_received').code, 'health');
    assert.equal(pushGroupOf('pickup_confirmation_requested').code, 'attendance');
    assert.equal(pushGroupOf('task_assigned').code, 'staff_work');
    assert.equal(pushGroupOf('gate_arrived').code, 'gate');
    assert.equal(pushGroupOf('news_published').code, 'school');
    const message = buildPushMessage({
      notificationId: '00000000-0000-4000-8000-000000000001',
      templateCode: 'invoice_issued',
      schoolName: 'Trường Mầm non Giả',
    });
    const text = JSON.stringify(message);
    assert.match(message.title, /Học phí · Trường Mầm non Giả/);
    assert.equal(message.data.notification_id, '00000000-0000-4000-8000-000000000001');
    assert.ok(!/\d{3,}/.test(message.body), 'không có số tiền');
    assert.ok(!text.includes('Nguyễn'));
    assert.equal(createPushSender(null, null, { outbox: null, schoolOf: () => null }), null);
    assert.equal(
      createPushSender('development', null, { outbox: null, schoolOf: () => null })?.provider,
      'development',
    );
    assert.equal(createPushSender('web-push', null, { outbox: null, schoolOf: () => null })?.provider, 'web-push');
  });
});

describe('đăng ký đẩy và kênh push của tiến trình gửi', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let dispatcher: NotificationDispatcher;
  let sender: DevelopmentPushSender;
  let unitA = '';
  const call = (user: LoggedInUser, method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body);

  async function queue(userId: string, templateCode: string, title: string) {
    await queueNotification(schoolYear, {
      orgUnitId: unitA,
      templateCode,
      title,
      body: 'Bé Nguyễn Văn Giả nợ 1.250.000 đồng',
      targetType: 'test',
      targetId: randomUUID(),
      recipients: [{ userId, channel: 'in_app' }],
    });
    return schoolYear.selectFrom('notifications').select('id').where('title', '=', title).executeTakeFirstOrThrow();
  }

  const pushRowOf = (notificationId: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .select(['channel_status', 'delivered_via', 'last_error', 'attempt_count'])
      .where('notification_id', '=', notificationId)
      .where('channel', '=', 'push')
      .executeTakeFirst();

  before(async () => {
    environment = await startApiTestEnvironment();
    dispatcher = environment.api.get(NotificationDispatcher);
    sender = (environment.api.get(PUSH_SENDER) as PushSenderRouter).senderFor('web_push') as DevelopmentPushSender;
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
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
    otherParent = await environment.loginAs('VT-14', unitA);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-26b-2: đăng ký kiểm tra dữ liệu, lưu mã hóa, đăng ký lại cùng máy không tạo dòng mới; máy dùng chung đổi người thì thu hồi', async () => {
    const invalid = await call(parent, 'POST', '/push/subscriptions', {
      endpoint: 'http://khong-an-toan.example.test/x',
      keys: { p256dh: 'ngan', auth: 'ngan' },
      app: 'khac',
    });
    assert.equal(invalid.status, 400);
    const endpoint = `https://day.example.test/may-${randomUUID()}`;
    const keys = fakeKeys();
    const first = await call(parent, 'POST', '/push/subscriptions', {
      endpoint,
      keys,
      app: 'parent',
      device_label: 'Điện thoại',
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.created, true);
    const again = await call(parent, 'POST', '/push/subscriptions', { endpoint, keys, app: 'parent' });
    assert.equal(again.body.created, false);
    const stored = await environment.system
      .selectFrom('push_subscriptions')
      .select(['endpoint_encrypted', 'keys_encrypted', 'endpoint_hash'])
      .where('id', '=', first.body.id as string)
      .executeTakeFirstOrThrow();
    assert.ok(!stored.endpoint_encrypted.includes('day.example.test'), 'địa chỉ đăng ký lưu mã hóa');
    assert.ok(!stored.keys_encrypted.includes(keys.auth));
    const list = await call(parent, 'GET', '/push/subscriptions');
    assert.equal((list.body.items as unknown[]).length, 1);

    // Máy dùng chung: người khác đăng ký cùng địa chỉ thì đăng ký của người trước bị thu hồi
    const shared = await call(otherParent, 'POST', '/push/subscriptions', { endpoint, keys, app: 'parent' });
    assert.equal(shared.body.created, true);
    assert.equal(((await call(parent, 'GET', '/push/subscriptions')).body.items as unknown[]).length, 0);
    // Người khác không gỡ được máy của mình
    assert.equal((await call(parent, 'DELETE', `/push/subscriptions/${shared.body.id as string}`)).status, 404);
    // Đăng xuất trên máy: thu hồi theo địa chỉ
    assert.equal((await call(otherParent, 'POST', '/push/subscriptions/unsubscribe', { endpoint })).body.revoked, true);
  });

  it('CT-26b-3: thông báo trong ứng dụng thêm kênh push khi có máy; nội dung đẩy không có họ tên, số tiền; gộp cùng nhóm trong 5 phút', async () => {
    const endpoint = `https://day.example.test/may-${randomUUID()}`;
    await call(parent, 'POST', '/push/subscriptions', { endpoint, keys: fakeKeys(), app: 'parent' });
    const before = sender.deliveries.length;
    const first = await queue(parent.userId, 'invoice_issued', `Hóa đơn ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    const row = await pushRowOf(first.id);
    assert.equal(row?.channel_status, 'sent');
    assert.equal(row?.delivered_via, 'push');
    const delivery = sender.deliveries.at(-1);
    assert.equal(sender.deliveries.length, before + 1);
    assert.equal(delivery?.endpoint, endpoint);
    const text = JSON.stringify(delivery?.message);
    assert.ok(!text.includes('Nguyễn Văn Giả'));
    assert.ok(!text.includes('1.250.000'));
    assert.equal(delivery?.message.data.notification_id, first.id);

    // Cùng nhóm học phí trong 5 phút: gộp, không đẩy thêm; nhóm khác vẫn đẩy
    const second = await queue(parent.userId, 'receipt_issued', `Biên lai ${randomUUID()}`);
    const health = await queue(parent.userId, 'medication_received', `Thuốc ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    assert.equal((await pushRowOf(second.id))?.channel_status, 'limited');
    assert.equal((await pushRowOf(health.id))?.channel_status, 'sent');
    // Người không có máy đăng ký: không có dòng kênh push
    const none = await queue(principal.userId, 'news_published', `Tin ${randomUUID()}`);
    await dispatcher.dispatchPending();
    assert.equal(await pushRowOf(none.id), undefined);
  });

  it('CT-26b-4: tắt nhóm thì không đẩy nhóm đó; loại do quản trị đánh dấu khẩn vẫn đẩy', async () => {
    const turnedOff = await call(parent, 'PUT', '/push/preferences', { groups: { learning: false } });
    assert.equal(turnedOff.status, 200, JSON.stringify(turnedOff.body));
    assert.equal(
      (turnedOff.body.groups as Array<{ code: string; push_enabled: boolean }>).find(
        (group) => group.code === 'learning',
      )?.push_enabled,
      false,
    );
    assert.equal((await call(parent, 'PUT', '/push/preferences', { groups: { khong_co: false } })).status, 400);
    const muted = await queue(parent.userId, 'evaluation_published', `Đánh giá ${randomUUID()}`);
    await dispatcher.dispatchPending();
    assert.equal(await pushRowOf(muted.id), undefined);

    assert.equal(
      (await call(parent, 'PUT', '/push/urgent-templates', { template_codes: ['score_alert'] })).status,
      403,
    );
    const urgent = await call(principal, 'PUT', '/push/urgent-templates', { template_codes: ['score_alert'] });
    assert.equal(urgent.status, 200, JSON.stringify(urgent.body));
    const alert = await queue(parent.userId, 'score_alert', `Khẩn ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    assert.equal((await pushRowOf(alert.id))?.channel_status, 'sent');
  });

  it('CT-26b-5: máy báo hết hạn thì thu hồi đăng ký; lỗi tạm thời thì thử lại sau 15 phút', async () => {
    const user = await environment.loginAs('VT-14', unitA);
    const expired = await call(user, 'POST', '/push/subscriptions', {
      endpoint: `https://day.example.test/het-han/${randomUUID()}`,
      keys: fakeKeys(),
      app: 'parent',
    });
    const notice = await queue(user.userId, 'news_published', `Hết hạn ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    assert.equal((await pushRowOf(notice.id))?.channel_status, 'failed');
    const subscription = await environment.system
      .selectFrom('push_subscriptions')
      .select(['revoked_at', 'revoked_reason'])
      .where('id', '=', expired.body.id as string)
      .executeTakeFirstOrThrow();
    assert.ok(subscription.revoked_at);
    assert.equal(subscription.revoked_reason, 'expired');

    const flaky = await environment.loginAs('VT-14', unitA);
    await call(flaky, 'POST', '/push/subscriptions', {
      endpoint: `https://day.example.test/loi/${randomUUID()}`,
      keys: fakeKeys(),
      app: 'parent',
    });
    const retry = await queue(flaky.userId, 'news_published', `Lỗi ${randomUUID()}`);
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    const row = await pushRowOf(retry.id);
    assert.equal(row?.channel_status, 'pending');
    assert.equal(row?.attempt_count, 1);
  });

  it('CT-26b-6: khóa công khai VAPID trả qua điểm cuối công khai; chưa có khóa thì báo chưa bật', async () => {
    const reply = await sendJson('GET', `${environment.baseUrl}/public/push/vapid-public-key`, undefined);
    assert.equal(reply.status, 200);
    assert.equal(reply.body.enabled, false);
    assert.equal(reply.body.public_key, null);
  });
});

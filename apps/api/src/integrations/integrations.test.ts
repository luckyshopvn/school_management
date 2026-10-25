import { DemoAwareFacebookPublisher, DemoAwareZaloSender } from '../demo/demo-mode.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { queueNotification } from '../common/notification-queue.js';
import { DAILY_SMS_LIMIT, NotificationDispatcher } from '../notifications/notification-dispatcher.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { DevelopmentFacebookPublisher, FacebookPublisher } from './facebook-publisher.js';
import { DevelopmentZaloSender, ZaloSender } from './zalo-sender.js';
import type { TenantFacebookPublisher, TenantZaloSender } from '../school-settings/tenant-connectors.js';

// Kết nối Fanpage và Zalo Official Account (DT-11 phần 11e, YCTD-90); kịch bản đề xuất CT-202 đến CT-207
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Kết nối Fanpage và Zalo Official Account', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let dispatcher: NotificationDispatcher;
  let publisher: DevelopmentFacebookPublisher;
  let zalo: DevelopmentZaloSender;
  let academicYearId = '';
  let unitId = '';
  let otherUnitId = '';
  let classId = '';
  let activityId = '';
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const phones: Record<string, string> = { A: '0901000001', B: '0901000002', C: '0901000003' };

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function upload(path: string, accessToken: string, fields: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'anh.png');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function queue(userId: string, channel: 'sms' | 'zalo', title: string) {
    await queueNotification(schoolYear, {
      orgUnitId: unitId,
      templateCode: 'test',
      title,
      body: 'Nội dung',
      targetType: 'test',
      targetId: randomUUID(),
      recipients: [{ userId, channel }],
    });
    return (
      await schoolYear
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select('notification_recipients.id')
        .where('notifications.title', '=', title)
        .executeTakeFirstOrThrow()
    ).id;
  }

  const recipientOf = (id: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .select(['channel_status', 'delivered_via', 'last_error'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

  before(async () => {
    environment = await startApiTestEnvironment();
    dispatcher = environment.api.get(NotificationDispatcher);
    publisher = (await (
      (environment.api.get(FacebookPublisher) as DemoAwareFacebookPublisher).inner as TenantFacebookPublisher
    ).current()) as DevelopmentFacebookPublisher;
    zalo = (await (
      (environment.api.get(ZaloSender) as DemoAwareZaloSender).inner as TenantZaloSender
    ).current()) as DevelopmentZaloSender;
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, 'Năm học kết nối', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await api('POST', '/org-units', principal.accessToken, { code: 'TC', name: 'TC', unit_type: 'truong_chinh' });
    unitId = (
      await api('POST', '/org-units', principal.accessToken, { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' })
    ).body.id as string;
    otherUnitId = (
      await api('POST', '/org-units', principal.accessToken, { code: 'ĐT-B1', name: 'ĐT-B1', unit_type: 'diem_truong' })
    ).body.id as string;
    users.manager = await environment.loginAs('VT-03', unitId);
    users.otherManager = await environment.loginAs('VT-03', otherUnitId);
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.accountant = await environment.loginAs('VT-04', unitId);
    for (const name of ['parentA', 'parentB', 'parentC']) {
      users[name] = await environment.loginAs('VT-14', unitId);
    }
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: 'MAM-1',
          name: 'MAM-1',
          grade_level: 'MAM',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: users.homeroom?.userId ?? '',
        staff_name: 'Cô chủ nhiệm',
        assignment_role: 'homeroom',
        subject_name: null,
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, consent] of [
      ['A', 'granted'],
      ['B', 'pending'],
      ['C', 'granted'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Trẻ ${key}`,
          dob: '2022-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: consent,
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({ full_name: `Mẹ ${key}`, phone: phones[key] ?? null, user_id: users[`parent${key}`]?.userId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-202: Hiệu trưởng cấu hình kết nối; trường lạ như khóa truy cập bị từ chối; người khác không cấu hình được', async () => {
    const initial = await api('GET', '/integrations', principal.accessToken);
    assert.equal(initial.status, 200, JSON.stringify(initial.body));
    const list = initial.body as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      list.map((row) => [row.connector, row.enabled, row.provider, row.credentials_configured]),
      [
        ['facebook', false, 'development', true],
        ['zalo', false, 'development', true],
      ],
    );
    assert.equal((await api('GET', '/integrations', token('manager'))).status, 403);
    assert.equal(
      (await api('PUT', '/integrations/facebook', token('manager'), { enabled: true, config: { page_id: '1' } }))
        .status,
      403,
    );
    const secret = await api('PUT', '/integrations/facebook', principal.accessToken, {
      enabled: true,
      config: { page_id: '1234567890', access_token: 'bi-mat' },
    });
    assert.equal(secret.status, 400);
    assert.equal(
      (await api('PUT', '/integrations/zalo', principal.accessToken, { enabled: true, config: {} })).status,
      400,
    );
    assert.equal(
      (await api('PUT', '/integrations/twitter', principal.accessToken, { enabled: true, config: {} })).status,
      404,
    );
    const saved = await api('PUT', '/integrations/facebook', principal.accessToken, {
      enabled: false,
      config: { page_id: '1234567890', page_name: 'Trường Mầm non' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.config, { page_id: '1234567890', page_name: 'Trường Mầm non' });
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'integration_settings')
      .execute();
    assert.equal(audit.length, 1);
  });

  it('CT-203: chỉ hoạt động đã duyệt được đăng Fanpage; hình có trẻ chưa đồng ý bị loại (BR-64, BR-65)', async () => {
    const category = await api('POST', '/activity-categories', token('manager'), {
      org_unit_id: unitId,
      name: 'Vui chơi',
    });
    const created = await api('POST', '/activities', token('homeroom'), {
      class_id: classId,
      category_id: category.body.id,
      title: 'Bé vẽ tranh',
      content: 'Các bé vẽ tranh mùa thu',
      activity_date: vietnamToday,
      draft: true,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    activityId = created.body.id as string;
    for (const childIds of [children.A ?? '', `${children.A},${children.B}`, '']) {
      const media = await upload(`/activities/${activityId}/media`, token('homeroom'), { child_ids: childIds });
      assert.equal(media.status, 201, JSON.stringify(media.body));
    }
    await api('POST', `/activities/${activityId}/submit`, token('homeroom'));

    // Chưa bật kết nối
    const disabled = await api('POST', `/activities/${activityId}/facebook-post`, token('manager'));
    assert.equal(disabled.status, 422);
    assert.equal(errorOf(disabled.body).rule_code, 'P14-08');
    await api('PUT', '/integrations/facebook', principal.accessToken, {
      enabled: true,
      config: { page_id: '1234567890' },
    });
    // Chưa duyệt
    const pending = await api('POST', `/activities/${activityId}/facebook-post`, token('manager'));
    assert.equal(pending.status, 422);
    assert.equal(errorOf(pending.body).rule_code, 'BR-64');
    assert.equal((await api('POST', `/activities/${activityId}/approve`, token('manager'))).status, 200);

    assert.equal((await api('POST', `/activities/${activityId}/facebook-post`, token('homeroom'))).status, 403);
    assert.equal((await api('POST', `/activities/${activityId}/facebook-post`, token('otherManager'))).status, 403);
    assert.equal((await api('POST', `/activities/${activityId}/facebook-post`, token('parentA'))).status, 403);

    const posted = await api('POST', `/activities/${activityId}/facebook-post`, token('manager'));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    assert.equal(posted.body.status, 'posted');
    assert.equal((posted.body.photo_file_ids as string[]).length, 2);
    assert.equal(posted.body.excluded_photo_count, 1);
    assert.equal(posted.body.provider, 'development');
    const last = publisher.posts.at(-1);
    assert.equal(last?.postId, posted.body.external_post_id);
    assert.equal(last?.pageId, '1234567890');
    assert.match(last?.message ?? '', /Bé vẽ tranh/);

    const again = await api('POST', `/activities/${activityId}/facebook-post`, principal.accessToken);
    assert.equal(again.status, 409);
    const listed = await api('GET', `/facebook-posts?source_id=${activityId}`, token('manager'));
    assert.equal((listed.body as unknown as unknown[]).length, 1);
    assert.equal(((await api('GET', '/facebook-posts', token('otherManager'))).body as unknown as unknown[]).length, 0);
  });

  it('CT-204: Facebook lỗi thì ghi lỗi và thử lại; tin theo lớp không đăng công khai', async () => {
    const news = await api('POST', '/news', token('manager'), {
      org_unit_id: unitId,
      title: 'Lễ khai giảng',
      summary: 'Thông tin lễ khai giảng',
      content: 'Mời phụ huynh dự lễ',
    });
    assert.equal(news.status, 201, JSON.stringify(news.body));
    const newsId = news.body.id as string;
    const draft = await api('POST', `/news/${newsId}/facebook-post`, token('manager'));
    assert.equal(errorOf(draft.body).rule_code, 'BR-64');
    await api('POST', `/news/${newsId}/publish`, token('manager'));
    publisher.failuresLeft = 1;
    const failed = await api('POST', `/news/${newsId}/facebook-post`, token('manager'));
    assert.equal(failed.status, 201);
    assert.equal(failed.body.status, 'failed');
    assert.equal(failed.body.last_error, 'Facebook trả lỗi (giả lập)');
    assert.equal(failed.body.attempt_count, 1);
    const retried = await api('POST', `/facebook-posts/${failed.body.id}/retry`, token('manager'));
    assert.equal(retried.status, 200, JSON.stringify(retried.body));
    assert.equal(retried.body.status, 'posted');
    assert.equal(retried.body.attempt_count, 2);
    assert.equal(retried.body.last_error, null);
    assert.equal((await api('POST', `/facebook-posts/${failed.body.id}/retry`, token('manager'))).status, 409);

    const classNews = await api('POST', '/news', token('manager'), {
      org_unit_id: unitId,
      title: 'Tin lớp',
      content: 'Riêng lớp',
      scope_type: 'class',
      scope_id: classId,
    });
    await api('POST', `/news/${classNews.body.id}/publish`, token('manager'));
    const blocked = await api('POST', `/news/${classNews.body.id}/facebook-post`, token('manager'));
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'P14-08');
  });

  it('CT-205: liên kết Zalo theo số điện thoại; gửi qua Zalo khi đã liên kết, không thì tin nhắn', async () => {
    const notGuardian = await api('POST', '/integrations/zalo/followers', principal.accessToken, {
      phone: '0999999999',
      zalo_user_id: 'zalo-x',
    });
    assert.equal(notGuardian.status, 422);
    assert.equal(
      (await api('POST', '/integrations/zalo/followers', token('manager'), { phone: phones.A, zalo_user_id: 'z1' }))
        .status,
      403,
    );
    const linked = await api('POST', '/integrations/zalo/followers', principal.accessToken, {
      phone: phones.A,
      zalo_user_id: 'zalo-user-a',
      display_name: 'Mẹ A',
    });
    assert.equal(linked.status, 201, JSON.stringify(linked.body));
    assert.equal(
      (
        await api('POST', '/integrations/zalo/followers', principal.accessToken, {
          phone: phones.A,
          zalo_user_id: 'zalo-khac',
        })
      ).status,
      409,
    );
    const followers = await api('GET', '/integrations/zalo/followers', principal.accessToken);
    assert.equal((followers.body as unknown as Array<{ guardian_name: string }>)[0]?.guardian_name, 'Mẹ A');

    // Zalo chưa bật: kênh zalo gửi tin nhắn
    const beforeEnable = await queue(users.parentA?.userId ?? '', 'zalo', 'Chưa bật Zalo');
    await dispatcher.dispatchPending();
    assert.deepEqual(await recipientOf(beforeEnable), {
      channel_status: 'sent',
      delivered_via: 'sms',
      last_error: null,
    });

    await api('PUT', '/integrations/zalo', principal.accessToken, { enabled: true, config: { oa_id: '4321' } });
    const viaZalo = await queue(users.parentA?.userId ?? '', 'zalo', 'Qua Zalo');
    const unlinked = await queue(users.parentB?.userId ?? '', 'zalo', 'Chưa liên kết');
    const smsOnly = await queue(users.parentA?.userId ?? '', 'sms', 'Chỉ tin nhắn');
    const smsBefore = environment.smsGateway.messages.length;
    await dispatcher.dispatchPending();
    assert.equal((await recipientOf(viaZalo)).delivered_via, 'zalo');
    assert.deepEqual(zalo.messages.at(-1), { zaloUserId: 'zalo-user-a', text: 'Qua Zalo: Nội dung' });
    assert.equal((await recipientOf(unlinked)).delivered_via, 'sms');
    assert.equal((await recipientOf(smsOnly)).delivered_via, 'sms');
    assert.equal(environment.smsGateway.messages.length, smsBefore + 2);

    // Zalo lỗi thì gửi ngay bằng tin nhắn
    zalo.failuresLeft = 1;
    const fallback = await queue(users.parentA?.userId ?? '', 'zalo', 'Zalo lỗi');
    await dispatcher.dispatchPending();
    const fell = await recipientOf(fallback);
    assert.equal(fell.channel_status, 'sent');
    assert.equal(fell.delivered_via, 'sms');
    assert.match(fell.last_error ?? '', /Gửi Zalo lỗi/);
  });

  it('CT-206: tin qua Zalo tính chung giới hạn 5 tin mỗi ngày với tin nhắn', async () => {
    await api('POST', '/integrations/zalo/followers', principal.accessToken, {
      phone: phones.C,
      zalo_user_id: 'zalo-user-c',
    });
    const ids: string[] = [];
    for (let index = 0; index <= DAILY_SMS_LIMIT; index += 1) {
      ids.push(await queue(users.parentC?.userId ?? '', index % 2 === 0 ? 'zalo' : 'sms', `Giới hạn ${index}`));
    }
    await dispatcher.dispatchPending();
    const statuses = await Promise.all(ids.map(async (id) => (await recipientOf(id)).channel_status));
    assert.equal(statuses.filter((status) => status === 'sent').length, DAILY_SMS_LIMIT);
    assert.equal(statuses.filter((status) => status === 'limited').length, 1);
  });

  it('CT-207: nhắc nợ gửi qua Zalo cho phụ huynh đã liên kết khi bật Zalo (P05-10)', async () => {
    const invoice = await schoolYear
      .insertInto('invoices')
      .values({
        code: 'HD-900001',
        child_id: children.A ?? '',
        org_unit_id: unitId,
        period_year: Number(vietnamToday.slice(0, 4)),
        period_month: Number(vietnamToday.slice(5, 7)),
        invoice_kind: 'main',
        status: 'issued',
        total_amount: 1_500_000,
        basis: JSON.stringify({}),
        due_date: addDays(vietnamToday, -20),
        issued_at: new Date(),
        issued_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const sent = await api('POST', '/debts/reminders/send', token('accountant'), {
      org_unit_id: unitId,
      invoice_ids: [invoice.id],
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.sent_count, 1);
    const recipients = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.id', 'notification_recipients.channel'])
      .where('notifications.template_code', '=', 'debt_reminder')
      .execute();
    assert.deepEqual(recipients.map((row) => row.channel).sort(), ['in_app', 'zalo']);
    await dispatcher.dispatchPending();
    const zaloRow = recipients.find((row) => row.channel === 'zalo');
    assert.equal((await recipientOf(zaloRow?.id ?? '')).delivered_via, 'zalo');
    assert.match(zalo.messages.at(-1)?.text ?? '', /Nhắc nộp học phí quá hạn/);
  });

  it('CT-12c-8: Hiệu trưởng kiểm tra kết nối và thay khóa làm mới Zalo; người khác bị từ chối; khóa không trả lại (YCTD-92)', async () => {
    for (const name of ['manager', 'accountant', 'homeroom', 'parentA']) {
      assert.equal((await api('POST', '/integrations/facebook/test', token(name))).status, 403);
      assert.equal((await api('POST', '/integrations/zalo/test', token(name))).status, 403);
      assert.equal(
        (await api('PUT', '/integrations/zalo/refresh-token', token(name), { refresh_token: 'khoa-lam-moi-123' }))
          .status,
        403,
      );
    }
    const facebookTest = await api('POST', '/integrations/facebook/test', principal.accessToken);
    assert.equal(facebookTest.status, 200, JSON.stringify(facebookTest.body));
    assert.deepEqual(facebookTest.body, {
      connector: 'facebook',
      ok: true,
      page_id: '1234567890',
      page_name: 'Fanpage giả lập',
    });
    publisher.failuresLeft = 1;
    const facebookFailed = await api('POST', '/integrations/facebook/test', principal.accessToken);
    assert.equal(facebookFailed.status, 422);
    assert.match(String(facebookFailed.body.error?.message), /Kiểm tra kết nối Fanpage lỗi: Facebook trả lỗi/);

    const zaloTest = await api('POST', '/integrations/zalo/test', principal.accessToken);
    assert.equal(zaloTest.status, 200, JSON.stringify(zaloTest.body));
    assert.equal(zaloTest.body.oa_name, 'Official Account giả lập');

    assert.equal(
      (await api('PUT', '/integrations/zalo/refresh-token', principal.accessToken, { refresh_token: 'co khoang' }))
        .status,
      400,
    );
    const secret = 'khoa-lam-moi-bi-mat-123456';
    const replaced = await api('PUT', '/integrations/zalo/refresh-token', principal.accessToken, {
      refresh_token: secret,
    });
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    assert.equal(JSON.stringify(replaced.body).includes(secret), false);
    assert.equal((replaced.body.token_status as { refresh_token_configured: boolean }).refresh_token_configured, true);
    const listed = await api('GET', '/integrations', principal.accessToken);
    assert.equal(JSON.stringify(listed.body).includes(secret), false);
    const stored = await environment.system.selectFrom('integration_credentials').selectAll().executeTakeFirstOrThrow();
    assert.equal(stored.connector, 'zalo');
    assert.equal(stored.refresh_token_encrypted?.includes(secret), false);
    assert.equal(stored.updated_by, principal.userId);
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select(['action', 'after_data'])
      .where('entity_name', '=', 'integration_credentials')
      .execute();
    assert.equal(audit.length, 1);
    assert.equal(JSON.stringify(audit[0]?.after_data).includes(secret), false);
  });
});

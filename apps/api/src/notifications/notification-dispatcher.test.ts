import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { queueNotification } from '../common/notification-queue.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { DAILY_SMS_LIMIT, MAXIMUM_ATTEMPTS, NotificationDispatcher } from './notification-dispatcher.js';

// Tiến trình gửi thông báo, gửi lại khi lỗi, giới hạn tin nhắn trong ngày, nhắc ghi nhật ký (DT-09 phần 9f, YCTD-71);
// ca kiểm thử CT-090, CTC-P02-033, CTC-P04-041
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Tiến trình gửi thông báo', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let parent: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let dispatcher: NotificationDispatcher;
  let academicYearId = '';
  let unitA = '';
  const phone = '0903123456';

  async function queue(userId: string, channel: 'in_app' | 'sms', title = 'Thông báo') {
    await queueNotification(schoolYear, {
      orgUnitId: unitA,
      templateCode: 'test',
      title,
      body: 'Nội dung',
      targetType: 'test',
      targetId: randomUUID(),
      recipients: [{ userId, channel }],
    });
    return schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notification_recipients.id')
      .where('notifications.title', '=', title)
      .executeTakeFirstOrThrow();
  }

  const recipientOf = (id: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .select(['channel_status', 'attempt_count', 'next_attempt_at', 'last_error', 'sent_at'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

  before(async () => {
    environment = await startApiTestEnvironment();
    dispatcher = environment.api.get(NotificationDispatcher);
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    const api = (method: string, path: string, body?: unknown) =>
      sendJson(method, `${environment.baseUrl}${path}`, principal.accessToken, body);
    await api('POST', '/org-units', { code: 'TC', name: 'Trường chính', unit_type: 'truong_chinh' });
    unitA = (await api('POST', '/org-units', { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' })).body
      .id as string;
    parent = await environment.loginAs('VT-14', unitA);
    teacher = await environment.loginAs('VT-07', unitA);
    await schoolYear.insertInto('guardians').values({ full_name: 'Mẹ', phone, user_id: parent.userId }).execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('Thông báo trong ứng dụng chuyển sang đã gửi; tin nhắn gửi tới số điện thoại của phụ huynh', async () => {
    const inApp = await queue(parent.userId, 'in_app', 'Trong ứng dụng');
    const sms = await queue(parent.userId, 'sms', 'Tin nhắn');
    await dispatcher.dispatchPending();
    assert.equal((await recipientOf(inApp.id)).channel_status, 'sent');
    const sent = await recipientOf(sms.id);
    assert.equal(sent.channel_status, 'sent');
    assert.equal(sent.attempt_count, 1);
    assert.deepEqual(environment.smsGateway.messages.at(-1), { phone, text: 'Tin nhắn: Nội dung' });
  });

  it('CT-090, CTC-P02-033: nhà cung cấp lỗi thì tin nhắn chờ gửi lại sau 15 phút và gửi lại thành công', async () => {
    environment.smsGateway.failuresLeft = 1;
    const sms = await queue(parent.userId, 'sms', 'Gửi lại');
    const first = await dispatcher.dispatchPending();
    assert.equal(first.retried, 1);
    const waiting = await recipientOf(sms.id);
    assert.equal(waiting.channel_status, 'pending');
    assert.equal(waiting.attempt_count, 1);
    assert.equal(waiting.last_error, 'Nhà cung cấp tin nhắn trả lỗi');
    const delay = (waiting.next_attempt_at?.getTime() ?? 0) - Date.now();
    assert.ok(delay > 14 * 60_000 && delay <= 15 * 60_000, String(delay));

    await dispatcher.dispatchPending();
    assert.equal((await recipientOf(sms.id)).channel_status, 'pending');

    await schoolYear
      .updateTable('notification_recipients')
      .set({ next_attempt_at: new Date(Date.now() - 1000) })
      .where('id', '=', sms.id)
      .execute();
    await dispatcher.dispatchPending();
    const resent = await recipientOf(sms.id);
    assert.equal(resent.channel_status, 'sent');
    assert.equal(resent.attempt_count, 2);
    assert.equal(resent.last_error, null);
  });

  it('CB-07: lỗi đủ số lần thử tối đa thì ghi thất bại, không thử nữa', async () => {
    environment.smsGateway.failuresLeft = MAXIMUM_ATTEMPTS;
    const sms = await queue(parent.userId, 'sms', 'Luôn lỗi');
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      await schoolYear
        .updateTable('notification_recipients')
        .set({ next_attempt_at: null })
        .where('id', '=', sms.id)
        .execute();
      await dispatcher.dispatchPending();
    }
    const failed = await recipientOf(sms.id);
    assert.equal(failed.channel_status, 'failed');
    assert.equal(failed.attempt_count, MAXIMUM_ATTEMPTS);
    assert.equal(environment.smsGateway.failuresLeft, 0);
  });

  it('KT-09: mỗi người nhận tối đa 5 tin nhắn thông báo mỗi ngày; người không có số điện thoại thì ghi thất bại', async () => {
    const sentToday = environment.smsGateway.messages.length;
    assert.equal(sentToday, 2);
    const ids: string[] = [];
    for (let index = 0; index < DAILY_SMS_LIMIT - sentToday + 1; index += 1) {
      ids.push((await queue(parent.userId, 'sms', `Giới hạn ${index}`)).id);
    }
    const result = await dispatcher.dispatchPending();
    assert.equal(result.limited, 1);
    assert.equal(environment.smsGateway.messages.length, DAILY_SMS_LIMIT);
    const last = await recipientOf(ids.at(-1) ?? '');
    assert.equal(last.channel_status, 'limited');

    const noPhone = await queue(teacher.userId, 'sms', 'Không có số');
    await dispatcher.dispatchPending();
    const failed = await recipientOf(noPhone.id);
    assert.equal(failed.channel_status, 'failed');
    assert.equal(failed.last_error, 'Người nhận không có số điện thoại');
  });

  it('CTC-P04-041: đến giờ nhắc, lớp còn trẻ chưa có nhật ký thì giáo viên chủ nhiệm và quản lý đơn vị nhận nhắc một lần', async () => {
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: academicYearId,
          code: 'L-A1',
          name: 'Lá 1',
          grade_level: 'LA',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const doneClassId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: academicYearId,
          code: 'L-A2',
          name: 'Lá 2',
          grade_level: 'LA',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: teacher.userId,
        staff_name: 'GV-A1',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -30),
      })
      .execute();
    for (const [key, targetClass] of [
      ['T1', classId],
      ['T2', doneClassId],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Trẻ ${key}`,
          dob: '2021-03-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -30),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: targetClass, from_date: addDays(vietnamToday, -30) })
        .execute();
      if (targetClass === doneClassId) {
        await schoolYear
          .insertInto('daily_journals')
          .values({
            child_id: child.id,
            class_id: targetClass,
            journal_date: vietnamToday,
            meal_note: 'Ăn hết',
            status: 'published',
            published_at: new Date(),
            published_by: teacher.userId,
            updated_by: teacher.userId,
          })
          .execute();
      }
    }
    // Hôm nay là ngày học bù để kiểm thử chạy được cả ngày cuối tuần
    await schoolYear
      .insertInto('school_day_changes')
      .values({ change_date: vietnamToday, change_type: 'makeup_school_day', note: 'Kiểm thử' })
      .execute();

    assert.equal(await dispatcher.remindJournals(), 0);

    const saved = await sendJson('PUT', `${environment.baseUrl}/settings`, principal.accessToken, {
      org_unit_id: unitA,
      values: { journal_reminder_time: '00:00' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(await dispatcher.remindJournals(), 1);
    assert.equal(await dispatcher.remindJournals(), 0);

    const reminders = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select([
        'notifications.target_id',
        'notifications.body',
        'notification_recipients.user_id',
        'notification_recipients.role_code',
      ])
      .where('notifications.template_code', '=', 'journal_reminder')
      .execute();
    assert.equal(reminders.length, 2);
    assert.ok(reminders.every((row) => row.target_id === classId));
    assert.ok(reminders.some((row) => row.user_id === teacher.userId));
    assert.ok(reminders.some((row) => row.role_code === 'VT-03'));
    assert.equal(reminders[0]?.body, `Lớp Lá 1 còn 1 trẻ chưa có nhật ký ngày ${vietnamToday}`);

    const unread = await sendJson('GET', `${environment.baseUrl}/notifications?unread_only=true`, teacher.accessToken);
    assert.equal(unread.status, 200, JSON.stringify(unread.body));
    assert.ok(JSON.stringify(unread.body).includes('Nhắc ghi nhật ký'));
  });
});

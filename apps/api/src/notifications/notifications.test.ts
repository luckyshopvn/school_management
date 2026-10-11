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

// Trung tâm thông báo và mẫu thông báo (DT-08 phần 8a, YCTD-64); quy tắc BR-70
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Trung tâm thông báo', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const notifications: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const titles = async (name: string) =>
    (
      (await api('GET', '/notifications', name === 'principal' ? principal.accessToken : token(name))).body
        .notifications as Array<{ title: string }>
    )
      .map((row) => row.title)
      .sort();

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -30), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.managerB = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.rootManager = await environment.loginAs('VT-03', units.TC ?? null);
    for (const [key, title, recipients] of [
      ['direct', 'Gửi riêng giáo viên', [{ userId: users.teacher?.userId ?? '', channel: 'in_app' as const }]],
      [
        'unit',
        'Gửi quản lý ĐT-A1',
        [{ roleCode: 'VT-03', orgUnitId: units['ĐT-A1'] ?? '', channel: 'in_app' as const }],
      ],
      ['principal', 'Gửi Hiệu trưởng', [{ roleCode: 'VT-02', orgUnitId: units.TC ?? '', channel: 'in_app' as const }]],
      ['sms', 'Chỉ gửi tin nhắn', [{ userId: users.teacher?.userId ?? '', channel: 'sms' as const }]],
    ] as const) {
      await queueNotification(schoolYear, {
        orgUnitId: units['ĐT-A1'] ?? null,
        templateCode: 'leave_request_submitted',
        title,
        body: `Nội dung ${key}`,
        targetType: 'leave_requests',
        targetId: randomUUID(),
        recipients: [...recipients],
      });
      notifications[key] = (
        await schoolYear.selectFrom('notifications').select('id').where('title', '=', title).executeTakeFirstOrThrow()
      ).id;
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P19-04: mỗi người thấy thông báo gửi riêng và theo vai trò ở đơn vị của mình; không thấy thông báo tin nhắn', async () => {
    assert.deepEqual(await titles('teacher'), ['Gửi riêng giáo viên']);
    assert.deepEqual(await titles('manager'), ['Gửi quản lý ĐT-A1']);
    assert.deepEqual(await titles('managerB'), []);
    assert.deepEqual(await titles('rootManager'), ['Gửi quản lý ĐT-A1']);
    assert.deepEqual(await titles('principal'), ['Gửi Hiệu trưởng']);
  });

  it('đánh dấu đã đọc làm giảm số chưa đọc; thông báo của người khác không đánh dấu được', async () => {
    const before = await api('GET', '/notifications', token('teacher'));
    assert.equal(before.body.unread_count, 1);
    const read = await api('POST', `/notifications/${notifications.direct}/read`, token('teacher'));
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.equal((await api('POST', `/notifications/${notifications.direct}/read`, token('teacher'))).status, 200);
    const after = await api('GET', '/notifications?unread_only=true', token('teacher'));
    assert.equal(after.body.unread_count, 0);
    assert.equal((after.body.notifications as unknown[]).length, 0);
    assert.equal((await api('POST', `/notifications/${notifications.unit}/read`, token('teacher'))).status, 404);
    const all = await api('POST', '/notifications/read-all', token('manager'));
    assert.equal(all.body.unread_count, 0);
  });

  it('BR-70: quản lý xem ai đã đọc thông báo của đơn vị; giáo viên không xem được', async () => {
    const direct = await api('GET', `/notifications/${notifications.direct}/receipts`, token('manager'));
    assert.equal(direct.status, 200, JSON.stringify(direct.body));
    const recipients = direct.body.direct_recipients as Array<{ user_id: string; read_at: string | null }>;
    assert.equal(recipients[0]?.user_id, users.teacher?.userId);
    assert.ok(recipients[0]?.read_at);
    assert.equal(direct.body.unread_count, 0);
    const unit = await api('GET', `/notifications/${notifications.unit}/receipts`, principal.accessToken);
    assert.deepEqual(
      (unit.body.readers as Array<{ user_id: string }>).map((row) => row.user_id),
      [users.manager?.userId],
    );
    assert.equal((await api('GET', `/notifications/${notifications.unit}/receipts`, token('teacher'))).status, 403);
    assert.equal((await api('GET', `/notifications/${notifications.unit}/receipts`, token('managerB'))).status, 403);
  });

  it('P19-05: người gán ở Trường chính sửa mẫu; mẫu thay tiêu đề và nội dung khi hiển thị; quản lý điểm trường không sửa được', async () => {
    const template = {
      title_template: '[{don_vi}] {tieu_de}',
      body_template: '{noi_dung}. Vui lòng xem trên hệ thống.',
    };
    assert.equal(
      (await api('PUT', '/notification-templates/leave_request_submitted', token('manager'), template)).status,
      403,
    );
    const saved = await api('PUT', '/notification-templates/leave_request_submitted', principal.accessToken, template);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(await titles('teacher'), ['[ĐT-A1] Gửi riêng giáo viên']);
    const list = await api('GET', '/notification-templates', token('rootManager'));
    assert.ok(
      (list.body as unknown as Array<{ template_code: string }>).some(
        (row) => row.template_code === 'leave_request_submitted',
      ),
    );
    assert.equal((await api('GET', '/notification-templates', token('teacher'))).status, 403);
    assert.equal(
      (await api('DELETE', '/notification-templates/leave_request_submitted', principal.accessToken)).status,
      204,
    );
    assert.deepEqual(await titles('teacher'), ['Gửi riêng giáo viên']);
  });
});

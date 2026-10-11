import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Lịch nghỉ và lịch công tác (DT-09 phần 9c, YCTD-68); ca kiểm thử CTC-P08-007, CTC-P08-008
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const currentMonth = vietnamToday.slice(0, 7);
const previousMonth = new Date(Date.parse(`${currentMonth}-01T00:00:00Z`) - 86_400_000).toISOString().slice(0, 7);
const nextMonth = new Date(Date.parse(`${currentMonth}-01T00:00:00Z`) + 32 * 86_400_000).toISOString().slice(0, 7);
const firstWeekday = (month: string, skip = 0) => {
  let date = `${month}-01`;
  let seen = 0;
  for (;;) {
    if (weekdayOf(date) !== 0 && weekdayOf(date) !== 6) {
      if (seen === skip) {
        return date;
      }
      seen += 1;
    }
    date = addDays(date, 1);
  }
};

describe('Lịch nghỉ và lịch công tác', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staffIds: Record<string, string> = {};
  const scheduleIds: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
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
    const unitA = units['ĐT-A1'] ?? null;
    users.manager = await environment.loginAs('VT-03', unitA);
    users.personnel = await environment.loginAs('VT-06', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.managerB = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    staffIds.teacher = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitA ?? '',
          code: `NV-${randomInt(100_000, 999_999)}`,
          full_name: 'Nguyễn Văn Công Tác',
          start_date: addDays(vietnamToday, -400),
          user_id: users.teacher?.userId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unitA,
      values: { work_start_time: '07:30', work_end_time: '17:00', lunch_break_minutes: 60 },
    });
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CTC-P08-008: giáo viên lập lịch công tác bị từ chối; quản lý đơn vị khác bị từ chối', async () => {
    const body = { staff_id: staffIds.teacher, schedule_date: firstWeekday(nextMonth), schedule_type: 'business_trip' };
    assert.equal((await api('POST', '/work-schedules', token('teacher'), body)).status, 403);
    assert.equal((await api('POST', '/work-schedules', token('managerB'), body)).status, 403);
  });

  it('CTC-P08-007: quản lý đơn vị lập lịch công tác; công bố thì nhân sự nhận thông báo và thấy lịch của mình', async () => {
    const date = firstWeekday(nextMonth, 2);
    const created = await api('POST', '/work-schedules', token('manager'), {
      staff_id: staffIds.teacher,
      schedule_date: date,
      schedule_type: 'business_trip',
      note: 'Tập huấn chuyên môn tại Sở',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'draft');
    scheduleIds.next = created.body.id as string;
    const duplicate = await api('POST', '/work-schedules', token('personnel'), {
      staff_id: staffIds.teacher,
      schedule_date: date,
      schedule_type: 'day_off',
    });
    assert.equal(duplicate.status, 409);
    const before = await api('GET', `/me/work-schedules?month=${nextMonth}`, token('teacher'));
    assert.deepEqual(before.body, []);
    const published = await api('POST', '/work-schedules/publish', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      month: nextMonth,
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.published_count, 1);
    const mine = (await api('GET', `/me/work-schedules?month=${nextMonth}`, token('teacher')))
      .body as unknown as Array<{
      schedule_date: string;
      schedule_type: string;
      note: string;
    }>;
    assert.deepEqual(
      mine.map((row) => [row.schedule_date, row.schedule_type, row.note]),
      [[date, 'business_trip', 'Tập huấn chuyên môn tại Sở']],
    );
    const notifications = await api('GET', '/notifications', token('teacher'));
    assert.ok(
      (notifications.body.notifications as Array<{ title: string }>).some((row) => row.title === 'Lịch công tác'),
    );
    const listed = await api(
      'GET',
      `/work-schedules?org_unit_id=${units['ĐT-A1']}&month=${nextMonth}`,
      token('personnel'),
    );
    assert.equal((listed.body as unknown as unknown[]).length, 1);
    assert.equal(
      (await api('GET', `/work-schedules?org_unit_id=${units['ĐT-A1']}&month=${nextMonth}`, token('teacher'))).status,
      403,
    );
  });

  it('xóa lịch đã công bố thì nhân sự nhận thông báo; giáo viên không xóa được', async () => {
    assert.equal((await api('DELETE', `/work-schedules/${scheduleIds.next}`, token('teacher'))).status, 403);
    assert.equal((await api('DELETE', `/work-schedules/${scheduleIds.next}`, token('personnel'))).status, 204);
    const notice = await schoolYear
      .selectFrom('notifications')
      .select('template_code')
      .where('template_code', '=', 'work_schedule_removed')
      .executeTakeFirst();
    assert.ok(notice);
  });

  it('ngày công tác đã công bố chưa chấm công được bảng công tính là ngày làm việc; kỳ đã chốt không lập thêm được', async () => {
    const tripDay = firstWeekday(previousMonth, 3);
    const created = await api('POST', '/work-schedules', token('personnel'), {
      staff_id: staffIds.teacher,
      schedule_date: tripDay,
      schedule_type: 'business_trip',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    await api('POST', '/work-schedules/publish', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      month: previousMonth,
    });
    const closed = await api('POST', '/attendance-logs/lock', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      month: previousMonth,
    });
    assert.equal(closed.status, 201, JSON.stringify(closed.body));
    const day = await schoolYear
      .selectFrom('timesheet_days')
      .select(['status', 'worked_minutes', 'unpaid_days', 'note'])
      .where('staff_id', '=', staffIds.teacher ?? '')
      .where('work_date', '=', tripDay)
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      { ...day, unpaid_days: Number(day.unpaid_days) },
      { status: 'present', worked_minutes: 510, unpaid_days: 0, note: 'Công tác' },
    );
    const blocked = await api('POST', '/work-schedules', token('personnel'), {
      staff_id: staffIds.teacher,
      schedule_date: firstWeekday(previousMonth, 5),
      schedule_type: 'day_off',
    });
    assert.equal(blocked.status, 422);
  });
});

import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { SchoolCalendar } from '../attendance/school-calendar.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { attendanceTimes } from './staff-attendance.service.js';

// Ngày nghỉ lễ, ngày học bù và nghỉ bù, chấm công của nhân sự (DT-06 phần 6b-1, YCTD-59); ca kiểm thử CTC-P08-001 đến 006,
// CTC-P08-050 đến 053 và các quy tắc BR-39, BR-84
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
// Ngày đầu tiên sau hôm nay có thứ trong tuần cho trước (1 là thứ hai, 7 là chủ nhật), cách hôm nay ít nhất `skip` ngày
const nextWeekday = (weekday: number, skip = 1) => {
  let date = addDays(vietnamToday, skip);
  while (weekdayOf(date) !== weekday) {
    date = addDays(date, 1);
  }
  return date;
};
const previousWorkday = () => {
  let date = addDays(vietnamToday, -1);
  while (weekdayOf(date) > 5) {
    date = addDays(date, -1);
  }
  return date;
};

describe('Ngày nghỉ lễ, lịch học bù và chấm công nhân sự', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let calendar: SchoolCalendar;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staffIds: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    // Lịch năm học bao quanh hôm nay để ngày học bù thứ bảy sắp tới thuộc học kỳ 1
    const firstStart = addDays(vietnamToday, -60);
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
    calendar = environment.api.get(SchoolCalendar);
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.rootPersonnel = await environment.loginAs('VT-06', units.TC ?? null);
    users.personnel = await environment.loginAs('VT-06', unitA);
    users.personnelB = await environment.loginAs('VT-06', units['ĐT-B1'] ?? null);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.unlinked = await environment.loginAs('VT-07', unitA);
    const created = await api('POST', '/staff', token('personnel'), {
      org_unit_id: unitA,
      code: `GV-${randomInt(100_000, 999_999)}`,
      full_name: 'Nguyễn Thị Lan',
      start_date: addDays(vietnamToday, -200),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    staffIds.teacher = created.body.id as string;
    await schoolYear
      .updateTable('staff')
      .set({ user_id: users.teacher?.userId ?? null })
      .where('id', '=', staffIds.teacher)
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P08-09 Ngày nghỉ lễ', () => {
    it('CTC-P08-050: phòng nhân sự gán ở Trường chính tạo ngày lễ có hưởng lương; trẻ không học, nhân sự nghỉ lễ', async () => {
      const date = nextWeekday(2, 2);
      const created = await api('POST', '/holidays', token('rootPersonnel'), {
        holiday_date: date,
        name: 'Ngày Nhà giáo Việt Nam',
        is_paid: true,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(
        (await api('POST', '/holidays', token('rootPersonnel'), { holiday_date: date, name: 'Trùng', is_paid: true }))
          .status,
        409,
      );
      assert.match((await calendar.reasonNotSchoolDay(date)) ?? '', /nghỉ lễ/);
      assert.deepEqual((await calendar.staffDays(date, date)).get(date), {
        kind: 'holiday',
        name: 'Ngày Nhà giáo Việt Nam',
        is_paid: true,
      });
      const listed = await api('GET', `/school-days?year=${date.slice(0, 4)}`, token('teacher'));
      assert.equal(listed.status, 200);
      assert.ok((listed.body.holidays as Array<{ holiday_date: string }>).some((row) => row.holiday_date === date));

      const updated = await api('PUT', `/holidays/${created.body.id}`, token('rootPersonnel'), {
        name: 'Ngày Nhà giáo Việt Nam',
        is_paid: false,
      });
      assert.equal(updated.body.is_paid, false);
      assert.equal((await api('DELETE', `/holidays/${created.body.id}`, token('rootPersonnel'))).status, 204);
      assert.equal(await calendar.reasonNotSchoolDay(date), null);
    });

    it('CTC-P08-051: giáo viên, phòng nhân sự của điểm trường tạo ngày lễ bị từ chối; ngày đã qua bị chặn', async () => {
      const body = { holiday_date: nextWeekday(3, 2), name: 'Ngày lễ', is_paid: true };
      assert.equal((await api('POST', '/holidays', token('teacher'), body)).status, 403);
      assert.equal((await api('POST', '/holidays', token('personnel'), body)).status, 403);
      const past = await api('POST', '/holidays', token('rootPersonnel'), { ...body, holiday_date: vietnamToday });
      assert.equal(past.status, 422);
      assert.equal(
        (await api('POST', '/holidays', token('rootPersonnel'), { holiday_date: body.holiday_date })).status,
        400,
      );
    });
  });

  describe('P08-10 Lịch học bù và nghỉ bù', () => {
    it('CTC-P08-052: Hiệu trưởng lập ngày học bù thứ bảy; mọi lớp có ngày học, mọi nhân sự có ngày làm việc', async () => {
      const saturday = nextWeekday(6);
      assert.match((await calendar.reasonNotSchoolDay(saturday)) ?? '', /không phải ngày học trong tuần/);
      assert.equal((await calendar.staffDays(saturday, saturday)).get(saturday)?.kind, 'rest');
      const created = await api('POST', '/school-day-changes', principal.accessToken, {
        change_date: saturday,
        change_type: 'makeup_school_day',
        note: 'Học bù ngày nghỉ lễ',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(await calendar.reasonNotSchoolDay(saturday), null);
      assert.equal((await calendar.staffDays(saturday, saturday)).get(saturday)?.kind, 'work');
      const holidayOnSaturday = await api('POST', '/holidays', token('rootPersonnel'), {
        holiday_date: saturday,
        name: 'Trùng học bù',
        is_paid: true,
      });
      assert.equal(holidayOnSaturday.status, 422);
      assert.equal((await api('DELETE', `/school-day-changes/${created.body.id}`, principal.accessToken)).status, 204);
      assert.notEqual(await calendar.reasonNotSchoolDay(saturday), null);
    });

    it('Phó Hiệu trưởng lập ngày nghỉ bù thứ hai đến thứ sáu; học bù không phải thứ bảy, nghỉ bù vào thứ bảy bị chặn', async () => {
      const wednesday = nextWeekday(3, 8);
      const created = await api('POST', '/school-day-changes', token('vicePrincipal'), {
        change_date: wednesday,
        change_type: 'compensatory_day_off',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.match((await calendar.reasonNotSchoolDay(wednesday)) ?? '', /nghỉ bù/);
      assert.equal((await calendar.staffDays(wednesday, wednesday)).get(wednesday)?.kind, 'compensatory_day_off');
      const duplicate = await api('POST', '/school-day-changes', principal.accessToken, {
        change_date: wednesday,
        change_type: 'compensatory_day_off',
      });
      assert.equal(duplicate.status, 409);
      const notSaturday = await api('POST', '/school-day-changes', principal.accessToken, {
        change_date: nextWeekday(4, 8),
        change_type: 'makeup_school_day',
      });
      assert.equal(notSaturday.status, 400);
      const offOnSaturday = await api('POST', '/school-day-changes', principal.accessToken, {
        change_date: nextWeekday(6, 8),
        change_type: 'compensatory_day_off',
      });
      assert.equal(offOnSaturday.status, 400);
      await api('DELETE', `/school-day-changes/${created.body.id}`, principal.accessToken);
    });

    it('CTC-P08-053: quản lý đơn vị và phòng nhân sự lập lịch học bù bị từ chối', async () => {
      const body = { change_date: nextWeekday(6), change_type: 'makeup_school_day' };
      assert.equal((await api('POST', '/school-day-changes', token('manager'), body)).status, 403);
      assert.equal((await api('POST', '/school-day-changes', token('rootPersonnel'), body)).status, 403);
    });
  });

  describe('P08-01 Chấm công', () => {
    const workDate = previousWorkday();
    const save = (accessToken: string, body: Record<string, unknown>) =>
      api('PUT', '/attendance-logs', accessToken, { staff_id: staffIds.teacher, work_date: workDate, ...body });

    before(async () => {
      const saved = await api('PUT', '/settings', principal.accessToken, {
        org_unit_id: units['ĐT-A1'],
        values: { work_start_time: '07:30', work_end_time: '17:00', lunch_break_minutes: 90 },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    });

    it('tính số phút làm, đi muộn, về sớm theo giờ vào làm, giờ tan làm và nghỉ trưa', () => {
      const hours = { startMinutes: 450, endMinutes: 1020, lunchMinutes: 90 };
      assert.deepEqual(attendanceTimes('07:30', '17:00', hours), {
        worked_minutes: 480,
        late_minutes: 0,
        early_leave_minutes: 0,
      });
      assert.deepEqual(attendanceTimes('08:00', '16:30', hours), {
        worked_minutes: 420,
        late_minutes: 30,
        early_leave_minutes: 30,
      });
      assert.deepEqual(attendanceTimes('07:00', null, { startMinutes: null, endMinutes: null, lunchMinutes: 0 }), {
        worked_minutes: null,
        late_minutes: null,
        early_leave_minutes: null,
      });
    });

    it('CTC-P08-001, CTC-P08-003, CTC-P08-004: phòng nhân sự ghi giờ; ghi lại cùng ngày sửa chính bản ghi đó', async () => {
      const full = await save(token('personnel'), { check_in: '07:30', check_out: '17:00' });
      assert.equal(full.status, 200, JSON.stringify(full.body));
      assert.equal(full.body.worked_minutes, 480);
      assert.equal(full.body.late_minutes, 0);
      assert.equal(full.body.source, 'manual');
      const late = await save(token('personnel'), { check_in: '08:00', check_out: '17:00', note: 'Quên bấm vào ca' });
      assert.equal(late.body.late_minutes, 30);
      assert.equal(late.body.id, full.body.id);
      const rows = await schoolYear
        .selectFrom('attendance_logs')
        .select('id')
        .where('staff_id', '=', staffIds.teacher ?? '')
        .where('work_date', '=', workDate)
        .execute();
      assert.equal(rows.length, 1);
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select('action')
        .where('entity_name', '=', 'attendance_logs')
        .where('entity_id', '=', full.body.id as string)
        .execute();
      assert.deepEqual(audit.map((row) => row.action).sort(), ['create', 'update']);
    });

    it('CTC-P08-002: giờ ra nhỏ hơn giờ vào, ngày chưa tới, ngày trước khi vào làm đều bị chặn', async () => {
      assert.equal((await save(token('personnel'), { check_in: '17:00', check_out: '07:30' })).status, 400);
      assert.equal(
        (await save(token('personnel'), { work_date: addDays(vietnamToday, 1), check_in: '07:30' })).status,
        400,
      );
      assert.equal(
        (await save(token('personnel'), { work_date: addDays(vietnamToday, -300), check_in: '07:30' })).status,
        422,
      );
    });

    it('CTC-P08-005: phòng nhân sự của đơn vị khác ghi chấm công bị từ chối', async () => {
      assert.equal((await save(token('personnelB'), { check_in: '07:30', check_out: '17:00' })).status, 403);
      assert.equal((await save(token('manager'), { check_in: '07:30', check_out: '17:00' })).status, 403);
    });

    it('CTC-P08-006: giáo viên xem được chấm công của mình, không xem được bảng công của đơn vị', async () => {
      const month = workDate.slice(0, 7);
      const mine = await api('GET', `/me/attendance-logs?month=${month}`, token('teacher'));
      assert.equal(mine.status, 200, JSON.stringify(mine.body));
      assert.ok((mine.body.logs as Array<{ work_date: string }>).some((log) => log.work_date === workDate));
      assert.equal(
        (await api('GET', `/attendance-logs?org_unit_id=${units['ĐT-A1']}&month=${month}`, token('teacher'))).status,
        403,
      );
      const sheet = await api('GET', `/attendance-logs?org_unit_id=${units['ĐT-A1']}&month=${month}`, token('manager'));
      assert.equal(sheet.status, 200);
      assert.equal(sheet.body.can_manage, false);
      assert.deepEqual(sheet.body.work_hours, { start_time: '07:30', end_time: '17:00', lunch_break_minutes: 90 });
      const row = (sheet.body.staff as Array<{ id: string; logs: unknown[] }>).find(
        (item) => item.id === staffIds.teacher,
      );
      assert.equal(row?.logs.length, 1);
    });

    it('nhân sự tự bấm vào ca, ra ca hôm nay theo giờ máy chủ; vào ca hai lần bị chặn; tài khoản chưa gắn hồ sơ bị từ chối', async () => {
      const checkedIn = await api('POST', '/me/attendance-logs/check-in', token('teacher'));
      assert.equal(checkedIn.status, 201, JSON.stringify(checkedIn.body));
      const todayLog = checkedIn.body.today_log as { check_in: string; source: string; check_out: string | null };
      assert.match(todayLog.check_in, /^\d{2}:\d{2}$/);
      assert.equal(todayLog.source, 'self');
      assert.equal(todayLog.check_out, null);
      assert.equal((await api('POST', '/me/attendance-logs/check-in', token('teacher'))).status, 422);
      // Lùi giờ vào ca để giờ ra lớn hơn giờ vào khi bấm ngay sau đó
      await schoolYear
        .updateTable('attendance_logs')
        .set({ check_in: '00:00' })
        .where('staff_id', '=', staffIds.teacher ?? '')
        .where('work_date', '=', vietnamToday)
        .execute();
      const checkedOut = await api('POST', '/me/attendance-logs/check-out', token('teacher'));
      assert.equal(checkedOut.status, 201, JSON.stringify(checkedOut.body));
      assert.match((checkedOut.body.today_log as { check_out: string }).check_out, /^\d{2}:\d{2}$/);
      assert.equal((await api('POST', '/me/attendance-logs/check-in', token('unlinked'))).status, 404);
      assert.equal((await api('GET', '/me/attendance-logs?month=2026-13', token('teacher'))).status, 400);
    });
  });

  it('QĐ-17: mở năm học mới thì ngày lễ, lịch học bù, nghỉ bù và chấm công chuyển sang, giữ nguyên mã định danh', async () => {
    const holidayDate = nextWeekday(5, 2);
    const holiday = await api('POST', '/holidays', token('rootPersonnel'), {
      holiday_date: holidayDate,
      name: 'Ngày lễ chuyển năm',
      is_paid: true,
    });
    const makeup = await api('POST', '/school-day-changes', principal.accessToken, {
      change_date: nextWeekday(6),
      change_type: 'makeup_school_day',
    });
    const month = vietnamToday.slice(0, 7);
    const before = await api('GET', `/me/attendance-logs?month=${month}`, token('teacher'));
    const nextStart = addDays(vietnamToday, 300);
    const nextStartYear = Number(nextStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${nextStartYear}–${nextStartYear + 1}`, {
      first_term: { start_date: nextStart, end_date: addDays(nextStart, 100) },
      second_term: { start_date: addDays(nextStart, 110), end_date: addDays(nextStart, 200) },
    });
    const listed = await api('GET', `/school-days?year=${holidayDate.slice(0, 4)}`, token('teacher'));
    assert.ok((listed.body.holidays as Array<{ id: string }>).some((row) => row.id === holiday.body.id));
    assert.ok((listed.body.changes as Array<{ id: string }>).some((row) => row.id === makeup.body.id));
    const after = await api('GET', `/me/attendance-logs?month=${month}`, token('teacher'));
    assert.deepEqual(after.body.logs, before.body.logs);
  });
});

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

// Quy định phép năm, đơn nghỉ phép, chốt và mở lại bảng công (DT-06 phần 6b-2, YCTD-59); ca kiểm thử CTC-P08-009 đến 026,
// CTC-P08-054, CTC-P08-056 và các quy tắc BR-39, BR-40, BR-41, BR-82, BR-84, Q-135
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
const currentYear = Number(vietnamToday.slice(0, 4));
// Tháng trước của hôm nay: đã kết thúc nên chốt được
const previousMonthStart = (() => {
  const date = new Date(Date.parse(`${vietnamToday.slice(0, 7)}-01T00:00:00Z`) - 86_400_000);
  return `${date.toISOString().slice(0, 7)}-01`;
})();
const previousMonth = previousMonthStart.slice(0, 7);
const previousMonthDays = (() => {
  const days = [];
  for (let date = previousMonthStart; date.slice(0, 7) === previousMonth; date = addDays(date, 1)) {
    days.push(date);
  }
  return days;
})();
const previousWeekdays = previousMonthDays.filter((date) => weekdayOf(date) <= 5);
const previousSaturdays = previousMonthDays.filter((date) => weekdayOf(date) === 6);
// Hai ngày làm việc liền nhau sắp tới trong cùng năm
const nextWorkdays = (() => {
  let date = addDays(vietnamToday, 7);
  while (weekdayOf(date) !== 1) {
    date = addDays(date, 1);
  }
  return [date, addDays(date, 1), addDays(date, 2), addDays(date, 3)];
})();

describe('Phép năm, đơn nghỉ phép, chốt và mở lại bảng công', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staffIds: Record<string, string> = {};
  const leaveTypes: Record<string, string> = {};
  let jobTitleId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const requestLeave = (accessToken: string, body: Record<string, unknown>) =>
    api('POST', '/leave-requests', accessToken, { reason: 'Việc gia đình', ...body });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -90);
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
      ['ĐT-A2', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.rootPersonnel = await environment.loginAs('VT-06', units.TC ?? null);
    users.personnel = await environment.loginAs('VT-06', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.otherVicePrincipal = await environment.loginAs('VT-15', units['ĐT-A2'] ?? null);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    jobTitleId = (await api('POST', '/job-titles', token('personnel'), { org_unit_id: unitA, name: 'Giáo viên' })).body
      .id as string;
    const teacher = await api('POST', '/staff', token('personnel'), {
      org_unit_id: unitA,
      code: `GV-${randomInt(100_000, 999_999)}`,
      full_name: 'Nguyễn Thị Lan',
      job_title_id: jobTitleId,
      start_date: `${currentYear - 6}-08-01`,
    });
    assert.equal(teacher.status, 201, JSON.stringify(teacher.body));
    staffIds.teacher = teacher.body.id as string;
    staffIds.other = (
      await api('POST', '/staff', token('personnel'), {
        org_unit_id: unitA,
        code: `NV-${randomInt(100_000, 999_999)}`,
        full_name: 'Lê Văn Hùng',
        start_date: `${currentYear - 1}-01-01`,
      })
    ).body.id as string;
    await schoolYear
      .updateTable('staff')
      .set({ user_id: users.teacher?.userId ?? null })
      .where('id', '=', staffIds.teacher)
      .execute();
    for (const [code, name, attributes] of [
      ['PHEP', 'Nghỉ phép năm', { is_paid: true, deducts_annual_leave: true, insurance_paid: false }],
      ['KL', 'Nghỉ không lương', { is_paid: false, deducts_annual_leave: false, insurance_paid: false }],
      [
        'BHXH',
        'Nghỉ hưởng chế độ bảo hiểm xã hội',
        { is_paid: false, deducts_annual_leave: false, insurance_paid: true },
      ],
    ] as const) {
      const created = await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'leave_type',
        code,
        name,
        attributes,
      });
      leaveTypes[code] = created.body.id as string;
    }
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unitA,
      values: { work_start_time: '07:30', work_end_time: '17:00', lunch_break_minutes: 60 },
    });
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P08-11 Quy định phép năm', () => {
    it('CTC-P08-054: giáo viên thâm niên từ 5 năm được 13 ngày; khoảng thâm niên trùng bị chặn', async () => {
      const created = await api('POST', '/leave-policies', token('rootPersonnel'), {
        job_title_id: jobTitleId,
        seniority_from_years: 5,
        seniority_to_years: null,
        entitled_days: 13,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.entitled_days, 13);
      const overlapping = await api('POST', '/leave-policies', token('rootPersonnel'), {
        job_title_id: jobTitleId,
        seniority_from_years: 3,
        seniority_to_years: 10,
        entitled_days: 12,
      });
      assert.equal(overlapping.status, 422);
      const below = await api('POST', '/leave-policies', token('rootPersonnel'), {
        job_title_id: jobTitleId,
        seniority_from_years: 0,
        seniority_to_years: 5,
        entitled_days: 12,
      });
      assert.equal(below.status, 201);
      const mine = await api('GET', '/me/leave-requests', token('teacher'));
      assert.equal(mine.status, 200, JSON.stringify(mine.body));
      assert.deepEqual(
        { ...(mine.body.balance as Record<string, unknown>) },
        {
          year: currentYear,
          granted: false,
          policy_missing: false,
          entitled_days: 13,
          used_days: 0,
          remaining_days: 13,
          adjust_reason: null,
        },
      );
    });

    it('CTC-P08-056: giáo viên và phòng nhân sự của điểm trường lập quy định bị từ chối', async () => {
      const body = { job_title_id: jobTitleId, seniority_from_years: 20, entitled_days: 15 };
      assert.equal((await api('POST', '/leave-policies', token('teacher'), body)).status, 403);
      assert.equal((await api('POST', '/leave-policies', token('personnel'), body)).status, 403);
    });
  });

  describe('P08-03 Đơn xin nghỉ phép', () => {
    let approvedId = '';

    it('CTC-P08-009, CTC-P08-010: giáo viên gửi đơn phép năm 2 ngày; Phó Hiệu trưởng duyệt thì còn 11 ngày', async () => {
      const sent = await requestLeave(token('teacher'), {
        leave_type_id: leaveTypes.PHEP,
        from_date: nextWorkdays[0],
        to_date: nextWorkdays[1],
        first_day_half: null,
        last_day_half: null,
      });
      assert.equal(sent.status, 201, JSON.stringify(sent.body));
      assert.equal(sent.body.status, 'pending');
      assert.equal(sent.body.days, 2);
      approvedId = sent.body.id as string;
      const recipients = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select(['notification_recipients.role_code', 'notification_recipients.org_unit_id'])
        .where('notifications.target_id', '=', approvedId)
        .execute();
      assert.ok(recipients.some((row) => row.role_code === 'VT-15' && row.org_unit_id === units['ĐT-A1']));

      const approved = await api('POST', `/leave-requests/${approvedId}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 201, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'approved');
      const mine = await api('GET', '/me/leave-requests', token('teacher'));
      assert.equal((mine.body.balance as { remaining_days: number }).remaining_days, 11);
      assert.equal((mine.body.balance as { granted: boolean }).granted, true);
    });

    it('CTC-P08-012: đơn mới trùng ngày với đơn đã duyệt bị chặn', async () => {
      const overlapping = await requestLeave(token('teacher'), {
        leave_type_id: leaveTypes.KL,
        from_date: nextWorkdays[1],
        to_date: nextWorkdays[2],
      });
      assert.equal(overlapping.status, 422);
    });

    it('CTC-P08-014, CTC-P08-015: Phó Hiệu trưởng đơn vị khác và kế toán duyệt bị từ chối; nửa ngày tính 0,5', async () => {
      const sent = await requestLeave(token('teacher'), {
        leave_type_id: leaveTypes.PHEP,
        from_date: nextWorkdays[3],
        to_date: nextWorkdays[3],
        first_day_half: 'morning',
      });
      assert.equal(sent.status, 201, JSON.stringify(sent.body));
      assert.equal(sent.body.days, 0.5);
      const id = sent.body.id as string;
      assert.equal((await api('POST', `/leave-requests/${id}/approve`, token('otherVicePrincipal'))).status, 403);
      assert.equal((await api('POST', `/leave-requests/${id}/approve`, token('accountant'))).status, 403);
      assert.equal((await api('POST', `/leave-requests/${id}/approve`, token('manager'))).status, 403);
      const cancelled = await api('POST', `/leave-requests/${id}/cancel`, token('teacher'));
      assert.equal(cancelled.body.status, 'cancelled');
      assert.equal((await api('POST', `/leave-requests/${id}/cancel`, token('teacher'))).status, 422);
    });

    it('CTC-P08-011: phòng nhân sự chỉnh còn nửa ngày phép thì đơn 1 ngày phép năm bị chặn, đề nghị nghỉ không lương', async () => {
      const below = await api('PUT', '/leave-balances', token('personnel'), {
        staff_id: staffIds.teacher,
        year: currentYear,
        entitled_days: 1,
        reason: 'Sai',
      });
      assert.equal(below.status, 422);
      const adjusted = await api('PUT', '/leave-balances', token('personnel'), {
        staff_id: staffIds.teacher,
        year: currentYear,
        entitled_days: 2.5,
        reason: 'Đã nghỉ phép ở nơi làm cũ',
      });
      assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
      assert.equal(adjusted.body.remaining_days, 0.5);
      const blocked = await requestLeave(token('teacher'), {
        leave_type_id: leaveTypes.PHEP,
        from_date: nextWorkdays[3],
        to_date: nextWorkdays[3],
      });
      assert.equal(blocked.status, 422);
      assert.match((blocked.body.error as { message: string }).message, /không lương/);
      const balances = await api(
        'GET',
        `/leave-balances?org_unit_id=${units['ĐT-A1']}&year=${currentYear}`,
        token('vicePrincipal'),
      );
      assert.equal(balances.status, 200);
      assert.equal(
        (await api('GET', `/leave-balances?org_unit_id=${units['ĐT-A1']}&year=${currentYear}`, token('teacher')))
          .status,
        403,
      );
    });

    it('CTC-P08-013: nhân sự chưa có quy định phép năm phù hợp thì đơn phép năm bị chặn; phòng nhân sự lập hộ', async () => {
      const blocked = await requestLeave(token('personnel'), {
        staff_id: staffIds.other,
        leave_type_id: leaveTypes.PHEP,
        from_date: nextWorkdays[0],
        to_date: nextWorkdays[0],
      });
      assert.equal(blocked.status, 422);
      assert.match((blocked.body.error as { message: string }).message, /Chưa có quy định phép năm/);
      const onBehalf = await requestLeave(token('personnel'), {
        staff_id: staffIds.other,
        leave_type_id: leaveTypes.KL,
        from_date: nextWorkdays[0],
        to_date: nextWorkdays[0],
      });
      assert.equal(onBehalf.status, 201);
      assert.equal(
        (
          await requestLeave(token('teacher'), {
            staff_id: staffIds.other,
            leave_type_id: leaveTypes.KL,
            from_date: nextWorkdays[1],
            to_date: nextWorkdays[1],
          })
        ).status,
        403,
      );
      await api('POST', `/leave-requests/${onBehalf.body.id}/cancel`, token('personnel'));
    });
  });

  describe('P08-04 Chốt bảng công', () => {
    const [overtimeDay, normalDay, rejectedDay, unpaidDay, insuranceDay, holidayDay, dayOffDay] = previousWeekdays as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const makeupSaturday = previousSaturdays[0] ?? '';
    const restSaturday = previousSaturdays[1] ?? '';
    let rejectedId = '';

    before(async () => {
      await schoolYear
        .insertInto('holidays')
        .values({ holiday_date: holidayDay, name: 'Ngày lễ trong tháng', is_paid: true })
        .execute();
      await schoolYear
        .insertInto('school_day_changes')
        .values([
          { change_date: dayOffDay, change_type: 'compensatory_day_off' },
          { change_date: makeupSaturday, change_type: 'makeup_school_day' },
        ])
        .execute();
      for (const [date, checkOut] of [
        [overtimeDay, '18:30'],
        [normalDay, '16:00'],
      ] as const) {
        const saved = await api('PUT', '/attendance-logs', token('personnel'), {
          staff_id: staffIds.teacher,
          work_date: date,
          check_in: '07:30',
          check_out: checkOut,
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
      }
      for (const [code, date] of [
        ['KL', unpaidDay],
        ['BHXH', insuranceDay],
      ] as const) {
        const sent = await requestLeave(token('personnel'), {
          staff_id: staffIds.teacher,
          leave_type_id: leaveTypes[code],
          from_date: date,
          to_date: date,
        });
        assert.equal(sent.status, 201, JSON.stringify(sent.body));
        await api('POST', `/leave-requests/${sent.body.id}/approve`, token('vicePrincipal'));
      }
      rejectedId = (
        await requestLeave(token('teacher'), {
          leave_type_id: leaveTypes.KL,
          from_date: rejectedDay,
          to_date: rejectedDay,
        })
      ).body.id as string;
    });

    const lock = (accessToken: string, month = previousMonth) =>
      api('POST', '/attendance-logs/lock', accessToken, { org_unit_id: units['ĐT-A1'], month });

    it('CTC-P08-017, CTC-P08-026: còn đơn chờ duyệt thì chặn và liệt kê; kế toán chốt bị từ chối; tháng chưa hết bị chặn', async () => {
      const blocked = await lock(token('personnel'));
      assert.equal(blocked.status, 422);
      const error = blocked.body.error as { details: Array<{ message: string }> };
      assert.match(error.details[0]?.message ?? '', /Nguyễn Thị Lan/);
      assert.equal((await lock(token('accountant'))).status, 403);
      assert.equal((await lock(token('personnel'), vietnamToday.slice(0, 7))).status, 422);
    });

    it('CTC-P08-016, CTC-P08-018 đến 021: chốt tháng; lễ, nghỉ bù, học bù, đơn bị từ chối, làm thêm giờ ghi đúng', async () => {
      const rejected = await api('POST', `/leave-requests/${rejectedId}/reject`, token('vicePrincipal'), {
        reason: 'Trùng lịch dự giờ',
      });
      assert.equal(rejected.body.status, 'rejected');
      const closed = await lock(token('personnel'));
      assert.equal(closed.status, 201, JSON.stringify(closed.body));
      assert.equal(closed.body.status, 'closed');
      const days = new Map(
        (
          await schoolYear
            .selectFrom('timesheet_days')
            .selectAll()
            .where('staff_id', '=', staffIds.teacher ?? '')
            .execute()
        ).map((row) => [row.work_date, row]),
      );
      assert.equal(days.get(overtimeDay)?.status, 'present');
      assert.equal(days.get(overtimeDay)?.overtime_minutes, 60);
      assert.equal(days.get(normalDay)?.overtime_minutes, 0);
      assert.equal(days.get(normalDay)?.early_leave_minutes, 60);
      assert.equal(days.get(rejectedDay)?.status, 'absent');
      assert.equal(Number(days.get(rejectedDay)?.unpaid_days), 1);
      assert.equal(days.get(unpaidDay)?.status, 'leave');
      assert.equal(Number(days.get(unpaidDay)?.unpaid_days), 1);
      assert.equal(Number(days.get(insuranceDay)?.insurance_days), 1);
      assert.equal(days.get(holidayDay)?.status, 'holiday');
      assert.equal(Number(days.get(holidayDay)?.unpaid_days), 0);
      assert.equal(days.get(dayOffDay)?.status, 'day_off');
      assert.equal(days.get(makeupSaturday)?.status, 'absent');
      assert.equal(days.has(restSaturday), false);
      const recipients = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.role_code')
        .where('notifications.template_code', '=', 'timesheet_closed')
        .execute();
      assert.deepEqual(recipients.map((row) => row.role_code).sort(), ['VT-03', 'VT-04']);
      const period = await api(
        'GET',
        `/timesheet-periods?org_unit_id=${units['ĐT-A1']}&month=${previousMonth}`,
        token('manager'),
      );
      assert.equal(period.body.status, 'closed');
      const summary = (period.body.summary as Array<{ staff_id: string; overtime_minutes: number }>).find(
        (row) => row.staff_id === staffIds.teacher,
      );
      assert.equal(summary?.overtime_minutes, 60);
    });

    it('CTC-P08-022: kỳ đã chốt thì sửa chấm công và gửi đơn nghỉ trong tháng đó bị chặn', async () => {
      const edit = await api('PUT', '/attendance-logs', token('personnel'), {
        staff_id: staffIds.teacher,
        work_date: normalDay,
        check_in: '07:30',
        check_out: '17:00',
      });
      assert.equal(edit.status, 422);
      assert.match((edit.body.error as { message: string }).message, /mở lại/);
      const leave = await requestLeave(token('teacher'), {
        leave_type_id: leaveTypes.KL,
        from_date: previousWeekdays[8],
        to_date: previousWeekdays[8],
      });
      assert.equal(leave.status, 422);
    });

    it('CTC-P08-023 đến 025: đề nghị mở lại; quản lý và nhân sự không duyệt được; từ chối giữ đã chốt; duyệt thì sửa và chốt lại', async () => {
      const reopen = (reason: string) =>
        api('POST', '/attendance-logs/reopen-requests', token('personnel'), {
          org_unit_id: units['ĐT-A1'],
          month: previousMonth,
          reason,
        });
      const first = await reopen('Nhập sai giờ ra');
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal((await reopen('Lần hai')).status, 422);
      for (const name of ['manager', 'personnel']) {
        assert.equal(
          (await api('POST', `/attendance-logs/reopen-requests/${first.body.id}/approve`, token(name))).status,
          403,
        );
      }
      const pending = await api('GET', '/attendance-logs/reopen-requests', token('vicePrincipal'));
      assert.ok((pending.body as unknown as Array<{ id: string }>).some((row) => row.id === first.body.id));
      const rejected = await api(
        'POST',
        `/attendance-logs/reopen-requests/${first.body.id}/reject`,
        token('vicePrincipal'),
        {
          reason: 'Chưa đủ căn cứ',
        },
      );
      assert.equal(rejected.body.status, 'closed');

      const second = await reopen('Nhập sai giờ ra, có xác nhận của tổ trưởng');
      const approved = await api(
        'POST',
        `/attendance-logs/reopen-requests/${second.body.id}/approve`,
        token('vicePrincipal'),
      );
      assert.equal(approved.status, 201, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'reopened');
      const edit = await api('PUT', '/attendance-logs', token('personnel'), {
        staff_id: staffIds.teacher,
        work_date: normalDay,
        check_in: '07:30',
        check_out: '17:00',
      });
      assert.equal(edit.status, 200);
      const closedAgain = await lock(token('personnel'));
      assert.equal(closedAgain.body.status, 'closed');
      const day = await schoolYear
        .selectFrom('timesheet_days')
        .select('early_leave_minutes')
        .where('staff_id', '=', staffIds.teacher ?? '')
        .where('work_date', '=', normalDay)
        .executeTakeFirstOrThrow();
      assert.equal(day.early_leave_minutes, 0);
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select('after_data')
        .where('entity_name', '=', 'timesheet_reopen_requests')
        .execute();
      assert.ok(audit.some((row) => JSON.stringify(row.after_data).includes('Chưa đủ căn cứ')));
    });
  });
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  absenceCode,
  addDays,
  buildReport,
  classifyDay,
  isIllnessReason,
  periodRange,
  type CalendarInput,
} from './attendance-meals-calc.js';
import { classSheetName } from './attendance-meals-workbook.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng (DT-13 phần 13c, YCTD-100): loại ngày, mã vắng, số liệu và tỷ lệ,
// phạm vi xem, suất ăn của bếp và tệp Excel theo mẫu. Dữ liệu kiểm thử là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const dow = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

describe('Loại ngày và mã vắng của báo cáo điểm danh', () => {
  const calendar: CalendarInput = {
    schoolDaysOfWeek: [1, 2, 3, 4, 5],
    terms: [
      { start_date: '2026-09-01', end_date: '2026-12-31', term_type: 'first_term' },
      { start_date: '2027-06-01', end_date: '2027-07-31', term_type: 'summer_term' },
    ],
    offWeeks: [{ start_date: '2026-12-21', end_date: '2026-12-27' }],
    holidays: [
      { holiday_date: '2026-09-02', name: 'Quốc khánh' },
      { holiday_date: '2026-09-06', name: 'Lễ rơi vào chủ nhật' },
    ],
    changes: [
      { change_date: '2026-09-12', change_type: 'makeup_school_day' },
      { change_date: '2026-09-03', change_type: 'compensatory_day_off' },
    ],
  };
  const code = (date: string) => classifyDay(date, calendar, '2026-12-31').code;

  it('CT-13c-1: phân loại NH, HB, T7, CN, NL, NB, NK theo lịch năm học', () => {
    assert.equal(code('2026-09-01'), 'NH');
    assert.equal(code('2026-09-02'), 'NL');
    assert.equal(code('2026-09-03'), 'NB');
    assert.equal(code('2026-09-05'), 'T7');
    assert.equal(code('2026-09-06'), 'CN', 'Chủ nhật đứng trước ngày lễ như công thức của mẫu');
    assert.equal(code('2026-09-12'), 'HB', 'Thứ bảy học bù là ngày ăn');
    assert.equal(code('2026-12-22'), 'NK', 'Tuần nghỉ của lịch năm học');
    assert.equal(code('2027-01-04'), 'NK', 'Ngoài học kỳ');
    const summer = classifyDay('2027-06-01', calendar, '2027-06-01');
    assert.equal(summer.code, 'NH');
    assert.equal(summer.summer, true);
    assert.equal(classifyDay('2026-09-12', calendar, '2026-09-30').counted, 1);
    assert.equal(classifyDay('2026-09-02', calendar, '2026-09-30').counted, 0);
    assert.equal(classifyDay('2026-10-01', calendar, '2026-09-30').passed, false);
  });

  it('CT-13c-2: kỳ ngày, tuần (thứ hai đến chủ nhật), tháng', () => {
    assert.deepEqual(periodRange('day', '2026-09-09'), { from: '2026-09-09', to: '2026-09-09' });
    assert.deepEqual(periodRange('week', '2026-09-09'), { from: '2026-09-07', to: '2026-09-13' });
    assert.deepEqual(periodRange('week', '2026-09-13'), { from: '2026-09-07', to: '2026-09-13' });
    assert.deepEqual(periodRange('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(periodRange('month', '2026-12-31'), { from: '2026-12-01', to: '2026-12-31' });
  });

  it('CT-13c-3: mã vắng P, K, B suy từ trạng thái điểm danh và lý do', () => {
    assert.equal(absenceCode('present', null, null), null);
    assert.equal(absenceCode('late', 'Bé ho nhẹ', null), null, 'Có mặt dù ghi chú có từ khóa bệnh');
    assert.equal(absenceCode('absent_notified', null, { reason: 'Việc gia đình', is_advised: true }), 'P');
    assert.equal(absenceCode('absent_notified', null, { reason: 'Bé bị sốt', is_advised: true }), 'B');
    assert.equal(absenceCode('absent_unnotified', null, null), 'K');
    assert.equal(absenceCode('absent_unnotified', 'Phụ huynh báo bé ốm', null), 'B');
    assert.equal(absenceCode(null, null, { reason: 'Về quê', is_advised: true }), 'P');
    assert.equal(absenceCode(null, null, { reason: 'Về quê', is_advised: false }), 'K');
    assert.equal(absenceCode(null, null, null), null);
    assert.equal(isIllnessReason('Bé bị tiêu chảy'), true);
    assert.equal(isIllnessReason('Cho bé đi chơi'), false, 'Không nhầm "ho" trong "cho"');
    assert.equal(isIllnessReason('Bé bị TAY CHÂN MIỆNG'), true);
  });

  it('CT-13c-4: số liệu từng lớp, nhóm khối và tỷ lệ từ dữ liệu giả', () => {
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-12', '2026-09-13'].map((date) =>
      classifyDay(date, { ...calendar, holidays: [{ holiday_date: '2026-09-09', name: 'Nghỉ lễ thử' }] }, '2026-09-30'),
    );
    const enrolment = (classId: string, fromDate = '2026-09-01', toDate: string | null = null) => [
      { class_id: classId, from_date: fromDate, to_date: toDate },
    ];
    const report = buildReport({
      days,
      classes: [
        { id: 'lop-mam', name: 'Mầm 1', org_unit_id: 'u', grade_level: 'MAM', status: 'active' },
        { id: 'lop-nt', name: 'Nhà trẻ 1', org_unit_id: 'u', grade_level: 'NT', status: 'active' },
        { id: 'lop-la', name: 'Lá 1', org_unit_id: 'u', grade_level: 'LA', status: 'active' },
      ],
      gradeLevels: [
        { code: 'NT', name: 'Nhà trẻ', age_from_months: 18, order_no: 1 },
        { code: 'MAM', name: 'Mầm', age_from_months: 36, order_no: 2 },
        { code: 'LA', name: 'Khối Lá', age_from_months: 60, order_no: 4 },
      ],
      children: [
        { child_id: 'a', full_name: 'Trẻ A', status: 'active', enrollments: enrolment('lop-mam') },
        { child_id: 'b', full_name: 'Trẻ B', status: 'active', enrollments: enrolment('lop-mam') },
        // Vào lớp từ ngày 08/09: ngày 07/09 không tính (N)
        { child_id: 'c', full_name: 'Trẻ C', status: 'active', enrollments: enrolment('lop-mam', '2026-09-08') },
        { child_id: 'd', full_name: 'Trẻ D', status: 'active', enrollments: enrolment('lop-nt') },
        { child_id: 'e', full_name: 'Trẻ E', status: 'active', enrollments: enrolment('lop-la') },
      ],
      attendance: [
        { child_id: 'a', class_id: 'lop-mam', attendance_date: '2026-09-07', status: 'present', note: null },
        { child_id: 'b', class_id: 'lop-mam', attendance_date: '2026-09-07', status: 'absent_notified', note: 'sốt' },
        { child_id: 'a', class_id: 'lop-mam', attendance_date: '2026-09-08', status: 'late', note: null },
        { child_id: 'b', class_id: 'lop-mam', attendance_date: '2026-09-08', status: 'absent_unnotified', note: null },
        { child_id: 'c', class_id: 'lop-mam', attendance_date: '2026-09-08', status: 'present', note: null },
        { child_id: 'a', class_id: 'lop-mam', attendance_date: '2026-09-12', status: 'present', note: null },
        { child_id: 'b', class_id: 'lop-mam', attendance_date: '2026-09-12', status: 'present', note: null },
        { child_id: 'd', class_id: 'lop-nt', attendance_date: '2026-09-07', status: 'present', note: null },
      ],
      absences: [{ child_id: 'c', absence_date: '2026-09-12', reason: 'Về quê', is_advised: true }],
      summerChildren: new Map(),
    });
    assert.deepEqual(
      days.map((day) => day.code),
      ['NH', 'NH', 'NL', 'HB', 'CN'],
    );
    assert.deepEqual(
      report.classes.map((row) => row.class_name),
      ['Nhà trẻ 1', 'Mầm 1', 'Lá 1'],
      'Nhà trẻ trước, mẫu giáo theo thứ tự khối',
    );
    const mam = report.classes.find((row) => row.class_id === 'lop-mam');
    assert.ok(mam);
    // Ngày ăn đã qua: 07/09 (A, B), 08/09 (A, B, C), 12/09 (A, B, C) = 8 lượt phải có mặt; có mặt 5
    assert.equal(mam.expected, 8);
    assert.equal(mam.present, 5);
    assert.equal(mam.meal_count, 5);
    assert.equal(mam.absent, 3);
    assert.equal(mam.absent_b, 1);
    assert.equal(mam.absent_k, 1);
    assert.equal(mam.absent_p, 1);
    assert.equal(mam.rate_percent, 62.5);
    assert.equal(mam.enrolled, 3, 'Sĩ số ngày tham chiếu (ngày cuối kỳ đã qua)');
    const matrix = report.matrices.get('lop-mam') ?? [];
    const childC = matrix.find((row) => row.child_id === 'c');
    assert.equal(childC?.codes['2026-09-07'], 'N');
    assert.equal(childC?.codes['2026-09-12'], 'P');
    assert.equal(childC?.codes['2026-09-09'], 'N', 'Ngày lễ trong tuần là N');
    assert.equal(childC?.codes['2026-09-13'], 'off', 'Chủ nhật để trống');
    assert.equal(matrix.find((row) => row.child_id === 'b')?.codes['2026-09-07'], 'B');
    const la = report.classes.find((row) => row.class_id === 'lop-la');
    assert.equal(la?.unmarked, 3, 'Ngày đã qua chưa điểm danh là "?"');
    assert.equal(la?.present, 0);
    assert.deepEqual(
      report.groups.map((group) => group.label),
      ['Khối Nhà trẻ', 'Khối Mầm', 'Khối Lá', 'Khối Mẫu giáo'],
    );
    assert.equal(report.totals.label, 'Toàn trường');
    assert.equal(report.totals.present, 6);
    assert.equal(report.totals.expected, 8 + 3 + 3);
    const holiday = report.totals.days.find((day) => day.date === '2026-09-09');
    assert.equal(holiday?.expected, 0, 'Ngày lễ không tính');
    assert.equal(holiday?.enrolled, 5, 'Sĩ số ngày lễ vẫn là số trẻ thuộc lớp');
  });

  it('CT-13c-5: tên bảng tính của lớp hợp lệ và không trùng', () => {
    const used = new Set(['data', 'tổng hợp', 'tổng hợp tháng']);
    assert.equal(classSheetName('Mầm 1', used), 'Mầm 1');
    assert.equal(classSheetName('Mầm 1', used), 'Mầm 1 (2)');
    assert.equal(classSheetName('Lớp A/B: [chiều]', used), 'Lớp A B   chiều');
    assert.equal(classSheetName('Data', used), 'Data (2)');
    assert.ok(classSheetName('Một tên lớp rất dài vượt quá ba mươi mốt ký tự', used).length <= 31);
  });
});

describe('Báo cáo điểm danh và suất ăn qua máy chủ', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  // Tháng trước: đã qua trọn tháng nên số liệu không phụ thuộc giờ chạy kiểm thử
  const previousMonthFirst = (() => {
    const first = `${vietnamToday.slice(0, 7)}-01`;
    return `${addDays(first, -1).slice(0, 7)}-01`;
  })();
  const firstMonday = (() => {
    let date = previousMonthFirst;
    while (dow(date) !== 1) {
      date = addDays(date, 1);
    }
    return date;
  })();
  const dayOne = firstMonday;
  const dayTwo = addDays(firstMonday, 1);
  const holiday = addDays(firstMonday, 2);
  const dayOff = addDays(firstMonday, 3);
  const makeup = addDays(firstMonday, 5);

  const token = (name: string) => users[name]?.accessToken ?? '';
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);
  const exportReport = async (accessToken: string, body: unknown) => {
    const response = await fetch(`${environment.baseUrl}/reports/attendance-meals/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
  };

  const addChild = async (name: string, orgUnitId: string, classId: string) => {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: orgUnitId,
        full_name: name,
        dob: '2022-03-15',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '0000',
        photo_consent: 'pending',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -100) })
      .execute();
    return child.id;
  };

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
    const academicYear = await environment.system.selectFrom('academic_years').select('id').executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, name, type] of [
      ['TC', 'Trường Mầm non Thử nghiệm', 'truong_chinh'],
      ['ĐT-A1', 'Điểm trường A1', 'diem_truong'],
      ['ĐT-B1', 'Điểm trường B1', 'diem_truong'],
    ] as const) {
      units[code] = (
        await sendJson('POST', `${environment.baseUrl}/org-units`, principal.accessToken, {
          code,
          name,
          unit_type: type,
        })
      ).body.id as string;
    }
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);
    users.kitchen = await environment.loginAs('VT-10', units['ĐT-A1'] ?? null);
    await schoolYear
      .insertInto('grade_levels')
      .values([
        { code: 'NT', name: 'Nhà trẻ', age_from_months: 18, age_to_months: 36, order_no: 1 },
        { code: 'MAM', name: 'Mầm', age_from_months: 36, age_to_months: 48, order_no: 2 },
        { code: 'CHOI', name: 'Chồi', age_from_months: 48, age_to_months: 60, order_no: 3 },
      ])
      .execute();
    for (const [code, unit, grade] of [
      ['MAM1', 'ĐT-A1', 'MAM'],
      ['NT1', 'ĐT-A1', 'NT'],
      ['CHOI1', 'ĐT-B1', 'CHOI'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYear.id,
            code,
            name: code,
            grade_level: grade,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes.MAM1 ?? '',
        staff_user_id: users.teacher?.userId ?? '',
        staff_name: 'Giáo viên thử',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -100),
      })
      .execute();
    children.an = await addChild('Trẻ thử An', units['ĐT-A1'] ?? '', classes.MAM1 ?? '');
    children.chi = await addChild('Trẻ thử Chi', units['ĐT-A1'] ?? '', classes.MAM1 ?? '');
    children.em = await addChild('Trẻ thử Em', units['ĐT-A1'] ?? '', classes.NT1 ?? '');
    children.dung = await addChild('Trẻ thử Dũng', units['ĐT-B1'] ?? '', classes.CHOI1 ?? '');
    await schoolYear
      .insertInto('holidays')
      .values({ holiday_date: holiday, name: 'Ngày lễ thử', is_paid: true })
      .execute();
    await schoolYear
      .insertInto('school_day_changes')
      .values([
        { change_date: makeup, change_type: 'makeup_school_day', note: 'Học bù thử' },
        { change_date: dayOff, change_type: 'compensatory_day_off', note: 'Nghỉ bù thử' },
      ])
      .execute();
    const record = (
      childId: string,
      classId: string,
      unit: string,
      date: string,
      status: 'present' | 'late' | 'absent_notified' | 'absent_unnotified',
      note: string | null = null,
    ) => ({
      child_id: childId,
      class_id: classId,
      org_unit_id: units[unit] ?? '',
      attendance_date: date,
      status,
      note,
      source: 'teacher' as const,
      recorded_by: users.teacher?.userId ?? '',
      recorded_at: new Date(),
    });
    await schoolYear
      .insertInto('attendance_records')
      .values([
        record(children.an, classes.MAM1 ?? '', 'ĐT-A1', dayOne, 'present'),
        record(children.chi, classes.MAM1 ?? '', 'ĐT-A1', dayOne, 'absent_notified', 'Bé bị sốt'),
        record(children.em, classes.NT1 ?? '', 'ĐT-A1', dayOne, 'absent_unnotified'),
        record(children.an, classes.MAM1 ?? '', 'ĐT-A1', dayTwo, 'late'),
        record(children.chi, classes.MAM1 ?? '', 'ĐT-A1', dayTwo, 'absent_notified', 'Việc gia đình'),
        record(children.an, classes.MAM1 ?? '', 'ĐT-A1', makeup, 'present'),
        record(children.chi, classes.MAM1 ?? '', 'ĐT-A1', makeup, 'present'),
        record(children.dung, classes.CHOI1 ?? '', 'ĐT-B1', dayOne, 'present'),
      ])
      .execute();
    await schoolYear
      .insertInto('absence_records')
      .values({
        child_id: children.em,
        org_unit_id: units['ĐT-A1'] ?? '',
        absence_date: dayTwo,
        reason: 'Về quê',
        is_advised: true,
        advised_at: new Date(),
        source: 'parent',
        reported_by: users.teacher?.userId ?? '',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-13c-6: báo cáo tháng của toàn trường: loại ngày, số có mặt, vắng P, K, B, suất ăn và tỷ lệ', async () => {
    const response = await get(`/reports/attendance-meals?period=month&date=${dayOne}`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const days = response.body.days as Array<{ date: string; code: string; counted: number }>;
    assert.equal(days.find((day) => day.date === holiday)?.code, 'NL');
    assert.equal(days.find((day) => day.date === dayOff)?.code, 'NB');
    assert.equal(days.find((day) => day.date === makeup)?.code, 'HB');
    assert.equal(days.find((day) => day.date === addDays(makeup, 1))?.code, 'CN');
    const mealDays = days.filter((day) => day.counted === 1).length;
    assert.equal(response.body.meal_day_count, mealDays);
    assert.equal(response.body.children, undefined, 'Màn hình tổng hợp không trả mã từng trẻ');
    const rows = response.body.classes as Array<
      Record<string, unknown> & { days: Array<{ date: string; present: number; meal_count: number }> }
    >;
    assert.deepEqual(
      rows.map((row) => row.class_name),
      ['NT1', 'MAM1', 'CHOI1'],
    );
    const mam = rows.find((row) => row.class_name === 'MAM1');
    assert.ok(mam);
    assert.equal(mam.present, 4);
    assert.equal(mam.meal_count, 4);
    assert.equal(mam.absent_b, 1);
    assert.equal(mam.absent_p, 1);
    assert.equal(mam.expected, 2 * mealDays);
    assert.equal(mam.absent, 2 * mealDays - 4);
    assert.equal(mam.unmarked, 2 * mealDays - 6);
    assert.equal(mam.rate_percent, Math.round((4 * 10_000) / (2 * mealDays)) / 100);
    assert.equal(mam.days.find((day) => day.date === makeup)?.present, 2);
    const nt = rows.find((row) => row.class_name === 'NT1');
    assert.equal(nt?.absent_k, 1);
    assert.equal(nt?.absent_p, 1, 'Báo vắng trước giờ học mà chưa điểm danh là P');
    const totals = response.body.totals as Record<string, number>;
    assert.equal(totals.present, 5);
    assert.deepEqual(
      (response.body.groups as Array<{ label: string }>).map((group) => group.label),
      ['Khối Nhà trẻ', 'Khối Mầm', 'Khối Chồi', 'Khối Mẫu giáo'],
    );
  });

  it('CT-13c-7: báo cáo ngày, tuần và bảng từng trẻ của lớp', async () => {
    const week = await get(`/reports/attendance-meals?period=week&date=${dayTwo}`, principal.accessToken);
    assert.equal(week.status, 200);
    assert.equal(week.body.from, dayOne);
    assert.equal((week.body.days as unknown[]).length, 7);
    const day = await get(`/reports/attendance-meals?period=day&date=${dayOne}`, principal.accessToken);
    assert.equal((day.body.totals as Record<string, number>).present, 2);
    const matrix = await get(
      `/reports/attendance-meals/children?period=week&date=${dayOne}&class_id=${classes.MAM1}`,
      principal.accessToken,
    );
    assert.equal(matrix.status, 200);
    const rows = matrix.body.children as Array<{ full_name: string; codes: Record<string, string> }>;
    const chi = rows.find((row) => row.full_name === 'Trẻ thử Chi');
    assert.equal(chi?.codes[dayOne], 'B');
    assert.equal(chi?.codes[dayTwo], 'P');
    assert.equal(chi?.codes[holiday], 'N');
    assert.equal(chi?.codes[makeup], '');
    const invalid = await get(`/reports/attendance-meals?period=year&date=2026-13-01`, principal.accessToken);
    assert.equal(invalid.status, 400);
  });

  it('CT-13c-8: quản lý đơn vị chỉ xem đơn vị mình; giáo viên chỉ xem lớp được phân công', async () => {
    const own = await get(`/reports/attendance-meals?period=month&date=${dayOne}`, token('manager'));
    assert.equal(own.status, 200);
    assert.deepEqual((own.body.classes as Array<{ class_name: string }>).map((row) => row.class_name).sort(), [
      'MAM1',
      'NT1',
    ]);
    const otherUnit = await get(
      `/reports/attendance-meals?period=month&date=${dayOne}&org_unit_id=${units['ĐT-B1']}`,
      token('manager'),
    );
    assert.equal(otherUnit.status, 403);
    const otherClass = await get(
      `/reports/attendance-meals?period=month&date=${dayOne}&class_id=${classes.CHOI1}`,
      token('manager'),
    );
    assert.equal(otherClass.status, 403);
    const teacher = await get(`/reports/attendance-meals?period=month&date=${dayOne}`, token('teacher'));
    assert.equal(teacher.status, 200);
    assert.deepEqual(
      (teacher.body.classes as Array<{ class_name: string }>).map((row) => row.class_name),
      ['MAM1'],
    );
    const teacherOther = await get(
      `/reports/attendance-meals?period=month&date=${dayOne}&class_id=${classes.NT1}`,
      token('teacher'),
    );
    assert.equal(teacherOther.status, 403);
    const kitchen = await get(`/reports/attendance-meals?period=month&date=${dayOne}`, token('kitchen'));
    assert.equal(kitchen.status, 403);
  });

  it('CT-13c-9: bếp xem suất ăn theo ngày, tuần của đơn vị mình theo lớp và khối', async () => {
    const response = await get(
      `/kitchen/meal-counts?org_unit_id=${units['ĐT-A1']}&period=week&date=${dayOne}`,
      token('kitchen'),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const rows = response.body.classes as Array<{
      class_name: string;
      days: Array<{ date: string; present: number; meal_count: number }>;
    }>;
    const mam = rows.find((row) => row.class_name === 'MAM1');
    assert.equal(mam?.days.find((day) => day.date === makeup)?.meal_count, 2);
    assert.equal(mam?.days.find((day) => day.date === dayOne)?.meal_count, 1);
    const groups = response.body.groups as Array<{
      label: string;
      days: Array<{ date: string; present: number; meal_count: number }>;
    }>;
    assert.equal(
      groups.find((group) => group.label === 'Khối Mẫu giáo')?.days.find((day) => day.date === makeup)?.meal_count,
      2,
    );
    const other = await get(`/kitchen/meal-counts?org_unit_id=${units['ĐT-B1']}&date=${dayOne}`, token('kitchen'));
    assert.equal(other.status, 403);
    const month = await get(
      `/kitchen/meal-counts?org_unit_id=${units['ĐT-A1']}&period=month&date=${dayOne}`,
      token('kitchen'),
    );
    assert.equal(month.status, 400);
    const teacher = await get(`/kitchen/meal-counts?org_unit_id=${units['ĐT-A1']}&date=${dayOne}`, token('teacher'));
    assert.equal(teacher.status, 403);
  });

  it('CT-13c-10: xuất Excel tháng theo mẫu có nhật ký xuất', async () => {
    const response = await exportReport(principal.accessToken, { period: 'month', date: dayOne });
    assert.equal(response.status, 200, response.body.toString());
    const month = Number(dayOne.slice(5, 7));
    const year = dayOne.slice(0, 4);
    assert.match(
      response.headers.get('content-disposition') ?? '',
      new RegExp(`diem-danh-suat-an-thang-${dayOne.slice(0, 7)}\\.xlsx`),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as unknown as ArrayBuffer);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['Data', 'Tổng hợp', 'Tổng hợp tháng', 'NT1', 'MAM1', 'CHOI1'],
    );
    const data = workbook.getWorksheet('Data');
    assert.equal(data?.getCell('B1').value, month);
    assert.equal(data?.getCell('L7').value, 'NH');
    const overview = workbook.getWorksheet('Tổng hợp');
    assert.equal(overview?.getCell('A2').value, `BẢNG TỔNG HỢP ĐIỂM DANH THÁNG ${month}/${year}`);
    assert.equal(overview?.getCell('A8').value, 'Khối Nhà trẻ');
    const summary = workbook.getWorksheet('Tổng hợp tháng');
    assert.equal(summary?.getCell('A1').value, 'TRƯỜNG MẦM NON THỬ NGHIỆM');
    assert.equal(summary?.getCell('A3').value, `BẢNG TỔNG HỢP ĐIỂM DANH THÁNG ${month} NĂM ${year}`);
    assert.equal(summary?.getCell('A5').value, 'STT');
    assert.equal(summary?.getCell('B8').value, 'MAM1');
    assert.equal(summary?.getCell('C8').value, 2);
    assert.equal(summary?.getCell('D8').value, 4);
    assert.equal(summary?.getCell('A10').value, 'CỘNG');
    assert.equal(summary?.getCell('D10').value, 5);
    const classSheet = workbook.getWorksheet('MAM1');
    assert.equal(classSheet?.getCell('A2').value, 'LỚP: MAM1');
    assert.equal(classSheet?.getCell('D3').value, 'BẢNG ĐIỂM DANH BỆNH');
    assert.match(String(classSheet?.getCell('D4').value), new RegExp(`^Tháng ${month}-${year} \\(\\d+ ngày ăn\\)$`));
    assert.equal(classSheet?.getCell('B11').value, 'Trẻ thử Chi');
    const dayColumn = 3 + Number(dayOne.slice(8, 10));
    assert.equal(classSheet?.getCell(11, dayColumn).value, 'B');
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data', 'row_count'])
      .where('report_code', '=', 'attendance-meals')
      .execute();
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.contains_personal_data, true);
    assert.equal(logs[0]?.row_count, 3 + 4);
    const week = await exportReport(principal.accessToken, { period: 'week', date: dayOne });
    assert.equal(week.status, 200);
    const weekBook = new ExcelJS.Workbook();
    await weekBook.xlsx.load(week.body as unknown as ArrayBuffer);
    assert.ok(weekBook.getWorksheet('Tổng hợp tuần'));
    const manager = await exportReport(token('manager'), { period: 'month', date: dayOne });
    assert.equal(manager.status, 403, 'Quản lý đơn vị không có quyền xuất dữ liệu');
  });
});

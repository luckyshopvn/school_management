import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { gradesOverlap, menuForGrade, resolveMenuHeader } from '../kitchen/menu-header.js';
import { parseMealType, parseMenuRows, parseWeekday } from '../kitchen/menu-imports.js';
import { isMartyrFamily } from '../statistics/student-statistics-calc.js';
import { buildStartOfYearHealthReport } from './emis-health-calc.js';
import type { GrowthAssessment } from './growth-calc.js';
import { compareGrowth } from './growth-summary.js';
import { latestGrowthByChild, summarizeTermHealth, termOfDate } from './student-health-calc.js';

// Sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h): 4.6 thông tin sức khỏe theo học kỳ và
// "Lấy dữ liệu từ 4.3", 4.3.2 tổng hợp theo học kỳ và so sánh hai lần cân đo, 5.3 thống kê học sinh, số liệu báo cáo sức
// khỏe đầu năm (EMIS 1.3), 4.5 thực đơn theo Sở và nhập thực đơn từ Excel. Dữ liệu kiểm thử là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dobForMonths = (months: number) => addDays(vietnamToday, -Math.round(months * 30.4375));
const mondayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
};
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

interface HealthRow {
  child_id: string;
  full_name: string;
  weight_kg: number | null;
  height_cm: number | null;
  physical_education: string | null;
  can_swim: boolean | null;
  eye_conditions: string[];
  latest_growth: { round_name: string } | null;
}

describe('Hàm thuần của phần 16h', () => {
  it('CT-16h-1: học kỳ theo lịch năm học, số đo 4.3 gần nhất trong học kỳ, đếm biết bơi, bệnh về mắt', () => {
    const terms = [
      { term_type: 'first_term', start_date: '2026-09-05', end_date: '2027-01-15' },
      { term_type: 'second_term', start_date: '2027-01-20', end_date: '2027-05-31' },
    ];
    assert.equal(termOfDate('2026-10-01', terms), 'first_term');
    assert.equal(termOfDate('2027-01-17', terms), 'first_term');
    assert.equal(termOfDate('2027-03-01', terms), 'second_term');
    assert.equal(termOfDate('2026-11-01', []), 'first_term');
    assert.equal(termOfDate('2027-02-01', []), 'second_term');
    const point = (child: string, date: string, weight: number | null) => ({
      child_id: child,
      growth_round_id: date,
      round_name: date,
      measured_on: date,
      weight_kg: weight,
      height_cm: null,
    });
    const latest = latestGrowthByChild(
      [
        point('a', '2026-09-20', 12),
        point('a', '2026-12-01', 13),
        point('a', '2027-03-01', 14),
        point('b', '2026-10-01', null),
      ],
      terms,
      'first_term',
    );
    assert.equal(latest.get('a')?.weight_kg, 13);
    assert.equal(latest.has('b'), false);
    const summary = summarizeTermHealth([
      { gender: 'female', can_swim: true, eye_conditions: ['myopia', 'strabismus'], physical_education: 'passed' },
      { gender: 'male', can_swim: false, eye_conditions: ['myopia'], physical_education: 'not_passed' },
      { gender: 'female', can_swim: null, eye_conditions: [], physical_education: null },
    ]);
    assert.deepEqual(summary.swimming, { count: 1, female: 1 });
    assert.deepEqual(summary.eye_any, { count: 2, female: 1 });
    assert.equal(summary.eye_conditions.find((item) => item.value === 'myopia')?.count, 2);
    assert.equal(summary.eye_conditions.find((item) => item.value === 'strabismus')?.female, 1);
    assert.deepEqual(summary.physical_education_not_passed, { count: 1, female: 0 });
    assert.equal(isMartyrFamily('Con thương binh hạng 2/4'), true);
    assert.equal(isMartyrFamily('Con liệt sĩ'), true);
    assert.equal(isMartyrFamily('Con hộ nghèo'), false);
  });

  it('CT-16h-2: thông tin chung của thực đơn, trùng khối, đọc thứ và bữa của tệp nhập', () => {
    const resolved = resolveMenuHeader(
      {
        name: null,
        month: null,
        week_no: null,
        from_date: '2026-10-21',
        to_date: null,
        grade_levels: ['LA', 'MAM'],
        week_start_date: null,
        age_group: null,
      },
      () => 7,
    );
    assert.deepEqual(resolved.errors, []);
    assert.equal(resolved.header?.week_start_date, '2026-10-19');
    assert.equal(resolved.header?.to_date, '2026-10-25');
    assert.equal(resolved.header?.month, '2026-10');
    assert.equal(resolved.header?.week_no, 7);
    assert.equal(resolved.header?.age_group, 'LA,MAM');
    assert.equal(resolved.header?.name, 'Thực đơn tuần 19/10/2026');
    const outside = resolveMenuHeader(
      {
        name: null,
        month: null,
        week_no: null,
        from_date: '2026-10-21',
        to_date: '2026-10-27',
        grade_levels: [],
        week_start_date: null,
        age_group: null,
      },
      () => null,
    );
    assert.equal(outside.errors[0]?.field, 'to_date');
    const legacy = resolveMenuHeader(
      {
        name: null,
        month: null,
        week_no: null,
        from_date: null,
        to_date: null,
        grade_levels: null,
        week_start_date: '2026-10-20',
        age_group: 'all',
      },
      () => null,
    );
    assert.equal(legacy.errors[0]?.field, 'week_start_date');
    assert.equal(gradesOverlap([], []), true);
    assert.equal(gradesOverlap([], ['LA']), false);
    assert.equal(gradesOverlap(['LA', 'MAM'], ['MAM']), true);
    assert.equal(gradesOverlap(['LA'], ['MAM']), false);
    const menus = [
      { id: 'chung', grade_levels: [] },
      { id: 'la', grade_levels: ['LA', 'NHO'] },
    ];
    assert.equal(menuForGrade(menus, 'LA')?.id, 'la');
    assert.equal(menuForGrade(menus, 'MAM')?.id, 'chung');
    assert.equal(parseWeekday('Thứ 2'), 1);
    assert.equal(parseWeekday('7'), 6);
    assert.equal(parseWeekday('CN'), 7);
    assert.equal(parseWeekday('thu ba'), 2);
    assert.equal(parseWeekday('8'), null);
    assert.equal(parseMealType('Bữa trưa'), 'lunch');
    assert.equal(parseMealType('xế'), 'snack');
    assert.equal(parseMealType('tối'), null);
    const parsed = parseMenuRows(
      [
        {
          row: 2,
          values: { menu_name: 'T1', from_date: '2026-10-19', weekday: '2', meal_type: 'Bữa trưa', dish: 'Cơm' },
        },
        {
          row: 3,
          values: { menu_name: 'T1', from_date: '2026-10-19', weekday: '3', meal_type: 'Bữa sáng', dish: 'cháo' },
        },
        {
          row: 4,
          values: { menu_name: 'T1', from_date: '2026-10-19', weekday: '2', meal_type: 'Bữa trưa', dish: 'Cơm' },
        },
        { row: 5, values: { menu_name: 'T2', from_date: '2026-10-19', weekday: '9', meal_type: 'Bữa', dish: 'Phở' } },
      ].map((row) => ({
        row: row.row,
        values: { month: '', week_no: '', to_date: '', grade_levels: '', note: '', ...row.values },
      })),
      {
        dishes: [
          { id: 'com', name: 'Cơm' },
          { id: 'chao', name: 'Cháo' },
        ],
        grades: ['LA'],
        weekNo: () => null,
        existing: [],
      },
    );
    assert.equal(parsed.menus.length, 1);
    assert.equal(parsed.menus[0]?.items.length, 2);
    assert.deepEqual(
      parsed.errors.map((error) => [error.row, error.column]),
      [
        [4, 'Món ăn'],
        [5, 'Thứ'],
        [5, 'Bữa'],
        [5, 'Món ăn'],
      ],
    );
  });

  it('CT-16h-3: số liệu báo cáo sức khỏe đầu năm theo loại hình, nữ, dân tộc; so sánh hai lần cân đo', () => {
    const assessment = (weight: string | null, height: string | null) =>
      ({
        age_days: 1000,
        age_months: 33,
        bmi: null,
        weight_for_age_z: null,
        height_for_age_z: null,
        weight_for_height_z: null,
        bmi_for_age_z: null,
        weight_height_basis: null,
        weight_status: weight,
        height_status: height,
        weight_height_status: null,
      }) as unknown as GrowthAssessment;
    const report = buildStartOfYearHealthReport({
      ownership: 'private',
      children: [
        {
          gender: 'female',
          ethnicity: 'Hoa',
          disability: null,
          examined: true,
          assessment: assessment('underweight', 'stunted'),
          eye_conditions: ['myopia'],
        },
        {
          gender: 'male',
          ethnicity: 'Kinh',
          disability: 'Khuyết tật nghe',
          examined: false,
          assessment: null,
          eye_conditions: [],
        },
      ],
    });
    const row = (code: string) => report.rows.find((item) => item.code === code);
    assert.deepEqual(
      [
        row('1.3.01')?.total,
        row('1.3.01')?.private,
        row('1.3.01')?.public,
        row('1.3.01')?.female,
        row('1.3.01')?.ethnic_minority,
      ],
      [2, 2, 0, 1, 1],
    );
    assert.equal(row('1.3.02')?.total, 1);
    assert.equal(row('1.3.03')?.total, 1);
    assert.equal(row('1.3.04')?.ethnic_minority, 1);
    assert.equal(row('1.3.05')?.total, 1);
    assert.equal(row('1.3.09')?.total, 1);
    assert.equal(row('1.3.10')?.label, 'Trong đó: cận thị');
    assert.equal(row('1.3.17')?.total, 1);
    assert.deepEqual(report.warnings, []);
    const missing = buildStartOfYearHealthReport({ ownership: null, children: [] });
    assert.equal(missing.rows[0]?.public, null);
    assert.equal(missing.warnings.length, 1);

    const child = (classId: string, weight: string | null) => ({
      child_id: randomUUID(),
      full_name: 'X',
      dob: '2023-01-01',
      gender: 'female' as const,
      org_unit_id: 'u',
      org_unit_name: 'U',
      class_id: classId,
      class_name: classId,
      grade_level: 'MAM',
      grade_name: 'Mầm',
      grade_order: 1,
      measured_on: '2026-10-01',
      weight_kg: 10,
      height_cm: 80,
      assessment: { ...assessment(weight, 'normal'), weight_height_status: 'normal' as const },
    });
    const comparison = compareGrowth(
      [child('A', 'underweight'), child('A', 'underweight'), child('B', 'normal')],
      [child('A', 'underweight'), child('A', 'normal')],
      null,
    );
    const classA = comparison.classes.find((item) => item.class_id === 'A');
    assert.equal(classA?.first.underweight, 2);
    assert.equal(classA?.last.underweight, 1);
    assert.equal(classA?.change.underweight, -1);
    assert.equal(comparison.classes.find((item) => item.class_id === 'B')?.last.enrolled, 0);
    assert.equal(comparison.totals.change.enrolled, -1);
  });
});

describe('Sức khỏe, thực đơn, thống kê học sinh theo Sở (16h)', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const dishes: Record<string, string> = {};
  const firstTermStart = addDays(vietnamToday, -60);
  const secondTermStart = addDays(vietnamToday, 95);

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const download = async (path: string, accessToken: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  };
  const upload = async (path: string, accessToken: string, buffer: Buffer, fields: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', new Blob([new Uint8Array(buffer)]), 'thuc-don.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: firstTermStart, end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: secondTermStart, end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    const unitB = units['ĐT-B1'] ?? '';
    users.nurse = await environment.loginAs('VT-09', unitA);
    users.otherNurse = await environment.loginAs('VT-09', unitB);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);
    users.kitchen = await environment.loginAs('VT-10', unitA);
    users.vice = await environment.loginAs('VT-15', null);

    for (const [code, name, from, to, order] of [
      ['MAM', 'Mầm', 36, 47, 1],
      ['LA', 'Lá', 60, 71, 2],
    ] as const) {
      await schoolYear
        .insertInto('grade_levels')
        .values({ code, name, age_from_months: from, age_to_months: to, order_no: order })
        .execute();
    }
    for (const [code, grade] of [
      ['MAM-1', 'MAM'],
      ['LA-1', 'LA'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitA,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes['MAM-1'] ?? '',
        staff_user_id: users.homeroom?.userId ?? '',
        staff_name: 'Giáo viên chủ nhiệm',
        assignment_role: 'homeroom',
        subject_name: null,
        from_date: firstTermStart,
      })
      .execute();
    for (const [key, classCode, gender, months, profile] of [
      ['A', 'MAM-1', 'female', 40, { ethnicity: 'Kinh', can_swim: true }],
      ['B', 'MAM-1', 'male', 42, { ethnicity: 'Hoa', disability_type: 'Khuyết tật vận động' }],
      ['C', 'LA-1', 'female', 64, { ethnicity: 'Tày', policy_target: 'Con thương binh' }],
      ['D', 'LA-1', 'male', 66, { ethnicity: 'Kinh', policy_target: 'Con hộ nghèo' }],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Học sinh ${key}`,
          dob: dobForMonths(months),
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: firstTermStart,
          moet_profile: JSON.stringify(profile),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: firstTermStart })
        .execute();
    }
    for (const [key, name] of [
      ['rice', 'Cơm thịt kho'],
      ['porridge', 'Cháo thịt'],
    ] as const) {
      dishes[key] = (
        await schoolYear
          .insertInto('dishes')
          .values({ org_unit_id: unitA, name, group_name: 'Món chính', recipe_note: null, created_by: null })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16h-4: y tế nhập thông tin sức khỏe học kỳ; giáo viên chủ nhiệm xem; ngoài phạm vi, sai dữ liệu bị từ chối', async () => {
    const classId = classes['MAM-1'] ?? '';
    const saved = await api('PUT', '/student-health', token('nurse'), {
      class_id: classId,
      term: 'first_term',
      rows: [
        {
          child_id: children.A,
          weight_kg: '14,5',
          height_cm: 98,
          physical_education: 'passed',
          can_swim: true,
          eye_conditions: ['myopia', 'astigmatism'],
          note: 'Đeo kính',
        },
        {
          child_id: children.B,
          weight_kg: null,
          height_cm: null,
          physical_education: 'not_passed',
          can_swim: false,
          eye_conditions: [],
        },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.saved_count, 2);
    const grid = await api('GET', `/student-health?class_id=${classId}&term=first_term`, token('homeroom'));
    assert.equal(grid.status, 200, JSON.stringify(grid.body));
    assert.equal(grid.body.can_edit, false);
    const rowA = (grid.body.rows as HealthRow[]).find((row) => row.child_id === children.A);
    assert.equal(rowA?.weight_kg, 14.5);
    assert.deepEqual(rowA?.eye_conditions, ['myopia', 'astigmatism']);
    assert.equal(rowA?.physical_education, 'passed');
    const second = await api('GET', `/student-health?class_id=${classId}&term=second_term`, token('nurse'));
    assert.equal(
      (second.body.rows as HealthRow[]).every((row) => row.eye_conditions.length === 0),
      true,
    );
    // Dòng để trống mọi ô thì xóa thông tin của học sinh trong học kỳ
    const cleared = await api('PUT', '/student-health', token('nurse'), {
      class_id: classId,
      term: 'first_term',
      rows: [{ child_id: children.B, eye_conditions: [] }],
    });
    assert.equal(cleared.body.removed_count, 1);
    assert.equal(
      (await api('GET', `/student-health?class_id=${classId}&term=first_term`, token('otherNurse'))).status,
      403,
    );
    assert.equal(
      (await api('GET', `/student-health?class_id=${classId}&term=first_term`, token('parent'))).status,
      403,
    );
    const homeroomWrite = await api('PUT', '/student-health', token('homeroom'), {
      class_id: classId,
      term: 'first_term',
      rows: [{ child_id: children.A, can_swim: false }],
    });
    assert.equal(homeroomWrite.status, 403);
    const badEye = await api('PUT', '/student-health', token('nurse'), {
      class_id: classId,
      term: 'first_term',
      rows: [{ child_id: children.A, eye_conditions: ['mu-mau'] }],
    });
    assert.equal(badEye.status, 400);
    const outside = await api('PUT', '/student-health', token('nurse'), {
      class_id: classId,
      term: 'first_term',
      rows: [{ child_id: children.C, can_swim: true }],
    });
    assert.equal(outside.status, 400);
    assert.equal((await api('GET', `/student-health?class_id=${classId}&term=hk3`, token('nurse'))).status, 400);
  });

  it('CT-16h-5: "Lấy dữ liệu từ 4.3" chép số đo gần nhất trong học kỳ, giữ các ô khác; học kỳ chưa cân đo bị từ chối', async () => {
    const classId = classes['MAM-1'] ?? '';
    const unitA = units['ĐT-A1'] ?? '';
    const rounds: string[] = [];
    for (const [name, date, weight] of [
      ['Cân đo đầu năm', addDays(vietnamToday, -40), 13],
      ['Cân đo tháng này', addDays(vietnamToday, -1), 15],
    ] as const) {
      const round = await api('POST', '/growth-rounds', token('nurse'), {
        org_unit_id: unitA,
        name,
        measured_on: date,
      });
      assert.equal(round.status, 201, JSON.stringify(round.body));
      rounds.push(round.body.id as string);
      const measured = await api('PUT', `/growth-rounds/${round.body.id as string}/measurements`, token('nurse'), {
        rows: [
          { child_id: children.A, weight_kg: weight, height_cm: 96 },
          { child_id: children.B, weight_kg: 11, height_cm: 92 },
        ],
      });
      assert.equal(measured.status, 200, JSON.stringify(measured.body));
    }
    const pulled = await api('POST', '/student-health/pull-growth', token('nurse'), {
      class_id: classId,
      term: 'first_term',
    });
    assert.equal(pulled.status, 200, JSON.stringify(pulled.body));
    assert.deepEqual(pulled.body, { updated_count: 2, missing_count: 0 });
    const grid = await api('GET', `/student-health?class_id=${classId}&term=first_term`, token('nurse'));
    const rowA = (grid.body.rows as HealthRow[]).find((row) => row.child_id === children.A);
    assert.equal(rowA?.weight_kg, 15);
    assert.equal(rowA?.can_swim, true);
    assert.deepEqual(rowA?.eye_conditions, ['myopia', 'astigmatism']);
    assert.equal(rowA?.latest_growth?.round_name, 'Cân đo tháng này');
    const empty = await api('POST', '/student-health/pull-growth', token('nurse'), {
      class_id: classId,
      term: 'second_term',
    });
    assert.equal(empty.status, 422);
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-125');
    assert.equal(
      (await api('POST', '/student-health/pull-growth', token('homeroom'), { class_id: classId, term: 'first_term' }))
        .status,
      403,
    );
    const exported = await download(`/student-health/export?class_id=${classId}&term=first_term`, token('nurse'));
    assert.equal(exported.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet?.getRow(2).getCell(10).text, 'Bệnh về mắt');
    assert.equal(sheet?.getRow(3).getCell(10).text, 'Cận thị, Loạn thị');
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['contains_personal_data'])
      .where('report_code', '=', 'student-health')
      .executeTakeFirstOrThrow();
    assert.equal(log.contains_personal_data, true);

    // 4.3.2: tổng hợp theo học kỳ có so sánh đợt đầu với đợt sau, cột được khám định kỳ
    const campaign = await schoolYear
      .insertInto('health_check_campaigns')
      .values({
        org_unit_id: unitA,
        name: 'Khám đầu năm',
        from_date: firstTermStart,
        to_date: addDays(firstTermStart, 5),
        created_by: randomUUID(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('health_check_results')
      .values({
        campaign_id: campaign.id,
        child_id: children.A ?? '',
        height_cm: 95,
        weight_kg: 13,
        result_data: '{}',
        conclusion: 'Bình thường',
        note: null,
        recorded_by: randomUUID(),
        published_at: null,
      })
      .execute();
    const report = await api('GET', `/reports/growth?term=first_term&org_unit_id=${unitA}`, principal.accessToken);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    assert.equal((report.body.rounds as unknown[]).length, 2);
    assert.equal((report.body.totals as Record<string, number>).examined, 1);
    const comparison = report.body.comparison as {
      classes: Array<{ class_name: string; first: Record<string, number>; last: Record<string, number> }>;
    };
    assert.equal(comparison.classes.find((row) => row.class_name === 'MAM-1')?.last.measured, 2);
    const pair = await api(
      'GET',
      `/reports/growth?round_id=${rounds[1]}&compare_round_id=${rounds[0]}`,
      principal.accessToken,
    );
    assert.equal(pair.status, 200, JSON.stringify(pair.body));
    assert.equal((pair.body.comparison as { first_rounds: Array<{ id: string }> }).first_rounds[0]?.id, rounds[0]);
    assert.equal(
      (await api('GET', `/reports/growth?term=first_term&compare_round_id=${rounds[0]}`, principal.accessToken)).status,
      400,
    );
    const secondTerm = await api('GET', '/reports/growth?term=second_term', principal.accessToken);
    assert.equal((secondTerm.body.rounds as unknown[]).length, 0);
    assert.equal(secondTerm.body.comparison, null);
    const file = await download(`/reports/growth/export?term=first_term&org_unit_id=${unitA}`, principal.accessToken);
    const exportedReport = new ExcelJS.Workbook();
    await exportedReport.xlsx.load(file.buffer as unknown as ArrayBuffer);
    assert.ok(exportedReport.getWorksheet('So sánh hai lần cân đo'));
  });

  it('CT-16h-6: 5.3 thống kê học sinh: độ tuổi theo lớp, hoàn thành chương trình, chính sách, bơi, mắt theo học kỳ, dân tộc; xuất tệp', async () => {
    await schoolYear
      .insertInto('program_completions')
      .values({
        child_id: children.C ?? '',
        class_id: classes['LA-1'] ?? '',
        org_unit_id: units['ĐT-A1'] ?? '',
        result: 'completed',
        note: null,
        recorded_by: randomUUID(),
        recorded_by_name: 'Thử',
      })
      .execute();
    const stats = await api('GET', '/statistics/students?term=first_term', token('manager'));
    assert.equal(stats.status, 200, JSON.stringify(stats.body));
    assert.equal(stats.body.term, 'first_term');
    const completion = stats.body.completion as {
      class_count: number;
      categories: Array<{ key: string; count: number; completed: number }>;
    };
    assert.equal(completion.class_count, 1);
    const category = (key: string) => completion.categories.find((item) => item.key === key);
    assert.deepEqual([category('children')?.count, category('children')?.completed], [2, 1]);
    assert.deepEqual([category('female')?.count, category('female')?.completed], [1, 1]);
    assert.deepEqual([category('ethnic')?.count, category('martyr_family')?.completed], [1, 1]);
    const byClass = stats.body.by_class as Array<{ class_name: string; total: number }>;
    assert.deepEqual(
      byClass.map((row) => [row.class_name, row.total]),
      [
        ['LA-1', 2],
        ['MAM-1', 2],
      ],
    );
    const policy = stats.body.policy_by_age as Array<{ value: string; total: number; ages: Record<string, number> }>;
    assert.deepEqual(
      policy.map((row) => row.value),
      ['Con hộ nghèo', 'Con thương binh'],
    );
    assert.equal(policy[1]?.ages.years_5_6, 1);
    const health = stats.body.term_health as {
      recorded: number;
      totals: {
        swimming: { count: number };
        eye_any: { count: number };
        eye_conditions: Array<{ value: string; count: number }>;
      };
    };
    assert.equal(health.recorded, 2);
    assert.equal(health.totals.swimming.count, 1);
    assert.equal(health.totals.eye_any.count, 1);
    assert.equal(health.totals.eye_conditions.find((item) => item.value === 'astigmatism')?.count, 1);
    const ethnic = stats.body.ethnic as { count: number; students: Array<{ full_name: string }> };
    assert.equal(ethnic.count, 2);
    assert.deepEqual(ethnic.students.map((row) => row.full_name).sort(), ['Học sinh B', 'Học sinh C']);
    const second = await api('GET', '/statistics/students?term=second_term', token('manager'));
    // Học kỳ II chưa nhập: biết bơi lấy theo hồ sơ, bệnh về mắt là 0
    assert.equal((second.body.term_health as typeof health).totals.swimming.count, 1);
    assert.equal((second.body.term_health as typeof health).totals.eye_any.count, 0);
    assert.equal((await api('GET', '/statistics/students', token('nurse'))).status, 403);
    assert.equal((await api('GET', '/statistics/students?term=x', token('manager'))).status, 400);
    const xlsx = await download('/statistics/students/export?term=first_term', token('manager'));
    assert.equal(xlsx.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.buffer as unknown as ArrayBuffer);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      [
        'Độ tuổi theo lớp',
        'Hoàn thành chương trình',
        'Diện chính sách theo tuổi',
        'Biết bơi, bệnh về mắt',
        'Học sinh dân tộc',
      ],
    );
    const pdf = await download('/statistics/students/export?term=first_term&format=pdf', token('manager'));
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-16h-7: số liệu báo cáo sức khỏe đầu năm (EMIS 1.3) cho toàn trường; người không có phạm vi toàn trường bị từ chối', async () => {
    const report = await api('GET', '/reports/emis/start-of-year-health', token('vice'));
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const rows = report.body.rows as Array<{
      code: string;
      total: number;
      female: number;
      ethnic_minority: number;
      public: number | null;
    }>;
    const row = (code: string) => rows.find((item) => item.code === code);
    assert.equal(row('1.3.01')?.total, 4);
    assert.equal(row('1.3.01')?.ethnic_minority, 2);
    assert.equal(row('1.3.01')?.public, null);
    assert.equal(row('1.3.02')?.total, 1);
    assert.equal(row('1.3.03')?.total, 2);
    assert.equal(row('1.3.09')?.total, 1);
    assert.equal(row('1.3.17')?.total, 1);
    assert.ok((report.body.warnings as string[]).some((warning) => warning.includes('loại hình trường')));
    assert.equal((await api('GET', '/reports/emis/start-of-year-health', token('manager'))).status, 403);
  });

  it('CT-16h-8: 4.5 thực đơn có tên, tháng, tuần, từ ngày–đến ngày, nhiều khối; trùng khối, ngoài tuần bị từ chối; Thay đổi nháp', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const monday = mondayOf(addDays(vietnamToday, 14));
    const created = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: unitA,
      name: 'Thực đơn mùa thu',
      month: `${monday.slice(5, 7)}/${monday.slice(0, 4)}`,
      week_no: 9,
      from_date: monday,
      to_date: addDays(monday, 4),
      grade_levels: ['MAM', 'LA'],
      items: [{ weekday: 1, meal_type: 'lunch', dish_id: dishes.rice }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.name, 'Thực đơn mùa thu');
    assert.equal(created.body.month, monday.slice(0, 7));
    assert.equal(created.body.week_no, 9);
    assert.deepEqual(created.body.grade_levels, ['LA', 'MAM']);
    assert.equal(created.body.age_group, 'LA,MAM');
    const overlap = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: unitA,
      from_date: monday,
      grade_levels: ['LA'],
    });
    assert.equal(overlap.status, 400);
    const general = await api('POST', '/menus', token('kitchen'), { org_unit_id: unitA, from_date: monday });
    assert.equal(general.status, 201, JSON.stringify(general.body));
    assert.deepEqual(general.body.grade_levels, []);
    const outside = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: unitA,
      from_date: addDays(monday, 7),
      to_date: addDays(monday, 15),
      grade_levels: ['MAM'],
    });
    assert.equal(outside.status, 400);
    const unknownGrade = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: unitA,
      from_date: addDays(monday, 7),
      grade_levels: ['KHONG'],
    });
    assert.equal(unknownGrade.status, 400);
    const changed = await api('PUT', `/menus/${created.body.id as string}`, token('kitchen'), {
      name: 'Thực đơn mùa thu (sửa)',
      grade_levels: ['LA'],
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.name, 'Thực đơn mùa thu (sửa)');
    assert.deepEqual(changed.body.grade_levels, ['LA']);
    const listed = await api('GET', `/menus?org_unit_id=${unitA}&month=${monday.slice(0, 7)}`, token('kitchen'));
    assert.equal((listed.body as unknown as unknown[]).length, 2);
    // Thực đơn đã trình không đổi được thông tin chung
    await api('POST', `/menus/${created.body.id as string}/submit`, token('kitchen'));
    const locked = await api('PUT', `/menus/${created.body.id as string}`, token('kitchen'), { name: 'Khác' });
    assert.equal(locked.status, 422);
    // Trẻ khối Lá nhận thực đơn riêng của khối, trẻ khối Mầm nhận thực đơn chung khi đã công bố
    await api('POST', `/menus/${created.body.id as string}/approve`, token('manager'));
    await api('PUT', `/menus/${general.body.id as string}/items`, token('kitchen'), {
      items: [{ weekday: 2, meal_type: 'breakfast', dish_id: dishes.porridge }],
    });
    await api('POST', `/menus/${general.body.id as string}/submit`, token('kitchen'));
    await api('POST', `/menus/${general.body.id as string}/approve`, token('manager'));
    const childC = await api('GET', `/children/${children.C}/menus?week_start_date=${monday}`, token('manager'));
    assert.equal((childC.body.menu as { id: string }).id, created.body.id);
    const childA = await api('GET', `/children/${children.A}/menus?week_start_date=${monday}`, token('manager'));
    assert.equal((childA.body.menu as { id: string }).id, general.body.id);
  });

  it('CT-16h-9: nhập thực đơn từ Excel: tệp mẫu có danh mục, tệp lỗi có file lỗi, tệp đúng ghi thành thực đơn nháp', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const columns = await api('GET', '/menu-imports/templates/menus/columns', token('kitchen'));
    assert.equal(columns.status, 200, JSON.stringify(columns.body));
    assert.equal(
      (columns.body.columns as Array<{ key: string; locked: boolean }>).find((column) => column.key === 'dish')?.locked,
      true,
    );
    const catalogs = await api('GET', `/menu-imports/catalogs/menus?org_unit_id=${unitA}`, token('kitchen'));
    const dishCatalog = (catalogs.body.items as Array<{ key: string; items: Array<{ name: string }> }>).find(
      (item) => item.key === 'dishes',
    );
    assert.deepEqual(
      dishCatalog?.items.map((item) => item.name),
      ['Cháo thịt', 'Cơm thịt kho'],
    );
    const template = await download(`/menu-imports/templates/menus?org_unit_id=${unitA}`, token('kitchen'));
    assert.equal(template.status, 200);
    const monday = mondayOf(addDays(vietnamToday, 28));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    assert.ok(sheet);
    assert.ok(workbook.getWorksheet('Danh mục'));
    sheet.addRow(['Thực đơn nhập', '', '', monday, addDays(monday, 4), 'MAM', '2', 'Bữa trưa', 'Cơm thịt kho', '']);
    sheet.addRow(['Thực đơn nhập', '', '', monday, addDays(monday, 4), 'MAM', 'CN', 'Bữa sáng', 'Cháo thịt', '']);
    const wrong = await upload('/menu-imports', token('kitchen'), Buffer.from(await workbook.xlsx.writeBuffer()), {
      org_unit_id: unitA,
    });
    assert.equal(wrong.status, 201, JSON.stringify(wrong.body));
    assert.equal(wrong.body.status, 'failed');
    assert.equal((wrong.body.errors as Array<{ column: string }>)[0]?.column, 'Thứ');
    const errorFile = await download(`/menu-imports/${wrong.body.id as string}/error-file`, token('kitchen'));
    assert.equal(errorFile.status, 200);
    const failedCommit = await api('POST', `/menu-imports/${wrong.body.id as string}/commit`, token('kitchen'));
    assert.equal(failedCommit.status, 422);
    sheet.getRow(3).getCell(7).value = '3';
    const right = await upload('/menu-imports', token('kitchen'), Buffer.from(await workbook.xlsx.writeBuffer()), {
      org_unit_id: unitA,
    });
    assert.equal(right.body.status, 'validated', JSON.stringify(right.body));
    assert.equal(right.body.menu_count, 1);
    assert.equal((await api('POST', `/menu-imports/${right.body.id as string}/commit`, token('manager'))).status, 403);
    const committed = await api('POST', `/menu-imports/${right.body.id as string}/commit`, token('kitchen'));
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.equal(committed.body.status, 'committed');
    const menus = await api('GET', `/menus?org_unit_id=${unitA}&week_start_date=${monday}`, token('kitchen'));
    const menu = (
      menus.body as unknown as Array<{ name: string; status: string; item_count: number; grade_levels: string[] }>
    )[0];
    assert.deepEqual(
      [menu?.name, menu?.status, menu?.item_count, menu?.grade_levels],
      ['Thực đơn nhập', 'draft', 2, ['MAM']],
    );
    assert.equal((await api('POST', `/menu-imports/${right.body.id as string}/commit`, token('kitchen'))).status, 422);
    // Tải lại cùng tệp: trùng tuần, trùng khối với thực đơn vừa ghi
    const again = await upload('/menu-imports', token('kitchen'), Buffer.from(await workbook.xlsx.writeBuffer()), {
      org_unit_id: unitA,
    });
    assert.equal(again.body.status, 'failed');
    assert.equal((await upload('/menu-imports', token('nurse'), Buffer.from('x'), { org_unit_id: unitA })).status, 403);
  });
});

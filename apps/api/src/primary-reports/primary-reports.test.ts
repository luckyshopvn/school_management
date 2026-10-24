import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { evaluateFormula, parseFormula, type PrimaryStudentFact } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Báo cáo, thống kê và EMIS Tiểu học (DT-20 phần 20f, YCTD-165); kịch bản CT-20f-1 đến CT-20f-6
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Công thức của dòng chỉ tiêu', () => {
  it('CT-20f-1: cú pháp đối tượng và điều kiện; đếm theo cột tổng, nữ, dân tộc, khuyết tật; lớp chỉ có cột tổng', () => {
    assert.deepEqual(parseFormula('students.grade=K1.two_sessions'), {
      entity: 'students',
      filters: [
        { key: 'grade', value: 'K1' },
        { key: 'two_sessions', value: null },
      ],
    });
    for (const bad of [
      'teachers',
      'students.year_result=xuat_sac',
      'classes.awarded',
      'students.grade=',
      'students.x=1=2',
    ]) {
      assert.throws(() => parseFormula(bad), Error, bad);
    }
    const student = (overrides: Partial<PrimaryStudentFact>): PrimaryStudentFact => ({
      female: false,
      ethnic: false,
      disabled: false,
      grade: 'K1',
      two_sessions: false,
      boarding: false,
      year_result: null,
      completion: null,
      awarded: false,
      ...overrides,
    });
    const facts = {
      students: [
        student({ female: true, ethnic: true, year_result: 'excellent' }),
        student({ female: true, grade: 'K2', disabled: true }),
        student({ ethnic: true, year_result: 'excellent' }),
      ],
      classes: [
        { grade: 'K1', two_sessions: true, boarding: false },
        { grade: 'K2', two_sessions: false, boarding: true },
      ],
    };
    const excellent = parseFormula('students.year_result=excellent');
    assert.deepEqual(
      (['total', 'female', 'ethnic', 'ethnic_female', 'disabled'] as const).map((column) =>
        evaluateFormula(excellent, column, facts),
      ),
      [2, 1, 2, 1, 0],
    );
    assert.equal(evaluateFormula(parseFormula('students.grade=K2'), 'disabled', facts), 1);
    assert.equal(evaluateFormula(parseFormula('classes.two_sessions'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('classes'), 'female', facts), null);
  });
});

describe('Thống kê, EMIS Tiểu học', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const periods: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, user: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(user), body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
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
    unitId = (
      await api('POST', '/org-units', 'principal', {
        code: 'TH20F',
        name: 'Trường Tiểu học',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', 'principal');
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', 'principal', { levels })).status, 200);
    await api('POST', '/grade-levels/templates', 'principal', { school_level: 'TH' });
    await api('POST', '/subjects/templates', 'principal', { school_level: 'TH' });
    for (const row of list((await api('GET', '/subjects?school_level=TH', 'principal')).body)) {
      subjects[row.code as string] = row.id as string;
    }
    await api('POST', '/assessment/config/defaults', 'principal', { school_level: 'TH' });
    for (const period of list((await api('GET', '/assessment/config?school_level=TH', 'principal')).body.periods)) {
      periods[period.code as string] = period.id as string;
    }
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    for (const [code, grade, twoSessions] of [
      ['4A', 'K4', true],
      ['5A', 'K5', false],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: 'TH',
            max_size: 30,
            two_sessions_per_day: twoSessions,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[code] ?? '',
          staff_user_id: users.homeroom?.userId ?? '',
          staff_name: 'Cô chủ nhiệm',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    // An nữ dân tộc Tày bán trú; Bình nam khuyết tật; Chi nữ lớp 5
    for (const [key, classCode, gender, profile, boarding] of [
      ['An', '4A', 'female', { ethnicity: 'Tày' }, true],
      ['Binh', '4A', 'male', { disability_type: 'Khuyết tật vận động' }, false],
      ['Chi', '5A', 'female', null, false],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2016-03-01',
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
          moet_profile: profile ? JSON.stringify(profile) : null,
          boarding,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    const tv = await api('PUT', `/assessment/classes/${classes['4A']}/subjects/${subjects['TH-TV']}`, 'homeroom', {
      period_id: periods.CK1,
      entries: [
        { child_id: children.An, level_code: 'T', score: 9 },
        { child_id: children.Binh, level_code: 'H', score: 6 },
      ],
    });
    assert.equal(tv.status, 200, JSON.stringify(tv.body));
    for (const [classCode, key, result, outcome] of [
      ['4A', 'An', 'excellent', 'promoted'],
      ['4A', 'Binh', 'not_completed', 'retained'],
      ['5A', 'Chi', 'good', 'level_completed'],
    ] as const) {
      await schoolYear
        .insertInto('year_results')
        .values({
          class_id: classes[classCode] ?? '',
          child_id: children[key] ?? '',
          result,
          confirmed_by: principal.userId,
          confirmed_by_name: 'Thử',
        })
        .execute();
      await schoolYear
        .insertInto('completion_results')
        .values({
          class_id: classes[classCode] ?? '',
          child_id: children[key] ?? '',
          grade_level: classCode === '4A' ? 'K4' : 'K5',
          year_result: result,
          outcome,
          confirmed_by: principal.userId,
          confirmed_by_name: 'Thử',
        })
        .execute();
    }
    const title = await schoolYear
      .insertInto('student_award_titles')
      .values({ school_level: 'TH', code: 'HS-XS', name: 'Học sinh Xuất sắc', kind: 'year_end', basis: 'excellent' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('student_awards')
      .values({
        class_id: classes['4A'] ?? '',
        child_id: children.An ?? '',
        title_id: title.id,
        title_name: 'Học sinh Xuất sắc',
        status: 'approved',
        proposed_by: principal.userId,
        proposed_by_name: 'Thử',
        lookup_code: 'ABCDEF123456',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20f-2: sĩ số theo khối: lớp, học sinh, nữ, dân tộc, khuyết tật, 2 buổi/ngày, bán trú; ngoài quyền bị chặn', async () => {
    assert.equal((await api('GET', '/primary-reports/enrollment', 'parent')).status, 403);
    const report = await api('GET', '/primary-reports/enrollment', 'principal');
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const rows = list(report.body.rows);
    assert.deepEqual(
      rows.map((row) => [row.label, row.classes, row.students, row.two_sessions_students]),
      [
        ['Khối 4', 1, 2, 2],
        ['Khối 5', 1, 1, 0],
      ],
    );
    const totals = report.body.totals as Record<string, number>;
    assert.deepEqual(
      [
        totals.students,
        totals.female,
        totals.ethnic,
        totals.disabled,
        totals.boarding_students,
        totals.two_sessions_classes,
      ],
      [3, 2, 1, 1, 1, 1],
    );
  });

  it('CT-20f-3: kết quả đánh giá theo khối, toàn trường: mức đạt từng môn, điểm theo khoảng', async () => {
    const grade = await api('GET', `/primary-reports/assessments?period_id=${periods.CK1}&group=grade`, 'principal');
    assert.equal(grade.status, 200, JSON.stringify(grade.body));
    const tv = list(grade.body.subjects).find((row) => row.subject_name === 'Tiếng Việt');
    assert.deepEqual(
      [tv?.group_label, tv?.level_T, tv?.level_H, tv?.['score_9-10'], tv?.['score_5-6']],
      ['Khối 4', 1, 1, 1, 1],
    );
    const school = await api('GET', `/primary-reports/assessments?period_id=${periods.CK1}&group=school`, 'principal');
    assert.deepEqual(
      list(school.body.groups).map((row) => [row.label, row.students]),
      [['Toàn trường', 3]],
    );
    assert.equal((await api('GET', '/primary-reports/assessments?group=class', 'principal')).status, 400);
  });

  it('CT-20f-4: kết quả cuối năm, hoàn thành chương trình, khen thưởng theo lớp', async () => {
    const report = await api('GET', '/primary-reports/year-end?group=class', 'principal');
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const rows = list(report.body.rows);
    assert.deepEqual(
      rows.map((row) => [row.label, row.students, row.excellent, row.not_completed, row.retained, row.awarded]),
      [
        ['4A (Khối 4)', 2, 1, 1, 1, 1],
        ['5A (Khối 5)', 1, 0, 0, 0, 0],
      ],
    );
    assert.equal(rows[1]?.level_completed, 1);
  });

  it('CT-20f-5: chuyên cần theo tiết và bán trú theo lớp trong khoảng ngày; xuất Excel, PDF', async () => {
    const log = await schoolYear
      .insertInto('class_logs')
      .values({
        class_id: classes['4A'] ?? '',
        lesson_date: vietnamToday,
        period_no: 1,
        subject_id: subjects['TH-TV'] ?? '',
        teacher_user_id: users.homeroom?.userId ?? '',
        teacher_name: 'Cô chủ nhiệm',
        lesson_title: 'Bài 1',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('period_attendance')
      .values([
        { class_log_id: log.id, child_id: children.An ?? '', status: 'present' },
        { class_log_id: log.id, child_id: children.Binh ?? '', status: 'absent_unexcused' },
      ])
      .execute();
    await schoolYear
      .insertInto('boarding_meal_days')
      .values({ class_id: classes['4A'] ?? '', meal_date: vietnamToday, status: 'closed', headcount: 1 })
      .execute();
    await schoolYear
      .insertInto('boarding_meal_cuts')
      .values({
        child_id: children.An ?? '',
        class_id: classes['4A'] ?? '',
        meal_date: addDays(vietnamToday, -1),
        source: 'teacher',
        created_by: principal.userId,
        created_by_name: 'Thử',
      })
      .execute();
    const report = await api(
      'GET',
      `/primary-reports/attendance?from=${addDays(vietnamToday, -7)}&to=${vietnamToday}`,
      'principal',
    );
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const fourA = list(report.body.rows).find((row) => row.class_name === '4A');
    assert.deepEqual(
      [fourA?.lessons, fourA?.present, fourA?.absent_unexcused, fourA?.meal_days, fourA?.meals, fourA?.meal_cuts],
      [1, 1, 1, 1, 1, 1],
    );
    for (const format of ['xlsx', 'pdf']) {
      const file = await fetch(`${environment.baseUrl}/primary-reports/year-end/export?group=grade&format=${format}`, {
        headers: { authorization: `Bearer ${principal.accessToken}` },
      });
      assert.equal(file.status, 200, format);
      assert.ok((file.headers.get('content-type') ?? '').length > 0);
    }
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'primary-year-end')
      .execute();
    assert.equal(logs.length, 2);
    assert.equal((await api('GET', '/primary-reports/khac/export', 'principal')).status, 400);
  });

  it('CT-20f-6: EMIS Tiểu học: khung cấu hình được, dòng công thức, nhập tay, sửa khung, gửi lên cấp trên khoá nhập tay', async () => {
    const forms = await api('GET', '/primary-reports/emis', 'principal');
    assert.deepEqual(
      list(forms.body)
        .map((row) => row.code)
        .sort(),
      ['emis-th-cuoi-nam', 'emis-th-dau-nam'],
    );
    const code = 'emis-th-dau-nam';
    const view = await api('GET', `/primary-reports/emis/${code}`, 'principal');
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const valuesOf = (body: Record<string, unknown>, rowCode: string) =>
      list(body.rows).find((row) => row.code === rowCode)?.values as Record<string, number | null>;
    assert.deepEqual(valuesOf(view.body, '201'), { total: 3, female: 2, ethnic: 1, ethnic_female: 1, disabled: 1 });
    assert.equal(valuesOf(view.body, '205')?.total, 2);
    assert.deepEqual([valuesOf(view.body, '101')?.total, valuesOf(view.body, '101')?.female], [2, null]);
    assert.equal(valuesOf(view.body, '107')?.total, 1);
    const wrongRow = await api('PUT', `/primary-reports/emis/${code}/values`, 'principal', {
      rows: [{ code: '201', values: { total: 5 } }],
    });
    assert.equal(wrongRow.status, 400);
    const saved = await api('PUT', `/primary-reports/emis/${code}/values`, 'principal', {
      rows: [{ code: '209', values: { total: 1, female: 1 } }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(valuesOf(saved.body, '209'), { total: 1, female: 1 });
    const rows = list(view.body.rows).map((row) => ({
      code: row.code,
      label: row.label,
      unit: row.unit,
      kind: row.kind,
      formula: row.formula,
    }));
    const badFormula = await api('PUT', `/primary-reports/emis/${code}/rows`, 'principal', {
      rows: [...rows, { code: '210', label: 'Sai', unit: 'Học sinh', kind: 'formula', formula: 'students.khac' }],
    });
    assert.equal(badFormula.status, 400);
    assert.equal((await api('PUT', `/primary-reports/emis/${code}/rows`, 'homeroom', { rows })).status, 403);
    const extended = await api('PUT', `/primary-reports/emis/${code}/rows`, 'principal', {
      rows: [
        ...rows,
        {
          code: '210',
          label: 'Học sinh được khen thưởng',
          unit: 'Học sinh',
          kind: 'formula',
          formula: 'students.awarded',
        },
      ],
    });
    assert.equal(extended.status, 200, JSON.stringify(extended.body));
    assert.equal(valuesOf(extended.body, '210')?.total, 1);
    const exported = await fetch(`${environment.baseUrl}/primary-reports/emis/${code}/export?format=xlsx`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(exported.status, 200);
    const sentFile = await api('POST', `/upper-level-submissions/${code}/export`, 'principal');
    assert.ok([200, 201].includes(sentFile.status), JSON.stringify(sentFile.body));
    const sent = await api('POST', `/upper-level-submissions/${code}/mark-sent`, 'principal', {
      sent_on: vietnamToday,
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const locked = await api('PUT', `/primary-reports/emis/${code}/values`, 'principal', {
      rows: [{ code: '209', values: { total: 2 } }],
    });
    assert.equal(locked.status, 422);
    assert.equal(errorOf(locked.body).rule_code, 'YCTD-165');
  });
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  evaluateFormula,
  listPortalMenuEntries,
  parseFormula,
  portalWorkspacesForLevels,
  scoreBand,
  type SecondaryStudentFact,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Báo cáo, thống kê và EMIS THCS, THPT (DT-21 phần 21g, YCTD-175); kịch bản CT-21g-1 đến CT-21g-4
const student = (overrides: Partial<SecondaryStudentFact>): SecondaryStudentFact => ({
  female: false,
  ethnic: false,
  disabled: false,
  grade: 'K10',
  boarding: false,
  learning: null,
  conduct: null,
  title: null,
  completion: null,
  combination: null,
  graduation: null,
  awarded: false,
  ...overrides,
});

describe('Công thức biểu EMIS THCS, THPT', () => {
  it('CT-21g-1: điều kiện theo cấp; đếm theo cột; khoảng điểm; menu 7.18 chỉ ở THCS, THPT', () => {
    assert.deepEqual(parseFormula('students.learning=good.combination=TN1', 'THPT'), {
      entity: 'students',
      filters: [
        { key: 'learning', value: 'good' },
        { key: 'combination', value: 'TN1' },
      ],
    });
    // Điều kiện của cấp này không dùng được ở cấp kia
    assert.throws(() => parseFormula('students.learning=good'), Error);
    assert.throws(() => parseFormula('students.year_result=excellent', 'THCS'), Error);
    assert.throws(() => parseFormula('students.learning=excellent', 'THCS'), Error);
    assert.throws(() => parseFormula('classes.two_sessions', 'THPT'), Error);
    const facts = {
      students: [
        student({ female: true, ethnic: true, learning: 'good', title: 'excellent', graduation: 'graduated' }),
        student({ learning: 'good', disabled: true, combination: 'TN1' }),
        student({ learning: 'fail', completion: 'retained' }),
      ],
      classes: [{ grade: 'K10', boarding: true }],
    };
    const good = parseFormula('students.learning=good', 'THPT');
    assert.deepEqual(
      (['total', 'female', 'ethnic', 'ethnic_female', 'disabled'] as const).map((column) =>
        evaluateFormula(good, column, facts),
      ),
      [2, 1, 1, 1, 1],
    );
    assert.equal(evaluateFormula(parseFormula('students.graduation=graduated', 'THPT'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('students.completion=retained', 'THCS'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('classes.boarding', 'THPT'), 'total', facts), 1);
    assert.deepEqual([0, 3.4, 3.5, 4.9, 5, 6.5, 7.9, 8, 10].map(scoreBand), [
      'duoi-3.5',
      'duoi-3.5',
      '3.5-5',
      '3.5-5',
      '5-6.5',
      '6.5-8',
      '6.5-8',
      'tu-8',
      'tu-8',
    ]);
    const shown = (level: 'TH' | 'THCS' | 'THPT') =>
      listPortalMenuEntries(portalWorkspacesForLevels([{ code: level, display_name: level }])).map(
        (entry) => entry.node.path,
      );
    assert.ok(shown('THCS').includes('/secondary-reports'));
    assert.ok(shown('THPT').includes('/secondary-reports'));
    assert.ok(!shown('TH').includes('/secondary-reports'));
  });
});

describe('Điểm cuối báo cáo, thống kê, EMIS THPT', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  const teachers: LoggedInUser[] = [];
  const classes: Record<string, string> = {};
  const subjects: Record<string, string> = {};
  const children: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
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
      await api('POST', '/org-units', principal.accessToken, {
        code: 'THPT-21G',
        name: 'Trường THPT thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THPT',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    for (const path of ['/grade-levels/templates', '/subjects/templates']) {
      assert.equal((await api('POST', path, principal.accessToken, { school_level: 'THPT' })).status, 200);
    }
    for (const row of list((await api('GET', '/subjects?school_level=THPT', principal.accessToken)).body)) {
      subjects[row.code as string] = row.id as string;
    }
    parent = await environment.loginAs('VT-14', unitId);
    teachers.push(await environment.loginAs('VT-08', unitId));
    for (const [name, grade] of [
      ['10A', 'K10'],
      ['11A', 'K11'],
    ] as const) {
      classes[name] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code: name,
            name: `Lớp ${name}`,
            grade_level: grade,
            school_level: 'THPT',
            max_size: 45,
            boarding: name === '11A',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const assigned = await api('POST', `/classes/${classes['10A']}/staff-assignments`, principal.accessToken, {
      staff_user_id: teachers[0]?.userId,
      assignment_role: 'subject',
      subject_id: subjects['THPT-TOAN'],
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const team = await schoolYear
      .insertInto('subject_teams')
      .values({ code: 'TO-TOAN', name: 'Tổ Toán', school_level: 'THPT' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('subject_team_subjects')
      .values({ team_id: team.id, subject_id: subjects['THPT-TOAN'] ?? '' })
      .execute();
    const combination = await api('POST', '/subject-combinations', principal.accessToken, {
      code: 'TN1',
      name: 'Tổ hợp tự nhiên 1',
      subject_ids: ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-TIN'].map((code) => subjects[code]),
    });
    assert.equal(combination.status, 201, JSON.stringify(combination.body));
    // 10A: An (nữ, dân tộc, Tốt, Xuất sắc, tổ hợp TN1), Bình (khuyết tật, Đạt), Chi (Chưa đạt, ở lại lớp); 11A: Dung (Tốt)
    for (const [key, className, gender, profile] of [
      ['An', '10A', 'female', { ethnicity: 'Tày' }],
      ['Binh', '10A', 'male', { disability_type: 'Khuyết tật vận động' }],
      ['Chi', '10A', 'male', null],
      ['Dung', '11A', 'female', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2010-03-01',
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
          moet_profile: profile ? JSON.stringify(profile) : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[className] ?? '', from_date: '2026-09-05' })
        .execute();
    }
    const registered = await api('PUT', `/children/${children.An}/subject-combination`, principal.accessToken, {
      combination_id: combination.body.id,
    });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    const by = { updated_by: principal.userId, updated_by_name: 'Hiệu trưởng thử' };
    await schoolYear
      .insertInto('term_ratings')
      .values([
        {
          class_id: classes['10A'] ?? '',
          child_id: children.An ?? '',
          term_type: 'year',
          learning: 'good',
          conduct: 'good',
          ...by,
        },
        {
          class_id: classes['10A'] ?? '',
          child_id: children.Binh ?? '',
          term_type: 'year',
          learning: 'pass',
          conduct: 'fair',
          ...by,
        },
        {
          class_id: classes['10A'] ?? '',
          child_id: children.Chi ?? '',
          term_type: 'year',
          learning: 'fail',
          conduct: 'pass',
          ...by,
        },
        {
          class_id: classes['11A'] ?? '',
          child_id: children.Dung ?? '',
          term_type: 'year',
          learning: 'good',
          conduct: 'good',
          ...by,
        },
      ])
      .execute();
    const title = await schoolYear
      .insertInto('student_award_titles')
      .values({
        school_level: 'THPT',
        code: 'T21G-XS',
        name: 'Học sinh Xuất sắc',
        kind: 'year_end',
        basis: 'secondary_excellent',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('student_awards')
      .values({
        class_id: classes['10A'] ?? '',
        child_id: children.An ?? '',
        title_id: title.id,
        title_name: 'Học sinh Xuất sắc',
        status: 'approved',
        proposed_by: principal.userId,
        proposed_by_name: 'Hiệu trưởng thử',
      })
      .execute();
    await schoolYear
      .insertInto('completion_results')
      .values(
        [
          { child: 'An', outcome: 'promoted' as const },
          { child: 'Binh', outcome: 'promoted' as const },
          { child: 'Chi', outcome: 'retained' as const },
        ].map((row) => ({
          class_id: classes['10A'] ?? '',
          child_id: children[row.child] ?? '',
          grade_level: 'K10',
          year_result: 'x',
          outcome: row.outcome,
          confirmed_by: principal.userId,
          confirmed_by_name: 'Hiệu trưởng thử',
        })),
      )
      .execute();
    // Điểm Toán: An 9 và 9 (trung bình 9), Bình 6 và 6, Chi 3 và 3; một điểm thường xuyên, giữa kỳ, cuối kỳ mỗi học kỳ
    for (const [key, score] of [
      ['An', 9],
      ['Binh', 6],
      ['Chi', 3],
    ] as const) {
      for (const term of ['first_term', 'second_term'] as const) {
        await schoolYear
          .insertInto('score_entries')
          .values(
            (['regular', 'mid', 'final'] as const).map((kind) => ({
              class_id: classes['10A'] ?? '',
              child_id: children[key] ?? '',
              subject_id: subjects['THPT-TOAN'] ?? '',
              term_type: term,
              kind,
              score,
              ...by,
            })),
          )
          .execute();
      }
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21g-2: sĩ số theo khối, theo tổ hợp; kết quả cuối năm theo lớp; phụ huynh không xem được', async () => {
    const enrollment = await api('GET', '/secondary-reports/enrollment?school_level=THPT', principal.accessToken);
    assert.equal(enrollment.status, 200, JSON.stringify(enrollment.body));
    assert.deepEqual(
      list(enrollment.body.rows).map((row) => [
        row.classes,
        row.students,
        row.female,
        row.ethnic,
        row.disabled,
        row.boarding,
      ]),
      [
        [1, 3, 1, 1, 1, 0],
        [1, 1, 1, 0, 0, 1],
        [2, 4, 2, 1, 1, 1],
      ],
    );
    assert.deepEqual(
      list(enrollment.body.combinations).map((row) => [row.combination, row.students]),
      [
        ['Chưa đăng ký', 3],
        ['TN1', 1],
      ],
    );
    const results = await api('GET', '/secondary-reports/results?school_level=THPT&group=class', principal.accessToken);
    assert.equal(results.status, 200, JSON.stringify(results.body));
    const tenth = list(results.body.rows)[0] as Record<string, unknown> & { learning: Record<string, number> };
    assert.deepEqual(
      [
        tenth.students,
        tenth.learning.good,
        tenth.learning.pass,
        tenth.learning.fail,
        tenth.excellent,
        tenth.promoted,
        tenth.retained,
      ],
      [3, 1, 1, 1, 1, 2, 1],
    );
    assert.equal((await api('GET', '/secondary-reports/results?school_level=TH', principal.accessToken)).status, 400);
    assert.equal((await api('GET', '/secondary-reports/enrollment?school_level=THPT', parent.accessToken)).status, 403);
  });

  it('CT-21g-3: phổ điểm Toán cả năm theo lớp; theo giáo viên, tổ bộ môn; xuất Excel, PDF', async () => {
    const scores = await api(
      'GET',
      `/secondary-reports/scores?school_level=THPT&term=year&group=class&subject_id=${subjects['THPT-TOAN']}`,
      principal.accessToken,
    );
    assert.equal(scores.status, 200, JSON.stringify(scores.body));
    const tenth = list(scores.body.rows)[0] as Record<string, unknown> & { bands: Record<string, number> };
    assert.deepEqual(
      [
        tenth.count,
        tenth.bands['duoi-3.5'],
        tenth.bands['5-6.5'],
        tenth.bands['tu-8'],
        tenth.mean,
        tenth.below_five_percent,
      ],
      [3, 1, 1, 1, 6, 33.3],
    );
    const teachersReport = await api(
      'GET',
      '/secondary-reports/teachers?school_level=THPT&term=year',
      principal.accessToken,
    );
    assert.equal(teachersReport.status, 200, JSON.stringify(teachersReport.body));
    assert.deepEqual(
      list(teachersReport.body.teachers).map((row) => [row.team, row.students, row.mean, row.at_least_five_percent]),
      [['Tổ Toán', 3, 6, 66.7]],
    );
    assert.deepEqual(
      list(teachersReport.body.teams).map((row) => [row.team, row.students]),
      [['Tổ Toán', 3]],
    );
    for (const [report, format] of [
      ['results', 'xlsx'],
      ['teachers', 'pdf'],
    ]) {
      const response = await fetch(url(`/secondary-reports/${report}/export?school_level=THPT&format=${format}`), {
        headers: { authorization: `Bearer ${principal.accessToken}` },
      });
      assert.equal(response.status, 200, `${report} ${format}`);
      assert.ok(response.headers.get('x-export-log-id'));
    }
  });

  it('CT-21g-4: biểu EMIS THPT tách khỏi Tiểu học; tính từ dữ liệu, nhập tay, sửa khung theo điều kiện của cấp; xuất', async () => {
    const forms = list((await api('GET', '/secondary-reports/emis', principal.accessToken)).body);
    assert.deepEqual(forms.map((form) => form.code).sort(), [
      'emis-thcs-cuoi-nam',
      'emis-thcs-dau-nam',
      'emis-thpt-cuoi-nam',
      'emis-thpt-dau-nam',
    ]);
    const primaryForms = list((await api('GET', '/primary-reports/emis', principal.accessToken)).body);
    assert.ok(primaryForms.every((form) => form.school_level === 'TH'));
    assert.equal((await api('GET', '/primary-reports/emis/emis-thpt-cuoi-nam', principal.accessToken)).status, 404);
    const view = await api('GET', '/secondary-reports/emis/emis-thpt-cuoi-nam', principal.accessToken);
    assert.equal(view.status, 200, JSON.stringify(view.body));
    const rows = list(view.body.rows) as Array<Record<string, unknown> & { values: Record<string, number | null> }>;
    const value = (code: string) => rows.find((row) => row.code === code)?.values;
    // Học tập Tốt: An (nữ, dân tộc) và Dung (nữ); Xuất sắc: An; ở lại lớp: Chi
    assert.deepEqual(value('101'), { total: 2, female: 2, ethnic: 1, ethnic_female: 1, disabled: 0 });
    assert.equal(value('301')?.total, 1);
    assert.equal(value('404')?.total, 1);
    assert.deepEqual(view.body.warnings, []);
    const saved = await api('PUT', '/secondary-reports/emis/emis-thpt-cuoi-nam/values', principal.accessToken, {
      rows: [{ code: '303', values: { total: 2 } }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const frame = rows.map(({ code, label, unit, kind, formula }) => ({ code, label, unit, kind, formula }));
    const wrong = await api('PUT', '/secondary-reports/emis/emis-thpt-cuoi-nam/rows', principal.accessToken, {
      rows: [
        ...frame,
        { code: '901', label: 'Sai cấp', unit: 'Học sinh', kind: 'formula', formula: 'students.year_result=excellent' },
      ],
    });
    assert.equal(wrong.status, 400, JSON.stringify(wrong.body));
    const right = await api('PUT', '/secondary-reports/emis/emis-thpt-cuoi-nam/rows', principal.accessToken, {
      rows: [
        ...frame,
        {
          code: '901',
          label: 'Nội trú rèn luyện Tốt',
          unit: 'Học sinh',
          kind: 'formula',
          formula: 'students.conduct=good.boarding',
        },
      ],
    });
    assert.equal(right.status, 200, JSON.stringify(right.body));
    assert.equal(
      (list(right.body.rows) as Array<Record<string, unknown> & { values: Record<string, number> }>).find(
        (row) => row.code === '901',
      )?.values.total,
      1,
    );
    const exported = await fetch(url('/secondary-reports/emis/emis-thpt-cuoi-nam/export?format=xlsx'), {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(exported.status, 200);
  });
});

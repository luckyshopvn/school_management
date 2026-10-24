import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { COMBINATION_RULE, GRADE_LEVEL_TEMPLATES, SUBJECT_TEMPLATES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { checkCombinationSubjects, parseCombinationInput } from './secondary.js';
import { parseSubjectInput } from './subjects.js';

// Nền THCS, THPT (DT-21 phần 21a, YCTD-167): môn học khối 6 đến 12, tổ hợp môn THPT, đăng ký tổ hợp của học sinh, tổ bộ môn
describe('Kiểm tra dữ liệu nền THCS, THPT', () => {
  it('CT-21a-1: bộ môn mẫu THCS, THPT theo khối của cấp; môn lựa chọn THPT chia ba nhóm; quy tắc tổ hợp; nhóm môn hợp lệ', () => {
    for (const level of ['THCS', 'THPT'] as const) {
      const templates = SUBJECT_TEMPLATES[level];
      const grades = new Set(GRADE_LEVEL_TEMPLATES[level].map((grade) => grade.code));
      assert.equal(new Set(templates.map((template) => template.code)).size, templates.length);
      for (const template of templates) {
        assert.ok(template.code.startsWith(`${level}-`), template.code);
        assert.ok(Object.keys(template.periods).length > 0);
        for (const grade of Object.keys(template.periods)) {
          assert.ok(grades.has(grade), `${template.code} ${grade}`);
        }
        for (const periods of Object.values(template.periods)) {
          assert.equal(((periods ?? 0) * 2) % 1, 0);
        }
      }
    }
    assert.deepEqual(
      GRADE_LEVEL_TEMPLATES.THCS.map((grade) => grade.code),
      ['K6', 'K7', 'K8', 'K9'],
    );
    const electives = SUBJECT_TEMPLATES.THPT.filter((template) => template.option_group);
    assert.equal(SUBJECT_TEMPLATES.THCS.filter((template) => template.option_group).length, 0);
    assert.ok(electives.length >= COMBINATION_RULE.subject_count);
    assert.deepEqual([...new Set(electives.map((template) => template.option_group))].sort(), [
      'natural_science',
      'social_science',
      'technology_arts',
    ]);
    assert.ok(electives.every((template) => template.elective_grades?.length === 3));
    assert.ok(
      SUBJECT_TEMPLATES.THPT.filter((template) => !template.option_group).every(
        (template) => !template.elective_grades,
      ),
    );

    const ref = (code: string, group: 'social_science' | 'natural_science' | 'technology_arts') => ({
      id: randomUUID(),
      code,
      name: code,
      option_group: group,
    });
    const good = [
      ref('A', 'natural_science'),
      ref('B', 'natural_science'),
      ref('C', 'social_science'),
      ref('D', 'technology_arts'),
    ];
    assert.deepEqual(checkCombinationSubjects(good, COMBINATION_RULE.subject_count), []);
    assert.equal(checkCombinationSubjects(good.slice(0, 3), COMBINATION_RULE.subject_count).length, 1);
    const missingGroup = [good[0], good[1], ref('E', 'natural_science'), ref('F', 'natural_science')] as typeof good;
    assert.equal(checkCombinationSubjects(missingGroup, COMBINATION_RULE.subject_count).length, 1);

    assert.deepEqual(
      parseSubjectInput({ code: 'X', name: 'X', school_level: 'THPT', option_group: 'natural_science' }),
      {
        code: 'X',
        name: 'X',
        school_level: 'THPT',
        kind: 'subject',
        assessment: 'comment',
        order_no: 0,
        option_group: 'natural_science',
      },
    );
    assert.throws(() => parseSubjectInput({ code: 'X', name: 'X', school_level: 'THPT', option_group: 'khac' }), {
      code: 'ERR_VALIDATION',
    });
    assert.equal(
      parseSubjectInput({ code: 'X', name: 'X', school_level: 'THPT', assessment: 'score' }).assessment,
      'score',
    );
    assert.throws(() => parseCombinationInput({ code: 'T', name: 'T' }), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseCombinationInput({ code: 'T', name: 'T', subject_ids: ['x'] }), {
      code: 'ERR_VALIDATION',
    });
  });
});

describe('Điểm cuối tổ hợp môn, đăng ký tổ hợp, tổ bộ môn', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let subjectTeacher: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const subjectIds: Record<string, string> = {};
  const combinationIds: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  async function setEnabled(codes: string[]) {
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: codes.includes(code as string),
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
  }

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
        code: 'TLC-21A',
        name: 'Trường liên cấp kiểm thử THCS, THPT',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    teacher = await environment.loginAs('VT-07', unitId);
    subjectTeacher = await environment.loginAs('VT-08', unitId);
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-21a-2: nạp bộ môn mẫu THCS, THPT: cấp chưa bật bị từ chối; tạo môn, nhóm môn, chương trình mặc định, số tiết khối 6 đến 12; nạp lại không trùng', async () => {
    assert.equal(
      (await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'THPT' })).status,
      422,
    );
    await setEnabled(['MN', 'THCS', 'THPT']);
    for (const level of ['THCS', 'THPT']) {
      assert.equal(
        (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: level })).status,
        200,
      );
    }
    assert.equal((await api('POST', '/subjects/templates', teacher.accessToken, { school_level: 'THCS' })).status, 403);
    for (const level of ['THCS', 'THPT'] as const) {
      const loaded = await api('POST', '/subjects/templates', principal.accessToken, { school_level: level });
      assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
      assert.equal((loaded.body.created_subjects as string[]).length, SUBJECT_TEMPLATES[level].length);
      const expected = SUBJECT_TEMPLATES[level].reduce(
        (sum, template) => sum + Object.keys(template.periods).length,
        0,
      );
      assert.equal(loaded.body.created_periods, expected);
      const again = await api('POST', '/subjects/templates', principal.accessToken, { school_level: level });
      assert.deepEqual([again.body.created_subjects, again.body.created_periods], [[], 0]);
    }
    const curricula = list((await api('GET', '/curricula', teacher.accessToken)).body);
    assert.deepEqual(
      curricula
        .filter((row) => row.school_level !== 'MN')
        .map((row) => [row.code, row.is_default])
        .sort(),
      [
        ['CT-THCS-2018', true],
        ['CT-THPT-2018', true],
      ],
    );
    for (const level of ['THCS', 'THPT']) {
      for (const row of list((await api('GET', `/subjects?school_level=${level}`, teacher.accessToken)).body)) {
        subjectIds[row.code as string] = row.id as string;
      }
    }
    const physics = list((await api('GET', '/subjects?school_level=THPT', teacher.accessToken)).body).find(
      (row) => row.code === 'THPT-VL',
    );
    assert.deepEqual([physics?.option_group, physics?.assessment], ['natural_science', 'score']);
    const math = list((await api('GET', '/subjects?school_level=THCS', teacher.accessToken)).body).find(
      (row) => row.code === 'THCS-TOAN',
    );
    assert.deepEqual([math?.option_group, math?.assessment], [null, 'score']);
    const created = await api('POST', '/subjects', principal.accessToken, {
      code: 'THPT-KT',
      name: 'Môn mới',
      school_level: 'THPT',
      assessment: 'score',
      option_group: 'technology_arts',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const patched = await api('PATCH', `/subjects/${created.body.id}`, principal.accessToken, { option_group: null });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.option_group, null);
    assert.equal(
      (await api('PATCH', `/subjects/${created.body.id}`, principal.accessToken, { option_group: 'khac' })).status,
      400,
    );
    const curriculum = curricula.find((row) => row.code === 'CT-THPT-2018');
    const rows = list((await api('GET', `/curricula/${curriculum?.id}/subjects`, teacher.accessToken)).body);
    assert.deepEqual(
      rows.filter((row) => row.subject_code === 'THPT-VL').map((row) => [row.grade_level_code, row.is_elective]),
      [
        ['K10', true],
        ['K11', true],
        ['K12', true],
      ],
    );
  });

  it('CT-21a-3: tổ hợp môn THPT: đúng số môn lựa chọn, đủ số nhóm; trùng mã; quyền; không đổi môn khi đã có học sinh', async () => {
    const create = (code: string, subjects: string[], token = principal.accessToken) =>
      api('POST', '/subject-combinations', token, {
        code,
        name: `Tổ hợp ${code}`,
        subject_ids: subjects.map((subject) => subjectIds[subject]),
      });
    const natural = ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-TIN'];
    // Cả bốn môn cùng một nhóm
    assert.equal((await create('TH-1', ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-SH'])).status, 422);
    assert.equal((await create('TH-1', natural, teacher.accessToken)).status, 403);
    assert.equal((await create('TH-1', natural.slice(0, 3))).status, 422);
    // Môn bắt buộc không phải môn lựa chọn
    assert.equal((await create('TH-1', ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-NV'])).status, 422);
    const first = await create('TH-1', natural);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual(
      [first.body.school_level, first.body.student_count, (first.body.subjects as unknown[]).length],
      ['THPT', 0, 4],
    );
    combinationIds['TH-1'] = first.body.id as string;
    assert.equal((await create('TH-1', natural)).status, 409);
    const second = await create('TH-2', ['THPT-DL', 'THPT-GDKTPL', 'THPT-AN', 'THPT-MT']);
    assert.equal(second.status, 201, JSON.stringify(second.body));
    combinationIds['TH-2'] = second.body.id as string;
    const listed = list((await api('GET', '/subject-combinations', teacher.accessToken)).body);
    assert.deepEqual(
      listed.map((row) => row.code),
      ['TH-1', 'TH-2'],
    );
    assert.equal(
      (await api('PATCH', `/subject-combinations/${combinationIds['TH-1']}`, principal.accessToken, { code: 'X' }))
        .status,
      400,
    );
    const renamed = await api('PATCH', `/subject-combinations/${combinationIds['TH-1']}`, principal.accessToken, {
      name: 'Khoa học tự nhiên',
      subject_ids: ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-CN'].map((code) => subjectIds[code]),
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.name, 'Khoa học tự nhiên');
  });

  it('CT-21a-4: học sinh đăng ký tổ hợp: chỉ lớp THPT; đăng ký đầu có hiệu lực ngay; đổi thì chờ duyệt; duyệt, từ chối; môn tự chọn theo tổ hợp', async () => {
    for (const [code, grade, level] of [
      ['10A', 'K10', 'THPT'],
      ['MAM-1', 'MAM', 'MN'],
    ] as const) {
      await schoolYear
        .insertInto('grade_levels')
        .values({ code: grade, name: grade, age_from_months: 0, age_to_months: 0, school_level: level })
        .onConflict((conflict) => conflict.doNothing())
        .execute();
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: level,
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, classCode] of [
      ['high', '10A'],
      ['preschool', 'MAM-1'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2011-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: '2026-09-05' })
        .execute();
    }
    const register = (key: string, combination: string, token = principal.accessToken) =>
      api('PUT', `/children/${children[key]}/subject-combination`, token, {
        combination_id: combinationIds[combination],
      });
    const read = async (key: string) =>
      (await api('GET', `/children/${children[key]}/subject-combination`, principal.accessToken)).body;

    assert.deepEqual(await read('preschool'), { registration: null, options: [] });
    assert.equal((await register('preschool', 'TH-1')).status, 422);
    assert.equal((await register('high', 'TH-1', teacher.accessToken)).status, 403);
    const options = (await read('high')).options as Array<{ code: string }>;
    assert.deepEqual(
      options.map((row) => row.code),
      ['TH-1', 'TH-2'],
    );

    const first = await register('high', 'TH-1');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal((first.body.registration as Record<string, unknown>).status, 'approved');
    let electives = await schoolYear
      .selectFrom('child_elective_subjects')
      .select('subject_id')
      .where('child_id', '=', children.high ?? '')
      .execute();
    assert.equal(electives.length, 4);

    const change = await register('high', 'TH-2');
    assert.equal(change.status, 200, JSON.stringify(change.body));
    const pending = change.body.registration as Record<string, unknown>;
    assert.deepEqual(
      [pending.status, pending.combination_code, pending.previous_combination_id],
      ['pending', 'TH-2', combinationIds['TH-1']],
    );
    // Chờ duyệt: môn tự chọn chưa đổi; người quản lý hồ sơ không duyệt được
    electives = await schoolYear
      .selectFrom('child_elective_subjects')
      .select('subject_id')
      .where('child_id', '=', children.high ?? '')
      .execute();
    assert.deepEqual(
      electives.map((row) => row.subject_id).sort(),
      ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-CN'].map((code) => subjectIds[code] ?? '').sort(),
    );
    assert.equal(
      (await api('POST', `/children/${children.high}/subject-combination/approve`, teacher.accessToken)).status,
      403,
    );
    const rejected = await api('POST', `/children/${children.high}/subject-combination/reject`, principal.accessToken);
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.deepEqual(
      [
        (rejected.body.registration as Record<string, unknown>).combination_code,
        (rejected.body.registration as Record<string, unknown>).status,
      ],
      ['TH-1', 'approved'],
    );
    assert.equal(
      (await api('POST', `/children/${children.high}/subject-combination/approve`, principal.accessToken)).status,
      422,
    );
    await register('high', 'TH-2');
    const approved = await api('POST', `/children/${children.high}/subject-combination/approve`, principal.accessToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.deepEqual(
      [
        (approved.body.registration as Record<string, unknown>).combination_code,
        (approved.body.registration as Record<string, unknown>).status,
      ],
      ['TH-2', 'approved'],
    );
    electives = await schoolYear
      .selectFrom('child_elective_subjects')
      .select('subject_id')
      .where('child_id', '=', children.high ?? '')
      .execute();
    assert.deepEqual(
      electives.map((row) => row.subject_id).sort(),
      ['THPT-DL', 'THPT-GDKTPL', 'THPT-AN', 'THPT-MT'].map((code) => subjectIds[code] ?? '').sort(),
    );

    const students = list(
      (await api('GET', `/subject-combinations/${combinationIds['TH-2']}/students`, principal.accessToken)).body,
    );
    assert.deepEqual(
      students.map((row) => [row.full_name, row.class_name, row.status]),
      [['Học sinh high', '10A', 'approved']],
    );
    const withCount = list((await api('GET', '/subject-combinations', teacher.accessToken)).body);
    assert.deepEqual(
      withCount.map((row) => [row.code, row.student_count]),
      [
        ['TH-1', 0],
        ['TH-2', 1],
      ],
    );
    // Tổ hợp đã có học sinh đăng ký không đổi được danh sách môn
    const locked = await api('PATCH', `/subject-combinations/${combinationIds['TH-2']}`, principal.accessToken, {
      subject_ids: ['THPT-VL', 'THPT-HH', 'THPT-SH', 'THPT-AN'].map((code) => subjectIds[code]),
    });
    assert.equal(locked.status, 422);
  });

  it('CT-21a-5: tổ bộ môn: tạo tổ cùng cấp với môn; một tổ trưởng; thành viên là giáo viên bộ môn; tổng tiết theo phân công', async () => {
    const create = (body: Record<string, unknown>, token = principal.accessToken) =>
      api('POST', '/subject-teams', token, body);
    assert.equal(
      (await create({ code: 'TO-TOAN', name: 'Tổ Toán', school_level: 'THCS' }, teacher.accessToken)).status,
      403,
    );
    assert.equal((await create({ code: 'TO-TOAN', name: 'Tổ Toán', school_level: 'TH' })).status, 400);
    // Môn THPT không vào tổ THCS
    assert.equal(
      (await create({ code: 'TO-TOAN', name: 'Tổ Toán', school_level: 'THCS', subject_ids: [subjectIds['THPT-TOAN']] }))
        .status,
      422,
    );
    const team = await create({
      code: 'TO-TOAN',
      name: 'Tổ Toán',
      school_level: 'THCS',
      subject_ids: [subjectIds['THCS-TOAN'], subjectIds['THCS-TIN']],
    });
    assert.equal(team.status, 201, JSON.stringify(team.body));
    assert.equal((team.body.subjects as unknown[]).length, 2);
    assert.equal((await create({ code: 'TO-TOAN', name: 'Trùng', school_level: 'THCS', subject_ids: [] })).status, 409);
    const teamId = team.body.id as string;
    const member = (body: Record<string, unknown>, token = principal.accessToken) =>
      api('PUT', `/subject-teams/${teamId}/members`, token, body);
    assert.equal((await member({ org_unit_id: unitId, staff_user_id: randomUUID() })).status, 400);
    assert.equal(
      (await member({ org_unit_id: unitId, staff_user_id: subjectTeacher.userId }, teacher.accessToken)).status,
      403,
    );
    const added = await member({ org_unit_id: unitId, staff_user_id: subjectTeacher.userId, role: 'head' });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.deepEqual(
      (added.body.members as Array<{ staff_user_id: string; role: string }>).map((row) => [
        row.staff_user_id,
        row.role,
      ]),
      [[subjectTeacher.userId, 'head']],
    );

    // Phân công môn Toán lớp 6 cho giáo viên: tổng tiết của tổ theo phân công
    await schoolYear
      .insertInto('grade_levels')
      .values({ code: 'K6', name: 'Khối 6', age_from_months: 0, age_to_months: 0, school_level: 'THCS' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '6A',
          name: '6A',
          grade_level: 'K6',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      assignment_role: 'subject',
      staff_user_id: subjectTeacher.userId,
      subject_id: subjectIds['THCS-TOAN'],
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const loads = list((await api('GET', `/subject-teams/${teamId}/loads`, teacher.accessToken)).body);
    assert.deepEqual(
      loads.map((row) => [row.staff_user_id, row.total_periods]),
      [[subjectTeacher.userId, 4]],
    );
    const teachers = list(
      (await api('GET', '/teaching-assignments/teachers?school_level=THCS', teacher.accessToken)).body,
    );
    assert.deepEqual(
      teachers.map((row) => [row.staff_user_id, row.total_periods]),
      [[subjectTeacher.userId, 4]],
    );

    const removed = await api(
      'DELETE',
      `/subject-teams/${teamId}/members/${subjectTeacher.userId}`,
      principal.accessToken,
    );
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.members, []);
    const inactive = await api('PATCH', `/subject-teams/${teamId}`, principal.accessToken, { status: 'inactive' });
    assert.equal(inactive.body.status, 'inactive');
    assert.equal(list((await api('GET', '/subject-teams', teacher.accessToken)).body).length, 1);
    // Cuối kịch bản trả trường về chỉ có Mầm non
    await setEnabled(['MN']);
  });
});

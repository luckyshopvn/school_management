import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { SUBJECT_TEMPLATES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseCurriculumSubjects, parseSubjectInput } from './subjects.js';

// Nền Tiểu học (DT-20 phần 20a, YCTD-158): môn học và hoạt động giáo dục, số tiết theo khối, phân công giảng dạy theo môn,
// môn tự chọn của học sinh
describe('Kiểm tra dữ liệu môn học', () => {
  it('CT-20a-1: môn có mã, tên, cấp; số tiết là bội của 0,5 từ 0,5 đến 40; một môn một khối một dòng; bộ mẫu Tiểu học', () => {
    assert.deepEqual(parseSubjectInput({ code: 'TH-X', name: ' Môn X ', school_level: 'TH' }), {
      code: 'TH-X',
      name: 'Môn X',
      school_level: 'TH',
      kind: 'subject',
      assessment: 'comment',
      order_no: 0,
    });
    assert.throws(() => parseSubjectInput({ code: 'TH-X', name: 'X' }), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseSubjectInput({ code: 'TH-X', name: 'X', school_level: 'DH' }), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseSubjectInput({ code: 'TH-X', name: 'X', school_level: 'TH', kind: 'khac' }), {
      code: 'ERR_VALIDATION',
    });
    const id = randomUUID();
    assert.deepEqual(
      parseCurriculumSubjects({ subjects: [{ subject_id: id, grade_level_code: 'K1', periods_per_week: 1.5 }] }),
      [{ subject_id: id, grade_level_code: 'K1', periods_per_week: 1.5, is_elective: false }],
    );
    for (const periods of [0, 0.3, 41, '2']) {
      assert.throws(
        () =>
          parseCurriculumSubjects({
            subjects: [{ subject_id: id, grade_level_code: 'K1', periods_per_week: periods }],
          }),
        { code: 'ERR_VALIDATION' },
      );
    }
    assert.throws(
      () =>
        parseCurriculumSubjects({
          subjects: [
            { subject_id: id, grade_level_code: 'K1', periods_per_week: 1 },
            { subject_id: id, grade_level_code: 'K1', periods_per_week: 2 },
          ],
        }),
      { code: 'ERR_VALIDATION' },
    );
    assert.throws(() => parseCurriculumSubjects({}), { code: 'ERR_VALIDATION' });
    // Bộ mẫu: tổng tiết bắt buộc mỗi tuần theo khối (thời lượng năm chia 35 tuần)
    const required = (grade: string) =>
      SUBJECT_TEMPLATES.TH.filter((template) => !template.elective_grades?.includes(grade)).reduce(
        (sum, template) => sum + (template.periods[grade] ?? 0),
        0,
      );
    assert.deepEqual(['K1', 'K2', 'K3', 'K4', 'K5'].map(required), [25, 25, 28, 30, 30]);
    assert.equal(new Set(SUBJECT_TEMPLATES.TH.map((template) => template.code)).size, SUBJECT_TEMPLATES.TH.length);
  });
});

describe('Điểm cuối môn học, số tiết, phân công theo môn, môn tự chọn', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let subjectTeachers: LoggedInUser[] = [];
  let academicYearId = '';
  let unitId = '';
  let curriculumId = '';
  const classes: Record<string, string> = {};
  const subjectIds: Record<string, string> = {};
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
        code: 'TLC-20A',
        name: 'Trường liên cấp kiểm thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    teacher = await environment.loginAs('VT-07', unitId);
    subjectTeachers = [await environment.loginAs('VT-08', unitId), await environment.loginAs('VT-08', unitId)];
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-20a-2: nạp bộ môn mẫu: cấp chưa bật bị từ chối; tạo môn, chương trình mặc định, số tiết khối có sẵn; nạp lại không trùng', async () => {
    const disabled = await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'TH' });
    assert.equal(disabled.status, 422);
    await setEnabled(['MN', 'TH']);
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'TH' })).status,
      200,
    );
    assert.equal((await api('POST', '/subjects/templates', teacher.accessToken, { school_level: 'TH' })).status, 403);
    const loaded = await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'TH' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.equal((loaded.body.created_subjects as string[]).length, SUBJECT_TEMPLATES.TH.length);
    const expectedRows = SUBJECT_TEMPLATES.TH.reduce((sum, template) => sum + Object.keys(template.periods).length, 0);
    assert.equal(loaded.body.created_periods, expectedRows);
    curriculumId = loaded.body.curriculum_id as string;
    const curricula = list((await api('GET', '/curricula?school_level=TH', teacher.accessToken)).body);
    assert.deepEqual(
      curricula.map((row) => [row.code, row.is_default]),
      [['CT-TH-2018', true]],
    );
    const again = await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'TH' });
    assert.deepEqual([again.body.created_subjects, again.body.created_periods], [[], 0]);
    for (const row of list((await api('GET', '/subjects?school_level=TH', teacher.accessToken)).body)) {
      subjectIds[row.code as string] = row.id as string;
    }
    const rows = list((await api('GET', `/curricula/${curriculumId}/subjects`, teacher.accessToken)).body);
    const vietnamese = rows.filter((row) => row.subject_code === 'TH-TV').map((row) => row.periods_per_week);
    assert.deepEqual(vietnamese, [12, 10, 7, 7, 7]);
    assert.deepEqual(
      rows.filter((row) => row.subject_code === 'TH-NN1').map((row) => [row.grade_level_code, row.is_elective]),
      [
        ['K1', true],
        ['K2', true],
        ['K3', false],
        ['K4', false],
        ['K5', false],
      ],
    );
    assert.equal(list((await api('GET', '/subjects?school_level=MN', teacher.accessToken)).body).length, 0);
  });

  it('CT-20a-3: sửa số tiết theo khối: môn, khối khác cấp bị từ chối; thay cả bảng; mã, cấp của môn không đổi được', async () => {
    const mnGrade = await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    assert.equal(mnGrade.status, 201);
    const wrongGrade = await api('PUT', `/curricula/${curriculumId}/subjects`, principal.accessToken, {
      subjects: [{ subject_id: subjectIds['TH-TV'], grade_level_code: 'MAM', periods_per_week: 8 }],
    });
    assert.equal(wrongGrade.status, 422);
    assert.equal(
      (
        await api('PUT', `/curricula/${curriculumId}/subjects`, teacher.accessToken, {
          subjects: [{ subject_id: subjectIds['TH-TV'], grade_level_code: 'K1', periods_per_week: 8 }],
        })
      ).status,
      403,
    );
    const current = list((await api('GET', `/curricula/${curriculumId}/subjects`, teacher.accessToken)).body).map(
      (row) => ({
        subject_id: row.subject_id,
        grade_level_code: row.grade_level_code,
        periods_per_week: row.subject_code === 'TH-TV' && row.grade_level_code === 'K1' ? 11.5 : row.periods_per_week,
        is_elective: row.is_elective,
      }),
    );
    const saved = await api('PUT', `/curricula/${curriculumId}/subjects`, principal.accessToken, { subjects: current });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(
      list(saved.body).find((row) => row.subject_code === 'TH-TV' && row.grade_level_code === 'K1')?.periods_per_week,
      11.5,
    );
    assert.equal(
      (await api('PATCH', `/subjects/${subjectIds['TH-TV']}`, principal.accessToken, { code: 'TV2' })).status,
      400,
    );
    const renamed = await api('PATCH', `/subjects/${subjectIds['TH-DD']}`, principal.accessToken, { name: 'Đạo đức' });
    assert.equal(renamed.status, 200);
    const duplicate = await api('POST', '/subjects', principal.accessToken, {
      code: 'TH-TV',
      name: 'Trùng',
      school_level: 'TH',
    });
    assert.equal(duplicate.status, 409);
  });

  it('CT-20a-4: phân công theo môn: lớp Tiểu học bắt buộc chọn môn; một môn một giáo viên; một người dạy nhiều môn; lớp Mầm non như cũ', async () => {
    for (const [code, grade, level] of [
      ['1A', 'K1', 'TH'],
      ['MAM-1', 'MAM', 'MN'],
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
            school_level: level,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const [first, second] = subjectTeachers as [LoggedInUser, LoggedInUser];
    const assign = (classCode: string, body: Record<string, unknown>) =>
      api('POST', `/classes/${classes[classCode]}/staff-assignments`, principal.accessToken, {
        assignment_role: 'subject',
        ...body,
      });
    assert.equal((await assign('1A', { staff_user_id: first.userId, subject_name: 'Tiếng Việt' })).status, 400);
    const vietnamese = await assign('1A', { staff_user_id: first.userId, subject_id: subjectIds['TH-TV'] });
    assert.equal(vietnamese.status, 201, JSON.stringify(vietnamese.body));
    assert.deepEqual(
      [vietnamese.body.subject_name, vietnamese.body.subject_id, vietnamese.body.periods_per_week],
      ['Tiếng Việt', subjectIds['TH-TV'], null],
    );
    const taken = await assign('1A', { staff_user_id: second.userId, subject_id: subjectIds['TH-TV'] });
    assert.equal(taken.status, 422);
    const math = await assign('1A', {
      staff_user_id: first.userId,
      subject_id: subjectIds['TH-TOAN'],
      periods_per_week: 4,
    });
    assert.equal(math.status, 201, JSON.stringify(math.body));
    assert.equal(
      (await assign('1A', { staff_user_id: second.userId, subject_id: subjectIds['TH-TOAN'], periods_per_week: 0.2 }))
        .status,
      400,
    );
    // Môn của danh mục phải cùng cấp với lớp; lớp Mầm non giữ tên môn tự do
    assert.equal(
      (await assign('MAM-1', { staff_user_id: second.userId, subject_id: subjectIds['TH-AN'] })).status,
      400,
    );
    const music = await assign('MAM-1', { staff_user_id: second.userId, subject_name: 'Âm nhạc' });
    assert.equal(music.status, 201, JSON.stringify(music.body));
    assert.equal(music.body.subject_id, null);

    const teaching = await api('GET', `/teaching-assignments?class_id=${classes['1A']}`, teacher.accessToken);
    assert.equal(teaching.status, 200, JSON.stringify(teaching.body));
    const subjects = teaching.body.subjects as Array<{
      subject_code: string;
      assignment: Record<string, unknown> | null;
    }>;
    assert.equal(subjects.find((row) => row.subject_code === 'TH-TV')?.assignment?.periods_per_week, 11.5);
    assert.equal(subjects.find((row) => row.subject_code === 'TH-TOAN')?.assignment?.periods_per_week, 4);
    assert.equal(subjects.find((row) => row.subject_code === 'TH-DD')?.assignment, null);
    assert.equal(
      subjects.some((row) => row.subject_code === 'TH-LSDL'),
      false,
    );
    const loads = list((await api('GET', '/teaching-assignments/teachers?school_level=TH', teacher.accessToken)).body);
    assert.deepEqual(
      loads.map((row) => [row.staff_user_id, row.total_periods, row.classes]),
      [[first.userId, 15.5, 1]],
    );
  });

  it('CT-20a-5: môn tự chọn của học sinh: chỉ môn tự chọn của khối lớp đang học; trẻ Mầm non không có môn tự chọn', async () => {
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const children: Record<string, string> = {};
    for (const [key, classCode] of [
      ['primary', '1A'],
      ['preschool', 'MAM-1'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2020-03-01',
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
    assert.ok(relationship.id);
    const options = await api('GET', `/children/${children.primary}/elective-subjects`, principal.accessToken);
    assert.equal(options.status, 200, JSON.stringify(options.body));
    assert.deepEqual(
      (options.body.options as Array<{ id: string }>).map((row) => row.id).sort(),
      [subjectIds['TH-NN1'], subjectIds['TH-TDTTS']].sort(),
    );
    assert.equal(
      (
        await api('PUT', `/children/${children.primary}/elective-subjects`, principal.accessToken, {
          subject_ids: [subjectIds['TH-TV']],
        })
      ).status,
      422,
    );
    const saved = await api('PUT', `/children/${children.primary}/elective-subjects`, principal.accessToken, {
      subject_ids: [subjectIds['TH-NN1']],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(
      (saved.body.subjects as Array<{ code: string }>).map((row) => row.code),
      ['TH-NN1'],
    );
    assert.equal(
      (
        await api('PUT', `/children/${children.primary}/elective-subjects`, teacher.accessToken, {
          subject_ids: [],
        })
      ).status,
      403,
    );
    const preschool = await api('GET', `/children/${children.preschool}/elective-subjects`, principal.accessToken);
    assert.deepEqual(preschool.body, { subjects: [], options: [] });
  });
});

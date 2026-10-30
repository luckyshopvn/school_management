import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { evaluateFormula, parseFormula } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { schoolTypes } from '../primary-reports/tt25-facts.js';

// Biểu thống kê Thông tư 25/2024 cấp THPT (YCTD-385 lát L3); kịch bản CT-2010 đến CT-2012
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Điều kiện THPT của biểu Thông tư 25/2024', () => {
  it('CT-2010: loại trường THPT theo cấp; công thức của biểu 04 đọc được với cấp THPT', () => {
    assert.equal(schoolTypes(['THPT']).type_thpt, true);
    assert.equal(schoolTypes(['THCS', 'THPT']).type_thcs_thpt, true);
    assert.equal(schoolTypes(['TH', 'THCS', 'THPT']).type_th_thcs_thpt, true);
    assert.equal(schoolTypes(['MN', 'TH', 'THCS', 'THPT']).type_thpt, false);
    for (const text of [
      'students.grade=K10.age=15.new_entrant',
      'students.graduation_eligible',
      'school.type_th_thcs_thpt.disaster_plan',
      'staff.teacher.rank=1',
    ]) {
      assert.doesNotThrow(() => parseFormula(text, 'THPT'), text);
    }
    const facts = { students: [{ grade: 'K10', age: 15, new_entrant: true, female: true, ethnic: true }], classes: [] };
    assert.equal(
      evaluateFormula(parseFormula('students.grade=K10.age=15.new_entrant', 'THPT'), 'ethnic_female', facts),
      1,
    );
  });
});

describe('Biểu 04.ĐN-THPT, 04.CN-THPT', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  let startYear = 0;
  const api = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, principal.accessToken, body);
  type Row = { code: string; values: Record<string, number | null> };
  const rowOf = (body: Record<string, unknown>, code: string) =>
    (body.rows as Row[]).find((row) => row.code === code) ?? assert.fail(`không có dòng ${code}`);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const year = await environment.system
      .selectFrom('academic_years')
      .select('start_date')
      .where('id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    const start: unknown = year.start_date;
    startYear = start instanceof Date ? start.getUTCFullYear() : Number(String(start).slice(0, 4));
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', { code: 'THPT385', name: 'Trường THCS và THPT', unit_type: 'truong_chinh' })
    ).body.id as string;
    const current = await api('GET', '/school-levels');
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'THCS' || code === 'THPT',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', { levels })).status, 200);
    const general = JSON.stringify({ ownership_type: 'public', national_standard_level: '2' });
    const otherInfo = JSON.stringify({ grid_electricity: true });
    await schoolYear
      .insertInto('school_profiles')
      .values({
        org_unit_id: unitId,
        general,
        other_info: otherInfo,
        foreign_elements: '{}',
        internet: '{}',
        it_infrastructure: '{}',
        updated_by: principal.userId,
      })
      .onConflict((conflict) => conflict.column('org_unit_id').doUpdateSet({ general, other_info: otherInfo }))
      .execute();
    const classIds: Record<string, string> = {};
    for (const [code, grade, twoSessions] of [
      ['10A', 'K10', true],
      ['12A', 'K12', false],
    ] as const) {
      classIds[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: 'THPT',
            max_size: 40,
            two_sessions_per_day: twoSessions,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // Hoa nữ dân tộc Tày 15 tuổi lớp 10; Nam nam 17 tuổi lớp 12 khuyết tật vận động
    for (const [key, classCode, gender, age, profile] of [
      ['Hoa', '10A', 'female', 15, { ethnicity: 'Tày' }],
      ['Nam', '12A', 'male', 17, { disability_type: 'Khuyết tật vận động' }],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: `${startYear - age}-05-01`,
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
          moet_profile: JSON.stringify(profile),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classIds[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    for (const [code, profile] of [
      ['GV3', { position_group: 'Giáo viên', civil_service_rank: 'Hạng II' }],
      ['HT3', { position_group: 'Cán bộ quản lý', job_position: 'Hiệu trưởng' }],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitId,
          code,
          full_name: `Cán bộ ${code}`,
          start_date: `${startYear - 3}-08-15`,
          gender: 'female',
          dob: `${startYear - 30}-01-01`,
          moet_profile: JSON.stringify(profile),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-2011: 04.ĐN-THPT: trường THCS và THPT ghi ở nhóm 1.2; lớp, tuổi, mới tuyển lớp 10, 2 buổi, khuyết tật; đội ngũ ở cấp cao nhất', async () => {
    const forms = (await api('GET', '/secondary-reports/emis')).body as unknown as Array<Record<string, unknown>>;
    assert.ok(
      forms.some((form) => form.code === 'tt25-04-dn-thpt') && !forms.some((form) => form.code === 'emis-thpt-dau-nam'),
    );
    assert.equal((await api('GET', '/primary-reports/emis/tt25-04-dn-thpt')).status, 404);
    const view = await api('GET', '/secondary-reports/emis/tt25-04-dn-thpt');
    assert.equal(view.status, 200);
    const body = view.body;
    assert.equal(body.ownership_label, 'Công lập');
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(['01', '02', '18', '19', '20', '23', '33'].map(total), [1, 0, 1, 0, 1, 1, 0]);
    assert.deepEqual(['47', '48', '50', '51', '54'].map(total), [2, 1, 1, 1, 0]);
    assert.deepEqual(rowOf(body, '58').values, { total: 1, female: 1, ethnic: 1, ethnic_female: 1 });
    assert.deepEqual(['55', '63', '75', '85', '91', '93', '97'].map(total), [2, 1, 1, 1, 1, 1, 1]);
    assert.deepEqual(['107', '108', '109', '118', '126', '117'].map(total), [2, 1, 1, 1, 1, 1]);
  });

  it('CT-2012: 04.CN-THPT: loại trường, lớp, quy mô, đội ngũ; tốt nghiệp chưa xét là 0', async () => {
    const body = (await api('GET', '/secondary-reports/emis/tt25-04-cn-thpt')).body;
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(
      ['01', '02', '03', '04', '09', '18', '19', '21', '30', '32', '36', '41'].map(total),
      [1, 0, 1, 0, 2, 2, 1, 1, 0, 0, 2, 1],
    );
  });
});

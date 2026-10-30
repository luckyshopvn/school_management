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
import { schoolTypes, staffJobOf } from '../primary-reports/tt25-facts.js';

// Biểu thống kê Thông tư 25/2024 cấp THCS (YCTD-385 lát L2); kịch bản CT-1920 đến CT-1923
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Điều kiện THCS của biểu Thông tư 25/2024', () => {
  it('CT-1920: loại trường theo cấp, nhân viên thiết bị chỉ ở THCS, THPT, điều kiện mới của học sinh THCS', () => {
    assert.deepEqual(schoolTypes(['MN', 'THCS']), {
      type_thcs: true,
      type_th_thcs: false,
      type_thpt: false,
      type_thcs_thpt: false,
      type_th_thcs_thpt: false,
    });
    assert.equal(schoolTypes(['TH', 'THCS']).type_th_thcs, true);
    assert.equal(schoolTypes(['TH', 'THCS', 'THPT']).type_th_thcs_thpt, true);
    assert.equal(schoolTypes(['THCS', 'THPT']).type_thcs, false);
    assert.equal(staffJobOf('Nhân viên thiết bị, thí nghiệm', null, 'THCS'), 'equipment_lab');
    assert.equal(staffJobOf('Nhân viên thiết bị, thí nghiệm', null, 'TH'), 'other_staff');
    for (const text of [
      'students.grade=K6.age=11.new_entrant',
      'students.graduation_eligible',
      'students.disability=vision',
      'classes.two_sessions',
      'classes.multigrade',
      'school.type_th_thcs.standard_1',
      'staff.job=equipment_lab',
    ]) {
      assert.doesNotThrow(() => parseFormula(text, 'THCS'), text);
    }
    assert.throws(() => parseFormula('students.year_result=good', 'THCS'), Error);
    const facts = {
      students: [
        { grade: 'K9', graduation: 'graduated', graduation_eligible: true, disabled: true, female: true },
        { grade: 'K9', graduation: null, graduation_eligible: true, disabled: false, female: false },
      ],
      classes: [],
    };
    assert.equal(evaluateFormula(parseFormula('students.graduation_eligible', 'THCS'), 'total', facts), 2);
    assert.equal(evaluateFormula(parseFormula('students.graduation=graduated.disabled', 'THCS'), 'female', facts), 1);
  });
});

describe('Biểu 03.ĐN-THCS, 03.CN-THCS', () => {
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
      await api('POST', '/org-units', { code: 'THCS385', name: 'Trường TH và THCS', unit_type: 'truong_chinh' })
    ).body.id as string;
    const current = await api('GET', '/school-levels');
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', { levels })).status, 200);
    const general = JSON.stringify({ ownership_type: 'private', national_standard_level: '1' });
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
      ['6A', 'K6', true],
      ['9A', 'K9', false],
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
            school_level: 'THCS',
            max_size: 40,
            two_sessions_per_day: twoSessions,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // Hoa nữ dân tộc Tày 11 tuổi lớp 6; Nam nam 14 tuổi lớp 9 khuyết tật vận động
    for (const [key, classCode, gender, age, profile] of [
      ['Hoa', '6A', 'female', 11, { ethnicity: 'Tày' }],
      ['Nam', '9A', 'male', 14, { disability_type: 'Khuyết tật vận động' }],
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
      ['GV2', { position_group: 'Giáo viên', civil_service_rank: 'Hạng III' }],
      ['NV2', { position_group: 'Nhân viên', job_position: 'Nhân viên thiết bị, thí nghiệm' }],
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

  it('CT-1921: danh sách THCS có hai biểu Thông tư 25, biểu khung THCS cũ ẩn; đường Tiểu học không mở được', async () => {
    const forms = (await api('GET', '/secondary-reports/emis')).body as unknown as Array<Record<string, unknown>>;
    const codes = forms.map((form) => form.code);
    assert.ok(codes.includes('tt25-03-dn-thcs') && codes.includes('tt25-03-cn-thcs'));
    assert.ok(!codes.includes('emis-thcs-dau-nam'));
    assert.equal((await api('GET', '/primary-reports/emis/tt25-03-dn-thcs')).status, 404);
  });

  it('CT-1922: 03.ĐN-THCS: trường Tiểu học và THCS ghi ở nhóm 1.2, cột tư thục, tuổi, 2 buổi, thiết bị thí nghiệm', async () => {
    const view = await api('GET', '/secondary-reports/emis/tt25-03-dn-thcs');
    assert.equal(view.status, 200);
    const body = view.body;
    assert.equal(body.ownership_label, 'Tư thục');
    const sections = body.sections as Array<{ code: string; columns: Array<{ key: string }> }>;
    assert.equal(sections.find((section) => section.code === 'doi_ngu')?.columns.length, 4);
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(['01', '02', '03', '18', '19', '20', '23'].map(total), [1, 0, 0, 1, 1, 0, 1]);
    assert.deepEqual(['33', '34', '37', '38'].map(total), [2, 1, 1, 1]);
    assert.deepEqual(rowOf(body, '45').values, { total: 1, female: 1, ethnic: 1, ethnic_female: 1 });
    assert.deepEqual(['42', '50', '70', '87', '90', '94'].map(total), [2, 1, 1, 1, 1, 1]);
    assert.deepEqual(['103', '116', '127', '138', '115'].map(total), [2, 1, 1, 1, 2]);
  });

  it('CT-1923: 03.CN-THCS: loại trường, lớp, quy mô, thiết bị thí nghiệm; tốt nghiệp chưa xét là 0', async () => {
    const body = (await api('GET', '/secondary-reports/emis/tt25-03-cn-thcs')).body;
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(
      ['01', '02', '03', '08', '18', '22', '35', '37', '50', '41'].map(total),
      [1, 0, 1, 2, 2, 1, 0, 2, 1, 2],
    );
  });
});

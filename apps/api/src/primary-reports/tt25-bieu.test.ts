import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  evaluateFormula,
  expandSectionColumns,
  parseFormula,
  parseRowSum,
  sectionColumns,
  type ReportSection,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { ageBandOf, disabilityKindOf, staffJobOf } from './tt25-facts.js';

// Biểu thống kê Thông tư 25/2024 cấp Tiểu học, khung biểu nhiều phần (YCTD-385 lát L1); kịch bản CT-1880 đến CT-1886
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Công thức và phần của biểu Thông tư 25/2024', () => {
  it('CT-1880: đối tượng mới, so sánh tuổi, dòng cộng, đội ngũ chỉ đếm người đang làm', () => {
    assert.deepEqual(parseFormula('students.grade=K1.age_under=11').filters, [
      { key: 'grade', value: 'K1' },
      { key: 'age_under', value: '11' },
    ]);
    for (const bad of ['students.age=sau', 'teachers', 'school.grade=K1', 'staff.rank=4', 'rooms.subject=am_nhac']) {
      assert.throws(() => parseFormula(bad), Error, bad);
    }
    assert.deepEqual(parseRowSum('rows:156+158+164'), ['156', '158', '164']);
    assert.equal(parseRowSum('students'), null);
    const facts = {
      students: [
        { grade: 'K1', age: 6, female: true, ethnic: true },
        { grade: 'K1', age: 7, female: false, ethnic: false },
        { grade: 'K5', age: 12, female: true, ethnic: false },
      ],
      classes: [],
      school: [{ electricity: true, internet: false }],
      staff: [
        { active: true, teacher: true, female: true, ethnic: false, indefinite: true, retired: false },
        { active: false, teacher: true, female: false, ethnic: false, indefinite: false, retired: true },
      ],
      rooms: [
        { classroom: true, permanent: true },
        { classroom: true, borrowed: true },
      ],
    };
    assert.equal(evaluateFormula(parseFormula('students.grade=K1.age=6'), 'ethnic_female', facts), 1);
    assert.equal(evaluateFormula(parseFormula('students.age_over=11'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('school.electricity'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('school.internet'), 'total', facts), 0);
    assert.equal(evaluateFormula(parseFormula('school'), 'female', facts), null);
    assert.equal(evaluateFormula(parseFormula('staff.teacher'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('staff.teacher'), 'indefinite', facts), 1);
    assert.equal(evaluateFormula(parseFormula('staff.teacher.retired'), 'total', facts), 1);
    assert.equal(evaluateFormula(parseFormula('rooms.classroom'), 'permanent', facts), 1);
  });

  it('CT-1881: cột của trường theo loại hình, cột xuất đủ ba nhóm như mẫu', () => {
    const section: ReportSection = {
      code: 'doi_ngu',
      name: 'IV. Đội ngũ',
      ownership_groups: true,
      columns: [
        { key: 'total', label: 'Tổng số' },
        { key: 'indefinite', label: 'HĐLV không xác định thời hạn', public_only: true },
        { key: 'female', label: 'Nữ' },
      ],
    };
    assert.deepEqual(
      sectionColumns(section, 'private').map((column) => column.key),
      ['total', 'female'],
    );
    assert.deepEqual(
      expandSectionColumns(section).map(({ group, column }) => `${group}:${column.key}`),
      [
        'total:total',
        'total:female',
        'public:total',
        'public:indefinite',
        'public:female',
        'private:total',
        'private:female',
      ],
    );
  });

  it('CT-1882: dạng khuyết tật, vị trí việc làm, nhóm tuổi theo chữ của hồ sơ', () => {
    assert.equal(disabilityKindOf('Khiếm thị'), 'vision');
    assert.equal(disabilityKindOf('Khuyết tật vận động'), 'mobility');
    assert.equal(disabilityKindOf('Tự kỷ'), 'neuro_mental');
    assert.equal(disabilityKindOf('Đa tật'), 'other');
    assert.equal(disabilityKindOf('Không'), null);
    assert.equal(staffJobOf('Giáo vụ', null), 'academic_affairs');
    assert.equal(staffJobOf('Kế toán', null), 'accounting');
    assert.equal(staffJobOf(null, 'Nhân viên bảo vệ'), 'security');
    assert.equal(staffJobOf('Lao công', null), 'other_staff');
    assert.deepEqual([19, 20, 29, 30, 59, 60, 64].map(ageBandOf), [
      null,
      '20_29',
      '20_29',
      '30_39',
      '50_59',
      '60',
      '60',
    ]);
  });
});

describe('Biểu 02.ĐN-TH, 02.CN-TH', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  let startYear = 0;
  const api = (method: string, path: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, principal.accessToken, body);
  type Row = { code: string; kind: string; section: string; values: Record<string, number | null> };
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
    unitId = (await api('POST', '/org-units', { code: 'TH385', name: 'Trường Tiểu học', unit_type: 'truong_chinh' }))
      .body.id as string;
    await schoolYear
      .insertInto('org_units')
      .values({
        code: 'DT385',
        name: 'Điểm trường Bắc',
        unit_type: 'diem_truong',
        parent_id: unitId,
        address: null,
        phone: null,
        manager_user_id: null,
        created_by: null,
      })
      .execute();
    const current = await api('GET', '/school-levels');
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', { levels })).status, 200);
    await schoolYear
      .insertInto('school_profiles')
      .values({
        org_unit_id: unitId,
        general: JSON.stringify({ ownership_type: 'public', national_standard_level: '2', province: 'Tỉnh Mẫu' }),
        other_info: JSON.stringify({ grid_electricity: true, has_internet: true, handwashing: false }),
        foreign_elements: '{}',
        internet: '{}',
        it_infrastructure: '{}',
        updated_by: principal.userId,
      })
      .onConflict((conflict) =>
        conflict.column('org_unit_id').doUpdateSet({
          general: JSON.stringify({ ownership_type: 'public', national_standard_level: '2', province: 'Tỉnh Mẫu' }),
          other_info: JSON.stringify({ grid_electricity: true, has_internet: true, handwashing: false }),
        }),
      )
      .execute();
    const room = await schoolYear
      .insertInto('rooms')
      .values({ org_unit_id: unitId, code: 'P1', name: 'Phòng 1', capacity: 35, condition: 'permanent' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('rooms')
      .values({
        org_unit_id: unitId,
        code: 'DCN',
        name: 'Phòng đa chức năng',
        capacity: 35,
        condition: 'semi_permanent',
        room_type: 'multi_purpose',
      })
      .execute();
    const classIds: Record<string, string> = {};
    for (const [code, grade, combined, roomId] of [
      ['1A', 'K1', false, room.id],
      ['2A', 'K2', true, null],
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
            school_level: 'TH',
            max_size: 30,
            two_sessions_per_day: grade === 'K1',
            is_combined: combined,
            room_id: roomId,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // An nữ dân tộc Tày 6 tuổi lớp 1; Bình nam khiếm thị 7 tuổi lớp 1; Chi nữ 7 tuổi lớp 2; Dũng thôi học trong năm
    for (const [key, classCode, gender, age, profile, status] of [
      ['An', '1A', 'female', 6, { ethnicity: 'Tày' }, 'active'],
      ['Binh', '1A', 'male', 7, { disability_type: 'Khiếm thị' }, 'active'],
      ['Chi', '2A', 'female', 7, null, 'active'],
      ['Dung', '2A', 'male', 8, null, 'withdrawn'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: `${startYear - age}-03-01`,
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status,
          enroll_date: addDays(vietnamToday, -60),
          leave_date: status === 'withdrawn' ? addDays(vietnamToday, -5) : null,
          moet_profile: profile ? JSON.stringify(profile) : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classIds[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    // Hiệu trưởng nữ; giáo viên hạng II viên chức không xác định thời hạn, 35 tuổi; kế toán hợp đồng lao động
    for (const [code, gender, birth, profile] of [
      [
        'CB1',
        'female',
        startYear - 50,
        {
          position_group: 'Cán bộ quản lý',
          job_position: 'Hiệu trưởng',
          contract_form: 'Viên chức HĐLV không xác định thời hạn',
        },
      ],
      [
        'GV1',
        'male',
        startYear - 35,
        {
          position_group: 'Giáo viên',
          civil_service_rank: 'Hạng II',
          contract_form: 'Viên chức HĐLV không xác định thời hạn',
          ethnicity: 'Nùng',
        },
      ],
      [
        'NV1',
        'female',
        startYear - 28,
        { position_group: 'Nhân viên', job_position: 'Kế toán', contract_form: 'Hợp đồng lao động' },
      ],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitId,
          code,
          full_name: `Cán bộ ${code}`,
          start_date: `${startYear - 5}-08-15`,
          gender,
          dob: `${birth}-06-01`,
          moet_profile: JSON.stringify(profile),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-1883: danh sách có hai biểu Thông tư 25, biểu khung cũ chỉ hiện khi xin; đường THCS, THPT không mở được', async () => {
    const forms = (await api('GET', '/primary-reports/emis')).body as unknown as Array<Record<string, unknown>>;
    const codes = forms.map((form) => form.code);
    assert.ok(codes.includes('tt25-02-dn-th') && codes.includes('tt25-02-cn-th'));
    assert.ok(!codes.includes('emis-th-dau-nam'));
    const all = (await api('GET', '/primary-reports/emis?archived=true')).body as unknown as Array<
      Record<string, unknown>
    >;
    assert.ok(all.some((form) => form.code === 'emis-th-dau-nam' && String(form.name).endsWith('(khung cũ)')));
    assert.equal((await api('GET', '/secondary-reports/emis/tt25-02-dn-th')).status, 404);
  });

  it('CT-1884: 02.ĐN-TH tính đúng các phần, cột theo loại hình công lập', async () => {
    const view = await api('GET', '/primary-reports/emis/tt25-02-dn-th');
    assert.equal(view.status, 200);
    const body = view.body;
    assert.equal(body.form_number, '02.ĐN-TH');
    assert.equal(body.ownership_label, 'Công lập');
    const sections = body.sections as Array<{ code: string; columns: Array<{ key: string }> }>;
    assert.deepEqual(
      sections.map((section) => section.code),
      ['truong', 'lop', 'hoc_sinh', 'doi_ngu', 'phong_hoc'],
    );
    assert.equal(sections[3]?.columns.length, 7);
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(['01', '02', '03', '07', '08', '13', '17'].map(total), [1, 0, 1, 1, 1, 0, 1]);
    assert.deepEqual(['18', '19', '20', '24', '27', '26'].map(total), [2, 1, 1, 1, 1, 0]);
    assert.equal(total('29'), 3);
    assert.deepEqual(rowOf(body, '32').values, { total: 1, female: 1, ethnic: 1, ethnic_female: 1 });
    assert.deepEqual(['33', '37', '38', '42', '93', '94'].map(total), [1, 2, 1, 1, 1, 1]);
    assert.deepEqual(['104', '105', '106', '117', '127', '130', '144', '141'].map(total), [3, 1, 1, 1, 1, 1, 1, 1]);
    assert.equal(rowOf(body, '117').values.indefinite, 1);
    assert.equal(rowOf(body, '117').values.ethnic, 1);
    assert.equal(rowOf(body, '144').values.labor_contract, 1);
    assert.deepEqual(['155', '156', '164'].map(total), [2, 1, 1]);
    assert.equal(rowOf(body, '156').values.permanent, 1);
    assert.equal(rowOf(body, '04').kind, 'manual');
    assert.equal(body.can_edit_form, false);
  });

  it('CT-1885: nhập tay theo phần, dòng cộng gồm số nhập tay; không sửa dòng của biểu pháp định; xuất đủ ba nhóm cột', async () => {
    const saved = await api('PUT', '/primary-reports/emis/tt25-02-dn-th/values', {
      rows: [
        { code: '159', values: { total: 2, permanent: 2 } },
        { code: '04', values: { total: 1 } },
      ],
    });
    assert.equal(saved.status, 200);
    assert.equal(rowOf(saved.body, '159').values.total, 2);
    assert.equal(rowOf(saved.body, '158').values.total, 2);
    assert.equal(rowOf(saved.body, '155').values.total, 4);
    const stored = await schoolYear
      .selectFrom('emis_report_values')
      .select(['tab_key', 'row_code'])
      .where('form_code', '=', 'tt25-02-dn-th')
      .execute();
    assert.deepEqual(stored.map((row) => `${row.tab_key}:${row.row_code}`).sort(), ['phong_hoc:159', 'truong:04']);
    const wrongColumn = await api('PUT', '/primary-reports/emis/tt25-02-dn-th/values', {
      rows: [{ code: '04', values: { female: 1 } }],
    });
    assert.equal(wrongColumn.status, 400);
    const rows = await api('PUT', '/primary-reports/emis/tt25-02-dn-th/rows', {
      rows: [{ code: '01', label: 'Tổng', kind: 'manual' }],
    });
    assert.equal(errorOf(rows.body).rule_code, 'YCTD-165');
    const file = await fetch(`${environment.baseUrl}/primary-reports/emis/tt25-02-dn-th/export?format=xlsx`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(file.status, 200);
    assert.ok((await file.arrayBuffer()).byteLength > 1000);
  });

  it('CT-1886: 02.CN-TH tính bỏ học, cộng vị trí việc làm, hoàn thành chương trình theo tuổi', async () => {
    const body = (await api('GET', '/primary-reports/emis/tt25-02-cn-th')).body;
    const total = (code: string) => rowOf(body, code).values.total;
    assert.deepEqual(
      ['01', '07', '08', '15', '19', '20', '43', '48', '59', '62'].map(total),
      [1, 1, 2, 1, 1, 3, 3, 1, 1, 1],
    );
    assert.equal(rowOf(body, '19').values.female, 0);
    assert.equal(total('38'), 0);
  });
});

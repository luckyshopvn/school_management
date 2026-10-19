import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import {
  BUDGET_ROWS,
  buildBieu01,
  contractOf,
  rankOf,
  type Bieu01Child,
  type Bieu01Input,
  type Bieu01Staff,
} from './emis-01-calc.js';
import type { EmisFormRow } from './emis-form-calc.js';
import {
  buildEndOfYear,
  buildHcmFacilities,
  buildStaffForms,
  fillForeignLanguage,
  frameworkStepOf,
  type EndOfYearStaff,
  type StaffReportPerson,
} from './emis-so-calc.js';

// EMIS theo đúng chỉ tiêu, mã số, cột của Sở (DT-17 phần 17a, YCTD-132; khảo sát mục 10.4): Biểu 01.ĐN-MN năm thẻ mã 01 đến
// 217, Biểu 08.ĐN-NSNN mã 1 đến 71, 1.2.1 thẻ 1 mã 01 đến 84 có cột Xây dựng mới, 2.1, 2.2, 2.3 theo cấu trúc của Sở, trang
// 1.1.2 Gửi báo cáo đầu năm hai lưới, Xóa dữ liệu. Dữ liệu kiểm thử là dữ liệu giả
const codesOf = (rows: EmisFormRow[]) => rows.filter((row) => !row.heading).map((row) => row.code);
const valueOf = (rows: EmisFormRow[], code: string, column = 'total') =>
  rows.find((row) => row.code === code)?.values[column];
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

const child = (values: Partial<Bieu01Child>): Bieu01Child => ({
  gender: 'female',
  ethnicity: null,
  birth_year: 2021,
  class_id: null,
  disabled: false,
  two_sessions_per_day: false,
  boarding: false,
  policy_benefits: [],
  nutrition: null,
  ...values,
});

const person = (values: Partial<StaffReportPerson>): StaffReportPerson => ({
  gender: 'female',
  ethnicity: null,
  birth_year: 1990,
  category: 'teacher',
  job_title: null,
  job_position: null,
  teaching_group: null,
  qualification: null,
  rank: null,
  contract_form: null,
  concurrent_disability_support: false,
  concurrent_shared_position: false,
  civil_servant_evaluation: null,
  excellent_teacher: null,
  language_framework_level: null,
  language_training_level: null,
  language_certificate_type: null,
  main_foreign_language: null,
  it_level: null,
  ...values,
});

describe('Hàm thuần của phần 17a', () => {
  const input: Bieu01Input = {
    school: {
      ownership: 'public',
      institution_type: 'truong_mam_non',
      other_info: { grid_electricity: true, has_internet: true, handwashing: false, sex_education: true },
      national_standard_level: '2',
      branches: 1,
      sites: 2,
    },
    startYear: 2026,
    classes: [
      {
        id: 'n1',
        stage: 'nursery',
        age_group: 'months_25_36',
        mixed_age_count: null,
        room_id: 'r1',
        two_sessions_per_day: true,
        boarding: true,
      },
      {
        id: 'k1',
        stage: 'kindergarten',
        age_group: 'years_5_6',
        mixed_age_count: null,
        room_id: 'r2',
        two_sessions_per_day: false,
        boarding: false,
      },
      {
        id: 'k2',
        stage: 'kindergarten',
        age_group: null,
        mixed_age_count: 2,
        room_id: null,
        two_sessions_per_day: false,
        boarding: false,
      },
    ],
    children: [
      child({ birth_year: 2024, class_id: 'n1', ethnicity: 'Tày', disabled: true }),
      child({ birth_year: 2021, class_id: 'k1', gender: 'male', policy_benefits: ['nd105_lunch'] }),
      child({
        birth_year: 2021,
        class_id: 'k1',
        disabled: true,
        nutrition: { weight_status: 'underweight', height_status: 'stunted', weight_height_status: 'normal' },
      }),
      child({
        birth_year: 2022,
        class_id: 'k2',
        nutrition: { weight_status: 'normal', height_status: 'normal', weight_height_status: 'obese' },
      }),
    ],
    staff: [
      {
        ...person({
          category: 'manager',
          job_title: 'Hiệu trưởng',
          qualification: 'Thạc sĩ',
          contract_form: 'Viên chức không xác định thời hạn',
        }),
      },
      {
        ...person({
          category: 'manager',
          job_title: 'Phó hiệu trưởng',
          qualification: 'Đại học',
          contract_form: 'Viên chức có thời hạn',
        }),
      },
      {
        ...person({
          job_position: 'Giáo viên nhà trẻ',
          qualification: 'Cao đẳng',
          rank: 'Hạng III',
          birth_year: 1997,
          ethnicity: 'Khmer',
          concurrent_disability_support: true,
        }),
      },
      {
        ...person({
          job_position: 'Giáo viên mẫu giáo',
          qualification: 'Chưa qua đào tạo',
          birth_year: 1964,
          contract_form: 'Hợp đồng lao động trên 1 năm',
        }),
      },
      { ...person({ category: 'employee', job_position: 'Kế toán', concurrent_shared_position: true }) },
      { ...person({ category: 'employee', job_position: 'Cấp dưỡng', gender: 'male' }) },
    ] as Bieu01Staff[],
    rooms: [
      { id: 'r1', room_type: 'group_room', condition: 'permanent', attributes: { has_private_playground: true } },
      { id: 'r2', room_type: 'group_room', condition: 'borrowed', attributes: {} },
      { id: 'r3', room_type: 'multi_purpose', condition: 'semi_permanent', attributes: {} },
      { id: 'r4', room_type: 'kitchen', condition: 'temporary', attributes: {} },
    ],
  };

  it('CT-17a-1: Biểu 01.ĐN-MN đủ mã 01 đến 217 liên tục qua bốn thẻ; cột từng thẻ; tiêu chí trường, nhóm lớp, trẻ, dinh dưỡng, chính sách', () => {
    const result = buildBieu01(input);
    const codes = [
      ...codesOf(result.school_classes),
      ...codesOf(result.children),
      ...codesOf(result.staff),
      ...codesOf(result.rooms),
    ].map(Number);
    assert.deepEqual(
      codes,
      Array.from({ length: 217 }, (_, index) => index + 1),
    );
    // Thẻ 1: trường mầm non công lập, tiêu chí theo hồ sơ trường, chuẩn quốc gia mức độ 2
    assert.deepEqual(result.school_classes.find((row) => row.code === '21')?.values, {
      total: 1,
      public: 1,
      private: 0,
      people_founded: 0,
    });
    assert.equal(valueOf(result.school_classes, '09'), 0, 'không phải trường mẫu giáo');
    assert.equal(valueOf(result.school_classes, '23'), 1, 'chuẩn quốc gia mức độ 2');
    assert.equal(valueOf(result.school_classes, '25'), 1, 'có điện');
    assert.equal(valueOf(result.school_classes, '30'), 0, 'chưa có chỗ rửa tay');
    assert.deepEqual(
      ['38', '39', '40', '41', '44', '51', '54', '56'].map((code) => valueOf(result.school_classes, code)),
      [1, 2, 3, 1, 1, 2, 1, 1],
    );
    assert.equal(valueOf(result.school_classes, '49'), 1, 'nhóm trẻ có 01 trẻ khuyết tật');
    assert.equal(valueOf(result.school_classes, '60'), 1, 'lớp có 01 trẻ khuyết tật');
    // Thẻ 2: Tổng, Nữ của tổng số và của dân tộc thiểu số
    assert.deepEqual(result.children.find((row) => row.code === '62')?.values, {
      total: 4,
      female: 3,
      ethnic_total: 1,
      ethnic_female: 1,
    });
    assert.deepEqual(
      ['63', '64', '65', '66', '68', '71', '74'].map((code) => valueOf(result.children, code)),
      [1, 1, 1, 1, 3, 1, 2],
    );
    assert.equal(valueOf(result.children, '78'), 1, 'nhà trẻ 2 tuổi (25–36 tháng)');
    assert.equal(valueOf(result.children, '88'), 2, 'mẫu giáo 5 tuổi');
    assert.equal(valueOf(result.children, '98'), 2, 'tổng quy mô 5 tuổi');
    assert.deepEqual(
      ['107', '108', '109', '110', '111'].map((code) => valueOf(result.children, code)),
      [2, 1, 1, 0, 1],
    );
    assert.equal(valueOf(result.children, '115'), 1, 'hỗ trợ ăn trưa theo NĐ 105/2020');
    // Thẻ 3: bốn cột phân loại hợp đồng; trình độ, hạng, độ tuổi, kiêm nhiệm
    assert.deepEqual(result.staff.find((row) => row.code === '117')?.values, {
      total: 2,
      female: 2,
      ethnic: 0,
      civil_servant: 2,
      labor_contract: 0,
      indefinite_contract: 1,
      fixed_term_contract: 1,
    });
    assert.deepEqual(
      ['118', '127', '128', '129', '133', '132'].map((code) => valueOf(result.staff, code)),
      [0, 2, 1, 1, 1, 1],
    );
    assert.deepEqual(
      ['137', '139', '146', '147', '152'].map((code) => valueOf(result.staff, code)),
      [1, 1, 1, 1, 1],
    );
    assert.equal(valueOf(result.staff, '137', 'ethnic'), 1);
    assert.deepEqual(
      ['154', '160', '168', '154'].map((code, index) =>
        valueOf(result.staff, code, index === 3 ? 'labor_contract' : 'total'),
      ),
      [1, 1, 1, 1],
    );
    assert.deepEqual(
      ['175', '183', '185', '189', '190', '196', '197'].map((code) => valueOf(result.staff, code)),
      [1, 1, 1, 1, 1, 1, 1],
    );
    // Thẻ 4: phòng gắn lớp nhóm trẻ là nhà trẻ; phòng nhờ, mượn không vào cột hiện trạng
    assert.deepEqual(result.rooms.find((row) => row.code === '201')?.values, {
      total: 4,
      permanent: 1,
      semi_permanent: 1,
      temporary: 1,
    });
    assert.deepEqual(
      ['202', '208', '210', '211', '212', '215'].map((code) => valueOf(result.rooms, code)),
      [1, 1, 1, 1, 1, 1],
    );
    assert.ok(result.warnings.some((warning) => warning.includes('hình thức hợp đồng')));
  });

  it('CT-17a-2: Biểu 08.ĐN-NSNN mã 1 đến 71 không có mã 6; 1.2.1 thẻ 1 mã 01 đến 84, cột Xây dựng mới theo bảng ánh xạ', () => {
    const budget = BUDGET_ROWS.map((row) => Number(row.code));
    assert.deepEqual(
      budget,
      Array.from({ length: 71 }, (_, index) => index + 1).filter((code) => code !== 6),
    );
    assert.equal(BUDGET_ROWS.find((row) => row.code === '64')?.label.startsWith('Đào tạo lại'), true);
    const rows = buildHcmFacilities([
      { room_type: 'group_room', condition: 'permanent', built_this_year: true, nursery: true, attributes: {} },
      {
        room_type: 'group_room',
        condition: 'semi_permanent',
        built_this_year: true,
        nursery: false,
        attributes: { toilet: 'ensuite' },
      },
      { room_type: 'toilet', condition: 'permanent', built_this_year: false, nursery: false, attributes: {} },
      {
        room_type: 'toilet',
        condition: 'permanent',
        built_this_year: false,
        nursery: false,
        attributes: { toilet_users: 'staff' },
      },
      { room_type: 'parking', condition: 'temporary', built_this_year: false, nursery: false, attributes: {} },
    ]);
    assert.deepEqual(
      rows.map((row) => row.code),
      Array.from({ length: 84 }, (_, index) => String(index + 1).padStart(2, '0')),
    );
    assert.deepEqual(rows.find((row) => row.code === '01')?.values, {
      total: 3,
      permanent: 2,
      permanent_new: 1,
      semi_permanent: 1,
      semi_permanent_new: 1,
      temporary: 0,
    });
    assert.deepEqual(
      ['02', '04', '08', '10', '11'].map((code) => valueOf(rows, code)),
      [1, 1, 2, 1, 1],
    );
    // Khối D: khu vệ sinh giáo viên, học sinh; "trong đó bố trí trong lớp học" không cộng vào số phòng
    assert.deepEqual(
      ['50', '53', '54', '55'].map((code) => valueOf(rows, code)),
      [2, 1, 1, 1],
    );
    assert.deepEqual(
      ['81', '83'].map((code) => valueOf(rows, code, 'temporary')),
      [1, 1],
    );
  });

  it('CT-17a-3: 2.1 cuối năm theo mục của Sở; 2.2 ba biểu (hạng TT01, khung 6 bậc, tiêu chí 1–18, 1–15); 2.3 năm chỉ tiêu', () => {
    assert.deepEqual(rankOf('Hạng II (TT01)'), { level: 2, tt01: true });
    assert.deepEqual(rankOf('hạng IV'), { level: 4, tt01: false });
    assert.equal(rankOf(null), null);
    assert.equal(contractOf('Thỉnh giảng'), 'labor');
    assert.equal(frameworkStepOf('B2'), 4);
    assert.equal(frameworkStepOf('Bậc 6'), 6);
    const staff = (values: Partial<EndOfYearStaff>): EndOfYearStaff => ({
      ...person({}),
      active: true,
      start_date: '2015-08-01',
      end_date: null,
      staff_status: null,
      standard_level: null,
      ...values,
    });
    const rows = buildEndOfYear({
      institution_type: 'truong_mau_giao',
      sites: 1,
      nursery_classes: 0,
      kindergarten_classes: 3,
      children: [
        { nursery: false, five_to_six: true, nutrition: null },
        {
          nursery: false,
          five_to_six: false,
          nutrition: { weight_status: 'underweight', height_status: 'normal', weight_height_status: 'wasted' },
        },
      ],
      staff: [
        staff({ category: 'manager', job_title: 'Hiệu trưởng' }),
        staff({ job_position: 'Giáo viên mẫu giáo', standard_level: 'good' }),
        staff({ job_position: 'Giáo viên mẫu giáo', start_date: '2026-09-01' }),
        staff({
          job_position: 'Giáo viên mẫu giáo',
          active: false,
          end_date: '2026-12-31',
          staff_status: 'Đã nghỉ hưu',
        }),
        staff({ category: 'employee', gender: 'male' }),
      ],
      year: { from: '2026-09-01', to: '2027-05-31' },
    });
    assert.deepEqual(
      ['I.2', 'I.3', 'I.7', 'II.2', '3.1', '3.1.3', '3.2.2', '3.2.2.1', '3.2.2.3'].map((code) => valueOf(rows, code)),
      [1, 0, 1, 3, 2, 1, 1, 1, 1],
    );
    assert.deepEqual(
      ['4.1.1.2', '4.2.2', '4.2.2.2', '4.3.3', '4.3.4', '4.4.3', '4.5.3', '4.5.4'].map((code) => valueOf(rows, code)),
      [1, 2, 1, 1, 1, 1, 1, 0],
    );

    const forms = buildStaffForms({
      schools: 1,
      classes: 3,
      institution_type: 'truong_mam_non',
      startYear: 2026,
      staff: [
        person({ category: 'manager', job_title: 'Hiệu trưởng', rank: 'Hạng I (TT01)', birth_year: 1975 }),
        person({
          job_position: 'Giáo viên mẫu giáo',
          civil_servant_evaluation: 'Hoàn thành tốt nhiệm vụ',
          excellent_teacher: 'Cấp tỉnh',
          language_framework_level: 'B1',
          it_level: 'Chứng chỉ cơ bản',
        }),
      ],
      evaluations: [
        {
          standard_type: 'teacher',
          vice: false,
          overall_level: 'good',
          items: Array.from({ length: 15 }, (_, index) => ({
            order_no: index + 1,
            is_key: false,
            self_rating: 'excellent' as const,
            assessor_rating: index === 0 ? ('met' as const) : ('good' as const),
          })),
        },
      ],
    });
    assert.equal(valueOf(forms.general_managers, '3.1.HG.4'), 1, 'hạng I theo TT01');
    assert.equal(valueOf(forms.general_managers, '3.1.DT.6'), 1, 'tuổi 51–55');
    assert.equal(valueOf(forms.general_teachers, '3.DG.2'), 1, 'hoàn thành tốt nhiệm vụ');
    assert.equal(valueOf(forms.general_teachers, '3.GV.3'), 1, 'giáo viên dạy giỏi cấp tỉnh');
    assert.equal(valueOf(forms.skills_teachers, '1.NN.3'), 1);
    assert.equal(valueOf(forms.skills_teachers, '1.TH.5'), 1);
    assert.equal(codesOf(forms.standards_managers).filter((code) => code.startsWith('2.1.')).length, 19);
    assert.equal(codesOf(forms.standards_teachers).filter((code) => code.startsWith('2.2.')).length, 16);
    assert.equal(valueOf(forms.standards_teachers, '2.1.0', 'excellent'), 1, 'tự đánh giá xếp loại Tốt');
    assert.equal(valueOf(forms.standards_teachers, '2.2.0', 'good'), 1, 'cấp trên xếp loại Khá');
    assert.equal(valueOf(forms.standards_teachers, '2.2.1', 'met'), 1);

    assert.deepEqual(fillForeignLanguage({ english_familiarization: true, children: 40, kindergarten_children: 30 }), {
      '1': { total: 1 },
      '2': { total: 1 },
      '3': { total: 40 },
      '4': { total: 30 },
    });
    assert.equal(
      fillForeignLanguage({ english_familiarization: false, children: 40, kindergarten_children: 30 })['4']?.total,
      0,
    );
  });
});

describe('API báo cáo EMIS của phần 17a', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: string;
  let vice: string;
  let unitA = '';
  let childId = '';
  let staffId = '';
  let roomId = '';

  const api = async (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const download = async (path: string, token: string, body: unknown) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      disposition: response.headers.get('content-disposition') ?? '',
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  };
  type Tab = {
    key: string;
    locked: boolean;
    saved_at: string | null;
    rows: Array<{ code: string; values: Record<string, number | null> }>;
  };
  const valueIn = (body: Record<string, unknown>, tab: string, row: string, column = 'total') =>
    (body.tabs as Tab[]).find((item) => item.key === tab)?.rows.find((item) => item.code === row)?.values[column];

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await api('POST', '/org-units', principal, {
      code: 'TC',
      name: 'Trường mầm non Thử nghiệm',
      unit_type: 'truong_chinh',
    });
    unitA = (await api('POST', '/org-units', principal, { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' }))
      .body.id as string;
    vice = (await environment.loginAs('VT-15', null)).accessToken;
    const room = await api('POST', '/rooms', principal, {
      org_unit_id: unitA,
      code: 'P1',
      name: 'Phòng P1',
      capacity: 30,
      room_block: 'care_education',
      room_type: 'group_room',
      condition: 'permanent',
      area_m2: 60,
      facility_attributes: {},
    });
    assert.equal(room.status, 201, JSON.stringify(room.body));
    roomId = room.body.id as string;
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: 'Học sinh A',
          dob: '2021-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: '2026-09-07',
          moet_profile: JSON.stringify({ ethnicity: 'Kinh' }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    staffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitA,
          code: 'NS1',
          full_name: 'Nhân sự NS1',
          gender: 'female',
          start_date: '2020-08-01',
          status: 'active',
          moet_profile: JSON.stringify({ job_position: 'Giáo viên mẫu giáo', position_group: 'Giáo viên' }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-17a-4: ô mới của hồ sơ trẻ, nhân sự, phòng vào Biểu 01 và 1.2.1; Xóa dữ liệu xóa số đã ghi của thẻ', async () => {
    const childUpdate = await api('PATCH', `/children/${childId}`, principal, {
      policy_benefits: ['nd238_learning_cost', 'nd105_lunch'],
    });
    assert.equal(childUpdate.status, 200, JSON.stringify(childUpdate.body));
    assert.equal((await api('PATCH', `/children/${childId}`, principal, { policy_benefits: ['khac'] })).status, 400);
    // Nhân sự sửa hồ sơ nhân sự của đơn vị mình (VT-06)
    const personnel = (await environment.loginAs('VT-06', unitA)).accessToken;
    const staffUpdate = await api('PATCH', `/staff/${staffId}/profile`, personnel, {
      concurrent_disability_support: true,
      moet_profile: { contract_form: 'Viên chức có thời hạn' },
    });
    assert.equal(staffUpdate.status, 200, JSON.stringify(staffUpdate.body));
    const roomUpdate = await api('PATCH', `/rooms/${roomId}`, principal, { built_this_year: true });
    assert.equal(roomUpdate.status, 200, JSON.stringify(roomUpdate.body));
    assert.equal(roomUpdate.body.built_this_year, true);

    const start = await api('GET', '/reports/emis/forms/emis-start-of-year', vice);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    assert.equal(valueIn(start.body, 'children', '112'), 1);
    assert.equal(valueIn(start.body, 'children', '115'), 1);
    assert.equal(valueIn(start.body, 'staff', '169'), 1, 'giáo viên mẫu giáo kiêm nhiệm hỗ trợ người khuyết tật');
    assert.equal(valueIn(start.body, 'staff', '136', 'fixed_term_contract'), 1);
    assert.ok(
      (start.body.warnings as string[]).some((warning) => warning.includes('Cơ sở giáo dục mầm non')),
      'chưa chọn loại cơ sở trong hồ sơ trường',
    );
    const filled = await api('POST', '/reports/emis/forms/emis-facilities/tabs/facilities/fill', vice, {
      source: 'data',
    });
    assert.equal(filled.status, 200, JSON.stringify(filled.body));
    const rows = filled.body.rows as Array<{ code: string; values: Record<string, number | null> }>;
    assert.equal(rows.find((row) => row.code === '01')?.values.permanent_new, 1);

    const path = '/reports/emis/forms/emis-start-of-year/tabs/budget';
    const saved = await api('PUT', path, vice, { rows: [{ code: '2', values: { estimate: 100, expected: 90 } }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const cleared = await api('DELETE', path, vice);
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal(valueIn(cleared.body, 'budget', '2', 'estimate'), null);
    assert.equal((cleared.body.tabs as Tab[]).find((tab) => tab.key === 'budget')?.saved_at, null);
    assert.equal((await api('DELETE', '/reports/emis/forms/emis-start-of-year/tabs/children', vice)).status, 422);
  });

  it('CT-17a-5: 1.1.2 lưới hồ sơ và lưới biểu mẫu; Gửi hồ sơ lập tệp, đánh dấu đã gửi; Xuất file lỗi; Đặt trạng thái gửi lại', async () => {
    const overview = await api('GET', '/reports/emis/start-of-year/sending', vice);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    const records = overview.body.records as Array<{
      record_type: string;
      total: number;
      sent: number;
      to_send: number;
    }>;
    assert.deepEqual(
      records.map((row) => row.record_type),
      ['school', 'staff', 'class', 'child', 'health_first_term'],
    );
    assert.deepEqual(
      records.find((row) => row.record_type === 'child'),
      { ...records.find((row) => row.record_type === 'child'), total: 1, sent: 0, to_send: 1 },
    );
    const formsList = overview.body.forms as Array<{ form_code: string; completion: string; completion_label: string }>;
    assert.deepEqual(
      formsList.map((row) => row.form_code),
      ['emis-01-school-classes', 'emis-01-children', 'emis-01-staff', 'emis-01-rooms', 'emis-08-budget'],
    );
    assert.equal(formsList.find((row) => row.form_code === 'emis-08-budget')?.completion_label, 'Không có dữ liệu');

    const errors = await download('/reports/emis/start-of-year/error-file', vice, {
      records: ['child', 'staff'],
      forms: ['emis-01-school-classes'],
    });
    assert.equal(errors.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(errors.buffer as unknown as ArrayBuffer);
    const problems: string[] = [];
    book.worksheets[0]?.eachRow((row) => problems.push(String(row.getCell(5).value ?? '')));
    assert.ok(problems.includes('Chưa có mã học sinh của Bộ'));
    assert.ok(problems.includes('Chưa có mã định danh Bộ GD&ĐT'));
    assert.ok(problems.includes('Đã khai báo loại hình trường trong hồ sơ trường'));

    const incomplete = await api('POST', '/reports/emis/start-of-year/send', vice, {
      forms: ['emis-01-school-classes'],
    });
    assert.equal(incomplete.status, 422);
    assert.equal(errorOf(incomplete.body).rule_code, 'YCTD-132');
    assert.equal((await api('POST', '/reports/emis/start-of-year/send', vice, {})).status, 400);
    assert.equal((await api('POST', '/reports/emis/start-of-year/send', vice, { records: ['khac'] })).status, 400);

    const sent = await download('/reports/emis/start-of-year/send', vice, {
      records: ['child'],
      forms: ['emis-08-budget'],
    });
    assert.equal(sent.status, 200, sent.buffer.toString());
    assert.match(sent.disposition, /gui-bao-cao-dau-nam-/);
    const after = await api('GET', '/reports/emis/start-of-year/sending', vice);
    const childRow = (after.body.records as typeof records).find((row) => row.record_type === 'child');
    assert.equal(childRow?.sent, 1);
    assert.equal(childRow?.to_send, 0);
    const budget = (after.body.forms as Array<{ form_code: string; status: string; no_data: boolean }>).find(
      (row) => row.form_code === 'emis-08-budget',
    );
    assert.equal(budget?.status, 'sent');
    assert.equal(budget?.no_data, true);
    // Thẻ Biểu 08 đã gửi khóa ô nhập, thẻ khác của 1.1 không liên quan
    const view = await api('GET', '/reports/emis/forms/emis-start-of-year', vice);
    assert.equal((view.body.tabs as Tab[]).find((tab) => tab.key === 'budget')?.locked, true);
    const locked = await api('PUT', '/reports/emis/forms/emis-start-of-year/tabs/budget', vice, {
      rows: [{ code: '1', values: { estimate: 1 } }],
    });
    assert.equal(locked.status, 422);
    const again = await api('POST', '/reports/emis/start-of-year/send', vice, { forms: ['emis-08-budget'] });
    assert.equal(again.status, 422, 'biểu mẫu đã gửi phải đặt trạng thái gửi lại trước');

    assert.equal(
      (await api('POST', '/reports/emis/start-of-year/resend', vice, { records: ['child'], forms: [] })).status,
      403,
    );
    const reset = await api('POST', '/reports/emis/start-of-year/resend', principal, {
      records: ['child'],
      forms: ['emis-08-budget'],
      note: 'Bổ sung',
    });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal((reset.body.records as typeof records).find((row) => row.record_type === 'child')?.sent, 0);
    assert.equal(
      (reset.body.forms as Array<{ form_code: string; status: string }>).find(
        (row) => row.form_code === 'emis-08-budget',
      )?.status,
      'resend',
    );
  });
});

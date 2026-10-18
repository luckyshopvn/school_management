import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { EMIS_FORMS } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import type { EquipmentReport } from '../facilities/equipment-report-calc.js';
import {
  buildEducationResults,
  buildEndOfYearChildren,
  buildStaffReport,
  fillEquipment,
  fillFacilities,
  fillFacilityInfo,
  fillOtherFacilities,
  fillToilets,
  frameworkLevelAtLeast3,
  qualificationLevel,
  recode,
  type StaffReportMember,
} from './emis-form-calc.js';

// Báo cáo số liệu EMIS đủ bảy biểu theo hệ thống của Sở (DT-16 phần 16j): thẻ tính từ dữ liệu, thẻ nhập tay (Lấy dữ liệu,
// Lấy dữ liệu năm trước, Ghi), khóa khi đã đánh dấu đã gửi, xuất Excel, xuất file lỗi. Dữ liệu kiểm thử là dữ liệu giả
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const member = (values: Partial<StaffReportMember>): StaffReportMember => ({
  gender: 'female',
  ethnicity: null,
  position_group: null,
  job_title: null,
  party_member: false,
  qualification: null,
  main_foreign_language: null,
  language_certificate_type: null,
  language_framework_level: null,
  language_training_level: null,
  it_level: null,
  ...values,
});

describe('Hàm thuần của phần 16j', () => {
  it('CT-16j-1: 1.2 Lấy dữ liệu: cơ sở vật chất theo khối, loại phòng, hiện trạng; nhà vệ sinh; cơ sở vật chất khác; thông tin khác', () => {
    const rooms = [
      {
        room_type: 'group_room',
        condition: 'permanent',
        area_m2: 60,
        attributes: { toilet: 'ensuite', sleeping_places: 20 },
      },
      { room_type: 'group_room', condition: 'semi_permanent', area_m2: 50, attributes: { toilet: 'adjacent' } },
      { room_type: 'group_room', condition: null, area_m2: null, attributes: { has_private_playground: true } },
      { room_type: 'toilet', condition: 'permanent', area_m2: 12.5, attributes: {} },
      { room_type: 'kitchen', condition: 'temporary', area_m2: 30, attributes: { dining_seats: '40' } },
    ];
    const facilities = fillFacilities(rooms);
    assert.deepEqual(facilities['CS.00'], {
      total: 5,
      permanent: 2,
      semi_permanent: 1,
      temporary: 1,
      borrowed: 0,
      area_m2: 152.5,
    });
    // Khối 1 (nuôi dưỡng, chăm sóc, giáo dục): ba phòng sinh hoạt chung và một phòng vệ sinh
    assert.equal(facilities['CS.1']?.total, 4);
    assert.equal(facilities['CS.1.01']?.total, 3);
    assert.equal(facilities['CS.2']?.total, 1, 'khối phòng tổ chức ăn');
    const toilets = fillToilets(rooms);
    assert.equal(toilets['VS.01']?.area_m2, 12.5);
    assert.deepEqual(
      ['VS.02', 'VS.03', 'VS.04'].map((code) => toilets[code]?.total),
      [1, 1, 1],
    );
    assert.equal(toilets['VS.05'], undefined, 'nhà vệ sinh giáo viên nhập tay');
    const other = fillOtherFacilities(rooms, { land_area_m2: 1200, building_area_m2: '450' });
    assert.deepEqual(
      ['KH.01', 'KH.02', 'KH.03', 'KH.06', 'KH.07'].map((code) => other[code]?.total),
      [1200, 450, 1, 20, 40],
    );
    const info = fillFacilityInfo({ grid_electricity: true, clean_water: false }, { management_computers: 3 });
    assert.deepEqual(
      ['TT.01', 'TT.02', 'TT.03', 'TT.07'].map((code) => info[code]?.total),
      [1, 0, null, 3],
    );
  });

  it('CT-16j-2: 1.2 thẻ thiết bị dạy học theo nhóm tuổi; 2.2 trình độ, ngoại ngữ, tin học, chuẩn nghề nghiệp; 2.1 học sinh cuối năm', () => {
    const report = {
      rows: [
        { age_group: 'mg_5_6', is_minimum: true, shortage: 0 },
        { age_group: 'mg_5_6', is_minimum: true, shortage: 2 },
        { age_group: 'mg_4_5', is_minimum: false, shortage: null },
      ],
      classes: [
        { age_group: 'mg_5_6', norm: 10, covered: 10, rate_percent: 100 },
        { age_group: 'mg_5_6', norm: 10, covered: 5, rate_percent: 50 },
      ],
    } as unknown as EquipmentReport;
    const equipment = fillEquipment(report);
    assert.deepEqual(equipment['TB.06'], { classes: 2, equipped_classes: 1, items: 2, met_items: 1, rate_percent: 75 });
    assert.equal(equipment['TB.00']?.classes, 2);
    assert.equal(equipment['TB.01']?.rate_percent, null);

    assert.equal(qualificationLevel('Thạc sĩ'), 'postgraduate');
    assert.equal(qualificationLevel('Đại học sư phạm mầm non'), 'university');
    assert.equal(qualificationLevel('Cao đẳng'), 'college');
    assert.equal(qualificationLevel(null), 'other_qualification');
    assert.equal(frameworkLevelAtLeast3(member({ language_framework_level: 'Bậc 3' })), true);
    assert.equal(frameworkLevelAtLeast3(member({ language_framework_level: 'B2' })), true);
    assert.equal(frameworkLevelAtLeast3(member({ language_framework_level: 'Bậc 2' })), false);
    const staff = buildStaffReport(
      'public',
      [
        member({ job_title: 'Hiệu trưởng', qualification: 'Thạc sĩ', party_member: true, it_level: 'Nâng cao' }),
        member({
          position_group: 'Giáo viên',
          qualification: 'Đại học',
          ethnicity: 'Khmer',
          main_foreign_language: 'Tiếng Anh',
          language_framework_level: 'Bậc 3',
          it_level: 'Cơ bản',
        }),
        member({ gender: 'male', job_title: 'Bảo vệ', language_certificate_type: 'Không', it_level: 'Không' }),
      ],
      [
        { standard_type: 'teacher', overall_level: 'good' },
        { standard_type: 'teacher', overall_level: null },
        { standard_type: 'principal', overall_level: 'excellent' },
      ],
    );
    assert.deepEqual(staff.general[0]?.values, {
      total: 3,
      female: 2,
      ethnic_minority: 1,
      party_member: 1,
      postgraduate: 1,
      university: 1,
      college: 0,
      intermediate: 0,
      other_qualification: 1,
    });
    assert.deepEqual(staff.skills[0]?.values, {
      total: 3,
      foreign_language: 1,
      english: 1,
      framework_level_3: 1,
      it: 2,
      it_advanced: 1,
    });
    assert.deepEqual(staff.standards[1]?.values, { evaluated: 1, not_met: 0, met: 0, good: 1, excellent: 0 });
    assert.equal(staff.standards[0]?.values.excellent, 1);

    const child = (status: string, values: Record<string, unknown> = {}) => ({
      gender: 'female' as const,
      ethnicity: null,
      status,
      nursery: false,
      disabled: false,
      five_to_six: false,
      completion: null,
      ...values,
    });
    const children = [
      child('active', { nursery: true }),
      child('active', { five_to_six: true, completion: 'completed' }),
      child('active', { five_to_six: true }),
      child('withdrawn', { five_to_six: true, completion: 'completed' }),
    ];
    const rows = buildEndOfYearChildren('private', children, [{ gender: 'male', ethnicity: 'Tày' }], []);
    const total = (code: string) => rows.find((row) => row.code === code)?.values.total;
    assert.deepEqual(['II.01', 'II.02', 'II.03', 'II.05', 'II.06', 'II.07'].map(total), [3, 1, 2, 1, 0, 1]);
    assert.equal(rows[0]?.values.private, 3);
    assert.equal(rows[4]?.values.ethnic_minority, 1);
    const results = buildEducationResults(null, children);
    assert.deepEqual(
      results.map((row) => row.values.total),
      [2, 1, 0, 1],
    );
    assert.equal(results[0]?.values.public, null);
    assert.deepEqual(
      recode(results, 'IV').map((row) => row.code),
      ['IV.01', 'IV.02', 'IV.03', 'IV.04'],
    );
  });
});

describe('API báo cáo EMIS của phần 16j', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: string;
  let vice: string;
  let manager: string;
  let unitA = '';

  const api = async (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const download = async (method: string, path: string, token: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
    });
    return {
      status: response.status,
      disposition: response.headers.get('content-disposition') ?? '',
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  };
  const sheetsOf = async (buffer: Buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return workbook;
  };
  type Tab = {
    key: string;
    editable: boolean;
    saved_at: string | null;
    rows: Array<{ code: string; values: Record<string, number | null> }>;
  };
  const tabOf = (body: Record<string, unknown>, key: string) => (body.tabs as Tab[]).find((tab) => tab.key === key);
  const valueOf = (body: Record<string, unknown>, tab: string, row: string, column = 'total') =>
    tabOf(body, tab)?.rows.find((item) => item.code === row)?.values[column];

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
    manager = (await environment.loginAs('VT-03', unitA)).accessToken;

    for (const [code, type, condition, area, attributes] of [
      ['P1', 'group_room', 'permanent', 60, { toilet: 'ensuite' }],
      ['P2', 'group_room', 'semi_permanent', 55, { toilet: 'adjacent' }],
      ['P3', 'toilet', 'permanent', 12, {}],
    ] as const) {
      const room = await api('POST', '/rooms', principal, {
        org_unit_id: unitA,
        code,
        name: `Phòng ${code}`,
        capacity: 30,
        room_block: type === 'toilet' || type === 'group_room' ? 'care_education' : 'support',
        room_type: type,
        condition,
        area_m2: area,
        facility_attributes: attributes,
      });
      assert.equal(room.status, 201, JSON.stringify(room.body));
    }
    for (const [key, gender, status, profile] of [
      ['A', 'female', 'active', { ethnicity: 'Kinh' }],
      ['B', 'male', 'active', { ethnicity: 'Tày' }],
      ['C', 'female', 'withdrawn', { ethnicity: 'Kinh' }],
    ] as const) {
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Học sinh ${key}`,
          dob: '2021-03-01',
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status,
          enroll_date: '2026-09-07',
          moet_profile: JSON.stringify(profile),
        })
        .execute();
    }
    for (const [code, gender, profile] of [
      [
        'NS1',
        'female',
        { position_group: 'Cán bộ quản lý', professional_qualification: 'Thạc sĩ', it_level: 'Nâng cao' },
      ],
      [
        'NS2',
        'female',
        { position_group: 'Giáo viên', main_foreign_language: 'Tiếng Anh', language_framework_level: 'B1' },
      ],
      ['NS3', 'male', { position_group: 'Nhân viên', professional_qualification: 'Trung cấp' }],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitA,
          code,
          full_name: `Nhân sự ${code}`,
          gender,
          start_date: '2020-08-01',
          status: 'active',
          moet_profile: JSON.stringify(profile),
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-16j-3: xem đủ bảy biểu cho toàn trường; người không có phạm vi toàn trường, biểu không có bị từ chối', async () => {
    for (const form of EMIS_FORMS) {
      const view = await api('GET', `/reports/emis/forms/${form.code}`, vice);
      assert.equal(view.status, 200, `${form.code}: ${JSON.stringify(view.body)}`);
      assert.equal(view.body.menu, form.menu);
      assert.equal(view.body.locked, false);
      assert.ok((view.body.tabs as Tab[]).length > 0);
    }
    const start = await api('GET', '/reports/emis/forms/emis-start-of-year', vice);
    assert.deepEqual(
      (start.body.tabs as Array<{ label: string }>).map((tab) => tab.label),
      ['Trường – lớp học', 'Học sinh', 'Học sinh theo độ tuổi', 'Đội ngũ', 'Phòng học', 'Ngân sách nhà nước'],
    );
    assert.equal(valueOf(start.body, 'children', '2.01'), 2);
    const health = await api('GET', '/reports/emis/forms/emis-start-of-year-health', vice);
    const healthColumns = (health.body.tabs as Array<{ columns: Array<{ label: string }> }>)[0]?.columns;
    assert.deepEqual(
      healthColumns?.map((column) => column.label),
      ['Tổng số học sinh', 'Công lập', 'Tư thục', 'Dân lập', 'Nữ', 'Dân tộc'],
    );
    assert.equal(valueOf(health.body, 'health', '1.3.01'), 2);
    const endOfYear = await api('GET', '/reports/emis/forms/emis-end-of-year', vice);
    assert.deepEqual(
      (endOfYear.body.tabs as Array<{ label: string }>).map((tab) => tab.label.split('.')[0]),
      ['I', 'II', 'III', 'IV', 'V', 'VI'],
    );
    assert.equal(valueOf(endOfYear.body, 'children', 'II.07'), 1, 'học sinh thôi học trong năm');
    const staff = await api('GET', '/reports/emis/forms/emis-staff', vice);
    assert.equal(valueOf(staff.body, 'general', 'DN.01', 'postgraduate'), 1);
    assert.equal(valueOf(staff.body, 'skills', 'NN.03', 'framework_level_3'), 1);
    assert.ok((staff.body.warnings as string[]).some((warning) => warning.includes('chuẩn nghề nghiệp')));
    assert.equal((await api('GET', '/reports/emis/forms/emis-staff', manager)).status, 403);
    assert.equal((await api('GET', '/reports/emis/forms/emis-unknown', vice)).status, 404);
  });

  it('CT-16j-4: thẻ Ngân sách nhà nước nhập tay: ghi, đọc lại; số âm, chỉ tiêu, cột lạ, thẻ tính từ dữ liệu bị từ chối', async () => {
    const path = '/reports/emis/forms/emis-start-of-year/tabs/budget';
    const saved = await api('PUT', path, vice, {
      rows: [
        { code: '6.01', values: { last_year_settlement: 1500.5, this_year_estimate: 1600, this_year_expected: null } },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(valueOf(saved.body, 'budget', '6.01', 'last_year_settlement'), 1500.5);
    assert.equal(valueOf(saved.body, 'budget', '6.01', 'this_year_expected'), null);
    assert.ok(tabOf(saved.body, 'budget')?.saved_at);
    assert.equal(
      (await api('PUT', path, vice, { rows: [{ code: '6.01', values: { this_year_estimate: -1 } }] })).status,
      400,
    );
    assert.equal((await api('PUT', path, vice, { rows: [{ code: '9.99', values: {} }] })).status, 400);
    assert.equal((await api('PUT', path, vice, { rows: [{ code: '6.01', values: { total: 1 } }] })).status, 400);
    assert.equal((await api('PUT', path, vice, { rows: 'x' })).status, 400);
    const computed = await api('PUT', '/reports/emis/forms/emis-start-of-year/tabs/children', vice, { rows: [] });
    assert.equal(computed.status, 422);
    assert.equal(errorOf(computed.body).rule_code, 'YCTD-129');
    const noFill = await api('POST', `${path}/fill`, vice, { source: 'data' });
    assert.equal(noFill.status, 422);
    assert.equal((await api('POST', `${path}/fill`, vice, { source: 'x' })).status, 400);
    const exported = await download('POST', '/reports/emis/forms/emis-start-of-year/export', vice);
    assert.equal(exported.status, 200);
    assert.match(exported.disposition, /emis-dau-nam-/);
    const workbook = await sheetsOf(exported.buffer);
    assert.equal(workbook.worksheets.length, 6);
    assert.equal(workbook.worksheets[5]?.name, 'Ngân sách nhà nước');
  });

  it('CT-16j-5: 1.2 Lấy dữ liệu chỉ điền, Ghi mới lưu; hoàn thành dữ liệu theo năm thẻ; xuất file lỗi', async () => {
    const base = '/reports/emis/forms/emis-facilities';
    const filled = await api('POST', `${base}/tabs/toilets/fill`, vice, { source: 'data' });
    assert.equal(filled.status, 200, JSON.stringify(filled.body));
    const rows = filled.body.rows as Array<{ code: string; values: Record<string, number | null> }>;
    assert.equal(rows.find((row) => row.code === 'VS.01')?.values.total, 1);
    assert.equal(rows.find((row) => row.code === 'VS.02')?.values.total, 1);
    assert.equal(rows.find((row) => row.code === 'VS.05')?.values.total, null);
    const before = await api('GET', base, vice);
    assert.equal(tabOf(before.body, 'toilets')?.saved_at, null, 'Lấy dữ liệu chưa lưu');
    const noPrevious = await api('POST', `${base}/tabs/toilets/fill`, vice, { source: 'previous_year' });
    assert.equal(noPrevious.status, 422);
    assert.match(String((noPrevious.body.error as { message: string }).message), /năm học trước/);

    const errors = await download('POST', '/upper-level-submissions/emis-facilities/error-file', vice);
    assert.equal(errors.status, 200);
    const errorBook = await sheetsOf(errors.buffer);
    const texts: string[] = [];
    errorBook.worksheets[0]?.eachRow((row) => texts.push(String(row.getCell(2).value ?? '')));
    assert.ok(texts.includes('Đã ghi thẻ Nhà vệ sinh'));

    for (const tab of ['facilities', 'toilets', 'other', 'equipment', 'info']) {
      const data = await api('POST', `${base}/tabs/${tab}/fill`, vice, { source: 'data' });
      assert.equal(data.status, 200, `${tab}: ${JSON.stringify(data.body)}`);
      const saved = await api('PUT', `${base}/tabs/${tab}`, vice, { rows: data.body.rows });
      assert.equal(saved.status, 200, `${tab}: ${JSON.stringify(saved.body)}`);
    }
    const listed = await api('GET', '/upper-level-submissions?forms=emis-facilities', vice);
    const item = (listed.body.items as Array<{ data_complete: boolean }>)[0];
    assert.equal(item?.data_complete, true);
    const view = await api('GET', base, vice);
    assert.equal(valueOf(view.body, 'facilities', 'CS.00'), 3);
    assert.equal(valueOf(view.body, 'facilities', 'CS.00', 'area_m2'), 127);
  });

  it('CT-16j-6: biểu đã đánh dấu đã gửi khóa việc ghi, lấy dữ liệu; đề án ngoại ngữ đánh dấu trường không có dữ liệu; mở khóa thì ghi lại được', async () => {
    const form = 'emis-foreign-language';
    const sent = await api('POST', `/upper-level-submissions/${form}/mark-sent`, vice, {
      sent_on: vietnamToday,
      no_data: true,
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const view = await api('GET', `/reports/emis/forms/${form}`, vice);
    assert.equal(view.body.locked, true);
    const locked = await api('PUT', `/reports/emis/forms/${form}/tabs/children`, vice, {
      rows: [{ code: 'NN.03', values: { children: 20 } }],
    });
    assert.equal(locked.status, 422);
    assert.equal(errorOf(locked.body).rule_code, 'YCTD-129');
    assert.equal(
      (await api('POST', `/reports/emis/forms/${form}/tabs/children/fill`, vice, { source: 'previous_year' })).status,
      422,
    );
    const resend = await api('POST', `/upper-level-submissions/${form}/resend`, principal, {
      note: 'Có lớp tiếng Anh',
    });
    assert.equal(resend.status, 200, JSON.stringify(resend.body));
    const saved = await api('PUT', `/reports/emis/forms/${form}/tabs/children`, vice, {
      rows: [{ code: 'NN.03', values: { classes: 2, children: 20, female: 11, periods_per_week: 2 } }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(valueOf(saved.body, 'children', 'NN.03', 'children'), 20);
    // Xuất tệp gửi lưu bản chụp số liệu của biểu
    const exported = await api('POST', `/upper-level-submissions/${form}/export`, vice);
    assert.equal(exported.status, 200, JSON.stringify(exported.body));
    assert.equal(exported.body.exported_data_complete, true);
    const file = await download('GET', `/upper-level-submissions/${form}/file`, vice);
    assert.match(file.disposition, /emis-de-an-ngoai-ngu-/);
  });

  it('CT-16j-7: Lấy dữ liệu năm trước điền số đã ghi của năm học liền trước', async () => {
    const created = await api('POST', '/academic-years', principal, { name: '2027–2028' });
    const nextYear = created.body.id as string;
    await api('PUT', `/academic-years/${nextYear}/calendar`, principal, {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-25' },
    });
    const opened = await api('POST', `/academic-years/${nextYear}/open`, principal);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const copied = await api('POST', '/reports/emis/forms/emis-foreign-language/tabs/children/fill', vice, {
      source: 'previous_year',
    });
    assert.equal(copied.status, 200, JSON.stringify(copied.body));
    assert.equal(copied.body.source_name, 'năm học 2026–2027');
    const rows = copied.body.rows as Array<{ code: string; values: Record<string, number | null> }>;
    assert.equal(rows.find((row) => row.code === 'NN.03')?.values.children, 20);
    const view = await api('GET', '/reports/emis/forms/emis-foreign-language', vice);
    assert.equal(tabOf(view.body, 'children')?.saved_at, null, 'năm học mới chưa ghi');
  });
});

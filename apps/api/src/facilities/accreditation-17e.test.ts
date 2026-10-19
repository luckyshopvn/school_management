import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { areaPerChild, readAccreditationInput } from './accreditation-review.js';

// DT-17 phần 17e (YCTD-136): 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở (khảo sát mục 10.5, chênh lệch R1–R5) và các
// ô chuẩn quốc gia, kiểm định, diện tích sàn xây dựng ở thẻ Thông tin chung của hồ sơ trường. Kịch bản CT-17e-1 đến CT-17e-6
const errorFields = (body: Record<string, unknown>) =>
  (((body.error ?? {}) as { details?: Array<{ field: string }> }).details ?? []).map((detail) => detail.field);

const VALID = {
  school_name: 'Trường Mầm non Kiểm Thử',
  school_code: '79000001',
  ownership_type: 'public',
};

describe('1.7 Rà soát kiểm định CLGD đủ ô như Sở (DT-17 phần 17e)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, {
        code,
        name: `Đơn vị ${code}`,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[code] = created.body.id as string;
    }
  });

  after(async () => {
    await environment.close();
  });

  it('CT-17e-1: Diện tích trên học sinh làm tròn hai chữ số, thiếu diện tích hoặc chưa có học sinh thì trống', () => {
    assert.equal(areaPerChild(1000, 3), 333.33);
    assert.equal(areaPerChild(185.5, 80), 2.32);
    assert.equal(areaPerChild(null, 80), null);
    assert.equal(areaPerChild(1000, 0), null);
    assert.equal(areaPerChild(1000, null), null);
  });

  it('CT-17e-2: Kiểm tra dữ liệu Ghi: tên, mã, loại hình bắt buộc; độ dài như Sở; ghi chú tối đa 500 ký tự', () => {
    const missing: Array<{ field: string; message: string }> = [];
    readAccreditationInput({}, missing);
    assert.deepEqual(
      missing.map((error) => error.field),
      ['school_name', 'school_code', 'ownership_type'],
    );
    const invalid: Array<{ field: string; message: string }> = [];
    readAccreditationInput(
      {
        school_name: 'T'.repeat(201),
        school_code: '1'.repeat(21),
        ownership_type: 'khac',
        national_standard_level: '3',
        accreditation_level: '5',
        national_standard_year: 1899,
        accreditation_year: 2024.5,
        national_standard_date: '20-11-2024',
        floor_area_per_child_m2: -1,
        note: 'a'.repeat(501),
      },
      invalid,
    );
    assert.deepEqual(invalid.map((error) => error.field).sort(), [
      'accreditation_level',
      'accreditation_year',
      'floor_area_per_child_m2',
      'national_standard_date',
      'national_standard_level',
      'national_standard_year',
      'note',
      'ownership_type',
      'school_code',
      'school_name',
    ]);
    const valid: Array<{ field: string; message: string }> = [];
    const input = readAccreditationInput(
      { ...VALID, school_name: ` ${'T'.repeat(200)} `, school_code: '1'.repeat(20), note: 'a'.repeat(500) },
      valid,
    );
    assert.deepEqual(valid, []);
    assert.equal(input.school_name, 'T'.repeat(200));
    assert.equal(input.note?.length, 500);
  });

  it('CT-17e-3: Hồ sơ trường nhận các ô chuẩn quốc gia, kiểm định CLGD, diện tích sàn xây dựng; từ chối giá trị sai', async () => {
    const general = {
      moet_code: '79000123',
      ownership_type: 'private',
      land_area_m2: 1200,
      floor_area_m2: 950.5,
      national_standard_level: '2',
      national_standard_year: 2023,
      national_standard_date: '2023-05-20',
      national_standard_registration: 'Năm học 2027–2028',
      accreditation_level: '3',
      accreditation_year: 2024,
      accreditation_date: '2024-11-15',
    };
    const saved = await api('PUT', '/school-profile', principal.accessToken, { general });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const read = (await api('GET', '/school-profile', principal.accessToken)).body.general as Record<string, unknown>;
    for (const [key, value] of Object.entries(general)) {
      assert.equal(read[key], value, key);
    }
    for (const [key, value] of [
      ['national_standard_level', '3'],
      ['accreditation_level', '5'],
      ['national_standard_year', 1800],
      ['accreditation_year', 2101],
      ['accreditation_date', '15/11/2024'],
      ['floor_area_m2', -5],
    ] as const) {
      const rejected = await api('PUT', '/school-profile', principal.accessToken, { general: { [key]: value } });
      assert.equal(rejected.status, 400, key);
      assert.deepEqual(errorFields(rejected.body), [`general.${key}`]);
    }
  });

  it('CT-17e-4: Lấy dữ liệu điền thông tin trường, chuẩn quốc gia, kiểm định từ hồ sơ trường; diện tích sàn lấy ở hồ sơ trường', async () => {
    for (const [code, area] of [
      ['P1', 60],
      ['P2', 55.5],
    ] as const) {
      const room = await api('POST', '/rooms', principal.accessToken, {
        org_unit_id: units.TC,
        code,
        name: `Phòng ${code}`,
        capacity: 30,
        room_block: 'care_education',
        room_type: 'group_room',
        area_m2: area,
      });
      assert.equal(room.status, 201, JSON.stringify(room.body));
    }
    const collected = await api('POST', '/accreditation-review/collect', principal.accessToken);
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    const body = collected.body;
    assert.deepEqual(
      [body.school_name, body.school_code, body.ownership_type, body.education_level],
      ['Đơn vị TC', '79000123', 'private', 'Mầm non'],
    );
    assert.deepEqual(
      [body.national_standard_level, body.national_standard_year, body.national_standard_date],
      ['2', 2023, '2023-05-20'],
    );
    assert.deepEqual(
      [body.accreditation_level, body.accreditation_year, body.accreditation_date],
      ['3', 2024, '2024-11-15'],
    );
    assert.equal(body.national_standard_registration, 'Năm học 2027–2028');
    // Hồ sơ trường có diện tích sàn xây dựng nên không cộng diện tích phòng (115,5 m²)
    assert.equal(body.floor_area_m2, 950.5);
    assert.equal(body.land_area_m2, 1200);
    assert.equal(body.classroom_count, 2);
    // Chưa có học sinh đang học thì hai chỉ số trên học sinh trống
    assert.equal(body.area_per_child_m2, null);
    assert.equal(body.floor_area_per_child_m2, null);
  });

  it('CT-17e-5: Hồ sơ trường chưa nhập diện tích sàn xây dựng thì lấy tổng diện tích các phòng đang dùng', async () => {
    const profile = await api('PUT', '/school-profile', principal.accessToken, {
      general: { land_area_m2: 1200, ownership_type: 'public' },
    });
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    const collected = await api('POST', '/accreditation-review/collect', principal.accessToken);
    assert.equal(collected.body.floor_area_m2, 115.5);
    // Chưa nhập mã định danh thì mã trường là mã Trường chính
    assert.equal(collected.body.school_code, 'TC');
    assert.equal(collected.body.national_standard_level, null);
  });

  it('CT-17e-6: Ghi lưu đủ ô như Sở, đọc lại; thiếu ô bắt buộc hoặc ghi chú quá 500 ký tự thì báo lỗi', async () => {
    const review = {
      ...VALID,
      national_standard_year: 2023,
      national_standard_date: '2023-05-20',
      national_standard_level: '1',
      accreditation_year: 2024,
      accreditation_date: '2024-11-15',
      accreditation_level: '2',
      national_standard_registration: 'Năm 2027',
      class_count: 4,
      classroom_count: 2,
      subject_room_count: 1,
      land_area_m2: 1200,
      floor_area_m2: 400,
      child_count: 80,
      area_per_child_m2: 15,
      floor_area_per_child_m2: 5,
      note: 'Chưa đạt tiêu chí phòng bộ môn; đề nghị hỗ trợ xây thêm phòng',
      collected: true,
    };
    const saved = await api('PUT', '/accreditation-review', principal.accessToken, review);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const read = (await api('GET', '/accreditation-review', principal.accessToken)).body.saved as Record<
      string,
      unknown
    >;
    const { collected: _collected, ...expected } = review;
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(read[key], value, key);
    }
    assert.equal(read.education_level, 'Mầm non');
    assert.ok(read.collected_at);

    const missing = await api('PUT', '/accreditation-review', principal.accessToken, {
      ...review,
      school_name: ' ',
      ownership_type: null,
    });
    assert.equal(missing.status, 400);
    assert.deepEqual(errorFields(missing.body).sort(), ['ownership_type', 'school_name']);
    const longNote = await api('PUT', '/accreditation-review', principal.accessToken, {
      ...review,
      note: 'x'.repeat(501),
    });
    assert.equal(longNote.status, 400);
    assert.deepEqual(errorFields(longNote.body), ['note']);
    // Người không có phạm vi toàn trường không ghi được dù dữ liệu hợp lệ
    const branchManager = await environment.loginWithRoles([{ roleCode: 'VT-03', orgUnitId: units['PH-A'] ?? '' }]);
    assert.equal((await api('PUT', '/accreditation-review', branchManager.accessToken, review)).status, 403);
  });
});

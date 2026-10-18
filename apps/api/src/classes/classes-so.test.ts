import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Trường học, lớp học theo hệ thống của Sở (DT-15 phần 15b, YCTD-111): phân hiệu, điểm trường có khoảng cách và diện tích;
// lớp có nhóm tuổi, thứ tự, học 2 buổi, lớp ghép, bán trú; lọc, xuất Excel; phân công phụ trách lớp. Kịch bản CT-15b-1 đến
// CT-15b-7
interface ClassRow {
  id: string;
  code: string;
  name: string;
  org_unit_name: string;
  org_unit_type: string;
  grade_name: string;
  age_group: string;
  age_group_from_grade: boolean;
  stage: string;
  sort_order: number | null;
  homeroom_names: string;
  enrolled_count: number;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_class_id: string | null;
  combined_into_name: string | null;
  boarding: boolean;
}

interface AssignmentRow {
  class_name: string;
  staff_name: string;
  assignment_role: string;
  org_unit_name: string;
}

const errorOf = (body: Record<string, unknown>) =>
  body.error as { code?: string; rule_code?: string; details?: Array<{ field: string }> } | undefined;

describe('Trường học, lớp học theo Sở (YCTD-111)', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};
  const unit = (code: string) => units[code] ?? '';

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const listClasses = async (token: string, query = '') =>
    (await api('GET', `/classes${query}`, token)).body as unknown as ClassRow[];
  const createClass = (code: string, extra: Record<string, unknown> = {}, orgUnit = 'PH-A') =>
    api('POST', '/classes', principal, {
      org_unit_id: unit(orgUnit),
      code,
      name: `Lớp ${code}`,
      grade_level: 'LA',
      max_size: 25,
      ...extra,
    });

  async function download(path: string, token: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      return { status: response.status, rows: [] as string[][], logId: null };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const rows: string[][] = [];
    workbook.worksheets[0]?.eachRow((row) => {
      rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
    });
    return { status: 200, rows, logId: response.headers.get('x-export-log-id') };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['DT-B', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal, { code, name: `Đơn vị ${code}`, unit_type: type });
      units[code] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['NT', 'Nhà trẻ 25–36 tháng', 25, 36],
      ['MAM', 'Mầm', 37, 48],
      ['LA', 'Lá', 60, 71],
    ] as const) {
      await api('POST', '/grade-levels', principal, { code, name, age_from_months: from, age_to_months: to });
    }
  });

  after(async () => {
    await environment.close();
  });

  it('CT-15b-1: phân hiệu, điểm trường lưu khoảng cách, diện tích, điện thoại; Trường chính không có khoảng cách', async () => {
    const created = await api('POST', '/org-units', principal, {
      code: 'DT-C',
      name: 'Điểm trường C',
      unit_type: 'diem_truong',
      address: 'Số 1 đường Thử',
      phone: '0280000001',
      distance_km: 2.5,
      area_m2: 1200.75,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.distance_km, 2.5);
    assert.equal(created.body.area_m2, 1200.75);

    const updated = await api('PATCH', `/org-units/${created.body.id as string}`, principal, {
      distance_km: 3,
      area_m2: null,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.distance_km, 3);
    assert.equal(updated.body.area_m2, null);
    const sites = (await api('GET', '/org-units?unit_type=diem_truong', principal)).body as unknown as Array<{
      code: string;
      distance_km: number | null;
      phone: string | null;
    }>;
    const site = sites.find((candidate) => candidate.code === 'DT-C');
    assert.equal(site?.distance_km, 3);
    assert.equal(site?.phone, '0280000001');

    for (const body of [{ distance_km: -1 }, { distance_km: 1.234 }, { area_m2: '12' }]) {
      const invalid = await api('PATCH', `/org-units/${created.body.id as string}`, principal, body);
      assert.equal(invalid.status, 400, JSON.stringify(body));
    }
    const root = await api('PATCH', `/org-units/${unit('TC')}`, principal, { distance_km: 1 });
    assert.equal(root.status, 422);
    assert.equal(errorOf(root.body)?.rule_code, 'YCTD-111');
    const manager = await environment.loginAs('VT-03', unit('PH-A'));
    assert.equal(
      (await api('PATCH', `/org-units/${created.body.id as string}`, manager.accessToken, { distance_km: 1 })).status,
      403,
    );
  });

  it('CT-15b-2: lớp có nhóm tuổi theo bậc học hoặc chọn riêng, nhóm lớp, thứ tự, đơn vị theo cột Phân hiệu, Điểm trường', async () => {
    const first = await createClass('L1', { sort_order: 2, two_sessions_per_day: true, boarding: true });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.two_sessions_per_day, true);
    const second = await createClass('L2', { sort_order: 1, age_group: 'years_4_5' });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    const nursery = await createClass('N1', { grade_level: 'NT' }, 'DT-B');
    assert.equal(nursery.status, 201, JSON.stringify(nursery.body));

    const rows = await listClasses(principal);
    const codes = rows.map((row) => row.code);
    assert.ok(codes.indexOf('L2') < codes.indexOf('L1'), 'Thứ tự nhỏ đứng trước');
    const l1 = rows.find((row) => row.code === 'L1');
    assert.equal(l1?.org_unit_type, 'phan_hieu');
    assert.equal(l1?.org_unit_name, 'Đơn vị PH-A');
    assert.equal(l1?.grade_name, 'Lá');
    assert.equal(l1?.age_group, 'years_5_6');
    assert.equal(l1?.age_group_from_grade, true);
    assert.equal(l1?.stage, 'mau_giao');
    assert.equal(l1?.boarding, true);
    const l2 = rows.find((row) => row.code === 'L2');
    assert.equal(l2?.age_group, 'years_4_5');
    assert.equal(l2?.age_group_from_grade, false);
    const n1 = rows.find((row) => row.code === 'N1');
    assert.equal(n1?.org_unit_type, 'diem_truong');
    assert.equal(n1?.age_group, 'months_25_36');
    assert.equal(n1?.stage, 'nhom_tre');

    // Bỏ nhóm tuổi riêng thì trở về theo bậc học
    const reset = await api('PATCH', `/classes/${second.body.id as string}`, principal, { age_group: null });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal(reset.body.age_group, null);
    for (const body of [{ age_group: 'years_9_10' }, { sort_order: -1 }, { boarding: 'yes' }, { mixed_age_count: 4 }]) {
      assert.equal((await createClass('X', body)).status, 400, JSON.stringify(body));
    }
  });

  it('CT-15b-3: chỉ lớp mẫu giáo ghép 2 hoặc 3 độ tuổi', async () => {
    const nursery = await createClass('N2', { grade_level: 'NT', mixed_age_count: 2 });
    assert.equal(nursery.status, 422);
    assert.equal(errorOf(nursery.body)?.rule_code, 'YCTD-111');
    // Nhóm tuổi chọn riêng là nhóm trẻ cũng bị từ chối dù bậc học là mẫu giáo
    const chosen = await createClass('N3', { age_group: 'months_13_24', mixed_age_count: 3 });
    assert.equal(chosen.status, 422);
    const mixed = await createClass('M1', { grade_level: 'MAM', mixed_age_count: 3 });
    assert.equal(mixed.status, 201, JSON.stringify(mixed.body));
    assert.equal(mixed.body.mixed_age_count, 3);
    const toNursery = await api('PATCH', `/classes/${mixed.body.id as string}`, principal, { grade_level: 'NT' });
    assert.equal(toNursery.status, 422);
  });

  it('CT-15b-4: lớp ghép chỉ ghép vào lớp đang dùng của cùng đơn vị, không ghép vào chính nó, không ghép nối tiếp', async () => {
    const target = await createClass('G1');
    const source = await createClass('G2');
    const other = await createClass('G3', {}, 'DT-B');
    const targetId = target.body.id as string;
    const sourceId = source.body.id as string;

    const self = await api('PATCH', `/classes/${sourceId}`, principal, {
      is_combined: true,
      combined_into_class_id: sourceId,
    });
    assert.equal(self.status, 422);
    const crossUnit = await api('PATCH', `/classes/${sourceId}`, principal, {
      is_combined: true,
      combined_into_class_id: other.body.id,
    });
    assert.equal(crossUnit.status, 422);
    assert.equal(errorOf(crossUnit.body)?.rule_code, 'YCTD-111');
    const notCombined = await createClass('G4', { combined_into_class_id: targetId });
    assert.equal(notCombined.status, 201);
    assert.equal(notCombined.body.combined_into_class_id, null);

    const combined = await api('PATCH', `/classes/${sourceId}`, principal, {
      is_combined: true,
      combined_into_class_id: targetId,
    });
    assert.equal(combined.status, 200, JSON.stringify(combined.body));
    const listed = (await listClasses(principal)).find((row) => row.code === 'G2');
    assert.equal(listed?.combined_into_name, 'Lớp G1');

    // Lớp đã có lớp ghép vào thì không ghép vào lớp khác; không ghép vào lớp đã ghép vào lớp khác
    const chain = await api('PATCH', `/classes/${targetId}`, principal, {
      is_combined: true,
      combined_into_class_id: notCombined.body.id,
    });
    assert.equal(chain.status, 422);
    const intoCombined = await createClass('G5', { is_combined: true, combined_into_class_id: sourceId });
    assert.equal(intoCombined.status, 422);

    const cleared = await api('PATCH', `/classes/${sourceId}`, principal, { is_combined: false });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.combined_into_class_id, null);
  });

  it('CT-15b-5: lọc danh sách lớp theo tên, nhóm lớp, nhóm tuổi, học 2 buổi, bán trú, đơn vị; bộ lọc sai bị từ chối', async () => {
    const codes = async (query: string) => (await listClasses(principal, query)).map((row) => row.code).sort();
    assert.deepEqual(await codes('?q=l1'), ['L1']);
    assert.deepEqual(await codes('?stage=nhom_tre'), ['N1']);
    assert.deepEqual(await codes('?age_group=years_3_4'), ['M1']);
    assert.deepEqual(await codes('?two_sessions_per_day=true&boarding=true'), ['L1']);
    assert.deepEqual(await codes(`?org_unit_id=${unit('DT-B')}`), ['G3', 'N1']);
    for (const query of ['?stage=x', '?age_group=x', '?boarding=maybe', '?org_unit_id=abc']) {
      assert.equal((await api('GET', `/classes${query}`, principal)).status, 400, query);
    }
    // Quản lý phân hiệu chỉ thấy lớp của phân hiệu
    const manager = await environment.loginAs('VT-03', unit('PH-A'));
    const own = await listClasses(manager.accessToken);
    assert.ok(own.length > 0);
    assert.ok(own.every((row) => row.org_unit_name === 'Đơn vị PH-A'));
  });

  it('CT-15b-6: xuất Excel danh sách lớp theo cột đang hiện; cần quyền xuất dữ liệu; cột sai bị từ chối', async () => {
    const file = await download('/classes/export', principal, {
      org_unit_id: unit('PH-A'),
      q: 'L',
      columns: ['code', 'name', 'stage', 'age_group', 'two_sessions_per_day', 'boarding', 'branch', 'school_site'],
    });
    assert.equal(file.status, 200);
    assert.ok(file.logId);
    assert.deepEqual(file.rows[0], [
      'STT',
      'Mã lớp',
      'Tên lớp',
      'Nhóm lớp',
      'Nhóm tuổi',
      'Học 2 buổi/ngày',
      'Lớp bán trú',
      'Phân hiệu',
      'Điểm trường',
    ]);
    const l1 = file.rows.find((row) => row[1] === 'L1');
    assert.deepEqual(l1, ['2', 'L1', 'Lớp L1', 'Lớp mẫu giáo', '5–6 tuổi', 'Có', 'Có', 'Đơn vị PH-A', '']);
    const defaults = await download('/classes/export', principal, {});
    // Cột hiện mặc định theo màn hình 2.1 của Sở (YCTD-117)
    assert.deepEqual(defaults.rows[0], [
      'STT',
      'Mã lớp',
      'Tên lớp',
      'Khối',
      'Nhóm lớp',
      'Nhóm trẻ',
      'Nhóm tuổi',
      'Thứ tự',
      'Số học sinh',
      'Học 2 buổi/ngày',
      'Lớp ghép',
      'Ghép vào lớp',
      'Lớp bán trú',
      'Lớp giải thể',
    ]);

    const teacher = await environment.loginAs('VT-07', unit('PH-A'));
    assert.equal((await download('/classes/export', teacher.accessToken, {})).status, 403);
    assert.equal((await download('/classes/export', principal, { columns: ['code', 'salary'] })).status, 400);
    assert.equal((await download('/classes/export', principal, { columns: ['code', 'code'] })).status, 400);
  });

  it('CT-15b-7: phân công phụ trách lớp liệt kê giáo viên với lớp, lọc theo vai trò và tên, xuất Excel', async () => {
    const classes = await listClasses(principal);
    const l1 = classes.find((row) => row.code === 'L1');
    const homeroom = await environment.loginAs('VT-07', unit('PH-A'));
    const subject = await environment.loginAs('VT-08', unit('PH-A'));
    assert.equal(
      (
        await api('POST', `/classes/${l1?.id ?? ''}/staff-assignments`, principal, {
          staff_user_id: homeroom.userId,
          assignment_role: 'homeroom',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api('POST', `/classes/${l1?.id ?? ''}/staff-assignments`, principal, {
          staff_user_id: subject.userId,
          assignment_role: 'subject',
          subject_name: 'Âm nhạc',
        })
      ).status,
      201,
    );
    // Từ DT-16 phần 16e danh sách có thêm giáo viên chưa phân công; ở đây chỉ xét các dòng đã phân công
    const rows = (await api('GET', '/class-assignments?assignment=assigned', principal))
      .body as unknown as AssignmentRow[];
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.class_name === 'Lớp L1' && row.org_unit_name === 'Đơn vị PH-A'));
    const homerooms = (await api('GET', '/class-assignments?assignment=assigned&assignment_role=homeroom', principal))
      .body as unknown as AssignmentRow[];
    assert.equal(homerooms.length, 1);
    const named = (
      await api('GET', `/class-assignments?q=${encodeURIComponent(homerooms[0]?.staff_name ?? '')}`, principal)
    ).body as unknown as AssignmentRow[];
    assert.ok(named.some((row) => row.assignment_role === 'homeroom'));
    const listed = (await listClasses(principal)).find((row) => row.code === 'L1');
    assert.equal(listed?.homeroom_names, homerooms[0]?.staff_name);
    assert.equal((await api('GET', '/class-assignments?assignment_role=x', principal)).status, 400);

    // Giáo viên của điểm trường khác không thấy phân công của phân hiệu
    const outsider = await environment.loginAs('VT-07', unit('DT-B'));
    assert.deepEqual((await api('GET', '/class-assignments', outsider.accessToken)).body, []);

    const file = await download('/class-assignments/export', principal, {
      assignment: 'assigned',
      assignment_role: 'subject',
    });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows[0], [
      'STT',
      'Giáo viên',
      'Vai trò trong lớp',
      'Môn dạy',
      'Lớp',
      'Khối',
      'Đơn vị',
      'Từ ngày',
    ]);
    assert.equal(file.rows.length, 2);
    assert.equal(file.rows[1]?.[3], 'Âm nhạc');
    assert.equal((await download('/class-assignments/export', homeroom.accessToken, {})).status, 403);
  });
});

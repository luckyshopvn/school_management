import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { MINISTRY_STAFF_LAYOUT } from './staff-ministry-file.js';
import { STAFF_PARITY_RULE } from './staff-rules.js';

// Nhân sự đủ tính năng theo hệ thống của Sở (DT-16 phần 16f): xóa hồ sơ chưa có dữ liệu liên quan, tệp theo mẫu Bộ và tệp
// lỗi, mẫu 75 cột kèm dữ liệu nhập lại được, tài khoản ngân hàng, mã số thuế, xã ĐBKK, xác thực số định danh bản chạy nội bộ,
// tiến độ xác thực và trùng số định danh, nhân sự phân hiệu, biến động nhân sự, nhập mức đánh giá chuẩn nghề nghiệp từ
// Excel, thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp
const randomCode = (prefix: string) => `${prefix}-${randomInt(100_000, 999_999)}`;
let idCounter = randomInt(0, 1_000_000);
const nextIdNumber = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++idCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string };

async function readWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

function rowsOf(sheet: ExcelJS.Worksheet | undefined): string[][] {
  const rows: string[][] = [];
  sheet?.eachRow({ includeEmpty: true }, (row) => {
    rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
  });
  return rows;
}

// Hồ sơ đủ các ô bắt buộc theo mẫu Bộ
const COMPLETE_PROFILE = {
  staff_status: 'Đang làm việc',
  ethnicity: 'Kinh',
  religion: 'Không',
  job_position: 'Giáo viên mẫu giáo',
  position_group: 'Giáo viên',
  contract_form: 'Viên chức không xác định thời hạn',
  professional_qualification: 'Đại học',
  permanent_province: 'Thành phố Mẫu',
  permanent_ward: 'Phường Thử',
  recruitment_date: '2015-08-01',
};

describe('Nhân sự đủ tính năng theo hệ thống của Sở (DT-16 phần 16f)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const codes: Record<string, string> = {};
  const idNumbers: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function download(method: string, path: string, accessToken: string, body?: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  }

  async function upload(path: string, accessToken: string, fields: Record<string, string>, file: Buffer) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), 'tep.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function createStaff(key: string, fullName: string, extra: Record<string, unknown> = {}, unit = 'A') {
    codes[key] = randomCode('NS');
    idNumbers[key] = nextIdNumber();
    const created = await api('POST', '/staff', token(unit === 'A' ? 'personnel' : 'otherPersonnel'), {
      org_unit_id: units[unit],
      code: codes[key],
      full_name: fullName,
      gender: 'female',
      dob: '1990-05-01',
      phone: '0912000111',
      id_number: idNumbers[key],
      start_date: '2020-08-01',
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    staff[key] = created.body.id as string;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'PH-A', 'phan_hieu'],
      ['B', 'ĐT-B', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[key] = created.body.id as string;
    }
    users.personnel = await environment.loginAs('VT-06', units.A ?? null);
    users.otherPersonnel = await environment.loginAs('VT-06', units.B ?? null);
    users.teacher = await environment.loginAs('VT-07', units.A ?? null);
    users.manager = await environment.loginAs('VT-03', units.A ?? null);
    await createStaff('Lan', 'Võ Thị Lan');
    await createStaff('Mai', 'Đỗ Thị Mai');
    await createStaff('Nga', 'Hồ Thị Nga');
    await createStaff('Oanh', 'Lý Thị Oanh');
    await createStaff('Phuong', 'Tạ Thị Phương', {}, 'B');
    await schoolYear
      .updateTable('staff')
      .set({ moet_staff_code: `BO-${randomInt(100_000, 999_999)}`, moet_profile: JSON.stringify(COMPLETE_PROFILE) })
      .where('id', '=', staff.Lan ?? '')
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16f-1: xóa hồ sơ chưa có dữ liệu liên quan; hồ sơ có hợp đồng, tài khoản không xóa được, ghi rõ lý do', async () => {
    await createStaff('Xoa', 'Nhập Nhầm Một');
    await createStaff('HopDong', 'Có Hợp Đồng');
    await createStaff('TaiKhoan', 'Có Tài Khoản');
    const contract = await api('POST', `/staff/${staff.HopDong}/contracts`, token('personnel'), {
      contract_no: randomCode('HD'),
      contract_type: 'indefinite',
      start_date: '2026-08-01',
      base_salary: 8_000_000,
      allowances: [],
    });
    assert.equal(contract.status, 201, JSON.stringify(contract.body));
    await schoolYear
      .updateTable('staff')
      .set({ user_id: users.teacher?.userId ?? null })
      .where('id', '=', staff.TaiKhoan ?? '')
      .execute();
    const denied = await api('POST', '/staff/delete', token('otherPersonnel'), { staff_ids: [staff.Xoa] });
    assert.equal(denied.status, 403);
    const removed = await api('POST', '/staff/delete', token('personnel'), {
      staff_ids: [staff.Xoa, staff.HopDong, staff.TaiKhoan],
    });
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.deleted_count, 1);
    const results = removed.body.results as Array<{ id: string; deleted: boolean; reason: string | null }>;
    assert.equal(results.find((item) => item.id === staff.Xoa)?.deleted, true);
    assert.match(results.find((item) => item.id === staff.HopDong)?.reason ?? '', /hợp đồng lao động/);
    assert.match(results.find((item) => item.id === staff.TaiKhoan)?.reason ?? '', /tài khoản/);
    assert.equal((await api('GET', `/staff/${staff.Xoa}`, principal.accessToken)).status, 404);
    assert.equal((await api('GET', `/staff/${staff.HopDong}`, principal.accessToken)).status, 200);
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select(['action', 'before_data'])
      .where('entity_id', '=', staff.Xoa ?? '')
      .where('action', '=', 'delete')
      .executeTakeFirst();
    assert.equal((log?.before_data as { code?: string } | undefined)?.code, codes.Xoa);
  });

  it('CT-16f-2: xuất tệp theo mẫu Bộ 75 cột kèm trang kiểm tra dữ liệu; xuất file lỗi chỉ các hồ sơ thiếu, sai; ghi nhật ký xuất', async () => {
    const file = await download('POST', '/staff/ministry-export', token('personnel'), {});
    assert.equal(file.status, 200, file.buffer.toString().slice(0, 300));
    const workbook = await readWorkbook(file.buffer);
    const rows = rowsOf(workbook.getWorksheet('Hồ sơ'));
    assert.deepEqual(
      rows[0],
      MINISTRY_STAFF_LAYOUT.map((column) => column.header),
    );
    assert.equal(rows[0]?.length, 75);
    const lan = rows.find((row) => row.includes('Võ Thị Lan'));
    assert.ok(lan, 'có dòng của nhân sự');
    assert.ok(lan.includes(idNumbers.Lan ?? ''), 'số định danh đủ 12 số để nộp');
    assert.ok(lan.includes('Giáo viên mẫu giáo'));
    const checks = rowsOf(workbook.getWorksheet('Kiểm tra dữ liệu'));
    assert.ok(checks.some((row) => row[0] === 'Hồ sơ còn lỗi'));
    assert.ok(checks.some((row) => row.includes('Đỗ Thị Mai') && row.some((cell) => cell.includes('Thiếu dân tộc'))));
    assert.ok(!checks.some((row) => row.includes('Võ Thị Lan')), 'hồ sơ đủ thông tin không có lỗi');
    const errors = await download('POST', '/staff/ministry-errors', token('personnel'), {});
    assert.equal(errors.status, 200);
    const errorRows = rowsOf((await readWorkbook(errors.buffer)).worksheets[0]);
    assert.deepEqual(errorRows[0], ['STT', 'Mã nhân sự', 'Họ tên', 'Cột', 'Lỗi']);
    assert.ok(errorRows.some((row) => row.includes(codes.Mai ?? '')));
    assert.ok(!errorRows.some((row) => row.includes(codes.Lan ?? '')));
    const none = await download('POST', '/staff/ministry-errors', token('personnel'), { q: 'Võ Thị Lan' });
    assert.equal(none.status, 422);
    assert.equal(errorOf(JSON.parse(none.buffer.toString())).rule_code, STAFF_PARITY_RULE);
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', 'in', ['staff-ministry', 'staff-ministry-errors'])
      .execute();
    assert.equal(logs.length, 2);
    assert.equal((await download('POST', '/staff/ministry-export', token('teacher'), {})).status, 403);
  });

  it('CT-16f-3: mẫu 75 cột kèm dữ liệu nhập lại được bằng tệp CSDL ngành (cập nhật, không tạo trùng); tra cứu danh mục của Bộ', async () => {
    const empty = await download('GET', '/staff/ministry-template', token('personnel'));
    assert.equal(empty.status, 200);
    const emptyBook = await readWorkbook(empty.buffer);
    assert.equal(rowsOf(emptyBook.getWorksheet('Hồ sơ')).length, 1);
    assert.ok(rowsOf(emptyBook.getWorksheet('Danh mục')).some((row) => row.includes('Ê Đê')));
    const filled = await download('GET', '/staff/ministry-template?with_data=true', token('personnel'));
    const filledRows = rowsOf((await readWorkbook(filled.buffer)).getWorksheet('Hồ sơ'));
    assert.ok(filledRows.some((row) => row.includes('Võ Thị Lan')));
    assert.ok(!filledRows.some((row) => row.includes('Tạ Thị Phương')), 'chỉ hồ sơ trong phạm vi nhập');
    const job = await upload('/imports', token('personnel'), { type: 'moet_staff', org_unit_id: units.A ?? '' }, filled.buffer);
    assert.equal(job.status, 201, JSON.stringify(job.body));
    const preview = job.body.preview as { created: number; updated: number };
    assert.equal(job.body.status, 'validated', JSON.stringify(job.body.errors));
    assert.equal(preview.created, 0);
    assert.equal(preview.updated, filledRows.length - 1);
    const catalogs = await api('GET', '/staff/ministry-catalogs', token('personnel'));
    const items = catalogs.body.items as Array<{ key: string; items: Array<{ name: string }> }>;
    assert.ok(items.find((catalog) => catalog.key === 'job_position')?.items.some((item) => item.name === 'Bảo mẫu'));
  });

  it('CT-16f-4: ghi tài khoản ngân hàng, mã số thuế, xã ĐBKK; kiểm tra định dạng; lọc xã ĐBKK; 5.9 xét thiếu tài khoản, mã số thuế', async () => {
    const invalid = await api('PATCH', `/staff/${staff.Mai}/profile`, token('personnel'), { tax_code: '12AB' });
    assert.equal(invalid.status, 400);
    const saved = await api('PATCH', `/staff/${staff.Mai}/profile`, token('personnel'), {
      bank_account_number: '0123 4567 89',
      bank_name: 'Ngân hàng Mẫu',
      tax_code: '8012345678',
      special_difficulty_commune: true,
      moet_profile: { ethnicity: 'Ê Đê' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.bank_account_number, '0123456789');
    assert.equal(saved.body.special_difficulty_commune, true);
    const filtered = await api(
      'GET',
      `/staff/search?org_unit_id=${units.A}&special_difficulty_commune=true`,
      token('personnel'),
    );
    assert.deepEqual(
      (filtered.body.items as Array<{ full_name: string }>).map((item) => item.full_name),
      ['Đỗ Thị Mai'],
    );
    const missing = await api('GET', `/statistics/missing-staff-fields?org_unit_id=${units.A}&field=tax_code`, principal.accessToken);
    const names = (missing.body.records as Array<{ full_name: string }>).map((item) => item.full_name);
    assert.ok(names.includes('Võ Thị Lan'));
    assert.ok(!names.includes('Đỗ Thị Mai'));
    const fields = missing.body.fields as Array<{ key: string }>;
    assert.ok(fields.some((field) => field.key === 'bank_account'));
  });

  it('CT-16f-5: đánh dấu xác thực số định danh (bản chạy nội bộ) cần số 12 chữ số, sai thông tin cần ghi chú; tiến độ và trùng số định danh', async () => {
    await createStaff('ChuaSo', 'Chưa Có Số', { id_number: undefined });
    await schoolYear
      .updateTable('staff')
      .set({ id_number_encrypted: null, id_number_last4: null })
      .where('id', '=', staff.ChuaSo ?? '')
      .execute();
    const marked = await api('POST', '/staff-identity/mark', token('personnel'), {
      staff_ids: [staff.Lan, staff.ChuaSo],
      status: 'verified',
    });
    assert.equal(marked.status, 200, JSON.stringify(marked.body));
    assert.equal(marked.body.updated_count, 1);
    const results = marked.body.results as Array<{ id: string; error: string | null }>;
    assert.match(results.find((item) => item.id === staff.ChuaSo)?.error ?? '', /12 chữ số/);
    const noNote = await api('POST', '/staff-identity/mark', token('personnel'), {
      staff_ids: [staff.Mai],
      status: 'invalid',
    });
    assert.equal(noNote.status, 400);
    await api('POST', '/staff-identity/mark', token('personnel'), {
      staff_ids: [staff.Mai],
      status: 'invalid',
      note: 'Sai ngày sinh so với CCCD',
    });
    const list = await api('GET', `/staff-identity?org_unit_id=${units.A}&status=verified`, token('personnel'));
    const rows = list.body.items as Array<Record<string, unknown>>;
    assert.equal(list.body.automatic, false);
    assert.deepEqual(
      rows.map((row) => row.full_name),
      ['Võ Thị Lan'],
    );
    assert.equal(rows[0]?.permanent_address, 'Phường Thử, Thành phố Mẫu');
    assert.ok(rows[0]?.id_verified_at);
    assert.ok(!JSON.stringify(list.body).includes(idNumbers.Lan ?? ''));
    assert.equal(
      (await api('POST', '/staff-identity/mark', token('teacher'), { staff_ids: [staff.Lan], status: 'verified' })).status,
      403,
    );
    // Hai hồ sơ cùng số định danh
    await schoolYear
      .updateTable('staff')
      .set((expression) => ({
        id_number_encrypted: expression
          .selectFrom('staff as source')
          .select('source.id_number_encrypted')
          .where('source.id', '=', staff.Nga ?? ''),
        id_number_last4: idNumbers.Nga?.slice(-4) ?? null,
      }))
      .where('id', '=', staff.Oanh ?? '')
      .execute();
    const progress = await api('GET', `/staff-identity/progress?org_unit_id=${units.A}`, principal.accessToken);
    assert.equal(progress.status, 200, JSON.stringify(progress.body));
    const totals = progress.body.totals as { total: number; verified: number; invalid: number; rate: number };
    assert.equal(totals.verified, 1);
    assert.equal(totals.invalid, 1);
    assert.equal(totals.rate, Math.round((10000 * 1) / totals.total) / 100);
    const byDepartment = await api('GET', `/staff-identity/progress?group_by=department`, principal.accessToken);
    assert.ok((byDepartment.body.items as Array<{ name: string }>).some((item) => item.name.includes('Chưa xếp phòng ban')));
    const duplicates = await api('GET', '/staff-identity/duplicates', principal.accessToken);
    const groups = duplicates.body.groups as Array<{ staff: Array<{ full_name: string }> }>;
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]?.staff.map((item) => item.full_name).sort(), ['Hồ Thị Nga', 'Lý Thị Oanh']);
  });

  it('CT-16f-6: nhân sự phân hiệu: gán, bỏ gán, lấy theo phân hiệu giảng dạy (thay dòng lấy lần trước, giữ dòng gán tay)', async () => {
    const assigned = await api('POST', '/staff-branches/assign', token('personnel'), {
      staff_ids: [staff.Lan, staff.Mai],
      org_unit_ids: [units.B, units.A],
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    // Đơn vị chính (A) không gán lại
    assert.equal(assigned.body.assigned_count, 2);
    const outsider = await api('POST', '/staff-branches/assign', token('otherPersonnel'), {
      staff_ids: [staff.Lan],
      org_unit_ids: [units.B],
    });
    assert.equal(outsider.status, 403);
    const notBranch = await api('POST', '/staff-branches/assign', token('personnel'), {
      staff_ids: [staff.Lan],
      org_unit_ids: [units.TC],
    });
    assert.equal(notBranch.status, 400);
    // Lớp ở điểm trường B do Nga dạy (theo tài khoản liên kết)
    await api('POST', '/grade-levels', principal.accessToken, { code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 72 });
    const createdClass = await api('POST', '/classes', principal.accessToken, {
      org_unit_id: units.B,
      code: 'L1',
      name: 'Lớp L1',
      grade_level: 'LA',
      max_size: 30,
    });
    assert.equal(createdClass.status, 201, JSON.stringify(createdClass.body));
    await schoolYear
      .updateTable('staff')
      .set({ user_id: users.manager?.userId ?? null })
      .where('id', '=', staff.Nga ?? '')
      .execute();
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: createdClass.body.id as string,
        staff_user_id: users.manager?.userId ?? '',
        staff_name: 'Hồ Thị Nga',
        assignment_role: 'homeroom',
        from_date: '2026-09-01',
      })
      .execute();
    const derived = await api('POST', '/staff-branches/from-teaching', token('personnel'), {
      staff_ids: [staff.Nga, staff.Oanh],
    });
    assert.equal(derived.status, 200, JSON.stringify(derived.body));
    assert.equal(derived.body.assigned_count, 1);
    assert.equal(derived.body.without_account_count, 1);
    const list = await api('GET', `/staff-branches?org_unit_id=${units.A}&branch_id=${units.B}`, token('personnel'));
    const rows = list.body.items as Array<{ full_name: string; branches: Array<{ source: string }> }>;
    assert.deepEqual(rows.map((row) => row.full_name).sort(), ['Hồ Thị Nga', 'Võ Thị Lan', 'Đỗ Thị Mai'].sort());
    assert.equal(rows.find((row) => row.full_name === 'Hồ Thị Nga')?.branches[0]?.source, 'teaching');
    const removed = await api('POST', '/staff-branches/unassign', token('personnel'), {
      staff_ids: [staff.Mai],
      org_unit_ids: [units.B],
    });
    assert.equal(removed.body.removed_count, 1);
  });

  it('CT-16f-7: chuyển đi: duyệt cho nghỉ việc, chấm dứt hợp đồng; đánh dấu trường đến đã tiếp nhận; hồ sơ chuyển PDF và tệp theo mẫu Bộ', async () => {
    const contract = await api('POST', `/staff/${staff.Lan}/contracts`, token('personnel'), {
      contract_no: randomCode('HD'),
      contract_type: 'indefinite',
      start_date: '2026-08-01',
      base_salary: 8_000_000,
      allowances: [],
    });
    assert.equal(contract.status, 201);
    const created = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'transfer_out',
      staff_id: staff.Lan,
      other_province: 'Tỉnh Mẫu',
      other_ward: 'Xã Thử',
      other_school: 'Trường Mầm non Mẫu',
      movement_date: '2026-10-01',
      decision_no: 'QĐ-01',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const movementId = created.body.id as string;
    assert.equal(created.body.status_label, 'Chờ duyệt');
    const again = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'transfer_out',
      staff_id: staff.Lan,
      other_school: 'Trường khác',
      movement_date: '2026-10-02',
    });
    assert.equal(errorOf(again.body).rule_code, STAFF_PARITY_RULE);
    const early = await api('POST', `/staff-movements/${movementId}/confirm`, token('personnel'), {
      confirmed_on: '2026-10-05',
    });
    assert.equal(early.status, 422);
    const approved = await api('POST', `/staff-movements/${movementId}/approve`, token('personnel'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const person = await api('GET', `/staff/${staff.Lan}`, principal.accessToken);
    assert.equal(person.body.status, 'terminated');
    assert.equal(person.body.end_date, '2026-10-01');
    assert.equal((person.body.moet_fields as Record<string, string>).staff_status, 'Đã chuyển đi');
    assert.equal((person.body.contracts as Array<{ status: string }>)[0]?.status, 'terminated');
    const confirmed = await api('POST', `/staff-movements/${movementId}/confirm`, token('personnel'), {
      confirmed_on: '2026-10-05',
    });
    assert.equal(confirmed.body.confirmed, true);
    const pdf = await download('GET', `/staff-movements/${movementId}/pdf`, token('personnel'));
    assert.equal(pdf.status, 200);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    const ministry = await download('GET', `/staff-movements/${movementId}/ministry-file`, token('personnel'));
    assert.equal(ministry.status, 200);
    const ministryRows = rowsOf((await readWorkbook(ministry.buffer)).getWorksheet('Hồ sơ'));
    assert.equal(ministryRows.length, 2);
    assert.ok(ministryRows[1]?.includes(idNumbers.Lan ?? ''));
    const list = await api('GET', '/staff-movements?type=transfer_out', token('personnel'));
    assert.equal((list.body.items as Array<{ id: string }>)[0]?.id, movementId);

    // Tiếp nhận ở trường khác bằng tệp hồ sơ chuyển: cùng trường thì mã định danh Bộ đã có nên báo trùng
    const incoming = await upload(
      '/staff-movements/transfer-in-file',
      token('otherPersonnel'),
      { org_unit_id: units.B ?? '', other_school: 'Trường cũ', movement_date: '2026-10-03' },
      ministry.buffer,
    );
    assert.equal(incoming.status, 201, JSON.stringify(incoming.body));
    assert.equal(incoming.body.full_name, 'Võ Thị Lan');
    assert.equal((incoming.body.dossier as { id_number_masked: string }).id_number_masked, `********${idNumbers.Lan?.slice(-4)}`);
    const duplicate = await api('POST', `/staff-movements/${incoming.body.id as string}/approve`, token('otherPersonnel'));
    assert.equal(duplicate.status, 409);
  });

  it('CT-16f-8: tiếp nhận chuyển đến tạo hồ sơ nháp; đi thỉnh giảng duyệt; đến thỉnh giảng xác nhận; từ chối cần lý do', async () => {
    const incoming = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'transfer_in',
      org_unit_id: units.A,
      full_name: 'Quách Thị Quyên',
      dob: '1992-02-02',
      gender: 'female',
      other_province: 'Tỉnh Mẫu',
      other_school: 'Trường Mầm non Cũ',
      movement_date: '2026-10-10',
    });
    assert.equal(incoming.status, 201, JSON.stringify(incoming.body));
    const received = await api('POST', `/staff-movements/${incoming.body.id as string}/approve`, token('personnel'));
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.status_label, 'Đã tiếp nhận');
    const newStaff = await api('GET', `/staff/${received.body.staff_id as string}`, principal.accessToken);
    assert.match(String(newStaff.body.code), /^CDN-/);
    assert.equal(newStaff.body.start_date, '2026-10-10');
    assert.equal((newStaff.body.moet_fields as Record<string, string>).staff_status, 'Chuyển đến');
    const guestOut = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'guest_out',
      staff_id: staff.Mai,
      other_school: 'Trường bạn',
      subject: 'Âm nhạc',
      movement_date: '2026-11-01',
      end_date: '2026-10-01',
    });
    assert.equal(guestOut.status, 400);
    const guest = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'guest_out',
      staff_id: staff.Mai,
      other_school: 'Trường bạn',
      subject: 'Âm nhạc',
      movement_date: '2026-11-01',
      end_date: '2026-12-01',
    });
    assert.equal((await api('POST', `/staff-movements/${guest.body.id as string}/approve`, token('personnel'))).body.status_label, 'Đã duyệt');
    const visiting = await api('POST', '/staff-movements', token('personnel'), {
      movement_type: 'guest_in',
      org_unit_id: units.A,
      full_name: 'Giáo viên Thỉnh Giảng',
      other_school: 'Trường cử đến',
      subject: 'Tiếng Anh',
      movement_date: '2026-11-01',
    });
    const noReason = await api('POST', `/staff-movements/${visiting.body.id as string}/reject`, token('personnel'), {});
    assert.equal(noReason.status, 400);
    const confirmed = await api('POST', `/staff-movements/${visiting.body.id as string}/approve`, token('personnel'));
    assert.equal(confirmed.body.status_label, 'Đã xác nhận');
    assert.equal(
      (await api('POST', '/staff-movements', token('teacher'), { movement_type: 'guest_in' })).status,
      403,
    );
  });

  it('CT-16f-9: nhập mức đánh giá chuẩn nghề nghiệp từ Excel: mẫu kèm dữ liệu, kiểm tra quyền và trạng thái, ghi, chốt phiếu', async () => {
    const opened = await api('POST', '/professional-evaluations', principal.accessToken, {
      standard_type: 'teacher',
      staff_ids: [staff.Mai, staff.Nga],
    });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    await schoolYear
      .updateTable('professional_evaluations')
      .set({ status: 'self_submitted' })
      .where('staff_id', '=', staff.Mai ?? '')
      .execute();
    const template = await download('GET', '/imports/templates/professional_ratings?with_data=true', principal.accessToken);
    assert.equal(template.status, 200);
    const book = await readWorkbook(template.buffer);
    const sheet = book.worksheets[0];
    const rows = rowsOf(sheet);
    assert.equal(rows[0]?.[0], 'Mã nhân sự');
    const criteriaCount = (
      await schoolYear
        .selectFrom('professional_evaluation_items')
        .innerJoin('professional_evaluations', 'professional_evaluations.id', 'professional_evaluation_items.evaluation_id')
        .select('professional_evaluation_items.id')
        .where('professional_evaluations.staff_id', '=', staff.Mai ?? '')
        .execute()
    ).length;
    const maiRow = rows.findIndex((row) => row[0] === codes.Mai);
    const ngaRow = rows.findIndex((row) => row[0] === codes.Nga);
    assert.ok(maiRow > 0 && ngaRow > 0, 'mẫu kèm dữ liệu có các phiếu chưa chốt');
    for (let position = 1; position <= criteriaCount; position += 1) {
      sheet?.getRow(maiRow + 1).getCell(3 + position).value = 'Tốt';
      sheet?.getRow(ngaRow + 1).getCell(3 + position).value = 'Khá';
    }
    sheet?.getRow(maiRow + 1).getCell(3 + 20 + 2).value = 'x';
    const failing = await upload('/imports', principal.accessToken, { type: 'professional_ratings' }, Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(failing.body.status, 'failed');
    assert.ok(
      (failing.body.errors as Array<{ message: string }>).some((error) => error.message.includes('chưa gửi tự đánh giá')),
    );
    sheet?.spliceRows(ngaRow + 1, 1);
    const job = await upload('/imports', principal.accessToken, { type: 'professional_ratings' }, Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(job.body.status, 'validated', JSON.stringify(job.body.errors));
    const denied = await upload('/imports', token('teacher'), { type: 'professional_ratings' }, Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(denied.status, 403);
    const committed = await api('POST', `/imports/${job.body.id as string}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    const evaluation = await schoolYear
      .selectFrom('professional_evaluations')
      .select(['status', 'overall_level'])
      .where('staff_id', '=', staff.Mai ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(evaluation.status, 'finalized');
    assert.equal(evaluation.overall_level, 'excellent');
  });

  it('CT-16f-10: 5.2 thống kê nhân sự đủ dòng danh mục Bộ (kể cả 0, giá trị ngoài danh mục), chuẩn nghề nghiệp theo tiêu chí', async () => {
    await schoolYear
      .updateTable('staff')
      .set({ moet_profile: JSON.stringify({ job_position: 'Nhân viên hợp đồng khác lạ' }) })
      .where('id', '=', staff.Oanh ?? '')
      .execute();
    const statistics = await api('GET', `/statistics/staff-so?org_unit_id=${units.A}`, principal.accessToken);
    assert.equal(statistics.status, 200, JSON.stringify(statistics.body));
    const positions = statistics.body.by_job_position as Array<{ value: string; count: number; in_catalog: boolean }>;
    assert.equal(positions.find((row) => row.value === 'Thủ quỹ')?.count, 0);
    assert.equal(positions.find((row) => row.value === 'Giáo viên mẫu giáo')?.in_catalog, true);
    assert.equal(positions.find((row) => row.value === 'Nhân viên hợp đồng khác lạ')?.in_catalog, false);
    const standards = statistics.body.standards as Array<{
      standard_type: string;
      finalized: number;
      overall: Record<string, number>;
      criteria: Array<{ levels: Record<string, number> }>;
    }>;
    const teacher = standards.find((item) => item.standard_type === 'teacher');
    assert.equal(teacher?.finalized, 1);
    assert.equal(teacher?.overall.excellent, 1);
    assert.ok((teacher?.criteria.length ?? 0) > 0);
    assert.ok(teacher?.criteria.every((criterion) => criterion.levels.excellent === 1));
    assert.equal(
      (await api('GET', '/statistics/staff-so', token('teacher'))).status,
      403,
    );
  });
});

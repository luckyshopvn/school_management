import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import * as XLSX from 'xlsx';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { MOET_CHILD_COLUMNS, MOET_STAFF_COLUMNS, type MoetColumn } from './moet-columns.js';

// Nhập tệp xuất từ CSDL ngành cho trẻ và nhân sự (DT-13 phần 13a, YCTD-100). Tệp kiểm thử tạo ngay trong bài bằng SheetJS
// với dữ liệu tổng hợp (không dùng dữ liệu thật), ghi cả dạng xls (BIFF8) và xlsx; ca kiểm thử CT-13a-N
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
let counter = randomInt(0, 100_000);
const nextId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++counter % 1000).padStart(3, '0')}`;
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const randomCode = () => String(randomInt(1_000_000_000, 9_999_999_999));

type Job = {
  id: string;
  status: string;
  total_rows: number;
  error_rows: number;
  errors: Array<{ row: number; column: string; message: string }>;
  preview: {
    created: number;
    updated: number;
    skipped: number;
    notices: Array<{ row: number; column: string; message: string }>;
  } | null;
};

// Tiêu đề như tệp của Bộ: nhóm địa chỉ xuống dòng trước ngoặc, cột quận/huyện không tên ngay sau cột tỉnh
function headersOf(columns: MoetColumn[], skip: string[] = []): string[] {
  return columns
    .filter((column) => !skip.includes(column.key))
    .flatMap((column) => {
      const header = column.header.replace(' (Theo', '\n(Theo');
      return column.blankAfter ? [header, ''] : [header];
    });
}

function cellsOf(columns: MoetColumn[], values: Record<string, unknown>, skip: string[] = []): unknown[] {
  return columns
    .filter((column) => !skip.includes(column.key))
    .flatMap((column) => {
      const value = values[column.key] ?? '';
      return column.blankAfter ? [value, values[column.blankAfter] ?? ''] : [value];
    });
}

function workbook(
  columns: MoetColumn[],
  rows: Array<Record<string, unknown>>,
  options: { bookType?: 'xlsx' | 'biff8'; titleRow?: boolean; skip?: string[] } = {},
): Buffer {
  const aoa = [
    ...(options.titleRow ? [['DANH SÁCH XUẤT TỪ CSDL NGÀNH']] : []),
    headersOf(columns, options.skip),
    ...rows.map((row) => cellsOf(columns, row, options.skip)),
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['STT', 'Tên cột', 'Hướng dẫn nhập']]), 'HUONG_DAN');
  return XLSX.write(book, { bookType: options.bookType ?? 'xlsx', type: 'buffer' }) as Buffer;
}

const childValues = (overrides: Record<string, unknown> = {}) => {
  const nationalId = nextId();
  return {
    row_number: 1,
    class_label: 'la hong',
    moet_student_code: randomCode(),
    full_name: `Trẻ Tổng Hợp ${randomInt(0, 1_000_000)}`,
    dob: '15/03/2022',
    gender: 'Nữ',
    student_status: 'Đang học',
    ethnicity: 'Kinh',
    nationality: 'Việt Nam',
    religion: 'Không',
    permanent_province: 'Tỉnh Thử Nghiệm',
    permanent_district: 'Huyện Cũ Thử',
    permanent_ward: 'Xã Thử Nghiệm',
    permanent_hamlet: 'Tổ 1',
    place_of_birth: 'Bệnh viện Thử',
    address: '1 Đường Thử',
    contact_phone: randomPhone(),
    citizen_id: nationalId,
    national_id: nationalId,
    boarding_class: 'x',
    boarding_type: 'Tự nguyện',
    eye_disease: 'Cận thị',
    newly_enrolled_date: '01/09/2026',
    parent_has_smartphone: 'x',
    development_education: 'Vận động; Ngôn ngữ',
    mother_name: 'Mẹ Tổng Hợp',
    mother_occupation: 'Nội trợ',
    mother_birth_year: '1990',
    // Excel cắt số 0 đầu khi ô là số: chín chữ số được thêm số 0
    mother_phone: randomPhone().slice(1),
    mother_id_number: nextId(),
    father_name: 'Cha Tổng Hợp',
    father_occupation: 'Kỹ sư',
    father_birth_year: '1988',
    father_phone: randomPhone(),
    ...overrides,
  };
};

const staffValues = (overrides: Record<string, unknown> = {}) => ({
  row_number: 1,
  moet_staff_code: randomCode(),
  full_name: `Giáo Viên Tổng Hợp ${randomInt(0, 1_000_000)}`,
  gender: 'Nữ',
  dob: '02/03/1990',
  staff_status: 'Đang làm việc',
  id_number: nextId(),
  id_issued_date: '01/01/2021',
  email: `gv${randomInt(0, 1_000_000)}@example.test`,
  phone: randomPhone(),
  ethnicity: 'Kinh',
  permanent_province: 'Tỉnh Thử Nghiệm',
  permanent_district: 'Quận Cũ Thử',
  party_member: 'x',
  social_insurance_number: '7912345678',
  job_position: 'Giáo viên',
  contract_form: 'Viên chức/Công chức HĐLV không xác định thời hạn',
  recruitment_date: '15/08/2015',
  civil_service_rank: 'Giáo viên mầm non hạng III',
  seniority_allowance_percent: '10',
  salary_step: 'Bậc 3',
  salary_coefficient: '2.72',
  salary_effective_date: '01/01/2025',
  professional_qualification: 'Đại học sư phạm',
  it_level: 'Cơ bản (TT03)',
  main_major: 'Giáo dục Mầm non',
  ...overrides,
});

describe('Nhập tệp CSDL ngành cho trẻ và nhân sự (YCTD-100)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let personnel: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};

  const upload = async (
    token: string,
    type: string,
    file: Buffer,
    orgUnitId: string | undefined,
    fileName = 'csdl.xlsx',
  ) => {
    const form = new FormData();
    form.set('type', type);
    if (orgUnitId) {
      form.set('org_unit_id', orgUnitId);
    }
    form.set('file', new Blob([file]), fileName);
    const response = await fetch(`${environment.baseUrl}/imports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Job & Record<string, unknown> };
  };
  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const commit = (token: string, jobId: string) => api('POST', `/imports/${jobId}/commit`, token);
  const childByCode = (code: string) =>
    schoolYear.selectFrom('children').selectAll().where('moet_student_code', '=', code).executeTakeFirst();

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: DEFAULT_PASSWORD,
    });
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-A2', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'LA',
      name: 'Lá',
      age_from_months: 48,
      age_to_months: 71,
    });
    for (const [code, name, unit] of [
      ['LH1', 'Lá Hồng', 'ĐT-A1'],
      ['CX1', 'Chồi Xanh', 'ĐT-A1'],
      ['LH2', 'Lá Hồng', 'ĐT-A2'],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name,
        grade_level: 'LA',
        max_size: 30,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      classes[code] = created.body.id as string;
    }
    personnel = await environment.loginAs('VT-06', units['ĐT-A1'] ?? null);
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  // Trẻ thứ hai: không có thông tin cha; người giám hộ trùng họ tên mẹ là cùng một người
  const firstRows = [
    childValues(),
    childValues({ class_label: 'CX1', gender: 'Nam', no_father_info: 'x', legal_guardian_name: 'mẹ tổng hợp' }),
  ];

  it('CT-13a-1: tệp xls của CSDL ngành được kiểm tra trước: đủ dòng, hai trẻ sẽ tạo mới, chưa ghi gì', async () => {
    const file = workbook(MOET_CHILD_COLUMNS, firstRows, { bookType: 'biff8' });
    assert.deepEqual([...file.subarray(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]);
    const uploaded = await upload(principal.accessToken, 'moet_children', file, units['ĐT-A1'], 'csdl.xls');
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.status, 'validated', JSON.stringify(uploaded.body.errors));
    assert.equal(uploaded.body.total_rows, 2);
    assert.deepEqual(
      { created: uploaded.body.preview?.created, updated: uploaded.body.preview?.updated },
      { created: 2, updated: 0 },
    );
    assert.equal(await childByCode(String(firstRows[0]?.moet_student_code)), undefined);

    const committed = await commit(principal.accessToken, uploaded.body.id);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.equal(committed.body.status, 'committed');
  });

  it('CT-13a-2: trẻ ghi đủ: lớp khớp tên không dấu, mã học sinh, hồ sơ CSDL ngành, dị ứng chưa khai báo', async () => {
    const child = await childByCode(String(firstRows[0]?.moet_student_code));
    assert.ok(child);
    assert.equal(child.status, 'active');
    assert.equal(child.org_unit_id, units['ĐT-A1']);
    assert.equal(child.gender, 'female');
    assert.equal(child.dob, '2022-03-15');
    assert.equal(child.address, '1 Đường Thử');
    const profile = child.moet_profile as Record<string, unknown>;
    assert.equal(profile.ethnicity, 'Kinh');
    assert.equal(profile.permanent_district, 'Huyện Cũ Thử');
    assert.equal(profile.boarding_class, true);
    assert.equal(profile.newly_enrolled_date, '2026-09-01');
    assert.equal(profile.citizen_id_last4, String(firstRows[0]?.citizen_id).slice(-4));
    assert.ok(!JSON.stringify(profile).includes(String(firstRows[0]?.citizen_id)), 'số căn cước không lưu dạng rõ');
    const enrollment = await schoolYear
      .selectFrom('class_enrollments')
      .select(['class_id', 'from_date'])
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    assert.equal(enrollment.class_id, classes.LH1);
    assert.equal(enrollment.from_date, '2026-09-01');
    const second = await childByCode(String(firstRows[1]?.moet_student_code));
    const secondEnrollment = await schoolYear
      .selectFrom('class_enrollments')
      .select('class_id')
      .where('child_id', '=', second?.id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(secondEnrollment.class_id, classes.CX1);
    const health = await schoolYear
      .selectFrom('health_profiles')
      .select('has_allergies')
      .where('child_id', '=', child.id)
      .executeTakeFirstOrThrow();
    assert.equal(health.has_allergies, null);

    const detail = await api('GET', `/children/${child.id}`, principal.accessToken);
    const entries = detail.body.moet_profile as Array<{ label: string; value: string }>;
    assert.ok(entries.some((entry) => entry.label === 'Dân tộc' && entry.value === 'Kinh'));
    assert.ok(entries.some((entry) => entry.label === 'Ngày tuyển mới' && entry.value === '01/09/2026'));
    assert.ok(entries.some((entry) => entry.label === 'Số CCCD' && entry.value.startsWith('********')));
  });

  it('CT-13a-3: cha, mẹ được tạo kèm nghề nghiệp, năm sinh, số định danh mã hóa; số điện thoại chuẩn hóa; tài khoản phụ huynh tạo', async () => {
    const child = await childByCode(String(firstRows[0]?.moet_student_code));
    const guardians = await schoolYear
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'guardians.full_name',
        'guardians.phone',
        'guardians.birth_year',
        'guardians.occupation',
        'guardians.id_number_last4',
        'guardians.user_id',
        'child_guardians.is_primary',
        'catalog_items.name as relationship',
      ])
      .where('child_guardians.child_id', '=', child?.id ?? '')
      .orderBy('catalog_items.name')
      .execute();
    assert.deepEqual(
      guardians.map((guardian) => guardian.relationship),
      ['Cha', 'Mẹ'],
    );
    const mother = guardians.find((guardian) => guardian.relationship === 'Mẹ');
    assert.equal(mother?.phone, `0${String(firstRows[0]?.mother_phone)}`);
    assert.equal(mother?.birth_year, 1990);
    assert.equal(mother?.occupation, 'Nội trợ');
    assert.equal(mother?.id_number_last4, String(firstRows[0]?.mother_id_number).slice(-4));
    assert.equal(mother?.is_primary, true);
    assert.ok(mother?.user_id, 'mẹ có tài khoản phụ huynh');
    // Không có thông tin cha: trẻ thứ hai chỉ có mẹ
    const second = await childByCode(String(firstRows[1]?.moet_student_code));
    const secondGuardians = await schoolYear
      .selectFrom('child_guardians')
      .select('guardian_id')
      .where('child_id', '=', second?.id ?? '')
      .execute();
    assert.equal(secondGuardians.length, 1);
  });

  it('CT-13a-4: nhập lại bằng xlsx thì cập nhật, không tạo trùng trẻ hay người thân', async () => {
    const before = await schoolYear.selectFrom('children').select('id').execute();
    const rows = firstRows.map((row) => ({ ...row, ethnicity: 'Tày', full_name: `${row.full_name} Sửa` }));
    const uploaded = await upload(
      principal.accessToken,
      'moet_children',
      workbook(MOET_CHILD_COLUMNS, rows),
      units['ĐT-A1'],
    );
    assert.equal(uploaded.body.status, 'validated', JSON.stringify(uploaded.body.errors));
    assert.deepEqual(
      { created: uploaded.body.preview?.created, updated: uploaded.body.preview?.updated },
      { created: 0, updated: 2 },
    );
    const committed = await commit(principal.accessToken, uploaded.body.id);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    const after = await schoolYear.selectFrom('children').select('id').execute();
    assert.equal(after.length, before.length);
    const child = await childByCode(String(firstRows[0]?.moet_student_code));
    assert.equal(child?.full_name, `${firstRows[0]?.full_name} Sửa`);
    assert.equal((child?.moet_profile as Record<string, unknown>).ethnicity, 'Tày');
    const links = await schoolYear
      .selectFrom('child_guardians')
      .select('guardian_id')
      .where('child_id', '=', child?.id ?? '')
      .execute();
    assert.equal(links.length, 2);
  });

  it('CT-13a-5: dòng tiêu đề ở dòng 2, số định danh mất số 0 đầu vẫn nhận; dòng lỗi báo đúng dòng, cột; không ghi dòng nào', async () => {
    const paddedId = `0${nextId().slice(1)}`;
    const rows = [
      childValues({ national_id: Number(paddedId), citizen_id: '' }),
      childValues({ national_id: '123', citizen_id: '' }),
      childValues({ class_label: 'Lớp Không Có' }),
      childValues({ dob: '31/02/2022' }),
      childValues({ status_date: '99/99/2020' }),
      childValues({ student_status: 'Chuyển đi kỳ 1' }),
    ];
    const uploaded = await upload(
      principal.accessToken,
      'moet_children',
      workbook(MOET_CHILD_COLUMNS, rows, { titleRow: true }),
      units['ĐT-A1'],
    );
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.status, 'failed');
    assert.deepEqual(
      uploaded.body.errors.map((error) => [error.row, error.column]),
      [
        [4, 'Số định danh cá nhân'],
        [5, 'Mã lớp'],
        [6, 'Ngày sinh'],
        [7, 'Ngày nhập trạng thái'],
      ],
    );
    assert.equal(uploaded.body.preview?.skipped, 1);
    assert.equal(uploaded.body.preview?.notices[0]?.row, 8);
    const refused = await commit(principal.accessToken, uploaded.body.id);
    assert.equal(refused.status, 422);
    assert.equal(await childByCode(String(rows[0]?.moet_student_code)), undefined);
  });

  it('CT-13a-6: chọn Trường chính thì so khớp lớp toàn trường; tên lớp trùng ở hai đơn vị bị báo, mã lớp thì khớp', async () => {
    const uploaded = await upload(
      principal.accessToken,
      'moet_children',
      workbook(MOET_CHILD_COLUMNS, [childValues({ class_label: 'Lá Hồng' }), childValues({ class_label: 'lh2' })]),
      units.TC,
    );
    assert.deepEqual(
      uploaded.body.errors.map((error) => [error.row, error.column]),
      [[2, 'Mã lớp']],
    );
  });

  it('CT-13a-7: tệp thiếu cột Họ tên, tệp không phải Excel, thiếu đơn vị đều bị từ chối, không tạo lần nhập', async () => {
    const missing = await upload(
      principal.accessToken,
      'moet_children',
      workbook(MOET_CHILD_COLUMNS, [childValues()], { skip: ['full_name'] }),
      units['ĐT-A1'],
    );
    assert.equal(missing.status, 400);
    assert.equal((await upload(principal.accessToken, 'moet_children', PNG, units['ĐT-A1'])).status, 400);
    const noUnit = await upload(
      principal.accessToken,
      'moet_children',
      workbook(MOET_CHILD_COLUMNS, [childValues()]),
      undefined,
    );
    assert.equal(noUnit.status, 400);
  });

  it('CT-13a-8: chỉ Hiệu trưởng nhập tệp trẻ; quản lý đơn vị, giáo viên, kế toán, phòng nhân sự bị từ chối', async () => {
    const file = workbook(MOET_CHILD_COLUMNS, [childValues()]);
    for (const roleCode of ['VT-03', 'VT-07', 'VT-04']) {
      const user = await environment.loginAs(roleCode, units['ĐT-A1'] ?? null);
      assert.equal((await upload(user.accessToken, 'moet_children', file, units['ĐT-A1'])).status, 403, roleCode);
    }
    assert.equal((await upload(personnel.accessToken, 'moet_children', file, units['ĐT-A1'])).status, 403);
  });

  const staffRows = [staffValues(), staffValues({ moet_staff_code: '', id_number: '123456789' })];

  it('CT-13a-9: phòng nhân sự nhập tệp xls cán bộ: tạo hồ sơ, mã định danh Bộ làm mã nhân sự, hồ sơ CSDL ngành, không tạo tài khoản', async () => {
    const file = workbook(MOET_STAFF_COLUMNS, [...staffRows, staffValues({ staff_status: 'Đã nghỉ hưu' })], {
      bookType: 'biff8',
    });
    const uploaded = await upload(personnel.accessToken, 'moet_staff', file, units['ĐT-A1'], 'gv.xls');
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.status, 'validated', JSON.stringify(uploaded.body.errors));
    assert.deepEqual(
      [uploaded.body.preview?.created, uploaded.body.preview?.updated, uploaded.body.preview?.skipped],
      [2, 0, 1],
    );
    const committed = await commit(personnel.accessToken, uploaded.body.id);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));

    const first = await schoolYear
      .selectFrom('staff')
      .selectAll()
      .where('moet_staff_code', '=', String(staffRows[0]?.moet_staff_code))
      .executeTakeFirstOrThrow();
    assert.equal(first.code, staffRows[0]?.moet_staff_code);
    assert.equal(first.org_unit_id, units['ĐT-A1']);
    assert.equal(first.start_date, '2015-08-15');
    assert.equal(first.user_id, null);
    assert.equal(first.id_number_last4, String(staffRows[0]?.id_number).slice(-4));
    const profile = first.moet_profile as Record<string, unknown>;
    assert.equal(profile.salary_coefficient, '2.72');
    assert.equal(profile.party_member, true);
    assert.equal(profile.permanent_district, 'Quận Cũ Thử');
    assert.equal(profile.social_insurance_number_last4, '5678');
    assert.ok(!JSON.stringify(profile).includes('7912345678'));
    const contracts = await schoolYear
      .selectFrom('employment_contracts')
      .select('id')
      .where('staff_id', '=', first.id)
      .execute();
    assert.equal(contracts.length, 0);

    const detail = await api('GET', `/staff/${first.id}`, personnel.accessToken);
    assert.equal(detail.body.moet_staff_code, staffRows[0]?.moet_staff_code);
    const entries = detail.body.moet_profile as Array<{ label: string; value: string }>;
    assert.ok(entries.some((entry) => entry.label === 'Hệ số lương' && entry.value === '2.72'));
  });

  it('CT-13a-10: nhập lại tệp cán bộ bằng xlsx thì cập nhật theo mã định danh Bộ hoặc CMND, không tạo trùng', async () => {
    const before = (await schoolYear.selectFrom('staff').select('id').execute()).length;
    const rows = staffRows.map((row) => ({ ...row, salary_step: 'Bậc 4' }));
    const uploaded = await upload(
      personnel.accessToken,
      'moet_staff',
      workbook(MOET_STAFF_COLUMNS, rows),
      units['ĐT-A1'],
    );
    assert.equal(uploaded.body.status, 'validated', JSON.stringify(uploaded.body.errors));
    assert.deepEqual([uploaded.body.preview?.created, uploaded.body.preview?.updated], [0, 2]);
    assert.equal((await commit(personnel.accessToken, uploaded.body.id)).status, 200);
    const staff = await schoolYear.selectFrom('staff').select(['moet_profile']).execute();
    assert.equal(staff.length, before);
    assert.equal(
      staff.filter((row) => (row.moet_profile as Record<string, unknown> | null)?.salary_step === 'Bậc 4').length,
      2,
    );
  });

  it('CT-13a-11: dòng cán bộ lỗi (CMND sai, ngày sinh sai, trạng thái lạ, trùng mã trong tệp) báo đúng dòng', async () => {
    const code = randomCode();
    const uploaded = await upload(
      personnel.accessToken,
      'moet_staff',
      workbook(MOET_STAFF_COLUMNS, [
        staffValues({ id_number: '12AB' }),
        staffValues({ dob: '30/02/1990' }),
        staffValues({ staff_status: 'Đi chơi' }),
        staffValues({ moet_staff_code: code }),
        staffValues({ moet_staff_code: code }),
      ]),
      units['ĐT-A1'],
    );
    assert.equal(uploaded.body.status, 'failed');
    assert.deepEqual(
      uploaded.body.errors.map((error) => [error.row, error.column]),
      [
        [2, 'CMND/CCCD'],
        [3, 'Ngày sinh'],
        [4, 'Trạng thái CB'],
        [5, 'Mã định danh Bộ GD&ĐT'],
        [6, 'Mã định danh Bộ GD&ĐT'],
      ],
    );
  });

  it('CT-13a-12: chỉ phòng nhân sự nhập tệp cán bộ; Hiệu trưởng, kế toán, giáo viên bị từ chối; đơn vị ngoài phạm vi bị từ chối', async () => {
    const file = workbook(MOET_STAFF_COLUMNS, [staffValues()]);
    assert.equal((await upload(principal.accessToken, 'moet_staff', file, units['ĐT-A1'])).status, 403);
    for (const roleCode of ['VT-04', 'VT-07']) {
      const user = await environment.loginAs(roleCode, units['ĐT-A1'] ?? null);
      assert.equal((await upload(user.accessToken, 'moet_staff', file, units['ĐT-A1'])).status, 403, roleCode);
    }
    assert.equal((await upload(personnel.accessToken, 'moet_staff', file, units['ĐT-A2'])).status, 403);
  });
});

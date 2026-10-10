import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { IMPORT_COLUMNS } from './imports.service.js';

// Nhập dữ liệu ban đầu và mã ngành; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 4.11
// và 02_P02_VA_P04.md mục 3.10
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let counter = randomInt(0, 100_000);
const nextNationalId = () =>
  `080${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++counter % 1000).padStart(3, '0')}`;
type Job = {
  id: string;
  status: string;
  total_rows: number;
  error_rows: number;
  errors: Array<{ row: number; column: string }>;
};

async function workbook(
  type: keyof typeof IMPORT_COLUMNS,
  rows: Array<Record<string, string | Date>>,
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Dữ liệu');
  const columns = IMPORT_COLUMNS[type];
  sheet.addRow(columns.map((column) => column.header));
  for (const row of rows) {
    sheet.addRow(columns.map((column) => row[column.key] ?? ''));
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe('Nhập dữ liệu ban đầu từ Excel và nhập mã ngành', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};

  const send = async (path: string, token: string, file: Buffer, fields: Record<string, string> = {}) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), 'du-lieu.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);

  const childRow = (overrides: Record<string, string> = {}) => ({
    unit_code: 'ĐT-A1',
    class_code: 'LA1',
    full_name: `Trẻ nhập ${randomInt(0, 1_000_000)}`,
    dob: '18/04/2022',
    gender: 'Nam',
    national_id: nextNationalId(),
    allergies: 'Không',
    guardian1_name: 'Mẹ của trẻ',
    guardian1_relationship: 'Mẹ',
    guardian1_phone: randomPhone(),
    ...overrides,
  });

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
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'LA',
      name: 'Lá',
      age_from_months: 60,
      age_to_months: 71,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
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
    await environment.close();
  });

  it('CTC-P01-076: Hiệu trưởng tải mẫu Excel loại trẻ có đúng các cột', async () => {
    const response = await fetch(`${environment.baseUrl}/imports/templates/children`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(response.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    const header = book.worksheets[0]?.getRow(1).values as unknown[];
    assert.deepEqual(
      header.slice(1),
      IMPORT_COLUMNS.children.map((column) => column.header),
    );
  });

  it('P01-13: nhập lớp học từ Excel; mã lớp trùng bị báo', async () => {
    const file = await workbook('classes', [
      { unit_code: 'ĐT-A1', class_code: 'LA1', class_name: 'Lá 1', grade_level: 'LA', max_size: '25' },
      { unit_code: 'ĐT-A1', class_code: 'LA2', class_name: 'Lá 2', grade_level: 'LA', max_size: '25' },
      { unit_code: 'PH-B', class_code: 'LA1', class_name: 'Lá 1', grade_level: 'LA', max_size: '20' },
    ]);
    const uploaded = await send('/imports', principal.accessToken, file, { type: 'classes' });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.status, 'validated');
    const committed = await api('POST', `/imports/${uploaded.body.id}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.equal(committed.body.status, 'committed');
    const classes = (await api('GET', `/classes?org_unit_id=${units['ĐT-A1']}`, principal.accessToken))
      .body as unknown as unknown[];
    assert.equal(classes.length, 2);

    const duplicate = await send(
      '/imports',
      principal.accessToken,
      await workbook('classes', [
        { unit_code: 'ĐT-A1', class_code: 'LA1', class_name: 'Lá 1', grade_level: 'LA', max_size: '25' },
      ]),
      { type: 'classes' },
    );
    assert.equal(duplicate.body.status, 'failed');
  });

  it('CTC-P01-077, CTC-P01-078: tệp 50 trẻ có dòng 17 thiếu ngày sinh bị báo và không ghi; sửa xong thì ghi đủ 50 trẻ đang học', async () => {
    const rows = Array.from({ length: 50 }, () => childRow());
    const broken = rows.map((row, index) => (index === 15 ? { ...row, dob: '' } : row));
    const failed = await send('/imports', principal.accessToken, await workbook('children', broken), {
      type: 'children',
    });
    assert.equal(failed.status, 201, JSON.stringify(failed.body));
    const job = failed.body as unknown as Job;
    assert.equal(job.status, 'failed');
    assert.equal(job.error_rows, 1);
    assert.deepEqual(
      job.errors.map((error) => [error.row, error.column]),
      [[17, 'Ngày sinh']],
    );
    const refused = await api('POST', `/imports/${job.id}/commit`, principal.accessToken);
    assert.equal(refused.status, 422);
    const before = (await api('GET', '/children?page_size=100', principal.accessToken)).body.total as number;
    assert.equal(before, 0);

    const fixed = await send('/imports', principal.accessToken, await workbook('children', rows), { type: 'children' });
    assert.equal(fixed.body.status, 'validated', JSON.stringify(fixed.body));
    const committed = await api('POST', `/imports/${fixed.body.id}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    const listed = await api('GET', '/children?page_size=100&status=active', principal.accessToken);
    assert.equal(listed.body.total, 50);
    const missing = await api('GET', '/children?page_size=100&missing_birth_certificate=true', principal.accessToken);
    assert.equal(missing.body.total, 50);
    const accounts = await environment.identity.database
      .selectFrom('users')
      .select('id')
      .where(
        'phone',
        'in',
        rows.map((row) => row.guardian1_phone),
      )
      .execute();
    assert.equal(accounts.length, 50);
  });

  it('CTC-P01-084: hai dòng trùng số định danh, hoặc trùng trẻ đã có, đều bị báo', async () => {
    const nationalId = nextNationalId();
    const duplicateInFile = await send(
      '/imports',
      principal.accessToken,
      await workbook('children', [childRow({ national_id: nationalId }), childRow({ national_id: nationalId })]),
      { type: 'children' },
    );
    assert.equal((duplicateInFile.body as unknown as Job).error_rows, 2);
    const existing = (await api('GET', '/children?page_size=1', principal.accessToken)).body.items as Array<{
      id: string;
    }>;
    const full = await api('GET', `/children/${existing[0]?.id}/national-id`, principal.accessToken);
    const againstExisting = await send(
      '/imports',
      principal.accessToken,
      await workbook('children', [childRow({ national_id: full.body.national_id as string })]),
      { type: 'children' },
    );
    assert.equal(againstExisting.body.status, 'failed');
  });

  it('CTC-P01-080, CTC-P01-081: giáo viên và kế toán không nhập được tệp trẻ', async () => {
    const file = await workbook('children', [childRow()]);
    const teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);
    assert.equal((await send('/imports', teacher.accessToken, file, { type: 'children' })).status, 403);
    const accountant = await environment.loginAs('VT-04', units['ĐT-A1'] ?? null);
    assert.equal((await send('/imports', accountant.accessToken, file, { type: 'children' })).status, 403);
  });

  it('CTC-P01-083: tệp đổi đuôi không phải Excel và tệp vượt dung lượng bị từ chối, không tạo lần nhập', async () => {
    const fake = await send('/imports', principal.accessToken, PNG, { type: 'children' });
    assert.equal(fake.status, 400);
    const huge = await send('/imports', principal.accessToken, Buffer.alloc(6 * 1024 * 1024, 1), { type: 'children' });
    assert.equal(huge.status, 400);
  });

  it('CTC-P02-065, CTC-P02-066, CTC-P02-067: mã ngành gán theo số định danh; dòng không khớp và mã trùng bị báo, dòng khớp vẫn được gán', async () => {
    const page = (await api('GET', '/children?page_size=3', principal.accessToken)).body.items as Array<{ id: string }>;
    const ids = await Promise.all(
      page.map(
        async (child) =>
          (await api('GET', `/children/${child.id}/national-id`, principal.accessToken)).body.national_id as string,
      ),
    );
    const suffix = randomInt(0, 1_000_000);
    const admissions = await environment.loginAs('VT-12', units['ĐT-A1'] ?? null);
    const result = await send(
      '/imports/moet-codes',
      admissions.accessToken,
      await workbook('moet_codes', [
        { national_id: ids[0] ?? '', moet_code: `M${suffix}-1` },
        { national_id: ids[1] ?? '', moet_code: `M${suffix}-2` },
        { national_id: '999999999999', moet_code: `M${suffix}-3` },
        { national_id: ids[2] ?? '', moet_code: `M${suffix}-1` },
      ]),
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.assigned_rows, 1);
    const errors = (result.body as unknown as Job).errors.map((error) => error.row).sort();
    assert.deepEqual(errors, [2, 4, 5]);
    const assigned = await api('GET', `/children/${page[1]?.id}`, principal.accessToken);
    assert.equal(assigned.body.moet_student_code, `M${suffix}-2`);

    const taken = await send(
      '/imports/moet-codes',
      admissions.accessToken,
      await workbook('moet_codes', [{ national_id: ids[0] ?? '', moet_code: `M${suffix}-2` }]),
    );
    assert.equal(taken.body.assigned_rows, 0);
  });

  it('CTC-P02-068: kế toán và giáo viên không nhập được mã ngành', async () => {
    const file = await workbook('moet_codes', [{ national_id: nextNationalId(), moet_code: 'X' }]);
    for (const roleCode of ['VT-04', 'VT-07']) {
      const user = await environment.loginAs(roleCode, units['ĐT-A1'] ?? null);
      assert.equal((await send('/imports/moet-codes', user.accessToken, file)).status, 403);
    }
  });

  it('YCTD-46: quản lý đơn vị bổ sung giấy khai sinh cho trẻ nhập mà không cần lý do', async () => {
    const page = (await api('GET', '/children?page_size=1&missing_birth_certificate=true', principal.accessToken)).body
      .items as Array<{ id: string }>;
    const manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    const form = new FormData();
    form.set('org_unit_id', units['ĐT-A1'] ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay.png');
    const uploaded = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${manager.accessToken}` },
      body: form,
    });
    const file = (await uploaded.json()) as { id: string };
    const updated = await api('PATCH', `/children/${page[0]?.id}`, manager.accessToken, {
      birth_certificate_file_id: file.id,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.birth_certificate_file_id, file.id);
  });
});

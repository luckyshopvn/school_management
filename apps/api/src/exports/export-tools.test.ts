import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import * as XLSX from 'xlsx';
import { ExportJobs } from './export-jobs.js';
import { buildTableFile, cellText, withExtension } from './table-file.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên chạy nội bộ (DT-16 phần 16a, YCTD-118): Xuất PDF từ lưới, tác vụ
// xuất nền và Tệp đã tạo, Xuất file lỗi, tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, gửi lên cấp trên
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string };

describe('Hàm dựng tệp bảng Excel, PDF', () => {
  it('CT-16a-1: cùng cột, cùng dòng ra Excel và PDF có dấu tiếng Việt; đổi phần mở rộng theo định dạng', async () => {
    const sheet = {
      title: 'Danh sách học sinh',
      columns: [
        { key: 'name', label: 'Họ tên' },
        { key: 'dob', label: 'Ngày sinh' },
      ],
      rows: [{ name: 'Nguyễn Thị Ánh', dob: '2022-04-18' }],
      numbered: true,
    };
    const pdf = await buildTableFile('pdf', [sheet], new Date());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const xlsx = await buildTableFile('xlsx', [sheet], new Date());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx as unknown as ArrayBuffer);
    const rows: unknown[][] = [];
    workbook.worksheets[0]?.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    assert.deepEqual(rows, [
      ['STT', 'Họ tên', 'Ngày sinh'],
      [1, 'Nguyễn Thị Ánh', '2022-04-18'],
    ]);
    assert.equal(withExtension('danh-sach.xlsx', 'pdf'), 'danh-sach.pdf');
    assert.equal(cellText(true), 'Có');
    assert.equal(cellText(null), '');
  });
});

describe('Công cụ xuất, nhập và gửi lên cấp trên (YCTD-118)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let statistician: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  let mother = '';
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const jobs = () => environment.api.get(ExportJobs);

  async function post(path: string, token: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return { response, buffer: Buffer.from(await response.arrayBuffer()) };
  }

  async function get(path: string, token: string) {
    const response = await fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return { response, buffer: Buffer.from(await response.arrayBuffer()) };
  }

  async function sheetRows(buffer: Buffer, sheetName?: string): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
    const rows: string[][] = [];
    sheet?.eachRow((row) => rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? ''))));
    return rows;
  }

  async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Dữ liệu');
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(row);
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async function upload(file: Buffer, fields: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([new Uint8Array(file)]), 'lop-hoc.xlsx');
    const response = await fetch(`${environment.baseUrl}/imports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${principal.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function enrol(fullName: string, classCode: string) {
    const form = new FormData();
    form.set('org_unit_id', units.A ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.A,
      full_name: fullName,
      dob: '2022-04-18',
      gender: 'female',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    assert.equal((await api('POST', `/children/${id}/submit`, principal.accessToken)).status, 200);
    const approved = await api('POST', `/children/${id}/approve`, principal.accessToken, {
      class_id: classes[classCode],
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
  }

  before(async () => {
    // Một lần xuất trực tiếp tối đa 1 dòng để danh sách hai học sinh phải xuất bằng tác vụ nền
    environment = await startApiTestEnvironment({ syncExportRowLimit: 1 });
    principal = await environment.loginAs('VT-02', null);
    statistician = await environment.loginAs('VT-15', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    const saved = await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
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
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'ĐT-A', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, {
        code,
        name: `Đơn vị ${code}`,
        unit_type: type,
      });
      units[key] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['MAM', 'Mầm', 36, 47],
      ['CHOI', 'Chồi', 48, 59],
    ] as const) {
      await api('POST', '/grade-levels', principal.accessToken, {
        code,
        name,
        age_from_months: from,
        age_to_months: to,
      });
    }
    for (const code of ['M1', 'M2']) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units.A,
        code,
        name: `Lớp ${code}`,
        grade_level: 'MAM',
        max_size: 30,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      classes[code] = created.body.id as string;
    }
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    mother = relationship.body.id as string;
    await enrol('Trần Thị An', 'M1');
    await enrol('Lê Thị Bình', 'M2');
  });

  after(async () => {
    const identityDatabase = environment.identity.database;
    await identityDatabase.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identityDatabase
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16a-2: Xuất PDF lớp học đúng cột đang hiện, ghi nhật ký xuất như Xuất Excel; định dạng lạ bị từ chối', async () => {
    const { response, buffer } = await post('/classes/export', principal.accessToken, {
      columns: ['code', 'name'],
      format: 'pdf',
    });
    assert.equal(response.status, 200, buffer.toString());
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition') ?? '', /\.pdf"/);
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    const log = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('id', '=', response.headers.get('x-export-log-id') ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(log.report_code, 'classes');
    assert.match(log.file_name, /\.pdf$/);
    assert.equal((log.filters_data as Record<string, unknown>).format, 'pdf');
    const invalid = await post('/classes/export', principal.accessToken, { format: 'docx' });
    assert.equal(invalid.response.status, 400);
    // Phân công phụ trách lớp và biến động học sinh cũng xuất được PDF
    for (const path of ['/class-assignments/export', '/student-movements/export']) {
      const file = await post(path, principal.accessToken, { format: 'pdf' });
      assert.equal(file.response.status, 200, `${path}: ${file.buffer.toString()}`);
      assert.equal(file.buffer.subarray(0, 5).toString(), '%PDF-');
    }
  });

  it('CT-16a-3: danh sách vượt số dòng xuất trực tiếp tạo tác vụ nền; tiến trình nền tạo tệp; người tạo xem và tải ở Tệp đã tạo', async () => {
    const { response, buffer } = await post('/children/export', principal.accessToken, {
      columns: ['full_name'],
      format: 'xlsx',
    });
    assert.equal(response.status, 202, buffer.toString());
    const job = (JSON.parse(buffer.toString()) as { job: { id: string; status: string; title: string } }).job;
    assert.equal(job.status, 'pending');
    assert.equal(job.title, 'Danh sách học sinh');
    const pending = await api('GET', '/export-jobs', principal.accessToken);
    assert.equal((pending.body.items as Array<{ id: string }>)[0]?.id, job.id);
    // Chưa xong thì chưa tải được
    assert.equal((await get(`/export-jobs/${job.id}/file`, principal.accessToken)).response.status, 422);

    await jobs().tick();
    const done = (await api('GET', '/export-jobs', principal.accessToken)).body.items as Array<Record<string, unknown>>;
    assert.equal(done[0]?.status, 'done');
    assert.equal(done[0]?.row_count, 2);
    assert.ok(done[0]?.expires_at);
    const file = await get(`/export-jobs/${job.id}/file`, principal.accessToken);
    assert.equal(file.response.status, 200);
    assert.equal(file.response.headers.get('content-type'), XLSX_TYPE);
    const rows = await sheetRows(file.buffer);
    assert.deepEqual(rows[0], ['STT', 'Họ tên']);
    assert.deepEqual(
      rows.slice(1).map((row) => row[1]),
      ['Trần Thị An', 'Lê Thị Bình'],
    );
    // Tiến trình nền vẫn ghi nhật ký xuất có dữ liệu cá nhân
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'contains_personal_data', 'user_id'])
      .where('report_code', '=', 'children')
      .execute();
    assert.deepEqual(logs, [
      { report_code: 'children', row_count: 2, contains_personal_data: true, user_id: principal.userId },
    ]);
    // Người khác không thấy, không tải được tệp của người tạo
    assert.deepEqual((await api('GET', '/export-jobs', statistician.accessToken)).body.items, []);
    assert.equal((await get(`/export-jobs/${job.id}/file`, statistician.accessToken)).response.status, 404);

    // Hết hạn thì xóa tệp, chuyển trạng thái Hết hạn, không tải được nữa
    await environment.system
      .updateTable('export_jobs')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .execute();
    await jobs().tick();
    const expired = await environment.system
      .selectFrom('export_jobs')
      .select(['status', 'storage_key'])
      .where('id', '=', job.id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(expired, { status: 'expired', storage_key: null });
    const gone = await get(`/export-jobs/${job.id}/file`, principal.accessToken);
    assert.equal(gone.response.status, 422);
    assert.equal(errorOf(JSON.parse(gone.buffer.toString())).rule_code, 'YCTD-118');
  });

  it('CT-16a-4: danh sách trong số dòng xuất trực tiếp thì trả tệp ngay; tác vụ nền lỗi chuyển trạng thái Lỗi kèm ghi chú', async () => {
    // Một dòng học sinh thì xuất trực tiếp, không tạo tác vụ
    const direct = await post('/children/export', principal.accessToken, { q: 'Trần Thị An', format: 'pdf' });
    assert.equal(direct.response.status, 200);
    assert.equal(direct.buffer.subarray(0, 5).toString(), '%PDF-');
    // Tác vụ không dựng được tệp (giả lập bằng mã báo cáo không có hàm xuất) chuyển Lỗi, không lộ chi tiết máy chủ
    const created = await environment.system
      .insertInto('export_jobs')
      .values({
        user_id: principal.userId,
        user_name: 'Hiệu trưởng',
        user_snapshot: JSON.stringify({ id: principal.userId, full_name: 'Hiệu trưởng', assignments: [] }),
        report_code: 'khong-co',
        title: 'Không có',
        format: 'pdf',
        parameters: JSON.stringify({}),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await jobs().tick();
    const failed = await environment.system
      .selectFrom('export_jobs')
      .select(['status', 'error_message'])
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error_message, 'Không tạo được tệp, vui lòng thử xuất lại');
  });

  it('CT-16a-5: tải file mẫu kèm dữ liệu và trang Danh mục; tra cứu danh mục theo phạm vi; loại chưa có mẫu kèm dữ liệu bị từ chối', async () => {
    const template = await get('/imports/templates/classes?with_data=true', principal.accessToken);
    assert.equal(template.response.status, 200);
    const rows = await sheetRows(template.buffer);
    assert.deepEqual(rows[0], ['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Mã bậc học', 'Sĩ số tối đa', 'Mã phòng']);
    assert.deepEqual(
      rows.slice(1).map((row) => row.slice(0, 5)),
      [
        ['ĐT-A', 'M1', 'Lớp M1', 'MAM', '30'],
        ['ĐT-A', 'M2', 'Lớp M2', 'MAM', '30'],
      ],
    );
    const lookup = await sheetRows(template.buffer, 'Danh mục');
    assert.ok(lookup.some((row) => row[0] === 'Bậc học' && row[2] === 'MAM' && row[3] === 'Mầm'));
    assert.ok(lookup.some((row) => row[0] === 'Đơn vị' && row[2] === 'ĐT-A'));
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['row_count'])
      .where('report_code', '=', 'import-template-classes')
      .executeTakeFirstOrThrow();
    assert.equal(log.row_count, 2);

    const catalogs = await api('GET', '/imports/catalogs/children', principal.accessToken);
    assert.equal(catalogs.status, 200);
    const items = catalogs.body.items as Array<{ key: string; items: Array<{ code: string; name: string }> }>;
    assert.deepEqual(
      items.map((catalog) => catalog.key),
      ['org_units', 'classes', 'parent_relationships'],
    );
    assert.deepEqual(items[2]?.items, [{ code: 'ME', name: 'Mẹ' }]);
    const columns = await api('GET', '/imports/templates/children/columns', principal.accessToken);
    const childColumns = columns.body.columns as Array<{ key: string; locked: boolean }>;
    assert.equal(childColumns.find((column) => column.key === 'national_id')?.locked, true);
    assert.equal(childColumns.find((column) => column.key === 'address')?.locked, false);
    assert.equal(columns.body.template_with_data, false);
    const refused = await get('/imports/templates/children?with_data=true', principal.accessToken);
    assert.equal(refused.response.status, 422);
    // Giáo viên không có quyền nhập
    const teacher = await environment.loginAs('VT-07', units.A ?? null);
    assert.equal((await api('GET', '/imports/catalogs/classes', teacher.accessToken)).status, 403);
  });

  it('CT-16a-6: chọn cột để nhập: lớp đã có chỉ cập nhật cột được chọn, lớp mới cần đủ cột bắt buộc; Xuất file lỗi có cột Nội dung lỗi', async () => {
    // Tệp chỉ có cột khóa và Tên lớp: cập nhật tên lớp M1, không đổi sĩ số
    const renamed = await upload(await workbook(['Mã đơn vị', 'Mã lớp', 'Tên lớp'], [['ĐT-A', 'M1', 'Mầm Một']]), {
      type: 'classes',
      columns: 'class_name',
    });
    assert.equal(renamed.status, 201, JSON.stringify(renamed.body));
    assert.equal(renamed.body.status, 'validated', JSON.stringify(renamed.body.errors));
    assert.deepEqual(renamed.body.selected_columns, ['unit_code', 'class_code', 'class_name']);
    const committed = await api('POST', `/imports/${renamed.body.id as string}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    const updated = await schoolYear
      .selectFrom('classes')
      .select(['name', 'max_size'])
      .where('id', '=', classes.M1 ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(updated, { name: 'Mầm Một', max_size: 30 });
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_id', '=', classes.M1 ?? '')
      .where('action', '=', 'update')
      .execute();
    assert.equal(audit.length, 1);

    // Lớp mới thiếu cột bắt buộc được chọn; lớp đã có đổi bậc học bị chặn; mã đơn vị sai
    const broken = await upload(
      await workbook(
        ['Mã đơn vị', 'Mã lớp', 'Tên lớp', 'Mã bậc học'],
        [
          ['ĐT-A', 'M9', 'Lớp mới', 'MAM'],
          ['ĐT-A', 'M2', 'Lớp M2', 'CHOI'],
          ['ĐT-X', 'M3', 'Lớp X', 'MAM'],
        ],
      ),
      { type: 'classes', columns: 'class_name,grade_level' },
    );
    assert.equal(broken.body.status, 'failed');
    const errors = broken.body.errors as Array<{ row: number; column: string; message: string }>;
    assert.ok(errors.some((error) => error.row === 2 && error.column === 'Sĩ số tối đa'));
    assert.ok(errors.some((error) => error.row === 3 && error.column === 'Mã bậc học'));
    assert.ok(errors.some((error) => error.row === 4 && error.column === 'Mã đơn vị'));

    const errorFile = await get(`/imports/${broken.body.id as string}/error-file`, principal.accessToken);
    assert.equal(errorFile.response.status, 200);
    assert.match(errorFile.response.headers.get('content-disposition') ?? '', /filename\*=UTF-8''lop-hoc-loi\.xlsx/);
    const book = XLSX.read(errorFile.buffer, { type: 'buffer' });
    const sheet = book.Sheets[book.SheetNames[0] ?? ''];
    const grid = XLSX.utils.sheet_to_json<string[]>(sheet ?? {}, { header: 1, defval: '' });
    assert.equal(grid[0]?.[4], 'Nội dung lỗi');
    assert.match(grid[1]?.[4] ?? '', /Sĩ số tối đa: Thêm lớp mới cần chọn nhập cột này/);
    assert.match(grid[3]?.[4] ?? '', /Mã đơn vị: /);
    assert.equal(grid[1]?.[1], 'M9', 'giữ nguyên dữ liệu gốc');

    // Không có dòng lỗi thì không có tệp lỗi; cột không có trong mẫu bị báo
    const noErrors = await get(`/imports/${renamed.body.id as string}/error-file`, principal.accessToken);
    assert.equal(noErrors.response.status, 422);
    const unknown = await upload(await workbook(['Mã đơn vị', 'Mã lớp'], [['ĐT-A', 'M1']]), {
      type: 'classes',
      columns: 'salary',
    });
    assert.equal(unknown.status, 400);
    // Chọn cột mà tệp không có tiêu đề cột đó
    const missing = await upload(await workbook(['Mã đơn vị', 'Mã lớp'], [['ĐT-A', 'M1']]), {
      type: 'classes',
      columns: 'max_size',
    });
    assert.equal(missing.status, 400);
  });

  it('CT-16a-7: gửi lên cấp trên: xuất tệp gửi, chưa hoàn thành dữ liệu thì không đánh dấu đã gửi, khóa sau khi gửi, yêu cầu và xử lý mở khóa', async () => {
    const form = 'emis-start-of-year';
    const listed = await api('GET', `/upper-level-submissions?forms=${form}`, statistician.accessToken);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const first = (listed.body.items as Array<Record<string, unknown>>)[0];
    assert.equal(first?.status, 'draft');
    assert.equal(first?.data_complete, false, 'chưa khai báo loại hình trường');
    assert.equal(first?.can_unlock, false);

    const exported = await api('POST', `/upper-level-submissions/${form}/export`, statistician.accessToken);
    assert.equal(exported.status, 200, JSON.stringify(exported.body));
    assert.equal(exported.body.exported_data_complete, false);
    const today = VIETNAM_DATE.format(new Date());
    const incomplete = await api('POST', `/upper-level-submissions/${form}/mark-sent`, statistician.accessToken, {
      sent_on: today,
    });
    assert.equal(incomplete.status, 422);
    assert.equal(errorOf(incomplete.body).rule_code, 'YCTD-118');

    // Khai báo loại hình trường rồi xuất lại; tệp gửi là Excel của Biểu 1, bản chụp lưu số liệu
    const profile = await api('PUT', '/school-profile', principal.accessToken, {
      general: { ownership_type: 'private' },
    });
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    const again = await api('POST', `/upper-level-submissions/${form}/export`, statistician.accessToken);
    assert.equal(again.body.exported_data_complete, true);
    const file = await get(`/upper-level-submissions/${form}/file`, statistician.accessToken);
    assert.equal(file.response.status, 200);
    assert.match(file.response.headers.get('content-disposition') ?? '', /emis-dau-nam/);
    const stored = await environment.system
      .selectFrom('upper_level_submissions')
      .select(['snapshot', 'exported_by'])
      .where('form_code', '=', form)
      .executeTakeFirstOrThrow();
    assert.equal((stored.snapshot as { ownership: string }).ownership, 'private');
    assert.equal(stored.exported_by, statistician.userId);

    const future = await api('POST', `/upper-level-submissions/${form}/mark-sent`, statistician.accessToken, {
      sent_on: '2999-01-01',
    });
    assert.equal(future.status, 400);
    const noData = await api('POST', `/upper-level-submissions/${form}/mark-sent`, statistician.accessToken, {
      sent_on: today,
      no_data: true,
    });
    assert.equal(noData.status, 422, 'Biểu 1 không cho đánh dấu trường không có dữ liệu');
    const sent = await api('POST', `/upper-level-submissions/${form}/mark-sent`, statistician.accessToken, {
      sent_on: today,
      note: 'Nộp qua thư điện tử',
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.deepEqual([sent.body.status, sent.body.sent_on], ['sent', today]);
    // Đã gửi thì khóa
    assert.equal((await api('POST', `/upper-level-submissions/${form}/export`, statistician.accessToken)).status, 422);

    // Người lập không mở khóa được; gửi yêu cầu mở khóa cần lý do
    assert.equal(
      (await api('POST', `/upper-level-submissions/${form}/unlock`, statistician.accessToken, { approve: true }))
        .status,
      403,
    );
    assert.equal(
      (await api('POST', `/upper-level-submissions/${form}/unlock-request`, statistician.accessToken, {})).status,
      400,
    );
    const requested = await api('POST', `/upper-level-submissions/${form}/unlock-request`, statistician.accessToken, {
      reason: 'Sai số trẻ 5 tuổi',
    });
    assert.equal(requested.body.status, 'unlock_requested');
    const rejected = await api('POST', `/upper-level-submissions/${form}/unlock`, principal.accessToken, {
      approve: false,
      note: 'Số liệu đúng',
    });
    assert.equal(rejected.body.status, 'sent');
    await api('POST', `/upper-level-submissions/${form}/unlock-request`, statistician.accessToken, {
      reason: 'Sửa lại',
    });
    const unlocked = await api('POST', `/upper-level-submissions/${form}/unlock`, principal.accessToken, {
      approve: true,
    });
    assert.equal(unlocked.body.status, 'resend');
    assert.equal(unlocked.body.unlock_reason, null);
    // Cần gửi lại thì xuất lại được; đặt trạng thái gửi lại chỉ cho biểu mẫu đã gửi
    assert.equal((await api('POST', `/upper-level-submissions/${form}/export`, statistician.accessToken)).status, 200);
    assert.equal((await api('POST', `/upper-level-submissions/${form}/resend`, principal.accessToken, {})).status, 422);
    await api('POST', `/upper-level-submissions/${form}/mark-sent`, statistician.accessToken, { sent_on: today });
    const resend = await api('POST', `/upper-level-submissions/${form}/resend`, principal.accessToken, {
      note: 'Sở yêu cầu gửi lại',
    });
    assert.equal(resend.body.status, 'resend');

    const events = await api('GET', `/upper-level-submissions/${form}/events`, principal.accessToken);
    assert.deepEqual((events.body.items as Array<{ action: string }>).map((event) => event.action).reverse(), [
      'export',
      'export',
      'mark_sent',
      'unlock_request',
      'unlock_reject',
      'unlock_request',
      'unlock',
      'export',
      'mark_sent',
      'resend',
    ]);
    // Biểu mẫu lạ, người không có quyền
    assert.equal((await api('GET', '/upper-level-submissions?forms=khong-co', principal.accessToken)).status, 404);
    const teacher = await environment.loginAs('VT-07', units.A ?? null);
    assert.equal((await api('GET', `/upper-level-submissions?forms=${form}`, teacher.accessToken)).status, 403);
  });
});

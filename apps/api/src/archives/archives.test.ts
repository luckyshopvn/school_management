import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseHoldingInput, parseRecordInput, readRecordFilter } from './archive-fields.js';
import { detectArchiveFileType } from './archives.js';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-117); kịch bản CT-15h2-1 đến CT-15h2-10
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const fieldsOf = (body: Record<string, unknown>) => (errorOf(body).details ?? []).map((detail) => detail.field).sort();

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

const pendingRecord = {
  code: '01/HS-VT',
  title: 'Hồ sơ tuyển sinh năm học 2026-2027',
  handler_name: 'Nguyễn Văn Thư',
  opened_on: '2026-01-05',
  due_date: '2026-02-10',
  status: 'pending',
  retention: 'limited',
  retention_years: 10,
  sheet_count: 25,
};

describe('Kiểm tra biểu mẫu văn thư lưu trữ', () => {
  it('CT-15h2-1: hồ sơ hoàn thành phải có ngày hoàn thành; thời hạn, ngày hoàn thành không trước ngày mở', () => {
    assert.deepEqual(parseRecordInput({ ...pendingRecord, note: ' ' }), {
      ...pendingRecord,
      fond_id: null,
      completed_on: null,
      note: null,
    });
    const completed = parseRecordInput({
      ...pendingRecord,
      status: 'completed',
      completed_on: '2026-02-01',
      retention: 'permanent',
      retention_years: null,
    });
    assert.equal(completed.completed_on, '2026-02-01');
    assert.equal(completed.retention_years, null);
    for (const [body, fields] of [
      [{ ...pendingRecord, status: 'completed' }, ['completed_on']],
      [{ ...pendingRecord, completed_on: '2026-02-01' }, ['completed_on']],
      [{ ...pendingRecord, status: 'completed', completed_on: '2025-12-31' }, ['completed_on']],
      [{ ...pendingRecord, due_date: '2026-01-01' }, ['due_date']],
      [{ ...pendingRecord, retention_years: null }, ['retention_years']],
      [{ ...pendingRecord, retention: 'permanent' }, ['retention_years']],
      [
        { ...pendingRecord, code: '', title: ' ', handler_name: undefined, opened_on: '05/01/2026' },
        ['code', 'handler_name', 'opened_on', 'title'],
      ],
      [{ ...pendingRecord, status: 'done', fond_id: 'x', sheet_count: -1 }, ['fond_id', 'sheet_count', 'status']],
    ] as Array<[Record<string, unknown>, string[]]>) {
      assert.throws(
        () => parseRecordInput(body),
        (error: { code?: string; details?: Array<{ field: string }> }) =>
          error.code === 'ERR_VALIDATION' &&
          JSON.stringify(error.details?.map((detail) => detail.field).sort()) === JSON.stringify(fields),
      );
    }
  });

  it('CT-15h2-2: thông tin lưu trữ: giai đoạn đúng thứ tự, tài liệu vĩnh viễn không hết giá trị, số mét giá hai chữ số lẻ', () => {
    const valid = {
      fond_id: '11111111-1111-4111-8111-111111111111',
      period_from_year: 2010,
      period_to_year: 2015,
      arranged: true,
      retention: 'permanent',
      shelf_meters: 1.25,
      storage_location: 'Kho tầng 1',
    };
    assert.deepEqual(parseHoldingInput(valid), {
      ...valid,
      expired: false,
      retention_years: null,
      bundle_count: 0,
      box_count: 0,
      note: null,
    });
    for (const body of [
      { ...valid, period_to_year: 2009 },
      { ...valid, expired: true },
      { ...valid, shelf_meters: 1.255 },
      { ...valid, shelf_meters: -1 },
      { ...valid, arranged: undefined },
      { ...valid, fond_id: undefined },
      { ...valid, storage_location: '' },
      { ...valid, box_count: 1.5 },
    ]) {
      assert.throws(() => parseHoldingInput(body), { code: 'ERR_VALIDATION' });
    }
    const errors: FieldError[] = [];
    assert.deepEqual(readRecordFilter({ status: 'pending', overdue: 'true', search: ' HS ' }, errors), {
      status: 'pending',
      search: 'HS',
      fond_id: null,
      handler: null,
      due_from: null,
      due_to: null,
      overdue: true,
    });
    readRecordFilter({ status: 'x', due_from: '2026-13-45', fond_id: 'x' }, errors);
    assert.deepEqual(errors.map((error) => error.field).sort(), ['due_from', 'fond_id', 'status']);
  });

  it('nhận PDF, ảnh, Word, Excel theo nội dung tệp; từ chối tệp khác', () => {
    assert.equal(detectArchiveFileType('cong-van.pdf', PDF), 'application/pdf');
    assert.equal(detectArchiveFileType('anh.bin', Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(
      detectArchiveFileType('to-trinh.docx', ZIP),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    assert.equal(detectArchiveFileType('to-trinh.zip', ZIP), undefined);
    assert.equal(detectArchiveFileType('mau.doc', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1])), 'application/msword');
    assert.equal(detectArchiveFileType('script.exe', Buffer.from('MZ')), undefined);
  });
});

describe('Điểm cuối văn thư lưu trữ', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  let vicePrincipal: LoggedInUser;
  let unitManager: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let fondId: string;
  let otherFondId: string;
  let pendingId: string;
  let completedId: string;
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser | undefined, body?: unknown) =>
    sendJson(method, url(path), user?.accessToken, body);

  async function download(path: string, user: LoggedInUser, body: unknown) {
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${user.accessToken}` },
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

  async function upload(recordId: string, user: LoggedInUser, body: Buffer, fileName: string) {
    const form = new FormData();
    form.set('file', new Blob([body]), fileName);
    const response = await fetch(url(`/archive-records/${recordId}/files`), {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const auditActions = async (entityId: string) =>
    (
      await schoolYear
        .selectFrom('audit_logs')
        .select(['action', 'entity_name'])
        .where('entity_id', '=', entityId)
        .orderBy('created_at')
        .execute()
    ).map((row) => `${row.entity_name}:${row.action}`);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    accountant = await environment.loginAs('VT-04', null);
    vicePrincipal = await environment.loginAs('VT-15', null);
    unitManager = await environment.loginAs('VT-03', null);
    teacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-15h2-3: chưa mở năm học thì không ghi được vì nhật ký thao tác nằm ở năm học (BR-93)', async () => {
    const rejected = await api('POST', '/archive-fonds', principal, { code: 'P01', name: 'Phông trường' });
    assert.equal(rejected.status, 422);
    assert.equal(errorOf(rejected.body).rule_code, 'BR-93');
    assert.deepEqual((await api('GET', '/archive-fonds', principal)).body, []);

    await openTestAcademicYear(environment, principal.accessToken, 'Năm học văn thư', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
  });

  it('CT-15h2-4: quyền theo thao tác: chưa đăng nhập 401, giáo viên 403, Phó Hiệu trưởng xem được nhưng không thêm', async () => {
    assert.equal((await api('GET', '/archive-records', undefined)).status, 401);
    assert.equal((await api('GET', '/archive-records', teacher)).status, 403);
    assert.equal((await api('GET', '/archive-report', teacher)).status, 403);
    assert.equal((await api('GET', '/archive-records', vicePrincipal)).status, 200);
    assert.equal((await api('GET', '/archive-fonds', unitManager)).status, 200);
    assert.equal((await api('POST', '/archive-fonds', vicePrincipal, { code: 'X', name: 'X' })).status, 403);
    assert.equal((await api('POST', '/archive-records', unitManager, pendingRecord)).status, 403);
    assert.equal((await download('/archive-records/export', unitManager, {})).status, 403);
    assert.equal((await download('/archive-report/export', teacher, {})).status, 403);
  });

  it('CT-15h2-5: thêm, sửa phông lưu trữ; trùng mã bị từ chối; mỗi thao tác ghi nhật ký', async () => {
    const created = await api('POST', '/archive-fonds', accountant, { code: 'PL01', name: 'Phông Trường mầm non' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    fondId = created.body.id as string;
    assert.equal(created.body.holding_count, 0);
    const duplicate = await api('POST', '/archive-fonds', principal, { code: 'PL01', name: 'Trùng' });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(fieldsOf(duplicate.body), ['code']);
    const other = await api('POST', '/archive-fonds', principal, { code: 'PL02', name: 'Phông Công đoàn' });
    otherFondId = other.body.id as string;
    const updated = await api('PUT', `/archive-fonds/${fondId}`, principal, {
      code: 'PL01',
      name: 'Phông Trường mầm non Hoa Sen',
      note: 'Từ năm 2005',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'Phông Trường mầm non Hoa Sen');
    assert.deepEqual(await auditActions(fondId), ['archive_fonds:create', 'archive_fonds:update']);
    const list = await api('GET', '/archive-fonds', vicePrincipal);
    assert.deepEqual(
      (list.body as unknown as Array<{ code: string }>).map((fond) => fond.code),
      ['PL01', 'PL02'],
    );
  });

  it('CT-15h2-6: hồ sơ chưa hoàn thành và hoàn thành ở hai danh sách; quá hạn, tìm kiếm, lọc, phân trang', async () => {
    const pending = await api('POST', '/archive-records', accountant, { ...pendingRecord, fond_id: fondId });
    assert.equal(pending.status, 201, JSON.stringify(pending.body));
    pendingId = pending.body.id as string;
    assert.equal(pending.body.overdue, true);
    assert.equal(pending.body.fond_name, 'Phông Trường mầm non Hoa Sen');
    assert.deepEqual(pending.body.files, []);
    const future = await api('POST', '/archive-records', accountant, {
      ...pendingRecord,
      code: '02/HS-VT',
      title: 'Hồ sơ kiểm định chất lượng',
      due_date: '2099-12-31',
    });
    assert.equal(future.body.overdue, false);
    const completed = await api('POST', '/archive-records', principal, {
      ...pendingRecord,
      code: '03/HS-VT',
      title: 'Hồ sơ quyết toán ngân sách',
      handler_name: 'Trần Thị Kế',
      status: 'completed',
      completed_on: '2026-02-01',
      retention: 'permanent',
      retention_years: null,
      fond_id: fondId,
    });
    completedId = completed.body.id as string;
    const duplicate = await api('POST', '/archive-records', principal, pendingRecord);
    assert.equal(duplicate.status, 409);
    const invalid = await api('POST', '/archive-records', principal, {
      ...pendingRecord,
      code: '04',
      fond_id: '11111111-1111-4111-8111-111111111111',
    });
    assert.deepEqual(fieldsOf(invalid.body), ['fond_id']);

    const codes = async (query: string) => {
      const result = await api('GET', `/archive-records?${query}`, vicePrincipal);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return {
        total: result.body.total,
        codes: (result.body.items as Array<{ code: string }>).map((item) => item.code),
      };
    };
    // Chưa hoàn thành: thời hạn gần nhất trước
    assert.deepEqual(await codes('status=pending'), { total: 2, codes: ['01/HS-VT', '02/HS-VT'] });
    assert.deepEqual(await codes('status=completed'), { total: 1, codes: ['03/HS-VT'] });
    assert.deepEqual(await codes('overdue=true'), { total: 1, codes: ['01/HS-VT'] });
    assert.deepEqual(await codes('search=kiểm định'), { total: 1, codes: ['02/HS-VT'] });
    assert.deepEqual(await codes('search=%25'), { total: 0, codes: [] });
    assert.deepEqual(await codes(`fond_id=${fondId}&handler=kế`), { total: 1, codes: ['03/HS-VT'] });
    assert.deepEqual(await codes('due_from=2026-03-01'), { total: 1, codes: ['02/HS-VT'] });
    assert.deepEqual(await codes('page=2&page_size=2'), { total: 3, codes: ['03/HS-VT'] });
    assert.equal((await api('GET', '/archive-records?page_size=500', principal)).status, 400);

    const done = await api('PUT', `/archive-records/${pendingId}`, accountant, {
      ...pendingRecord,
      fond_id: fondId,
      status: 'completed',
      completed_on: '2026-02-09',
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.overdue, false);
    assert.deepEqual(await codes('status=completed'), { total: 2, codes: ['01/HS-VT', '03/HS-VT'] });
    assert.deepEqual(await auditActions(pendingId), ['archive_records:create', 'archive_records:update']);
  });

  it('CT-15h2-7: đính kèm tệp vào hồ sơ: tải lên, tải về đúng nội dung, từ chối loại lạ, xóa tệp', async () => {
    assert.equal((await upload(pendingId, vicePrincipal, PDF, 'cong-van.pdf')).status, 403);
    const rejected = await upload(pendingId, accountant, Buffer.from('MZ-not-allowed'), 'virus.exe');
    assert.equal(rejected.status, 400);
    assert.deepEqual(fieldsOf(rejected.body), ['file']);
    const added = await upload(pendingId, accountant, PDF, 'Công văn số 12.pdf');
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal(added.body.file_name, 'Công văn số 12.pdf');
    assert.equal(added.body.content_type, 'application/pdf');
    const fileId = added.body.id as string;
    await upload(pendingId, accountant, ZIP, 'to-trinh.docx');

    const record = await api('GET', `/archive-records/${pendingId}`, unitManager);
    assert.equal(record.body.file_count, 2);
    assert.deepEqual(
      (record.body.files as Array<{ file_name: string }>).map((file) => file.file_name),
      ['Công văn số 12.pdf', 'to-trinh.docx'],
    );
    const fetched = await fetch(url(`/archive-records/${pendingId}/files/${fileId}`), {
      headers: { authorization: `Bearer ${vicePrincipal.accessToken}` },
    });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), PDF);
    // Tệp của hồ sơ khác không đọc được qua mã hồ sơ này
    const wrong = await fetch(url(`/archive-records/${completedId}/files/${fileId}`), {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(wrong.status, 404);

    assert.equal((await api('DELETE', `/archive-records/${pendingId}/files/${fileId}`, accountant)).status, 204);
    const after = await api('GET', `/archive-records/${pendingId}`, principal);
    assert.equal(after.body.file_count, 1);
    assert.deepEqual(await auditActions(fileId), ['archive_record_files:create', 'archive_record_files:delete']);
  });

  it('CT-15h2-8: thông tin lưu trữ và báo cáo lưu trữ cộng theo phông, giai đoạn', async () => {
    const holding = (body: Record<string, unknown>) => api('POST', '/archive-holdings', accountant, body);
    const base = {
      fond_id: fondId,
      period_from_year: 2005,
      period_to_year: 2015,
      arranged: true,
      retention: 'permanent',
      bundle_count: 4,
      box_count: 10,
      shelf_meters: 2.5,
      storage_location: 'Kho tầng 1',
    };
    const first = await holding(base);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.shelf_meters, 2.5);
    await holding({
      ...base,
      arranged: false,
      expired: true,
      retention: 'limited',
      retention_years: 10,
      bundle_count: 1,
      box_count: 2,
      shelf_meters: 0.75,
      storage_location: 'Kho tầng 2',
    });
    await holding({ ...base, fond_id: otherFondId, period_from_year: 2016, period_to_year: 2020, shelf_meters: 1 });
    const invalid = await holding({ ...base, expired: true });
    assert.deepEqual(fieldsOf(invalid.body), ['expired']);
    const holdings = (await api('GET', `/archive-holdings?fond_id=${fondId}`, vicePrincipal))
      .body as unknown as unknown[];
    assert.equal(holdings.length, 2);

    const report = await api('GET', '/archive-report', vicePrincipal);
    assert.equal(report.status, 200);
    const rows = report.body.rows as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    assert.deepEqual(
      { ...rows[0], fond_id: undefined },
      {
        fond_id: undefined,
        fond_code: 'PL01',
        fond_name: 'Phông Trường mầm non Hoa Sen',
        period_from_year: 2005,
        period_to_year: 2015,
        total_meters: 3.25,
        arranged_meters: 2.5,
        unarranged_meters: 0.75,
        expired_meters: 0.75,
        permanent_meters: 2.5,
        limited_meters: 0.75,
        bundle_count: 5,
        box_count: 12,
        storage_locations: 'Kho tầng 1; Kho tầng 2',
      },
    );
    assert.deepEqual(report.body.totals, {
      total_meters: 4.25,
      arranged_meters: 3.5,
      unarranged_meters: 0.75,
      expired_meters: 0.75,
      permanent_meters: 3.5,
      limited_meters: 0.75,
      bundle_count: 9,
      box_count: 22,
    });
    const filtered = await api('GET', '/archive-report?storage_location=tầng 2', vicePrincipal);
    assert.equal((filtered.body.totals as Record<string, number>).total_meters, 0.75);

    const file = await download('/archive-report/export', vicePrincipal, { fond_id: otherFondId });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows.slice(-2), [
      ['PL02 - Phông Công đoàn', '2016–2020', '1', '1', '0', '0', '1', '0', '4', '10', 'Kho tầng 1'],
      ['Tổng cộng', '', '1', '1', '0', '0', '1', '0', '4', '10', ''],
    ]);
    const log = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('id', '=', file.logId ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(log.report_code, 'archive-report');
    assert.equal(log.row_count, 2);
  });

  it('CT-15h2-9: xuất Excel hồ sơ theo bộ lọc và cột trên lưới, ghi nhật ký xuất có dữ liệu cá nhân', async () => {
    const file = await download('/archive-records/export', vicePrincipal, {
      status: 'completed',
      columns: ['code', 'handler_name', 'completed_on', 'retention'],
    });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows, [
      ['STT', 'Số, ký hiệu hồ sơ', 'Người giải quyết', 'Ngày hoàn thành', 'Thời hạn bảo quản'],
      ['1', '01/HS-VT', 'Nguyễn Văn Thư', '09/02/2026', '10 năm'],
      ['2', '03/HS-VT', 'Trần Thị Kế', '01/02/2026', 'Vĩnh viễn'],
    ]);
    const log = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('id', '=', file.logId ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(log.report_code, 'archive-records');
    assert.equal(log.contains_personal_data, true);
    assert.equal((await download('/archive-records/export', principal, { columns: ['code', 'x'] })).status, 400);
  });

  it('CT-15h2-10: phông còn hồ sơ hoặc thông tin lưu trữ không xóa được; xóa hồ sơ xóa luôn tệp đính kèm', async () => {
    const blocked = await api('DELETE', `/archive-fonds/${fondId}`, principal);
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-117');

    assert.equal((await api('DELETE', `/archive-records/${pendingId}`, vicePrincipal)).status, 403);
    assert.equal((await api('DELETE', `/archive-records/${pendingId}`, accountant)).status, 204);
    assert.equal((await api('GET', `/archive-records/${pendingId}`, principal)).status, 404);
    assert.deepEqual(await auditActions(pendingId), [
      'archive_records:create',
      'archive_records:update',
      'archive_records:delete',
    ]);
    assert.equal(
      (
        await environment.system
          .selectFrom('archive_record_files')
          .selectAll()
          .where('record_id', '=', pendingId)
          .execute()
      ).length,
      0,
    );

    await api('DELETE', `/archive-records/${completedId}`, principal);
    for (const holding of (await api('GET', `/archive-holdings?fond_id=${fondId}`, principal))
      .body as unknown as Array<{ id: string }>) {
      assert.equal((await api('DELETE', `/archive-holdings/${holding.id}`, principal)).status, 204);
    }
    assert.equal((await api('DELETE', `/archive-fonds/${fondId}`, principal)).status, 204);
    assert.deepEqual(await auditActions(fondId), [
      'archive_fonds:create',
      'archive_fonds:update',
      'archive_fonds:delete',
    ]);
  });
});

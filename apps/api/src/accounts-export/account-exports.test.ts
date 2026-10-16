import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Xuất Excel còn thiếu theo Sở (DT-16 phần 16b): 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 1.1 Nhóm người dùng, 1.4
// Danh sách người dùng theo bộ lọc và cột đang hiện; cần quyền xuất dữ liệu; mỗi lần xuất ghi nhật ký xuất. Kịch bản
// CT-16b-2 đến CT-16b-4
describe('Xuất Excel phân hiệu, điểm trường, nhóm người dùng, người dùng (DT-16 phần 16b)', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  let teacher: string;
  let schoolYear: Kysely<SchoolYearDatabase>;

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);

  async function download(path: string, token: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const rows: string[][] = [];
    if (response.status === 200) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      workbook.worksheets[0]?.eachRow((row) => {
        rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
      });
    }
    return { status: response.status, rows, logId: response.headers.get('x-export-log-id') };
  }

  // Nhật ký xuất nằm ở cơ sở dữ liệu năm học đang mở
  const exportLog = (logId: string | null) =>
    schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'contains_personal_data'])
      .where('id', '=', logId ?? '')
      .executeTakeFirst();

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    teacher = (await environment.loginAs('VT-07', null)).accessToken;
    const yearId = await openTestAcademicYear(environment, principal, '2026–2027', {
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
    for (const [code, name, type, extra] of [
      ['TC', 'Trường chính', 'truong_chinh', {}],
      ['PH-A', 'Phân hiệu An', 'phan_hieu', { address: 'Số 1 đường Thử', distance_km: 2.5 }],
      ['PH-B', 'Phân hiệu Bình', 'phan_hieu', {}],
      ['DT-C', 'Điểm trường Cúc', 'diem_truong', { phone: '0280000001', area_m2: 1200.5 }],
    ] as const) {
      const created = await api('POST', '/org-units', principal, { code, name, unit_type: type, ...extra });
      assert.equal(created.status, 201, JSON.stringify(created.body));
    }
    const phB = (await api('GET', '/org-units?unit_type=phan_hieu', principal)).body as unknown as Array<{
      id: string;
      code: string;
    }>;
    const stopped = await api('PATCH', `/org-units/${phB.find((unit) => unit.code === 'PH-B')?.id ?? ''}`, principal, {
      status: 'inactive',
    });
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16b-2: xuất Excel phân hiệu, điểm trường theo trạng thái, từ khóa và cột đang hiện; không có dữ liệu cá nhân', async () => {
    const branches = await download('/org-units/export', principal, {
      unit_type: 'phan_hieu',
      columns: ['code', 'name', 'address', 'distance_km', 'status'],
    });
    assert.equal(branches.status, 200);
    assert.deepEqual(branches.rows, [
      ['STT', 'Mã', 'Tên', 'Địa chỉ', 'Khoảng cách đến cơ sở chính (km)', 'Trạng thái'],
      ['1', 'PH-A', 'Phân hiệu An', 'Số 1 đường Thử', '2.5', 'Đang dùng'],
      ['2', 'PH-B', 'Phân hiệu Bình', '', '', 'Ngừng sử dụng'],
    ]);
    assert.deepEqual(await exportLog(branches.logId), {
      report_code: 'branches',
      row_count: 2,
      contains_personal_data: false,
    });
    const active = await download('/org-units/export', principal, {
      unit_type: 'phan_hieu',
      status: 'active',
      q: 'an',
    });
    assert.deepEqual(
      active.rows.slice(1).map((row) => row[1]),
      ['PH-A'],
    );
    const sites = await download('/org-units/export', principal, { unit_type: 'diem_truong' });
    assert.equal(sites.rows[0]?.length, 8);
    assert.deepEqual(sites.rows[1], ['1', 'DT-C', 'Điểm trường Cúc', '', '', '1200.5', '0280000001', 'Đang dùng']);
    assert.equal((await exportLog(sites.logId))?.report_code, 'school-sites');

    assert.equal((await download('/org-units/export', principal, { unit_type: 'truong_chinh' })).status, 400);
    assert.equal(
      (await download('/org-units/export', principal, { unit_type: 'phan_hieu', columns: ['code', 'manager'] })).status,
      400,
    );
    assert.equal((await download('/org-units/export', teacher, { unit_type: 'phan_hieu' })).status, 403);
  });

  it('CT-16b-3: xuất Excel nhóm người dùng theo từ khóa, cột như lưới (hiệu lực, nhóm quản trị, nhóm hệ thống)', async () => {
    const file = await download('/account-exports/roles', principal, { q: 'VT-02' });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows[0], ['STT', 'Mã nhóm', 'Tên nhóm', 'Hiệu lực', 'Là nhóm quản trị', 'Là nhóm hệ thống']);
    assert.equal(file.rows.length, 2);
    assert.equal(file.rows[1]?.[1], 'VT-02');
    assert.deepEqual(file.rows[1]?.slice(3), ['Có', 'Có', 'Có']);
    assert.deepEqual(await exportLog(file.logId), {
      report_code: 'roles',
      row_count: 1,
      contains_personal_data: false,
    });
    const counted = await download('/account-exports/roles', principal, { columns: ['code', 'permission_count'] });
    assert.ok(counted.rows.length > 2);
    assert.ok(Number(counted.rows.find((row) => row[1] === 'VT-02')?.[2]) > 0);
    assert.equal((await download('/account-exports/roles', principal, { columns: ['code', 'secret'] })).status, 400);
    assert.equal((await download('/account-exports/roles', teacher, {})).status, 403);
  });

  it('CT-16b-4: xuất Excel người dùng theo bộ lọc của 1.4, đọc đủ mọi trang ở dịch vụ định danh, ghi nhật ký xuất', async () => {
    for (let index = 0; index < 3; index += 1) {
      await environment.loginAs('VT-07', null);
    }
    const identityList = await sendJson(
      'GET',
      `${environment.identity.origin}/api/v1/users?role_code=VT-07&page_size=200`,
      principal,
    );
    assert.equal(identityList.status, 200, JSON.stringify(identityList.body));
    const total = identityList.body.total as number;
    assert.ok(total >= 4);
    const file = await download('/account-exports/users', principal, {
      role_code: 'VT-07',
      columns: ['full_name', 'roles', 'account_type', 'status'],
    });
    assert.equal(file.status, 200);
    assert.deepEqual(file.rows[0], ['STT', 'Tên hiển thị', 'Nhóm quyền', 'Loại tài khoản', 'Trạng thái']);
    assert.equal(file.rows.length, total + 1);
    const distinct = (index: number) => [...new Set(file.rows.slice(1).map((row) => row[index]))];
    assert.deepEqual(distinct(3), ['Cán bộ, nhân viên'], JSON.stringify(file.rows.slice(0, 3)));
    assert.deepEqual(distinct(4), ['Đang hoạt động'], JSON.stringify(file.rows.slice(0, 3)));
    assert.deepEqual(await exportLog(file.logId), {
      report_code: 'accounts',
      row_count: total,
      contains_personal_data: true,
    });
    const defaults = await download('/account-exports/users', principal, {});
    assert.equal(defaults.rows[0]?.length, 7);
    assert.equal((await download('/account-exports/users', principal, { status: 'deleted' })).status, 400);
    assert.equal((await download('/account-exports/users', teacher, {})).status, 403);
  });
});

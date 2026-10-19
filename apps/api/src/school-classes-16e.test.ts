import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from './imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from './test-support.js';

// DT-16 phần 16e: Trường học, Lớp học, lịch năm học đủ theo Sở. Kịch bản CT-16e-1 đến CT-16e-12
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };

interface ClassRow {
  id: string;
  code: string;
  name: string;
  status: string;
  age_group: string;
  sort_order: number | null;
  two_sessions_per_day: boolean;
  mixed_age_count: number | null;
  is_combined: boolean;
  combined_into_name: string | null;
  boarding: boolean;
}

async function readWorkbook(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const rows: string[][] = [];
  workbook.worksheets[0]?.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let index = 1; index <= row.cellCount; index += 1) {
      cells.push(String(row.getCell(index).value ?? ''));
    }
    rows.push(cells);
  });
  return rows;
}

describe('Trường học, lớp học theo Sở đủ tính năng (DT-16 phần 16e)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let yearId = '';
  let mother = '';
  const units: Record<string, string> = {};
  const unit = (code: string) => units[code] ?? '';

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const listClasses = async () => (await api('GET', '/classes', principal.accessToken)).body as unknown as ClassRow[];
  const createClass = async (code: string, extra: Record<string, unknown> = {}, orgUnit = 'PH-A') => {
    const created = await api('POST', '/classes', principal.accessToken, {
      org_unit_id: unit(orgUnit),
      code,
      name: `Lớp ${code}`,
      grade_level: 'LA',
      max_size: 25,
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  };
  async function download(path: string, token: string, body: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return { status: response.status, rows: response.status === 200 ? await readWorkbook(buffer) : [] };
  }
  async function upload(file: Buffer, fields: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), 'lop-hoc.xlsx');
    const response = await fetch(`${environment.baseUrl}/imports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${principal.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  async function createChild(fullName: string) {
    const form = new FormData();
    form.set('org_unit_id', unit('PH-A'));
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    const nationalId = nextNationalId();
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: unit('PH-A'),
      full_name: fullName,
      dob: '2021-03-04',
      gender: 'female',
      national_id: nationalId,
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return { id: created.body.id as string, nationalId };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
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
      ['PH-A', 'phan_hieu'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, {
        code,
        name: `Đơn vị ${code}`,
        unit_type: type,
      });
      units[code] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['NT', 'Nhà trẻ', 25, 36],
      ['MAM', 'Mầm', 37, 48],
      ['LA', 'Lá', 60, 71],
    ] as const) {
      await api('POST', '/grade-levels', principal.accessToken, {
        code,
        name,
        age_from_months: from,
        age_to_months: to,
      });
    }
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    mother = relationship.body.id as string;
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16e-1: 1.4 Cấu hình trường lưu ba ô của Sở ở Trường chính; tên trường hiển thị thay tên ở thanh đầu trang', async () => {
    const saved = await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unit('TC'),
      values: {
        school_display_name: '  Trường Mầm non Thử Nghiệm  ',
        administrative_unit_name: 'Phường Thử Nghiệm',
        underweight_growth_calculation: false,
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const settings = saved.body as unknown as Array<{ key: string; value: unknown; school: boolean }>;
    const valueOf = (key: string) => settings.find((setting) => setting.key === key);
    assert.equal(valueOf('school_display_name')?.value, 'Trường Mầm non Thử Nghiệm');
    assert.equal(valueOf('school_display_name')?.school, true);
    assert.equal(valueOf('underweight_growth_calculation')?.value, false);
    assert.equal(valueOf('max_class_size')?.school, false);

    const context = await api('GET', '/portal-context', principal.accessToken);
    assert.equal(context.body.school_name, 'Trường Mầm non Thử Nghiệm');

    // Mục của Sở chỉ đặt ở Trường chính; chữ rỗng hoặc quá dài bị từ chối
    const branch = await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unit('PH-A'),
      values: { administrative_unit_name: 'Xã Khác' },
    });
    assert.equal(branch.status, 422);
    assert.equal(errorOf(branch.body).rule_code, 'YCTD-127');
    for (const value of ['   ', 'x'.repeat(201), 12]) {
      const invalid = await api('PUT', '/settings', principal.accessToken, {
        org_unit_id: unit('TC'),
        values: { school_display_name: value },
      });
      assert.equal(invalid.status, 400, JSON.stringify(value));
    }
    // Xóa tên hiển thị thì thanh đầu trang trở về tên Trường chính
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unit('TC'),
      values: { school_display_name: null },
    });
    assert.equal((await api('GET', '/portal-context', principal.accessToken)).body.school_name, 'Đơn vị TC');
  });

  it('CT-16e-2: 3.4 Khai báo tuần: học kỳ theo lịch, chọn riêng, hiển thị, tuần đệm; lưu lại lịch vẫn giữ', async () => {
    const weeks = (await api('GET', `/academic-years/${yearId}/weeks`, principal.accessToken))
      .body as unknown as Array<{
      week_no: number;
      start_date: string;
      term: string | null;
      term_type: string | null;
      is_visible: boolean;
    }>;
    assert.equal(weeks[0]?.term, 'first_term');
    assert.equal(weeks[0]?.is_visible, true);
    const between = weeks.find((week) => week.start_date === '2027-01-18');
    assert.equal(between?.term, 'second_term');
    const last = weeks[weeks.length - 1];
    const changed = await api('PATCH', `/academic-years/${yearId}/weeks`, principal.accessToken, {
      weeks: [
        { week_no: 1, is_off: true, note: 'Tuần đệm đầu năm', is_visible: false },
        { week_no: last?.week_no, is_off: false, note: null, term_type: 'summer_term' },
      ],
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const saved = changed.body as unknown as typeof weeks & Array<{ is_off: boolean; note: string | null }>;
    assert.equal(saved[0]?.is_visible, false);
    assert.equal(saved[0]?.is_off, true);
    assert.equal(saved[saved.length - 1]?.term, 'summer_term');
    assert.equal(saved[saved.length - 1]?.term_type, 'summer_term');
    for (const body of [{ term_type: 'third_term' }, { is_visible: 'yes' }]) {
      const invalid = await api('PATCH', `/academic-years/${yearId}/weeks`, principal.accessToken, {
        weeks: [{ week_no: 1, is_off: false, note: null, ...body }],
      });
      assert.equal(invalid.status, 400, JSON.stringify(body));
    }
    // Lưu lại lịch: tuần cùng ngày bắt đầu giữ học kỳ chọn riêng, hiển thị, tuần đệm
    const calendar = await api('PUT', `/academic-years/${yearId}/calendar`, principal.accessToken, {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    assert.equal(calendar.status, 200, JSON.stringify(calendar.body));
    const again = (await api('GET', `/academic-years/${yearId}/weeks`, principal.accessToken))
      .body as unknown as Array<{
      is_visible: boolean;
      is_off: boolean;
      note: string | null;
      term_type: string | null;
    }>;
    assert.deepEqual([again[0]?.is_visible, again[0]?.is_off, again[0]?.note], [false, true, 'Tuần đệm đầu năm']);
    assert.equal(again[again.length - 1]?.term_type, 'summer_term');
    const teacher = await environment.loginAs('VT-07', unit('PH-A'));
    assert.equal(
      (
        await api('PATCH', `/academic-years/${yearId}/weeks`, teacher.accessToken, {
          weeks: [{ week_no: 1, is_off: false, note: null }],
        })
      ).status,
      403,
    );
  });

  it('CT-16e-3: 2.1 Xóa lớp chưa phát sinh dữ liệu cùng phân công; lớp có học sinh hoặc có lớp ghép vào không xóa được', async () => {
    const empty = await createClass('X1');
    const homeroom = await environment.loginAs('VT-07', unit('PH-A'));
    const assigned = await api('POST', `/classes/${empty}/staff-assignments`, principal.accessToken, {
      staff_user_id: homeroom.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const used = await createClass('X2');
    const child = await createChild('Nguyễn Thị Xóa');
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: used, from_date: '2026-09-07' })
      .execute();
    const target = await createClass('X3');
    await createClass('X4', { is_combined: true, combined_into_class_id: target });

    const result = await api('POST', '/classes/delete', principal.accessToken, { class_ids: [empty, used, target] });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const body = result.body as unknown as {
      succeeded: Array<{ id: string }>;
      failed: Array<{ id: string; message: string }>;
    };
    assert.deepEqual(
      body.succeeded.map((item) => item.id),
      [empty],
    );
    assert.deepEqual(
      body.failed.map((item) => item.id),
      [used, target],
    );
    assert.match(body.failed[0]?.message ?? '', /phát sinh dữ liệu/);
    assert.match(body.failed[1]?.message ?? '', /ghép vào/);
    const codes = (await listClasses()).map((row) => row.code);
    assert.ok(!codes.includes('X1') && codes.includes('X2') && codes.includes('X3'));
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'classes')
      .where('entity_id', '=', empty)
      .where('action', '=', 'delete')
      .executeTakeFirst();
    assert.ok(log, 'Xóa lớp ghi nhật ký');

    for (const classIds of [[], ['khong-phai-ma'], Array.from({ length: 201 }, () => empty)]) {
      assert.equal((await api('POST', '/classes/delete', principal.accessToken, { class_ids: classIds })).status, 400);
    }
    assert.equal((await api('POST', '/classes/delete', homeroom.accessToken, { class_ids: [target] })).status, 403);
  });

  it('CT-16e-4: 2.1 thao tác hàng loạt: đặt học 2 buổi, bán trú, giải thể; lớp còn học sinh không giải thể được', async () => {
    const classes = await listClasses();
    const ids = ['X2', 'X3'].map((code) => classes.find((row) => row.code === code)?.id ?? '');
    const flags = await api('POST', '/classes/bulk-update', principal.accessToken, {
      class_ids: ids,
      two_sessions_per_day: true,
      boarding: true,
    });
    assert.equal(flags.status, 200, JSON.stringify(flags.body));
    assert.equal((flags.body.succeeded as unknown[]).length, 2);
    const after = await listClasses();
    assert.ok(
      after.filter((row) => ['X2', 'X3'].includes(row.code)).every((row) => row.two_sessions_per_day && row.boarding),
    );
    const dissolved = await api('POST', '/classes/bulk-update', principal.accessToken, {
      class_ids: ids,
      status: 'closed',
    });
    const body = dissolved.body as unknown as { succeeded: Array<{ id: string }>; failed: Array<{ id: string }> };
    assert.deepEqual(
      body.failed.map((item) => item.id),
      [ids[0]],
    );
    assert.deepEqual(
      body.succeeded.map((item) => item.id),
      [ids[1]],
    );
    assert.equal((await api('POST', '/classes/bulk-update', principal.accessToken, { class_ids: ids })).status, 400);
  });

  it('CT-16e-5: 3.3 Phân công phụ trách lớp hiện cả giáo viên chưa phân công, lọc theo tình trạng phân công', async () => {
    const idle = await environment.loginAs('VT-08', unit('PH-A'));
    const busy = await environment.loginAs('VT-07', unit('PH-A'));
    const classId = await createClass('PC1');
    await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      staff_user_id: busy.userId,
      assignment_role: 'homeroom',
    });
    type Row = { staff_user_id: string; class_id: string | null; assignment_role: string | null };
    const rows = (await api('GET', '/class-assignments', principal.accessToken)).body as unknown as Row[];
    const idleRow = rows.find((row) => row.staff_user_id === idle.userId);
    assert.ok(idleRow, 'Giáo viên chưa phân công có dòng');
    assert.equal(idleRow.class_id, null);
    assert.equal(idleRow.assignment_role, null);
    assert.ok(rows.some((row) => row.staff_user_id === busy.userId && row.class_id === classId));
    assert.ok(!rows.some((row) => row.staff_user_id === busy.userId && row.class_id === null));

    const unassigned = (await api('GET', '/class-assignments?assignment=unassigned', principal.accessToken))
      .body as unknown as Row[];
    assert.ok(unassigned.length > 0 && unassigned.every((row) => row.class_id === null));
    const assigned = (await api('GET', '/class-assignments?assignment=assigned', principal.accessToken))
      .body as unknown as Row[];
    assert.ok(assigned.length > 0 && assigned.every((row) => row.class_id !== null));
    // Lọc vai trò bộ môn chỉ hiện giáo viên bộ môn chưa phân công
    const subject = (
      await api('GET', '/class-assignments?assignment=unassigned&assignment_role=subject', principal.accessToken)
    ).body as unknown as Row[];
    assert.ok(subject.some((row) => row.staff_user_id === idle.userId));
    assert.ok(!subject.some((row) => row.staff_user_id === busy.userId));
    assert.equal((await api('GET', '/class-assignments?assignment=x', principal.accessToken)).status, 400);

    const file = await download('/class-assignments/export', principal.accessToken, { assignment: 'unassigned' });
    assert.equal(file.status, 200);
    assert.ok(file.rows.slice(1).every((row) => row[2] === 'Chưa phân công'));
    // Người không đọc được danh bạ nhân sự chỉ thấy các dòng đã phân công
    const viewer = (await api('GET', '/class-assignments', busy.accessToken)).body as unknown as Row[];
    assert.ok(viewer.every((row) => row.class_id !== null));
  });

  it('CT-16e-6: 2.2 nhập lớp học có cột của Sở: nhóm tuổi, thứ tự, 2 buổi, ghép độ tuổi, lớp ghép, bán trú', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Lớp học');
    const columns = IMPORT_COLUMNS.classes;
    sheet.addRow(columns.map((column) => column.header));
    const rows: Array<Record<string, string>> = [
      {
        unit_code: 'PH-A',
        class_code: 'NK1',
        class_name: 'Lớp NK1',
        grade_level: 'MAM',
        max_size: '30',
        age_group: '3-4 tuổi',
        sort_order: '5',
        two_sessions_per_day: 'Có',
        mixed_age_count: '2',
        is_combined: 'Không',
        boarding: 'x',
      },
      {
        unit_code: 'PH-A',
        class_code: 'NK2',
        class_name: 'Lớp NK2',
        grade_level: 'MAM',
        max_size: '20',
        is_combined: 'Có',
        combined_into_code: 'X3',
      },
    ];
    for (const row of rows) {
      sheet.addRow(columns.map((column) => row[column.key] ?? ''));
    }
    const uploaded = await upload(Buffer.from(await book.xlsx.writeBuffer()), { type: 'classes' });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    // X3 đã giải thể ở CT-16e-4 nên không ghép vào được
    assert.equal(uploaded.body.status, 'failed', JSON.stringify(uploaded.body));
    const errors = uploaded.body.errors as Array<{ row: number; column: string }>;
    assert.deepEqual(
      errors.map((error) => [error.row, error.column]),
      [[3, 'Ghép vào lớp']],
    );

    rows[1] = { ...rows[1], combined_into_code: 'X2' } as Record<string, string>;
    const fixedBook = new ExcelJS.Workbook();
    const fixedSheet = fixedBook.addWorksheet('Lớp học');
    fixedSheet.addRow(columns.map((column) => column.header));
    for (const row of rows) {
      fixedSheet.addRow(columns.map((column) => row[column.key] ?? ''));
    }
    const fixed = await upload(Buffer.from(await fixedBook.xlsx.writeBuffer()), { type: 'classes' });
    assert.equal(fixed.body.status, 'validated', JSON.stringify(fixed.body));
    const committed = await api('POST', `/imports/${fixed.body.id as string}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    const classes = await listClasses();
    const first = classes.find((row) => row.code === 'NK1');
    assert.deepEqual(
      [first?.age_group, first?.sort_order, first?.two_sessions_per_day, first?.mixed_age_count, first?.boarding],
      ['years_3_4', 5, true, 2, true],
    );
    const second = classes.find((row) => row.code === 'NK2');
    assert.deepEqual([second?.is_combined, second?.combined_into_name], [true, 'Lớp X2']);

    // Nhóm trẻ không ghép độ tuổi; nhóm tuổi lạ, cờ lạ bị báo theo cột
    const wrongBook = new ExcelJS.Workbook();
    const wrongSheet = wrongBook.addWorksheet('Lớp học');
    wrongSheet.addRow(columns.map((column) => column.header));
    for (const row of [
      {
        unit_code: 'PH-A',
        class_code: 'NK3',
        class_name: 'NK3',
        grade_level: 'NT',
        max_size: '15',
        mixed_age_count: '3',
      },
      {
        unit_code: 'PH-A',
        class_code: 'NK4',
        class_name: 'NK4',
        grade_level: 'LA',
        max_size: '15',
        age_group: '9 tuổi',
      },
      { unit_code: 'PH-A', class_code: 'NK5', class_name: 'NK5', grade_level: 'LA', max_size: '15', boarding: 'có lẽ' },
    ] as Array<Record<string, string>>) {
      wrongSheet.addRow(columns.map((column) => row[column.key] ?? ''));
    }
    const wrong = await upload(Buffer.from(await wrongBook.xlsx.writeBuffer()), { type: 'classes' });
    assert.deepEqual(
      (wrong.body.errors as Array<{ row: number; column: string }>).map((error) => [error.row, error.column]),
      [
        [2, 'Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi'],
        [3, 'Nhóm tuổi'],
        [4, 'Lớp bán trú'],
      ],
    );

    // Tải file mẫu kèm dữ liệu ghi các cột của Sở
    const template = await fetch(`${environment.baseUrl}/imports/templates/classes?with_data=true`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(template.status, 200);
    const templateRows = await readWorkbook(Buffer.from(await template.arrayBuffer()));
    const header = templateRows.find((row) => row.includes('Mã lớp')) ?? [];
    for (const column of ['Nhóm tuổi', 'Thứ tự', 'Học 2 buổi/ngày', 'Lớp ghép', 'Ghép vào lớp', 'Lớp bán trú']) {
      assert.ok(header.includes(column), column);
    }
    const nk2 = templateRows.find((row) => row.includes('NK2')) ?? [];
    assert.equal(nk2[header.indexOf('Ghép vào lớp')], 'X2');
  });

  it('CT-16e-7: 1.7 Rà soát kiểm định: Lấy dữ liệu từ lớp, phòng, hồ sơ trường, học sinh; Ghi lưu bản rà soát', async () => {
    const profile = await api('PUT', '/school-profile', principal.accessToken, {
      general: { land_area_m2: 1200, ownership_type: 'public' },
    });
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    for (const [code, block, type, area] of [
      ['P1', 'care_education', 'group_room', 60],
      ['P2', 'care_education', 'group_room', 55.5],
      ['P3', 'support', 'arts_education', 40],
      ['P4', 'meal', 'kitchen', 30],
    ] as const) {
      const room = await api('POST', '/rooms', principal.accessToken, {
        org_unit_id: unit('TC'),
        code,
        name: `Phòng ${code}`,
        capacity: 30,
        room_block: block,
        room_type: type,
        area_m2: area,
      });
      assert.equal(room.status, 201, JSON.stringify(room.body));
    }
    const collected = await api('POST', '/accreditation-review/collect', principal.accessToken);
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    const activeClasses = (await listClasses()).filter((row) => row.status === 'active').length;
    assert.equal(collected.body.class_count, activeClasses);
    assert.equal(collected.body.classroom_count, 2);
    assert.equal(collected.body.subject_room_count, 1);
    assert.equal(collected.body.land_area_m2, 1200);
    assert.equal(collected.body.floor_area_m2, 185.5);
    // Học sinh đang học (đã duyệt) ở lớp đang dùng; trẻ ở CT-16e-3 chưa duyệt nên không tính
    assert.equal(collected.body.child_count, 0);
    assert.equal(collected.body.area_per_child_m2, null);

    const saved = await api('PUT', '/accreditation-review', principal.accessToken, {
      ...collected.body,
      child_count: 80,
      area_per_child_m2: 15,
      note: 'Số học sinh theo danh sách đầu năm',
      collected: true,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const read = (await api('GET', '/accreditation-review', principal.accessToken)).body.saved as Record<
      string,
      unknown
    >;
    assert.deepEqual(
      [read.child_count, read.area_per_child_m2, read.floor_area_m2, read.note],
      [80, 15, 185.5, 'Số học sinh theo danh sách đầu năm'],
    );
    assert.ok(read.collected_at);
    for (const body of [{ class_count: -1 }, { land_area_m2: 'nhiều' }, { child_count: 1.5 }]) {
      assert.equal((await api('PUT', '/accreditation-review', principal.accessToken, body)).status, 400);
    }
    const branchManager = await environment.loginWithRoles([{ roleCode: 'VT-03', orgUnitId: unit('PH-A') }]);
    assert.equal(
      (await api('PUT', '/accreditation-review', branchManager.accessToken, { ...collected.body, class_count: 1 }))
        .status,
      403,
    );
  });

  it('CT-16e-8: 1.8 Tách trường: tạo yêu cầu, sửa khi chưa xác nhận, xác nhận đi, đánh dấu đã tiếp nhận', async () => {
    const child = await createChild('Trần Thị Tách');
    const staffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unit('TC'),
          code: `NS${randomInt(0, 100_000)}`,
          full_name: 'Lê Văn Tách',
          gender: 'male',
          dob: '1990-02-03',
          start_date: '2020-08-01',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const candidates = (await api('GET', '/school-splits/candidates?type=staff&q=Tách', principal.accessToken))
      .body as unknown as Array<{ id: string }>;
    assert.ok(candidates.some((item) => item.id === staffId));

    const created = await api('POST', '/school-splits', principal.accessToken, {
      destination_school: 'Trường Mầm non Mới Tách',
      destination_code: '79000999',
      reason: 'Thành lập trường mới từ phân hiệu A',
      child_ids: [child.id],
      staff_ids: [],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const requestId = created.body.id as string;
    assert.match(created.body.code as string, /^TT-\d{6}$/);
    assert.equal(created.body.status, 'draft');
    const updated = await api('PATCH', `/school-splits/${requestId}`, principal.accessToken, {
      destination_school: 'Trường Mầm non Mới Tách',
      reason: 'Thành lập trường mới từ phân hiệu A',
      child_ids: [child.id],
      staff_ids: [staffId],
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal((updated.body.staff as unknown[]).length, 1);
    const listed = (await api('GET', '/school-splits', principal.accessToken)).body as unknown as Array<{
      id: string;
      child_count: number;
      staff_count: number;
    }>;
    assert.deepEqual(
      listed.filter((item) => item.id === requestId).map((item) => [item.child_count, item.staff_count]),
      [[1, 1]],
    );

    const confirmed = await api('POST', `/school-splits/${requestId}/status`, principal.accessToken, {
      action: 'confirm',
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'confirmed');
    assert.ok(confirmed.body.confirmed_at);
    // Đã xác nhận thì không sửa, không xóa; hủy xác nhận được khi chưa tiếp nhận
    const locked = await api('PATCH', `/school-splits/${requestId}`, principal.accessToken, {
      destination_school: 'Khác',
      reason: 'Khác',
      child_ids: [child.id],
    });
    assert.equal(locked.status, 422);
    assert.equal(errorOf(locked.body).rule_code, 'YCTD-127');
    assert.equal((await api('DELETE', `/school-splits/${requestId}`, principal.accessToken)).status, 422);
    const received = await api('POST', `/school-splits/${requestId}/status`, principal.accessToken, {
      action: 'receive',
      note: 'Công văn báo nhận số 12',
    });
    assert.equal(received.body.status, 'received');
    assert.equal(received.body.received_note, 'Công văn báo nhận số 12');
    assert.equal(
      (await api('POST', `/school-splits/${requestId}/status`, principal.accessToken, { action: 'unconfirm' })).status,
      422,
    );
    // Xác nhận đi không đổi trạng thái hồ sơ học sinh
    const status = await schoolYear
      .selectFrom('children')
      .select('status')
      .where('id', '=', child.id)
      .executeTakeFirst();
    assert.equal(status?.status, 'draft');

    for (const body of [
      { destination_school: '', reason: 'x', child_ids: [child.id] },
      { destination_school: 'A', reason: 'x', child_ids: [] },
      { destination_school: 'A', reason: 'x', child_ids: ['khong-phai-ma'] },
    ]) {
      assert.equal(
        (await api('POST', '/school-splits', principal.accessToken, body)).status,
        400,
        JSON.stringify(body),
      );
    }
    const draft = await api('POST', '/school-splits', principal.accessToken, {
      destination_school: 'Trường tạm',
      reason: 'Thử xóa',
      staff_ids: [staffId],
    });
    assert.equal((await api('DELETE', `/school-splits/${draft.body.id as string}`, principal.accessToken)).status, 204);
    const branchManager = await environment.loginWithRoles([{ roleCode: 'VT-03', orgUnitId: unit('PH-A') }]);
    assert.equal((await api('GET', '/school-splits', branchManager.accessToken)).status, 403);
  });

  it('CT-16e-9: 1.8 Tách trường xuất hồ sơ theo mẫu CSDL ngành (82 cột học sinh, 75 cột nhân sự), ghi nhật ký xuất', async () => {
    const requests = (await api('GET', '/school-splits', principal.accessToken)).body as unknown as Array<{
      id: string;
      code: string;
    }>;
    const request = requests[requests.length - 1];
    const children = await download(`/school-splits/${request?.id ?? ''}/export`, principal.accessToken, {
      subject: 'children',
    });
    assert.equal(children.status, 200);
    const header = children.rows[0] ?? [];
    assert.equal(header.length, 82);
    assert.deepEqual(header.slice(0, 4), ['STT', 'Mã lớp', 'Mã học sinh', 'Họ tên']);
    const row = children.rows[1] ?? [];
    assert.equal(row[header.indexOf('Họ tên')], 'Trần Thị Tách');
    assert.equal(row[header.indexOf('Ngày sinh')], '04/03/2021');
    assert.equal(row[header.indexOf('Giới tính')], 'Nữ');
    assert.match(row[header.indexOf('Số định danh cá nhân')] ?? '', /^\d{12}$/);
    assert.equal(row[header.indexOf('Họ tên mẹ')], 'Mẹ của Trần Thị Tách');

    const staff = await download(`/school-splits/${request?.id ?? ''}/export`, principal.accessToken, {
      subject: 'staff',
    });
    assert.equal(staff.status, 200);
    assert.equal(staff.rows[0]?.length, 75);
    assert.equal(staff.rows[1]?.[staff.rows[0]?.indexOf('Họ tên') ?? 0], 'Lê Văn Tách');
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data'])
      .where('report_code', 'in', ['school-split-children', 'school-split-staff'])
      .execute();
    assert.equal(logs.length, 2);
    assert.ok(logs.every((log) => log.contains_personal_data));
    assert.equal(
      (await download(`/school-splits/${request?.id ?? ''}/export`, principal.accessToken, { subject: 'x' })).status,
      400,
    );
  });
});

describe('5.7 Chuyển hồ sơ lên năm học mới: Thực hiện, Hủy (DT-16 phần 16e)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let firstYear = '';
  let secondYear = '';

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const status = async () =>
    (await api('GET', '/academic-years/rollover/status', principal.accessToken)).body as unknown as {
      current: { id: string } | null;
      candidates: Array<{ id: string }>;
      cancel: { allowed: boolean; reason: string | null };
    };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    firstYear = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    await api('POST', '/org-units', principal.accessToken, { code: 'TC', name: 'Trường', unit_type: 'truong_chinh' });
    const created = await api('POST', '/academic-years', principal.accessToken, { name: '2027–2028' });
    secondYear = created.body.id as string;
    await api('PUT', `/academic-years/${secondYear}/calendar`, principal.accessToken, {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-25' },
    });
  });

  after(async () => {
    await environment.close();
  });

  it('CT-16e-10: năm học đầu tiên không hủy được; năm học mới có lịch là năm để Thực hiện', async () => {
    const before = await status();
    assert.equal(before.current?.id, firstYear);
    assert.deepEqual(
      before.candidates.map((year) => year.id),
      [secondYear],
    );
    assert.equal(before.cancel.allowed, false);
    assert.match(before.cancel.reason ?? '', /năm học đầu tiên/);
    const refused = await api('POST', `/academic-years/${firstYear}/cancel-open`, principal.accessToken);
    assert.equal(refused.status, 422);
    assert.equal(errorOf(refused.body).rule_code, 'YCTD-127');
  });

  it('CT-16e-11: chuyển xong chưa phát sinh dữ liệu thì Hủy được; năm học trước mở lại và ghi được', async () => {
    const opened = await api('POST', `/academic-years/${secondYear}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const after = await status();
    assert.equal(after.current?.id, secondYear);
    assert.equal(after.cancel.allowed, true, after.cancel.reason ?? '');
    const teacher = await environment.loginAs('VT-07', null);
    assert.equal((await api('POST', `/academic-years/${secondYear}/cancel-open`, teacher.accessToken)).status, 403);
    const cancelled = await api('POST', `/academic-years/${secondYear}/cancel-open`, principal.accessToken);
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.status, 'draft');
    const years = (await api('GET', '/academic-years', principal.accessToken)).body as unknown as Array<{
      id: string;
      status: string;
    }>;
    assert.equal(years.find((year) => year.id === firstYear)?.status, 'open');
    const databases = await environment.system
      .selectFrom('academic_year_databases')
      .select(['academic_year_id', 'status', 'closed_at'])
      .execute();
    assert.deepEqual(
      databases.map((row) => [row.academic_year_id, row.status, row.closed_at]),
      [[firstYear, 'active', null]],
    );
    // Năm học trước ghi được như trước khi chuyển
    const unit = await api('POST', '/org-units', principal.accessToken, {
      code: 'PH-1',
      name: 'Phân hiệu 1',
      unit_type: 'phan_hieu',
    });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
  });

  it('CT-16e-12: năm học mới đã phát sinh dữ liệu thì không Hủy được', async () => {
    const opened = await api('POST', `/academic-years/${secondYear}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const created = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'CHA',
      name: 'Cha',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const blocked = await status();
    assert.equal(blocked.cancel.allowed, false);
    assert.match(blocked.cancel.reason ?? '', /phát sinh dữ liệu/);
    const refused = await api('POST', `/academic-years/${secondYear}/cancel-open`, principal.accessToken);
    assert.equal(refused.status, 422);
  });
});

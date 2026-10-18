import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { roomAttributesFor } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import {
  EQUIPMENT_IMPORT_COLUMNS,
  ROOM_IMPORT_COLUMNS,
  parseEquipmentRows,
  parseRoomRows,
} from './facility-imports.js';
import { readInvestments } from './facility-investments.js';
import { readStandardLevels } from './facility-report.js';
import {
  buildFacilityFigures,
  buildToiletFigures,
  investmentSuggestions,
  overallStandardLevel,
} from './facility-report-calc.js';
import type { FieldError } from '@school-management/server';

type Row = Record<string, unknown>;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// Cơ sở vật chất đủ theo hệ thống của Sở (DT-16 phần 16i, YCTD-128): 1.2 Báo cáo cơ sở vật chất, nhà vệ sinh, mức độ đạt
// chuẩn, 6.1 thực trạng và nhu cầu đầu tư, nhập phòng và danh mục thiết bị từ Excel, gửi lên cấp trên 1.2 và 2.3
const room = (values: Row) => ({
  room_block: null,
  room_type: null,
  condition: null,
  area_m2: null,
  status: 'active',
  facility_attributes: {},
  ...values,
});

describe('Hàm tính và kiểm tra dữ liệu của cơ sở vật chất theo Sở', () => {
  it('CT-16i-1: số liệu phòng theo khối và loại phòng, nhà vệ sinh theo đối tượng, mức độ đạt chuẩn thấp nhất, gợi ý 6.1', () => {
    const rooms = [
      room({ room_block: 'care_education', room_type: 'group_room', condition: 'permanent', area_m2: 50 }),
      room({
        room_block: 'care_education',
        room_type: 'group_room',
        condition: 'temporary',
        area_m2: 40,
        facility_attributes: { toilet: 'ensuite' },
      }),
      room({
        room_block: 'care_education',
        room_type: 'toilet',
        condition: 'permanent',
        area_m2: 12.5,
        facility_attributes: {
          toilet_users: 'children',
          toilet_standard: 'met',
          toilet_separate_gender: true,
          toilet_seats: 6,
        },
      }),
      room({
        room_block: 'care_education',
        room_type: 'toilet',
        facility_attributes: { toilet_users: 'staff', toilet_standard: 'not_met', toilet_seats: 2 },
      }),
      room({ room_block: 'other', room_type: 'teacher_housing', condition: 'semi_permanent', area_m2: 30 }),
      room({ room_block: 'meal', room_type: 'kitchen', condition: 'borrowed', status: 'inactive' }),
      room({}),
    ];
    const figures = buildFacilityFigures(rooms);
    const total = figures.find((row) => row.key === 'total');
    assert.deepEqual([total?.total, total?.permanent, total?.unspecified, total?.area_m2], [6, 2, 2, 132.5]);
    const care = figures.find((row) => row.key === 'care_education');
    assert.deepEqual([care?.total, care?.temporary, care?.area_m2], [4, 1, 102.5]);
    const groupRooms = figures.find((row) => row.key === 'care_education.group_room');
    assert.deepEqual([groupRooms?.label, groupRooms?.total], ['Trong đó: Phòng sinh hoạt chung', 2]);
    assert.ok(
      figures.some((row) => row.key === 'unassigned' && row.total === 1),
      'phòng chưa phân khối',
    );
    assert.ok(!figures.some((row) => row.key === 'meal.kitchen'), 'phòng ngừng dùng không tính');

    const toilets = buildToiletFigures(rooms);
    const toiletTotal = toilets.rows[0];
    assert.deepEqual(
      [toiletTotal?.rooms, toiletTotal?.met, toiletTotal?.not_met, toiletTotal?.separate_gender, toiletTotal?.seats],
      [2, 1, 1, 1, 8],
    );
    assert.equal(toilets.rows.find((row) => row.key === 'children')?.met, 1);
    assert.deepEqual([toilets.group_rooms, toilets.group_rooms_ensuite], [2, 1]);

    const blocks = ['care_education', 'meal', 'support', 'administration', 'other'];
    assert.equal(
      overallStandardLevel(blocks.slice(0, 4).map((block) => ({ room_block: block, level: 'level_2' }))),
      null,
    );
    assert.equal(
      overallStandardLevel(
        blocks.map((block, index) => ({ room_block: block, level: index === 2 ? 'level_1' : 'level_2' })),
      ),
      'level_1',
    );
    assert.equal(
      overallStandardLevel(
        blocks.map((block) => ({ room_block: block, level: block === 'meal' ? 'not_met' : 'level_2' })),
      ),
      'not_met',
    );

    const suggestions = investmentSuggestions(rooms);
    const classroom = suggestions.find((item) => item.category === 'classroom');
    assert.deepEqual([classroom?.rooms, classroom?.permanent, classroom?.temporary], [2, 1, 1]);
    assert.equal(suggestions.find((item) => item.category === 'teacher_housing')?.semi_permanent, 1);
  });

  it('CT-16i-2: thuộc tính nhà vệ sinh chỉ cho Phòng vệ sinh; kiểm tra số liệu 6.1 và mức độ đạt chuẩn gửi lên', () => {
    assert.ok(roomAttributesFor('toilet').some((field) => field.key === 'toilet_users'));
    assert.ok(!roomAttributesFor('group_room').some((field) => field.key === 'toilet_users'));
    assert.ok(roomAttributesFor(null).some((field) => field.key === 'sleeping_places'));

    const errors: FieldError[] = [];
    const items = readInvestments(
      {
        items: [
          { category: 'classroom', permanent: 5, need_rooms: 2, need_budget_million: 1250.555, note: ' Xây mới ' },
          { category: 'classroom', permanent: 1 },
          { category: 'teacher_housing', borrowed: -1 },
          { category: 'other' },
        ],
      },
      errors,
    );
    assert.equal(items.length, 1);
    assert.deepEqual(
      [items[0]?.need_budget_million, items[0]?.note, items[0]?.semi_permanent],
      [1250.56, 'Xây mới', null],
    );
    assert.deepEqual(
      errors.map((error) => error.field),
      ['items.1.category', 'items.2.borrowed', 'items.3.category'],
    );
    const empty: FieldError[] = [];
    readInvestments({ items: [] }, empty);
    assert.equal(empty[0]?.field, 'items');

    const levelErrors: FieldError[] = [];
    const levels = readStandardLevels(
      {
        items: [
          { room_block: 'meal', level: 'level_1', note: 'Bếp một chiều' },
          { room_block: 'meal', level: 'level_2' },
          { room_block: 'support', level: 'level_3' },
          { room_block: 'garden', level: 'level_1' },
        ],
      },
      levelErrors,
    );
    assert.deepEqual(levels, [{ room_block: 'meal', level: 'level_1', note: 'Bếp một chiều' }]);
    assert.deepEqual(
      levelErrors.map((error) => error.field),
      ['items.1.room_block', 'items.2.level', 'items.3.room_block'],
    );
  });

  it('CT-16i-3: đọc tệp nhập phòng và danh mục thiết bị: mã, tên danh mục không dấu, cập nhật giữ giá trị cũ, lỗi theo dòng', () => {
    const context = {
      units: [{ id: 'U1', code: 'DT-1', name: 'Điểm trường 1' }],
      rooms: [
        {
          id: 'R1',
          org_unit_id: 'U1',
          code: 'P1',
          name: 'Phòng cũ',
          capacity: 20,
          status: 'active',
          room_block: 'care_education',
          room_type: 'group_room',
          condition: 'permanent',
          area_m2: 40,
          facility_attributes: { sleeping_places: 18 },
        },
      ],
    };
    const parsed = parseRoomRows(
      [
        { row: 2, values: { org_unit: 'dt-1', code: 'P1', area_m2: '45,5', toilet: 'Khép kín' } },
        {
          row: 3,
          values: {
            org_unit: 'Điểm trường 1',
            code: 'WC1',
            name: 'Vệ sinh lớp',
            capacity: '10',
            room_type: 'phong ve sinh',
            condition: 'Kiên cố',
            toilet_users: 'Học sinh',
            toilet_separate_gender: 'Có',
          },
        },
        { row: 4, values: { org_unit: 'DT-9', code: 'P9', name: 'X', capacity: '5' } },
        {
          row: 5,
          values: {
            org_unit: 'DT-1',
            code: 'P2',
            name: 'Bếp',
            capacity: '0',
            room_block: 'meal',
            room_type: 'group_room',
          },
        },
        { row: 6, values: { org_unit: 'DT-1', code: 'P3', name: 'Ngủ', capacity: '20', toilet_users: 'Học sinh' } },
        { row: 7, values: { org_unit: 'DT-1', code: 'WC1', name: 'Trùng', capacity: '3' } },
      ],
      context,
    );
    assert.equal(parsed.rooms.length, 2);
    const updated = parsed.rooms[0];
    assert.deepEqual(
      [updated?.room_id, updated?.name, updated?.capacity, updated?.area_m2, updated?.facility_attributes],
      ['R1', 'Phòng cũ', 20, 45.5, { sleeping_places: 18, toilet: 'ensuite' }],
    );
    const toilet = parsed.rooms[1];
    assert.deepEqual(
      [toilet?.room_id, toilet?.room_block, toilet?.room_type, toilet?.facility_attributes],
      [null, 'care_education', 'toilet', { toilet_users: 'children', toilet_separate_gender: true }],
    );
    assert.deepEqual(
      parsed.errors.map((error) => [error.row, error.column]),
      [
        [4, 'Mã đơn vị'],
        [5, 'Sức chứa'],
        [5, 'Loại phòng'],
        [6, 'Đối tượng sử dụng nhà vệ sinh'],
        [7, 'Mã phòng'],
      ],
    );
    assert.equal(ROOM_IMPORT_COLUMNS[0]?.header, 'Mã đơn vị');

    const equipment = parseEquipmentRows(
      [
        { row: 2, values: { code: 'MG5-DD-01', quantity: '0,75', note: 'Đã đối chiếu' } },
        {
          row: 3,
          values: {
            name: 'Bộ đồ chơi xếp hình',
            unit: 'bộ',
            equipment_group: 'thiet bi day hoc, do choi va hoc lieu',
            age_group: 'Mẫu giáo 4–5 tuổi',
            quantity: '2',
            kind: 'Ngoài danh mục',
          },
        },
        { row: 4, values: { name: 'Thiếu nhóm', unit: 'cái', age_group: 'mg_3_4', quantity: '1' } },
        {
          row: 5,
          values: { code: 'X', name: 'Sai', unit: 'cái', equipment_group: 'do_dung', age_group: 'mg_9', quantity: 'a' },
        },
      ],
      {
        items: [
          {
            id: 'I1',
            code: 'MG5-DD-01',
            name: 'Bàn cho trẻ',
            unit: 'cái',
            equipment_group: 'do_dung',
            development_area: null,
            age_group: 'mg_5_6',
            quantity: 0.5,
            norm_basis: 'child',
            target_users: 'tre',
            equipment_type: null,
            is_minimum: true,
            status: 'active',
            note: 'Cần đối chiếu văn bản',
          },
        ],
      },
    );
    assert.equal(equipment.items.length, 2);
    assert.deepEqual(
      [
        equipment.items[0]?.item_id,
        equipment.items[0]?.quantity,
        equipment.items[0]?.is_minimum,
        equipment.items[0]?.note,
      ],
      ['I1', 0.75, true, 'Đã đối chiếu'],
    );
    assert.deepEqual(
      [
        equipment.items[1]?.code,
        equipment.items[1]?.equipment_group,
        equipment.items[1]?.age_group,
        equipment.items[1]?.is_minimum,
      ],
      [null, 'thiet_bi_do_choi', 'mg_4_5', false],
    );
    assert.deepEqual(
      equipment.errors.map((error) => [error.row, error.column]),
      [
        [4, 'Nhóm thiết bị'],
        [5, 'Nhóm tuổi'],
        [5, 'Số lượng'],
      ],
    );
    assert.equal(EQUIPMENT_IMPORT_COLUMNS[0]?.header, 'Mã thiết bị');
  });
});

describe('Cơ sở vật chất theo Sở qua máy chủ API', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let vice: LoggedInUser;
  let manager: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};

  const call = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const errorOf = (body: Row) => (body.error as { code?: string; rule_code?: string } | undefined) ?? {};
  const workbookOf = async (headers: string[], rows: string[][]) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Dữ liệu');
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  };
  const upload = async (accessToken: string, buffer: Buffer, type: string) => {
    const form = new FormData();
    form.append('type', type);
    form.append('file', new Blob([new Uint8Array(buffer)]), 'nhap.xlsx');
    const response = await fetch(`${environment.baseUrl}/facility-imports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Row };
  };
  const fetchFile = async (method: string, path: string, accessToken: string, body?: unknown) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { response, buffer: Buffer.from(await response.arrayBuffer()) };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
    ] as const) {
      units[code] = (await call('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type }))
        .body.id as string;
    }
    vice = await environment.loginAs('VT-15', null);
    manager = await environment.loginAs('VT-03', units['PH-A'] ?? '');
    teacher = await environment.loginAs('VT-07', units['PH-A'] ?? '');
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-16i-4: phòng vệ sinh khai báo đối tượng, đạt chuẩn; 1.2 báo cáo số liệu, nhà vệ sinh; ghi mức độ đạt chuẩn toàn trường', async () => {
    const create = (body: Row) =>
      call('POST', '/rooms', principal.accessToken, { org_unit_id: units['PH-A'], ...body });
    const groupRoom = await create({
      code: 'SHC1',
      name: 'Phòng sinh hoạt chung 1',
      capacity: 30,
      room_block: 'care_education',
      room_type: 'group_room',
      condition: 'permanent',
      area_m2: 60,
      facility_attributes: { toilet: 'adjacent' },
    });
    assert.equal(groupRoom.status, 201, JSON.stringify(groupRoom.body));
    const wrongType = await create({
      code: 'SHC2',
      name: 'Phòng sinh hoạt chung 2',
      capacity: 30,
      room_block: 'care_education',
      room_type: 'group_room',
      facility_attributes: { toilet_users: 'children' },
    });
    assert.equal(wrongType.status, 400);
    const toilet = await create({
      code: 'WC1',
      name: 'Nhà vệ sinh học sinh',
      capacity: 10,
      room_block: 'care_education',
      room_type: 'toilet',
      condition: 'permanent',
      area_m2: 15,
      facility_attributes: { toilet_users: 'children', toilet_standard: 'met', toilet_seats: 5 },
    });
    assert.equal(toilet.status, 201, JSON.stringify(toilet.body));

    const report = await call('GET', '/facilities/report', vice.accessToken);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const figures = report.body.figures as Row[];
    assert.deepEqual(
      [figures[0]?.total, figures[0]?.permanent, figures[0]?.area_m2],
      [2, 2, 75],
      'tổng số phòng đang dùng',
    );
    const toilets = report.body.toilets as { rows: Row[]; group_rooms_adjacent: number };
    assert.deepEqual([toilets.rows[0]?.rooms, toilets.rows[0]?.met, toilets.rows[0]?.seats], [1, 1, 5]);
    assert.equal(toilets.group_rooms_adjacent, 1);
    assert.equal(report.body.overall_level, null);
    const completeness = report.body.completeness as Array<{ done: boolean }>;
    assert.deepEqual(
      completeness.map((item) => item.done),
      [true, true, true, false],
    );
    const scoped = await call('GET', `/facilities/report?org_unit_id=${units['PH-A']}`, manager.accessToken);
    assert.equal(scoped.status, 200, 'người quản lý phân hiệu xem báo cáo của đơn vị mình');
    assert.equal((await call('GET', '/facilities/report', teacher.accessToken)).status, 403);

    const levels = ['care_education', 'meal', 'support', 'administration', 'other'].map((block) => ({
      room_block: block,
      level: block === 'support' ? 'level_1' : 'level_2',
    }));
    const forbidden = await call('PUT', '/facilities/report/standard-levels', vice.accessToken, { items: levels });
    assert.equal(forbidden.status, 403, 'đánh giá mức độ đạt chuẩn cần quyền cập nhật hồ sơ trường');
    const saved = await call('PUT', '/facilities/report/standard-levels', principal.accessToken, { items: levels });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.overall_level, 'level_1');
    assert.equal(saved.body.overall_level_label, 'Mức độ 1');
    const again = await call('PUT', '/facilities/report/standard-levels', principal.accessToken, {
      items: [{ room_block: 'support', level: 'level_2', note: 'Đã bổ sung phòng đa chức năng' }],
    });
    assert.equal(again.body.overall_level, 'level_2');
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'facility_standard_levels')
      .execute();
    assert.equal(audit.filter((row) => row.action === 'update').length, 1);

    const exported = await fetchFile('POST', '/facilities/report/export', vice.accessToken, {});
    assert.equal(exported.response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer as unknown as ArrayBuffer);
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['Số liệu phòng', 'Nhà vệ sinh', 'Mức độ đạt chuẩn'],
    );
    const pdf = await fetchFile('POST', '/facilities/report/export', vice.accessToken, { format: 'pdf' });
    assert.equal(pdf.response.headers.get('content-type'), 'application/pdf');
  });

  it('CT-16i-5: 6.1 thực trạng và nhu cầu đầu tư: gợi ý từ khai báo phòng, ghi toàn trường, xuất Excel, phân quyền', async () => {
    const listed = await call('GET', '/facilities/investments', vice.accessToken);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const items = listed.body.items as Array<Row & { suggestion: Row }>;
    assert.deepEqual(
      items.map((item) => item.category),
      ['classroom', 'teacher_housing'],
    );
    assert.equal(items[0]?.suggestion.permanent, 1, 'một phòng sinh hoạt chung kiên cố');
    assert.equal(listed.body.can_manage, false);
    assert.equal((await call('GET', '/facilities/investments', manager.accessToken)).status, 403);
    const body = {
      items: [
        {
          category: 'classroom',
          permanent: 1,
          degraded_level4: 2,
          need_classes: 2,
          need_rooms: 2,
          need_budget_million: 3500,
        },
        { category: 'teacher_housing', borrowed: 1, need_rooms: 1, need_budget_million: 800.5 },
      ],
    };
    assert.equal((await call('PUT', '/facilities/investments', vice.accessToken, body)).status, 403);
    const saved = await call('PUT', '/facilities/investments', principal.accessToken, body);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const savedItems = saved.body.items as Row[];
    assert.deepEqual(
      [savedItems[0]?.degraded_level4, savedItems[0]?.need_budget_million, savedItems[1]?.need_budget_million],
      [2, 3500, 800.5],
    );
    const invalid = await call('PUT', '/facilities/investments', principal.accessToken, {
      items: [{ category: 'classroom', need_rooms: 1.5 }],
    });
    assert.equal(invalid.status, 400);
    const exported = await fetchFile('POST', '/facilities/investments/export', vice.accessToken, {});
    assert.equal(exported.response.status, 200);
    assert.match(exported.response.headers.get('content-disposition') ?? '', /thuc-trang-nhu-cau-dau-tu/);
  });

  it('CT-16i-6: nhập phòng và danh mục thiết bị từ Excel: file mẫu kèm dữ liệu, lỗi theo dòng, file lỗi, ghi, phân quyền', async () => {
    const columns = await call('GET', '/facility-imports/templates/rooms/columns', manager.accessToken);
    assert.equal(columns.status, 200, JSON.stringify(columns.body));
    assert.equal(columns.body.template_with_data, true);
    assert.equal((await call('GET', '/facility-imports/templates/rooms/columns', teacher.accessToken)).status, 403);
    const template = await fetchFile('GET', '/facility-imports/templates/rooms?with_data=true', manager.accessToken);
    assert.equal(template.response.status, 200);
    const templateBook = new ExcelJS.Workbook();
    await templateBook.xlsx.load(template.buffer as unknown as ArrayBuffer);
    const dataRows: string[] = [];
    templateBook.worksheets[0]?.eachRow((row, number) => {
      if (number > 1) {
        dataRows.push(String(row.getCell(2).value));
      }
    });
    assert.ok(dataRows.includes('SHC1') && dataRows.includes('WC1'), 'file mẫu kèm phòng đang có');
    const catalogs = await call('GET', '/facility-imports/catalogs/rooms', manager.accessToken);
    assert.ok((catalogs.body.items as Row[]).some((catalog) => catalog.key === 'room_types'));

    const headers = ROOM_IMPORT_COLUMNS.map((column) => column.header);
    const rowOf = (values: Record<string, string>) => ROOM_IMPORT_COLUMNS.map((column) => values[column.key] ?? '');
    const bad = await upload(
      manager.accessToken,
      await workbookOf(headers, [
        rowOf({ org_unit: 'PH-A', code: 'P10', name: 'Phòng mới', capacity: '25' }),
        rowOf({ org_unit: 'TC', code: 'P11', name: 'Ngoài phạm vi', capacity: '25' }),
      ]),
      'rooms',
    );
    assert.equal(bad.status, 201, JSON.stringify(bad.body));
    assert.equal(bad.body.status, 'failed');
    assert.equal(bad.body.error_rows, 1);
    const errorFile = await fetchFile(
      'GET',
      `/facility-imports/${String(bad.body.id)}/error-file`,
      manager.accessToken,
    );
    assert.equal(errorFile.response.status, 200);
    const blocked = await call('POST', `/facility-imports/${String(bad.body.id)}/commit`, manager.accessToken);
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-128');

    const good = await upload(
      manager.accessToken,
      await workbookOf(headers, [
        rowOf({
          org_unit: 'PH-A',
          code: 'P10',
          name: 'Phòng giáo dục thể chất',
          capacity: '40',
          room_type: 'Phòng giáo dục thể chất',
          condition: 'Bán kiên cố',
          area_m2: '80',
        }),
        rowOf({ org_unit: 'PH-A', code: 'WC1', toilet_standard: 'Chưa đạt chuẩn', toilet_separate_gender: 'Có' }),
      ]),
      'rooms',
    );
    assert.equal(good.body.status, 'validated', JSON.stringify(good.body));
    const committed = await call('POST', `/facility-imports/${String(good.body.id)}/commit`, manager.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.equal(committed.body.assigned_rows, 2);
    const saved = await schoolYear
      .selectFrom('rooms')
      .select(['code', 'room_block', 'condition', 'facility_attributes'])
      .where('org_unit_id', '=', units['PH-A'] ?? '')
      .where('code', 'in', ['P10', 'WC1'])
      .orderBy('code')
      .execute();
    assert.deepEqual(
      saved.map((row) => [row.code, row.room_block, row.condition]),
      [
        ['P10', 'support', 'semi_permanent'],
        ['WC1', 'care_education', 'permanent'],
      ],
    );
    assert.deepEqual(saved[1]?.facility_attributes, {
      toilet_users: 'children',
      toilet_standard: 'not_met',
      toilet_seats: 5,
      toilet_separate_gender: true,
    });

    // Danh mục thiết bị cần quyền quản lý thiết bị toàn trường
    assert.equal(
      (await call('GET', '/facility-imports/templates/equipment_items/columns', manager.accessToken)).status,
      403,
    );
    const equipmentHeaders = EQUIPMENT_IMPORT_COLUMNS.map((column) => column.header);
    const equipmentRow = (values: Record<string, string>) =>
      EQUIPMENT_IMPORT_COLUMNS.map((column) => values[column.key] ?? '');
    const equipment = await upload(
      principal.accessToken,
      await workbookOf(equipmentHeaders, [
        equipmentRow({ code: 'MG5-DD-01', quantity: '0.75', note: 'Đã đối chiếu văn bản' }),
        equipmentRow({
          name: 'Bộ đồ chơi lắp ráp',
          unit: 'bộ',
          equipment_group: 'Thiết bị dạy học, đồ chơi và học liệu',
          age_group: 'Mẫu giáo 5–6 tuổi',
          quantity: '2',
        }),
      ]),
      'equipment_items',
    );
    assert.equal(equipment.body.status, 'validated', JSON.stringify(equipment.body));
    assert.equal(
      (await call('POST', `/facility-imports/${String(equipment.body.id)}/commit`, principal.accessToken)).status,
      200,
    );
    const updated = await schoolYear
      .selectFrom('equipment_items')
      .select(['quantity', 'note'])
      .where('code', '=', 'MG5-DD-01')
      .executeTakeFirstOrThrow();
    assert.deepEqual([Number(updated.quantity), updated.note], [0.75, 'Đã đối chiếu văn bản']);
    const created = await schoolYear
      .selectFrom('equipment_items')
      .select(['code', 'is_minimum'])
      .where('name', '=', 'Bộ đồ chơi lắp ráp')
      .executeTakeFirstOrThrow();
    assert.match(created.code, /^NDM-\d{4}$/);
    assert.equal(created.is_minimum, false);
  });

  it('CT-16i-7: gửi lên cấp trên 1.2 và 2.3: xuất tệp gửi, dữ liệu chưa đủ thì không đánh dấu, 2.3 cho trường không có dữ liệu', async () => {
    const listed = await call(
      'GET',
      '/upper-level-submissions?forms=facilities-report,equipment-summary',
      vice.accessToken,
    );
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const forms = listed.body.items as Row[];
    assert.deepEqual(
      forms.map((form) => [form.form_code, form.allow_no_data]),
      [
        ['facilities-report', false],
        ['equipment-summary', true],
      ],
    );
    assert.equal(forms[0]?.data_complete, true, 'phòng đủ khối, hiện trạng, diện tích; đã đánh giá đủ năm khối');
    const exported = await call('POST', '/upper-level-submissions/facilities-report/export', vice.accessToken);
    assert.equal(exported.status, 200, JSON.stringify(exported.body));
    assert.equal(exported.body.exported_data_complete, true);
    const file = await fetchFile('GET', '/upper-level-submissions/facilities-report/file', vice.accessToken);
    assert.match(file.response.headers.get('content-disposition') ?? '', /bao-cao-co-so-vat-chat/);
    const today = VIETNAM_DATE.format(new Date());
    const noData = await call('POST', '/upper-level-submissions/facilities-report/mark-sent', vice.accessToken, {
      sent_on: today,
      no_data: true,
    });
    assert.equal(noData.status, 422, '1.2 không cho đánh dấu trường không có dữ liệu');
    const sent = await call('POST', '/upper-level-submissions/facilities-report/mark-sent', vice.accessToken, {
      sent_on: today,
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.status, 'sent');
    const locked = await call('POST', '/upper-level-submissions/facilities-report/export', vice.accessToken);
    assert.equal(locked.status, 422);

    // 2.3: lớp chưa nhập số hiện có nên dữ liệu chưa đủ; xuất tệp gửi được, đánh dấu cần "trường không có dữ liệu"
    await schoolYear
      .insertInto('grade_levels')
      .values({ code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 72, created_by: null })
      .execute();
    const year = await environment.system.selectFrom('academic_years').select('id').executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: units['PH-A'] ?? '',
        academic_year_id: year.id,
        code: 'LA1',
        name: 'Lá 1',
        grade_level: 'LA',
        max_size: 30,
      })
      .execute();
    const equipment = await call('GET', '/upper-level-submissions?forms=equipment-summary', vice.accessToken);
    assert.equal((equipment.body.items as Row[])[0]?.data_complete, false);
    const equipmentExport = await call('POST', '/upper-level-submissions/equipment-summary/export', vice.accessToken);
    assert.equal(equipmentExport.status, 200, JSON.stringify(equipmentExport.body));
    const incomplete = await call('POST', '/upper-level-submissions/equipment-summary/mark-sent', vice.accessToken, {
      sent_on: today,
    });
    assert.equal(incomplete.status, 422);
    const marked = await call('POST', '/upper-level-submissions/equipment-summary/mark-sent', vice.accessToken, {
      sent_on: today,
      no_data: true,
      note: 'Chưa trang bị thiết bị năm nay',
    });
    assert.equal(marked.status, 200, JSON.stringify(marked.body));
    assert.equal(marked.body.no_data, true);
    assert.equal(
      (await call('GET', '/upper-level-submissions?forms=equipment-summary', manager.accessToken)).status,
      403,
      'biểu mẫu toàn trường cần phạm vi toàn trường',
    );
  });
});

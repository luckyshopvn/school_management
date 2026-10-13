import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
import { buildEmisStartOfYear, isEthnicMinority, staffCategory } from './emis-calc.js';
import { buildEquipmentReport, classNorm } from './equipment-report-calc.js';
import { summarizeRooms } from './facility-rooms.js';
import { ageGroupOfMonths } from './facility-rules.js';

type Row = Record<string, unknown>;

// Hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, báo cáo EMIS đầu năm (DT-14 phần 14d, YCTD-102)
describe('Hàm tính thiết bị dạy học, cơ sở vật chất và EMIS', () => {
  it('CT-14d-1: định mức, hiện có, thừa, thiếu, nhu cầu, tỷ lệ đáp ứng; nhóm tuổi theo khối; chỉ tiêu EMIS', () => {
    assert.equal(ageGroupOfMonths(18, 36), 'nt_24_36');
    assert.equal(ageGroupOfMonths(0, 12), 'nt_3_12');
    assert.equal(ageGroupOfMonths(36, 48), 'mg_3_4');
    assert.equal(ageGroupOfMonths(60, 72), 'mg_5_6');
    assert.equal(classNorm({ quantity: 0.5, norm_basis: 'child' }, 25), 13);
    assert.equal(classNorm({ quantity: 2, norm_basis: 'class' }, 25), 2);

    const item = (id: string, quantity: number, basis: string, minimum = true) => ({
      id,
      code: id,
      name: id,
      unit: 'cái',
      equipment_group: 'do_dung',
      development_area: null,
      age_group: 'mg_5_6',
      quantity,
      norm_basis: basis,
      is_minimum: minimum,
      order_no: 1,
    });
    const classes = [
      { id: 'L1', name: 'Lá 1', org_unit_id: 'U', age_group: 'mg_5_6', child_count: 25 },
      { id: 'L2', name: 'Lá 2', org_unit_id: 'U', age_group: 'mg_5_6', child_count: 20 },
      { id: 'M1', name: 'Mầm 1', org_unit_id: 'U', age_group: 'mg_3_4', child_count: 20 },
    ];
    const report = buildEquipmentReport({
      items: [item('BAN', 0.5, 'child'), item('GIA', 5, 'class'), item('DAN', 1, 'class', false)],
      classes,
      holdings: [
        { equipment_item_id: 'BAN', org_unit_id: 'U', class_id: null, quantity: 10, next_year_need: null },
        { equipment_item_id: 'BAN', org_unit_id: 'U', class_id: 'L1', quantity: 13, next_year_need: null },
        { equipment_item_id: 'GIA', org_unit_id: 'U', class_id: null, quantity: 12, next_year_need: 1 },
        { equipment_item_id: 'DAN', org_unit_id: 'U', class_id: null, quantity: 2, next_year_need: 3 },
      ],
      assets: [{ equipment_item_id: 'BAN', org_unit_id: 'U', class_id: 'L2' }],
      classId: null,
    });
    const ban = report.rows.find((row) => row.code === 'BAN');
    // Định mức 13 + 10 = 23; hiện có 10 + 13 + 1 tài sản = 24; thừa 1
    assert.deepEqual(
      [
        ban?.norm,
        ban?.available,
        ban?.surplus,
        ban?.shortage,
        ban?.rate_percent,
        ban?.next_year_need,
        ban?.need_source,
      ],
      [23, 24, 1, 0, 100, 0, 'shortage'],
    );
    const gia = report.rows.find((row) => row.code === 'GIA');
    assert.deepEqual(
      [gia?.norm, gia?.available, gia?.shortage, gia?.rate_percent, gia?.next_year_need, gia?.need_source],
      [10, 12, 0, 100, 1, 'manual'],
    );
    const dan = report.rows.find((row) => row.code === 'DAN');
    assert.deepEqual([dan?.norm, dan?.available, dan?.rate_percent, dan?.next_year_need], [null, 2, null, 3]);
    assert.equal(report.totals.item_count, 2);
    assert.equal(report.totals.met_count, 2);
    // Lớp Lá 1: bàn 13/13, giá 0/5; Lá 2: bàn 1/10, giá 0/5
    const l1 = report.classes.find((row) => row.class_id === 'L1');
    assert.deepEqual([l1?.norm, l1?.covered, l1?.rate_percent], [18, 13, 72.2]);
    const byClass = buildEquipmentReport({
      items: [item('BAN', 0.5, 'child')],
      classes,
      holdings: [{ equipment_item_id: 'BAN', org_unit_id: 'U', class_id: null, quantity: 30, next_year_need: null }],
      assets: [],
      classId: 'L1',
    });
    assert.deepEqual([byClass.rows[0]?.norm, byClass.rows[0]?.available, byClass.rows[0]?.shortage], [13, 0, 13]);

    const summary = summarizeRooms([
      { room_block: 'care_education', condition: 'permanent', area_m2: 50, status: 'active' },
      { room_block: 'care_education', condition: null, area_m2: 40.5, status: 'active' },
      { room_block: 'meal', condition: 'borrowed', area_m2: null, status: 'active' },
      { room_block: 'meal', condition: 'borrowed', area_m2: 10, status: 'inactive' },
    ]);
    const care = summary.find((row) => row.room_block === 'care_education');
    assert.deepEqual([care?.total, care?.permanent, care?.unspecified, care?.area_m2], [2, 1, 1, 90.5]);
    const total = summary.find((row) => row.room_block === 'total');
    assert.deepEqual([total?.total, total?.borrowed, total?.area_m2], [3, 1, 90.5]);

    assert.equal(isEthnicMinority('Kinh'), false);
    assert.equal(isEthnicMinority(' Tày '), true);
    assert.equal(isEthnicMinority(null), false);
    assert.equal(staffCategory({ position_group: null, job_title: 'Phó Hiệu trưởng' }), 'manager');
    assert.equal(staffCategory({ position_group: 'Giáo viên', job_title: 'Bảo vệ' }), 'teacher');
    assert.equal(staffCategory({ position_group: null, job_title: null }), 'employee');
    const emis = buildEmisStartOfYear({
      ownership: 'private',
      startYear: 2026,
      units: [{ unit_type: 'truong_chinh' }],
      classes: [{ age_group: 'nt_24_36' }, { age_group: 'mg_5_6' }],
      children: [
        { gender: 'female', birth_year: 2024, age_group: 'nt_24_36', ethnicity: 'Kinh', disability: null },
        { gender: 'male', birth_year: 2021, age_group: null, ethnicity: 'Tày', disability: 'Không' },
      ],
      staff: [],
      rooms: [],
    });
    const totalChildren = emis.tabs[1]?.rows[0];
    assert.deepEqual(
      [totalChildren?.total, totalChildren?.private, totalChildren?.public, totalChildren?.female],
      [2, 2, 0, 1],
    );
    assert.equal(emis.tabs[1]?.rows[3]?.total, 1, 'trẻ 5 tuổi chưa có lớp tính vào mẫu giáo 5–6 tuổi');
    assert.equal(emis.tabs[1]?.rows[4]?.total, 0, 'loại khuyết tật "Không" không tính');
    assert.equal(emis.tabs[2]?.rows[2]?.total, 1);
    const noOwnership = buildEmisStartOfYear({
      ownership: null,
      startYear: 2026,
      units: [],
      classes: [],
      children: [],
      staff: [],
      rooms: [],
    });
    assert.equal(noOwnership.tabs[0]?.rows[0]?.public, null);
    assert.ok(noOwnership.warnings.some((warning) => warning.includes('loại hình trường')));
  });
});

describe('Hồ sơ trường, cơ sở vật chất, thiết bị dạy học, EMIS qua máy chủ API', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const items: Record<string, string> = {};
  const rooms: Record<string, string> = {};

  const unit = (code: string) => units[code] ?? '';
  const token = (name: string) => users[name]?.accessToken ?? '';
  const call = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const download = async (path: string, accessToken: string, body: unknown = {}) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      return { status: response.status, workbook: null, logId: null };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return { status: response.status, workbook, logId: response.headers.get('x-export-log-id') };
  };
  const sheetRows = (workbook: ExcelJS.Workbook | null, name: string) => {
    const sheet = workbook?.getWorksheet(name);
    assert.ok(sheet, `Thiếu trang ${name}`);
    const values: unknown[][] = [];
    sheet.eachRow((row) => values.push((row.values as unknown[]).slice(1)));
    return values;
  };
  const errorCode = (body: Row) => (body.error as { code?: string; rule_code?: string } | undefined) ?? {};

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
      ['ĐT-A1', 'diem_truong'],
    ] as const) {
      units[code] = (await call('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type }))
        .body.id as string;
    }
    users.managerA = await environment.loginAs('VT-03', unit('PH-A'));
    users.managerA1 = await environment.loginAs('VT-03', unit('ĐT-A1'));
    users.teacher = await environment.loginAs('VT-07', unit('PH-A'));
    users.vice = await environment.loginAs('VT-15', null);
    users.viceBranch = await environment.loginAs('VT-15', unit('PH-A'));
    users.storekeeper = await environment.loginAs('VT-11', unit('PH-A'));
    await schoolYear
      .insertInto('grade_levels')
      .values([
        { code: 'NT', name: 'Nhà trẻ', age_from_months: 18, age_to_months: 36, created_by: null },
        { code: 'MAM', name: 'Mầm', age_from_months: 36, age_to_months: 48, created_by: null },
        { code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 72, created_by: null },
      ])
      .execute();
    for (const [code, unitCode, grade] of [
      ['NT1', 'ĐT-A1', 'NT'],
      ['MAM1', 'ĐT-A1', 'MAM'],
      ['LA1', 'PH-A', 'LA'],
      ['X1', 'PH-A', 'XX'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unit(unitCode),
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const addChild = async (
      name: string,
      classCode: string,
      dob: string,
      gender: 'male' | 'female',
      profile: Row | null,
      status: 'active' | 'withdrawn' = 'active',
    ) => {
      const classId = classes[classCode] ?? '';
      const classUnit = await schoolYear
        .selectFrom('classes')
        .select('org_unit_id')
        .where('id', '=', classId)
        .executeTakeFirstOrThrow();
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: classUnit.org_unit_id,
          full_name: name,
          dob,
          gender,
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status,
          moet_profile: profile ? JSON.stringify(profile) : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05' })
        .execute();
    };
    await addChild('Học sinh Một', 'NT1', '2024-05-01', 'female', { ethnicity: 'Kinh' });
    await addChild('Học sinh Hai', 'MAM1', '2023-02-01', 'male', { ethnicity: 'Tày' });
    await addChild('Học sinh Ba', 'LA1', '2021-03-01', 'female', { disability_type: 'Khuyết tật vận động' });
    await addChild('Học sinh Bốn', 'LA1', '2021-06-01', 'female', null, 'withdrawn');
    const jobTitle = async (name: string) =>
      (
        await schoolYear
          .insertInto('job_titles')
          .values({ org_unit_id: unit('TC'), name, created_by: null })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const principalTitle = await jobTitle('Hiệu trưởng');
    const guardTitle = await jobTitle('Bảo vệ');
    for (const [code, gender, titleId, profile, status] of [
      ['NS1', 'female', principalTitle, { party_member: true }, 'active'],
      ['NS2', 'female', null, { position_group: 'Giáo viên', ethnicity: 'Khmer' }, 'active'],
      ['NS3', 'male', guardTitle, null, 'active'],
      ['NS4', 'female', null, null, 'terminated'],
    ] as const) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unit('TC'),
          code,
          full_name: `Nhân sự ${code}`,
          gender,
          job_title_id: titleId,
          start_date: '2020-08-01',
          status,
          moet_profile: profile ? JSON.stringify(profile) : null,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-14d-2: khai báo phòng theo khối, loại, hiện trạng, thuộc tính; kiểm tra loại thuộc khối; khóa thuộc tính lạ', async () => {
    const create = (body: Row) => call('POST', '/rooms', token('managerA1'), { org_unit_id: unit('ĐT-A1'), ...body });
    const p1 = await create({
      code: 'P1',
      name: 'Phòng sinh hoạt chung Mầm 1',
      capacity: 30,
      room_block: 'care_education',
      room_type: 'group_room',
      condition: 'permanent',
      area_m2: 50.5,
      facility_attributes: { sleeping_places: 25, toilet: 'ensuite', has_private_playground: true },
    });
    assert.equal(p1.status, 201, JSON.stringify(p1.body));
    assert.equal(p1.body.area_m2, 50.5);
    assert.deepEqual(p1.body.facility_attributes, {
      sleeping_places: 25,
      toilet: 'ensuite',
      has_private_playground: true,
    });
    rooms.P1 = p1.body.id as string;
    const p2 = await create({
      code: 'P2',
      name: 'Bếp',
      capacity: 10,
      room_block: 'meal',
      room_type: 'kitchen',
      condition: 'semi_permanent',
      area_m2: 30,
    });
    assert.equal(p2.status, 201, JSON.stringify(p2.body));
    rooms.P2 = p2.body.id as string;
    const p3 = await create({ code: 'P3', name: 'Phòng chưa khai báo', capacity: 5 });
    assert.equal(p3.status, 201);
    const p4 = await create({
      code: 'P4',
      name: 'Phòng tạm',
      capacity: 5,
      room_block: 'other',
      condition: 'temporary',
    });
    assert.equal(p4.status, 201);
    await call('PATCH', `/rooms/${p4.body.id}`, token('managerA1'), { status: 'inactive' });
    await schoolYear
      .updateTable('classes')
      .set({ room_id: rooms.P1 ?? null })
      .where('id', '=', classes.MAM1 ?? '')
      .execute();

    const wrongType = await create({ code: 'P5', name: 'X', capacity: 5, room_block: 'meal', room_type: 'bedroom' });
    assert.equal(wrongType.status, 400);
    const unknownAttribute = await create({
      code: 'P5',
      name: 'X',
      capacity: 5,
      facility_attributes: { password: 'x' },
    });
    assert.equal(unknownAttribute.status, 400);
    const badCondition = await create({ code: 'P5', name: 'X', capacity: 5, condition: 'new' });
    assert.equal(badCondition.status, 400);
    // Chỉ đổi loại phòng thì so với khối đang lưu
    const patchType = await call('PATCH', `/rooms/${rooms.P2}`, token('managerA1'), { room_type: 'bedroom' });
    assert.equal(patchType.status, 400);
    const patchBlock = await call('PATCH', `/rooms/${rooms.P2}`, token('managerA1'), { room_block: 'support' });
    assert.equal(patchBlock.status, 400, 'đổi khối mà loại đang lưu không thuộc khối mới');
    const patched = await call('PATCH', `/rooms/${rooms.P2}`, token('managerA1'), {
      facility_attributes: { dining_seats: 40 },
      area_m2: 32.25,
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal(patched.body.area_m2, 32.25);
    assert.equal(patched.body.room_type, 'kitchen');
  });

  it('CT-14d-3: danh sách cơ sở vật chất lọc khối, loại, hiện trạng; tổng hợp; phạm vi; xuất Excel ghi nhật ký', async () => {
    const all = await call('GET', '/facilities/rooms', principal.accessToken);
    assert.equal(all.status, 200, JSON.stringify(all.body));
    assert.equal((all.body.rooms as Row[]).length, 4);
    const p1 = (all.body.rooms as Row[]).find((row) => row.code === 'P1');
    assert.deepEqual(p1?.class_names, ['MAM1']);
    assert.equal(p1?.org_unit_name, 'ĐT-A1');
    const total = (all.body.summary as Row[]).find((row) => row.room_block === 'total');
    assert.deepEqual(
      [total?.total, total?.permanent, total?.semi_permanent, total?.unspecified, total?.area_m2],
      [3, 1, 1, 1, 82.75],
    );
    assert.ok((all.body.summary as Row[]).some((row) => row.room_block === 'unassigned' && row.total === 1));
    const meal = await call('GET', '/facilities/rooms?room_block=meal', principal.accessToken);
    assert.deepEqual(
      (meal.body.rooms as Row[]).map((row) => row.code),
      ['P2'],
    );
    const permanent = await call(
      'GET',
      '/facilities/rooms?condition=permanent&room_type=group_room',
      principal.accessToken,
    );
    assert.deepEqual(
      (permanent.body.rooms as Row[]).map((row) => row.code),
      ['P1'],
    );
    assert.equal((await call('GET', '/facilities/rooms?condition=moi', principal.accessToken)).status, 400);
    // Quản lý PH-A không thấy phòng của ĐT-A1; giáo viên không có quyền
    const managerA = await call('GET', '/facilities/rooms', token('managerA'));
    assert.equal((managerA.body.rooms as Row[]).length, 0);
    assert.equal((await call('GET', `/facilities/rooms?org_unit_id=${unit('ĐT-A1')}`, token('managerA'))).status, 403);
    assert.equal((await call('GET', '/facilities/rooms', token('teacher'))).status, 403);

    const exported = await download('/facilities/rooms/export', principal.accessToken, {
      room_block: 'care_education',
    });
    assert.equal(exported.status, 200);
    const listRows = sheetRows(exported.workbook, 'Danh sách phòng');
    assert.equal(listRows[0]?.[0], '1.1 Khai báo cơ sở vật chất');
    assert.ok(listRows.some((row) => row.includes('Phòng sinh hoạt chung Mầm 1') && row.includes('Kiên cố')));
    assert.ok(sheetRows(exported.workbook, 'Tổng hợp').some((row) => row[0] === 'Tổng số'));
    const log = await schoolYear
      .selectFrom('export_logs')
      .selectAll()
      .where('id', '=', exported.logId ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(log.report_code, 'facility-rooms');
    // Một phòng của khối đã lọc và sáu dòng tổng hợp (năm khối và dòng tổng)
    assert.equal(log.row_count, 1 + 6);
  });

  it('CT-14d-4: danh mục thiết bị tối thiểu gieo sẵn; chỉ người toàn trường sửa danh mục; thêm thiết bị ngoài danh mục', async () => {
    const listed = await call('GET', '/equipment-items?age_group=mg_5_6', principal.accessToken);
    assert.equal(listed.status, 200);
    for (const row of listed.body as unknown as Row[]) {
      items[row.code as string] = row.id as string;
    }
    const seeded = (listed.body as unknown as Row[]).filter((row) => row.is_seeded);
    assert.ok(seeded.length >= 5);
    assert.ok(seeded.every((row) => row.is_minimum === true && row.note === 'Cần đối chiếu văn bản'));
    assert.equal((await call('GET', '/equipment-items', token('teacher'))).status, 403);

    const body = {
      name: 'Đàn piano điện',
      unit: 'cái',
      equipment_group: 'thiet_bi_do_choi',
      development_area: 'tham_my',
      age_group: 'mg_5_6',
      quantity: 1,
      equipment_type: 'Nhạc cụ',
      target_users: 'tre_giao_vien',
    };
    assert.equal((await call('POST', '/equipment-items', token('managerA'), body)).status, 403);
    assert.equal(
      (await call('POST', '/equipment-items', principal.accessToken, { ...body, age_group: 'x' })).status,
      400,
    );
    assert.equal(
      (await call('POST', '/equipment-items', principal.accessToken, { ...body, quantity: -1 })).status,
      400,
    );
    const created = await call('POST', '/equipment-items', principal.accessToken, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.is_minimum, false);
    assert.match(created.body.code as string, /^NDM-\d{4}$/);
    items.PIANO = created.body.id as string;
    const duplicate = await call('POST', '/equipment-items', principal.accessToken, {
      ...body,
      code: created.body.code,
    });
    assert.equal(duplicate.status, 409);
    const outside = await call('GET', '/equipment-items?is_minimum=false', token('storekeeper'));
    assert.deepEqual(
      (outside.body as unknown as Row[]).map((row) => row.name),
      ['Đàn piano điện'],
    );
    // Hiệu trưởng sửa định mức của thiết bị gieo sẵn
    const edited = await call('PATCH', `/equipment-items/${items['MG5-DD-03']}`, principal.accessToken, {
      quantity: 4,
      note: 'Đã đối chiếu',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.quantity, 4);
    assert.equal(
      (await call('PATCH', `/equipment-items/${items['MG5-DD-03']}`, token('managerA'), { quantity: 5 })).status,
      403,
    );
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'equipment_items')
      .execute();
    assert.equal(audit.length, 2);
  });

  it('CT-14d-5: nhập số hiện có theo đơn vị và lớp; phạm vi đơn vị; nhu cầu chỉ ở dòng đơn vị; thiết bị ngừng dùng trả YCTD-102', async () => {
    const save = (accessToken: string, orgUnitId: string, rows: Row[]) =>
      call('PUT', '/equipment-holdings', accessToken, { org_unit_id: orgUnitId, items: rows });
    const saved = await save(token('managerA'), unit('PH-A'), [
      { equipment_item_id: items['MG5-DD-03'], class_id: null, quantity: 3 },
      { equipment_item_id: items['MG5-DD-03'], class_id: classes.LA1, quantity: 2 },
      { equipment_item_id: items['MG5-DD-01'], class_id: null, quantity: 0, next_year_need: 2 },
      { equipment_item_id: items.PIANO, class_id: null, quantity: 1, next_year_need: 1 },
    ]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.saved, 4);
    // Ghi lại thì thay số cũ
    assert.equal(
      (
        await save(token('managerA'), unit('PH-A'), [
          { equipment_item_id: items['MG5-DD-03'], class_id: null, quantity: 4 },
        ])
      ).status,
      200,
    );
    const holdings = await call('GET', `/equipment-holdings?org_unit_id=${unit('PH-A')}`, token('managerA'));
    assert.equal((holdings.body as unknown as Row[]).length, 4);
    assert.equal(
      (await save(token('managerA'), unit('ĐT-A1'), [{ equipment_item_id: items['MG5-DD-03'], quantity: 1 }])).status,
      403,
    );
    assert.equal(
      (
        await save(token('managerA'), unit('PH-A'), [
          { equipment_item_id: items['MG5-DD-03'], class_id: classes.NT1, quantity: 1 },
        ])
      ).status,
      400,
    );
    assert.equal(
      (
        await save(token('managerA'), unit('PH-A'), [
          { equipment_item_id: items['MG5-DD-03'], class_id: classes.LA1, quantity: 1, next_year_need: 1 },
        ])
      ).status,
      400,
    );
    assert.equal(
      (await save(token('teacher'), unit('PH-A'), [{ equipment_item_id: items['MG5-DD-03'], quantity: 1 }])).status,
      403,
    );
    await call('PATCH', `/equipment-items/${items['MG5-TB-05']}`, principal.accessToken, { status: 'inactive' });
    const inactive = await save(token('managerA'), unit('PH-A'), [
      { equipment_item_id: items['MG5-TB-05'], quantity: 1 },
    ]);
    assert.equal(inactive.status, 422);
    assert.equal(errorCode(inactive.body).code, 'ERR_RULE_VIOLATION');
    assert.equal(JSON.stringify(inactive.body).includes('YCTD-102'), true);
    await call('PATCH', `/equipment-items/${items['MG5-TB-05']}`, principal.accessToken, { status: 'active' });

    // Tài sản gắn với thiết bị được cộng vào số hiện có
    const asset = await schoolYear
      .insertInto('assets')
      .values({
        org_unit_id: unit('PH-A'),
        code: 'TS-001',
        name: 'Bàn trẻ',
        category: 'Đồ dùng',
        unit: 'cái',
        original_cost: 500000,
        purchase_date: '2026-08-01',
        created_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const linked = await call('POST', '/equipment-assets', token('storekeeper'), {
      asset_id: asset.id,
      equipment_item_id: items['MG5-DD-01'],
    });
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.equal(
      (await call('POST', '/equipment-assets', token('managerA1'), { asset_id: asset.id, equipment_item_id: null }))
        .status,
      403,
    );
  });

  it('CT-14d-6: tổng hợp thiết bị dạy học theo nhóm tuổi, đơn vị, lớp; phạm vi; xuất Excel', async () => {
    const report = await call(
      'GET',
      `/equipment-report?age_group=mg_5_6&org_unit_id=${unit('PH-A')}`,
      token('managerA'),
    );
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const rows = report.body.rows as Row[];
    const shelf = rows.find((row) => row.code === 'MG5-DD-03');
    // Định mức 4 một lớp (đã sửa) × 1 lớp Lá; hiện có 4 + 2 = 6; thừa 2
    assert.deepEqual(
      [shelf?.norm, shelf?.available, shelf?.surplus, shelf?.shortage, shelf?.rate_percent],
      [4, 6, 2, 0, 100],
    );
    const table = rows.find((row) => row.code === 'MG5-DD-01');
    // Bàn 0,5 mỗi học sinh × 1 học sinh đang học = 1; hiện có 1 tài sản; nhu cầu nhập tay 2
    assert.deepEqual(
      [
        table?.norm,
        table?.available,
        table?.asset_quantity,
        table?.shortage,
        table?.next_year_need,
        table?.need_source,
      ],
      [1, 1, 1, 0, 2, 'manual'],
    );
    const piano = rows.find((row) => row.name === 'Đàn piano điện');
    assert.deepEqual([piano?.is_minimum, piano?.norm, piano?.available, piano?.next_year_need], [false, null, 1, 1]);
    assert.deepEqual(report.body.unclassified_classes, ['X1']);
    const classRow = (report.body.classes as Row[]).find((row) => row.class_name === 'LA1');
    assert.equal(classRow?.child_count, 1);

    const byClass = await call('GET', `/equipment-report?class_id=${classes.LA1}`, token('managerA'));
    const shelfInClass = (byClass.body.rows as Row[]).find((row) => row.code === 'MG5-DD-03');
    assert.equal(shelfInClass?.available, 2);
    assert.equal((await call('GET', `/equipment-report?class_id=${classes.NT1}`, token('managerA'))).status, 403);
    assert.equal((await call('GET', `/equipment-report?org_unit_id=${unit('ĐT-A1')}`, token('managerA'))).status, 403);
    assert.equal((await call('GET', '/equipment-report', token('teacher'))).status, 403);
    // Phó Hiệu trưởng ở PH-A có quyền xem báo cáo thiết bị của đơn vị mình
    assert.equal((await call('GET', '/equipment-report', token('viceBranch'))).status, 200);

    const exported = await download('/equipment-report/export', token('managerA'), { age_group: 'mg_5_6' });
    assert.equal(exported.status, 200);
    const sheet = sheetRows(exported.workbook, 'Tổng hợp thiết bị');
    assert.equal(sheet[0]?.[0], '2.1 Tổng hợp thiết bị dạy học');
    assert.ok(sheet.some((row) => row.includes('Đàn piano điện') && row.includes('Ngoài danh mục')));
    assert.ok(sheetRows(exported.workbook, 'Theo lớp').some((row) => row[0] === 'LA1'));
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'org_unit_ids', 'contains_personal_data'])
      .where('id', '=', exported.logId ?? '')
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      [log.report_code, log.org_unit_ids, log.contains_personal_data],
      ['equipment-summary', [unit('PH-A')], false],
    );
  });

  it('CT-14d-7: hồ sơ trường sáu thẻ: Ghi, đọc lại, khóa lạ và kiểu sai bị từ chối, chỉ Hiệu trưởng toàn trường ghi', async () => {
    const empty = await call('GET', '/school-profile', principal.accessToken);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.general, {});
    assert.equal((empty.body.org_unit as Row).code, 'TC');
    const body = {
      general: {
        institution_type: 'truong_mam_non',
        ownership_type: 'private',
        moet_code: '79000000',
        name_by_decision: 'Trường Mầm non Thử Nghiệm',
        land_area_m2: 1200.5,
        decision_date: '2015-08-01',
        change_count: 1,
        managing_authority: 'Phòng Giáo dục mẫu',
        ward: 'Phường Mẫu',
      },
      other_info: { onsite_kitchen: true, library: false, safe_school: true },
      foreign_elements: { has_foreign_element: false },
      internet: { connected: true, connection_type: 'fiber', bandwidth_mbps: 300 },
      it_infrastructure: { computer_rooms: 1, laptops: 5, tablets: 0 },
      office_accounts: [{ account_name: 'truong.mau', holder_name: 'Người dùng mẫu', position: 'Văn thư' }],
    };
    const saved = await call('PUT', '/school-profile', principal.accessToken, body);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.general as Row).land_area_m2, 1200.5);
    assert.deepEqual(saved.body.office_accounts, body.office_accounts);
    // Thẻ không gửi giữ nguyên
    const partial = await call('PUT', '/school-profile', principal.accessToken, { internet: { connected: false } });
    assert.equal(partial.status, 200);
    assert.deepEqual(partial.body.internet, { connected: false });
    assert.equal((partial.body.general as Row).ownership_type, 'private');

    for (const invalid of [
      { general: { unknown_field: 'x' } },
      { other_info: { safe_school: 'có' } },
      { it_infrastructure: { laptops: 1.5 } },
      { general: { ownership_type: 'nuoc_ngoai' } },
      { general: { decision_date: '01/08/2015' } },
      { office_accounts: [{ account_name: 'x', password: 'bi-mat' }] },
      { budget: {} },
    ]) {
      assert.equal(
        (await call('PUT', '/school-profile', principal.accessToken, invalid)).status,
        400,
        JSON.stringify(invalid),
      );
    }
    assert.equal((await call('PUT', '/school-profile', token('managerA'), body)).status, 403);
    assert.equal((await call('PUT', '/school-profile', token('vice'), body)).status, 403);
    assert.equal((await call('GET', '/school-profile', token('vice'))).status, 200);
    assert.equal((await call('GET', '/school-profile', token('teacher'))).status, 403);
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('action')
      .where('entity_name', '=', 'school_profiles')
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      audit.map((row) => row.action),
      ['create', 'update'],
    );
  });

  it('CT-14d-8: báo cáo EMIS đầu năm tính từ dữ liệu, cột theo loại hình trường; cần phạm vi toàn trường; xuất Excel', async () => {
    assert.equal((await call('GET', '/reports/emis/start-of-year', token('viceBranch'))).status, 403);
    assert.equal((await call('GET', '/reports/emis/start-of-year', token('managerA'))).status, 403);
    const report = await call('GET', '/reports/emis/start-of-year', token('vice'));
    assert.equal(report.status, 200, JSON.stringify(report.body));
    assert.equal(report.body.start_year, 2026);
    assert.equal(report.body.ownership, 'private');
    const tabs = report.body.tabs as Array<{ key: string; rows: Row[] }>;
    const values = (key: string) =>
      Object.fromEntries((tabs.find((tab) => tab.key === key)?.rows ?? []).map((row) => [row.code, row]));
    const school = values('school_classes');
    assert.deepEqual(
      ['1.01', '1.02', '1.03', '1.04', '1.05', '1.06', '1.07', '1.08'].map((code) => school[code]?.total),
      [1, 1, 1, 4, 1, 2, 1, 1],
    );
    assert.deepEqual([school['1.04']?.private, school['1.04']?.public, school['1.04']?.female], [4, 0, null]);
    const children = values('children');
    assert.deepEqual([children['2.01']?.total, children['2.01']?.female, children['2.01']?.ethnic_minority], [3, 2, 1]);
    assert.deepEqual(
      ['2.02', '2.03', '2.04', '2.05'].map((code) => children[code]?.total),
      [1, 2, 1, 1],
    );
    const ages = values('children_by_age');
    assert.deepEqual(
      ['3.01', '3.02', '3.03', '3.04', '3.05', '3.06', '3.07'].map((code) => ages[code]?.total),
      [0, 0, 1, 1, 0, 1, 0],
    );
    const staff = values('staff');
    assert.deepEqual(
      ['4.01', '4.02', '4.03', '4.04', '4.05'].map((code) => staff[code]?.total),
      [3, 1, 1, 1, 1],
    );
    assert.deepEqual([staff['4.01']?.female, staff['4.01']?.ethnic_minority], [2, 1]);
    const roomValues = values('rooms');
    assert.deepEqual(
      ['5.01', '5.02', '5.03', '5.06', '5.07', '5.10', '5.11'].map((code) => roomValues[code]?.total),
      [3, 1, 1, 1, 1, 1, 82.75],
    );
    assert.ok((report.body.warnings as string[]).some((warning) => warning.includes('khối không có trong danh mục')));

    const exported = await download('/reports/emis/start-of-year/export', token('vice'));
    assert.equal(exported.status, 200);
    assert.deepEqual(
      exported.workbook?.worksheets.map((sheet) => sheet.name),
      ['Trường – lớp học', 'Học sinh', 'Học sinh theo độ tuổi', 'Đội ngũ', 'Phòng học'],
    );
    const sheet = sheetRows(exported.workbook, 'Học sinh');
    // Dòng trống giữa tiêu đề và bảng không được đọc
    assert.deepEqual(sheet[3], [
      'Chỉ tiêu',
      'Đơn vị',
      'Mã số',
      'Tổng số',
      'Công lập',
      'Tư thục',
      'Dân lập',
      'Nữ',
      'Dân tộc thiểu số',
    ]);
    assert.deepEqual(sheet[4], ['Tổng số học sinh', 'Học sinh', '2.01', 3, 0, 3, 0, 2, 1]);
  });

  it('CT-14d-9: mở năm học mới chuyển hồ sơ trường, khai báo phòng, danh mục thiết bị đã sửa, số hiện có gộp theo đơn vị', async () => {
    const opened = await openTestAcademicYear(environment, principal.accessToken, '2027–2028', {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-25' },
    });
    assert.ok(opened);
    const profile = await call('GET', '/school-profile', principal.accessToken);
    assert.equal((profile.body.general as Row).ownership_type, 'private');
    assert.equal((profile.body.office_accounts as Row[]).length, 1);
    const roomList = await call('GET', `/rooms?org_unit_id=${unit('ĐT-A1')}`, principal.accessToken);
    const p1 = (roomList.body as unknown as Row[]).find((row) => row.code === 'P1');
    assert.deepEqual([p1?.room_type, p1?.condition, p1?.area_m2], ['group_room', 'permanent', 50.5]);
    assert.equal((p1?.facility_attributes as Row).sleeping_places, 25);
    const listed = await call('GET', '/equipment-items?age_group=mg_5_6', principal.accessToken);
    const shelf = (listed.body as unknown as Row[]).find((row) => row.code === 'MG5-DD-03');
    assert.deepEqual([shelf?.id, shelf?.quantity, shelf?.note], [items['MG5-DD-03'], 4, 'Đã đối chiếu']);
    const holdings = await call('GET', `/equipment-holdings?org_unit_id=${unit('PH-A')}`, principal.accessToken);
    const shelfHolding = (holdings.body as unknown as Row[]).find(
      (row) => row.equipment_item_id === items['MG5-DD-03'],
    );
    assert.deepEqual([shelfHolding?.class_id, shelfHolding?.quantity, shelfHolding?.next_year_need], [null, 6, null]);
    assert.equal((holdings.body as unknown as Row[]).length, 3);
  });
});

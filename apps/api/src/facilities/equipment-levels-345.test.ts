import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import {
  EDUCATION_PLAN_DEFAULT_TEMPLATES,
  EQUIPMENT_CATALOG_SOURCES,
  equipmentGroupsOf,
  equipmentLevelOfGroup,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { classGroupOf } from './facilities-data.js';
import { parseEquipmentRows } from './facility-imports.js';

type Row = Record<string, unknown>;

// Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT (YCTD-345); kịch bản CT-1640 đến CT-1646.
// Dữ liệu là dữ liệu giả
const LEVELS = [
  { code: 'MN', display_name: 'Mầm non', learner_term: 'Trẻ' },
  { code: 'TH', display_name: 'Tiểu học', learner_term: 'Học sinh' },
  { code: 'THCS', display_name: 'Trung học cơ sở', learner_term: 'Học sinh' },
  { code: 'THPT', display_name: 'Trung học phổ thông', learner_term: 'Học sinh' },
];
const levelsWith = (enabled: string[]) =>
  LEVELS.map((level, index) => ({
    ...level,
    is_enabled: enabled.includes(level.code),
    order_no: index + 1,
    context_label: `Cấp ${level.code}`,
  }));

describe('Nhóm áp định mức theo cấp học (YCTD-345)', () => {
  it('CT-1646: khối K1–K12 thuộc đúng cấp; lớp phổ thông khớp theo mã khối; nhập Excel suy cấp từ khối và chặn cấp chưa bật', () => {
    assert.equal(equipmentLevelOfGroup('mg_5_6'), 'MN');
    assert.equal(equipmentLevelOfGroup('K1'), 'TH');
    assert.equal(equipmentLevelOfGroup('K9'), 'THCS');
    assert.equal(equipmentLevelOfGroup('K12'), 'THPT');
    assert.equal(equipmentLevelOfGroup('K13'), null);
    assert.deepEqual(
      equipmentGroupsOf('TH').map((group) => group.value),
      ['K1', 'K2', 'K3', 'K4', 'K5'],
    );
    // Chỉ Mầm non có danh mục chuẩn trong tài liệu; ba cấp phổ thông để trường tự nhập
    assert.deepEqual(
      Object.entries(EQUIPMENT_CATALOG_SOURCES).map(([level, source]) => [level, source.standard]),
      [
        ['MN', true],
        ['TH', false],
        ['THCS', false],
        ['THPT', false],
      ],
    );
    const grade = (code: string, level: string, from: number | null = null, to: number | null = null) => ({
      code,
      school_level: level,
      age_from_months: from,
      age_to_months: to,
    });
    assert.equal(classGroupOf(grade('K3', 'TH')), 'K3');
    assert.equal(classGroupOf(grade('K3', 'THCS')), null, 'mã khối không khớp cấp thì chưa xếp được');
    assert.equal(classGroupOf(grade('LOP1', 'TH')), null);
    assert.equal(classGroupOf(grade('LA', 'MN', 60, 72)), 'mg_5_6');
    assert.equal(classGroupOf(undefined), null);

    const row = (number: number, values: Record<string, string>) => ({ row: number, values });
    const parsed = parseEquipmentRows(
      [
        row(2, { name: 'Bộ thiết bị A', unit: 'bộ', equipment_group: 'do_dung', age_group: 'Khối 1', quantity: '1' }),
        row(3, { name: 'Bộ thiết bị B', unit: 'bộ', equipment_group: 'do_dung', age_group: 'K10', quantity: '1' }),
        row(4, {
          name: 'Bộ thiết bị C',
          unit: 'bộ',
          equipment_group: 'do_dung',
          age_group: 'K2',
          development_area: 'the_chat',
          quantity: '1',
        }),
        row(5, { name: 'Bộ thiết bị D', unit: 'bộ', equipment_group: 'do_dung', age_group: 'K99', quantity: '1' }),
      ],
      { items: [], enabledLevels: ['MN', 'TH'] },
    );
    assert.deepEqual(
      parsed.items.map((item) => [item.row, item.age_group, item.school_level]),
      [[2, 'K1', 'TH']],
    );
    assert.deepEqual(
      parsed.errors.map((error) => error.row),
      [3, 4, 5],
    );
  });
});

describe('Danh mục tối thiểu và mẫu kế hoạch cho cấp phổ thông qua máy chủ API (YCTD-345)', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let manager: LoggedInUser;
  const units: Record<string, string> = {};

  const call = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body);
  const errorOf = (body: Row) =>
    (body.error as { code?: string; rule_code?: string; details?: Array<{ field: string }> } | undefined) ?? {};

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
    ] as const) {
      units[code] = (await call('POST', '/org-units', principal, { code, name: code, unit_type: type })).body
        .id as string;
    }
    teacher = await environment.loginAs('VT-07', units['PH-A'] ?? '');
    manager = await environment.loginAs('VT-03', units['PH-A'] ?? '');
    // Giáo viên có hồ sơ nhân sự đang làm việc để lập kế hoạch giáo dục
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: units['PH-A'] ?? '',
        code: 'NS-345-01',
        full_name: 'Giáo Viên Tiểu Học Giả',
        start_date: '2026-08-01',
        user_id: teacher.userId,
      })
      .execute();
    // Trường liên cấp Mầm non và Tiểu học; THCS, THPT chưa bật
    const saved = await call('PUT', '/school-levels', principal, { levels: levelsWith(['MN', 'TH']) });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const grades = await call('POST', '/grade-levels/templates', principal, { school_level: 'TH' });
    assert.equal(grades.status, 200, JSON.stringify(grades.body));
    for (const [code, name] of [
      ['1A', 'Lớp 1A'],
      ['1B', 'Lớp 1B'],
    ] as const) {
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: units['PH-A'] ?? '',
          academic_year_id: yearId,
          code,
          name,
          grade_level: 'K1',
          max_size: 35,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-1640: cấp TH chưa có danh mục chuẩn, trường tự thêm thiết bị theo khối, đối sánh ra Chưa có rồi Đủ', async () => {
    const levels = await call('GET', '/equipment-minimum/levels', manager);
    assert.equal(levels.status, 200, JSON.stringify(levels.body));
    const list = levels.body as unknown as Row[];
    assert.deepEqual(
      list.map((level) => [level.school_level, level.standard, level.catalog_count]),
      [
        ['MN', true, 56],
        ['TH', false, 0],
      ],
    );
    assert.equal(list[1]?.legal_basis, 'Thông tư 37/2021/TT-BGDĐT');
    assert.match(String(list[1]?.note), /trường tự nhập/);
    assert.deepEqual(list[1]?.template_codes, []);

    const empty = await call('GET', `/equipment-minimum?school_level=TH&org_unit_id=${units['PH-A']}`, manager);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.equal(empty.body.catalog_count, 0);
    assert.equal((empty.body.catalog_source as Row).standard, false);

    const created = await call('POST', '/equipment-items', principal, {
      code: 'TH-TU-NHAP-01',
      name: 'Bộ thiết bị tự nhập khối 1',
      unit: 'bộ',
      equipment_group: 'thiet_bi_do_choi',
      school_level: 'TH',
      age_group: 'K1',
      quantity: 2,
      is_minimum: true,
      equipment_type: 'Toán',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual([created.body.school_level, created.body.age_group], ['TH', 'K1']);
    // Không gửi cấp học: suy từ khối
    const inferred = await call('POST', '/equipment-items', principal, {
      name: 'Bảng phụ khối 2',
      unit: 'cái',
      equipment_group: 'do_dung',
      age_group: 'K2',
      quantity: 1,
      is_minimum: true,
    });
    assert.equal(inferred.status, 201, JSON.stringify(inferred.body));
    assert.equal(inferred.body.school_level, 'TH');

    const listed = await call('GET', '/equipment-items?is_minimum=true&school_level=TH', manager);
    assert.deepEqual(
      (listed.body as unknown as Row[]).map((item) => item.code).sort(),
      ['TH-TU-NHAP-01', inferred.body.code].sort(),
    );

    const none = await call('GET', `/equipment-minimum?school_level=TH&org_unit_id=${units['PH-A']}`, manager);
    const rows = none.body.rows as Row[];
    // Hai lớp khối 1, định mức 2 bộ mỗi lớp; khối 2 không có lớp nên không áp dụng
    assert.deepEqual(
      rows.map((row) => [row.code, row.norm, row.available, row.status]),
      [['TH-TU-NHAP-01', 4, 0, 'none']],
    );
    assert.equal(none.body.not_applicable_count, 1);
    assert.deepEqual(none.body.unclassified_classes, []);

    const saved = await call('PUT', '/equipment-holdings', principal, {
      org_unit_id: units['PH-A'],
      items: [{ equipment_item_id: created.body.id, class_id: null, quantity: 4, next_year_need: null }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const enough = await call('GET', `/equipment-minimum?school_level=TH&org_unit_id=${units['PH-A']}`, manager);
    assert.deepEqual(
      (enough.body.rows as Row[]).map((row) => row.status),
      ['enough'],
    );
    // Đối sánh Mầm non không lẫn lớp Tiểu học
    const mn = await call('GET', `/equipment-minimum?school_level=MN&org_unit_id=${units['PH-A']}`, manager);
    assert.deepEqual(mn.body.unclassified_classes, []);
    const exported = await fetch(`${environment.baseUrl}/equipment-minimum/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${manager.accessToken}` },
      body: JSON.stringify({ school_level: 'TH', format: 'xlsx' }),
    });
    assert.equal(exported.status, 200);
  });

  it('CT-1641: dữ liệu sai: khối không thuộc cấp, lĩnh vực phát triển ở cấp phổ thông, mã cấp lạ, sửa sang khối khác cấp', async () => {
    const base = { name: 'Thiết bị sai', unit: 'cái', equipment_group: 'do_dung', quantity: 1, is_minimum: true };
    const mismatch = await call('POST', '/equipment-items', principal, {
      ...base,
      school_level: 'TH',
      age_group: 'mg_5_6',
    });
    assert.equal(mismatch.status, 400);
    assert.deepEqual(
      errorOf(mismatch.body).details?.map((item) => item.field),
      ['age_group'],
    );
    const area = await call('POST', '/equipment-items', principal, {
      ...base,
      age_group: 'K3',
      development_area: 'the_chat',
    });
    assert.equal(area.status, 400);
    const badLevel = await call('POST', '/equipment-items', principal, {
      ...base,
      school_level: 'DH',
      age_group: 'K3',
    });
    assert.equal(badLevel.status, 400);
    const badGroup = await call('POST', '/equipment-items', principal, { ...base, age_group: 'K13' });
    assert.equal(badGroup.status, 400);
    const badCompare = await call('GET', '/equipment-minimum?school_level=DH', manager);
    assert.equal(badCompare.status, 400);

    const item = await call('POST', '/equipment-items', principal, { ...base, age_group: 'K4' });
    assert.equal(item.status, 201, JSON.stringify(item.body));
    const moved = await call('PATCH', `/equipment-items/${item.body.id}`, principal, { school_level: 'MN' });
    assert.equal(moved.status, 400, 'đổi cấp mà khối cũ không thuộc cấp mới bị từ chối');
    const regrouped = await call('PATCH', `/equipment-items/${item.body.id}`, principal, { age_group: 'K5' });
    assert.equal(regrouped.status, 200, JSON.stringify(regrouped.body));
    assert.equal(regrouped.body.age_group, 'K5');
  });

  it('CT-1642: cấp học không thuộc trường (chưa bật) bị từ chối ở thêm thiết bị, đối sánh, nạp mẫu kế hoạch, tạo mẫu kế hoạch', async () => {
    const outside = await call('POST', '/equipment-items', principal, {
      name: 'Thiết bị THPT',
      unit: 'cái',
      equipment_group: 'do_dung',
      age_group: 'K10',
      quantity: 1,
      is_minimum: true,
    });
    assert.equal(outside.status, 422, JSON.stringify(outside.body));
    assert.equal(errorOf(outside.body).rule_code, 'YCTD-152');
    const compare = await call('GET', '/equipment-minimum?school_level=THCS', manager);
    assert.equal(compare.status, 422);
    const defaults = await call('POST', '/education-plan-templates/defaults', principal, { school_level: 'THPT' });
    assert.equal(defaults.status, 422);
    const template = await call('POST', '/education-plan-templates', principal, {
      code: 'THCS-TU-TAO',
      name: 'Mẫu THCS',
      school_level: 'THCS',
      scope: 'personal',
      period: 'year',
      sections: [{ key: 'noi_dung', title: 'Nội dung', kind: 'text' }],
    });
    assert.equal(template.status, 422);
  });

  it('CT-1643: trường TH nạp khung rỗng kế hoạch (không tự soạn nội dung), tự tạo mẫu riêng, lập kế hoạch theo mẫu', async () => {
    assert.equal((await call('POST', '/professional-folders/defaults', principal, { school_level: 'TH' })).status, 200);
    const loaded = await call('POST', '/education-plan-templates/defaults', principal, { school_level: 'TH' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.deepEqual(loaded.body, { created: 6, skipped: 0, kind: 'frame' });
    const again = await call('POST', '/education-plan-templates/defaults', principal, { school_level: 'TH' });
    assert.deepEqual(again.body, { created: 0, skipped: 6, kind: 'frame' });
    const list = (await call('GET', '/education-plan-templates?school_level=TH', principal)).body as unknown as Row[];
    const frames = list.filter((row) => String(row.code).startsWith('TH-KHUNG-'));
    assert.deepEqual(
      frames.map((row) => row.code).sort(),
      EDUCATION_PLAN_DEFAULT_TEMPLATES.TH.map((seed) => seed.code).sort(),
    );
    // Mỗi khung chỉ một mục văn bản trống, ghi rõ chưa có mẫu chuẩn
    for (const frame of frames) {
      const sections = frame.sections as Row[];
      assert.equal(sections.length, 1);
      assert.equal(sections[0]?.kind, 'text');
      assert.match(String(frame.description), /chưa có mẫu chuẩn/);
    }
    assert.equal(
      frames.find((row) => row.code === 'TH-KHUNG-GIAO-VIEN')?.archive_folder_name,
      'Kế hoạch giáo dục của giáo viên',
    );

    const own = await call('POST', '/education-plan-templates', principal, {
      code: 'TH-TRUONG-TU-TAO',
      name: 'Kế hoạch dạy học môn của giáo viên (trường tự tạo)',
      school_level: 'TH',
      scope: 'personal',
      period: 'year',
      sections: [
        { key: 'mon_hoc', title: 'Môn học, khối lớp', kind: 'text' },
        {
          key: 'phan_phoi',
          title: 'Phân phối',
          kind: 'table',
          columns: [
            { key: 'tuan', label: 'Tuần' },
            { key: 'bai', label: 'Bài' },
          ],
        },
      ],
      approval_steps: ['leader'],
    });
    assert.equal(own.status, 201, JSON.stringify(own.body));
    const plan = await call('POST', '/education-plans', teacher, {
      template_id: own.body.id,
      title: 'Kế hoạch dạy học Toán 1',
    });
    assert.equal(plan.status, 201, JSON.stringify(plan.body));
  });

  it('CT-1644: dữ liệu sai của mẫu kế hoạch: cấp lạ, mục sai cấu trúc', async () => {
    const badLevel = await call('POST', '/education-plan-templates/defaults', principal, { school_level: 'DH' });
    assert.equal(badLevel.status, 400);
    const badTemplate = await call('POST', '/education-plan-templates', principal, {
      code: 'TH SAI',
      name: '',
      school_level: 'TH',
      sections: [],
    });
    assert.equal(badTemplate.status, 400);
    assert.deepEqual(
      new Set(errorOf(badTemplate.body).details?.map((item) => item.field)),
      new Set(['code', 'name', 'sections']),
    );
  });

  it('CT-1645: theo vai trò: giáo viên không thêm thiết bị, không xem nguồn danh mục, không nạp hay tạo mẫu kế hoạch (403)', async () => {
    const item = await call('POST', '/equipment-items', teacher, {
      name: 'Thiết bị',
      unit: 'cái',
      equipment_group: 'do_dung',
      age_group: 'K1',
      quantity: 1,
      is_minimum: true,
    });
    assert.equal(item.status, 403);
    assert.equal((await call('GET', '/equipment-minimum/levels', teacher)).status, 403);
    assert.equal((await call('GET', '/equipment-minimum?school_level=TH', teacher)).status, 403);
    // Quản lý một đơn vị không sửa được danh mục toàn trường
    const scoped = await call('POST', '/equipment-items', manager, {
      name: 'Thiết bị',
      unit: 'cái',
      equipment_group: 'do_dung',
      age_group: 'K1',
      quantity: 1,
      is_minimum: true,
    });
    assert.equal(scoped.status, 403);
    assert.equal(
      (await call('POST', '/education-plan-templates/defaults', teacher, { school_level: 'TH' })).status,
      403,
    );
    assert.equal(
      (
        await call('POST', '/education-plan-templates', teacher, {
          code: 'TH-GV',
          name: 'Mẫu',
          school_level: 'TH',
          sections: [{ key: 'a', title: 'A', kind: 'text' }],
        })
      ).status,
      403,
    );
  });
});

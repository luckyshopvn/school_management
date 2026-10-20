import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { equipmentQrCodeOf } from '@school-management/shared';
import type { FieldError } from '@school-management/server';
import {
  sendJson,
  openTestAcademicYear,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import type { EquipmentReportRow } from './equipment-report-calc.js';
import {
  compareMinimum,
  generateQrCode,
  lineStatus,
  normalizeScan,
  summarizeStocktake,
} from './equipment-stocktake-calc.js';
import { EQUIPMENT_TEMPLATES, parseTemplateLines } from './equipment-templates.js';

type Row = Record<string, unknown>;

// Thiết bị: nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu (DT-18 phần 18g, YCTD-143)
const reportRow = (values: Partial<EquipmentReportRow>): EquipmentReportRow => ({
  equipment_item_id: 'id',
  code: 'MN',
  name: 'Thiết bị',
  unit: 'cái',
  equipment_group: 'do_dung',
  development_area: null,
  age_group: 'mg_5_6',
  is_minimum: true,
  quantity: 1,
  norm_basis: 'class',
  class_count: 1,
  norm: 1,
  available: 0,
  manual_quantity: 0,
  asset_quantity: 0,
  surplus: 0,
  shortage: 0,
  next_year_need: null,
  need_source: null,
  rate_percent: null,
  ...values,
});

describe('Hàm tính của kiểm kê thiết bị và đối sánh danh mục tối thiểu', () => {
  it('CT-18g-1: tình trạng khi quét tài sản và lô, chênh lệch, tỷ lệ sử dụng được', () => {
    const errors: FieldError[] = [];
    const scan = (type: 'asset' | 'holding', input: Partial<Parameters<typeof normalizeScan>[1]>) =>
      normalizeScan(type, { condition: null, counted_quantity: null, usable_quantity: null, ...input }, errors);
    assert.deepEqual(scan('asset', { condition: 'good' }), {
      condition: 'good',
      counted_quantity: 1,
      usable_quantity: 1,
    });
    assert.deepEqual(scan('asset', { condition: 'damaged' }), {
      condition: 'damaged',
      counted_quantity: 1,
      usable_quantity: 0,
    });
    assert.deepEqual(scan('asset', { condition: 'missing' }), {
      condition: 'missing',
      counted_quantity: 0,
      usable_quantity: 0,
    });
    assert.deepEqual(scan('holding', { counted_quantity: 10 }), {
      condition: 'good',
      counted_quantity: 10,
      usable_quantity: 10,
    });
    assert.deepEqual(scan('holding', { counted_quantity: 10, usable_quantity: 7 }), {
      condition: 'damaged',
      counted_quantity: 10,
      usable_quantity: 7,
    });
    assert.deepEqual(scan('holding', { counted_quantity: 4, usable_quantity: 0, condition: 'unusable' }), {
      condition: 'unusable',
      counted_quantity: 4,
      usable_quantity: 0,
    });
    assert.equal(scan('holding', { counted_quantity: 0 })?.condition, 'missing');
    assert.equal(errors.length, 0);
    assert.equal(scan('asset', {}), null);
    assert.equal(scan('holding', { counted_quantity: 3, usable_quantity: 5 }), null);
    assert.equal(scan('holding', { counted_quantity: -1 }), null);
    assert.deepEqual(
      errors.map((error) => error.field),
      ['condition', 'usable_quantity', 'counted_quantity'],
    );

    const line = (expected: number, counted: number | null, usable: number | null, inScope = true) => ({
      in_scope: inScope,
      expected_quantity: expected,
      counted_quantity: counted,
      usable_quantity: usable,
      condition:
        counted === null
          ? null
          : counted === 0
            ? ('missing' as const)
            : usable === counted
              ? ('good' as const)
              : ('damaged' as const),
    });
    assert.deepEqual(lineStatus(line(5, null, null)), { status: 'unchecked', difference: null });
    assert.deepEqual(lineStatus(line(5, 3, 3)), { status: 'shortage', difference: -2 });
    assert.deepEqual(lineStatus(line(0, 1, 1, false)), { status: 'surplus', difference: 1 });
    const summary = summarizeStocktake([
      line(10, 10, 8),
      line(5, 3, 3),
      line(1, 0, 0),
      line(0, 1, 1, false),
      line(2, null, null),
    ]);
    assert.deepEqual(
      [
        summary.line_count,
        summary.counted_count,
        summary.unchecked_count,
        summary.matched_count,
        summary.shortage_count,
        summary.surplus_count,
        summary.out_of_scope_count,
      ],
      [5, 4, 1, 1, 2, 1, 1],
    );
    assert.deepEqual(
      [
        summary.expected_total,
        summary.counted_total,
        summary.usable_total,
        summary.shortage_quantity,
        summary.surplus_quantity,
      ],
      [18, 14, 12, 3, 1],
    );
    assert.equal(summary.usable_rate_percent, 85.7);
    assert.deepEqual(summary.conditions, { good: 2, damaged: 1, unusable: 0, missing: 1 });
  });

  it('CT-18g-2: mã tem không có tên miền, đọc được từ đường dẫn; đối sánh đủ, thiếu, chưa có', () => {
    const code = generateQrCode();
    assert.match(code, /^TB-[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.equal(
      generateQrCode(() => 0),
      'TB-0000000000',
    );
    assert.equal(equipmentQrCodeOf(` ${code.toLowerCase()} `), code);
    assert.equal(equipmentQrCodeOf(`https://truong.example/tb/${code}`), code);
    assert.equal(equipmentQrCodeOf(`/thiet-bi?ma=${code}&x=1`), code);
    assert.equal(equipmentQrCodeOf('TB-123'), null);
    assert.equal(equipmentQrCodeOf('TB-ILOU000000'), null);

    const comparison = compareMinimum([
      reportRow({ equipment_item_id: 'a', norm: 4, available: 4, shortage: 0 }),
      reportRow({ equipment_item_id: 'b', norm: 4, available: 6, shortage: 0 }),
      reportRow({ equipment_item_id: 'c', norm: 4, available: 1, shortage: 3 }),
      reportRow({ equipment_item_id: 'd', norm: 2, available: 0, shortage: 2 }),
      reportRow({ equipment_item_id: 'e', is_minimum: false, norm: null, available: 3 }),
      reportRow({ equipment_item_id: 'f', norm: 0, available: 0 }),
    ]);
    assert.deepEqual(
      comparison.rows.map((row) => [row.equipment_item_id, row.status]),
      [
        ['a', 'enough'],
        ['b', 'enough'],
        ['c', 'short'],
        ['d', 'none'],
      ],
    );
    assert.deepEqual(comparison.totals, { item_count: 4, enough: 2, short: 1, none: 1, rate_percent: 50 });
  });

  it('CT-18g-3: mẫu Mầm non theo Thông tư 02/2010 đã bỏ thiết bị bãi bỏ, đổi tên theo Thông tư 34/2013', () => {
    const template = EQUIPMENT_TEMPLATES.find((item) => item.code === 'MN-TT02-2010');
    assert.ok(template);
    assert.equal(template.school_level, 'MN');
    assert.equal(template.items.length, 515);
    const byAge = (age: string) => template.items.filter((item) => item.age_group === age).length;
    assert.deepEqual(
      ['nt_3_12', 'nt_12_24', 'nt_24_36', 'mg_3_4', 'mg_4_5', 'mg_5_6'].map(byAge),
      [44, 62, 83, 95, 117, 114],
    );
    assert.equal(new Set(template.items.map((item) => item.code)).size, template.items.length, 'mã không trùng');
    // Bãi bỏ theo Thông tư 34/2013: không còn trong mẫu
    for (const removed of ['MN013043', 'MN123066', 'MN233084', 'MN343091', 'MN453121', 'MN563118']) {
      assert.ok(!template.items.some((item) => item.code === removed), removed);
    }
    assert.equal(template.items.find((item) => item.code === 'MN122047')?.name, 'Bút sáp, phấn vẽ');
    const ball = template.items.find((item) => item.code === 'MN562030');
    assert.deepEqual(
      [ball?.equipment_group, ball?.age_group, ball?.quantity, ball?.target_users],
      ['thiet_bi_do_choi', 'mg_5_6', 16, 'tre'],
    );
    assert.equal(template.items.find((item) => item.code === 'MN563124')?.equipment_group, 'sach_tai_lieu');
    assert.throws(() => parseTemplateLines('MN991001|Sai nhóm tuổi|cái|1|t'));
  });
});

describe('Thiết bị: nơi để, tem QR, kiểm kê, đối sánh qua máy chủ API', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let manager: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let storekeeper: LoggedInUser;
  const units: Record<string, string> = {};

  const call = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const errorOf = (body: Row) => (body.error as { code?: string; rule_code?: string } | undefined) ?? {};
  const fetchFile = async (path: string, accessToken: string, body: unknown) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
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
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      units[code] = (await call('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type }))
        .body.id as string;
    }
    manager = await environment.loginAs('VT-03', units['PH-A'] ?? '');
    teacher = await environment.loginAs('VT-07', units['PH-A'] ?? '');
    otherTeacher = await environment.loginAs('VT-07', units['PH-B'] ?? '');
    storekeeper = await environment.loginAs('VT-11', units['PH-A'] ?? '');
  });

  after(async () => {
    await environment.close();
  });

  it('CT-18g-4: nơi để, gán nơi để, in tem QR (mã giữ nguyên khi in lại), tra mã tem theo phạm vi', async () => {
    const store = await call('POST', '/equipment-locations', manager.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'KHO1',
      name: 'Kho thiết bị',
      location_type: 'store',
    });
    assert.equal(store.status, 201, JSON.stringify(store.body));
    const shelf = await call('POST', '/equipment-locations', manager.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'KHO1-G1',
      name: 'Giá số 1',
      location_type: 'position',
      parent_id: store.body.id,
    });
    assert.equal(shelf.status, 201);
    const duplicate = await call('POST', '/equipment-locations', manager.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'KHO1',
      name: 'Trùng mã',
      location_type: 'store',
    });
    assert.equal(duplicate.status, 409);
    const nested = await call('POST', '/equipment-locations', manager.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'X',
      name: 'Ba cấp',
      location_type: 'position',
      parent_id: shelf.body.id,
    });
    assert.equal(nested.status, 400, 'chỉ hai cấp nơi để');
    const outside = await call('POST', '/equipment-locations', manager.accessToken, {
      org_unit_id: units['PH-B'],
      code: 'KHO',
      name: 'Kho PH-B',
      location_type: 'store',
    });
    assert.equal(outside.status, 403, 'quản lý đơn vị không lập nơi để cho đơn vị khác');

    const asset = await call('POST', '/assets', storekeeper.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'TS-18G-1',
      name: 'Đàn organ',
      category: 'Thiết bị dạy học',
      unit: 'cái',
      original_cost: 3_000_000,
      purchase_date: '2026-09-10',
    });
    assert.equal(asset.status, 201, JSON.stringify(asset.body));
    const items = await call('GET', '/equipment-items?is_minimum=true', principal.accessToken);
    const item = (items.body as unknown as Row[])[0] as Row;
    const holdings = await call('PUT', '/equipment-holdings', principal.accessToken, {
      org_unit_id: units['PH-A'],
      items: [{ equipment_item_id: item.id, class_id: null, quantity: 10 }],
    });
    assert.equal(holdings.status, 200, JSON.stringify(holdings.body));
    const listed = await call('GET', `/equipment-placements?org_unit_id=${units['PH-A']}`, manager.accessToken);
    const targets = listed.body as unknown as Row[];
    const holding = targets.find((target) => target.target_type === 'holding') as Row;
    assert.ok(holding);
    assert.ok(targets.some((target) => target.target_type === 'asset' && target.id === asset.body.id));

    const placed = await call('PUT', '/equipment-placements', manager.accessToken, {
      org_unit_id: units['PH-A'],
      location_id: shelf.body.id,
      targets: [
        { target_type: 'asset', id: asset.body.id },
        { target_type: 'holding', id: holding.id },
      ],
    });
    assert.deepEqual([placed.status, placed.body.saved], [200, 2]);
    const inStore = await call(
      'GET',
      `/equipment-placements?org_unit_id=${units['PH-A']}&location_id=${store.body.id}`,
      manager.accessToken,
    );
    assert.equal((inStore.body as unknown as Row[]).length, 2, 'lọc theo kho gồm cả vị trí con');

    const refs = [
      { target_type: 'asset', id: asset.body.id },
      { target_type: 'holding', id: holding.id },
    ];
    const first = await fetchFile('/equipment-labels', manager.accessToken, {
      org_unit_id: units['PH-A'],
      targets: refs,
    });
    assert.equal(first.response.status, 200);
    assert.equal(first.response.headers.get('content-type'), 'application/pdf');
    assert.equal(first.buffer.subarray(0, 4).toString(), '%PDF');
    const afterFirst = (await call('GET', `/equipment-placements?org_unit_id=${units['PH-A']}`, manager.accessToken))
      .body as unknown as Row[];
    const assetCode = afterFirst.find((target) => target.id === asset.body.id)?.qr_code as string;
    assert.match(assetCode, /^TB-[0-9A-Z]{10}$/);
    await fetchFile('/equipment-labels', manager.accessToken, { org_unit_id: units['PH-A'], targets: refs });
    const afterSecond = (await call('GET', `/equipment-placements?org_unit_id=${units['PH-A']}`, manager.accessToken))
      .body as unknown as Row[];
    assert.equal(afterSecond.find((target) => target.id === asset.body.id)?.qr_code, assetCode, 'in lại giữ mã');

    const found = await call('GET', `/equipment-qr/${assetCode}`, teacher.accessToken);
    assert.deepEqual([found.status, found.body.code, found.body.location_name], [200, 'TS-18G-1', 'Giá số 1']);
    const notMine = await call('GET', `/equipment-qr/${assetCode}`, otherTeacher.accessToken);
    assert.equal(notMine.status, 404, 'giáo viên đơn vị khác không tra được');
    const bad = await call('GET', '/equipment-qr/abc', teacher.accessToken);
    assert.equal(bad.status, 400);
  });

  it('CT-18g-5: đợt kiểm kê: chụp sổ, quét bằng giáo viên, ngoài sổ, nộp, duyệt, chốt chênh lệch, biên bản', async () => {
    const targets = (await call('GET', `/equipment-placements?org_unit_id=${units['PH-A']}`, principal.accessToken))
      .body as unknown as Row[];
    const asset = targets.find((target) => target.target_type === 'asset') as Row;
    const holding = targets.find((target) => target.target_type === 'holding') as Row;
    const created = await call('POST', '/equipment-stocktakes', manager.accessToken, {
      org_unit_id: units['PH-A'],
      name: 'Kiểm kê cuối học kỳ I',
      started_on: '2026-12-20',
      members: 'Tổ kiểm kê số 1',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.line_count, 2);
    assert.match(created.body.code as string, /^KKTB-\d{6}$/);
    const second = await call('POST', '/equipment-stocktakes', manager.accessToken, {
      org_unit_id: units['PH-A'],
      name: 'Đợt thứ hai',
      started_on: '2026-12-21',
    });
    assert.equal(errorOf(second.body).rule_code, 'YCTD-143', 'mỗi đơn vị một đợt chưa chốt');
    const id = created.body.id as string;

    // Tài sản mới mua sau khi lập đợt: quét thì thành dòng ngoài sổ
    const extra = await call('POST', '/assets', storekeeper.accessToken, {
      org_unit_id: units['PH-A'],
      code: 'TS-18G-2',
      name: 'Ti vi',
      category: 'Thiết bị dạy học',
      unit: 'cái',
      original_cost: 5_000_000,
      purchase_date: '2026-10-01',
    });
    await fetchFile('/equipment-labels', manager.accessToken, {
      org_unit_id: units['PH-A'],
      targets: [{ target_type: 'asset', id: extra.body.id }],
    });
    const extraCode = (
      (await call('GET', `/equipment-placements?org_unit_id=${units['PH-A']}&search=TS-18G-2`, manager.accessToken))
        .body as unknown as Row[]
    )[0]?.qr_code as string;

    const early = await call('POST', `/equipment-stocktakes/${id}/submit`, manager.accessToken);
    assert.equal(errorOf(early.body).rule_code, 'YCTD-143', 'chưa kiểm hết thì chưa nộp được');

    const scanAsset = await call('POST', `/equipment-stocktakes/${id}/scan`, teacher.accessToken, {
      qr_code: asset.qr_code,
      condition: 'damaged',
      note: 'Hỏng phím',
    });
    assert.deepEqual([scanAsset.status, scanAsset.body.condition, scanAsset.body.status], [200, 'damaged', 'matched']);
    const scanHolding = await call('POST', `/equipment-stocktakes/${id}/scan`, teacher.accessToken, {
      qr_code: holding.qr_code,
      counted_quantity: 8,
      usable_quantity: 6,
    });
    assert.deepEqual(
      [scanHolding.body.status, scanHolding.body.difference, scanHolding.body.condition],
      ['shortage', -2, 'damaged'],
    );
    const scanExtra = await call('POST', `/equipment-stocktakes/${id}/scan`, teacher.accessToken, {
      qr_code: extraCode,
      condition: 'good',
    });
    assert.deepEqual([scanExtra.body.in_scope, scanExtra.body.status], [false, 'surplus']);
    const foreign = await call('POST', `/equipment-stocktakes/${id}/scan`, otherTeacher.accessToken, {
      qr_code: holding.qr_code,
      counted_quantity: 1,
    });
    assert.equal(foreign.status, 403);
    const teacherSubmit = await call('POST', `/equipment-stocktakes/${id}/submit`, teacher.accessToken);
    assert.equal(teacherSubmit.status, 403, 'giáo viên chỉ quét, không nộp');

    const detail = await call('GET', `/equipment-stocktakes/${id}`, teacher.accessToken);
    const summary = detail.body.summary as Row;
    assert.deepEqual(
      [
        summary.line_count,
        summary.counted_count,
        summary.shortage_count,
        summary.surplus_count,
        summary.usable_rate_percent,
      ],
      [3, 3, 1, 1, 70],
    );

    assert.equal((await call('POST', `/equipment-stocktakes/${id}/submit`, manager.accessToken)).status, 200);
    const late = await call('POST', `/equipment-stocktakes/${id}/scan`, teacher.accessToken, {
      qr_code: asset.qr_code,
      condition: 'good',
    });
    assert.equal(errorOf(late.body).rule_code, 'YCTD-143', 'đã nộp thì không quét được');
    const returned = await call('POST', `/equipment-stocktakes/${id}/return`, principal.accessToken, {
      note: 'Kiểm lại lô',
    });
    assert.equal(returned.body.status, 'counting');
    assert.equal((await call('POST', `/equipment-stocktakes/${id}/submit`, manager.accessToken)).status, 200);
    const early2 = await call('POST', `/equipment-stocktakes/${id}/close`, principal.accessToken);
    assert.equal(errorOf(early2.body).rule_code, 'YCTD-143', 'chưa duyệt thì chưa chốt');
    assert.equal(
      (await call('POST', `/equipment-stocktakes/${id}/approve`, principal.accessToken)).body.status,
      'approved',
    );
    const closed = await call('POST', `/equipment-stocktakes/${id}/close`, principal.accessToken);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.deepEqual(closed.body.applied, { holdings: 1, moved: 0, damages: 1, skipped: 0 });

    const holdingsAfter = (await call('GET', `/equipment-holdings?org_unit_id=${units['PH-A']}`, principal.accessToken))
      .body as unknown as Row[];
    assert.equal(holdingsAfter.find((row) => row.id === holding.id)?.quantity, 6, 'lô lấy số dùng được');
    const damages = (await call('GET', '/asset-damages', principal.accessToken)).body as unknown as Row[];
    assert.ok(
      damages.some((row) => row.asset_id === asset.id && row.status === 'pending' && row.incident_type === 'damaged'),
      'tài sản hỏng thành ghi nhận hỏng chờ duyệt',
    );

    const pdf = await fetchFile(`/equipment-stocktakes/${id}/minutes`, teacher.accessToken, { format: 'pdf' });
    assert.equal(pdf.response.status, 200);
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    const xlsx = await fetchFile(`/equipment-stocktakes/${id}/minutes`, principal.accessToken, { format: 'xlsx' });
    assert.equal(xlsx.buffer.subarray(0, 2).toString(), 'PK');
    const list = await call('GET', `/equipment-stocktakes?org_unit_id=${units['PH-A']}`, teacher.accessToken);
    assert.deepEqual(
      [(list.body as unknown as Row[])[0]?.status, (list.body as unknown as Row[])[0]?.counted_count],
      ['closed', 3],
    );
    const next = await call('POST', '/equipment-stocktakes', manager.accessToken, {
      org_unit_id: units['PH-A'],
      name: 'Đợt mới sau khi chốt',
      started_on: '2027-01-05',
    });
    assert.equal(next.status, 201, 'chốt xong lập được đợt mới');
    assert.equal(
      (await call('POST', `/equipment-stocktakes/${next.body.id}/cancel`, manager.accessToken)).body.status,
      'cancelled',
    );
  });

  it('CT-18g-6: nạp danh mục mẫu Mầm non (chỉ thêm mã chưa có, ngừng dòng gieo sẵn tạm thời), đối sánh theo cấp học', async () => {
    const templates = (await call('GET', '/equipment-templates', principal.accessToken)).body as unknown as Row[];
    assert.deepEqual(
      [templates[0]?.code, templates[0]?.item_count, templates[0]?.loaded_count],
      ['MN-TT02-2010', 515, 0],
    );
    const denied = await call('POST', '/equipment-templates/MN-TT02-2010/load', manager.accessToken, {});
    assert.equal(denied.status, 403, 'quản lý một đơn vị không nạp danh mục toàn trường');
    const loaded = await call('POST', '/equipment-templates/MN-TT02-2010/load', principal.accessToken, {
      retire_placeholders: true,
    });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.equal(loaded.body.added, 515);
    // 56 dòng gieo sẵn của 14d; một dòng đã có số hiện có (CT-18g-4) nên giữ lại
    assert.equal(loaded.body.retired, 55);
    const again = await call('POST', '/equipment-templates/MN-TT02-2010/load', principal.accessToken, {});
    assert.deepEqual([again.body.added, again.body.existing], [0, 515], 'nạp lại không thêm, không sửa');
    const unknown = await call('POST', '/equipment-templates/KHONG-CO/load', principal.accessToken, {});
    assert.equal(unknown.status, 404);

    const comparison = await call(
      'GET',
      `/equipment-minimum?org_unit_id=${units['PH-A']}&school_level=MN`,
      manager.accessToken,
    );
    assert.equal(comparison.status, 200);
    assert.equal(comparison.body.catalog_count, 516);
    const badLevel = await call('GET', '/equipment-minimum?school_level=DH', manager.accessToken);
    assert.equal(badLevel.status, 400);
    const exported = await fetchFile('/equipment-minimum/export', manager.accessToken, { school_level: 'MN' });
    assert.equal(exported.response.status, 200);
  });
});

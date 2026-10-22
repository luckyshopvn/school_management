import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import { foodCertificateValidity } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import {
  confirmViolations,
  earliestDestroyAt,
  lotExpiryState,
  lotUnusableReason,
  readClockTime,
  readMoment,
  sampleDestroyState,
  sampleRequired,
  sampleViolations,
  suggestLots,
  vietnamMoment,
} from './food-safety-calc.js';
import { guessFoodCategory } from './food-safety-records.js';

// Bán trú: kiểm thực ba bước, lưu và hủy mẫu, lô hàng, hồ sơ an toàn thực phẩm của nhà cung cấp, truy xuất, sổ in (DT-18
// phần 22b, YCTD-146; BR-143 đến BR-146; Quyết định 1246/QĐ-BYT)
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
let schoolDay = vietnamToday;
while (weekdayOf(schoolDay) > 5) {
  schoolDay = addDays(schoolDay, -1);
}
const weekStart = addDays(schoolDay, 1 - weekdayOf(schoolDay));
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string; details?: FieldError[] };
const HOUR = 3_600_000;

describe('Hàm tính của bán trú và an toàn thực phẩm', () => {
  it('CT-22b-1: lượng mẫu, nhiệt độ, thời gian lưu 24 giờ, giữ mẫu, bữa từ 30 suất', () => {
    assert.deepEqual(sampleViolations({ food_form: 'solid', quantity: 100, storage_temperature: 4 }), []);
    assert.deepEqual(sampleViolations({ food_form: 'liquid', quantity: 150, storage_temperature: 2 }), []);
    assert.deepEqual(
      sampleViolations({ food_form: 'solid', quantity: 99, storage_temperature: 8.5 }).map((error) => error.field),
      ['quantity', 'storage_temperature'],
    );
    assert.equal(sampleViolations({ food_form: 'liquid', quantity: 120, storage_temperature: 5 }).length, 1);
    const sampledAt = new Date('2026-10-20T03:30:00Z');
    assert.equal(earliestDestroyAt(sampledAt).toISOString(), '2026-10-21T03:30:00.000Z');
    assert.equal(
      sampleDestroyState({ status: 'stored', sampled_at: sampledAt }, new Date('2026-10-21T03:29:00Z')),
      'retaining',
    );
    assert.equal(
      sampleDestroyState({ status: 'stored', sampled_at: sampledAt }, new Date('2026-10-21T03:30:00Z')),
      'due',
    );
    assert.equal(
      sampleDestroyState({ status: 'held', sampled_at: sampledAt }, new Date('2026-10-25T00:00:00Z')),
      'held',
    );
    assert.equal(sampleRequired(29), false);
    assert.equal(sampleRequired(30), true);
    assert.equal(vietnamMoment(sampledAt), '10:30 ngày 20/10/2026');
  });

  it('CT-22b-2: hạn dùng của lô, hiệu lực giấy tờ, kết quả kiểm thực, gợi ý và kiểm tra lô cho món, đọc giờ', () => {
    assert.equal(lotExpiryState(null, '2026-10-21'), 'none');
    assert.equal(lotExpiryState('2026-10-20', '2026-10-21'), 'expired');
    assert.equal(lotExpiryState('2026-10-24', '2026-10-21'), 'expiring');
    assert.equal(lotExpiryState('2026-10-25', '2026-10-21'), 'ok');
    const active = (expires: string | null) => ({ status: 'active' as const, expires_on: expires });
    assert.equal(foodCertificateValidity(active(null), '2026-10-21'), 'valid');
    assert.equal(foodCertificateValidity(active('2026-11-20'), '2026-10-21'), 'expiring');
    assert.equal(foodCertificateValidity(active('2026-11-21'), '2026-10-21'), 'valid');
    assert.equal(foodCertificateValidity(active('2026-10-20'), '2026-10-21'), 'expired');
    assert.equal(foodCertificateValidity({ status: 'revoked', expires_on: null }, '2026-10-21'), 'revoked');

    assert.deepEqual(confirmViolations(1, []), ['Phiếu chưa có dòng nào']);
    assert.deepEqual(
      confirmViolations(2, [
        {
          line_no: 1,
          sensory_result: 'pass',
          hygiene_people: 'pass',
          hygiene_equipment: 'pass',
          hygiene_area: 'pass',
          action: null,
        },
        { line_no: 2, sensory_result: null, action: null },
        {
          line_no: 3,
          sensory_result: 'pass',
          hygiene_people: 'fail',
          hygiene_equipment: 'pass',
          hygiene_area: 'pass',
          action: null,
        },
      ]),
      [
        'Dòng 2: chưa ghi kết quả kiểm tra cảm quan',
        'Dòng 2: chưa ghi đủ kết quả kiểm tra điều kiện vệ sinh',
        'Dòng 3: không đạt thì phải ghi biện pháp xử lý',
      ],
    );
    assert.deepEqual(confirmViolations(1, [{ line_no: 1, sensory_result: 'fail', action: 'Trả lại' }]), []);

    const lots = [
      { id: 'old', ingredient_id: 'rice', received_date: '2026-10-10', expiry_date: null, status: 'accepted' },
      { id: 'new', ingredient_id: 'rice', received_date: '2026-10-19', expiry_date: null, status: 'accepted' },
      { id: 'later', ingredient_id: 'rice', received_date: '2026-10-22', expiry_date: null, status: 'accepted' },
      {
        id: 'expired',
        ingredient_id: 'pork',
        received_date: '2026-10-18',
        expiry_date: '2026-10-19',
        status: 'accepted',
      },
      { id: 'rejected', ingredient_id: 'pork', received_date: '2026-10-20', expiry_date: null, status: 'rejected' },
    ];
    assert.deepEqual(suggestLots(['rice', 'pork', 'rice'], lots, '2026-10-20'), ['new']);
    const lot = (status: string, received: string, expiry: string | null) => ({
      code: 'LH-1',
      status,
      received_date: received,
      expiry_date: expiry,
    });
    assert.equal(lotUnusableReason(lot('accepted', '2026-10-20', '2026-10-20'), '2026-10-20'), null);
    assert.equal(lotUnusableReason(lot('used_up', '2026-10-19', null), '2026-10-20'), null);
    assert.match(lotUnusableReason(lot('pending', '2026-10-20', null), '2026-10-20') ?? '', /chưa đạt/);
    assert.match(lotUnusableReason(lot('accepted', '2026-10-21', null), '2026-10-20') ?? '', /nhập sau/);
    assert.match(lotUnusableReason(lot('accepted', '2026-10-01', '2026-10-19'), '2026-10-20') ?? '', /hết hạn/);

    const errors: FieldError[] = [];
    assert.equal(readClockTime('07:05', 'time', errors), '07:05');
    assert.equal(readClockTime('07:05:30', 'time', errors), '07:05');
    assert.equal(readClockTime('', 'time', errors), null);
    assert.equal(readClockTime('25:00', 'bad', errors), null);
    assert.equal(readMoment('2026-10-20T10:30', 'at', errors, true)?.toISOString(), '2026-10-20T03:30:00.000Z');
    assert.equal(readMoment('2026-10-20T10:30:00Z', 'at', errors, true)?.toISOString(), '2026-10-20T10:30:00.000Z');
    assert.equal(readMoment(undefined, 'missing', errors, true), null);
    assert.deepEqual(
      errors.map((error) => error.field),
      ['bad', 'missing'],
    );
    assert.equal(guessFoodCategory('Gạo tẻ'), 'dry');
    assert.equal(guessFoodCategory('Thịt lợn'), 'fresh');
  });
});

describe('Bán trú, kiểm thực ba bước và an toàn thực phẩm qua máy chủ API', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const ids: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    users.kitchen = await environment.loginAs('VT-10', unitA);
    users.otherKitchen = await environment.loginAs('VT-10', units['ĐT-B1'] ?? null);
    users.nurse = await environment.loginAs('VT-09', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);

    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: academicYearId,
          code: 'MAM-1',
          name: 'Mầm 1',
          grade_level: 'MAM',
          max_size: 40,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const now = new Date();
    for (let index = 0; index < 32; index += 1) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Trẻ ${String(index + 1).padStart(2, '0')}`,
          dob: addDays(vietnamToday, -3 * 365),
          gender: index % 2 === 0 ? 'female' : 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
      await schoolYear
        .insertInto('attendance_records')
        .values({
          child_id: child.id,
          class_id: classId,
          org_unit_id: unitA,
          attendance_date: schoolDay,
          status: 'present',
          note: null,
          source: 'teacher',
          recorded_by: users.manager?.userId ?? '',
          recorded_at: now,
        })
        .execute();
    }

    for (const [key, code, name, unit] of [
      ['rice', 'GAO', 'Gạo tẻ', 'kg'],
      ['pork', 'THIT', 'Thịt lợn', 'kg'],
    ] as const) {
      const created = await api('POST', '/ingredients', token('kitchen'), { org_unit_id: unitA, code, name, unit });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      ids[key] = created.body.id as string;
    }
    const dish = await api('POST', '/dishes', token('kitchen'), {
      org_unit_id: unitA,
      name: 'Cơm thịt kho',
      norms: [
        { ingredient_id: ids.rice, quantity_per_serving: 0.05 },
        { ingredient_id: ids.pork, quantity_per_serving: 0.04 },
      ],
    });
    assert.equal(dish.status, 201, JSON.stringify(dish.body));
    ids.dish = dish.body.id as string;
    const menu = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: unitA,
      week_start_date: weekStart,
      items: [{ weekday: weekdayOf(schoolDay), meal_type: 'lunch', dish_id: ids.dish }],
    });
    assert.equal(menu.status, 201, JSON.stringify(menu.body));
    assert.equal((await api('POST', `/menus/${menu.body.id}/submit`, token('kitchen'))).status, 200);
    assert.equal((await api('POST', `/menus/${menu.body.id}/approve`, token('manager'))).status, 200);
    for (const [key, name] of [
      ['supplier', 'Hợp tác xã thực phẩm mẫu'],
      ['market', 'Sạp chợ mẫu'],
    ] as const) {
      const created = await api('POST', '/food-suppliers', token('kitchen'), {
        org_unit_id: unitA,
        name,
        address: 'Địa chỉ mẫu',
        phone: '0900000000',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      ids[key] = created.body.id as string;
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22b-3: hồ sơ an toàn thực phẩm của nhà cung cấp, tệp quét, cảnh báo sắp hết hạn, cảnh báo khi lập phiếu đi chợ', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const form = new FormData();
    form.append('org_unit_id', unitA);
    form.append('file', new Blob([Buffer.from('%PDF-1.4\n% giay chung nhan mau\n')]), 'giay-chung-nhan.pdf');
    const upload = async (accessToken: string) =>
      fetch(`${environment.baseUrl}/food-safety/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
    assert.equal((await upload(token('accountant'))).status, 403);
    const uploaded = await upload(token('kitchen'));
    assert.equal(uploaded.status, 201);
    const file = (await uploaded.json()) as { id: string; content_type: string };
    assert.equal(file.content_type, 'application/pdf');

    const body = {
      supplier_id: ids.supplier,
      certificate_type: 'food_safety',
      number: 'ATTP-001/MAU',
      issued_by: 'Cơ quan cấp mẫu',
      issued_on: addDays(vietnamToday, -300),
      expires_on: addDays(vietnamToday, 10),
      file_id: file.id,
    };
    assert.equal((await api('POST', '/food-supplier-certificates', token('accountant'), body)).status, 403);
    assert.equal((await api('POST', '/food-supplier-certificates', token('otherKitchen'), body)).status, 403);
    const badDates = await api('POST', '/food-supplier-certificates', token('kitchen'), {
      ...body,
      expires_on: addDays(vietnamToday, -400),
    });
    assert.equal(badDates.status, 400);
    const created = await api('POST', '/food-supplier-certificates', token('kitchen'), body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.validity, 'expiring');
    assert.equal(created.body.days_left, 10);
    ids.certificate = created.body.id as string;

    const summary = await api('GET', `/food-suppliers/safety-summary?org_unit_id=${unitA}`, token('nurse'));
    assert.equal(summary.status, 200, JSON.stringify(summary.body));
    const rows = summary.body as unknown as Array<{
      id: string;
      has_valid_food_safety: boolean;
      expiring_count: number;
    }>;
    assert.deepEqual(
      rows.map((row) => [row.id === ids.supplier, row.has_valid_food_safety, row.expiring_count]).sort(),
      [
        [false, false, 0],
        [true, true, 1],
      ],
    );
    const expiring = await api(
      'GET',
      `/food-supplier-certificates?org_unit_id=${unitA}&validity=expiring`,
      token('kitchen'),
    );
    assert.equal((expiring.body as unknown as unknown[]).length, 1);
    const downloaded = await fetch(`${environment.baseUrl}/food-safety/files/${file.id}`, {
      headers: { authorization: `Bearer ${token('nurse')}` },
    });
    assert.equal(downloaded.status, 200);
    assert.equal(
      (
        await fetch(`${environment.baseUrl}/food-safety/files/${file.id}`, {
          headers: { authorization: `Bearer ${token('otherKitchen')}` },
        })
      ).status,
      403,
    );

    const work = await api('GET', '/my-work?source=food_safety', token('kitchen'));
    assert.equal(work.status, 200, JSON.stringify(work.body));
    const items = work.body.items as Array<{ kind: string; title: string }>;
    assert.ok(items.some((item) => item.kind === 'Giấy tờ nhà cung cấp sắp hết hạn'));

    // Phiếu đi chợ của nhà cung cấp chưa có giấy chứng nhận còn hiệu lực có cảnh báo, không chặn (BR-145)
    const withoutCertificate = await api('POST', '/market-purchases', token('kitchen'), {
      org_unit_id: unitA,
      purchase_date: schoolDay,
      supplier_id: ids.market,
      items: [{ ingredient_id: ids.pork, quantity: 2, unit_price: 150000 }],
    });
    assert.equal(withoutCertificate.status, 201, JSON.stringify(withoutCertificate.body));
    assert.match(String(withoutCertificate.body.supplier_certificate_warning), /chưa có giấy chứng nhận/);
    ids.marketPurchase = withoutCertificate.body.id as string;
    const withCertificate = await api('POST', '/market-purchases', token('kitchen'), {
      org_unit_id: unitA,
      purchase_date: schoolDay,
      supplier_id: ids.supplier,
      items: [{ ingredient_id: ids.rice, quantity: 10, unit_price: 20000 }],
    });
    assert.equal(withCertificate.status, 201);
    assert.equal(withCertificate.body.supplier_certificate_warning, null);
    ids.supplierPurchase = withCertificate.body.id as string;

    const revoked = await api('PATCH', `/food-supplier-certificates/${ids.certificate}`, token('kitchen'), {
      status: 'revoked',
    });
    assert.equal(revoked.body.validity, 'revoked');
    const restored = await api('PATCH', `/food-supplier-certificates/${ids.certificate}`, token('kitchen'), {
      status: 'active',
    });
    assert.equal(restored.body.validity, 'expiring');
  });

  it('CT-22b-4: nhập phiếu đi chợ thành lô chờ kiểm tra; bước 1 ghi đạt, không đạt kèm cách xử lý; lô nhập tay', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    for (const key of ['marketPurchase', 'supplierPurchase']) {
      const received = await api('POST', `/market-purchases/${ids[key]}/receive`, token('kitchen'));
      assert.equal(received.status, 200, JSON.stringify(received.body));
      const items = received.body.items as Array<{ lot: { id: string; code: string; status: string } | null }>;
      assert.equal(items[0]?.lot?.status, 'pending');
      ids[key === 'marketPurchase' ? 'porkLot' : 'riceLot'] = items[0]?.lot?.id ?? '';
    }
    const riceLot = await api('GET', `/food-lots/${ids.riceLot}`, token('nurse'));
    assert.equal(riceLot.status, 200, JSON.stringify(riceLot.body));
    assert.equal(riceLot.body.food_category, 'dry');
    assert.equal(riceLot.body.received_date, schoolDay);
    assert.equal(riceLot.body.quantity, 10);
    const patched = await api('PATCH', `/food-lots/${ids.riceLot}`, token('kitchen'), {
      lot_number: 'LOT-MAU-01',
      manufacturer: 'Cơ sở sản xuất mẫu',
      expiry_date: addDays(schoolDay, 180),
      storage_condition: 'ambient',
      document_number: 'HD-0001',
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal((await api('PATCH', `/food-lots/${ids.riceLot}`, token('kitchen'), { quantity: 9 })).status, 422);
    const manual = await api('POST', '/food-lots', token('kitchen'), {
      org_unit_id: unitA,
      ingredient_id: ids.pork,
      supplier_id: ids.supplier,
      received_date: schoolDay,
      received_time: '06:15',
      quantity: 3,
      expiry_date: addDays(schoolDay, -1),
    });
    assert.equal(manual.status, 400);
    assert.equal(errorOf(manual.body).details?.[0]?.field, 'expiry_date');

    // Bước 1 do nhân viên y tế lập; kế toán không có quyền kiểm thực
    const header = { org_unit_id: unitA, inspection_date: schoolDay, step: 1, inspector_name: 'Người kiểm tra mẫu' };
    assert.equal((await api('POST', '/food-inspections', token('accountant'), header)).status, 403);
    const sheet = await api('POST', '/food-inspections', token('nurse'), {
      ...header,
      inspector_title: 'Nhân viên y tế',
      inspected_time: '06:30',
    });
    assert.equal(sheet.status, 201, JSON.stringify(sheet.body));
    ids.step1 = sheet.body.id as string;
    const lines = sheet.body.lines as Array<{ lot_id: string }>;
    assert.deepEqual(lines.map((line) => line.lot_id).sort(), [ids.porkLot, ids.riceLot].sort());
    assert.equal((await api('POST', '/food-inspections', token('nurse'), header)).status, 422);

    const saved = await api('PUT', `/food-inspections/${ids.step1}`, token('nurse'), {
      lines: [
        { lot_id: ids.riceLot, sensory_result: 'pass' },
        { lot_id: ids.porkLot, sensory_result: 'fail', rapid_test_result: 'fail' },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const missingAction = await api('POST', `/food-inspections/${ids.step1}/confirm`, token('nurse'));
    assert.equal(missingAction.status, 422);
    assert.equal(errorOf(missingAction.body).rule_code, 'BR-144');
    await api('PUT', `/food-inspections/${ids.step1}`, token('nurse'), {
      lines: [
        { lot_id: ids.riceLot, sensory_result: 'pass' },
        {
          lot_id: ids.porkLot,
          sensory_result: 'fail',
          rapid_test_result: 'fail',
          rejection_action: 'returned',
          action: 'Thịt có mùi lạ, trả lại người giao hàng',
        },
      ],
    });
    const confirmed = await api('POST', `/food-inspections/${ids.step1}/confirm`, token('nurse'));
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'confirmed');
    const lots = await api('GET', `/food-lots?org_unit_id=${unitA}`, token('kitchen'));
    const byId = new Map(
      (lots.body as unknown as Array<{ id: string; status: string; rejection_action: string }>).map((row) => [
        row.id,
        row,
      ]),
    );
    assert.equal(byId.get(ids.riceLot ?? '')?.status, 'accepted');
    assert.equal(byId.get(ids.porkLot ?? '')?.status, 'rejected');
    assert.equal(byId.get(ids.porkLot ?? '')?.rejection_action, 'returned');
    assert.equal((await api('PUT', `/food-inspections/${ids.step1}`, token('nurse'), { note: 'Sửa' })).status, 422);
    // Lô đã kiểm tra chỉ sửa chứng từ, ghi chú
    assert.equal(
      (await api('PATCH', `/food-lots/${ids.riceLot}`, token('kitchen'), { expiry_date: addDays(schoolDay, 10) }))
        .status,
      422,
    );
    assert.equal(
      (await api('PATCH', `/food-lots/${ids.riceLot}`, token('kitchen'), { note: 'Đã đối chiếu hóa đơn' })).status,
      200,
    );
  });

  it('CT-22b-5: bước 2 gợi ý món, số suất, lô theo nguyên liệu; lô không đạt bị chặn; bước 3; truy xuất; sổ in', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const header = { org_unit_id: unitA, inspection_date: schoolDay, inspector_name: 'Người kiểm tra mẫu' };
    const step2 = await api('POST', '/food-inspections', token('kitchen'), { ...header, step: 2 });
    assert.equal(step2.status, 201, JSON.stringify(step2.body));
    ids.step2 = step2.body.id as string;
    const [line] = step2.body.lines as Array<{
      dish_id: string;
      dish_name: string;
      meal_type: string;
      servings: number;
      main_ingredients: string;
      lots: Array<{ id: string }>;
    }>;
    assert.equal(line?.dish_id, ids.dish);
    assert.equal(line?.meal_type, 'lunch');
    assert.equal(line?.servings, 32);
    assert.match(line?.main_ingredients ?? '', /Gạo tẻ 1,6 kg/);
    assert.deepEqual(
      line?.lots.map((lot) => lot.id),
      [ids.riceLot],
    );

    const base = {
      meal_type: 'lunch',
      dish_id: ids.dish,
      dish_name: 'Cơm thịt kho',
      servings: 32,
      first_time: '08:00',
      second_time: '10:15',
      sensory_result: 'pass',
    };
    const withRejected = await api('PUT', `/food-inspections/${ids.step2}`, token('kitchen'), {
      lines: [{ ...base, lot_ids: [ids.riceLot, ids.porkLot] }],
    });
    assert.equal(withRejected.status, 400);
    assert.match(JSON.stringify(withRejected.body), /chưa đạt kiểm tra/);
    await api('PUT', `/food-inspections/${ids.step2}`, token('kitchen'), {
      lines: [{ ...base, lot_ids: [ids.riceLot] }],
    });
    assert.equal((await api('POST', `/food-inspections/${ids.step2}/confirm`, token('kitchen'))).status, 422);
    await api('PUT', `/food-inspections/${ids.step2}`, token('kitchen'), {
      lines: [
        {
          ...base,
          hygiene_people: 'pass',
          hygiene_equipment: 'pass',
          hygiene_area: 'pass',
          lot_ids: [ids.riceLot],
        },
      ],
    });
    assert.equal((await api('POST', `/food-inspections/${ids.step2}/confirm`, token('kitchen'))).status, 200);

    const step3 = await api('POST', '/food-inspections', token('manager'), { ...header, step: 3 });
    assert.equal(step3.status, 201, JSON.stringify(step3.body));
    const step3Lines = step3.body.lines as Array<Record<string, unknown>>;
    assert.equal(step3Lines.length, 1);
    const withLots = await api('PUT', `/food-inspections/${step3.body.id}`, token('manager'), {
      lines: [{ ...base, lot_ids: [ids.riceLot] }],
    });
    assert.equal(withLots.status, 400);
    await api('PUT', `/food-inspections/${step3.body.id}`, token('manager'), {
      lines: [{ ...base, first_time: '10:40', second_time: '10:50', utensils: 'Khay inox có nắp đậy' }],
    });
    assert.equal((await api('POST', `/food-inspections/${step3.body.id}/confirm`, token('manager'))).status, 200);

    const day = await api('GET', `/food-inspections/day?org_unit_id=${unitA}&date=${schoolDay}`, token('otherKitchen'));
    assert.equal(day.status, 403);
    const list = await api('GET', `/food-inspections?org_unit_id=${unitA}`, token('kitchen'));
    assert.deepEqual(
      (list.body as unknown as Array<{ step: number; fail_count: number }>).map((row) => [row.step, row.fail_count]),
      [
        [1, 1],
        [2, 0],
        [3, 0],
      ],
    );

    const trace = await api('GET', `/food-safety/trace?org_unit_id=${unitA}&date=${schoolDay}`, token('manager'));
    assert.equal(trace.status, 200, JSON.stringify(trace.body));
    const [traced] = trace.body.dishes as Array<{
      dish_name: string;
      lots_source: string;
      step3: { sensory_result: string } | null;
      lots: Array<{
        id: string;
        supplier_name: string;
        first_step: { sensory_result: string } | null;
        certificates: Array<{ number: string; validity_on_date: string }>;
      }>;
    }>;
    assert.equal(traced?.dish_name, 'Cơm thịt kho');
    assert.equal(traced?.lots_source, 'recorded');
    assert.equal(traced?.step3?.sensory_result, 'pass');
    assert.equal(traced?.lots[0]?.id, ids.riceLot);
    assert.equal(traced?.lots[0]?.supplier_name, 'Hợp tác xã thực phẩm mẫu');
    assert.equal(traced?.lots[0]?.first_step?.sensory_result, 'pass');
    assert.equal(traced?.lots[0]?.certificates[0]?.number, 'ATTP-001/MAU');
    const lot = await api('GET', `/food-lots/${ids.riceLot}`, token('kitchen'));
    assert.deepEqual(
      (lot.body.usage as Array<{ dish_name: string }>).map((row) => row.dish_name),
      ['Cơm thịt kho'],
    );

    for (const [book, format, type] of [
      ['inspections', 'pdf', 'application/pdf'],
      ['inspections', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ] as const) {
      const response = await fetch(`${environment.baseUrl}/food-safety/books`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token('manager')}`, 'content-type': 'application/json' },
        body: JSON.stringify({ org_unit_id: unitA, from: schoolDay, to: schoolDay, book, format }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type')?.split(';')[0], type);
    }
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'food-safety-inspections')
      .execute();
    assert.equal(logs.length, 2);

    // Lô đã đạt dùng hết thì đóng; hủy lô phải ghi lý do
    assert.equal(
      (await api('POST', `/food-lots/${ids.riceLot}/close`, token('kitchen'), { status: 'disposed' })).status,
      400,
    );
    const closed = await api('POST', `/food-lots/${ids.riceLot}/close`, token('kitchen'), { status: 'used_up' });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.status, 'used_up');
  });

  it('CT-22b-6: lưu mẫu đủ lượng, nhiệt độ; hủy sau 24 giờ, người hủy; giữ mẫu khi có phản ánh; sổ lưu mẫu, nhãn mẫu', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const suggestions = await api(
      'GET',
      `/food-samples/suggestions?org_unit_id=${unitA}&date=${schoolDay}`,
      token('nurse'),
    );
    assert.equal(suggestions.status, 200, JSON.stringify(suggestions.body));
    assert.deepEqual(
      (
        suggestions.body as unknown as Array<{
          dish_name: string;
          servings: number;
          required: boolean;
          sampled: boolean;
        }>
      ).map((row) => [row.dish_name, row.servings, row.required, row.sampled]),
      [['Cơm thịt kho', 32, true, false]],
    );
    const sample = {
      org_unit_id: unitA,
      sample_date: schoolDay,
      meal_type: 'lunch',
      dish_id: ids.dish,
      dish_name: 'Cơm thịt kho',
      servings: 32,
      food_form: 'solid',
      quantity: 120,
      container: 'Hộp inox có nắp',
      storage_temperature: 4,
      sampled_at: new Date(Date.now() - 25 * HOUR).toISOString(),
    };
    assert.equal((await api('POST', '/food-samples', token('accountant'), sample)).status, 403);
    const tooSmall = await api('POST', '/food-samples', token('nurse'), {
      ...sample,
      quantity: 80,
      storage_temperature: 10,
    });
    assert.equal(tooSmall.status, 400);
    assert.deepEqual(
      errorOf(tooSmall.body).details?.map((error) => error.field),
      ['quantity', 'storage_temperature'],
    );
    const old = await api('POST', '/food-samples', token('nurse'), sample);
    assert.equal(old.status, 201, JSON.stringify(old.body));
    assert.equal(old.body.destroy_state, 'due');
    assert.ok(old.body.sampled_by_name);
    const soup = await api('POST', '/food-samples', token('kitchen'), {
      ...sample,
      dish_id: null,
      dish_name: 'Canh rau',
      food_form: 'liquid',
      quantity: 150,
      sampled_at: new Date(Date.now() - HOUR).toISOString(),
    });
    assert.equal(soup.status, 201, JSON.stringify(soup.body));
    assert.equal(soup.body.destroy_state, 'retaining');

    const early = await api('POST', '/food-samples/destroy', token('nurse'), { ids: [soup.body.id] });
    assert.equal(early.status, 422);
    assert.equal(errorOf(early.body).rule_code, 'BR-143');
    const work = await api('GET', '/my-work?source=food_safety', token('nurse'));
    assert.ok((work.body.items as Array<{ kind: string }>).some((item) => item.kind === 'Mẫu thức ăn lưu chờ hủy'));

    const held = await api('POST', `/food-samples/${old.body.id}/hold`, token('nurse'), {
      hold_reason: 'Phụ huynh phản ánh trẻ đau bụng, giữ mẫu chờ kiểm nghiệm',
    });
    assert.equal(held.status, 200, JSON.stringify(held.body));
    assert.equal(held.body.status, 'held');
    assert.equal((await api('POST', '/food-samples/destroy', token('nurse'), { ids: [old.body.id] })).status, 422);
    assert.equal((await api('POST', `/food-samples/${old.body.id}/release`, token('nurse'))).status, 200);
    const destroyed = await api('POST', '/food-samples/destroy', token('kitchen'), {
      ids: [old.body.id],
      quality_note: 'Mẫu bình thường',
    });
    assert.equal(destroyed.status, 200, JSON.stringify(destroyed.body));
    const [row] = destroyed.body as unknown as Array<{
      status: string;
      destroyed_by_name: string;
      quality_note: string;
    }>;
    assert.equal(row?.status, 'destroyed');
    assert.ok(row?.destroyed_by_name);
    assert.equal(row?.quality_note, 'Mẫu bình thường');

    const list = await api('GET', `/food-samples?org_unit_id=${unitA}&status=stored`, token('manager'));
    assert.deepEqual(
      (list.body as unknown as Array<{ dish_name: string }>).map((item) => item.dish_name),
      ['Canh rau'],
    );
    for (const [book, format] of [
      ['samples', 'pdf'],
      ['samples', 'xlsx'],
      ['labels', 'pdf'],
    ] as const) {
      const response = await fetch(`${environment.baseUrl}/food-safety/books`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token('nurse')}`, 'content-type': 'application/json' },
        body: JSON.stringify({ org_unit_id: unitA, from: schoolDay, to: schoolDay, book, format }),
      });
      assert.equal(response.status, 200, `${book} ${format}`);
    }
    const labelsXlsx = await api('POST', '/food-safety/books', token('nurse'), {
      org_unit_id: unitA,
      from: schoolDay,
      to: schoolDay,
      book: 'labels',
      format: 'xlsx',
    });
    assert.equal(labelsXlsx.status, 400);
  });
});

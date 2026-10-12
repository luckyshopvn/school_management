import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Bếp, thực đơn, định lượng, suất ăn, báo cơm, buffet, phiếu đi chợ, báo cáo ăn và bếp (DT-10 phần 10c, YCTD-76);
// kịch bản CT-064, CT-065, CT-119, CT-081
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
// Ngày học gần nhất không sau hôm nay (thứ hai đến thứ sáu)
let schoolDay = vietnamToday;
while (weekdayOf(schoolDay) > 5) {
  schoolDay = addDays(schoolDay, -1);
}
const weekStart = addDays(schoolDay, 1 - weekdayOf(schoolDay));
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Bếp, thực đơn và báo cáo ăn', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const ids: Record<string, string> = {};
  const childIds: string[] = [];
  let classId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    users.manager = await environment.loginAs('VT-03', unitA);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.parentA = await environment.loginAs('VT-14', unitA);
    users.parentB = await environment.loginAs('VT-14', unitA);

    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: academicYearId,
          code: 'MAM-1',
          name: 'Mầm 1',
          grade_level: 'MAM',
          max_size: 35,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: users.homeroom?.userId ?? '',
        staff_name: 'Chủ nhiệm',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
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
      childIds.push(child.id);
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ trẻ 01', phone: '0901234567', user_id: users.parentA?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childIds[0] ?? '', guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P12-01, P12-04, P12-08: bếp lập nguyên liệu, món kèm định lượng, nhà cung cấp; ngoài đơn vị hoặc không phải bếp bị chặn', async () => {
    const unitA = units['ĐT-A1'];
    for (const [key, code, name, unit] of [
      ['rice', 'GAO', 'Gạo tẻ', 'kg'],
      ['pork', 'THIT', 'Thịt lợn', 'kg'],
      ['milk', 'SUA', 'Sữa tươi', 'lít'],
    ] as const) {
      const created = await api('POST', '/ingredients', token('kitchen'), { org_unit_id: unitA, code, name, unit });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      ids[key] = created.body.id as string;
    }
    const duplicate = await api('POST', '/ingredients', token('kitchen'), {
      org_unit_id: unitA,
      code: 'GAO',
      name: 'Gạo',
      unit: 'kg',
    });
    assert.equal(duplicate.status, 409);
    assert.equal(
      (
        await api('POST', '/ingredients', token('otherKitchen'), {
          org_unit_id: unitA,
          code: 'X',
          name: 'X',
          unit: 'kg',
        })
      ).status,
      403,
    );
    assert.equal(
      (await api('POST', '/ingredients', token('homeroom'), { org_unit_id: unitA, code: 'Y', name: 'Y', unit: 'kg' }))
        .status,
      403,
    );
    const otherUnitIngredient = await api('POST', '/ingredients', token('otherKitchen'), {
      org_unit_id: units['ĐT-B1'],
      code: 'GAO',
      name: 'Gạo B',
      unit: 'kg',
    });
    assert.equal(otherUnitIngredient.status, 201);

    for (const [key, name, group, norms] of [
      ['porridge', 'Cháo thịt', 'Tinh bột', [{ ingredient_id: ids.rice, quantity_per_serving: 0.03 }]],
      [
        'riceMeal',
        'Cơm thịt kho',
        'Đạm',
        [
          { ingredient_id: ids.rice, quantity_per_serving: 0.05 },
          { ingredient_id: ids.pork, quantity_per_serving: 0.04 },
        ],
      ],
      ['milkSnack', 'Sữa tươi', 'Sữa', [{ ingredient_id: ids.milk, quantity_per_serving: 0.18 }]],
    ] as const) {
      const created = await api('POST', '/dishes', token('kitchen'), {
        org_unit_id: unitA,
        name,
        group_name: group,
        norms,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      ids[key] = created.body.id as string;
    }
    const foreignNorm = await api('PUT', `/dishes/${ids.porridge}/norms`, token('kitchen'), {
      norms: [{ ingredient_id: otherUnitIngredient.body.id, quantity_per_serving: 0.02 }],
    });
    assert.equal(foreignNorm.status, 422);
    assert.equal(errorOf(foreignNorm.body).rule_code, 'BR-60');
    const dishes = await api('GET', `/dishes?org_unit_id=${unitA}`, token('manager'));
    assert.equal(dishes.status, 200);
    const riceMeal = (dishes.body as unknown as Array<{ id: string; norms: unknown[] }>).find(
      (dish) => dish.id === ids.riceMeal,
    );
    assert.equal(riceMeal?.norms.length, 2);

    const supplier = await api('POST', '/food-suppliers', token('kitchen'), {
      org_unit_id: unitA,
      name: 'Hợp tác xã rau sạch',
      food_groups: 'Gạo, thịt, sữa',
      phone: '0912345678',
    });
    assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
    ids.supplier = supplier.body.id as string;
  });

  it('P12-02, P12-03, CT-065: thực đơn chưa duyệt không hiện cho phụ huynh; quản lý đơn vị duyệt thì công bố', async () => {
    const weekday = weekdayOf(schoolDay);
    const notMonday = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: units['ĐT-A1'],
      week_start_date: addDays(weekStart, 1),
    });
    assert.equal(notMonday.status, 400);
    const created = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: units['ĐT-A1'],
      week_start_date: weekStart,
      items: [
        { weekday, meal_type: 'breakfast', dish_id: ids.porridge },
        { weekday, meal_type: 'lunch', dish_id: ids.riceMeal },
        { weekday, meal_type: 'snack', dish_id: ids.milkSnack },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.menu = created.body.id as string;
    assert.equal(created.body.status, 'draft');

    const childMenu = () => api('GET', `/children/${childIds[0]}/menus?week_start_date=${weekStart}`, token('parentA'));
    let seen = await childMenu();
    assert.equal(seen.status, 200, JSON.stringify(seen.body));
    assert.equal(seen.body.menu, null);
    assert.equal(
      (await api('GET', `/children/${childIds[1]}/menus?week_start_date=${weekStart}`, token('parentB'))).status,
      403,
    );

    assert.equal((await api('POST', `/menus/${ids.menu}/approve`, token('manager'))).status, 422);
    assert.equal((await api('POST', `/menus/${ids.menu}/submit`, token('kitchen'))).status, 200);
    seen = await childMenu();
    assert.equal(seen.body.menu, null);
    const editSubmitted = await api('PUT', `/menus/${ids.menu}/items`, token('kitchen'), { items: [] });
    assert.equal(editSubmitted.status, 422);
    assert.equal((await api('POST', `/menus/${ids.menu}/approve`, token('kitchen'))).status, 403);
    const approved = await api('POST', `/menus/${ids.menu}/approve`, token('manager'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'published');

    seen = await childMenu();
    const menu = seen.body.menu as { status: string; items: Array<{ dish_name: string; meal_type: string }> };
    assert.equal(menu.status, 'published');
    assert.deepEqual(menu.items.map((item) => item.dish_name).sort(), ['Cháo thịt', 'Cơm thịt kho', 'Sữa tươi']);
    const notifications = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.role_code'])
      .where('notifications.target_id', '=', ids.menu ?? '')
      .where('notifications.template_code', '=', 'menu_published')
      .execute();
    assert.ok(notifications.some((row) => row.role_code === 'VT-14'));

    // Thực đơn tuần sau bị trả lại thì về nháp kèm lý do
    const nextWeek = await api('POST', '/menus', token('kitchen'), {
      org_unit_id: units['ĐT-A1'],
      week_start_date: addDays(weekStart, 7),
      items: [{ weekday: 1, meal_type: 'lunch', dish_id: ids.riceMeal }],
    });
    assert.equal(nextWeek.status, 201);
    await api('POST', `/menus/${nextWeek.body.id}/submit`, token('kitchen'));
    const rejected = await api('POST', `/menus/${nextWeek.body.id}/reject`, token('manager'), {
      reason: 'Thiếu rau xanh',
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'draft');
    assert.equal(rejected.body.reject_reason, 'Thiếu rau xanh');
    const nextWeekSeen = await api(
      'GET',
      `/children/${childIds[0]}/menus?week_start_date=${addDays(weekStart, 7)}`,
      token('parentA'),
    );
    assert.equal(nextWeekSeen.body.menu, null);
  });

  it('P12-07, CT-064: báo cơm khi chưa chốt điểm danh; chốt điểm danh 30 có mặt 2 nghỉ thì mỗi bữa 30 suất', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const now = new Date();
    await schoolYear
      .insertInto('attendance_records')
      .values(
        childIds.map((childId, index) => ({
          child_id: childId,
          class_id: classId,
          org_unit_id: unitA,
          attendance_date: schoolDay,
          status: index < 28 ? ('present' as const) : index < 30 ? ('late' as const) : ('absent_notified' as const),
          note: null,
          source: 'teacher' as const,
          recorded_by: users.homeroom?.userId ?? '',
          recorded_at: now,
        })),
      )
      .execute();

    assert.equal(
      (await api('POST', `/classes/${classId}/meal-report`, token('otherTeacher'), { date: schoolDay, headcount: 30 }))
        .status,
      403,
    );
    const tooMany = await api('POST', `/classes/${classId}/meal-report`, token('homeroom'), {
      date: schoolDay,
      headcount: 33,
    });
    assert.equal(tooMany.status, 422);
    const reported = await api('POST', `/classes/${classId}/meal-report`, token('homeroom'), {
      date: schoolDay,
      headcount: 31,
    });
    assert.equal(reported.status, 200, JSON.stringify(reported.body));
    const reportView = await api('GET', `/classes/${classId}/meal-report?date=${schoolDay}`, token('homeroom'));
    assert.equal(reportView.body.attendance_meal_count, 30);
    assert.equal(reportView.body.source, 'meal_report');

    let plan = await api('GET', `/meal-plans?org_unit_id=${unitA}&date=${schoolDay}`, token('kitchen'));
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.equal(plan.body.headcount, 31);
    assert.equal(plan.body.status, 'provisional');
    // Lưu số tạm tính trước khi chốt để đối chiếu ở CT-081
    const provisional = await api('POST', '/meal-plans/compute', token('kitchen'), {
      org_unit_id: unitA,
      date: schoolDay,
    });
    assert.equal(provisional.status, 200, JSON.stringify(provisional.body));

    await schoolYear
      .insertInto('attendance_days')
      .values({
        class_id: classId,
        attendance_date: schoolDay,
        status: 'locked',
        locked_by: users.homeroom?.userId ?? '',
        locked_at: now,
        unlocked_by: null,
        unlocked_at: null,
        unlock_reason: null,
      })
      .execute();
    const afterLock = await api('POST', `/classes/${classId}/meal-report`, token('homeroom'), {
      date: schoolDay,
      headcount: 31,
    });
    assert.equal(afterLock.status, 422);
    assert.equal(errorOf(afterLock.body).rule_code, 'BR-58');

    plan = await api('GET', `/meal-plans?org_unit_id=${unitA}&date=${schoolDay}`, token('kitchen'));
    assert.equal(plan.body.status, 'final');
    assert.deepEqual(plan.body.meals, [
      { meal_type: 'breakfast', headcount: 30 },
      { meal_type: 'lunch', headcount: 30 },
      { meal_type: 'snack', headcount: 30 },
    ]);
    const classes = plan.body.classes as Array<{ source: string; enrolled_count: number }>;
    assert.equal(classes[0]?.source, 'attendance_locked');
    assert.equal(classes[0]?.enrolled_count, 32);
  });

  it('P12-04: định lượng nguyên liệu của thực đơn theo số suất của ngày', async () => {
    const norms = await api('GET', `/menus/${ids.menu}/norms?date=${schoolDay}`, token('kitchen'));
    assert.equal(norms.status, 200, JSON.stringify(norms.body));
    assert.equal(norms.body.servings, 30);
    const totals = norms.body.totals as Array<{ ingredient_id: string; quantity: number }>;
    // Gạo: cháo 0,03 + cơm 0,05 trên một suất, 30 suất
    assert.equal(totals.find((row) => row.ingredient_id === ids.rice)?.quantity, 2.4);
    assert.equal(totals.find((row) => row.ingredient_id === ids.milk)?.quantity, 5.4);
    const custom = await api('GET', `/menus/${ids.menu}/norms?date=${schoolDay}&servings=10`, token('kitchen'));
    assert.equal(
      (custom.body.totals as Array<{ ingredient_id: string; quantity: number }>).find(
        (row) => row.ingredient_id === ids.pork,
      )?.quantity,
      0.4,
    );
  });

  it('P12-09, CT-119: xác nhận nhập phiếu đi chợ thì tồn nguyên liệu tăng và có đề nghị thanh toán', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const created = await api('POST', '/market-purchases', token('kitchen'), {
      org_unit_id: unitA,
      purchase_date: schoolDay,
      supplier_id: ids.supplier,
      items: [
        { ingredient_id: ids.rice, quantity: 2.5, unit_price: 20_000 },
        { ingredient_id: ids.pork, quantity: 1.2, unit_price: 150_000 },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.code as string, /^PDC-\d{6}$/);
    assert.equal(created.body.total_amount, 230_000);
    const lines = created.body.items as Array<{ ingredient_id: string; planned_quantity: number; difference: number }>;
    const riceLine = lines.find((line) => line.ingredient_id === ids.rice);
    assert.equal(riceLine?.planned_quantity, 2.4);
    assert.equal(riceLine?.difference, 0.1);
    const purchaseId = created.body.id as string;

    assert.equal((await api('POST', `/market-purchases/${purchaseId}/receive`, token('manager'))).status, 403);
    const received = await api('POST', `/market-purchases/${purchaseId}/receive`, token('kitchen'));
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.status, 'received');
    assert.equal(received.body.payment_status, 'awaiting_payment');
    const stock = await schoolYear
      .selectFrom('ingredients')
      .select(['id', 'current_stock'])
      .where('id', 'in', [ids.rice ?? '', ids.pork ?? ''])
      .execute();
    assert.equal(Number(stock.find((row) => row.id === ids.rice)?.current_stock), 2.5);
    assert.equal(Number(stock.find((row) => row.id === ids.pork)?.current_stock), 1.2);
    const request = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notification_recipients.role_code')
      .where('notifications.target_id', '=', purchaseId)
      .where('notifications.template_code', '=', 'market_purchase_payment_request')
      .execute();
    assert.deepEqual(
      request.map((row) => row.role_code),
      ['VT-04'],
    );
    assert.equal((await api('POST', `/market-purchases/${purchaseId}/receive`, token('kitchen'))).status, 422);
    const awaiting = await api(
      'GET',
      `/market-purchases?org_unit_id=${unitA}&payment_status=awaiting_payment`,
      token('accountant'),
    );
    assert.equal(awaiting.status, 200);
    assert.equal((awaiting.body as unknown as unknown[]).length, 1);

    // Kế toán lập phiếu chi theo QT-05 rồi gắn vào phiếu đi chợ; phiếu chi giả lập đã phát hành
    const account = await schoolYear
      .insertInto('cash_accounts')
      .values({
        org_unit_id: unitA,
        account_type: 'cash',
        name: 'Quỹ tiền mặt',
        opening_balance: 0,
        current_balance: 0,
        created_by: users.accountant?.userId ?? '',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const category = await schoolYear
      .insertInto('cashflow_categories')
      .values({ code: 'CHI-BEP', name: 'Chi tiền chợ', group_name: 'Bếp', flow_type: 'expense' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const payment = (amount: number) =>
      schoolYear
        .insertInto('payments')
        .values({
          code: `PC-${String(amount).slice(0, 6)}`,
          org_unit_id: unitA,
          payment_type: 'regular',
          payee_name: 'Hợp tác xã rau sạch',
          amount,
          content: 'Thanh toán phiếu đi chợ',
          account_id: account.id,
          category_id: category.id,
          payment_date: schoolDay,
          status: 'issued',
          request_key: randomUUID(),
          created_by: users.accountant?.userId ?? '',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    const wrongAmount = await payment(200_000);
    const wrong = await api('POST', `/market-purchases/${purchaseId}/link-payment`, token('accountant'), {
      payment_id: wrongAmount.id,
    });
    assert.equal(wrong.status, 422);
    const rightAmount = await payment(230_000);
    assert.equal(
      (
        await api('POST', `/market-purchases/${purchaseId}/link-payment`, token('kitchen'), {
          payment_id: rightAmount.id,
        })
      ).status,
      403,
    );
    const linked = await api('POST', `/market-purchases/${purchaseId}/link-payment`, token('accountant'), {
      payment_id: rightAmount.id,
    });
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.equal(linked.body.payment_status, 'paid');
  });

  it('P17-08, CT-081: số suất của ngày khớp điểm danh đã chốt sau khi tính lại; có tổng chi phí đi chợ của kỳ', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const path = `/reports/meals?org_unit_id=${unitA}&from=${addDays(schoolDay, -6)}&to=${schoolDay}`;
    let report = await api('GET', path, token('accountant'));
    assert.equal(report.status, 200, JSON.stringify(report.body));
    let day = (report.body.days as Array<Record<string, unknown>>).find((row) => row.date === schoolDay);
    // Số đã lưu khi chưa chốt (31) lệch điểm danh đã chốt (30)
    assert.equal(day?.meal_headcount, 31);
    assert.equal(day?.attendance_meal_count, 30);
    assert.equal(day?.matched, false);
    assert.deepEqual(report.body.mismatched_days, [schoolDay]);

    const recomputed = await api('POST', '/meal-plans/compute', token('kitchen'), {
      org_unit_id: unitA,
      date: schoolDay,
    });
    assert.equal(recomputed.status, 200);
    report = await api('GET', path, token('kitchen'));
    day = (report.body.days as Array<Record<string, unknown>>).find((row) => row.date === schoolDay);
    assert.equal(day?.meal_headcount, 30);
    assert.equal(day?.attendance_meal_count, 30);
    assert.equal(day?.absent_count, 2);
    assert.equal(day?.meal_plan_status, 'final');
    assert.equal(day?.matched, true);
    const purchases = report.body.purchases as { total_amount: number; paid_amount: number; count: number };
    assert.equal(purchases.total_amount, 230_000);
    assert.equal(purchases.paid_amount, 230_000);
    assert.equal(purchases.count, 1);

    assert.equal((await api('GET', path, token('manager'))).status, 403);
    assert.equal((await api('GET', path, token('otherKitchen'))).status, 403);
  });

  it('P12-06: buffet theo dịp do bếp lập, quản lý đơn vị duyệt thì phụ huynh thấy trong tuần', async () => {
    const buffetDate = addDays(vietnamToday, 1);
    const created = await api('POST', '/buffet-events', token('kitchen'), {
      org_unit_id: units['ĐT-A1'],
      buffet_date: buffetDate,
      occasion: 'Trung thu',
      menu_note: 'Bánh trung thu, trái cây',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const week = addDays(buffetDate, 1 - weekdayOf(buffetDate));
    const view = () => api('GET', `/children/${childIds[0]}/menus?week_start_date=${week}`, token('parentA'));
    assert.equal(((await view()).body.buffets as unknown[]).length, 0);
    assert.equal((await api('POST', `/buffet-events/${created.body.id}/approve`, token('kitchen'))).status, 403);
    assert.equal((await api('POST', `/buffet-events/${created.body.id}/approve`, token('manager'))).status, 200);
    const buffets = (await view()).body.buffets as Array<{ occasion: string }>;
    assert.deepEqual(
      buffets.map((row) => row.occasion),
      ['Trung thu'],
    );
  });
});

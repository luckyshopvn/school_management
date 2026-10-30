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
import { prorate, remainingDaysOfMonth, vietnamMonthOf } from './ai-tutor-rules.js';
import { aiTutorCharges, recordAiTutorCharges } from './school-sales-fees.js';

// Gia sư AI do trường bán (YCTD-383 lát L1a), kịch bản CT-1757 đến CT-1764: cài đặt theo cấp học và khung giờ, gói tháng và gói lượt,
// phụ huynh mua (đồng ý), chặn mua trùng, hủy trước khi lên hóa đơn, nâng gói theo ngày còn lại, dòng thu trên hóa đơn học phí không
// thu trùng và không ghi đè hóa đơn đã phát hành, phân quyền từng vai trò. Dữ liệu bịa, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Json = Record<string, unknown>;

describe('Gia sư AI do trường bán', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let childId = '';
  let primaryChildId = '';
  const plans: Record<string, string> = {};
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const errorOf = (body: Json) => body.error as { code: string; rule_code?: string; details: Array<{ field: string }> };
  const currentMonth = vietnamMonthOf(new Date());
  const child = (path = '') => `/children/${childId}/ai-tutor${path}`;

  const addChild = async (classId: string, name: string, guardianId: string, relationshipId: string) => {
    const id = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2013-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: id, class_id: classId, from_date: addDays(vietnamToday, -60) })
      .execute();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: id, guardian_id: guardianId, relationship_item_id: relationshipId, is_primary: true })
      .execute();
    return id;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal, {
        code: 'THCS-383',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    accountant = await environment.loginAs('VT-04', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    const classOf = async (code: string, schoolLevel: 'TH' | 'THCS', gradeLevel: string) =>
      (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: gradeLevel,
            school_level: schoolLevel,
            max_size: 45,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: null, user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    childId = await addChild(await classOf('8A2', 'THCS', 'K8'), 'Học sinh An', guardian.id, relationship.id);
    primaryChildId = await addChild(await classOf('3A', 'TH', 'K3'), 'Học sinh Bình', guardian.id, relationship.id);
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-1757: cài đặt mặc định tắt, khung giờ 22:00 đến 6:00; sai giờ, trùng giờ, cấp lạ bị từ chối; kế toán, phụ huynh không vào được', async () => {
    const initial = await api('GET', '/ai-tutor/school', principal);
    assert.equal(initial.status, 200, JSON.stringify(initial.body));
    assert.deepEqual(initial.body.settings, {
      enabled_levels: [],
      quiet_start: '22:00',
      quiet_end: '06:00',
      updated_by_name: null,
      updated_at: null,
    });
    const wrong = await api('PUT', '/ai-tutor/school/settings', principal, {
      enabled_levels: ['MN'],
      quiet_start: '24:00',
      quiet_end: '6:00',
    });
    assert.equal(wrong.status, 400);
    assert.deepEqual(
      errorOf(wrong.body)
        .details.map((detail) => detail.field)
        .sort(),
      ['enabled_levels', 'quiet_end', 'quiet_start'],
    );
    const same = await api('PUT', '/ai-tutor/school/settings', principal, {
      enabled_levels: ['THCS'],
      quiet_start: '22:00',
      quiet_end: '22:00',
    });
    assert.equal(same.status, 400);
    const saved = await api('PUT', '/ai-tutor/school/settings', principal, {
      enabled_levels: ['THPT', 'THCS'],
      quiet_start: '21:30',
      quiet_end: '06:00',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.enabled_levels, ['THCS', 'THPT']);
    assert.equal(saved.body.quiet_start, '21:30');
    for (const user of [accountant, parent]) {
      assert.equal((await api('GET', '/ai-tutor/school', user)).status, 403);
      assert.equal((await api('PUT', '/ai-tutor/school/settings', user, saved.body)).status, 403);
      assert.equal((await api('POST', '/ai-tutor/school/plans', user, {})).status, 403);
    }
  });

  it('CT-1758: tạo gói tháng, gói lượt; gói lượt không cho gửi ảnh; giá âm, thiếu cấp, đổi loại bị từ chối; ngừng bán', async () => {
    const create = (body: Json) => api('POST', '/ai-tutor/school/plans', principal, body);
    const base = { kind: 'monthly', price: 79_000, turns: 100, allow_images: false, school_levels: ['THCS', 'THPT'] };
    for (const [name, body] of [
      ['Cơ bản', base],
      ['Nâng cao', { ...base, price: 149_000, turns: 300, allow_images: true }],
      ['Gói 50 lượt', { ...base, kind: 'top_up', price: 39_000, turns: 50 }],
      ['Thử hè', { ...base, price: 0, turns: 30 }],
    ] as const) {
      const created = await create({ ...body, name });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      plans[name] = created.body.id as string;
    }
    const invalid = await create({
      kind: 'top_up',
      name: 'Sai',
      price: -1,
      turns: 0,
      allow_images: true,
      school_levels: [],
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(
      errorOf(invalid.body)
        .details.map((detail) => detail.field)
        .sort(),
      ['allow_images', 'price', 'school_levels', 'turns'],
    );
    const tooLong = await create({ ...base, name: 'x'.repeat(81) });
    assert.equal(tooLong.status, 400);
    const kindChange = await api('PUT', `/ai-tutor/school/plans/${plans['Cơ bản']}`, principal, {
      ...base,
      kind: 'top_up',
      name: 'Cơ bản',
    });
    assert.equal(kindChange.status, 400);
    const archived = await api('PUT', `/ai-tutor/school/plans/${plans['Thử hè']}`, principal, {
      ...base,
      name: 'Thử hè 2026',
      price: 0,
      turns: 30,
      status: 'archived',
    });
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    assert.equal(archived.body.status, 'archived');
    assert.equal((await api('PUT', `/ai-tutor/school/plans/${randomUUID()}`, principal, base)).status, 404);
    const overview = await api('GET', '/ai-tutor/school', principal);
    assert.equal((overview.body.plans as Json[]).length, 4);
  });

  it('CT-1759: phụ huynh thấy gói đang bán cho cấp của con; con cấp chưa bật thì không mua được; phụ huynh khác bị từ chối', async () => {
    const view = await api('GET', child(), parent);
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.enabled, true);
    assert.equal(view.body.current_month, currentMonth);
    assert.deepEqual(
      (view.body.plans as Json[]).map((plan) => plan.name),
      ['Cơ bản', 'Nâng cao', 'Gói 50 lượt'],
    );
    const primary = await api('GET', `/children/${primaryChildId}/ai-tutor`, parent);
    assert.equal(primary.body.enabled, false);
    assert.deepEqual(primary.body.plans, []);
    const blocked = await api('POST', `/children/${primaryChildId}/ai-tutor/purchases`, parent, {
      plan_id: plans['Cơ bản'],
      period_month: currentMonth,
      consent: true,
    });
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'BR-461');
    assert.equal((await api('GET', child(), otherParent)).status, 403);
    assert.equal((await api('GET', child(), accountant)).status, 403);
    assert.equal(
      (await api('POST', child('/purchases'), otherParent, { plan_id: plans['Cơ bản'], consent: true })).status,
      403,
    );
  });

  it('CT-1760: mua gói tháng là đồng ý, kích hoạt ngay; mua trùng tháng, gói ngừng bán, tháng đã qua bị chặn; gói lượt mua được', async () => {
    const noConsent = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Cơ bản'],
      period_month: currentMonth,
    });
    assert.equal(noConsent.status, 400);
    assert.deepEqual(
      errorOf(noConsent.body).details.map((detail) => detail.field),
      ['consent'],
    );
    const bought = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Cơ bản'],
      period_month: currentMonth,
      consent: true,
    });
    assert.equal(bought.status, 201, JSON.stringify(bought.body));
    const [monthly] = bought.body.subscriptions as Json[];
    assert.equal(monthly?.status, 'active');
    assert.equal(monthly?.plan_source, 'school');
    assert.equal(monthly?.can_cancel, true);
    assert.deepEqual(bought.body.balance, { monthly: 100, top_up: 0 });
    const duplicate = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Nâng cao'],
      period_month: currentMonth,
      consent: true,
    });
    assert.equal(duplicate.status, 422);
    assert.equal(errorOf(duplicate.body).rule_code, 'BR-462');
    const archived = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Thử hè'],
      period_month: bought.body.next_month,
      consent: true,
    });
    assert.equal(archived.status, 422);
    const past = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Cơ bản'],
      period_month: '2020-01-01',
      consent: true,
    });
    assert.equal(past.status, 422);
    const badMonth = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Cơ bản'],
      period_month: '2026-10-15',
      consent: true,
    });
    assert.equal(badMonth.status, 400);
    const topUp = await api('POST', child('/purchases'), parent, { plan_id: plans['Gói 50 lượt'], consent: true });
    assert.equal(topUp.status, 201, JSON.stringify(topUp.body));
    assert.deepEqual(topUp.body.balance, { monthly: 100, top_up: 50 });
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('after_data')
      .where('entity_name', '=', 'ai_tutor_subscriptions')
      .execute();
    assert.equal(audit.length, 2);
  });

  it('CT-1761: nâng Cơ bản lên Nâng cao trả chênh lệch theo ngày còn lại, cộng lượt cùng tỉ lệ; hạ gói, cùng gói bị chặn', async () => {
    const view = await api('GET', child(), parent);
    const monthly = (view.body.subscriptions as Json[]).find((row) => row.plan_kind === 'monthly') as Json;
    const subscriptionId = monthly.id as string;
    const { remainingDays, daysInMonth } = remainingDaysOfMonth(currentMonth, new Date());
    const quote = await api(
      'GET',
      child(`/purchases/${subscriptionId}/upgrade-quote?plan_id=${plans['Nâng cao']}`),
      parent,
    );
    assert.equal(quote.status, 200, JSON.stringify(quote.body));
    assert.equal(quote.body.remaining_days, remainingDays);
    assert.equal(quote.body.price_difference, prorate(70_000, remainingDays, daysInMonth));
    assert.equal(quote.body.extra_turns, prorate(200, remainingDays, daysInMonth));
    const same = await api(
      'GET',
      child(`/purchases/${subscriptionId}/upgrade-quote?plan_id=${plans['Cơ bản']}`),
      parent,
    );
    assert.equal(same.status, 422);
    assert.equal(errorOf(same.body).rule_code, 'BR-464');
    assert.equal(
      (await api('POST', child(`/purchases/${subscriptionId}/upgrade`), otherParent, { plan_id: plans['Nâng cao'] }))
        .status,
      403,
    );
    const upgraded = await api('POST', child(`/purchases/${subscriptionId}/upgrade`), parent, {
      plan_id: plans['Nâng cao'],
    });
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));
    const after = (upgraded.body.subscriptions as Json[]).find((row) => row.id === subscriptionId) as Json;
    assert.equal(after.plan_name, 'Nâng cao');
    assert.equal(after.allow_images, true);
    assert.equal(after.turns, 100 + (quote.body.extra_turns as number));
    assert.equal(after.price, 79_000, 'giá mua ban đầu giữ nguyên');
    assert.equal((after.upgrades as Json[]).length, 1);
    const down = await api('POST', child(`/purchases/${subscriptionId}/upgrade`), parent, { plan_id: plans['Cơ bản'] });
    assert.equal(down.status, 422);
    const topUpId = ((upgraded.body.subscriptions as Json[]).find((row) => row.plan_kind === 'top_up') as Json)
      .id as string;
    const topUpUpgrade = await api('POST', child(`/purchases/${topUpId}/upgrade`), parent, {
      plan_id: plans['Nâng cao'],
    });
    assert.equal(topUpUpgrade.status, 422);
  });

  it('CT-1762: dòng thu Gia sư AI trên hóa đơn của kỳ: lần mua, phần chênh lệch; gói 0 đồng, lần mua đã hủy không thu', async () => {
    // Gói lượt thứ hai rồi hủy: không lên hóa đơn
    const second = await api('POST', child('/purchases'), parent, { plan_id: plans['Gói 50 lượt'], consent: true });
    const secondId = ((second.body.subscriptions as Json[])[0] as Json).id as string;
    const cancelled = await api('POST', child(`/purchases/${secondId}/cancel`), parent);
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(((cancelled.body.subscriptions as Json[])[0] as Json).status, 'cancelled');
    const again = await api('POST', child(`/purchases/${secondId}/cancel`), parent);
    assert.equal(again.status, 422);
    assert.equal(errorOf(again.body).rule_code, 'BR-463');

    const period = { year: Number(currentMonth.slice(0, 4)), month: Number(currentMonth.slice(5, 7)) };
    const charges = await aiTutorCharges(schoolYear, environment.system, [childId], period, null);
    const lines = (charges.get(childId) ?? []).map((charge) => charge.item);
    assert.equal(lines.length, 3);
    assert.ok(lines.every((line) => line.item_type === 'ai_tutor'));
    assert.deepEqual(lines.map((line) => line.amount).slice(0, 2), [79_000, 39_000]);
    assert.match(lines[0]?.description ?? '', /^Gia sư AI: Cơ bản tháng/);
    assert.match(lines[2]?.description ?? '', /^Gia sư AI: nâng Cơ bản lên Nâng cao/);
    const total = lines.reduce((sum, line) => sum + line.amount, 0);

    const invoiceId = (
      await schoolYear
        .insertInto('invoices')
        .values({
          child_id: childId,
          org_unit_id: unitId,
          period_year: period.year,
          period_month: period.month,
          invoice_kind: 'main',
          status: 'draft',
          total_amount: total,
          basis: JSON.stringify({}),
          review_flags: JSON.stringify([]),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear.transaction().execute(async (transaction) => {
      await recordAiTutorCharges(transaction, invoiceId, childId, charges.get(childId) ?? []);
    });
    const items = await schoolYear
      .selectFrom('invoice_items')
      .select(['item_type', 'amount'])
      .where('invoice_id', '=', invoiceId)
      .execute();
    assert.equal(items.length, 3);
    // Hóa đơn còn nháp của kỳ được tính lại nên vẫn lập đủ dòng; kỳ khác thì không thu lại
    assert.equal(
      (await aiTutorCharges(schoolYear, environment.system, [childId], period, null)).get(childId)?.length,
      3,
    );
    const nextPeriod =
      period.month === 12 ? { year: period.year + 1, month: 1 } : { ...period, month: period.month + 1 };
    assert.equal(
      (await aiTutorCharges(schoolYear, environment.system, [childId], nextPeriod, null)).get(childId),
      undefined,
    );
    await schoolYear
      .updateTable('invoices')
      .set({ status: 'issued', code: 'HD-383-1', issued_at: new Date(), due_date: addDays(vietnamToday, 30) })
      .where('id', '=', invoiceId)
      .execute();
    assert.equal(
      (await aiTutorCharges(schoolYear, environment.system, [childId], period, null)).get(childId),
      undefined,
      'đã lên hóa đơn phát hành thì không thu lại',
    );
    // Lần mua trước ngày bắt đầu năm học thuộc năm trước
    assert.equal(
      (await aiTutorCharges(schoolYear, environment.system, [childId], nextPeriod, addDays(vietnamToday, 1))).get(
        childId,
      ),
      undefined,
    );
  });

  it('CT-1763: đã lên hóa đơn thì không hủy được; đã dùng lượt thì không hủy được; mã lạ, phụ huynh khác bị từ chối', async () => {
    const view = await api('GET', child(), parent);
    const monthly = (view.body.subscriptions as Json[]).find((row) => row.plan_kind === 'monthly') as Json;
    assert.equal(monthly.invoiced, true);
    assert.equal(monthly.can_cancel, false);
    const invoiced = await api('POST', child(`/purchases/${monthly.id as string}/cancel`), parent);
    assert.equal(invoiced.status, 422);
    assert.equal(errorOf(invoiced.body).rule_code, 'BR-463');
    // Gói tháng sau rồi dùng một lượt
    const next = await api('POST', child('/purchases'), parent, {
      plan_id: plans['Cơ bản'],
      period_month: view.body.next_month,
      consent: true,
    });
    assert.equal(next.status, 201, JSON.stringify(next.body));
    const nextId = ((next.body.subscriptions as Json[])[0] as Json).id as string;
    await environment.system
      .updateTable('ai_tutor_subscriptions')
      .set({ used_turns: 1 })
      .where('id', '=', nextId)
      .execute();
    const used = await api('POST', child(`/purchases/${nextId}/cancel`), parent);
    assert.equal(used.status, 422);
    assert.match(errorOf(used.body).code, /ERR_RULE_VIOLATION/);
    assert.equal((await api('POST', child(`/purchases/${randomUUID()}/cancel`), parent)).status, 404);
    assert.equal((await api('POST', child(`/purchases/${nextId}/cancel`), otherParent)).status, 403);
  });

  it('CT-1764: quản trị xem các lần mua theo tháng, có tên học sinh, lần nâng và dấu đã lên hóa đơn', async () => {
    const list = await api('GET', `/ai-tutor/school/purchases?month=${currentMonth.slice(0, 7)}`, principal);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const purchases = list.body.purchases as Json[];
    assert.ok(purchases.length >= 3);
    assert.ok(purchases.every((row) => row.child_name === 'Học sinh An'));
    assert.ok(purchases.some((row) => row.invoiced === true));
    assert.equal((list.body.upgrades as Json[]).length, 1);
    assert.equal((await api('GET', '/ai-tutor/school/purchases?month=2026-13', principal)).status, 400);
    assert.equal((await api('GET', '/ai-tutor/school/purchases', accountant)).status, 403);
    const overview = await api('GET', '/ai-tutor/school', principal);
    const counts = new Map((overview.body.plans as Json[]).map((plan) => [plan.name, plan.active_count]));
    assert.equal(counts.get('Nâng cao'), 1);
  });
});

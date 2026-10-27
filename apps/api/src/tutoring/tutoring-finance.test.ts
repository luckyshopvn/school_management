import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  replaceDatabaseName,
  TUTORING_PAY_ITEM_CODE,
  type SchoolYearDatabase,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { recordTutoringCharges, tutoringItems } from './tutoring-fees.js';

// Thu phí và chi trả gia sư trong trường (DT-27 phần 27c, YCTD-253), kịch bản CT-27c-3 đến CT-27c-8: khóa không thu tiền và giá của
// chương trình, dòng gia sư trên hóa đơn của kỳ (không thu trùng, tính lại nháp), buổi bị hủy thành khoản trừ (trừ kỳ sau, điều
// chỉnh hóa đơn, đóng sau khi hoàn), thù lao vào bảng lương, báo cáo và tệp Excel. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
const nextMonday = addDays(vietnamToday, 8 - weekdayOf(vietnamToday));
const periodOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
const monthText = (period: { year: number; month: number }) =>
  `${period.year}-${String(period.month).padStart(2, '0')}`;
const nextPeriod = (period: { year: number; month: number }) =>
  period.month === 12 ? { year: period.year + 1, month: 1 } : { year: period.year, month: period.month + 1 };

type Json = Record<string, unknown>;

describe('Thu phí và chi trả gia sư trong trường', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  let teacher: LoggedInUser;
  let homeroom: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let mathId = '';
  let childId = '';
  let programId = '';
  let invoiceId = '';
  let sessions: { id: string; session_date: string }[] = [];
  const at = (index: number) => sessions[index] as { id: string; session_date: string };
  let billing = { year: 0, month: 0 };
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const ruleCodes = (body: Json) =>
    ((body.error as Json | undefined)?.details as Array<{ field: string }> | undefined)?.map(
      (detail) => detail.field,
    ) ?? [];
  const programBody = (changes: Json = {}) => ({
    name: 'Câu lạc bộ tiếng Anh giao tiếp',
    school_level: 'THCS',
    subject_id: null,
    content_type: 'enrichment',
    audience: null,
    charges_fee: true,
    fee_basis: 'per_session',
    fee_amount: 50_000,
    cancel_refund: 'deduct_next',
    pay_rate_per_period: 100_000,
    funding_source: 'tutoring_fees',
    delivery: 'live_video',
    registration_form:
      'Tôi là cha mẹ học sinh, tự nguyện đăng ký cho con tham gia câu lạc bộ, đồng ý mức thu theo buổi.',
    starts_on: nextMonday,
    ends_on: addDays(nextMonday, 60),
    class_ids: [classId],
    ...changes,
  });

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
        code: 'THCS-27C',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal);
    const levels = (current.body.levels as Json[]).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal, { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', principal, { school_level: 'THCS' })).status, 200);
    assert.equal((await api('POST', '/subjects/templates', principal, { school_level: 'THCS' })).status, 200);
    mathId = ((await api('GET', '/subjects?school_level=THCS', principal)).body as unknown as Json[]).find(
      (row) => row.code === 'THCS-TOAN',
    )?.id as string;
    accountant = await environment.loginAs('VT-04', unitId);
    teacher = await environment.loginAs('VT-08', unitId);
    homeroom = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '7A',
          name: '7A',
          grade_level: 'K7',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classId,
          staff_user_id: teacher.userId,
          staff_name: 'Cô Anh',
          assignment_role: 'subject',
          subject_name: 'Tiếng Anh',
          subject_id: null,
          from_date: addDays(vietnamToday, -60),
        },
        {
          class_id: classId,
          staff_user_id: homeroom.userId,
          staff_name: 'Thầy Chủ nhiệm',
          assignment_role: 'homeroom',
          subject_name: null,
          from_date: addDays(vietnamToday, -60),
        },
      ])
      .execute();
    // Hồ sơ nhân sự của giáo viên để thù lao vào bảng lương
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: unitId,
        code: 'NV-27C',
        full_name: 'Cô Anh',
        start_date: addDays(vietnamToday, -400),
        user_id: teacher.userId,
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: 'Học sinh An',
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
      .values({ child_id: childId, class_id: classId, from_date: addDays(vietnamToday, -60) })
      .execute();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của An', phone: null, user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childId, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-27c-3: môn học không đặt giá, chi từ kinh phí trường; bổ trợ có thu phải có giá mới được duyệt', async () => {
    const curriculum = {
      name: 'Phụ đạo Toán 7',
      subject_id: mathId,
      content_type: 'curriculum',
      audience: 'below_standard',
      charges_fee: false,
      fee_basis: null,
      fee_amount: null,
      funding_source: 'school_budget',
    };
    const priced = await api(
      'POST',
      '/tutoring/programs',
      teacher,
      programBody({ ...curriculum, fee_basis: 'per_session', fee_amount: 50_000 }),
    );
    assert.equal(priced.status, 422, JSON.stringify(priced.body));
    assert.deepEqual(ruleCodes(priced.body), ['curriculum_fee']);
    const funded = await api(
      'POST',
      '/tutoring/programs',
      teacher,
      programBody({ ...curriculum, funding_source: 'tutoring_fees' }),
    );
    assert.deepEqual(ruleCodes(funded.body), ['funding_source']);
    assert.equal((await api('POST', '/tutoring/programs', teacher, programBody(curriculum))).status, 201);

    const unpriced = await api(
      'POST',
      '/tutoring/programs',
      teacher,
      programBody({ fee_basis: null, fee_amount: null }),
    );
    assert.equal(unpriced.status, 201, 'nháp có thu lưu được khi chưa đặt giá');
    const unpricedId = unpriced.body.id as string;
    assert.equal((await api('POST', `/tutoring/programs/${unpricedId}/submit`, teacher)).status, 200);
    const blocked = await api('POST', `/tutoring/programs/${unpricedId}/approve`, principal);
    assert.equal(blocked.status, 422);
    assert.deepEqual(ruleCodes(blocked.body), ['fee_missing']);

    const created = await api('POST', '/tutoring/programs', teacher, programBody());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    programId = created.body.id as string;
    assert.equal((await api('POST', `/tutoring/programs/${programId}/submit`, teacher)).status, 200);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, principal)).status, 200);
    const detail = await api('GET', `/tutoring/programs/${programId}`, principal);
    assert.equal(detail.body.fee_basis, 'per_session');
    assert.equal(Number(detail.body.fee_amount), 50_000);
    assert.equal(detail.body.funding_source, 'tutoring_fees');
  });

  it('CT-27c-4: dòng gia sư trên hóa đơn của kỳ theo buổi chưa hủy; tính lại nháp không trùng; đã phát hành thì không thu lại', async () => {
    const weekly = await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, {
      weekly: { from: nextMonday, to: addDays(nextMonday, 13), weekdays: [2, 4] },
      start_time: '16:30',
      end_time: '17:15',
    });
    assert.equal(weekly.status, 201, JSON.stringify(weekly.body));
    sessions = (
      await schoolYear
        .selectFrom('tutoring_sessions')
        .select(['id', 'session_date'])
        .where('program_id', '=', programId)
        .orderBy('session_date')
        .execute()
    ).map((row) => ({ id: row.id, session_date: String(row.session_date).slice(0, 10) }));
    assert.equal(sessions.length, 4);
    const registered = await api('POST', `/children/${childId}/tutoring/registrations`, parent, {
      program_id: programId,
      agree: true,
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    assert.equal(
      (await api('POST', `/tutoring/registrations/${registered.body.id as string}/approve`, homeroom)).status,
      200,
    );
    const overview = await api('GET', `/children/${childId}/tutoring`, parent);
    assert.equal(Number((overview.body.programs as Json[])[0]?.fee_amount), 50_000, 'cha mẹ thấy mức thu');

    billing = periodOf(at(3).session_date);
    const planned = await tutoringItems(schoolYear, [childId], billing);
    const [item] = planned.items.get(childId) ?? [];
    assert.equal(item?.item_type, 'tutoring');
    assert.equal(item?.quantity, 4);
    assert.equal(item?.amount, 200_000);

    // Lần tính học phí: hóa đơn chính nháp của kỳ, chèn dòng, ghi buổi đã thu
    invoiceId = (
      await schoolYear
        .insertInto('invoices')
        .values({
          child_id: childId,
          org_unit_id: unitId,
          period_year: billing.year,
          period_month: billing.month,
          invoice_kind: 'main',
          status: 'draft',
          total_amount: 200_000,
          basis: JSON.stringify({}),
          review_flags: JSON.stringify([]),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('invoice_items')
        .values({ ...(item as NonNullable<typeof item>), invoice_id: invoiceId })
        .execute();
      await recordTutoringCharges(transaction, invoiceId, planned.plans.get(childId) ?? []);
    });
    const charged = await schoolYear.selectFrom('tutoring_charge_sessions').select('id').execute();
    assert.equal(charged.length, 4);

    const again = await tutoringItems(schoolYear, [childId], billing);
    assert.equal(again.items.get(childId)?.[0]?.quantity, 4, 'hóa đơn còn nháp được tính lại đủ buổi');
    await schoolYear
      .updateTable('invoices')
      .set({ status: 'issued', code: 'HD-27C-1', issued_at: new Date(), due_date: addDays(vietnamToday, 30) })
      .where('id', '=', invoiceId)
      .execute();
    const issued = await tutoringItems(schoolYear, [childId], billing);
    assert.equal(issued.items.get(childId), undefined, 'buổi đã thu ở hóa đơn đã phát hành không thu lại');
  });

  it('CT-27c-5: buổi đã dạy không hủy được; buổi đã thu bị hủy thành khoản trừ, trừ vào khoản gia sư kỳ sau', async () => {
    const confirm = await api('PUT', `/tutoring/sessions/${at(0).id}/attendance`, teacher, {
      entries: [{ child_id: childId, status: 'present' }],
    });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    const taught = await schoolYear
      .selectFrom('tutoring_sessions')
      .select('taught_by_user_id')
      .where('id', '=', at(0).id)
      .executeTakeFirstOrThrow();
    assert.equal(taught.taught_by_user_id, teacher.userId);
    assert.equal(
      (await api('POST', `/tutoring/sessions/${at(0).id}/cancel`, teacher, { reason: 'Giáo viên ốm' })).status,
      409,
    );

    assert.equal(
      (await api('POST', `/tutoring/sessions/${at(1).id}/cancel`, teacher, { reason: 'Trường tổ chức hội thi' }))
        .status,
      200,
    );
    const credit = await schoolYear
      .selectFrom('tutoring_credits')
      .selectAll()
      .where('session_id', '=', at(1).id)
      .executeTakeFirstOrThrow();
    assert.equal(Number(credit.amount), 50_000);
    assert.equal(credit.mode, 'deduct_next');
    assert.equal(credit.charged_invoice_id, invoiceId);

    // Kỳ sau có thêm một buổi: khoản trừ trừ hết vào dòng gia sư, dòng không âm
    const following = nextPeriod(billing);
    await schoolYear
      .insertInto('tutoring_sessions')
      .values({
        program_id: programId,
        session_date: `${monthText(following)}-05`,
        start_time: '16:30',
        end_time: '17:15',
        periods: 1,
        created_by: teacher.userId,
      })
      .execute();
    const next = await tutoringItems(schoolYear, [childId], following);
    const [line] = next.items.get(childId) ?? [];
    assert.equal(line?.quantity, 1);
    assert.equal(line?.amount, 0);
    assert.match(line?.basis_note ?? '', /trừ 50\.000 đ buổi bị hủy/);
    assert.deepEqual(next.plans.get(childId)?.[0]?.credits, [{ id: credit.id, amount: 50_000 }]);
  });

  it('CT-27c-6: kế toán lập điều chỉnh giảm hóa đơn qua luồng hiện có, hoặc đóng khoản trừ sau khi hoàn', async () => {
    assert.equal((await api('GET', '/tutoring/finance/credits', parent)).status, 403);
    assert.equal(
      (await api('POST', `/tutoring/sessions/${at(2).id}/cancel`, teacher, { reason: 'Mất điện' })).status,
      200,
    );
    const list = await api('GET', '/tutoring/finance/credits', accountant);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const credits = list.body as unknown as Json[];
    assert.equal(credits.length, 2);
    const latest = credits.find((row) => String(row.reason).includes('Mất điện')) as Json;
    assert.equal(latest.actionable, true);

    const adjusted = await api('POST', `/tutoring/finance/credits/${latest.id as string}/adjust`, accountant);
    assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
    const adjustment = await schoolYear
      .selectFrom('invoice_adjustments')
      .select(['amount', 'status', 'invoice_id'])
      .where('invoice_id', '=', invoiceId)
      .executeTakeFirstOrThrow();
    assert.equal(Number(adjustment.amount), -50_000);
    assert.equal(adjustment.status, 'pending');
    assert.equal(
      (await api('POST', `/tutoring/finance/credits/${latest.id as string}/close`, accountant, { note: 'PC-01' }))
        .status,
      409,
      'đã lập điều chỉnh',
    );

    const first = credits.find((row) => row.id !== latest.id) as Json;
    assert.equal(
      (await api('POST', `/tutoring/finance/credits/${first.id as string}/close`, accountant, { note: '' })).status,
      400,
    );
    const closed = await api('POST', `/tutoring/finance/credits/${first.id as string}/close`, accountant, {
      note: 'Đã hoàn tiền mặt, phiếu chi PC-0001',
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const next = await tutoringItems(schoolYear, [childId], nextPeriod(billing));
    assert.equal(next.items.get(childId)?.[0]?.amount, 50_000, 'khoản đã đóng không trừ nữa');
  });

  it('CT-27c-7: thù lao buổi đã dạy theo tiết vào bảng lương tháng, không đẩy trùng, không đẩy vào bảng lương đã chốt', async () => {
    const month = monthText(billing);
    const preview = await api('GET', `/tutoring/finance/teacher-pay?month=${month}`, principal);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const rows = preview.body.rows as Json[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.amount, 100_000);
    assert.equal(rows[0]?.problem, null);

    assert.equal((await api('POST', '/tutoring/finance/teacher-pay/push', principal, { month })).status, 403);
    const pushed = await api('POST', '/tutoring/finance/teacher-pay/push', accountant, { month });
    assert.equal(pushed.status, 200, JSON.stringify(pushed.body));
    assert.deepEqual(
      (pushed.body.pushed as Json[]).map((row) => [row.sessions, row.amount]),
      [[1, 100_000]],
    );
    const bonus = await schoolYear
      .selectFrom('staff_bonus_deductions')
      .innerJoin('pay_item_types', 'pay_item_types.id', 'staff_bonus_deductions.pay_item_type_id')
      .select([
        'staff_bonus_deductions.amount',
        'staff_bonus_deductions.target_month',
        'pay_item_types.code',
        'pay_item_types.is_tax_exempt',
      ])
      .executeTakeFirstOrThrow();
    assert.equal(Number(bonus.amount), 100_000);
    assert.equal(bonus.code, TUTORING_PAY_ITEM_CODE);
    assert.equal(bonus.is_tax_exempt, false, 'chịu thuế thu nhập cá nhân');
    const twice = await api('POST', '/tutoring/finance/teacher-pay/push', accountant, { month });
    assert.deepEqual(twice.body.pushed, []);

    const following = nextPeriod(billing);
    await schoolYear
      .insertInto('payrolls')
      .values({ period_year: following.year, period_month: following.month, status: 'pending', total_net: 0 })
      .execute();
    const locked = await api('POST', '/tutoring/finance/teacher-pay/push', accountant, {
      month: monthText(following),
    });
    assert.equal(locked.status, 422);
    assert.deepEqual(ruleCodes(locked.body), ['payroll_locked']);
  });

  it('CT-27c-8: báo cáo thu, trừ, hoàn, chi thù lao theo chương trình và kỳ; tệp Excel ghi nhật ký xuất', async () => {
    const month = monthText(billing);
    assert.equal((await api('GET', `/tutoring/finance/report?from=${month}&to=${month}`, teacher)).status, 403);
    const report = await api('GET', `/tutoring/finance/report?from=${month}&to=${month}`, principal);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const row = (report.body.programs as Json[]).find((program) => program.program_id === programId) as Json;
    assert.equal(row.billed, 200_000);
    assert.equal(row.refunded, 50_000);
    assert.equal(row.teacher_pay, 100_000);
    assert.equal(row.funding_source, 'tutoring_fees');
    const totals = report.body.totals as Json;
    assert.equal(totals.teacher_pay_tutoring_fees, 100_000);

    const file = await fetch(url(`/tutoring/finance/report/export?from=${month}&to=${month}`), {
      headers: { authorization: `Bearer ${accountant.accessToken}` },
    });
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-type') ?? '', /spreadsheetml/);
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data'])
      .where('report_code', '=', 'tutoring_finance')
      .executeTakeFirstOrThrow();
    assert.equal(log.contains_personal_data, true);
  });
});

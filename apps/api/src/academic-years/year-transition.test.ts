import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
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

// Chuyển trẻ, phụ huynh, lớp đang học, công nợ sang năm học mới và kiểm tra BR-89, BR-94 (DT-09 phần 9d, YCTD-69);
// ca kiểm thử CTC-P01-014, 015, 017, 096, 097, 098, CT-150, CT-177
const calendarOld = {
  first_term: { start_date: '2025-09-05', end_date: '2026-01-16' },
  second_term: { start_date: '2026-01-19', end_date: '2026-05-25' },
  summer_term: { start_date: '2026-06-01', end_date: '2026-07-31' },
};
const calendarNew = {
  first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
  second_term: { start_date: '2027-01-18', end_date: '2027-05-26' },
  summer_term: null,
};
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ message: string }> };

describe('Mở năm học mới: chuyển trẻ, lớp, công nợ', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  let teacher: LoggedInUser;
  let oldYear: Kysely<SchoolYearDatabase>;
  let newYear: Kysely<SchoolYearDatabase>;
  let oldYearId = '';
  let newYearId = '';
  let unitA = '';
  let classId = '';
  let closedClassId = '';
  let accountId = '';
  let categoryId = '';
  let fileId = '';
  let guardianId = '';
  const children: Record<string, string> = {};
  const invoices: Record<string, string> = {};

  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function addInvoice(child: string, month: number, amount: number) {
    const row = await oldYear
      .insertInto('invoices')
      .values({
        code: `HD-${randomUUID().slice(0, 8)}`,
        child_id: children[child] ?? '',
        org_unit_id: unitA,
        period_year: 2026,
        period_month: month,
        invoice_kind: 'main',
        status: 'issued',
        total_amount: amount,
        basis: JSON.stringify({}),
        review_flags: JSON.stringify([]),
        due_date: `2026-0${month}-10`,
        issued_at: new Date(),
        issued_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function addReceipt(child: string, amount: number, allocations: Array<[string, number]>) {
    const receipt = await oldYear
      .insertInto('receipts')
      .values({
        code: `PT-${randomUUID().slice(0, 8)}`,
        org_unit_id: unitA,
        child_id: children[child] ?? '',
        payer_name: 'Phụ huynh',
        amount,
        method: 'cash',
        account_id: accountId,
        category_id: categoryId,
        receipt_date: '2026-05-05',
        request_key: randomUUID(),
        created_by: accountant.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [invoiceId, allocated] of allocations) {
      await oldYear
        .insertInto('receipt_allocations')
        .values({ receipt_id: receipt.id, invoice_id: invoiceId, amount: allocated, created_by: accountant.userId })
        .execute();
    }
    return receipt.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    oldYearId = await openTestAcademicYear(environment, principal.accessToken, '2025–2026', calendarOld);
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    oldYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường chính',
      unit_type: 'truong_chinh',
    });
    unitA = (
      await api('POST', '/org-units', principal.accessToken, { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' })
    ).body.id as string;
    accountant = await environment.loginAs('VT-04', unitA);
    teacher = await environment.loginAs('VT-07', unitA);

    classId = (
      await oldYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: oldYearId,
          code: 'L-A1',
          name: 'Lá 1',
          grade_level: 'LA',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    closedClassId = (
      await oldYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA,
          academic_year_id: oldYearId,
          code: 'L-CU',
          name: 'Lớp cũ đã đóng',
          grade_level: 'MAM',
          max_size: 25,
          status: 'closed',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await oldYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: teacher.userId,
        staff_name: 'GV-A1',
        assignment_role: 'homeroom',
        from_date: '2025-09-05',
      })
      .execute();
    fileId = (
      await oldYear
        .insertInto('files')
        .values({
          org_unit_id: unitA,
          purpose: 'birth_certificate',
          file_name: 'giay-khai-sinh.pdf',
          content_type: 'application/pdf',
          size_bytes: 100,
          storage_key: `test/${randomUUID()}`,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    for (const [key, status] of [
      ['T1', 'active'],
      ['T2', 'active'],
      ['T3', 'active'],
      ['T4', 'pending'],
      ['T9', 'withdrawn'],
    ] as const) {
      children[key] = (
        await oldYear
          .insertInto('children')
          .values({
            org_unit_id: unitA,
            full_name: `Trẻ ${key}`,
            dob: '2021-03-01',
            gender: 'male',
            national_id_encrypted: 'ma-hoa',
            national_id_hash: randomUUID(),
            national_id_last4: '0000',
            photo_consent: 'granted',
            photo_consent_method: 'paper',
            birth_certificate_file_id: key === 'T1' ? fileId : null,
            status,
            enroll_date: '2025-09-05',
            leave_date: status === 'withdrawn' ? '2026-04-30' : null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // T1 học lớp đã đóng rồi chuyển sang L-A1; T9 thôi học nên lớp đã kết thúc
    await oldYear
      .insertInto('class_enrollments')
      .values([
        {
          child_id: children.T1 ?? '',
          class_id: closedClassId,
          from_date: '2025-09-05',
          to_date: '2025-12-31',
          is_current: false,
        },
        { child_id: children.T1 ?? '', class_id: classId, from_date: '2026-01-01' },
        { child_id: children.T2 ?? '', class_id: classId, from_date: '2025-09-05' },
        { child_id: children.T3 ?? '', class_id: classId, from_date: '2025-09-05' },
        {
          child_id: children.T9 ?? '',
          class_id: classId,
          from_date: '2025-09-05',
          to_date: '2026-04-30',
          is_current: false,
        },
      ])
      .execute();
    const relationship = await oldYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    guardianId = (
      await oldYear
        .insertInto('guardians')
        .values({ full_name: 'Mẹ của T1', phone: '0901000001' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const otherGuardian = await oldYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của T9', phone: '0901000009' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await oldYear
      .insertInto('child_guardians')
      .values([
        {
          child_id: children.T1 ?? '',
          guardian_id: guardianId,
          relationship_item_id: relationship.id,
          is_primary: true,
        },
        {
          child_id: children.T9 ?? '',
          guardian_id: otherGuardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        },
      ])
      .execute();
    await oldYear
      .insertInto('health_profiles')
      .values({ child_id: children.T1 ?? '', allergies: 'Sữa bò', has_allergies: true })
      .execute();
    await oldYear
      .insertInto('photo_consent_histories')
      .values({ child_id: children.T1 ?? '', action: 'granted', method: 'paper', actor_user_id: principal.userId })
      .execute();
    await oldYear
      .insertInto('authorized_pickups')
      .values([
        {
          child_id: children.T1 ?? '',
          full_name: 'Bà ngoại',
          relationship: 'Bà',
          phone: '0902000001',
          valid_from: '2025-09-05',
          source: 'staff',
          created_by: principal.userId,
        },
        {
          child_id: children.T1 ?? '',
          full_name: 'Người đã thu hồi',
          relationship: 'Cô',
          phone: '0902000002',
          valid_from: '2025-09-05',
          source: 'staff',
          status: 'revoked',
          created_by: principal.userId,
        },
      ])
      .execute();
    // Đăng ký dịch vụ: tháng 4 và tháng 5 của bán trú; chỉ dòng tháng 5 cần chuyển sang
    for (const month of [4, 5]) {
      await oldYear
        .insertInto('service_registrations')
        .values({
          child_id: children.T1 ?? '',
          org_unit_id: unitA,
          period_year: 2026,
          period_month: month,
          service_id: MEAL_SERVICE_ID,
          status: 'active',
          source: 'system',
        })
        .execute();
    }
    await oldYear
      .insertInto('notification_templates')
      .values({ template_code: 'tuition_reminder', title_template: '{tieu_de}', body_template: 'Mẫu riêng {noi_dung}' })
      .execute();

    categoryId = (
      await oldYear
        .insertInto('cashflow_categories')
        .values({ code: 'THU-HP', name: 'Thu học phí', group_name: 'Học phí', flow_type: 'income' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    accountId = (
      await oldYear
        .insertInto('cash_accounts')
        .values({
          org_unit_id: unitA,
          account_type: 'cash',
          name: 'Quỹ tiền mặt ĐT-A1',
          opening_balance: 1_000_000,
          current_balance: 4_200_000,
          created_by: accountant.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    // T1 nợ 700 000; T2 dư 200 000; T3 nợ 500 000 và dư 200 000; T9 đã thôi học còn nợ 500 000
    invoices.T1 = await addInvoice('T1', 5, 1_000_000);
    await addReceipt('T1', 300_000, [[invoices.T1, 300_000]]);
    invoices.T2 = await addInvoice('T2', 5, 800_000);
    await addReceipt('T2', 1_000_000, [[invoices.T2, 800_000]]);
    invoices.T3 = await addInvoice('T3', 5, 500_000);
    await addReceipt('T3', 200_000, []);
    invoices.T9 = await addInvoice('T9', 4, 500_000);

    newYearId = (await api('POST', '/academic-years', principal.accessToken, { name: '2026–2027' })).body.id as string;
    const saved = await api('PUT', `/academic-years/${newYearId}/calendar`, principal.accessToken, calendarNew);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  });

  after(async () => {
    await oldYear.destroy();
    await newYear?.destroy();
    await environment.close();
  });

  it('CTC-P01-096, CT-177: trẻ đã thôi học còn nợ thì không mở được năm mới, liệt kê trẻ còn nợ', async () => {
    const response = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(response.status, 422, JSON.stringify(response.body));
    assert.equal(errorOf(response.body).rule_code, 'BR-89');
    assert.deepEqual(
      errorOf(response.body).details?.map((detail) => detail.message),
      ['Trẻ T9: 500.000'],
    );
    const years = await environment.system.selectFrom('academic_years').select(['id', 'status']).execute();
    assert.equal(years.find((year) => year.id === oldYearId)?.status, 'open');
    assert.equal((await environment.system.selectFrom('academic_year_databases').select('id').execute()).length, 1);
  });

  it('BR-94: còn chứng từ chờ duyệt thì không mở được năm mới', async () => {
    await addReceipt('T9', 500_000, [[invoices.T9 ?? '', 500_000]]);
    const adjustment = await oldYear
      .insertInto('invoice_adjustments')
      .values({
        code: 'DC-TEST01',
        invoice_id: invoices.T1 ?? '',
        child_id: children.T1 ?? '',
        org_unit_id: unitA,
        reason: 'Điều chỉnh thử',
        amount: 50_000,
        status: 'pending',
        requires_principal: false,
        created_by: accountant.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const response = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(response.status, 422, JSON.stringify(response.body));
    assert.equal(errorOf(response.body).rule_code, 'BR-94');
    assert.deepEqual(
      errorOf(response.body).details?.map((detail) => detail.message),
      ['Điều chỉnh hóa đơn chờ duyệt: 1'],
    );
    await oldYear
      .updateTable('invoice_adjustments')
      .set({ status: 'rejected', decided_by: principal.userId, decided_at: new Date(), reject_reason: 'Thử' })
      .where('id', '=', adjustment.id)
      .execute();
  });

  it('CTC-P01-097, CTC-P01-014, CTC-P01-015: thu hết nợ của trẻ đã thôi học thì mở được; trẻ chưa thôi học chuyển sang, giữ mã định danh', async () => {
    const response = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', newYearId)
      .executeTakeFirstOrThrow();
    newYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    const carried = await newYear.selectFrom('children').select(['id', 'full_name', 'status']).execute();
    assert.deepEqual(
      carried.map((child) => child.id).sort(),
      [children.T1, children.T2, children.T3, children.T4].sort(),
    );
    assert.equal(carried.find((child) => child.id === children.T4)?.status, 'pending');

    const guardians = await newYear.selectFrom('guardians').select('id').execute();
    assert.deepEqual(
      guardians.map((row) => row.id),
      [guardianId],
    );
    assert.equal((await newYear.selectFrom('child_guardians').select('id').execute()).length, 1);
    const health = await newYear.selectFrom('health_profiles').select(['child_id', 'allergies']).execute();
    assert.deepEqual(health, [{ child_id: children.T1, allergies: 'Sữa bò' }]);
    assert.equal((await newYear.selectFrom('photo_consent_histories').select('id').execute()).length, 1);
    const pickups = await newYear.selectFrom('authorized_pickups').select('full_name').execute();
    assert.deepEqual(
      pickups.map((row) => row.full_name),
      ['Bà ngoại'],
    );
    const files = await newYear.selectFrom('files').select('id').execute();
    assert.deepEqual(
      files.map((row) => row.id),
      [fileId],
    );
    const templates = await newYear.selectFrom('notification_templates').select('body_template').execute();
    assert.deepEqual(
      templates.map((row) => row.body_template),
      ['Mẫu riêng {noi_dung}'],
    );
  });

  it('CTC-P01-017: năm mới có lớp đang học và lịch sử lớp gần nhất; năm cũ giữ lịch sử đầy đủ', async () => {
    const classes = await newYear.selectFrom('classes').select(['id', 'academic_year_id']).execute();
    assert.deepEqual(classes, [{ id: classId, academic_year_id: newYearId }]);
    const enrollments = await newYear
      .selectFrom('class_enrollments')
      .select(['child_id', 'class_id', 'is_current'])
      .where('child_id', '=', children.T1 ?? '')
      .execute();
    assert.deepEqual(enrollments, [{ child_id: children.T1, class_id: classId, is_current: true }]);
    const oldHistory = await oldYear
      .selectFrom('class_enrollments')
      .select('id')
      .where('child_id', '=', children.T1 ?? '')
      .execute();
    assert.equal(oldHistory.length, 2);
    const assignments = await newYear.selectFrom('class_staff_assignments').select('staff_user_id').execute();
    assert.deepEqual(
      assignments.map((row) => row.staff_user_id),
      [teacher.userId],
    );
    const classView = await api('GET', `/classes/${classId}/staff-assignments`, principal.accessToken);
    assert.equal(classView.status, 200, JSON.stringify(classView.body));

    const registrations = await newYear
      .selectFrom('service_registrations')
      .select(['child_id', 'period_month', 'service_id'])
      .execute();
    assert.deepEqual(registrations, [{ child_id: children.T1, period_month: 5, service_id: MEAL_SERVICE_ID }]);
  });

  it('CT-19b-9: năm mới chép chương trình theo cấp, cấp của đơn vị, cấp của lớp từ năm cũ, giữ mã định danh', async () => {
    const curriculaOf = (database: Kysely<SchoolYearDatabase>) =>
      database.selectFrom('curricula').select(['id', 'code', 'school_level', 'is_default']).orderBy('code').execute();
    assert.deepEqual(await curriculaOf(newYear), await curriculaOf(oldYear));
    const levelsOf = (database: Kysely<SchoolYearDatabase>) =>
      database.selectFrom('org_unit_levels').select(['org_unit_id', 'school_level']).orderBy('org_unit_id').execute();
    const carriedLevels = await levelsOf(newYear);
    assert.ok(carriedLevels.length > 0);
    assert.deepEqual(carriedLevels, await levelsOf(oldYear));
    const classes = await newYear.selectFrom('classes').select(['id', 'school_level']).execute();
    assert.deepEqual(classes, [{ id: classId, school_level: 'MN' }]);
  });

  it('CTC-P01-098: công nợ và số dư có của trẻ chuyển sang được bù trừ; trẻ đã thôi học không chuyển', async () => {
    const accounts = await newYear
      .selectFrom('cash_accounts')
      .select(['id', 'opening_balance', 'current_balance'])
      .execute();
    assert.deepEqual(
      accounts.map((row) => ({
        ...row,
        opening_balance: Number(row.opening_balance),
        current_balance: Number(row.current_balance),
      })),
      [{ id: accountId, opening_balance: 4_200_000, current_balance: 4_200_000 }],
    );

    const debt = async (child: string) => {
      const response = await api('GET', `/children/${children[child]}/debt`, accountant.accessToken);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body as {
        outstanding_amount: number;
        credit_amount: number;
        invoices: Array<{ due_date: string }>;
      };
    };
    const t1 = await debt('T1');
    assert.equal(t1.outstanding_amount, 700_000);
    assert.equal(t1.credit_amount, 0);
    assert.equal(t1.invoices[0]?.due_date, '2026-09-07');
    const t2 = await debt('T2');
    assert.equal(t2.outstanding_amount, 0);
    assert.equal(t2.credit_amount, 200_000);
    const t3 = await debt('T3');
    assert.equal(t3.outstanding_amount, 300_000);
    assert.equal(t3.credit_amount, 0);
    const t4 = await debt('T4');
    assert.equal(t4.outstanding_amount, 0);

    const openingInvoices = await newYear
      .selectFrom('invoices')
      .select(['code', 'invoice_kind', 'period_year', 'period_month'])
      .orderBy('code')
      .execute();
    assert.deepEqual(openingInvoices, [
      { code: 'HD-000001', invoice_kind: 'opening', period_year: 2026, period_month: 9 },
      { code: 'HD-000002', invoice_kind: 'opening', period_year: 2026, period_month: 9 },
    ]);
    const childOnlyOld = await newYear
      .selectFrom('invoices')
      .select('id')
      .where('child_id', '=', children.T9 ?? '')
      .execute();
    assert.equal(childOnlyOld.length, 0);
  });

  it('YCTD-69: phiếu ghi số dư có chuyển sang không vào báo cáo thu chi, không đảo được, dùng được để bù trừ', async () => {
    const receipt = await newYear
      .selectFrom('receipts')
      .select(['id', 'code', 'amount', 'carried_over'])
      .where('child_id', '=', children.T2 ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(receipt.code, 'PT-000001');
    assert.equal(Number(receipt.amount), 200_000);
    assert.equal(receipt.carried_over, true);

    const transactions = await newYear.selectFrom('account_transactions').select('id').execute();
    assert.equal(transactions.length, 0);
    const report = await api('GET', '/reports/cash-flow?from=2026-09-01&to=2026-09-30', principal.accessToken);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    assert.equal((report.body.totals as { income_amount: number }).income_amount, 0);

    const reverse = await api('POST', `/receipts/${receipt.id}/reverse`, accountant.accessToken, { reason: 'Thử đảo' });
    assert.equal(reverse.status, 422, JSON.stringify(reverse.body));
    assert.equal(errorOf(reverse.body).rule_code, 'BR-29');

    const listed = await api('GET', `/children/${children.T2}/receipts`, accountant.accessToken);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.ok(JSON.stringify(listed.body).includes('"carried_over":true'));
  });
});

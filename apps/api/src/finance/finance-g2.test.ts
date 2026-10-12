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

// Tài chính giai đoạn 2 (DT-10 phần 10i, YCTD-82): nhắc nợ, xử lý công nợ quá hạn, giao dịch ngân hàng và đối chiếu, công
// nợ phải trả, chốt kỳ tài chính; kịch bản CT-169
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };
const currentMonth = vietnamToday.slice(0, 7);
const previousMonth = addDays(`${currentMonth}-01`, -1).slice(0, 7);
const previousDate = `${previousMonth}-15`;

describe('Tài chính giai đoạn 2: nhắc nợ, xử lý công nợ, ngân hàng, phải trả, chốt kỳ', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const invoices: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  const categories: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const unitA = () => units['ĐT-A1'] ?? '';

  async function insertInvoice(key: string, period: string, total: number, dueDate: string, status = 'issued') {
    const row = await schoolYear
      .insertInto('invoices')
      .values({
        code: status === 'issued' ? `HD-9${String(Object.keys(invoices).length + 1).padStart(5, '0')}` : null,
        child_id: children.A ?? '',
        org_unit_id: unitA(),
        period_year: Number(period.slice(0, 4)),
        period_month: Number(period.slice(5, 7)),
        invoice_kind: key.startsWith('draft') ? 'supplementary' : 'main',
        status: status as 'issued' | 'draft',
        total_amount: total,
        basis: JSON.stringify({}),
        due_date: dueDate,
        issued_at: status === 'issued' ? new Date() : null,
        issued_by: status === 'issued' ? principal.userId : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    invoices[key] = row.id;
    return row.id;
  }

  async function insertPayment(amount: number, paymentDate: string) {
    return (
      await schoolYear
        .insertInto('payments')
        .values({
          code: `PC-9${String(Math.floor(Math.random() * 99_999)).padStart(5, '0')}`,
          org_unit_id: unitA(),
          payment_type: 'regular',
          payee_name: 'Công ty Văn phòng phẩm An',
          amount,
          content: 'Trả tiền mua hàng',
          account_id: accounts.cash ?? '',
          category_id: categories.expense ?? '',
          payment_date: paymentDate,
          status: 'issued',
          requires_principal: false,
          request_key: randomUUID(),
          created_by: users.accountant?.userId ?? '',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -75), end_date: addDays(vietnamToday, 90) },
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
    users.accountant = await environment.loginAs('VT-04', unitA());
    users.manager = await environment.loginAs('VT-03', unitA());
    users.vicePrincipal = await environment.loginAs('VT-15', unitA());
    users.chiefAccountant = await environment.loginAs('VT-05', unitA());
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    users.parent = await environment.loginAs('VT-14', unitA());

    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitA(),
          academic_year_id: academicYearId,
          code: 'MAM-1',
          name: 'MAM-1',
          grade_level: 'MAM',
          max_size: 25,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const key of ['A', 'B']) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA(),
          full_name: `Trẻ ${key}`,
          dob: addDays(vietnamToday, -4 * 365),
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
        .execute();
      if (key === 'A') {
        const guardian = await schoolYear
          .insertInto('guardians')
          .values({ full_name: 'Mẹ A', phone: '0901234567', user_id: users.parent?.userId ?? null })
          .returning('id')
          .executeTakeFirstOrThrow();
        await schoolYear
          .insertInto('child_guardians')
          .values({
            child_id: child.id,
            guardian_id: guardian.id,
            relationship_item_id: relationship.id,
            is_primary: true,
          })
          .execute();
      }
    }
    for (const [key, flow] of [
      ['income', 'income'],
      ['expense', 'expense'],
    ] as const) {
      categories[key] = (
        await schoolYear
          .insertInto('cashflow_categories')
          .values({ code: `KM-${key}`, name: `Khoản ${key}`, group_name: 'Chung', flow_type: flow })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, body] of [
      ['cash', { account_type: 'cash', name: 'Quỹ A', opening_balance: 10_000_000 }],
      ['bank', { account_type: 'bank', name: 'NH A', bank_name: 'VCB', account_number: '0011', opening_balance: 0 }],
      ['bankB', { account_type: 'bank', name: 'NH B', bank_name: 'VCB', account_number: '0022', opening_balance: 0 }],
    ] as const) {
      const unit = key === 'bankB' ? units['ĐT-B1'] : unitA();
      const created = await api(
        'POST',
        '/cash-accounts',
        key === 'bankB' ? token('accountantB') : token('accountant'),
        {
          org_unit_id: unit,
          ...body,
        },
      );
      assert.equal(created.status, 201, JSON.stringify(created.body));
      accounts[key] = created.body.id as string;
    }
    // Hóa đơn tháng trước quá hạn 10 ngày (mốc 7) và hóa đơn tháng này quá hạn 1 ngày (chưa tới mốc 3)
    await insertInvoice('old', previousMonth, 2_000_000, addDays(vietnamToday, -10));
    await insertInvoice('recent', currentMonth, 1_500_000, addDays(vietnamToday, -1));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P05-10: danh sách nhắc nợ theo mốc, gửi nhắc cho phụ huynh, không nhắc lại cùng mốc; kế toán đơn vị khác bị từ chối', async () => {
    const list = await api('GET', `/debts/reminders?org_unit_id=${unitA()}`, token('accountant'));
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const rows = list.body.rows as Array<{ invoice_id: string; milestone_days: number; needs_reminder: boolean }>;
    assert.deepEqual(list.body.milestones, [3, 7, 15]);
    assert.equal(rows.length, 2);
    const old = rows.find((row) => row.invoice_id === invoices.old);
    const recent = rows.find((row) => row.invoice_id === invoices.recent);
    assert.equal(old?.milestone_days, 7);
    assert.equal(old?.needs_reminder, true);
    assert.equal(recent?.milestone_days, 0);
    assert.equal(recent?.needs_reminder, false);
    const filtered = await api('GET', `/debts/reminders?org_unit_id=${unitA()}&milestone=7`, token('manager'));
    assert.equal((filtered.body.rows as unknown[]).length, 1);
    assert.equal((await api('GET', `/debts/reminders?org_unit_id=${unitA()}`, token('accountantB'))).status, 403);

    const send = await api('POST', '/debts/reminders/send', token('accountant'), {
      org_unit_id: unitA(),
      invoice_ids: [invoices.old, invoices.recent],
    });
    assert.equal(send.status, 200, JSON.stringify(send.body));
    assert.equal(send.body.sent_count, 2);
    const again = await api('POST', '/debts/reminders/send', token('manager'), {
      org_unit_id: unitA(),
      invoice_ids: [invoices.old],
    });
    assert.equal(again.body.sent_count, 0);
    assert.equal((again.body.skipped as unknown[]).length, 1);
    const notified = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notifications.id')
      .where('notifications.template_code', '=', 'debt_reminder')
      .where('notification_recipients.user_id', '=', users.parent?.userId ?? '')
      .execute();
    assert.equal(notified.length, 2);
    const after = await api('GET', `/debts/reminders?org_unit_id=${unitA()}&due_only=true`, token('accountant'));
    assert.equal((after.body.rows as unknown[]).length, 0);
    assert.equal(
      (
        await api('POST', '/debts/reminders/send', token('vicePrincipal'), {
          org_unit_id: unitA(),
          invoice_ids: [invoices.old],
        })
      ).status,
      403,
    );
  });

  it('CT-169 P05-12: quản lý đơn vị lập đề xuất; quản lý đơn vị, kế toán ghi quyết định bị từ chối; Phó Hiệu trưởng ghi được, công nợ không đổi', async () => {
    const debtBefore = await api('GET', `/children/${children.A}/debt`, token('accountant'));
    assert.equal(debtBefore.status, 200, JSON.stringify(debtBefore.body));
    const noDebt = await api('POST', '/debt-resolutions', token('manager'), {
      child_id: children.B,
      proposal: 'Mời phụ huynh lên làm việc',
    });
    assert.equal(noDebt.status, 422);
    assert.equal(errorOf(noDebt.body).rule_code, 'BR-33');
    const proposed = await api('POST', '/debt-resolutions', token('manager'), {
      child_id: children.A,
      proposal: 'Gia hạn nộp tới cuối tháng, gọi điện nhắc phụ huynh',
    });
    assert.equal(proposed.status, 201, JSON.stringify(proposed.body));
    assert.equal(proposed.body.status, 'pending');
    assert.equal(proposed.body.overdue_amount, 3_500_000);
    assert.equal(
      (await api('POST', '/debt-resolutions', token('accountant'), { child_id: children.A, proposal: 'Lần hai' }))
        .status,
      409,
    );
    const id = proposed.body.id as string;
    for (const name of ['manager', 'accountant']) {
      const denied = await api('POST', `/debt-resolutions/${id}/decide`, token(name), { decision: 'Đồng ý gia hạn' });
      assert.equal(denied.status, 403, name);
    }
    const decided = await api('POST', `/debt-resolutions/${id}/decide`, token('vicePrincipal'), {
      decision: 'Đồng ý gia hạn tới ngày cuối tháng',
    });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.equal(decided.body.status, 'decided');
    assert.equal(
      (await api('POST', `/debt-resolutions/${id}/decide`, principal.accessToken, { decision: 'Lại' })).status,
      409,
    );
    const debtAfter = await api('GET', `/children/${children.A}/debt`, token('accountant'));
    assert.equal(debtAfter.body.outstanding_amount, debtBefore.body.outstanding_amount);
    assert.equal(debtAfter.body.overdue_amount, debtBefore.body.overdue_amount);
    const list = await api('GET', `/debt-resolutions?org_unit_id=${unitA()}`, token('manager'));
    assert.equal((list.body as unknown as unknown[]).length, 1);
  });

  it('P06-06: ghi dòng sao kê, đối chiếu chênh lệch, khớp tay, khớp tự động; quỹ tiền mặt và vai trò khác bị từ chối', async () => {
    const entry = await schoolYear
      .insertInto('account_transactions')
      .values({
        account_id: accounts.bank ?? '',
        transaction_date: vietnamToday,
        transaction_type: 'receipt',
        amount: 500_000,
        balance_after: 500_000,
        reference_type: 'receipts',
        reference_id: randomUUID(),
        description: 'PT-900001 thu chuyển khoản',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const line = (body: Record<string, unknown>, name = 'accountant') =>
      api('POST', '/bank-transactions', token(name), {
        account_id: accounts.bank,
        transaction_date: vietnamToday,
        description: 'Sao kê',
        ...body,
      });
    assert.equal((await line({ account_id: accounts.cash, amount: 500_000 })).status, 400);
    assert.equal((await line({ amount: 500_000 }, 'manager')).status, 403);
    assert.equal((await line({ amount: 0 })).status, 400);
    const incoming = await line({ amount: 500_000, bank_reference: 'FT001' });
    assert.equal(incoming.status, 201, JSON.stringify(incoming.body));
    const fee = await line({ amount: -11_000, description: 'Phí quản lý tài khoản' });
    assert.equal(fee.status, 201);

    const range = `account_id=${accounts.bank}&from=${addDays(vietnamToday, -5)}&to=${vietnamToday}`;
    const before = await api('GET', `/bank-reconciliation?${range}`, token('accountant'));
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.equal(before.body.book_movement, 500_000);
    assert.equal(before.body.statement_movement, 489_000);
    assert.equal(before.body.difference, 11_000);
    assert.equal((before.body.unmatched_statement as unknown[]).length, 2);

    const wrong = await api('POST', `/bank-transactions/${fee.body.id}/match`, token('accountant'), {
      account_transaction_id: entry.id,
    });
    assert.equal(wrong.status, 422);
    const matched = await api('POST', `/bank-transactions/${incoming.body.id}/match`, token('accountant'), {
      account_transaction_id: entry.id,
    });
    assert.equal(matched.status, 200, JSON.stringify(matched.body));
    assert.equal(matched.body.status, 'matched');
    const duplicate = await line({ amount: 500_000, description: 'Nhập trùng' });
    assert.equal(
      (
        await api('POST', `/bank-transactions/${duplicate.body.id}/match`, token('accountant'), {
          account_transaction_id: entry.id,
        })
      ).status,
      409,
    );
    assert.equal((await api('DELETE', `/bank-transactions/${duplicate.body.id}`, token('accountant'))).status, 200);
    assert.equal((await api('DELETE', `/bank-transactions/${incoming.body.id}`, token('accountant'))).status, 422);
    assert.equal(
      (await api('POST', `/bank-transactions/${incoming.body.id}/unmatch`, token('accountant'))).status,
      200,
    );
    const auto = await api('POST', '/bank-transactions/auto-match', token('accountant'), {
      account_id: accounts.bank,
      from: addDays(vietnamToday, -5),
      to: vietnamToday,
    });
    assert.equal(auto.status, 200, JSON.stringify(auto.body));
    assert.equal(auto.body.auto_matched_count, 1);
    assert.equal(auto.body.matched_count, 1);
    assert.equal((auto.body.unmatched_statement as unknown[]).length, 1);
    assert.equal((await api('GET', `/bank-reconciliation?${range}`, token('accountantB'))).status, 403);
    assert.equal(
      (await api('GET', `/bank-transactions?account_id=${accounts.bank}`, token('chiefAccountant'))).status,
      200,
    );
  });

  it('P06-07: ghi công nợ phải trả từ phiếu mua hàng và lập tay, theo dõi quá hạn, trả bằng phiếu chi đúng số tiền', async () => {
    const supplier = await schoolYear
      .insertInto('suppliers')
      .values({ org_unit_id: unitA(), name: 'Công ty Văn phòng phẩm An', created_by: principal.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const request = await schoolYear
      .insertInto('purchase_requests')
      .values({
        code: 'DNM-900001',
        org_unit_id: unitA(),
        requester_id: principal.userId,
        requester_name: 'Người đề nghị',
        needed_by: vietnamToday,
        reason: 'Mua giấy',
        total_amount: 1_200_000,
        requires_principal: false,
        status: 'ordered',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const order = await schoolYear
      .insertInto('purchase_orders')
      .values({
        code: 'PMH-900001',
        org_unit_id: unitA(),
        request_id: request.id,
        supplier_id: supplier.id,
        order_date: addDays(vietnamToday, -2),
        total_amount: 1_200_000,
        created_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const sources = await api('GET', `/payables/sources?org_unit_id=${unitA()}`, token('accountant'));
    assert.equal(sources.status, 200, JSON.stringify(sources.body));
    assert.equal((sources.body.purchase_orders as unknown[]).length, 1);
    assert.equal((await api('GET', `/payables/sources?org_unit_id=${unitA()}`, token('manager'))).status, 403);

    const fromOrder = await api('POST', '/payables', token('accountant'), {
      source_type: 'purchase_order',
      source_id: order.id,
      due_date: addDays(vietnamToday, 10),
    });
    assert.equal(fromOrder.status, 201, JSON.stringify(fromOrder.body));
    assert.equal(fromOrder.body.amount, 1_200_000);
    assert.equal(fromOrder.body.payee_name, 'Công ty Văn phòng phẩm An');
    assert.match(fromOrder.body.code as string, /^CNP-\d{6}$/);
    assert.equal(
      (
        await api('POST', '/payables', token('accountant'), {
          source_type: 'purchase_order',
          source_id: order.id,
          due_date: addDays(vietnamToday, 10),
        })
      ).status,
      409,
    );
    const manual = await api('POST', '/payables', token('chiefAccountant'), {
      org_unit_id: unitA(),
      supplier_id: supplier.id,
      document_ref: 'HĐ 0001234',
      description: 'Sửa máy in',
      amount: 300_000,
      document_date: addDays(vietnamToday, -20),
      due_date: addDays(vietnamToday, -5),
    });
    assert.equal(manual.status, 201, JSON.stringify(manual.body));
    assert.equal(manual.body.overdue_days, 5);
    assert.equal(
      (
        await api('POST', '/payables', token('accountant'), {
          org_unit_id: unitA(),
          description: 'Thiếu người nhận',
          amount: 100_000,
          document_date: vietnamToday,
          due_date: vietnamToday,
        })
      ).status,
      400,
    );
    const list = await api('GET', `/payables?org_unit_id=${unitA()}`, token('accountant'));
    assert.equal(list.status, 200);
    assert.equal((list.body.totals as { open_amount: number }).open_amount, 1_500_000);
    assert.equal((list.body.totals as { overdue_amount: number }).overdue_amount, 300_000);
    assert.equal((list.body.payees as unknown[]).length, 1);

    const wrongPayment = await insertPayment(1_000_000, vietnamToday);
    const wrong = await api('POST', `/payables/${fromOrder.body.id}/pay`, token('accountant'), {
      payment_id: wrongPayment,
    });
    assert.equal(wrong.status, 422);
    assert.equal(errorOf(wrong.body).rule_code, 'BR-28');
    const payment = await insertPayment(1_200_000, vietnamToday);
    const paid = await api('POST', `/payables/${fromOrder.body.id}/pay`, token('accountant'), { payment_id: payment });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.body.status, 'paid');
    const orderAfter = await schoolYear
      .selectFrom('purchase_orders')
      .select(['payment_status', 'payment_id'])
      .where('id', '=', order.id)
      .executeTakeFirstOrThrow();
    assert.equal(orderAfter.payment_status, 'paid');
    assert.equal(orderAfter.payment_id, payment);
    const cancelled = await api('POST', `/payables/${manual.body.id}/cancel`, token('accountant'), {
      reason: 'Nhà cung cấp xuất lại hóa đơn',
    });
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(
      (await api('POST', `/payables/${fromOrder.body.id}/cancel`, token('accountant'), { reason: 'x' })).status,
      422,
    );
  });

  it('P06-07: ghi công nợ phải trả từ phiếu đi chợ của bếp đã nhận hàng; trả bằng phiếu chi thì phiếu đi chợ thành đã thanh toán', async () => {
    const foodSupplier = await schoolYear
      .insertInto('food_suppliers')
      .values({ org_unit_id: unitA(), name: 'Cửa hàng thực phẩm Bình', created_by: principal.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const insertPurchase = (code: string, status: 'draft' | 'received') =>
      schoolYear
        .insertInto('market_purchases')
        .values({
          code,
          org_unit_id: unitA(),
          purchase_date: addDays(vietnamToday, -1),
          supplier_id: foodSupplier.id,
          total_amount: 850_000,
          status,
          payment_status: status === 'received' ? 'awaiting_payment' : null,
          created_by: principal.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    const received = await insertPurchase('PDC-900001', 'received');
    const draft = await insertPurchase('PDC-900002', 'draft');

    const sources = await api('GET', `/payables/sources?org_unit_id=${unitA()}`, token('accountant'));
    assert.equal(sources.status, 200, JSON.stringify(sources.body));
    assert.deepEqual(
      (sources.body.market_purchases as Array<{ id: string }>).map((row) => row.id),
      [received.id],
    );
    const notReceived = await api('POST', '/payables', token('accountant'), {
      source_type: 'market_purchase',
      source_id: draft.id,
      due_date: addDays(vietnamToday, 5),
    });
    assert.equal(notReceived.status, 422, JSON.stringify(notReceived.body));
    const payable = await api('POST', '/payables', token('accountant'), {
      source_type: 'market_purchase',
      source_id: received.id,
      due_date: addDays(vietnamToday, 5),
    });
    assert.equal(payable.status, 201, JSON.stringify(payable.body));
    assert.equal(payable.body.amount, 850_000);
    assert.equal(payable.body.payee_name, 'Cửa hàng thực phẩm Bình');

    const payment = await insertPayment(850_000, vietnamToday);
    const paid = await api('POST', `/payables/${payable.body.id}/pay`, token('accountant'), { payment_id: payment });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    const purchaseAfter = await schoolYear
      .selectFrom('market_purchases')
      .select(['payment_status', 'payment_id'])
      .where('id', '=', received.id)
      .executeTakeFirstOrThrow();
    assert.equal(purchaseAfter.payment_status, 'paid');
    assert.equal(purchaseAfter.payment_id, payment);
  });

  it('P06-09: kế toán trưởng đề nghị, Hiệu trưởng từ chối rồi duyệt chốt; kỳ đã chốt chặn lập phiếu, đảo phiếu, sửa hóa đơn', async () => {
    // Chứng từ của tháng trước lập sẵn trước khi chốt
    const oldReceipt = await schoolYear
      .insertInto('receipts')
      .values({
        code: 'PT-900009',
        org_unit_id: unitA(),
        child_id: children.A ?? '',
        payer_name: 'Mẹ A',
        amount: 100_000,
        method: 'cash',
        account_id: accounts.cash ?? '',
        category_id: categories.income ?? '',
        receipt_date: previousDate,
        request_key: randomUUID(),
        created_by: users.accountant?.userId ?? '',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const oldPayment = await insertPayment(50_000, previousDate);
    const draft = await insertInvoice('draft-old', previousMonth, 100_000, vietnamToday, 'draft');

    const notEnded = await api('POST', '/fiscal-periods', token('chiefAccountant'), {
      org_unit_id: unitA(),
      period: currentMonth,
    });
    assert.equal(notEnded.status, 422);
    assert.equal(errorOf(notEnded.body).rule_code, 'BR-95');
    assert.equal(
      (await api('POST', '/fiscal-periods', token('accountant'), { org_unit_id: unitA(), period: previousMonth }))
        .status,
      403,
    );
    const blocked = await api('POST', '/fiscal-periods', token('chiefAccountant'), {
      org_unit_id: unitA(),
      period: previousMonth,
    });
    assert.equal(blocked.status, 422);
    assert.ok(errorOf(blocked.body).details?.some((detail) => detail.field === 'draft_invoices'));
    await schoolYear.deleteFrom('invoices').where('id', '=', draft).execute();

    const requested = await api('POST', '/fiscal-periods', token('chiefAccountant'), {
      org_unit_id: unitA(),
      period: previousMonth,
      note: 'Đã đối chiếu quỹ và ngân hàng',
    });
    assert.equal(requested.status, 201, JSON.stringify(requested.body));
    assert.equal(requested.body.status, 'pending');
    assert.equal((requested.body.summary as { receipt_amount: number }).receipt_amount, 100_000);
    assert.equal((requested.body.summary as { payment_amount: number }).payment_amount, 50_000);
    const periodId = requested.body.id as string;
    assert.equal(
      (await api('POST', '/fiscal-periods', token('chiefAccountant'), { org_unit_id: unitA(), period: previousMonth }))
        .status,
      409,
    );
    assert.equal((await api('POST', `/fiscal-periods/${periodId}/close`, token('chiefAccountant'))).status, 403);
    assert.equal((await api('POST', `/fiscal-periods/${periodId}/close`, token('vicePrincipal'))).status, 403);
    const rejected = await api('POST', `/fiscal-periods/${periodId}/reject`, principal.accessToken, {
      reason: 'Còn thiếu sao kê ngân hàng',
    });
    assert.equal(rejected.body.status, 'rejected');
    const again = await api('POST', '/fiscal-periods', token('chiefAccountant'), {
      org_unit_id: unitA(),
      period: previousMonth,
    });
    assert.equal(again.status, 201);
    assert.equal(again.body.id, periodId);
    const closed = await api('POST', `/fiscal-periods/${periodId}/close`, principal.accessToken);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.status, 'closed');
    const periods = await api('GET', `/fiscal-periods?org_unit_id=${unitA()}`, token('chiefAccountant'));
    const previous = (periods.body as unknown as Array<{ period: string; status: string }>).find(
      (item) => item.period === previousMonth,
    );
    assert.equal(previous?.status, 'closed');

    const expectLocked = (response: { status: number; body: Record<string, unknown> }, label: string) => {
      assert.equal(response.status, 422, `${label}: ${JSON.stringify(response.body)}`);
      assert.equal(errorOf(response.body).rule_code, 'BR-95', label);
    };
    expectLocked(
      await api('POST', '/receipts', token('accountant'), {
        request_key: randomUUID(),
        child_id: children.A,
        payer_name: 'Mẹ A',
        amount: 200_000,
        method: 'cash',
        account_id: accounts.cash,
        category_id: categories.income,
        receipt_date: previousDate,
        allocations: [],
      }),
      'phiếu thu ngày của kỳ đã chốt',
    );
    expectLocked(
      await api('POST', `/receipts/${oldReceipt.id}/reverse`, token('accountant'), { reason: 'Thu nhầm' }),
      'đảo phiếu thu',
    );
    expectLocked(
      await api('POST', `/payments/${oldPayment}/reverse`, token('accountant'), { reason: 'Chi nhầm' }),
      'đảo phiếu chi',
    );
    expectLocked(
      await api('POST', '/invoice-adjustments', token('accountant'), {
        invoice_id: invoices.old,
        amount: 100_000,
        reason: 'Điều chỉnh',
      }),
      'điều chỉnh hóa đơn',
    );
    expectLocked(
      await api('POST', '/fee-calculations', token('accountant'), { org_unit_id: unitA(), period: previousMonth }),
      'tính học phí',
    );
    expectLocked(
      await api('POST', '/bank-transactions', token('accountant'), {
        account_id: accounts.bank,
        transaction_date: previousDate,
        amount: 10_000,
        description: 'Lãi',
      }),
      'giao dịch ngân hàng',
    );
    // Kỳ đang mở và đơn vị khác không bị khóa
    const openReceipt = await api('POST', '/receipts', token('accountant'), {
      request_key: randomUUID(),
      child_id: children.A,
      payer_name: 'Mẹ A',
      amount: 200_000,
      method: 'cash',
      account_id: accounts.cash,
      category_id: categories.income,
      receipt_date: vietnamToday,
      allocations: [],
    });
    assert.equal(openReceipt.status, 201, JSON.stringify(openReceipt.body));
    assert.equal(
      (
        await api('POST', '/bank-transactions', token('accountantB'), {
          account_id: accounts.bankB,
          transaction_date: previousDate,
          amount: 10_000,
          description: 'Lãi',
        })
      ).status,
      201,
    );
  });
});

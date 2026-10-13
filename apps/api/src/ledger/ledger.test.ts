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

// Sổ kế toán kép (DT-11 phần 11c, YCTD-88); kịch bản đề xuất CT-229 đến CT-235
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const currentMonth = vietnamToday.slice(0, 7);
const previousMonth = addDays(`${currentMonth}-01`, -1).slice(0, 7);
const previousDate = `${previousMonth}-15`;

interface EntryLine {
  account_code: string;
  debit: number;
  credit: number;
}
interface Entry {
  id: string;
  code: string;
  source_type: string | null;
  source_id: string | null;
  entry_type: string;
  status: string;
  total_amount: number;
  lines: EntryLine[];
}
interface TrialRow {
  account_code: string;
  level: number;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

describe('Sổ kế toán kép: tài khoản, quy tắc ghi sổ, bút toán, sổ và báo cáo', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const ids: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  const from = addDays(vietnamToday, -70);

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const unitA = () => units['ĐT-A1'] ?? '';
  const journal = async (unit = unitA()) => {
    const result = await api(
      'GET',
      `/ledger/entries?org_unit_id=${unit}&from=${from}&to=${vietnamToday}`,
      token('chief'),
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body as unknown as { entries: Entry[]; totals: { debit: number; credit: number } };
  };
  const entryOf = (entries: Entry[], sourceType: string, sourceId: string) =>
    entries.find((entry) => entry.source_type === sourceType && entry.source_id === sourceId);
  const sides = (entry: Entry | undefined) =>
    (entry?.lines ?? []).map(
      (line) => `${line.debit > 0 ? 'N' : 'C'}${line.account_code}:${line.debit || line.credit}`,
    );

  async function insertReceipt(amount: number, accountKey: string, categoryKey: string) {
    return (
      await schoolYear
        .insertInto('receipts')
        .values({
          code: `PT-9${String(Math.floor(Math.random() * 99_999)).padStart(5, '0')}`,
          org_unit_id: unitA(),
          child_id: ids.child ?? '',
          payer_name: 'Mẹ A',
          amount,
          method: accountKey === 'cash' ? 'cash' : 'transfer',
          account_id: ids[accountKey] ?? '',
          category_id: ids[categoryKey] ?? '',
          receipt_date: vietnamToday,
          content: 'Thu học phí',
          request_key: randomUUID(),
          created_by: users.accountantA?.userId ?? '',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    users.chief = await environment.loginAs('VT-05', units.TC ?? null);
    users.accountantA = await environment.loginAs('VT-04', unitA());
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    users.teacher = await environment.loginAs('VT-07', unitA());

    for (const row of await schoolYear.selectFrom('ledger_accounts').select(['id', 'code']).execute()) {
      accounts[row.code] = row.id;
    }
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitA(),
        full_name: 'Trẻ A',
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
    ids.child = child.id;
    for (const [key, flow] of [
      ['income', 'income'],
      ['donation', 'income'],
      ['expense', 'expense'],
    ] as const) {
      ids[key] = (
        await schoolYear
          .insertInto('cashflow_categories')
          .values({ code: `KM-${key}`, name: `Khoản ${key}`, group_name: 'Chung', flow_type: flow })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, type] of [
      ['cash', 'cash'],
      ['bank', 'bank'],
    ] as const) {
      ids[key] = (
        await schoolYear
          .insertInto('cash_accounts')
          .values({
            org_unit_id: unitA(),
            account_type: type,
            name: `Quỹ ${key}`,
            bank_name: type === 'bank' ? 'VCB' : null,
            account_number: type === 'bank' ? '0011' : null,
            opening_balance: 0,
            current_balance: 0,
            created_by: users.accountantA?.userId ?? '',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    // Hóa đơn 1 000 000, phiếu thu 600 000 tiền mặt, miễn giảm 100 000, phiếu chi 200 000 qua ngân hàng, đảo 50 000
    ids.invoice = (
      await schoolYear
        .insertInto('invoices')
        .values({
          code: 'HD-900001',
          child_id: child.id,
          org_unit_id: unitA(),
          period_year: Number(currentMonth.slice(0, 4)),
          period_month: Number(currentMonth.slice(5, 7)),
          invoice_kind: 'main',
          status: 'issued',
          total_amount: 1_000_000,
          basis: JSON.stringify({}),
          due_date: vietnamToday,
          issued_at: new Date(),
          issued_by: principal.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    ids.receipt = await insertReceipt(600_000, 'cash', 'income');
    const discountType = await schoolYear
      .insertInto('discount_types')
      .values({
        code: 'MG',
        name: 'Miễn giảm',
        calculation_method: 'amount',
        value: 100_000,
        applies_to: JSON.stringify(['tuition']),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.discount = (
      await schoolYear
        .insertInto('discounts')
        .values({
          invoice_id: ids.invoice,
          child_id: child.id,
          org_unit_id: unitA(),
          discount_type_id: discountType.id,
          basis: 'Hộ nghèo',
          calculation_method: 'amount',
          rate_value: 100_000,
          base_amount: 1_000_000,
          applied_amount: 100_000,
          status: 'approved',
          requires_principal: false,
          created_by: users.accountantA?.userId ?? '',
          decided_by: principal.userId,
          decided_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    ids.payment = (
      await schoolYear
        .insertInto('payments')
        .values({
          code: 'PC-900001',
          org_unit_id: unitA(),
          payment_type: 'regular',
          payee_name: 'Công ty Văn phòng phẩm An',
          amount: 200_000,
          content: 'Mua văn phòng phẩm',
          account_id: ids.bank ?? '',
          category_id: ids.expense ?? '',
          payment_date: vietnamToday,
          status: 'issued',
          requires_principal: false,
          request_key: randomUUID(),
          created_by: users.accountantA?.userId ?? '',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    ids.reversal = (
      await schoolYear
        .insertInto('receipt_reversals')
        .values({
          code: 'DPT-900001',
          receipt_id: ids.receipt,
          org_unit_id: unitA(),
          child_id: child.id,
          amount: 50_000,
          reason: 'Thu thừa',
          status: 'approved',
          requires_principal: false,
          created_by: users.accountantA?.userId ?? '',
          decided_by: principal.userId,
          decided_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    // Bảng lương đã duyệt: thu nhập 5 000 000, khấu trừ 500 000, thuế 100 000
    const staff = await schoolYear
      .insertInto('staff')
      .values({ org_unit_id: unitA(), code: 'NS-01', full_name: 'Cô Lan', start_date: addDays(vietnamToday, -300) })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.payroll = (
      await schoolYear
        .insertInto('payrolls')
        .values({
          period_year: Number(currentMonth.slice(0, 4)),
          period_month: Number(currentMonth.slice(5, 7)),
          status: 'approved',
          total_net: 4_400_000,
          approved_by: principal.userId,
          approved_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const payslip = await schoolYear
      .insertInto('payslips')
      .values({
        payroll_id: ids.payroll,
        staff_id: staff.id,
        org_unit_id: unitA(),
        prepaid_amount: 5_000_000,
        adjustment_amount: -600_000,
        taxable_income: 1_000_000,
        tax_amount: 100_000,
        net_amount: 4_400_000,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [order, section, type, amount] of [
      [1, 'prepaid', 'base_salary', 5_000_000],
      [2, 'adjustment', 'deduction', -500_000],
      [3, 'tax', 'tax', -100_000],
    ] as const) {
      await schoolYear
        .insertInto('payslip_lines')
        .values({
          payslip_id: payslip.id,
          section,
          line_type: type,
          code: type.toUpperCase(),
          name: type,
          amount,
          basis: '',
          order_no: order,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-229: hệ thống tài khoản khởi tạo theo chế độ hành chính, sự nghiệp; thêm tài khoản chi tiết ở Trường chính', async () => {
    const list = await api('GET', '/ledger/accounts', principal.accessToken);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const codes = (list.body.accounts as Array<{ code: string }>).map((account) => account.code);
    for (const code of ['111', '112', '131', '334', '3335', '421', '531', '642']) {
      assert.ok(codes.includes(code), code);
    }
    assert.equal(list.body.can_manage, false);
    assert.equal((await api('GET', '/ledger/accounts', token('teacher'))).status, 403);

    const forbidden = await api('POST', '/ledger/accounts', token('accountantA'), {
      parent_id: accounts['111'],
      code: '1111',
      name: 'Tiền mặt Việt Nam',
    });
    assert.equal(forbidden.status, 403);
    const wrongPrefix = await api('POST', '/ledger/accounts', token('chief'), {
      parent_id: accounts['111'],
      code: '1121',
      name: 'Sai cha',
    });
    assert.equal(wrongPrefix.status, 422);
    const created = await api('POST', '/ledger/accounts', token('chief'), {
      parent_id: accounts['111'],
      code: '1111',
      name: 'Tiền mặt Việt Nam',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    accounts['1111'] = created.body.id as string;
    const duplicate = await api('POST', '/ledger/accounts', token('chief'), {
      parent_id: accounts['111'],
      code: '1111',
      name: 'Trùng',
    });
    assert.equal(duplicate.status, 409);
    const system = await api('PATCH', `/ledger/accounts/${accounts['111']}`, token('chief'), { name: 'Đổi' });
    assert.equal(system.status, 422);
    const renamed = await api('PATCH', `/ledger/accounts/${accounts['1111']}`, token('chief'), {
      name: 'Tiền mặt tại quỹ',
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  });

  it('CT-230: ghi sổ chứng từ tự động theo quy tắc, chạy lại không ghi trùng, mỗi bút toán cân', async () => {
    const forbidden = await api('POST', '/ledger/post-documents', principal.accessToken);
    assert.equal(forbidden.status, 403);
    const posted = await api('POST', '/ledger/post-documents', token('accountantA'));
    assert.equal(posted.status, 200, JSON.stringify(posted.body));
    assert.deepEqual(posted.body.posted, {
      receipt: 1,
      payment: 1,
      receipt_reversal: 1,
      invoice: 1,
      discount: 1,
      payroll: 1,
    });
    const again = await api('POST', '/ledger/post-documents', token('chief'));
    assert.equal(again.body.total, 0);

    const { entries, totals } = await journal();
    assert.equal(totals.debit, totals.credit);
    for (const entry of entries) {
      const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
      const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
      assert.equal(debit, credit, entry.code);
      assert.match(entry.code, /^BT-\d{6}$/);
    }
    assert.deepEqual(sides(entryOf(entries, 'invoice', ids.invoice ?? '')), ['N131:1000000', 'C531:1000000']);
    assert.deepEqual(sides(entryOf(entries, 'receipt', ids.receipt ?? '')), ['N111:600000', 'C131:600000']);
    assert.deepEqual(sides(entryOf(entries, 'discount', ids.discount ?? '')), ['N531:100000', 'C131:100000']);
    assert.deepEqual(sides(entryOf(entries, 'payment', ids.payment ?? '')), ['N642:200000', 'C112:200000']);
    assert.deepEqual(sides(entryOf(entries, 'receipt_reversal', ids.reversal ?? '')), ['N131:50000', 'C111:50000']);
    assert.deepEqual(sides(entryOf(entries, 'payroll', ids.payroll ?? '')), [
      'N642:5000000',
      'C334:5000000',
      'N334:500000',
      'C332:500000',
      'N334:100000',
      'C3335:100000',
    ]);

    const trial = await api(
      'GET',
      `/ledger/reports/trial-balance?org_unit_id=${unitA()}&from=${from}&to=${vietnamToday}`,
      principal.accessToken,
    );
    assert.equal(trial.status, 200, JSON.stringify(trial.body));
    assert.equal(trial.body.balanced, true);
    const rows = trial.body.accounts as TrialRow[];
    const row = (code: string) => rows.find((item) => item.account_code === code);
    assert.equal(row('131')?.closing_debit, 350_000);
    assert.equal(row('111')?.closing_debit, 550_000);
    assert.equal(row('112')?.closing_credit, 200_000);
    assert.equal(row('334')?.closing_credit, 4_400_000);
    assert.equal(row('333')?.closing_credit, 100_000);
    assert.equal(row('3335')?.level, 2);
    const unitB = await api(
      'GET',
      `/ledger/reports/trial-balance?org_unit_id=${units['ĐT-B1']}&from=${from}&to=${vietnamToday}`,
      principal.accessToken,
    );
    assert.equal((unitB.body.accounts as TrialRow[]).length, 0);
    const outOfScope = await api(
      'GET',
      `/ledger/reports/trial-balance?org_unit_id=${unitA()}&from=${from}&to=${vietnamToday}`,
      token('accountantB'),
    );
    assert.equal(outOfScope.status, 403);
  });

  it('CT-231: quy tắc ghi sổ theo khoản mục thu chi áp dụng cho chứng từ ghi sổ sau đó', async () => {
    const invalid = await api('PUT', '/ledger/posting-rules', token('chief'), {
      document_type: 'payment',
      debit_account_id: accounts['611'],
      credit_account_id: accounts['111'],
    });
    assert.equal(invalid.status, 400);
    const notByCategory = await api('PUT', '/ledger/posting-rules', token('chief'), {
      document_type: 'invoice',
      category_id: ids.donation,
      debit_account_id: accounts['131'],
      credit_account_id: accounts['531'],
    });
    assert.equal(notByCategory.status, 400);
    const forbidden = await api('PUT', '/ledger/posting-rules', token('accountantA'), {
      document_type: 'receipt',
      category_id: ids.donation,
      credit_account_id: accounts['3371'],
    });
    assert.equal(forbidden.status, 403);
    const saved = await api('PUT', '/ledger/posting-rules', token('chief'), {
      document_type: 'receipt',
      category_id: ids.donation,
      credit_account_id: accounts['3371'],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const cash = await api('PUT', '/ledger/posting-rules', token('chief'), {
      document_type: 'money_cash',
      debit_account_id: accounts['1111'],
    });
    assert.equal(cash.status, 200, JSON.stringify(cash.body));

    const donation = await insertReceipt(300_000, 'cash', 'donation');
    const { entries } = await journal();
    assert.deepEqual(sides(entryOf(entries, 'receipt', donation)), ['N1111:300000', 'C3371:300000']);
    // Bút toán đã ghi không đổi theo quy tắc mới
    assert.deepEqual(sides(entryOf(entries, 'receipt', ids.receipt ?? '')), ['N111:600000', 'C131:600000']);

    const deactivate = await api('PATCH', `/ledger/accounts/${accounts['1111']}`, token('chief'), {
      status: 'inactive',
    });
    assert.equal(deactivate.status, 422);
    const rules = await api('GET', '/ledger/posting-rules', principal.accessToken);
    const override = (
      rules.body.rules as Array<{ id: string; category_id: string | null; document_type: string }>
    ).find((rule) => rule.document_type === 'receipt' && rule.category_id === ids.donation);
    const general = (rules.body.rules as Array<{ id: string; category_id: string | null; document_type: string }>).find(
      (rule) => rule.document_type === 'receipt' && rule.category_id === null,
    );
    assert.equal((await api('DELETE', `/ledger/posting-rules/${general?.id}`, token('chief'))).status, 422);
    assert.equal((await api('DELETE', `/ledger/posting-rules/${override?.id}`, token('chief'))).status, 200);
  });

  it('CT-232: bút toán thủ công phải cân, theo phạm vi đơn vị, hủy kèm lý do; bút toán tự động không hủy', async () => {
    const unbalanced = await api('POST', '/ledger/entries', token('accountantA'), {
      org_unit_id: unitA(),
      entry_date: vietnamToday,
      description: 'Trích khấu hao',
      lines: [
        { account_id: accounts['642'], debit: 300_000 },
        { account_id: accounts['214'], credit: 200_000 },
      ],
    });
    assert.equal(unbalanced.status, 400);
    const bothSides = await api('POST', '/ledger/entries', token('accountantA'), {
      org_unit_id: unitA(),
      entry_date: vietnamToday,
      description: 'Sai dòng',
      lines: [
        { account_id: accounts['642'], debit: 300_000, credit: 300_000 },
        { account_id: accounts['214'], credit: 300_000 },
      ],
    });
    assert.equal(bothSides.status, 400);
    const future = await api('POST', '/ledger/entries', token('accountantA'), {
      org_unit_id: unitA(),
      entry_date: addDays(vietnamToday, 1),
      description: 'Ngày sau',
      lines: [
        { account_id: accounts['642'], debit: 300_000 },
        { account_id: accounts['214'], credit: 300_000 },
      ],
    });
    assert.equal(future.status, 400);
    const otherUnit = await api('POST', '/ledger/entries', token('accountantB'), {
      org_unit_id: unitA(),
      entry_date: vietnamToday,
      description: 'Trích khấu hao',
      lines: [
        { account_id: accounts['642'], debit: 300_000 },
        { account_id: accounts['214'], credit: 300_000 },
      ],
    });
    assert.equal(otherUnit.status, 403);
    const requestKey = randomUUID();
    const body = {
      org_unit_id: unitA(),
      entry_date: vietnamToday,
      description: 'Trích khấu hao tháng',
      request_key: requestKey,
      lines: [
        { account_id: accounts['642'], debit: 300_000, description: 'Khấu hao máy lạnh' },
        { account_id: accounts['214'], credit: 300_000 },
      ],
    };
    const created = await api('POST', '/ledger/entries', token('accountantA'), body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.entry_type, 'manual');
    assert.equal(created.body.total_amount, 300_000);
    const repeated = await api('POST', '/ledger/entries', token('accountantA'), body);
    assert.equal(repeated.body.id, created.body.id);

    const noReason = await api('POST', `/ledger/entries/${created.body.id}/void`, token('accountantA'), {});
    assert.equal(noReason.status, 400);
    const voided = await api('POST', `/ledger/entries/${created.body.id}/void`, token('accountantA'), {
      reason: 'Ghi nhầm số tiền',
    });
    assert.equal(voided.status, 200, JSON.stringify(voided.body));
    assert.equal(voided.body.status, 'voided');
    const twice = await api('POST', `/ledger/entries/${created.body.id}/void`, token('accountantA'), {
      reason: 'Lần hai',
    });
    assert.equal(twice.status, 409);
    const { entries } = await journal();
    const auto = entryOf(entries, 'invoice', ids.invoice ?? '');
    const autoVoid = await api('POST', `/ledger/entries/${auto?.id}/void`, token('chief'), { reason: 'Thử' });
    assert.equal(autoVoid.status, 409);
    const trial = await api(
      'GET',
      `/ledger/reports/trial-balance?org_unit_id=${unitA()}&from=${from}&to=${vietnamToday}`,
      token('chief'),
    );
    const rows = trial.body.accounts as TrialRow[];
    assert.equal(
      rows.find((row) => row.account_code === '214'),
      undefined,
      'Bút toán đã hủy không vào báo cáo',
    );
  });

  it('CT-233: kỳ tài chính đã chốt khóa ghi và hủy bút toán thủ công có ngày thuộc kỳ (BR-95)', async () => {
    const before = await api('POST', '/ledger/entries', token('chief'), {
      org_unit_id: unitA(),
      entry_date: previousDate,
      description: 'Tạm ứng',
      lines: [
        { account_id: accounts['141'], debit: 1_000_000 },
        { account_id: accounts['1111'], credit: 1_000_000 },
      ],
    });
    assert.equal(before.status, 201, JSON.stringify(before.body));
    await schoolYear
      .insertInto('fiscal_periods')
      .values({
        org_unit_id: unitA(),
        period_year: Number(previousMonth.slice(0, 4)),
        period_month: Number(previousMonth.slice(5, 7)),
        status: 'closed',
        summary: JSON.stringify({}),
        close_requested_by: users.chief?.userId ?? '',
        closed_by: principal.userId,
        closed_at: new Date(),
      })
      .execute();
    const blocked = await api('POST', '/ledger/entries', token('chief'), {
      org_unit_id: unitA(),
      entry_date: previousDate,
      description: 'Tạm ứng',
      lines: [
        { account_id: accounts['141'], debit: 1_000_000 },
        { account_id: accounts['1111'], credit: 1_000_000 },
      ],
    });
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'BR-95');
    const voidBlocked = await api('POST', `/ledger/entries/${before.body.id}/void`, token('chief'), {
      reason: 'Hủy',
    });
    assert.equal(voidBlocked.status, 422);
    assert.equal(errorOf(voidBlocked.body).rule_code, 'BR-95');
  });

  it('CT-234: sổ cái gồm tài khoản chi tiết, có tài khoản đối ứng và số dư; xuất Excel bảng cân đối', async () => {
    const ledger = await api(
      'GET',
      `/ledger/reports/general-ledger?account_id=${accounts['111']}&org_unit_id=${unitA()}&from=${vietnamToday}&to=${vietnamToday}`,
      token('chief'),
    );
    assert.equal(ledger.status, 200, JSON.stringify(ledger.body));
    const totals = ledger.body.totals as Record<string, number>;
    // Số dư đầu: tạm ứng ngày tháng trước làm quỹ âm 1 000 000
    assert.equal(totals.opening_credit, 1_000_000);
    assert.equal(totals.period_debit, 900_000);
    assert.equal(totals.period_credit, 50_000);
    assert.equal(totals.closing_debit, 0);
    assert.equal(totals.closing_credit, 150_000);
    const lines = ledger.body.lines as Array<{ account_code: string; counterpart_accounts: string }>;
    assert.ok(lines.some((line) => line.account_code === '1111' && line.counterpart_accounts === '3371'));
    assert.ok(lines.some((line) => line.counterpart_accounts === '131'));
    const missing = await api(
      'GET',
      `/ledger/reports/general-ledger?org_unit_id=${unitA()}&from=${vietnamToday}&to=${vietnamToday}`,
      token('chief'),
    );
    assert.equal(missing.status, 400);

    const whole = await api(
      'GET',
      `/ledger/reports/trial-balance?from=${from}&to=${vietnamToday}`,
      principal.accessToken,
    );
    assert.equal(whole.status, 200);
    assert.equal(whole.body.balanced, true);

    const response = await fetch(`${environment.baseUrl}/reports/ledger-trial-balance/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token('accountantA')}` },
      body: JSON.stringify({ org_unit_id: unitA(), from, to: vietnamToday }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    const outside = await fetch(`${environment.baseUrl}/reports/ledger-journal/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token('accountantB')}` },
      body: JSON.stringify({ org_unit_id: unitA(), from, to: vietnamToday }),
    });
    assert.equal(outside.status, 403);
  });

  it('CT-235: mở năm học mới chuyển tài khoản, quy tắc và số dư cuối thành số dư đầu năm', async () => {
    const newYearId = (await api('POST', '/academic-years', principal.accessToken, { name: '2027–2028' })).body
      .id as string;
    const saved = await api('PUT', `/academic-years/${newYearId}/calendar`, principal.accessToken, {
      first_term: { start_date: addDays(vietnamToday, 210), end_date: addDays(vietnamToday, 330) },
      second_term: { start_date: addDays(vietnamToday, 335), end_date: addDays(vietnamToday, 450) },
      summer_term: null,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const opened = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', newYearId)
      .executeTakeFirstOrThrow();
    const newYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    try {
      const sub = await newYear
        .selectFrom('ledger_accounts')
        .select(['id', 'code'])
        .where('code', '=', '1111')
        .executeTakeFirst();
      assert.equal(sub?.id, accounts['1111']);
      const cashRule = await newYear
        .selectFrom('ledger_posting_rules')
        .select('debit_account_id')
        .where('document_type', '=', 'money_cash')
        .executeTakeFirstOrThrow();
      assert.equal(cashRule.debit_account_id, accounts['1111']);
      const opening = await newYear
        .selectFrom('journal_entries')
        .selectAll()
        .where('entry_type', '=', 'opening')
        .where('org_unit_id', '=', unitA())
        .executeTakeFirstOrThrow();
      const lines = await newYear
        .selectFrom('journal_lines')
        .innerJoin('ledger_accounts', 'ledger_accounts.id', 'journal_lines.account_id')
        .select(['ledger_accounts.code', 'journal_lines.debit', 'journal_lines.credit'])
        .where('journal_lines.entry_id', '=', opening.id)
        .execute();
      const net = (code: string) =>
        lines
          .filter((line) => line.code === code)
          .reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0);
      assert.equal(
        lines.reduce((total, line) => total + Number(line.debit), 0),
        lines.reduce((total, line) => total + Number(line.credit), 0),
      );
      assert.equal(net('131'), 350_000);
      assert.equal(net('3371'), -300_000);
      assert.ok(
        lines.every((line) => !/^[5-9]/.test(line.code)),
        'Doanh thu, chi phí kết chuyển vào 421',
      );
      // Doanh thu 900 000 trừ chi phí 200 000 + 5 000 000 = thâm hụt 4 300 000
      assert.equal(net('421'), 4_300_000);
      // Hóa đơn công nợ chuyển năm của trẻ không ghi sổ lần nữa
      assert.equal(opening.entry_date, addDays(vietnamToday, 210));
    } finally {
      await newYear.destroy();
    }
  });
});

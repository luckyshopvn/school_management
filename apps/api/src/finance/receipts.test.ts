import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Quỹ và tài khoản, phiếu thu, phân bổ, số dư có và công nợ; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md
// mục 3 và 03_P05.md mục P05-09. Hóa đơn ghi sẵn: HĐ-1 của T1 1 000 000, HĐ-2 của T1 2 000 000 đã quá hạn,
// HĐ-3 của T2 1 500 000, HĐ-B của T3 ở đơn vị B
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

type DebtView = {
  outstanding_amount: number;
  credit_amount: number;
  balance_amount: number;
  overdue_amount: number;
  invoices: Array<{ id: string; outstanding_amount: number; paid_amount: number; payment_status: string }>;
};

describe('Phiếu thu, phân bổ và công nợ', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const invoices: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  const categories: Record<string, string> = {};
  const parentPhone = randomPhone();
  let parentToken = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const receipt = (
    accessToken: string,
    input: {
      child: string;
      amount: number;
      allocations?: Array<[string, number]>;
      method?: string;
      account?: string;
      category?: string | null;
      requestKey?: string;
      date?: string;
    },
  ) =>
    api('POST', '/receipts', accessToken, {
      request_key: input.requestKey ?? randomUUID(),
      child_id: children[input.child],
      payer_name: `Mẹ ${input.child}`,
      amount: input.amount,
      method: input.method ?? 'cash',
      account_id: accounts[input.account ?? 'QUY-A'],
      ...(input.category === null ? {} : { category_id: categories[input.category ?? 'THU_HOC_PHI'] }),
      receipt_date: input.date ?? vietnamToday,
      allocations: (input.allocations ?? []).map(([invoice, amount]) => ({ invoice_id: invoices[invoice], amount })),
    });
  const debt = async (child: string, accessToken = token('accountant')) =>
    (await api('GET', `/children/${children[child]}/debt`, accessToken)).body as unknown as DebtView;
  const balance = async (account: string) =>
    Number(
      (
        await schoolYear
          .selectFrom('cash_accounts')
          .select('current_balance')
          .where('id', '=', accounts[account] ?? '')
          .executeTakeFirstOrThrow()
      ).current_balance,
    );

  async function seedInvoice(child: string, unit: string, amount: number, dueDate: string): Promise<string> {
    const invoice = await schoolYear
      .insertInto('invoices')
      .values({
        code: `HD-${randomInt(100_000, 999_999)}`,
        child_id: children[child] ?? '',
        org_unit_id: units[unit] ?? '',
        period_year: 2026,
        period_month: 10,
        invoice_kind: 'supplementary',
        status: 'issued',
        total_amount: amount,
        basis: JSON.stringify({}),
        review_flags: JSON.stringify([]),
        due_date: dueDate,
        issued_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('invoice_items')
      .values({
        invoice_id: invoice.id,
        item_type: 'tuition',
        service_id: null,
        description: 'Học phí chính khóa',
        quantity: 1,
        unit_price: amount,
        amount,
      })
      .execute();
    return invoice.id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const [code, unit] of [
      ['L-A1', 'ĐT-A1'],
      ['L-B1', 'ĐT-B1'],
    ] as const) {
      await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name: code,
        grade_level: 'MAM',
        max_size: 25,
      });
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.cashier = await environment.loginAs('VT-16', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);

    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, [name, unit, classCode]] of [
      ['T1', 'ĐT-A1', 'L-A1'],
      ['T2', 'ĐT-A1', 'L-A1'],
      ['T3', 'ĐT-B1', 'L-B1'],
    ].entries()) {
      const row: Record<string, string> = {
        unit_code: unit ?? '',
        class_code: classCode ?? '',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `086${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: '2026-09-01',
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: name === 'T1' ? parentPhone : randomPhone(),
      };
      worksheet.addRow(IMPORT_COLUMNS.children.map((column) => row[column.key] ?? ''));
    }
    const form = new FormData();
    form.set('type', 'children');
    form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'tre.xlsx');
    const uploaded = (await (
      await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string; status: string };
    assert.equal(uploaded.status, 'validated', JSON.stringify(uploaded));
    assert.equal((await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken)).status, 200);
    for (const row of await schoolYear.selectFrom('children').select(['id', 'full_name']).execute()) {
      children[row.full_name.replace('Trẻ ', '')] = row.id;
    }
    await environment.identity.database
      .updateTable('users')
      .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
      .where('phone', '=', parentPhone)
      .execute();
    parentToken = (
      await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
        login: parentPhone,
        password: TEST_PASSWORD,
        channel: 'parent',
      })
    ).body.access_token as string;

    for (const [code, flowType] of [
      ['THU_HOC_PHI', 'income'],
      ['MUA_NGUYEN_LIEU', 'expense'],
    ] as const) {
      categories[code] = (
        await api('POST', '/cashflow-categories', token('accountant'), {
          code,
          name: code,
          group_name: 'Hoạt động thường xuyên',
          flow_type: flowType,
        })
      ).body.id as string;
    }
    invoices['HĐ-1'] = await seedInvoice('T1', 'ĐT-A1', 1_000_000, '2099-12-31');
    invoices['HĐ-2'] = await seedInvoice('T1', 'ĐT-A1', 2_000_000, '2026-01-10');
    invoices['HĐ-3'] = await seedInvoice('T2', 'ĐT-A1', 1_500_000, '2099-12-31');
    invoices['HĐ-B'] = await seedInvoice('T3', 'ĐT-B1', 1_000_000, '2099-12-31');
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P06-05 Quỹ và tài khoản ngân hàng', () => {
    it('kế toán khai báo quỹ tiền mặt và tài khoản ngân hàng; số dư hiện tại bằng số dư đầu', async () => {
      const cash = await api('POST', '/cash-accounts', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        account_type: 'cash',
        name: 'QUY-A',
        opening_balance: 500_000,
      });
      assert.equal(cash.status, 201, JSON.stringify(cash.body));
      assert.equal(cash.body.current_balance, 500_000);
      accounts['QUY-A'] = cash.body.id as string;
      const bank = await api('POST', '/cash-accounts', token('chiefAccountant'), {
        org_unit_id: units['ĐT-A1'],
        account_type: 'bank',
        name: 'NH-A',
        bank_name: 'Ngân hàng A',
        account_number: '0123456789',
      });
      assert.equal(bank.status, 201, JSON.stringify(bank.body));
      accounts['NH-A'] = bank.body.id as string;
      const missingBank = await api('POST', '/cash-accounts', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        account_type: 'bank',
        name: 'NH-thiếu',
      });
      assert.equal(missingBank.status, 400);
      const duplicate = await api('POST', '/cash-accounts', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        account_type: 'cash',
        name: 'QUY-A',
      });
      assert.equal(duplicate.status, 409);
      accounts['QUY-B'] = (
        await api('POST', '/cash-accounts', token('accountantB'), {
          org_unit_id: units['ĐT-B1'],
          account_type: 'cash',
          name: 'QUY-B',
        })
      ).body.id as string;
    });

    it('quản lý đơn vị và thủ quỹ không khai báo được; thủ quỹ xem được, giáo viên bị từ chối', async () => {
      for (const name of ['manager', 'cashier']) {
        const response = await api('POST', '/cash-accounts', token(name), {
          org_unit_id: units['ĐT-A1'],
          account_type: 'cash',
          name: `QUY-${name}`,
        });
        assert.equal(response.status, 403, name);
      }
      const listed = await api('GET', `/cash-accounts?org_unit_id=${units['ĐT-A1']}`, token('cashier'));
      assert.equal(listed.status, 200);
      assert.deepEqual(
        (listed.body as unknown as Array<{ name: string }>).map((row) => row.name),
        ['NH-A', 'QUY-A'],
      );
      assert.equal((await api('GET', `/cash-accounts?org_unit_id=${units['ĐT-A1']}`, token('teacher'))).status, 403);
      assert.equal((await api('GET', `/cash-accounts?org_unit_id=${units['ĐT-B1']}`, token('accountant'))).status, 403);
    });
  });

  describe('P06-01, P06-02 Phiếu thu và phân bổ', () => {
    it('CTC-P06-004: phiếu thu 1 000 000 phân bổ tổng 1 200 000 bị từ chối', async () => {
      const response = await receipt(token('accountant'), {
        child: 'T1',
        amount: 1_000_000,
        allocations: [
          ['HĐ-1', 1_000_000],
          ['HĐ-2', 200_000],
        ],
      });
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-31');
    });

    it('CTC-P06-003: thu 1 000 000 cho hóa đơn còn 2 000 000 bị từ chối vì không nhận thanh toán một phần', async () => {
      const response = await receipt(token('accountant'), {
        child: 'T1',
        amount: 1_000_000,
        allocations: [['HĐ-2', 1_000_000]],
      });
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-31');
    });

    it('CTC-P06-006: một phiếu thu chọn hóa đơn của hai trẻ bị từ chối', async () => {
      const response = await receipt(token('accountant'), {
        child: 'T1',
        amount: 2_500_000,
        allocations: [
          ['HĐ-1', 1_000_000],
          ['HĐ-3', 1_500_000],
        ],
      });
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-31');
    });

    it('CTC-P06-010: không chọn khoản mục, khoản mục chi, tài khoản sai loại hoặc ngày thu sau hôm nay trả ERR_VALIDATION', async () => {
      const tomorrow = new Date(Date.parse(`${vietnamToday}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      for (const input of [
        { category: null },
        { category: 'MUA_NGUYEN_LIEU' },
        { account: 'NH-A' },
        { account: 'QUY-B' },
        { date: tomorrow },
      ]) {
        const response = await receipt(token('accountant'), { child: 'T1', amount: 100_000, ...input });
        assert.equal(response.status, 400, JSON.stringify(input));
      }
    });

    it('CTC-P06-001, CTC-P06-017: thu tiền mặt 1 000 000 cho HĐ-1 thì HĐ-1 đã thu đủ, công nợ T1 còn 2 000 000, QUY-A tăng 1 000 000', async () => {
      const before = await balance('QUY-A');
      const response = await receipt(token('accountant'), {
        child: 'T1',
        amount: 1_000_000,
        allocations: [['HĐ-1', 1_000_000]],
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.match(response.body.code as string, /^PT-\d{6}$/);
      assert.equal(response.body.allocated_amount, 1_000_000);
      const view = await debt('T1');
      assert.equal(view.outstanding_amount, 2_000_000);
      assert.equal(view.invoices.find((invoice) => invoice.id === invoices['HĐ-1'])?.payment_status, 'paid');
      assert.equal(await balance('QUY-A'), before + 1_000_000);
      const transaction = await schoolYear
        .selectFrom('account_transactions')
        .select(['amount', 'balance_after'])
        .where('reference_id', '=', response.body.id as string)
        .executeTakeFirstOrThrow();
      assert.equal(Number(transaction.amount), 1_000_000);
      assert.equal(Number(transaction.balance_after), before + 1_000_000);
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select(['actor_user_id', 'after_data'])
        .where('entity_name', '=', 'receipts')
        .where('entity_id', '=', response.body.id as string)
        .executeTakeFirstOrThrow();
      assert.equal(audit.actor_user_id, users.accountant?.userId);
      const templates = (
        await schoolYear
          .selectFrom('notifications')
          .select('template_code')
          .where('target_id', 'in', [response.body.id as string, invoices['HĐ-1'] ?? ''])
          .execute()
      ).map((row) => row.template_code);
      assert.deepEqual(templates.sort(), ['invoice_settled', 'receipt_issued']);
    });

    it('CTC-P06-009: gửi hai lần cùng mã yêu cầu chỉ tạo một phiếu', async () => {
      const requestKey = randomUUID();
      const first = await receipt(token('accountant'), { child: 'T2', amount: 100_000, requestKey });
      const second = await receipt(token('accountant'), { child: 'T2', amount: 100_000, requestKey });
      assert.equal(first.status, 201);
      assert.equal(second.body.id, first.body.id);
      const count = await schoolYear
        .selectFrom('receipts')
        .select((expression) => expression.fn.countAll<string>().as('total'))
        .where('request_key', '=', requestKey)
        .executeTakeFirstOrThrow();
      assert.equal(Number(count.total), 1);
    });

    it('CTC-P06-012, CTC-P06-011: thủ quỹ lập phiếu chuyển khoản bị từ chối; thu tiền mặt cho HĐ-3 được', async () => {
      const transfer = await receipt(token('cashier'), {
        child: 'T2',
        amount: 1_500_000,
        method: 'transfer',
        account: 'NH-A',
        allocations: [['HĐ-3', 1_500_000]],
      });
      assert.equal(transfer.status, 403);
      const cash = await receipt(token('cashier'), {
        child: 'T2',
        amount: 1_500_000,
        allocations: [['HĐ-3', 1_500_000]],
      });
      assert.equal(cash.status, 201, JSON.stringify(cash.body));
      const view = await debt('T2');
      assert.equal(view.invoices[0]?.payment_status, 'paid');
    });

    it('chuyển khoản vào tài khoản ngân hàng không làm đổi quỹ tiền mặt', async () => {
      const cashBefore = await balance('QUY-A');
      const bankBefore = await balance('NH-A');
      const response = await receipt(token('accountant'), {
        child: 'T2',
        amount: 300_000,
        method: 'transfer',
        account: 'NH-A',
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(await balance('QUY-A'), cashBefore);
      assert.equal(await balance('NH-A'), bankBefore + 300_000);
    });

    it('CTC-P06-013: kế toán đơn vị A lập phiếu thu cho trẻ đơn vị B bị từ chối ở máy chủ', async () => {
      const response = await receipt(token('accountant'), {
        child: 'T3',
        amount: 1_000_000,
        account: 'QUY-B',
        allocations: [['HĐ-B', 1_000_000]],
      });
      assert.equal(response.status, 403);
    });

    it('CTC-P06-014, CTC-P05-062: giáo viên xem danh sách phiếu thu và công nợ bị từ chối', async () => {
      assert.equal((await api('GET', '/receipts', token('teacher'))).status, 403);
      assert.equal((await api('GET', `/debts?org_unit_id=${units['ĐT-A1']}`, token('teacher'))).status, 403);
      assert.equal((await api('GET', `/children/${children.T1}/debt`, token('teacher'))).status, 403);
    });

    it('CTC-P06-018: xóa phiếu thu đã phát hành bị từ chối, yêu cầu lập phiếu đảo', async () => {
      const listed = await api('GET', `/receipts?child_id=${children.T1}`, token('accountant'));
      const first = (listed.body as unknown as Array<{ id: string }>)[0];
      const response = await api('DELETE', `/receipts/${first?.id}`, token('accountant'));
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-29');
    });

    it('CTC-P06-007, CTC-P06-008: phát hành đồng thời 20 phiếu thu thì số phiếu không trùng', async () => {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => receipt(token('accountant'), { child: 'T2', amount: 10_000 })),
      );
      assert.ok(responses.every((response) => response.status === 201));
      const codes = responses.map((response) => response.body.code as string);
      assert.equal(new Set(codes).size, 20);
    });
  });

  describe('Số dư có của trẻ (QT-04 E4, GD-27)', () => {
    it('CTC-P06-005: thu 2 500 000 cho HĐ-2 thì 500 000 thành số dư có; dùng số dư có thanh toán hóa đơn kỳ sau', async () => {
      const response = await receipt(token('accountant'), {
        child: 'T1',
        amount: 2_500_000,
        allocations: [['HĐ-2', 2_000_000]],
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      let view = await debt('T1');
      assert.equal(view.outstanding_amount, 0);
      assert.equal(view.credit_amount, 500_000);
      assert.equal(view.balance_amount, -500_000);

      invoices['HĐ-4'] = await seedInvoice('T1', 'ĐT-A1', 400_000, '2099-12-31');
      const partial = await api('POST', `/children/${children.T1}/credit-allocations`, token('accountant'), {
        allocations: [{ invoice_id: invoices['HĐ-4'], amount: 300_000 }],
      });
      assert.equal(partial.status, 422);
      const allocated = await api('POST', `/children/${children.T1}/credit-allocations`, token('accountant'), {
        allocations: [{ invoice_id: invoices['HĐ-4'], amount: 400_000 }],
      });
      assert.equal(allocated.status, 201, JSON.stringify(allocated.body));
      view = await debt('T1');
      assert.equal(view.credit_amount, 100_000);
      assert.equal(view.invoices.find((invoice) => invoice.id === invoices['HĐ-4'])?.payment_status, 'paid');
    });

    it('miễn giảm trên hóa đơn đã thu đủ bị chặn, cần đảo phiếu thu trước', async () => {
      const type = await api('POST', '/discount-types', token('accountant'), {
        code: 'GIAM_THU',
        name: 'Giảm thử',
        calculation_method: 'amount',
        value: 100_000,
        applies_to: ['tuition'],
      });
      const response = await api('POST', `/invoices/${invoices['HĐ-1']}/discounts`, token('accountant'), {
        discount_type_id: type.body.id,
        basis: 'Thử',
      });
      assert.equal(response.status, 422);
      assert.equal(errorOf(response.body).rule_code, 'BR-22');
    });
  });

  describe('P05-09 Công nợ của trẻ', () => {
    it('danh sách công nợ của đơn vị có số phải thu, đã thu, còn lại và lọc theo quá hạn', async () => {
      invoices['HĐ-5'] = await seedInvoice('T2', 'ĐT-A1', 700_000, '2026-02-01');
      const listed = await api('GET', `/debts?org_unit_id=${units['ĐT-A1']}`, token('manager'));
      assert.equal(listed.status, 200, JSON.stringify(listed.body));
      const rows = listed.body as unknown as Array<{
        id: string;
        outstanding_amount: number;
        overdue_amount: number;
        overdue_days: number;
      }>;
      assert.equal(rows.find((row) => row.id === children.T1)?.outstanding_amount, 0);
      const t2 = rows.find((row) => row.id === children.T2);
      assert.equal(t2?.outstanding_amount, 700_000);
      assert.equal(t2?.overdue_amount, 700_000);
      assert.ok((t2?.overdue_days ?? 0) > 0);
      const overdue = await api('GET', `/debts?org_unit_id=${units['ĐT-A1']}&overdue_only=true`, token('accountant'));
      assert.deepEqual(
        (overdue.body as unknown as Array<{ id: string }>).map((row) => row.id),
        [children.T2],
      );
      assert.equal((await api('GET', `/debts?org_unit_id=${units['ĐT-B1']}`, token('manager'))).status, 403);
    });

    it('CTC-P05-061, CTC-P06-016: phụ huynh xem công nợ và phiếu thu của con mình, của trẻ khác bị từ chối', async () => {
      const own = await api('GET', `/children/${children.T1}/debt`, parentToken);
      assert.equal(own.status, 200);
      assert.equal(own.body.credit_amount, 100_000);
      const receipts = await api('GET', `/children/${children.T1}/receipts`, parentToken);
      assert.equal(receipts.status, 200);
      assert.equal((receipts.body as unknown as unknown[]).length, 2);
      assert.equal((await api('GET', `/children/${children.T2}/debt`, parentToken)).status, 403);
      assert.equal((await api('GET', `/children/${children.T2}/receipts`, parentToken)).status, 403);
      assert.equal((await api('GET', '/receipts', parentToken)).status, 403);
    });

    it('hóa đơn có số đã thu và số còn phải nộp', async () => {
      const response = await api('GET', `/invoices/${invoices['HĐ-1']}`, token('accountant'));
      assert.equal(response.body.paid_amount, 1_000_000);
      assert.equal(response.body.outstanding_amount, 0);
    });
  });
});

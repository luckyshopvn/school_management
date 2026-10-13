import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseAmount, parseCsv, parseStatementDate } from './bank-statement-file.js';
import { invoiceCodesIn } from './bank-statement-matching.js';
import { crc16, PaymentGatewayRegistry, VietQrStaticPaymentGateway, vietQrContent } from './payment-gateway.js';

// Nhập tệp sao kê, đối soát tự động, đề xuất lập phiếu thu và nhiều cổng thanh toán (DT-11 phần 11d, G3-05, YCTD-89);
// kịch bản đề xuất CT-222 đến CT-227
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dmy = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

type Line = {
  id: string;
  bank_reference: string | null;
  status: string;
  matched_transaction_id: string | null;
  suggested_invoice_id: string | null;
  suggested_invoice_code: string | null;
};
type ImportResult = {
  id: string;
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  auto_matched_count: number;
  suggested_count: number;
  errors: Array<{ row: number; message: string }>;
  lines: Line[];
};

describe('Nhập sao kê ngân hàng, đối soát tự động và cổng thanh toán', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const invoices: Record<string, { id: string; code: string }> = {};
  const receipts: Record<string, { id: string; code: string }> = {};
  const accounts: Record<string, string> = {};
  let incomeCategory = '';
  let firstImport: ImportResult;
  const csvLines: string[] = [];

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const upload = async (accessToken: string, accountId: string, file: Buffer, name: string) => {
    const form = new FormData();
    form.set('account_id', accountId);
    form.set('file', new Blob([file]), name);
    const response = await fetch(`${environment.baseUrl}/bank-statement-imports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
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
  const outstanding = async (invoice: string) =>
    (await api('GET', `/invoices/${invoices[invoice]?.id}`, token('accountant'))).body.outstanding_amount as number;

  async function insertInvoice(key: string, child: string, total: number) {
    const code = `HD-${randomInt(100_000, 999_999)}`;
    const row = await schoolYear
      .insertInto('invoices')
      .values({
        code,
        child_id: children[child] ?? '',
        org_unit_id: units.A ?? '',
        period_year: Number(vietnamToday.slice(0, 4)),
        period_month: Number(vietnamToday.slice(5, 7)),
        invoice_kind: 'supplementary',
        status: 'issued',
        total_amount: total,
        basis: JSON.stringify({}),
        due_date: addDays(vietnamToday, 30),
        issued_at: new Date(),
        issued_by: principal.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    invoices[key] = { id: row.id, code };
  }

  async function issueReceipt(key: string, child: string, amount: number, date: string, invoice?: string) {
    const created = await api('POST', '/receipts', token('accountant'), {
      request_key: randomUUID(),
      child_id: children[child],
      payer_name: `Phụ huynh ${child}`,
      amount,
      method: 'transfer',
      account_id: accounts.bank,
      category_id: incomeCategory,
      receipt_date: date,
      allocations: invoice ? [{ invoice_id: invoices[invoice]?.id, amount }] : [],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    receipts[key] = { id: created.body.id as string, code: created.body.code as string };
  }

  const transactionOf = async (receipt: string) =>
    (
      await schoolYear
        .selectFrom('account_transactions')
        .select('id')
        .where('reference_type', '=', 'receipts')
        .where('reference_id', '=', receipts[receipt]?.id ?? '')
        .executeTakeFirstOrThrow()
    ).id;

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
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'ĐT-A1', 'diem_truong'],
    ] as const) {
      units[key] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    users.accountant = await environment.loginAs('VT-04', units.A ?? null);
    users.chiefAccountant = await environment.loginAs('VT-05', units.A ?? null);
    users.manager = await environment.loginAs('VT-03', units.A ?? null);
    users.schoolAccountant = await environment.loginAs('VT-04', units.TC ?? null);
    for (const key of ['A', 'B']) {
      children[key] = (
        await schoolYear
          .insertInto('children')
          .values({
            org_unit_id: units.A ?? '',
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
          .executeTakeFirstOrThrow()
      ).id;
    }
    incomeCategory = (
      await schoolYear
        .insertInto('cashflow_categories')
        .values({ code: 'KM-THU', name: 'Thu học phí', group_name: 'Chung', flow_type: 'income' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    for (const [key, unit, owner, body] of [
      ['bank', 'A', 'accountant', { account_type: 'bank', name: 'NH A', bank_name: 'VCB', account_number: '0011' }],
      [
        'school',
        'TC',
        'schoolAccountant',
        { account_type: 'bank', name: 'NH Trường', bank_name: 'VCB', account_number: '1900123456' },
      ],
    ] as const) {
      const created = await api('POST', '/cash-accounts', token(owner), {
        org_unit_id: units[unit],
        opening_balance: 0,
        ...body,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      accounts[key] = created.body.id as string;
    }
    await insertInvoice('paid', 'A', 1_000_000);
    await insertInvoice('paidB', 'B', 700_000);
    await insertInvoice('suggest', 'A', 2_000_000);
    await insertInvoice('partial', 'B', 900_000);
    await issueReceipt('r1', 'A', 1_000_000, addDays(vietnamToday, -1), 'paid');
    // Hai phiếu cùng số tiền cùng ngày: phiếu của trẻ B lập trước, phiếu ghi số dư có của trẻ A lập sau
    await issueReceipt('rB', 'B', 700_000, vietnamToday, 'paidB');
    await issueReceipt('rA', 'A', 700_000, vietnamToday);
    csvLines.push(
      '﻿Sao kê tài khoản 0011;;;;',
      'Ngày GD;Ghi có;Ghi nợ;Nội dung;Số tham chiếu',
      `${dmy(addDays(vietnamToday, -1))} 08:15;1.000.000;;Me be A nop hoc phi;FT001`,
      `${dmy(vietnamToday)};700.000;;"CK ${receipts.rA?.code.replace('-', '')}; me be A";FT002`,
      `${dmy(vietnamToday)};700.000,00;;Chuyen tien hoc phi;FT003`,
      `${dmy(vietnamToday)};;11.000;Phi quan ly tai khoan;FT004`,
      `${dmy(vietnamToday)};2.000.000;;Nop tien ${invoices.suggest?.code.replace('-', ' ')} be A;FT005`,
      `${dmy(vietnamToday)};500.000;;thanh toan ${invoices.partial?.code.replace('-', '')};FT006`,
      `${dmy(vietnamToday)};abc;;Dong loi;FT007`,
      `${dmy(addDays(vietnamToday, 1))};100;;Ngay tuong lai;FT008`,
      ';;;;',
    );
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-222: đọc số tiền, ngày, tệp CSV, mã hóa đơn trong diễn giải và mã VietQR', () => {
    assert.equal(parseAmount('1.000.000'), 1_000_000);
    assert.equal(parseAmount('1,000,000.00'), 1_000_000);
    assert.equal(parseAmount('(11,000)'), -11_000);
    assert.equal(parseAmount('-500000'), -500_000);
    assert.equal(parseAmount('1.5'), null);
    assert.equal(parseAmount(''), 0);
    assert.equal(parseStatementDate('05/10/2026 08:15:00', 'dmy'), '2026-10-05');
    assert.equal(parseStatementDate('10/05/2026', 'mdy'), '2026-10-05');
    assert.equal(parseStatementDate('2026/10/05', 'ymd'), '2026-10-05');
    assert.equal(parseStatementDate('31/02/2026', 'dmy'), null);
    assert.deepEqual(parseCsv('﻿a;b\n"x;y";"say ""hi"""\r\n'), [
      ['a', 'b'],
      ['x;y', 'say "hi"'],
    ]);
    assert.deepEqual(invoiceCodesIn('Nop HD 000123 va hd-000124, HD0001259'), ['HD-000123', 'HD-000124']);
    assert.equal(crc16('123456789'), '29B1');
    const content = vietQrContent({ bankBin: '970436', accountNumber: '0011', amount: 500_000, content: 'HD000001' });
    assert.ok(content.startsWith('000201010212'));
    assert.equal(content.slice(-4), crc16(content.slice(0, -4)));
    assert.ok(content.includes('5406500000') && content.includes('0808HD000001'));
    const registry = new PaymentGatewayRegistry([]);
    assert.equal(registry.defaultGateway.provider, 'none');
    assert.deepEqual(registry.list(), []);
    assert.equal(new PaymentGatewayRegistry([new VietQrStaticPaymentGateway()]).list()[0]?.is_default, true);
  });

  it('CT-223: kế toán lưu cấu hình cột của tài khoản; chưa có cấu hình thì không nhập; quản lý đơn vị bị từ chối', async () => {
    const file = Buffer.from(csvLines.join('\n'), 'utf8');
    const noProfile = await upload(token('accountant'), accounts.bank ?? '', file, 'sao-ke.csv');
    assert.equal(noProfile.status, 422, JSON.stringify(noProfile.body));
    assert.equal(errorOf(noProfile.body).rule_code, 'P06-06');
    const empty = await api('GET', `/bank-statement-profiles/${accounts.bank}`, token('chiefAccountant'));
    assert.equal(empty.status, 200);
    assert.equal(empty.body.profile, null);
    const profile = {
      header_row: 2,
      date_column: 'Ngày GD',
      date_format: 'dmy',
      amount_mode: 'split',
      credit_column: 'Ghi có',
      debit_column: 'Ghi nợ',
      description_column: 'Nội dung',
      reference_column: 'Số tham chiếu',
    };
    assert.equal(
      (await api('PUT', `/bank-statement-profiles/${accounts.bank}`, token('manager'), profile)).status,
      403,
    );
    assert.equal(
      (
        await api('PUT', `/bank-statement-profiles/${accounts.bank}`, token('accountant'), {
          ...profile,
          debit_column: '',
        })
      ).status,
      400,
    );
    const saved = await api('PUT', `/bank-statement-profiles/${accounts.bank}`, token('accountant'), profile);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.profile as { credit_column: string }).credit_column, 'Ghi có');
    assert.equal((await upload(token('manager'), accounts.bank ?? '', file, 'sao-ke.csv')).status, 403);
  });

  it('CT-224: nhập tệp CSV ghi dòng hợp lệ, báo dòng lỗi, đối soát tự động ưu tiên số phiếu trong diễn giải; số dư không đổi; nhập lại bỏ dòng trùng', async () => {
    const before = await balance('bank');
    const file = Buffer.from(csvLines.join('\n'), 'utf8');
    const imported = await upload(token('accountant'), accounts.bank ?? '', file, 'sao-ke.csv');
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    firstImport = imported.body as unknown as ImportResult;
    assert.equal(firstImport.total_rows, 8);
    assert.equal(firstImport.imported_count, 6);
    assert.equal(firstImport.error_count, 2);
    assert.deepEqual(
      firstImport.errors.map((error) => error.row),
      [9, 10],
    );
    assert.equal(firstImport.duplicate_count, 0);
    assert.equal(firstImport.auto_matched_count, 3);
    assert.equal(firstImport.suggested_count, 1);
    const byRef = (reference: string) => firstImport.lines.find((line) => line.bank_reference === reference);
    assert.equal(byRef('FT001')?.matched_transaction_id, await transactionOf('r1'));
    // Dòng có số phiếu PT của phiếu lập sau khớp đúng phiếu đó; dòng không có mã khớp phiếu còn lại
    assert.equal(byRef('FT002')?.matched_transaction_id, await transactionOf('rA'));
    assert.equal(byRef('FT003')?.matched_transaction_id, await transactionOf('rB'));
    assert.equal(byRef('FT004')?.status, 'unmatched');
    assert.equal(byRef('FT005')?.suggested_invoice_code, invoices.suggest?.code);
    assert.equal(byRef('FT006')?.suggested_invoice_id, null);
    assert.equal(await balance('bank'), before);

    const again = await upload(token('chiefAccountant'), accounts.bank ?? '', file, 'sao-ke.csv');
    assert.equal(again.status, 201, JSON.stringify(again.body));
    assert.equal(again.body.imported_count, 0);
    assert.equal(again.body.duplicate_count, 6);
    assert.equal(again.body.error_count, 2);
    const history = await api('GET', `/bank-statement-imports?account_id=${accounts.bank}`, token('accountant'));
    assert.equal((history.body as unknown as unknown[]).length, 2);
  });

  it('CT-225: nhập tệp Excel theo cấu hình một cột số tiền có dấu; dòng trùng số tham chiếu bỏ qua', async () => {
    const saved = await api('PUT', `/bank-statement-profiles/${accounts.bank}`, token('chiefAccountant'), {
      date_column: 'Date',
      date_format: 'ymd',
      amount_mode: 'signed',
      amount_column: 'Amount',
      description_column: 'Description',
      reference_column: 'Ref',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Statement');
    sheet.addRow(['Date', 'Amount', 'Description', 'Ref']);
    sheet.addRow([new Date(`${vietnamToday}T00:00:00Z`), -11_000, 'Phi quan ly', 'FT004']);
    sheet.addRow([vietnamToday, 300_000, 'Lai tien gui', 'FT009']);
    const imported = await upload(
      token('accountant'),
      accounts.bank ?? '',
      Buffer.from(await book.xlsx.writeBuffer()),
      'sao-ke.xlsx',
    );
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    assert.equal(imported.body.imported_count, 1);
    assert.equal(imported.body.duplicate_count, 1);
    assert.equal(imported.body.auto_matched_count, 0);
    const wrongHeader = new ExcelJS.Workbook();
    wrongHeader.addWorksheet('S').addRow(['Ngày', 'Tiền']);
    const rejected = await upload(
      token('accountant'),
      accounts.bank ?? '',
      Buffer.from(await wrongHeader.xlsx.writeBuffer()),
      'sai.xlsx',
    );
    assert.equal(rejected.status, 400);
  });

  it('CT-226: kế toán xác nhận đề xuất thì lập phiếu thu chuyển khoản, khớp dòng, hóa đơn hết nợ; không nhận thanh toán một phần; bỏ đề xuất', async () => {
    const line = firstImport.lines.find((row) => row.bank_reference === 'FT005');
    const before = await balance('bank');
    const denied = await api('POST', `/bank-transactions/${line?.id}/create-receipt`, token('manager'), {
      category_id: incomeCategory,
    });
    assert.equal(denied.status, 403);
    const created = await api('POST', `/bank-transactions/${line?.id}/create-receipt`, token('accountant'), {
      category_id: incomeCategory,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match((created.body.receipt as { code: string }).code, /^PT-\d{6}$/);
    assert.equal((created.body.line as Line).status, 'matched');
    assert.equal(await outstanding('suggest'), 0);
    assert.equal(await balance('bank'), before + 2_000_000);
    const repeated = await api('POST', `/bank-transactions/${line?.id}/create-receipt`, token('accountant'), {
      category_id: incomeCategory,
    });
    assert.equal(repeated.status, 409);

    const partial = firstImport.lines.find((row) => row.bank_reference === 'FT006');
    const rejected = await api('POST', `/bank-transactions/${partial?.id}/create-receipt`, token('accountant'), {
      category_id: incomeCategory,
      invoice_id: invoices.partial?.id,
    });
    assert.equal(rejected.status, 422);
    assert.equal(errorOf(rejected.body).rule_code, 'BR-31');

    const manual = await api('POST', '/bank-transactions', token('accountant'), {
      account_id: accounts.bank,
      transaction_date: vietnamToday,
      amount: 900_000,
      description: `Chuyen khoan ${invoices.partial?.code}`,
    });
    assert.equal(manual.status, 201, JSON.stringify(manual.body));
    assert.equal(manual.body.suggested_invoice_id, invoices.partial?.id);
    const dismissed = await api('POST', `/bank-transactions/${manual.body.id}/dismiss-suggestion`, token('accountant'));
    assert.equal(dismissed.status, 200);
    assert.equal(
      (await api('POST', `/bank-transactions/${manual.body.id}/dismiss-suggestion`, token('accountant'))).status,
      409,
    );
  });

  it('CT-227: khớp tự động theo số ngày lệch cấu hình của đơn vị', async () => {
    await issueReceipt('old', 'B', 650_000, addDays(vietnamToday, -2));
    const manual = await api('POST', '/bank-transactions', token('accountant'), {
      account_id: accounts.bank,
      transaction_date: vietnamToday,
      amount: 650_000,
      description: 'Chuyen tien',
    });
    assert.equal(manual.status, 201);
    const range = { account_id: accounts.bank, from: addDays(vietnamToday, -5), to: vietnamToday };
    const set = (value: number | null) =>
      api('PUT', '/settings', principal.accessToken, { org_unit_id: units.A, values: { bank_match_days: value } });
    assert.equal((await set(1)).status, 200);
    const narrow = await api('POST', '/bank-transactions/auto-match', token('accountant'), range);
    assert.equal(narrow.status, 200, JSON.stringify(narrow.body));
    assert.equal(narrow.body.auto_matched_count, 0);
    assert.equal((await set(null)).status, 200);
    const wide = await api('POST', '/bank-transactions/auto-match', token('accountant'), range);
    assert.equal(wide.body.auto_matched_count, 1);
  });

  it('CT-228: nhiều cổng thanh toán; tài khoản chọn cổng VietQR tĩnh thì mã QR là chuỗi VietQR tới tài khoản thật; bỏ chọn thì về cổng mặc định', async () => {
    const providers = await api('GET', '/payment-providers', token('accountant'));
    assert.equal(providers.status, 200, JSON.stringify(providers.body));
    assert.deepEqual(
      (providers.body as unknown as Array<{ code: string; is_default: boolean }>).map((row) => [
        row.code,
        row.is_default,
      ]),
      [
        ['development', true],
        ['vietqr-static', false],
      ],
    );
    const configured = await api('PUT', '/online-payment-settings', token('schoolAccountant'), {
      account_id: accounts.school,
      category_id: incomeCategory,
    });
    assert.equal(configured.status, 200, JSON.stringify(configured.body));
    const choose = (body: Record<string, unknown>, name = 'schoolAccountant') =>
      api('PUT', `/cash-accounts/${accounts.school}/payment-provider`, token(name), body);
    assert.equal((await choose({ payment_provider: 'vietqr-static' })).status, 400);
    assert.equal((await choose({ payment_provider: 'khong-co', bank_bin: '970436' })).status, 400);
    assert.equal((await choose({ payment_provider: 'vietqr-static', bank_bin: '97043' })).status, 400);
    assert.equal((await choose({ payment_provider: 'vietqr-static', bank_bin: '970436' }, 'accountant')).status, 403);
    const chosen = await choose({ payment_provider: 'vietqr-static', bank_bin: '970436' });
    assert.equal(chosen.status, 200, JSON.stringify(chosen.body));

    const qr = await api('GET', `/invoices/${invoices.partial?.id}/payment-qr`, token('schoolAccountant'));
    assert.equal(qr.status, 200, JSON.stringify(qr.body));
    assert.equal(qr.body.provider, 'vietqr-static');
    assert.equal(qr.body.virtual_account_number, '1900123456');
    const content = qr.body.qr_content as string;
    assert.ok(content.startsWith('000201010212'));
    assert.ok(content.includes('970436') && content.includes('1900123456'));
    assert.ok(content.includes(invoices.partial?.code.replace('-', '') ?? '?'));
    assert.equal(content.slice(-4), crc16(content.slice(0, -4)));

    assert.equal((await choose({ payment_provider: null, bank_bin: '970436' })).status, 200);
    const fallback = await api('GET', `/invoices/${invoices.partial?.id}/payment-qr`, token('schoolAccountant'));
    assert.equal(fallback.body.provider, 'development');
    assert.match(fallback.body.virtual_account_number as string, /^96\d{10}$/);
    const requests = await schoolYear
      .selectFrom('payment_requests')
      .select(['provider', 'status'])
      .where('invoice_id', '=', invoices.partial?.id ?? '')
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      requests.map((row) => [row.provider, row.status]),
      [
        ['vietqr-static', 'cancelled'],
        ['development', 'active'],
      ],
    );
    const simulated = await api('POST', '/payment-webhooks/development', token('schoolAccountant'), {
      provider_transaction_ref: randomUUID(),
      amount: 123_000,
      transfer_content: 'khong ro',
    });
    assert.equal(simulated.status, 200, JSON.stringify(simulated.body));
    assert.equal(simulated.body.match_status, 'unknown_invoice');
  });
});

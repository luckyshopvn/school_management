import assert from 'node:assert/strict';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import { payosSignature, vnpaySignature, type PaymentProviderSettings } from './payment-providers.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Thanh toán trực tuyến bằng mã QR qua bộ giả lập nhà cung cấp; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md
// mục P06-11. Hóa đơn ghi sẵn: HĐ-2 của T1 2 000 000, HĐ-3 của T2 2 000 000, HĐ-4 của T1 500 000, HĐ-5 của T2 300 000
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

// Khóa thử của nhà cung cấp thật; Casso không bật để kiểm điểm cuối trả 404 (YCTD-92)
const PROVIDER_SETTINGS: PaymentProviderSettings = {
  payos: {
    clientId: 'client-thu',
    apiKey: 'api-thu',
    checksumKey: 'checksum-thu',
    returnUrl: 'http://127.0.0.1/tra-ve',
    cancelUrl: 'http://127.0.0.1/huy',
    apiUrl: 'http://127.0.0.1:9',
  },
  sepay: { webhookApiKey: 'khoa-sepay-thu' },
  vnpay: {
    tmnCode: 'TMNTHU01',
    hashSecret: 'BIMATVNPAYTHU',
    returnUrl: 'http://127.0.0.1/vnpay',
    paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    expireMinutes: 15,
  },
};

type Qr = { amount: number; transfer_content: string; virtual_account_number: string; qr_content: string };
type Transfer = { id: string; match_status: string; receipt_id: string | null; handled_at: string | null };

describe('Thanh toán trực tuyến bằng mã QR', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const invoices: Record<string, string> = {};
  const invoiceCodes: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  const categories: Record<string, string> = {};
  const transfers: Record<string, string> = {};
  const parentPhone = randomPhone();
  let parentToken = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const qr = (invoice: string, accessToken = parentToken) =>
    api('GET', `/invoices/${invoices[invoice]}/payment-qr`, accessToken);
  const simulate = (body: Record<string, unknown>, accessToken = token('accountant')) =>
    api('POST', '/payment-webhooks/development', accessToken, {
      provider_transaction_ref: randomUUID(),
      ...body,
    });
  const outstanding = async (invoice: string) =>
    (await api('GET', `/invoices/${invoices[invoice]}`, token('accountant'))).body.outstanding_amount as number;
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

  async function seedInvoice(name: string, child: string, amount: number): Promise<void> {
    const code = `HD-${randomInt(100_000, 999_999)}`;
    const invoice = await schoolYear
      .insertInto('invoices')
      .values({
        code,
        child_id: children[child] ?? '',
        org_unit_id: units['ĐT-A1'] ?? '',
        period_year: 2026,
        period_month: 10,
        invoice_kind: 'supplementary',
        status: 'issued',
        total_amount: amount,
        basis: JSON.stringify({}),
        review_flags: JSON.stringify([]),
        due_date: '2099-12-31',
        issued_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('invoice_items')
      .values({
        invoice_id: invoice.id,
        item_type: 'tuition',
        description: 'Học phí chính khóa',
        quantity: 1,
        unit_price: amount,
        amount,
      })
      .execute();
    invoices[name] = invoice.id;
    invoiceCodes[name] = code;
  }

  before(async () => {
    environment = await startApiTestEnvironment({
      paymentGateways: ['development', 'vietqr-static', 'payos', 'sepay', 'vnpay'],
      paymentProviders: PROVIDER_SETTINGS,
    });
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
    await api('POST', '/classes', principal.accessToken, {
      org_unit_id: units['ĐT-A1'],
      code: 'L-A1',
      name: 'L-A1',
      grade_level: 'MAM',
      max_size: 25,
    });
    users.accountant = await environment.loginAs('VT-04', units['ĐT-A1'] ?? null);
    users.schoolAccountant = await environment.loginAs('VT-04', units.TC ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);

    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, name] of ['T1', 'T2'].entries()) {
      const row: Record<string, string> = {
        unit_code: 'ĐT-A1',
        class_code: 'L-A1',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `088${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
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

    categories.THU_HOC_PHI = (
      await api('POST', '/cashflow-categories', token('accountant'), {
        code: 'THU_HOC_PHI',
        name: 'Thu học phí',
        group_name: 'Hoạt động thường xuyên',
        flow_type: 'income',
      })
    ).body.id as string;
    for (const [name, unit, type, owner] of [
      ['NH-TRUONG', 'TC', 'bank', 'schoolAccountant'],
      ['NH-A', 'ĐT-A1', 'bank', 'accountant'],
      ['QUY-A', 'ĐT-A1', 'cash', 'accountant'],
    ] as const) {
      const created = await api('POST', '/cash-accounts', token(owner), {
        org_unit_id: units[unit],
        account_type: type,
        name,
        ...(type === 'bank' ? { bank_name: 'Ngân hàng Trường', account_number: '1900123456' } : {}),
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      accounts[name] = created.body.id as string;
    }
    await seedInvoice('HĐ-2', 'T1', 2_000_000);
    await seedInvoice('HĐ-3', 'T2', 2_000_000);
    await seedInvoice('HĐ-4', 'T1', 500_000);
    await seedInvoice('HĐ-5', 'T2', 300_000);
    await seedInvoice('HĐ-6', 'T1', 600_000);
    await seedInvoice('HĐ-7', 'T2', 700_000);
    await seedInvoice('HĐ-8', 'T1', 800_000);
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

  it('chưa cấu hình tài khoản nhận thì không cấp mã QR; chỉ tài khoản ngân hàng của Trường chính được chọn', async () => {
    const before = await qr('HĐ-2');
    assert.equal(before.status, 422);
    const unitAccount = await api('PUT', '/online-payment-settings', token('schoolAccountant'), {
      account_id: accounts['NH-A'],
      category_id: categories.THU_HOC_PHI,
    });
    assert.equal(unitAccount.status, 400);
    const unitAccountant = await api('PUT', '/online-payment-settings', token('accountant'), {
      account_id: accounts['NH-TRUONG'],
      category_id: categories.THU_HOC_PHI,
    });
    assert.equal(unitAccountant.status, 403);
    const configured = await api('PUT', '/online-payment-settings', token('schoolAccountant'), {
      account_id: accounts['NH-TRUONG'],
      category_id: categories.THU_HOC_PHI,
    });
    assert.equal(configured.status, 200, JSON.stringify(configured.body));
    assert.equal(configured.body.id, accounts['NH-TRUONG']);
  });

  it('CTC-P06-056: phụ huynh lấy mã QR của HĐ-2 có số tiền 2 000 000, nội dung là mã hóa đơn bỏ gạch và tài khoản ảo; gọi lại giữ nguyên mã', async () => {
    const first = await qr('HĐ-2');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const body = first.body as unknown as Qr;
    assert.equal(body.amount, 2_000_000);
    assert.equal(body.transfer_content, invoiceCodes['HĐ-2']?.replace('-', ''));
    assert.match(body.virtual_account_number, /^\d{12}$/);
    assert.ok(body.qr_content.includes(body.virtual_account_number));
    const second = (await qr('HĐ-2')).body as unknown as Qr;
    assert.equal(second.virtual_account_number, body.virtual_account_number);
  });

  it('CTC-P06-064: phụ huynh lấy mã QR của hóa đơn trẻ khác bị từ chối', async () => {
    assert.equal((await qr('HĐ-3')).status, 403);
  });

  it('CTC-P06-057, CTC-P06-065: tiền vào đúng tài khoản ảo và số tiền thì tự lập phiếu thu vào tài khoản trường, HĐ-2 đã thu đủ, phụ huynh nhận biên nhận; quỹ đơn vị không đổi', async () => {
    const code = (await qr('HĐ-2')).body as unknown as Qr;
    const cashBefore = await balance('QUY-A');
    const ref = randomUUID();
    transfers.matched = ref;
    const response = await simulate({
      provider_transaction_ref: ref,
      virtual_account_number: code.virtual_account_number,
      amount: 2_000_000,
      transfer_content: `${code.transfer_content} Me T1 nop hoc phi`,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const transfer = response.body as unknown as Transfer;
    assert.equal(transfer.match_status, 'matched');
    assert.ok(transfer.receipt_id);
    assert.equal(await outstanding('HĐ-2'), 0);
    assert.equal(await balance('NH-TRUONG'), 2_000_000);
    assert.equal(await balance('QUY-A'), cashBefore);
    const receipt = await schoolYear
      .selectFrom('receipts')
      .select(['method', 'org_unit_id', 'child_id'])
      .where('id', '=', transfer.receipt_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(receipt.method, 'transfer');
    assert.equal(receipt.child_id, children.T1);
    const notice = await schoolYear
      .selectFrom('notifications')
      .select('template_code')
      .where('target_id', '=', transfer.receipt_id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(notice.template_code, 'receipt_issued');
    const paid = await qr('HĐ-2');
    assert.equal(paid.status, 422);
  });

  it('CTC-P06-058: nhà cung cấp gửi lại cùng mã giao dịch thì không lập phiếu thu thứ hai', async () => {
    const response = await simulate({
      provider_transaction_ref: transfers.matched,
      virtual_account_number: '000000000000',
      amount: 2_000_000,
      transfer_content: 'gửi lại',
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.match_status, 'matched');
    const count = await schoolYear
      .selectFrom('receipts')
      .select((expression) => expression.fn.countAll<string>().as('total'))
      .where('child_id', '=', children.T1 ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(Number(count.total), 1);
  });

  it('CTC-P06-059: tiền vào 1 500 000 cho HĐ-3 còn 2 000 000 thì không lập phiếu, vào danh sách chờ', async () => {
    const code = (await qr('HĐ-3', token('accountant'))).body as unknown as Qr;
    const response = await simulate({
      virtual_account_number: code.virtual_account_number,
      amount: 1_500_000,
      transfer_content: code.transfer_content,
    });
    assert.equal(response.body.match_status, 'wrong_amount');
    assert.equal(response.body.receipt_id, null);
    assert.equal(await outstanding('HĐ-3'), 2_000_000);
    transfers.wrongAmount = response.body.id as string;
  });

  it('CTC-P06-060: tiền vào không có tài khoản ảo và nội dung không chứa mã hóa đơn thì vào danh sách chờ', async () => {
    const response = await simulate({ amount: 2_000_000, transfer_content: 'chuyen tien hoc' });
    assert.equal(response.body.match_status, 'unknown_invoice');
    assert.equal(response.body.receipt_id, null);
  });

  it('tài khoản ảo không có mã hóa đơn trong nội dung nhưng số tiền đúng thì vẫn khớp', async () => {
    const code = (await qr('HĐ-5', token('accountant'))).body as unknown as Qr;
    const response = await simulate({
      virtual_account_number: code.virtual_account_number,
      amount: 300_000,
      transfer_content: 'nop tien',
    });
    assert.equal(response.body.match_status, 'matched');
    assert.equal(await outstanding('HĐ-5'), 0);
  });

  it('CTC-P06-063: HĐ-4 đã thu đủ bằng tiền mặt sau khi có mã QR thì tiền vào không lập phiếu, vào danh sách chờ', async () => {
    const code = (await qr('HĐ-4')).body as unknown as Qr;
    const cash = await api('POST', '/receipts', token('accountant'), {
      request_key: randomUUID(),
      child_id: children.T1,
      payer_name: 'Mẹ T1',
      amount: 500_000,
      method: 'cash',
      account_id: accounts['QUY-A'],
      category_id: categories.THU_HOC_PHI,
      receipt_date: vietnamToday,
      allocations: [{ invoice_id: invoices['HĐ-4'], amount: 500_000 }],
    });
    assert.equal(cash.status, 201, JSON.stringify(cash.body));
    const response = await simulate({
      virtual_account_number: code.virtual_account_number,
      amount: 500_000,
      transfer_content: code.transfer_content,
    });
    assert.equal(response.body.match_status, 'already_paid');
    assert.equal(response.body.receipt_id, null);
  });

  it('CTC-P06-062: kế toán ghi đã xử lý giao dịch chờ kèm nội dung; giao dịch rời danh sách chờ, không xử lý lại được', async () => {
    const pending = await api('GET', '/online-payment-transactions?status=pending', token('accountant'));
    assert.equal(pending.status, 200);
    const pendingRows = pending.body as unknown as Transfer[];
    assert.equal(pendingRows.length, 3);
    const withoutNote = await api(
      'POST',
      `/online-payment-transactions/${transfers.wrongAmount}/resolve`,
      token('accountant'),
      {},
    );
    assert.equal(withoutNote.status, 400);
    const resolved = await api(
      'POST',
      `/online-payment-transactions/${transfers.wrongAmount}/resolve`,
      token('accountant'),
      { note: 'Gọi phụ huynh nộp thêm 500 000 bằng tiền mặt' },
    );
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal(resolved.body.handled_by, users.accountant?.userId);
    const after = (await api('GET', '/online-payment-transactions?status=pending', token('accountant')))
      .body as unknown as Transfer[];
    assert.equal(after.length, 2);
    const again = await api(
      'POST',
      `/online-payment-transactions/${transfers.wrongAmount}/resolve`,
      token('accountant'),
      { note: 'Lần hai' },
    );
    assert.equal(again.status, 422);
    assert.equal(errorOf(again.body).rule_code, 'P06-11');
  });

  it('giáo viên xem giao dịch, phụ huynh giả lập giao dịch đều bị từ chối', async () => {
    assert.equal((await api('GET', '/online-payment-transactions', token('teacher'))).status, 403);
    assert.equal((await simulate({ amount: 100_000 }, parentToken)).status, 403);
  });
  // Nhà cung cấp thật qua điểm cuối công khai, không dùng mã phiên (DT-12 phần 12b, YCTD-92)
  const webhook = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`${environment.baseUrl}/payment-webhooks/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
  };
  const seedRequest = async (invoice: string, child: string, provider: string, reference: string, amount: number) => {
    await schoolYear
      .insertInto('payment_requests')
      .values({
        invoice_id: invoices[invoice] ?? '',
        child_id: children[child] ?? '',
        org_unit_id: units['ĐT-A1'] ?? '',
        amount,
        transfer_content: invoiceCodes[invoice]?.replace('-', '') ?? '',
        provider,
        provider_reference: reference,
        virtual_account_number: reference,
        qr_content: reference,
        created_by: principal.userId,
      })
      .execute();
  };
  const transferOf = (ref: string) =>
    schoolYear
      .selectFrom('online_payment_transactions')
      .select(['match_status', 'receipt_id', 'provider'])
      .where('provider_transaction_ref', '=', ref)
      .executeTakeFirst();
  const vnpayHash = (parameters: Record<string, string>) =>
    createHmac('sha512', 'BIMATVNPAYTHU')
      .update(
        Object.keys(parameters)
          .sort()
          .map((key) => `${key}=${encodeURIComponent(parameters[key] ?? '').replace(/%20/g, '+')}`)
          .join('&'),
      )
      .digest('hex');

  it('CT-12b-9: thông báo PayOS sai chữ ký trả 401, không ghi giao dịch; đúng chữ ký thì tự lập phiếu thu HĐ-6; mã đơn lạ (dữ liệu thử) bỏ qua', async () => {
    await seedRequest('HĐ-6', 'T1', 'payos', '1760324645000601', 600_000);
    const data = {
      orderCode: 1760324645000601,
      amount: 600_000,
      description: `CSQ1 ${invoiceCodes['HĐ-6']?.replace('-', '')}`,
      accountNumber: 'V3CAS0601',
      reference: 'FT-PAYOS-0601',
      transactionDateTime: '2026-10-13 10:00:00',
      currency: 'VND',
      paymentLinkId: 'link-0601',
      code: '00',
      desc: 'success',
      counterAccountName: null,
    };
    const signature = payosSignature('checksum-thu', data);
    const forged = await webhook('payos', {
      code: '00',
      desc: 'success',
      success: true,
      data: { ...data, amount: 6_000_000 },
      signature,
    });
    assert.equal(forged.status, 401);
    assert.equal(await transferOf('payos-FT-PAYOS-0601'), undefined);
    const accepted = await webhook('payos', { code: '00', desc: 'success', success: true, data, signature });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.deepEqual(accepted.body, { success: true });
    const transfer = await transferOf('payos-FT-PAYOS-0601');
    assert.equal(transfer?.match_status, 'matched');
    assert.equal(transfer?.provider, 'payos');
    assert.ok(transfer?.receipt_id);
    assert.equal(await outstanding('HĐ-6'), 0);
    const repeated = await webhook('payos', { code: '00', desc: 'success', success: true, data, signature });
    assert.equal(repeated.status, 200);
    const sample = { ...data, orderCode: 123, reference: 'TF230204212323', description: 'VQRIO123' };
    const ignored = await webhook('payos', {
      code: '00',
      desc: 'success',
      success: true,
      data: sample,
      signature: payosSignature('checksum-thu', sample),
    });
    assert.equal(ignored.status, 200);
    assert.equal(await transferOf('payos-TF230204212323'), undefined);
  });

  it('CT-12b-10: thông báo SePay sai khóa trả 401; đúng khóa thì tự lập phiếu thu HĐ-7; tiền ra bỏ qua; Casso chưa bật trả 404', async () => {
    const body = {
      id: Number(`${Date.now()}`.slice(-9)),
      gateway: 'Vietcombank',
      transactionDate: '2026-10-13 09:00:00',
      accountNumber: '1900123456',
      content: `MBVCB.1 ${invoiceCodes['HĐ-7']?.replace('-', '')} me T2 nop`,
      transferType: 'in',
      transferAmount: 700_000,
      referenceCode: 'MBVCB.0701',
    };
    const wrongKey = await webhook('sepay', body, { authorization: 'Apikey sai' });
    assert.equal(wrongKey.status, 401);
    assert.equal((await webhook('sepay', body)).status, 401);
    assert.equal(await transferOf(`sepay-${body.id}`), undefined);
    const accepted = await webhook('sepay', body, { authorization: 'Apikey khoa-sepay-thu' });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.deepEqual(accepted.body, { success: true });
    assert.equal((await transferOf(`sepay-${body.id}`))?.match_status, 'matched');
    assert.equal(await outstanding('HĐ-7'), 0);
    const outgoing = await webhook(
      'sepay',
      { ...body, id: body.id + 1, transferType: 'out' },
      { authorization: 'Apikey khoa-sepay-thu' },
    );
    assert.equal(outgoing.status, 200);
    assert.equal(await transferOf(`sepay-${body.id + 1}`), undefined);
    assert.equal((await webhook('casso', { error: 0, data: {} })).status, 404);
  });

  it('CT-12b-11: IPN VNPay: sai chữ ký 97, đơn lạ 01, sai số tiền 04, đúng thì 00 và tự lập phiếu thu HĐ-8, gửi lại 02', async () => {
    const txnRef = `${invoiceCodes['HĐ-8']?.replace('-', '')}${Date.now()}`;
    await seedRequest('HĐ-8', 'T1', 'vnpay', txnRef, 800_000);
    const ipn = async (parameters: Record<string, string>, hash?: string) => {
      const query = new URLSearchParams({
        ...parameters,
        vnp_SecureHashType: 'HmacSHA512',
        vnp_SecureHash: hash ?? vnpayHash(parameters),
      });
      const response = await fetch(`${environment.baseUrl}/payment-webhooks/vnpay-ipn?${query.toString()}`);
      return (await response.json()) as { RspCode: string; Message: string };
    };
    const parameters = {
      vnp_Amount: '80000000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: invoiceCodes['HĐ-8']?.replace('-', '') ?? '',
      vnp_PayDate: '20261013100500',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'TMNTHU01',
      vnp_TransactionNo: '14000001',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
    };
    assert.equal(vnpaySignature('BIMATVNPAYTHU', parameters), vnpayHash(parameters));
    assert.equal((await ipn(parameters, 'ab'.repeat(64))).RspCode, '97');
    assert.equal((await ipn({ ...parameters, vnp_TxnRef: 'KHONGCO' })).RspCode, '01');
    assert.equal((await ipn({ ...parameters, vnp_Amount: '70000000' })).RspCode, '04');
    assert.deepEqual(await ipn(parameters), { RspCode: '00', Message: 'Confirm Success' });
    assert.equal((await transferOf(`vnpay-${txnRef}`))?.match_status, 'matched');
    assert.equal(await outstanding('HĐ-8'), 0);
    assert.equal((await ipn(parameters)).RspCode, '02');
  });
});

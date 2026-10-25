import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenancyRuntime, type TenantTestPlatform } from '@school-management/database';
import { startTenantTestApplication, type TenantTestContext } from '../test-support.js';
import { OPERATOR_TEST_PASSWORD, operatorOtp } from './operator-test-helpers.js';
import { createPlatformOperatorWithTotp } from './platform-operators.js';

// Thu phí ở cổng vận hành nền tảng (DT-SaaS phần S5b, YCTD-196), kịch bản CT-S5b-10: quy tắc tính phí và gắn vào gói, lập hóa đơn tay,
// giảm giá, ghi nhận tiền tay, hủy, tặng kỳ, giao dịch chưa khớp, hóa đơn điện tử giả lập, cấu hình và khóa cổng của nền tảng (chỉ gợi ý);
// chỉ ở tên miền cổng với mã phiên vận hành. Dữ liệu giả
interface Reply {
  status: number;
  body: unknown;
}

const CONSOLE_HOST = 'platform.e2e.localhost';

function send(
  context: TenantTestContext,
  options: { method?: string; path: string; host?: string; body?: unknown; token?: string },
): Promise<Reply> {
  const url = new URL(`${context.origin}/api/v1${options.path}`);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method ?? (payload ? 'POST' : 'GET'),
        headers: {
          ...(options.host ? { host: options.host } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : {} });
        });
      },
    );
    request.on('error', reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

type Json = Record<string, unknown>;

describe('thu phí ở cổng vận hành nền tảng', () => {
  let platform: TenantTestPlatform;
  let runtime: TenancyRuntime;
  let context: TenantTestContext;
  let token = '';
  const login = `thu-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    platform = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'bill' });
    runtime = platform.createRuntime();
    context = await startTenantTestApplication(runtime);
    context.configuration.platformConsoleHost = CONSOLE_HOST;
    const created = await createPlatformOperatorWithTotp(platform.platform, platform.masterKey, {
      login,
      fullName: 'Người vận hành giả',
      password: OPERATOR_TEST_PASSWORD,
    });
    const reply = await send(context, {
      path: '/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(platform.platform, created.id, created.secret, context.clock.now()),
      },
    });
    token = (reply.body as { access_token: string }).access_token;
  });

  after(async () => {
    await context?.close();
    await platform?.close();
  });

  const operator = (method: string, path: string, body?: unknown, host = CONSOLE_HOST, withToken = true) =>
    send(context, {
      method,
      path: `/auth/platform/${path}`,
      host,
      ...(body !== undefined ? { body } : {}),
      ...(withToken ? { token } : {}),
    });

  it('CT-S5b-10: quy tắc tính phí, hóa đơn tay, điều chỉnh có lý do, hóa đơn điện tử, cấu hình, khóa cổng; ngoài cổng bị từ chối', async () => {
    assert.equal((await operator('GET', 'billing', undefined, platform.school('alpha').host)).status, 404);
    assert.equal((await operator('GET', 'billing', undefined, CONSOLE_HOST, false)).status, 401);

    const badRule = await operator('POST', 'billing/price-rules', {
      code: 'bac-sai',
      name: 'Bậc sai',
      components: ['per_student'],
      student_tiers: [{ up_to: 100, unit_price: 10_000 }],
    });
    assert.equal(badRule.status, 400, 'bậc cuối phải để trống số học sinh tối đa');
    const rule = await operator('POST', 'billing/price-rules', {
      code: 'bac-thang',
      name: 'Bậc thang theo học sinh',
      components: ['per_student', 'per_school'],
      student_tiers: [
        { up_to: 100, unit_price: 10_000 },
        { up_to: null, unit_price: 8_000 },
      ],
      school_fee: 500_000,
      minimum_fee: 1_000_000,
      period: 'monthly',
      vat_percent: 8,
      due_days: 7,
    });
    assert.equal(rule.status, 201, JSON.stringify(rule.body));
    const ruleId = (rule.body as Json).id as string;
    assert.equal(
      (await operator('POST', 'billing/price-rules', { code: 'bac-thang', name: 'Trùng', components: ['per_school'] }))
        .status,
      409,
    );

    const plan = await operator('POST', 'plans', { code: 'co-ban', name: 'Cơ bản', price_rule_id: ruleId });
    assert.equal(plan.status, 201, JSON.stringify(plan.body));
    const alpha = platform.school('alpha').schoolId;
    const beta = platform.school('beta').schoolId;
    await operator('PUT', `plan-schools/${alpha}`, {
      plan_id: (plan.body as Json).id,
      effective_from: '2026-01-01',
      status: 'active',
    });
    const rules = (await operator('GET', 'billing/price-rules')).body as Json[];
    assert.deepEqual(rules[0]?.plans, ['co-ban']);

    assert.equal((await operator('POST', 'billing/invoices', { school_id: beta })).status, 409, 'trường chưa gán gói');
    assert.equal(
      (await operator('POST', 'billing/invoices', { school_id: alpha })).status,
      400,
      'chưa có số liệu chốt',
    );
    const created = await operator('POST', 'billing/invoices', {
      school_id: alpha,
      active_students: 150,
      note: 'Trả trước',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const invoice = created.body as Json;
    // 100 × 10.000 + 50 × 8.000 + 500.000 = 1.900.000; VAT 8% = 152.000
    assert.equal(invoice.total, 2_052_000);
    const invoiceId = invoice.id as string;

    assert.equal(
      (await operator('POST', `billing/invoices/${invoiceId}/discount`, { amount: 100_000, reason: 'x' })).status,
      400,
    );
    const discount = await operator('POST', `billing/invoices/${invoiceId}/discount`, {
      amount: 100_000,
      reason: 'Ưu đãi khai trương',
    });
    assert.equal(discount.status, 200, JSON.stringify(discount.body));
    assert.equal((discount.body as Json).total, 1_944_000);
    const paid = await operator('POST', `billing/invoices/${invoiceId}/manual-payment`, {
      amount: 1_944_000,
      reference: 'UNC-GIA-LAP-1',
      reason: 'Đối soát sao kê tháng 11',
    });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal((paid.body as Json).paid, true);
    assert.equal(
      (await operator('POST', `billing/invoices/${invoiceId}/void`, { reason: 'Hủy sau khi trả' })).status,
      409,
    );

    assert.equal(
      (await operator('POST', `billing/invoices/${invoiceId}/einvoice`)).status,
      409,
      'chưa nối nhà cung cấp',
    );
    const settings = await operator('PUT', 'billing/settings', {
      einvoice_provider: 'development',
      receiving_account: { bank_bin: '970436', account_number: '0123456789', account_name: 'NEN TANG GIA LAP' },
      remind_days_before: [10, 3],
    });
    assert.equal(settings.status, 200, JSON.stringify(settings.body));
    assert.equal((await operator('PUT', 'billing/settings', { receiving_account: { bank_bin: '12' } })).status, 400);
    const einvoice = await operator('POST', `billing/invoices/${invoiceId}/einvoice`);
    assert.equal(einvoice.status, 200, JSON.stringify(einvoice.body));
    const detail = (await operator('GET', `billing/invoices/${invoiceId}`)).body as Json;
    assert.equal(detail.status, 'paid');
    assert.equal((detail.einvoices as Json[]).at(-1)?.status, 'issued');

    const free = await operator('POST', `billing/schools/${beta}/free-period`, {
      months: 3,
      reason: 'Tặng trường thí điểm',
    });
    assert.equal(free.status, 200, JSON.stringify(free.body));
    assert.equal(
      (await operator('POST', `billing/schools/${beta}/free-period`, { months: 0, reason: 'Sai số tháng' })).status,
      400,
    );

    const connector = await operator('PUT', 'billing/connectors/casso', {
      values: { webhook_secret: 'bi-mat-casso-9876' },
    });
    assert.equal(connector.status, 200, JSON.stringify(connector.body));
    assert.equal(JSON.stringify(connector.body).includes('bi-mat-casso'), false, 'chỉ trả gợi ý');
    assert.equal((await operator('PUT', 'billing/connectors/payos', { values: { client_id: 'x' } })).status, 400);
    assert.equal((await operator('PUT', 'billing/connectors/stripe', { values: {} })).status, 404);

    const overview = (await operator('GET', 'billing')).body as Json;
    assert.deepEqual((overview.settings as Json).remind_days_before, [10, 3]);
    const receivable = (overview.receivables as Json[]).find((row) => row.school_id === alpha);
    assert.equal(receivable?.outstanding, 0);
    const listed = (await operator('GET', 'billing/invoices?status=paid')).body as Json[];
    assert.deepEqual(
      listed.map((row) => row.id),
      [invoiceId],
    );
    const audit = await platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'billing.%')
      .execute();
    for (const action of [
      'billing.price-rule-create',
      'billing.invoice-issue',
      'billing.discount',
      'billing.manual-payment',
      'billing.einvoice-issue',
      'billing.free-period',
      'billing.connector-update',
      'billing.settings-update',
    ]) {
      assert.ok(
        audit.some((row) => row.action === action),
        action,
      );
    }
  });
});

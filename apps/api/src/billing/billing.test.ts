import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { asDateText, readBillingSettings, saveBillingSettings, savePlatformConnector } from '@school-management/database';
import { runAsSchool } from '@school-management/server';
import { startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { BillingCycleJob } from './billing.js';

// Thu phí tự động ở máy chủ API nhiều trường (DT-SaaS phần S5b, YCTD-196), kịch bản CT-S5b-8, CT-S5b-9: hai trường giả alpha, beta
// cùng gói tính phí theo trường; việc nền theo trường lập hóa đơn, nhắc hạn, chuyển trạng thái; quản trị trường xem, tải, trả bằng
// cổng giả lập; cổng SePay của nền tảng báo tiền vào qua đường dẫn không cần trường. Khóa, hóa đơn, số tiền đều giả
describe('thu phí ở máy chủ API nhiều trường', () => {
  let environment: MultiTenantApi;
  const operator = { type: 'operator' as const, id: '00000000-0000-4000-8000-000000000002' };

  before(async () => {
    environment = await startMultiTenantApi({ label: 'bill' });
    const platform = environment.platform.platform;
    const rule = await platform
      .insertInto('price_rules')
      .values({
        code: 'theo-truong',
        name: 'Theo trường',
        components: JSON.stringify(['per_school']),
        school_fee: 2_000_000,
        period: 'monthly',
        vat_percent: 0,
        due_days: 10,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const plan = await platform
      .insertInto('plans')
      .values({ code: 'goi-thu-phi', name: 'Gói thu phí', price_rule_id: rule.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const name of ['alpha', 'beta']) {
      const tenant = await environment.tenantOf(name);
      await platform
        .insertInto('school_plans')
        .values({ school_id: tenant.schoolId, plan_id: plan.id, effective_from: '2026-01-01' })
        .execute();
    }
    environment.apiRuntime.registry.invalidate();
  });

  after(async () => {
    await environment?.close();
  });

  const call = (name: string, method: string, path: string, body?: unknown) => environment.call(name, method, path, body);

  async function runJob(name: string, now: Date) {
    environment.apiRuntime.registry.invalidate();
    const tenant = await environment.tenantOf(name);
    await runAsSchool(tenant, () => environment.api.get(BillingCycleJob).run(now));
  }

  async function schoolRow(name: string) {
    const tenant = await environment.tenantOf(name);
    return environment.platform.platform
      .selectFrom('schools')
      .select(['status', 'paid_until'])
      .where('id', '=', tenant.schoolId)
      .executeTakeFirstOrThrow();
  }

  it('CT-S5b-8: việc nền lập hóa đơn một lần, nhắc hạn, chỉ đọc khi quá hạn; trường chỉ thấy hóa đơn của mình; trả bằng cổng giả lập thì mở lại', async () => {
    await runJob('alpha', new Date('2026-11-01T03:00:00Z'));
    await runJob('alpha', new Date('2026-11-01T05:00:00Z'));
    const list = await call('alpha', 'GET', '/billing/invoices');
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const invoices = list.body.invoices as Array<Record<string, unknown>>;
    assert.equal(invoices.length, 1, 'chạy lặp không lập trùng');
    const invoice = invoices[0] as Record<string, unknown>;
    assert.equal(invoice.total, 2_000_000);
    assert.equal(invoice.due_on, '2026-11-10');
    assert.equal(((list.body.payment as Record<string, unknown>).provider), 'development');
    assert.equal(((await call('beta', 'GET', '/billing/invoices')).body.invoices as unknown[]).length, 0);
    assert.equal((await call('beta', 'GET', `/billing/invoices/${String(invoice.id)}`)).status, 404, 'trường khác không xem được');

    // Quá hạn 8 ngày: nhắc sau hạn rồi chuyển chỉ đọc (giả định GD-99), ghi nhật ký nhắc
    await runJob('alpha', new Date('2026-11-18T03:00:00Z'));
    assert.equal((await schoolRow('alpha')).status, 'read_only');
    const tenant = await environment.tenantOf('alpha');
    const dunning = await environment.platform.platform
      .selectFrom('dunning_events')
      .select('kind')
      .where('school_id', '=', tenant.schoolId)
      .execute();
    assert.ok(dunning.some((row) => row.kind === 'read_only'));
    environment.apiRuntime.registry.invalidate();
    const blocked = await call('alpha', 'POST', '/org-units', { code: 'X', name: 'X', unit_type: 'diem_truong' });
    assert.equal((blocked.body.error as Record<string, unknown>)?.code, 'SCHOOL_READ_ONLY');

    // Ở chế độ chỉ đọc vẫn xem, tải, trả được
    const document = await call('alpha', 'GET', `/billing/invoices/${String(invoice.id)}/document`);
    assert.equal(document.status, 200);
    assert.match(String(document.body.raw), /Hóa đơn/);
    const pay = await call('alpha', 'POST', `/billing/invoices/${String(invoice.id)}/pay`);
    assert.equal(pay.status, 200, JSON.stringify(pay.body));
    assert.match(String(pay.body.qr_content), /^GIA-LAP\|/);
    assert.equal(pay.body.amount, 2_000_000);
    const simulated = await call('alpha', 'POST', `/billing/invoices/${String(invoice.id)}/simulate-payment`);
    assert.equal(simulated.status, 200, JSON.stringify(simulated.body));
    assert.equal(simulated.body.paid, true);
    assert.equal(simulated.body.reopened, true);
    const reopened = await schoolRow('alpha');
    assert.equal(reopened.status, 'active');
    assert.equal(asDateText(reopened.paid_until), '2026-12-10');
    assert.equal((await call('alpha', 'POST', `/billing/invoices/${String(invoice.id)}/pay`)).status, 409, 'đã trả đủ');
  });

  it('CT-S5b-9: cổng SePay của nền tảng báo tiền vào không theo tên miền trường: sai khóa 401, đúng khóa ghi một lần, cổng chưa bật 404', async () => {
    const platform = environment.platform.platform;
    await runJob('beta', new Date('2026-11-01T03:00:00Z'));
    const invoice = ((await call('beta', 'GET', '/billing/invoices')).body.invoices as Array<Record<string, unknown>>)[0];
    assert.ok(invoice);
    await savePlatformConnector(
      platform,
      environment.platform.masterKey,
      { connector: 'sepay', enabled: true, values: { webhook_api_key: 'khoa-sepay-gia-lap' } },
      operator,
    );
    await saveBillingSettings(
      platform,
      {
        ...(await readBillingSettings(platform)),
        receivingAccount: { bankBin: '970436', accountNumber: '0123456789', accountName: 'NEN TANG GIA LAP' },
      },
      operator,
    );
    const pay = await call('beta', 'POST', `/billing/invoices/${String(invoice.id)}/pay`);
    assert.equal(pay.status, 200, JSON.stringify(pay.body));
    assert.equal(pay.body.provider, 'sepay');
    assert.match(String(pay.body.qr_content), /^000201/);

    const hook = (key: string, body: unknown, provider = 'sepay') =>
      new Promise<number>((resolve, reject) => {
        const url = new URL(`${environment.apiOrigin}/api/v1/platform-billing/webhooks/${provider}`);
        const payload = JSON.stringify(body);
        const request = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Apikey ${key}` },
          },
          (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode ?? 0));
          },
        );
        request.on('error', reject);
        request.end(payload);
      });
    const transfer = {
      id: 9001,
      transferType: 'in',
      transferAmount: 2_000_000,
      content: `CK ${String(invoice.payment_content)} thanh toan`,
      transactionDate: '2026-11-03 09:15:00',
    };
    assert.equal(await hook('sai-khoa', transfer), 401);
    assert.equal(await hook('khoa-sepay-gia-lap', transfer), 200);
    assert.equal(await hook('khoa-sepay-gia-lap', transfer), 200, 'gửi lại vẫn nhận');
    assert.equal(await hook('khoa-sepay-gia-lap', transfer, 'casso'), 404, 'cổng chưa bật');
    const payments = await platform
      .selectFrom('invoice_payments')
      .select(['status'])
      .where('invoice_id', '=', String(invoice.id))
      .execute();
    assert.equal(payments.length, 1, 'không ghi trùng');
    const after = await call('beta', 'GET', `/billing/invoices/${String(invoice.id)}`);
    assert.equal(after.body.status, 'paid');
    await platform.deleteFrom('platform_integration_secrets').execute();
  });
});

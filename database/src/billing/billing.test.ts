import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startTenantTestPlatform, type TenantTestPlatform } from '../tenant-test-support.js';
import {
  applyDiscount,
  assignPayment,
  BillingError,
  cancelEInvoice,
  closeDuePeriod,
  grantFreePeriod,
  invoiceDetail,
  issueEInvoice,
  listUnmatchedPayments,
  loadBillingPlan,
  readBillingSettings,
  receivables,
  receivePayment,
  recordManualPayment,
  runDunning,
  saveBillingSettings,
  voidInvoice,
} from './billing.js';
import { listPlatformConnectors, readPlatformConnectors, savePlatformConnector } from './platform-secrets.js';

// Thu phí tự động trên cơ sở dữ liệu nền tảng riêng của lần chạy (DT-SaaS phần S5b, YCTD-196), kịch bản CT-S5b-3 đến CT-S5b-7.
// Trường, hóa đơn, số tiền đều giả
let test: TenantTestPlatform;
let alphaId = '';
let betaId = '';
const operator = { type: 'operator' as const, id: '00000000-0000-4000-8000-000000000001' };
const pricing = { allModules: ['education', 'finance'] };
const usage = (activeStudents: number) => async () => ({
  activeStudents,
  storageMb: 12,
  schoolLevels: 1,
  modules: null,
});

async function school(id: string) {
  return test.platform
    .selectFrom('schools')
    .select(['status', 'paid_until'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}
const dateOf = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

before(async () => {
  test = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 's5b' });
  alphaId = test.school('alpha').schoolId;
  betaId = test.school('beta').schoolId;
  const rule = await test.platform
    .insertInto('price_rules')
    .values({
      code: 'hoc-sinh',
      name: 'Theo học sinh',
      components: JSON.stringify(['per_student']),
      student_tiers: JSON.stringify([
        { up_to: 100, unit_price: 10_000 },
        { up_to: null, unit_price: 8_000 },
      ]),
      minimum_fee: 500_000,
      period: 'monthly',
      vat_percent: 10,
      due_days: 10,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const plan = await test.platform
    .insertInto('plans')
    .values({ code: 'co-ban', name: 'Cơ bản', price_rule_id: rule.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const id of [alphaId, betaId]) {
    await test.platform
      .insertInto('school_plans')
      .values({ school_id: id, plan_id: plan.id, effective_from: '2026-01-01' })
      .execute();
  }
});

after(async () => {
  await test?.close();
});

beforeEach(async () => {
  for (const table of [
    'dunning_events',
    'billing_adjustments',
    'einvoice_documents',
    'invoice_payments',
    'invoice_lines',
    'invoices',
    'usage_snapshots',
  ] as const) {
    await test.platform.deleteFrom(table).execute();
  }
  await test.platform
    .updateTable('schools')
    .set({ status: 'active', paid_until: null })
    .where('id', 'in', [alphaId, betaId])
    .execute();
});

describe('thu phí tự động trên cơ sở dữ liệu nền tảng', () => {
  it('CT-S5b-3: chốt kỳ vừa xong một lần, hóa đơn có VAT và hạn, hạn chờ trả của trường; trường dùng thử, chưa gán gói, tạm ngưng không lập', async () => {
    const plan = await loadBillingPlan(test.platform, alphaId, '2026-11-05');
    assert.equal(plan?.rule.code, 'hoc-sinh');
    const now = new Date('2026-11-01T02:00:00Z');
    const issued = await closeDuePeriod(
      test.platform,
      { schoolId: alphaId, today: '2026-11-01', now, usage: usage(150) },
      pricing,
    );
    assert.ok(issued);
    // 100 × 10.000 + 50 × 8.000 = 1.400.000, VAT 10% = 140.000
    assert.equal(issued.total, 1_540_000);
    assert.equal(issued.dueOn, '2026-11-10');
    assert.match(issued.code, /^HD-\d{6}$/);
    assert.equal(issued.paymentContent, issued.code.replace('-', ''));
    assert.equal(dateOf((await school(alphaId)).paid_until), '2026-11-10');
    assert.equal(
      await closeDuePeriod(test.platform, { schoolId: alphaId, today: '2026-11-02', now, usage: usage(150) }, pricing),
      null,
      'chạy lại không lập trùng',
    );
    const snapshot = await test.platform
      .selectFrom('usage_snapshots')
      .selectAll()
      .where('school_id', '=', alphaId)
      .executeTakeFirstOrThrow();
    assert.equal(snapshot.active_students, 150);
    assert.equal(dateOf(snapshot.period_start), '2026-10-01');
    const detail = await invoiceDetail(test.platform, issued.id, '2026-11-01', alphaId);
    assert.equal(detail?.lines.length, 2);
    assert.equal(await invoiceDetail(test.platform, issued.id, '2026-11-01', betaId), null, 'trường khác không thấy');

    await test.platform.updateTable('schools').set({ status: 'trial' }).where('id', '=', betaId).execute();
    assert.equal(
      await closeDuePeriod(test.platform, { schoolId: betaId, today: '2026-11-01', now, usage: usage(10) }, pricing),
      null,
    );
    await test.platform.updateTable('schools').set({ status: 'suspended' }).where('id', '=', betaId).execute();
    assert.equal(
      await closeDuePeriod(test.platform, { schoolId: betaId, today: '2026-11-01', now, usage: usage(10) }, pricing),
      null,
    );
    await test.platform.updateTable('schools').set({ status: 'active' }).where('id', '=', betaId).execute();
    const small = await closeDuePeriod(
      test.platform,
      { schoolId: betaId, today: '2026-11-01', now, usage: usage(10) },
      pricing,
    );
    assert.equal(small?.total, 550_000, 'bù phí tối thiểu 500.000 cộng VAT');
    const listed = await receivables(test.platform, '2026-11-20');
    assert.equal(listed.find((row) => row.school_id === alphaId)?.overdue_invoices, 1);
  });

  it('CT-S5b-4: tiền vào khớp nội dung, trả thiếu, trả đủ, gửi trùng, chưa khớp rồi gán tay; trả đủ thì gia hạn và mở lại trường chỉ đọc', async () => {
    const now = new Date('2026-11-01T02:00:00Z');
    const invoice = await closeDuePeriod(
      test.platform,
      { schoolId: alphaId, today: '2026-11-01', now, usage: usage(150) },
      pricing,
    );
    assert.ok(invoice);
    await test.platform.updateTable('schools').set({ status: 'read_only' }).where('id', '=', alphaId).execute();
    const payment = (reference: string, amount: number, content: string) =>
      receivePayment(
        test.platform,
        { provider: 'development', reference, amount, transferContent: content, receivedAt: now },
        now,
      );

    const partial = await payment('GD-1', 1_000_000, `Thanh toan ${invoice.paymentContent.toLowerCase()} truong alpha`);
    assert.equal(partial.status, 'matched');
    assert.equal(partial.paid, false);
    assert.equal((await school(alphaId)).status, 'read_only');
    assert.equal((await payment('GD-1', 1_000_000, invoice.paymentContent)).status, 'duplicate');

    const rest = await payment('GD-2', 540_000, invoice.code);
    assert.equal(rest.paid, true);
    assert.equal(rest.reopened, true);
    const after = await school(alphaId);
    assert.equal(after.status, 'active');
    assert.equal(dateOf(after.paid_until), '2026-12-10', 'hạn dời tới hạn của hóa đơn kỳ sau');
    const dunning = await test.platform
      .selectFrom('dunning_events')
      .select('kind')
      .where('school_id', '=', alphaId)
      .execute();
    assert.deepEqual(
      dunning.map((row) => row.kind),
      ['reopened'],
    );
    assert.equal((await payment('GD-3', 100, invoice.code)).paid, true, 'trả thừa vẫn ghi, không gia hạn lần nữa');
    assert.equal(dateOf((await school(alphaId)).paid_until), '2026-12-10');

    const stray = await payment('GD-4', 200_000, 'chuyen tien khong ghi ma');
    assert.equal(stray.status, 'unmatched');
    const unmatched = await listUnmatchedPayments(test.platform);
    assert.equal(unmatched.length, 1);
    const second = await closeDuePeriod(
      test.platform,
      { schoolId: betaId, today: '2026-11-01', now, usage: usage(10) },
      pricing,
    );
    assert.ok(second);
    await assert.rejects(
      assignPayment(
        test.platform,
        { paymentId: unmatched[0]?.id as string, invoiceId: second.id, reason: 'ok', now },
        operator,
      ),
      BillingError,
      'lý do quá ngắn',
    );
    const assigned = await assignPayment(
      test.platform,
      { paymentId: unmatched[0]?.id as string, invoiceId: second.id, reason: 'Kế toán đối chiếu sao kê', now },
      operator,
    );
    assert.equal(assigned.paid, false);
    await assert.rejects(
      assignPayment(
        test.platform,
        { paymentId: unmatched[0]?.id as string, invoiceId: second.id, reason: 'Gán lần hai', now },
        operator,
      ),
      BillingError,
    );
  });

  it('CT-S5b-5: giảm giá tính lại VAT, ghi nhận tiền tay, hủy hóa đơn, tặng kỳ mở lại trường; mọi điều chỉnh có lý do và nhật ký', async () => {
    const now = new Date('2026-11-01T02:00:00Z');
    const invoice = await closeDuePeriod(
      test.platform,
      { schoolId: alphaId, today: '2026-11-01', now, usage: usage(150) },
      pricing,
    );
    assert.ok(invoice);
    const discounted = await applyDiscount(
      test.platform,
      { invoiceId: invoice.id, amount: 400_000, reason: 'Ưu đãi năm đầu', now },
      operator,
    );
    assert.deepEqual(discounted, { total: 1_100_000, discountTotal: 400_000, vatAmount: 100_000 });
    const manual = await recordManualPayment(
      test.platform,
      { invoiceId: invoice.id, amount: 1_100_000, reference: 'UNC-0001', reason: 'Chuyển khoản đối soát tay', now },
      operator,
    );
    assert.equal(manual.paid, true);
    await assert.rejects(
      recordManualPayment(
        test.platform,
        { invoiceId: invoice.id, amount: 1, reference: 'UNC-0001', reason: 'Ghi lại', now },
        operator,
      ),
      BillingError,
    );
    await assert.rejects(
      applyDiscount(test.platform, { invoiceId: invoice.id, amount: 1, reason: 'Sau khi trả', now }, operator),
      BillingError,
    );

    const other = await closeDuePeriod(
      test.platform,
      { schoolId: betaId, today: '2026-11-01', now, usage: usage(10) },
      pricing,
    );
    assert.ok(other);
    assert.equal(dateOf((await school(betaId)).paid_until), '2026-11-10');
    await voidInvoice(test.platform, { invoiceId: other.id, reason: 'Lập nhầm kỳ', now }, operator);
    assert.equal((await school(betaId)).paid_until, null, 'không còn nợ thì bỏ hạn chờ trả');
    await assert.rejects(
      voidInvoice(test.platform, { invoiceId: invoice.id, reason: 'Hủy hóa đơn đã trả', now }, operator),
      BillingError,
    );

    await test.platform
      .updateTable('schools')
      .set({ status: 'read_only', paid_until: '2026-10-01' })
      .where('id', '=', betaId)
      .execute();
    const granted = await grantFreePeriod(
      test.platform,
      { schoolId: betaId, months: 2, reason: 'Tặng kỳ dùng thử thêm', today: '2026-11-15', now },
      operator,
    );
    assert.deepEqual(granted, { paidUntil: '2027-01-15', reopened: true });
    assert.equal((await school(betaId)).status, 'active');
    const adjustments = await test.platform
      .selectFrom('billing_adjustments')
      .select(['kind', 'reason'])
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      adjustments.map((row) => row.kind),
      ['discount', 'manual_payment', 'void', 'free_period'],
    );
    const audit = await test.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'billing.%')
      .execute();
    for (const action of [
      'billing.invoice-issue',
      'billing.discount',
      'billing.invoice-paid',
      'billing.void',
      'billing.free-period',
    ]) {
      assert.ok(
        audit.some((row) => row.action === action),
        action,
      );
    }
  });

  it('CT-S5b-6: nhắc trước hạn 15, 7, 1 ngày và sau hạn theo cấu hình, mỗi mốc một lần; trả xong thì không nhắc', async () => {
    const now = new Date('2026-11-01T02:00:00Z');
    await saveBillingSettings(
      test.platform,
      { ...(await readBillingSettings(test.platform)), remindDaysBefore: [9, 1], remindDaysAfter: [2] },
      operator,
    );
    const invoice = await closeDuePeriod(
      test.platform,
      { schoolId: alphaId, today: '2026-11-01', now, usage: usage(150) },
      pricing,
    );
    assert.ok(invoice);
    const remind = (today: string) => runDunning(test.platform, { schoolId: alphaId, today });
    assert.equal((await remind('2026-11-01'))?.days, 9);
    assert.equal(await remind('2026-11-01'), null, 'chạy lặp trong ngày không nhắc lại');
    assert.equal(await remind('2026-11-05'), null, 'ngày không có trong lịch');
    assert.deepEqual(
      [(await remind('2026-11-09'))?.kind, (await remind('2026-11-12'))?.kind],
      ['before_due', 'overdue'],
    );
    const notice = await remind('2026-11-12');
    assert.equal(notice, null);
    await receivePayment(
      test.platform,
      {
        provider: 'development',
        reference: 'GD-9',
        amount: invoice.total,
        transferContent: invoice.paymentContent,
        receivedAt: now,
      },
      now,
    );
    assert.equal(await runDunning(test.platform, { schoolId: alphaId, today: '2026-12-01' }), null);
    await saveBillingSettings(
      test.platform,
      { ...(await readBillingSettings(test.platform)), remindDaysBefore: [15, 7, 1], remindDaysAfter: [1, 3] },
      operator,
    );
  });

  it('CT-S5b-7: hóa đơn điện tử qua bộ nối giả lập, chưa nối thì báo lỗi; khóa cổng của nền tảng mã hóa, chỉ trả gợi ý', async () => {
    const now = new Date('2026-11-01T02:00:00Z');
    const invoice = await closeDuePeriod(
      test.platform,
      { schoolId: alphaId, today: '2026-11-01', now, usage: usage(150) },
      pricing,
    );
    assert.ok(invoice);
    await assert.rejects(issueEInvoice(test.platform, { invoiceId: invoice.id, now }, operator), BillingError);
    await saveBillingSettings(
      test.platform,
      { ...(await readBillingSettings(test.platform)), einvoiceProvider: 'development' },
      operator,
    );
    const issued = await issueEInvoice(test.platform, { invoiceId: invoice.id, now }, operator);
    assert.equal(issued.externalId, `GL-${invoice.code}`);
    await assert.rejects(
      issueEInvoice(test.platform, { invoiceId: invoice.id, now }, operator),
      BillingError,
      'không phát hành hai lần',
    );
    await cancelEInvoice(test.platform, { invoiceId: invoice.id, reason: 'Sai thông tin người mua', now }, operator);
    const documents = await test.platform
      .selectFrom('einvoice_documents')
      .select('status')
      .orderBy('created_at')
      .execute();
    assert.deepEqual(
      documents.map((row) => row.status),
      ['failed', 'cancelled'],
    );
    await saveBillingSettings(
      test.platform,
      { ...(await readBillingSettings(test.platform)), einvoiceProvider: 'none' },
      operator,
    );

    await savePlatformConnector(
      test.platform,
      test.masterKey,
      { connector: 'sepay', enabled: true, values: { webhook_api_key: 'khoa-gia-lap-1234' } },
      operator,
    );
    const stored = await test.platform.selectFrom('platform_integration_secrets').selectAll().executeTakeFirstOrThrow();
    assert.equal(stored.values_encrypted.includes('khoa-gia-lap'), false, 'không lưu giá trị trần');
    assert.deepEqual(stored.hints, { webhook_api_key: '••••1234' });
    await savePlatformConnector(
      test.platform,
      test.masterKey,
      { connector: 'sepay', enabled: false, values: {} },
      operator,
    );
    const read = await readPlatformConnectors(test.platform, test.masterKey);
    assert.equal(read.get('sepay')?.values.webhook_api_key, 'khoa-gia-lap-1234', 'để trống giữ giá trị cũ');
    assert.equal(read.get('sepay')?.enabled, false);
    const listed = await listPlatformConnectors(test.platform);
    assert.equal(JSON.stringify(listed).includes('khoa-gia-lap'), false);
    await assert.rejects(
      savePlatformConnector(
        test.platform,
        test.masterKey,
        { connector: 'payos', enabled: true, values: { client_id: 'x' } },
        operator,
      ),
    );
  });
});

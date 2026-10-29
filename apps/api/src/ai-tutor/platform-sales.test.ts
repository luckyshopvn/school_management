import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  readBillingSettings,
  saveBillingSettings,
  savePlatformConnector,
  type IdentityDatabase,
  type SystemDatabase,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
  TEST_PASSWORD,
} from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import type { Kysely } from 'kysely';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { vietnamMonthOf } from './ai-tutor-rules.js';
import { activateAiTutorSubscription, aiTutorTurnBalance, createAiTutorSubscription } from './ai-tutor-turns.js';
import { PlatformAiTutorExpiryJob } from './platform-sales.js';

// Nền tảng bán thẳng gói gia sư AI cho phụ huynh (YCTD-383 lát L1b), kịch bản CT-383-L1b-1 đến CT-383-L1b-7: cổng vận hành tạo, sửa,
// ngừng bán gói; phụ huynh mua cho con qua cổng giả lập của nền tảng; mua trùng gói tháng với nguồn trường; hết hạn giữ chỗ và tiền đến
// muộn; thông báo tiền vào của cổng SePay của nền tảng với khóa sai, khóa đúng, gửi lặp, sai số tiền; hủy, hoàn tiền có ghi người thao
// tác. Khóa cổng, số tài khoản, họ tên đều là dữ liệu bịa
const CONSOLE_HOST = 'platform.gsai.localhost';

describe('Gia sư AI: nền tảng bán thẳng cho phụ huynh', () => {
  let environment: MultiTenantApi;
  let system: Kysely<SystemDatabase>;
  let parentToken = '';
  let childId = '';
  let primaryChildId = '';
  let adminToken = '';
  let supportToken = '';
  const plans: Record<string, string> = {};

  const parent = (method: string, path: string, body?: unknown) =>
    environment.call('alpha', method, `/ai-tutor/direct${path}`, body, parentToken);
  const operator = (method: string, path: string, body?: unknown, token = adminToken, host = CONSOLE_HOST) =>
    sendWithHost(environment.apiOrigin, {
      method,
      path: `/api/v1/platform-ai-tutor${path}`,
      host,
      token,
      ...(body !== undefined ? { body } : {}),
    });

  async function operatorToken(role: 'quan_tri' | 'ho_tro'): Promise<string> {
    const login = `van-hanh-${role}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createPlatformOperatorWithTotp(
      environment.platform.platform,
      environment.platform.masterKey,
      {
        login,
        fullName: `Nhân viên ${role}`,
        password: OPERATOR_TEST_PASSWORD,
        role,
      },
    );
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/platform/login',
      host: CONSOLE_HOST,
      body: {
        login,
        password: OPERATOR_TEST_PASSWORD,
        otp_code: await operatorOtp(
          environment.platform.platform,
          created.id,
          created.secret,
          environment.identity.clock.now(),
        ),
      },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.access_token as string;
  }

  // Năm học, lớp 8A (Trung học cơ sở), lớp 1A (Tiểu học), hai con của cùng một phụ huynh
  async function prepareSchool() {
    const call = (method: string, path: string, body?: unknown) => environment.call('alpha', method, path, body);
    const created = await call('POST', '/academic-years', { name: '2026-2027' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const yearId = created.body.id as string;
    const calendar = {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    };
    assert.equal((await call('PUT', `/academic-years/${yearId}/calendar`, calendar)).status, 200);
    assert.equal((await call('POST', `/academic-years/${yearId}/open`)).status, 200);
    const unit = await call('POST', '/org-units', { code: 'TRUONG', name: 'Trường alpha', unit_type: 'truong_chinh' });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
    const unitId = unit.body.id as string;
    const tenant = await environment.tenantOf('alpha');
    const schoolYear = await runAsSchool(
      tenant,
      async () => (await environment.api.get(CurrentSchoolYearResolver).require()).database,
    );
    const identity = environment.identityRuntime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const user = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unitId }] });
    const login = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/login',
      host: environment.hosts.alpha,
      body: { login: user.username, password: TEST_PASSWORD, channel: 'parent' },
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    parentToken = login.body.access_token as string;
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Phụ huynh thử', phone: '0900000383', user_id: user.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    const children: string[] = [];
    for (const [code, grade, level] of [
      ['8A', 'K8', 'THCS'],
      ['1A', 'K1', 'TH'],
    ] as const) {
      const schoolClass = await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: yearId,
          code,
          name: code,
          grade_level: grade,
          school_level: level,
          max_size: 30,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${code}`,
          dob: '2013-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: schoolClass.id, from_date: '2026-09-05' })
        .execute();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
      children.push(child.id);
    }
    [childId, primaryChildId] = children as [string, string];
    system = environment.apiRuntime.connections.database<SystemDatabase>(tenant, 'system', 'system');
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gsai', configuration: { platformConsoleHost: CONSOLE_HOST } });
    environment.identity.configuration.platformConsoleHost = CONSOLE_HOST;
    adminToken = await operatorToken('quan_tri');
    supportToken = await operatorToken('ho_tro');
    await prepareSchool();
  });

  after(async () => {
    await environment?.close();
  });

  const orderRow = (id: string) =>
    environment.platform.platform
      .selectFrom('platform_ai_tutor_orders')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
  const subscriptionOf = async (orderId: string) =>
    system
      .selectFrom('ai_tutor_subscriptions')
      .selectAll()
      .where('id', '=', (await orderRow(orderId)).subscription_id)
      .executeTakeFirstOrThrow();

  it('CT-383-L1b-1: cổng vận hành tạo, sửa, ngừng bán gói; vai trò không được phép 403; tên miền trường 404', async () => {
    const monthly = await operator('POST', '/plans', {
      kind: 'monthly',
      name: 'Cơ bản tháng',
      price: 89_000,
      turns: 100,
      school_levels: ['THCS', 'THPT'],
    });
    assert.equal(monthly.status, 201, JSON.stringify(monthly.body));
    plans.monthly = monthly.body.id as string;
    const topUp = await operator('POST', '/plans', {
      kind: 'top_up',
      name: 'Mua thêm 50 lượt',
      price: 45_000,
      turns: 50,
      school_levels: ['TH', 'THCS', 'THPT'],
    });
    assert.equal(topUp.status, 201);
    plans.topUp = topUp.body.id as string;
    const primaryOnly = await operator('POST', '/plans', {
      kind: 'monthly',
      name: 'Tiểu học tháng',
      price: 59_000,
      turns: 80,
      school_levels: ['TH'],
    });
    plans.primaryOnly = primaryOnly.body.id as string;
    const invalid = await operator('POST', '/plans', {
      kind: 'monthly',
      name: 'Miễn phí',
      price: 0,
      turns: 10,
      school_levels: ['TH'],
    });
    assert.equal(invalid.status, 400);
    assert.equal((await operator('GET', '/plans', undefined, supportToken)).status, 403, 'hỗ trợ trường không bán gói');
    assert.equal(
      (await operator('GET', '/plans', undefined, adminToken, environment.hosts.alpha as string)).status,
      404,
    );

    const renamed = await operator('PUT', `/plans/${plans.monthly}`, {
      name: 'Cơ bản tháng',
      price: 89_000,
      turns: 120,
      school_levels: ['THCS', 'THPT'],
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.turns, 120);
    assert.equal(
      (
        await operator('PUT', `/plans/${plans.monthly}`, {
          kind: 'top_up',
          name: 'X',
          price: 1000,
          turns: 1,
          school_levels: ['TH'],
        })
      ).status,
      400,
      'không đổi loại gói',
    );
    const archived = await operator('POST', `/plans/${plans.primaryOnly}/status`, { status: 'archived' });
    assert.equal(archived.body.status, 'archived');
    const audit = await environment.platform.platform
      .selectFrom('platform_audit_log')
      .select('action')
      .where('action', 'like', 'ai-tutor.plan-%')
      .execute();
    assert.deepEqual(audit.map((row) => row.action).sort(), [
      'ai-tutor.plan-archive',
      'ai-tutor.plan-create',
      'ai-tutor.plan-create',
      'ai-tutor.plan-create',
      'ai-tutor.plan-update',
    ]);
  });

  it('CT-383-L1b-2: phụ huynh mua gói tháng qua cổng giả lập: chờ thanh toán, có mã QR, thu tiền thì kích hoạt và có biên lai', async () => {
    const overview = await parent('GET', `/children/${childId}`);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.school_level, 'THCS');
    assert.deepEqual(
      (overview.body.plans as Array<Record<string, unknown>>).map((plan) => plan.name),
      ['Cơ bản tháng', 'Mua thêm 50 lượt'],
      'chỉ gói đang bán của cấp Trung học cơ sở',
    );
    assert.equal((overview.body.payment as Record<string, unknown>).simulated, true);
    assert.equal(
      ((await parent('GET', `/children/${primaryChildId}`)).body.plans as unknown[]).length,
      1,
      'gói Tiểu học đã ngừng bán',
    );

    const created = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.monthly });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'pending');
    assert.equal(created.body.amount, 89_000);
    assert.equal(created.body.turns, 120, 'giá và số lượt chụp lại lúc mua');
    assert.match(String(created.body.code), /^GD-\d{8}-\d{4,}$/);
    assert.match(String(created.body.qr_content), /^GIA-LAP\|/);
    const orderId = created.body.id as string;
    const pending = await subscriptionOf(orderId);
    assert.equal(pending.status, 'pending');
    assert.equal(pending.plan_source, 'platform');
    assert.ok(pending.pending_expires_at);

    const again = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.monthly });
    assert.equal(again.status, 409, 'đang có gói tháng chờ thanh toán');
    assert.match(String((again.body.error as Record<string, unknown>).message), /mua trực tiếp/);

    const paid = await parent('POST', `/orders/${orderId}/simulate-payment`);
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.body.status, 'paid');
    const receipt = paid.body.receipt as Record<string, unknown>;
    assert.match(String(receipt.number), /^BL-\d{8}-\d{4,}$/);
    assert.equal(receipt.amount, 89_000);
    assert.equal(receipt.payer_name, (await subscriptionOf(orderId)).buyer_name);
    assert.equal((await subscriptionOf(orderId)).status, 'active');
    assert.equal((await subscriptionOf(orderId)).external_reference, created.body.code);
    assert.deepEqual(await aiTutorTurnBalance(system, childId, new Date()), { monthly: 120, topUp: 0 });
    const notification = await runAsSchool(await environment.tenantOf('alpha'), async () =>
      (await environment.api.get(CurrentSchoolYearResolver).require()).database
        .selectFrom('notifications')
        .select(['title', 'body'])
        .where('template_code', '=', 'ai_tutor_receipt')
        .executeTakeFirst(),
    );
    assert.match(String(notification?.body), new RegExp(String(receipt.number)));
    assert.equal(
      (await parent('POST', `/orders/${orderId}/simulate-payment`)).body.status,
      'paid',
      'tiền vào lần nữa không đổi giao dịch đã thu',
    );
    assert.equal((await aiTutorTurnBalance(system, childId, new Date())).monthly, 120);
  });

  it('CT-383-L1b-3: không mua trực tiếp được gói tháng khi con đã có gói tháng mua qua trường trong tháng đó', async () => {
    const now = new Date();
    const current = vietnamMonthOf(now);
    const next = new Date(`${current}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const nextMonth = next.toISOString().slice(0, 10);
    const school = await createAiTutorSubscription(
      system,
      {
        childId,
        childSchoolLevel: 'THCS',
        plan: {
          source: 'school',
          id: randomUUID(),
          kind: 'monthly',
          name: 'Cơ bản của trường',
          price: 79_000,
          turns: 100,
          allowImages: false,
          schoolLevels: ['THCS'],
          status: 'active',
        },
        periodMonth: nextMonth,
        buyerUserId: randomUUID(),
        buyerName: 'Phụ huynh thử',
        pendingExpiresAt: null,
      },
      now,
    );
    assert.equal(school.ok, true);
    await activateAiTutorSubscription(system, (school as { subscriptionId: string }).subscriptionId, now, 'HP-THU');
    const blocked = await parent('POST', `/children/${childId}/orders`, {
      plan_id: plans.monthly,
      period_month: nextMonth,
    });
    assert.equal(blocked.status, 409);
    assert.match(String((blocked.body.error as Record<string, unknown>).message), /mua qua trường/);
    const pastMonth = await parent('POST', `/children/${childId}/orders`, {
      plan_id: plans.monthly,
      period_month: '2026-01-01',
    });
    assert.equal(pastMonth.status, 409);
    const wrongLevel = await parent('POST', `/children/${primaryChildId}/orders`, { plan_id: plans.monthly });
    assert.equal(wrongLevel.status, 409, 'gói không áp dụng cho Tiểu học');
    const notGuardian = await environment.call('alpha', 'GET', `/ai-tutor/direct/children/${childId}`);
    assert.equal(notGuardian.status, 403, 'quản trị trường không phải phụ huynh của con');
  });

  it('CT-383-L1b-4: hết hạn giữ chỗ thì việc nền đóng giao dịch, bỏ lần mua chờ; tiền đến muộn chuyển chờ hoàn tiền', async () => {
    const created = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const orderId = created.body.id as string;
    await environment.platform.platform
      .updateTable('platform_ai_tutor_orders')
      .set({ pending_expires_at: new Date(Date.now() - 60_000) })
      .where('id', '=', orderId)
      .execute();
    const tenant = await environment.tenantOf('alpha');
    const closed = await runAsSchool(tenant, () => environment.api.get(PlatformAiTutorExpiryJob).run(new Date()));
    assert.equal(closed, 1);
    assert.equal((await orderRow(orderId)).status, 'expired');
    const subscription = await subscriptionOf(orderId);
    assert.equal(subscription.status, 'cancelled');
    assert.equal(subscription.cancel_reason, 'Quá hạn thanh toán');

    const late = await parent('POST', `/orders/${orderId}/simulate-payment`);
    assert.equal(late.status, 200);
    assert.equal(late.body.status, 'needs_refund', 'tiền đến sau hạn: không kích hoạt, chờ hoàn tiền');
    assert.equal(late.body.receipt, null);
    assert.equal((await subscriptionOf(orderId)).status, 'cancelled');
    assert.equal((await aiTutorTurnBalance(system, childId, new Date())).topUp, 0);

    const refunded = await operator('POST', `/orders/${orderId}/refund`, { reason: 'Tiền đến sau hạn giữ chỗ' });
    assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
    assert.equal(refunded.body.status, 'refunded');
  });

  it('CT-383-L1b-5: hoàn tiền giao dịch đã thu: ghi người thao tác, lần mua chuyển refunded, không hoàn hai lần', async () => {
    const created = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
    const orderId = created.body.id as string;
    assert.equal((await parent('POST', `/orders/${orderId}/simulate-payment`)).body.status, 'paid');
    assert.equal((await aiTutorTurnBalance(system, childId, new Date())).topUp, 50);

    assert.equal((await operator('POST', `/orders/${orderId}/refund`, { reason: 'Thử' }, supportToken)).status, 403);
    assert.equal(
      (await operator('POST', `/orders/${orderId}/refund`, { amount: 46_000, reason: 'Quá số' })).status,
      400,
    );
    assert.equal((await operator('POST', `/orders/${orderId}/refund`, { amount: 45_000 })).status, 400, 'thiếu lý do');
    const refunded = await operator('POST', `/orders/${orderId}/refund`, {
      amount: 30_000,
      reason: 'Phụ huynh mua nhầm',
    });
    assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
    assert.equal(refunded.body.status, 'refunded');
    const refund = refunded.body.refund as Record<string, unknown>;
    assert.equal(refund.amount, 30_000);
    assert.equal(refund.operator_name, 'Nhân viên quan_tri');
    assert.equal((await subscriptionOf(orderId)).status, 'refunded');
    assert.equal((await aiTutorTurnBalance(system, childId, new Date())).topUp, 0);
    assert.equal(
      (await operator('POST', `/orders/${orderId}/refund`, { reason: 'Lần hai' })).status,
      409,
      'không hoàn hai lần',
    );
    const audit = await environment.platform.platform
      .selectFrom('platform_audit_log')
      .select(['actor_id', 'details'])
      .where('action', '=', 'ai-tutor.order-refund')
      .execute();
    assert.equal(audit.length, 2);

    const list = await operator('GET', '/orders');
    assert.equal(list.status, 200);
    const rows = list.body as unknown as Array<Record<string, unknown>>;
    assert.ok(rows.some((row) => row.id === orderId && row.status === 'refunded' && row.refund_amount === 30_000));
    const detail = await operator('GET', `/orders/${orderId}`);
    assert.equal(detail.status, 200);
    assert.ok((detail.body.receipt as Record<string, unknown>).number);
    assert.equal((detail.body.payments as unknown[]).length, 1);
  });

  it('CT-383-L1b-6: hủy giao dịch đang chờ (phụ huynh, vận hành); giao dịch của trường khác không thấy', async () => {
    const first = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
    const cancelled = await parent('POST', `/orders/${String(first.body.id)}/cancel`);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal((await subscriptionOf(String(first.body.id))).status, 'cancelled');
    const second = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
    assert.equal((await operator('POST', `/orders/${String(second.body.id)}/cancel`, {})).status, 400, 'thiếu lý do');
    const byOperator = await operator('POST', `/orders/${String(second.body.id)}/cancel`, {
      reason: 'Phụ huynh nhờ hủy',
    });
    assert.equal(byOperator.body.status, 'cancelled');
    assert.equal((await operator('POST', `/orders/${String(second.body.id)}/refund`, { reason: 'X' })).status, 409);
    const betaView = await environment.call('beta', 'GET', `/ai-tutor/direct/orders/${String(second.body.id)}`);
    assert.equal(betaView.status, 404, 'trường khác không thấy giao dịch');
  });

  it('CT-383-L1b-7: cổng SePay của nền tảng báo tiền vào: khóa sai 401, khóa đúng kích hoạt, gửi lặp không ghi trùng, sai số tiền giữ chờ', async () => {
    const platform = environment.platform.platform;
    await savePlatformConnector(
      platform,
      environment.platform.masterKey,
      { connector: 'sepay', enabled: true, values: { webhook_api_key: 'khoa-sepay-gia-lap' } },
      { type: 'operator', id: randomUUID() },
    );
    await saveBillingSettings(
      platform,
      {
        ...(await readBillingSettings(platform)),
        receivingAccount: { bankBin: '970436', accountNumber: '0123456789', accountName: 'NEN TANG GIA LAP' },
      },
      { type: 'operator', id: randomUUID() },
    );
    try {
      const created = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.provider, 'sepay');
      assert.match(String(created.body.qr_content), /^000201/);
      const orderId = created.body.id as string;
      const hook = (key: string, body: unknown) =>
        new Promise<number>((resolve, reject) => {
          const url = new URL(`${environment.apiOrigin}/api/v1/platform-billing/webhooks/sepay`);
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
          request.end(JSON.stringify(body));
        });
      const transfer = {
        id: 383_001,
        transferType: 'in',
        transferAmount: 45_000,
        content: `MBVCB ${String(created.body.transfer_content)} thanh toan`,
        transactionDate: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
      };
      assert.equal(await hook('khoa-sai', transfer), 401, 'chữ ký sai');
      assert.equal((await orderRow(orderId)).status, 'pending', 'chữ ký sai không ghi gì');
      assert.equal(await hook('khoa-sepay-gia-lap', transfer), 200);
      assert.equal((await orderRow(orderId)).status, 'paid');
      assert.equal(await hook('khoa-sepay-gia-lap', transfer), 200, 'gửi lặp vẫn nhận');
      const payments = await platform
        .selectFrom('platform_ai_tutor_payments')
        .select('outcome')
        .where('order_id', '=', orderId)
        .execute();
      assert.deepEqual(
        payments.map((row) => row.outcome),
        ['activated'],
        'không ghi trùng',
      );
      assert.equal(
        (await platform.selectFrom('platform_ai_tutor_receipts').select('id').where('order_id', '=', orderId).execute())
          .length,
        1,
      );
      const invoicePayments = await platform
        .selectFrom('invoice_payments')
        .select('id')
        .where('provider_reference', '=', String(transfer.id))
        .execute();
      assert.equal(invoicePayments.length, 0, 'không đối chiếu nhầm với hóa đơn dịch vụ');

      const short = await parent('POST', `/children/${childId}/orders`, { plan_id: plans.topUp });
      const shortId = short.body.id as string;
      assert.equal(
        await hook('khoa-sepay-gia-lap', {
          ...transfer,
          id: 383_002,
          transferAmount: 40_000,
          content: String(short.body.transfer_content),
        }),
        200,
      );
      assert.equal((await orderRow(shortId)).status, 'pending', 'sai số tiền: giữ chờ để đối soát');
      const mismatch = await platform
        .selectFrom('platform_ai_tutor_payments')
        .select('outcome')
        .where('order_id', '=', shortId)
        .executeTakeFirstOrThrow();
      assert.equal(mismatch.outcome, 'amount_mismatch');
    } finally {
      await platform.deleteFrom('platform_integration_secrets').execute();
    }
  });
});

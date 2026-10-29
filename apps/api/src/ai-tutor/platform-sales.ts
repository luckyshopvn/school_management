import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import {
  readBillingSettings,
  writeAudit,
  type PlatformDatabase,
  type PlatformOperatorRole,
  type SystemDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  extractTenantHost,
  isMultiTenantMode,
  normalizeHost,
  PlatformOperatorTokenVerifier,
  readBearerToken,
  runAsSchool,
  unauthenticatedError,
  validationError,
} from '@school-management/server';
import { operatorRolesFor } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { PlatformPaymentGateways } from '../billing/billing.js';
import type { PlatformIncomingTransfer, PlatformTransferHandler } from '../billing/platform-transfer-handler.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import {
  isPeriodMonth,
  vietnamMonthOf,
  type AiTutorPlanKind,
  type AiTutorSchoolLevel,
  type PurchaseBlock,
} from './ai-tutor-rules.js';
import { activateAiTutorSubscription, aiTutorTurnBalance, createAiTutorSubscription } from './ai-tutor-turns.js';
import {
  canCancel,
  canRefund,
  decidePayment,
  orderCode,
  pendingExpiresAt,
  readPlanInput,
  readRefundInput,
  receiptDescription,
  receiptNumber,
  transferCodeIn,
  transferContentOf,
  type OrderStatus,
} from './platform-sales-rules.js';

// Nền tảng bán thẳng gói gia sư AI cho phụ huynh (YCTD-383 lát L1b; đề xuất Eric duyệt ngày 2026-10-30, Q1; bản mẫu MH-598 tab "Mua trực
// tiếp", MH-600 cổng vận hành):
// - phụ huynh chọn gói của nền tảng cho từng con: ghi lần mua ở trạng thái chờ (`createAiTutorSubscription` của L0, chung chỉ mục chặn mua
//   trùng gói tháng với nguồn trường bán) và một giao dịch ở cơ sở dữ liệu nền tảng, giữ chỗ 15 phút, nhận mã QR hoặc liên kết thanh toán
//   từ cổng mặc định của nền tảng (trên máy là cổng giả lập; không bao giờ dùng cổng của trường);
// - thông báo tiền vào của cổng nền tảng (đường dẫn không cần trường ở `billing.ts`) có nội dung `GSAI...` được chuyển về đây: ghi một lần
//   theo mã giao dịch của cổng, đúng số tiền và còn hạn giữ chỗ thì kích hoạt lần mua ở trường của con và lập biên lai; đến muộn thì chuyển
//   chờ hoàn tiền;
// - cổng vận hành: tạo, sửa, ngừng bán gói; danh sách giao dịch, biên lai; hủy giao dịch chờ, hoàn tiền (ghi người thao tác, lý do vào
//   nhật ký nền tảng). Việc chuyển tiền trả thật làm ngoài hệ thống;
// - việc nền theo trường đóng giao dịch quá hạn giữ chỗ và hủy lần mua đang chờ tương ứng.
// Cơ sở dữ liệu nền tảng không lưu họ tên học sinh, chỉ mã con; họ tên người mua có trên biên lai.

type PlatformClient = Kysely<PlatformDatabase>;
type SystemClient = Kysely<SystemDatabase>;
type OrderRow = Selectable<PlatformDatabase['platform_ai_tutor_orders']>;
type PlanRow = Selectable<PlatformDatabase['platform_ai_tutor_plans']>;

export const PLATFORM_AI_TUTOR_PATH_PREFIX = '/api/v1/platform-ai-tutor/';
const EXPIRY_JOB_SECONDS = 300;
const CAPABILITY_ROLES = operatorRolesFor('ai-tutor.sales');

const money = (value: string | number) => Number(value);
const dateText = (value: unknown): string | null =>
  value === null || value === undefined
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);

function planView(row: PlanRow) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    price: money(row.price),
    turns: row.turns,
    allow_images: row.allow_images,
    school_levels: row.school_levels,
    status: row.status,
    updated_at: row.updated_at,
  };
}

function blockMessage(block: PurchaseBlock, periodMonth: string | null): string {
  switch (block.code) {
    case 'plan_archived':
      return 'Gói này đã ngừng bán';
    case 'level_not_allowed':
      return 'Gói này không áp dụng cho cấp học của con';
    case 'period_invalid':
      return 'Tháng dùng không hợp lệ';
    case 'period_past':
      return 'Không mua được gói cho tháng đã qua';
    case 'monthly_exists': {
      const month = periodMonth ? `${Number(periodMonth.slice(5, 7))}/${periodMonth.slice(0, 4)}` : '';
      const where = block.source === 'school' ? 'mua qua trường' : 'mua trực tiếp';
      const state = block.status === 'pending' ? 'đang chờ thanh toán' : 'đang dùng';
      return `Con đã có gói tháng ${month} ${where} (${state}). Mỗi con chỉ có một gói tháng trong một tháng`;
    }
  }
}

@Injectable()
export class PlatformAiTutorSalesService implements PlatformTransferHandler {
  private readonly logger = new Logger(PlatformAiTutorSalesService.name);
  private readonly operators: PlatformOperatorTokenVerifier;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly gateways: PlatformPaymentGateways,
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.operators = new PlatformOperatorTokenVerifier(
      configuration.tokenPublicKeyPem,
      configuration.tokenPreviousPublicKeyPem ?? null,
    );
  }

  private get platform(): PlatformClient {
    if (!this.tenancy) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Mua trực tiếp từ nền tảng chỉ có ở nền tảng nhiều trường');
    }
    return this.tenancy.platform;
  }

  // Chạy việc trên cơ sở dữ liệu hệ thống của trường có con (giao dịch có thể đến từ điểm nhận không theo tên miền trường)
  private async inSchool<T>(schoolId: string, work: (system: SystemClient) => Promise<T>): Promise<T> {
    if (!this.tenancy) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
    }
    const current = currentTenant();
    if (current?.schoolId === schoolId) {
      return work(this.databases.system);
    }
    const tenant = await this.tenancy.registry.contextOf(schoolId);
    if (!tenant) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Trường của giao dịch không còn phục vụ');
    }
    return runAsSchool(tenant, () => work(this.databases.system));
  }

  // ---------- Phần của phụ huynh (theo tên miền của trường, mã phiên của phụ huynh) ----------

  private schoolOfRequest() {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Mua trực tiếp từ nền tảng chỉ có ở nền tảng nhiều trường');
    }
    return tenant;
  }

  // Người gọi phải là cha mẹ, người giám hộ của con; trả cấp học của lớp đang học (trống khi chưa xếp lớp hoặc học Mầm non)
  private async childOf(currentUser: CurrentUser, childId: string): Promise<{ level: AiTutorSchoolLevel | null }> {
    const { database } = await this.currentSchoolYear.require();
    const guardian = isUuid(childId)
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.id')
          .where('child_guardians.child_id', '=', childId)
          .where('guardians.user_id', '=', currentUser.id)
          .executeTakeFirst()
      : undefined;
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
    const enrolled = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select('classes.school_level')
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    const level = enrolled?.school_level;
    return { level: level === 'TH' || level === 'THCS' || level === 'THPT' ? level : null };
  }

  private async paymentState() {
    const gateway = (await this.gateways.registry()).defaultGateway;
    return {
      available: gateway.provider !== 'none',
      provider: gateway.provider,
      simulated: gateway.provider === 'development',
    };
  }

  private async ordersOf(schoolId: string, filter: { childId?: string; orderId?: string }) {
    let query = this.platform
      .selectFrom('platform_ai_tutor_orders as orders')
      .leftJoin('platform_ai_tutor_receipts as receipts', 'receipts.order_id', 'orders.id')
      .leftJoin('platform_ai_tutor_refunds as refunds', 'refunds.order_id', 'orders.id')
      .selectAll('orders')
      .select([
        'receipts.number as receipt_number',
        'receipts.payer_name as receipt_payer_name',
        'receipts.school_name as receipt_school_name',
        'receipts.description as receipt_description',
        'receipts.amount as receipt_amount',
        'receipts.provider as receipt_provider',
        'receipts.provider_reference as receipt_provider_reference',
        'receipts.issued_at as receipt_issued_at',
        'refunds.amount as refund_amount',
        'refunds.reason as refund_reason',
        'refunds.created_at as refunded_at',
      ])
      .where('orders.school_id', '=', schoolId);
    if (filter.childId) {
      query = query.where('orders.child_id', '=', filter.childId);
    }
    if (filter.orderId) {
      query = query.where('orders.id', '=', filter.orderId);
    }
    const rows = await query.orderBy('orders.created_at', 'desc').limit(30).execute();
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      child_id: row.child_id,
      kind: row.kind,
      plan_name: row.plan_name,
      plan_kind: row.plan_kind,
      period_month: dateText(row.period_month),
      turns: row.turns,
      amount: money(row.amount),
      status: row.status,
      pending_expires_at: row.pending_expires_at,
      transfer_content: row.transfer_content,
      provider: row.provider,
      qr_content: row.status === 'pending' ? row.qr_content : null,
      paid_at: row.paid_at,
      created_at: row.created_at,
      receipt: row.receipt_number
        ? {
            number: row.receipt_number,
            seller: 'Nền tảng quản lý trường học',
            payer_name: row.receipt_payer_name,
            school_name: row.receipt_school_name,
            description: row.receipt_description,
            amount: money(row.receipt_amount ?? 0),
            provider: row.receipt_provider,
            provider_reference: row.receipt_provider_reference,
            issued_at: row.receipt_issued_at,
          }
        : null,
      refund:
        row.refund_amount !== null
          ? { amount: money(row.refund_amount), reason: row.refund_reason, created_at: row.refunded_at }
          : null,
    }));
  }

  // Trang "Mua trực tiếp" của một con: gói của nền tảng theo cấp học, gói đang có (cả hai nguồn), số lượt còn, giao dịch và biên lai
  async childOverview(currentUser: CurrentUser, childId: string) {
    const tenant = this.schoolOfRequest();
    const { level } = await this.childOf(currentUser, childId);
    const now = this.clock.now();
    await this.expireSchoolOrders(tenant.schoolId, now);
    const system = this.databases.system;
    const [plans, subscriptions, balance, orders, payment] = await Promise.all([
      this.platform
        .selectFrom('platform_ai_tutor_plans')
        .selectAll()
        .where('status', '=', 'active')
        .orderBy('kind')
        .orderBy('price')
        .execute(),
      system
        .selectFrom('ai_tutor_subscriptions')
        .select([
          'id',
          'plan_source',
          'plan_kind',
          'plan_name',
          'period_month',
          'status',
          'turns',
          'used_turns',
          'allow_images',
          'valid_until',
        ])
        .where('child_id', '=', childId)
        .where('status', 'in', ['pending', 'active'])
        .where((expression) =>
          expression.or([expression('valid_until', 'is', null), expression('valid_until', '>', now)]),
        )
        .orderBy('created_at', 'desc')
        .execute(),
      aiTutorTurnBalance(system, childId, now),
      this.ordersOf(tenant.schoolId, { childId }),
      this.paymentState(),
    ]);
    const currentMonth = vietnamMonthOf(now);
    const next = new Date(`${currentMonth}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return {
      child_id: childId,
      school_level: level,
      payment,
      current_month: currentMonth,
      next_month: next.toISOString().slice(0, 10),
      plans: level ? plans.filter((plan) => plan.school_levels.includes(level)).map(planView) : [],
      subscriptions: subscriptions.map((row) => ({ ...row, period_month: dateText(row.period_month) })),
      balance,
      orders,
    };
  }

  // Phụ huynh bấm mua: ghi lần mua chờ thanh toán ở trường, giao dịch ở nền tảng, mã QR hoặc liên kết thanh toán của cổng nền tảng
  async createOrder(currentUser: CurrentUser, childId: string, body: RequestBody, payerIpAddress: string | null) {
    const tenant = this.schoolOfRequest();
    const { level } = await this.childOf(currentUser, childId);
    if (!level) {
      throw new ApplicationError(
        'ERR_CONFLICT',
        'Gia sư AI dành cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông',
      );
    }
    const planId = body?.plan_id;
    const plan = isUuid(planId)
      ? await this.platform
          .selectFrom('platform_ai_tutor_plans')
          .selectAll()
          .where('id', '=', planId)
          .executeTakeFirst()
      : undefined;
    if (!plan) {
      throw validationError([{ field: 'plan_id', message: 'Chọn một gói của nền tảng' }]);
    }
    const now = this.clock.now();
    let periodMonth: string | null = null;
    if (plan.kind === 'monthly') {
      const requested = body?.period_month ?? vietnamMonthOf(now);
      if (typeof requested !== 'string' || !isPeriodMonth(requested)) {
        throw validationError([{ field: 'period_month', message: 'Tháng dùng dạng năm-tháng-01' }]);
      }
      periodMonth = requested;
    }
    const gateway = (await this.gateways.registry()).defaultGateway;
    if (gateway.provider === 'none') {
      throw new ApplicationError('ERR_CONFLICT', 'Nền tảng chưa mở thanh toán trực tuyến');
    }
    const expiresAt = pendingExpiresAt(now);
    const system = this.databases.system;
    const purchase = await createAiTutorSubscription(
      system,
      {
        childId,
        childSchoolLevel: level,
        plan: {
          source: 'platform',
          id: plan.id,
          kind: plan.kind,
          name: plan.name,
          price: plan.price,
          turns: plan.turns,
          allowImages: plan.allow_images,
          schoolLevels: plan.school_levels,
          status: plan.status,
        },
        periodMonth,
        buyerUserId: currentUser.id,
        buyerName: currentUser.description.full_name,
        pendingExpiresAt: expiresAt,
      },
      now,
    );
    if (!purchase.ok) {
      throw new ApplicationError('ERR_CONFLICT', blockMessage(purchase.block, periodMonth));
    }
    const amount = money(plan.price);
    try {
      const sequence = await this.nextValue('platform_ai_tutor_order_number_seq');
      const code = orderCode(now, sequence);
      const transferContent = transferContentOf(now, sequence);
      const settings = await readBillingSettings(this.platform);
      const account = settings.receivingAccount;
      const created = await gateway.createPaymentRequest({
        invoiceCode: code,
        transferContent,
        amount,
        childName: `Gia su AI ${plan.name}`,
        receivingAccountNumber: account.accountNumber ?? '',
        receivingAccountName: account.accountName ?? '',
        receivingBankBin: account.bankBin,
        payerIpAddress,
      });
      const order = await this.platform
        .insertInto('platform_ai_tutor_orders')
        .values({
          code,
          transfer_content: transferContent,
          school_id: tenant.schoolId,
          school_name: tenant.name,
          child_id: childId,
          subscription_id: purchase.subscriptionId,
          buyer_user_id: currentUser.id,
          buyer_name: currentUser.description.full_name,
          plan_id: plan.id,
          plan_name: plan.name,
          plan_kind: plan.kind,
          period_month: periodMonth,
          turns: plan.turns,
          amount,
          pending_expires_at: expiresAt,
          provider: created.provider,
          provider_reference: created.providerReference,
          qr_content: created.qrContent,
          created_at: now,
          updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return this.parentOrder(currentUser, order.id);
    } catch (error) {
      // Không tạo được yêu cầu thanh toán: bỏ chỗ đã giữ để phụ huynh mua lại được ngay
      await this.cancelSubscription(system, purchase.subscriptionId, 'Không tạo được yêu cầu thanh toán', now);
      throw error;
    }
  }

  private async nextValue(sequence: string): Promise<number> {
    const result = await sql<{ value: string }>`select nextval(${sequence}) as value`.execute(this.platform);
    return Number(result.rows[0]?.value);
  }

  private async cancelSubscription(system: SystemClient, subscriptionId: string, reason: string, now: Date) {
    await system
      .updateTable('ai_tutor_subscriptions')
      .set({ status: 'cancelled', cancelled_at: now, cancel_reason: reason, updated_at: now })
      .where('id', '=', subscriptionId)
      .where('status', '=', 'pending')
      .execute();
  }

  // Giao dịch của phụ huynh: chỉ giao dịch của trường hiện tại và của con mà người gọi là cha mẹ, người giám hộ
  private async ownOrder(currentUser: CurrentUser, orderId: string): Promise<OrderRow> {
    const tenant = this.schoolOfRequest();
    const order = isUuid(orderId)
      ? await this.platform
          .selectFrom('platform_ai_tutor_orders')
          .selectAll()
          .where('id', '=', orderId)
          .where('school_id', '=', tenant.schoolId)
          .executeTakeFirst()
      : undefined;
    if (!order) {
      throw notFoundError('Không tìm thấy giao dịch', 'platform_ai_tutor_order');
    }
    await this.childOf(currentUser, order.child_id);
    return order;
  }

  async parentOrder(currentUser: CurrentUser, orderId: string) {
    const order = await this.ownOrder(currentUser, orderId);
    await this.expireSchoolOrders(order.school_id, this.clock.now());
    const [view] = await this.ordersOf(order.school_id, { orderId: order.id });
    return view;
  }

  // Phụ huynh bỏ giao dịch đang chờ thanh toán
  async parentCancel(currentUser: CurrentUser, orderId: string) {
    const order = await this.ownOrder(currentUser, orderId);
    await this.closePending(order, 'cancelled', 'Phụ huynh hủy trước khi thanh toán');
    return this.parentOrder(currentUser, orderId);
  }

  // Giả lập tiền vào đủ số tiền: chỉ khi cổng mặc định của nền tảng là bộ giả lập (máy phát triển, kiểm thử); đi đúng đường của thông báo
  // tiền vào thật
  async parentSimulate(currentUser: CurrentUser, orderId: string) {
    const order = await this.ownOrder(currentUser, orderId);
    if ((await this.paymentState()).provider !== 'development') {
      throw new NotFoundException();
    }
    const now = this.clock.now();
    await this.receiveTransfer(
      {
        provider: 'development',
        providerTransactionRef: `GIA-LAP-${randomUUID()}`,
        amount: money(order.amount),
        transferContent: `${order.transfer_content} GIA LAP`,
        receivedAt: now,
      },
      now,
    );
    return this.parentOrder(currentUser, orderId);
  }

  // ---------- Tiền vào và đóng giao dịch quá hạn ----------

  // Khoản tiền vào của cổng nền tảng. Không có mã `GSAI...` trong nội dung thì trả false để điểm nhận đối chiếu với hóa đơn dịch vụ
  async receiveTransfer(transfer: PlatformIncomingTransfer, now: Date): Promise<boolean> {
    const code = transferCodeIn(transfer.transferContent);
    if (!code || !this.tenancy) {
      return false;
    }
    const outcome = await this.platform.transaction().execute(async (transaction) => {
      const order = await transaction
        .selectFrom('platform_ai_tutor_orders')
        .selectAll()
        .where('transfer_content', '=', code)
        .forUpdate()
        .executeTakeFirst();
      const payment = await transaction
        .insertInto('platform_ai_tutor_payments')
        .values({
          order_id: order?.id ?? null,
          provider: transfer.provider,
          provider_reference: transfer.providerTransactionRef,
          amount: transfer.amount,
          transfer_content: transfer.transferContent.slice(0, 500),
          received_at: transfer.receivedAt,
          outcome: 'unmatched',
        })
        .onConflict((conflict) => conflict.columns(['provider', 'provider_reference']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!payment) {
        // Cổng gửi lại thông báo đã nhận: không ghi gì thêm
        return { kind: 'duplicate' as const };
      }
      if (!order) {
        return { kind: 'unmatched' as const };
      }
      const decision = decidePayment(
        { status: order.status, amount: money(order.amount), pendingExpiresAt: order.pending_expires_at },
        { amount: transfer.amount, receivedAt: transfer.receivedAt },
      );
      let result: 'activated' | 'already_settled' | 'amount_mismatch' | 'late' =
        decision === 'activate' ? 'late' : decision;
      if (decision === 'activate') {
        const activated = await this.inSchool(order.school_id, (system) => this.activate(system, order, now));
        result = activated ? 'activated' : 'late';
      }
      if (result === 'activated') {
        await this.markPaid(transaction, order, transfer, now);
      } else if (result === 'late') {
        if (order.status === 'pending') {
          await this.inSchool(order.school_id, (system) =>
            this.cancelSubscription(system, order.subscription_id, 'Tiền đến sau hạn giữ chỗ', now),
          );
        }
        await transaction
          .updateTable('platform_ai_tutor_orders')
          .set({ status: 'needs_refund', updated_at: now })
          .where('id', '=', order.id)
          .execute();
      }
      await transaction
        .updateTable('platform_ai_tutor_payments')
        .set({ outcome: result })
        .where('id', '=', payment.id)
        .execute();
      return { kind: result, order };
    });
    this.logger.log(`Tiền vào gia sư AI ${transfer.provider}: ${outcome.kind} ${code}`);
    if (outcome.kind === 'activated') {
      await this.notifyReceipt(outcome.order).catch((error: unknown) =>
        this.logger.warn(
          `Không gửi được thông báo biên lai: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    return true;
  }

  // Kích hoạt lần mua ở trường; lần thử trước đã kích hoạt (giao dịch ở nền tảng lỗi sau đó) thì vẫn coi là đã kích hoạt
  private async activate(system: SystemClient, order: OrderRow, now: Date): Promise<boolean> {
    if (await activateAiTutorSubscription(system, order.subscription_id, now, order.code)) {
      return true;
    }
    const row = await system
      .selectFrom('ai_tutor_subscriptions')
      .select(['status', 'external_reference'])
      .where('id', '=', order.subscription_id)
      .executeTakeFirst();
    return row?.status === 'active' && row.external_reference === order.code;
  }

  private async markPaid(
    transaction: Transaction<PlatformDatabase>,
    order: OrderRow,
    transfer: PlatformIncomingTransfer,
    now: Date,
  ) {
    await transaction
      .updateTable('platform_ai_tutor_orders')
      .set({ status: 'paid', paid_at: transfer.receivedAt, updated_at: now })
      .where('id', '=', order.id)
      .execute();
    const sequence = await sql<{
      value: string;
    }>`select nextval('platform_ai_tutor_receipt_number_seq') as value`.execute(transaction);
    await transaction
      .insertInto('platform_ai_tutor_receipts')
      .values({
        order_id: order.id,
        number: receiptNumber(now, Number(sequence.rows[0]?.value)),
        payer_name: order.buyer_name,
        school_name: order.school_name,
        description: receiptDescription({
          planName: order.plan_name,
          planKind: order.plan_kind,
          periodMonth: dateText(order.period_month),
          turns: order.turns,
          kind: order.kind,
        }),
        amount: order.amount,
        provider: transfer.provider,
        provider_reference: transfer.providerTransactionRef,
        issued_at: now,
      })
      .execute();
  }

  // Thông báo trong ứng dụng cho người mua kèm số biên lai
  private async notifyReceipt(order: OrderRow) {
    const receipt = await this.platform
      .selectFrom('platform_ai_tutor_receipts')
      .select(['number', 'description', 'amount'])
      .where('order_id', '=', order.id)
      .executeTakeFirst();
    if (!receipt) {
      return;
    }
    await this.inSchool(order.school_id, async () => {
      const current = await this.currentSchoolYear.find();
      if (!current) {
        return;
      }
      const root = await current.database
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      await queueNotification(current.database, {
        orgUnitId: root?.id ?? null,
        templateCode: 'ai_tutor_receipt',
        title: 'Đã thu tiền gói gia sư AI',
        body: `Biên lai ${receipt.number}: ${receipt.description}, ${money(receipt.amount).toLocaleString('vi-VN')} đồng`,
        targetType: 'platform_ai_tutor_orders',
        targetId: order.id,
        recipients: [{ userId: order.buyer_user_id, channel: 'in_app' }],
      });
    });
  }

  // Đóng giao dịch đang chờ (quá hạn hoặc hủy) và bỏ lần mua đang chờ ở trường. Giao dịch đã đổi trạng thái thì không làm gì
  private async closePending(order: OrderRow, status: 'expired' | 'cancelled', reason: string): Promise<boolean> {
    if (!canCancel(order.status)) {
      throw new ApplicationError('ERR_CONFLICT', 'Chỉ hủy được giao dịch đang chờ thanh toán');
    }
    const now = this.clock.now();
    return this.platform.transaction().execute(async (transaction) => {
      const closed = await transaction
        .updateTable('platform_ai_tutor_orders')
        .set({ status, cancelled_at: now, cancel_reason: reason, updated_at: now })
        .where('id', '=', order.id)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      if (closed.numUpdatedRows !== 1n) {
        return false;
      }
      await this.inSchool(order.school_id, (system) =>
        this.cancelSubscription(system, order.subscription_id, reason, now),
      );
      return true;
    });
  }

  // Đóng các giao dịch của trường đã quá hạn giữ chỗ; trả số giao dịch đã đóng
  async expireSchoolOrders(schoolId: string, now: Date): Promise<number> {
    if (!this.tenancy) {
      return 0;
    }
    const due = await this.platform
      .selectFrom('platform_ai_tutor_orders')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('status', '=', 'pending')
      .where('pending_expires_at', '<=', now)
      .execute();
    let closed = 0;
    for (const order of due) {
      if (await this.closePending(order, 'expired', 'Quá hạn thanh toán')) {
        closed += 1;
      }
    }
    return closed;
  }

  // ---------- Cổng vận hành (đường dẫn không cần trường, tên miền cổng nền tảng, mã phiên vận hành) ----------

  private hostOf(request: Request): string | undefined {
    const tenancy = this.tenancy;
    return tenancy
      ? extractTenantHost(
          request.headers,
          tenancy.configuration.hostSource,
          tenancy.configuration.edgeSecret ?? undefined,
        )
      : undefined;
  }

  async operator(request: Request): Promise<{ id: string; name: string }> {
    const consoleHost = normalizeHost(this.configuration.platformConsoleHost ?? undefined);
    if (!this.tenancy || !consoleHost || this.hostOf(request) !== consoleHost) {
      throw new NotFoundException();
    }
    const operatorId = await this.operators.verify(readBearerToken(request.header('authorization')), this.clock.now());
    const row = await this.platform
      .selectFrom('platform_operators')
      .select(['status', 'role', 'must_change_password', 'full_name'])
      .where('id', '=', operatorId)
      .executeTakeFirst();
    if (row?.status !== 'active') {
      throw unauthenticatedError();
    }
    if (row.must_change_password) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục');
    }
    if (!(CAPABILITY_ROLES as readonly PlatformOperatorRole[]).includes(row.role)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Vai trò vận hành của bạn không được làm thao tác này');
    }
    return { id: operatorId, name: row.full_name };
  }

  async listPlans(request: Request) {
    await this.operator(request);
    const [plans, sold] = await Promise.all([
      this.platform
        .selectFrom('platform_ai_tutor_plans')
        .selectAll()
        .orderBy('status')
        .orderBy('kind')
        .orderBy('price')
        .execute(),
      this.platform
        .selectFrom('platform_ai_tutor_orders')
        .select(['plan_id', (expression) => expression.fn.countAll<string>().as('total')])
        .where('status', '=', 'paid')
        .groupBy('plan_id')
        .execute(),
    ]);
    const paid = new Map(sold.map((row) => [row.plan_id, Number(row.total)]));
    return plans.map((plan) => ({ ...planView(plan), paid_orders: paid.get(plan.id) ?? 0 }));
  }

  async createPlan(request: Request, body: RequestBody) {
    const operator = await this.operator(request);
    const { value, errors } = readPlanInput(body, null);
    if (!value) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const created = await this.platform
      .insertInto('platform_ai_tutor_plans')
      .values({
        kind: value.kind,
        name: value.name,
        price: value.price,
        turns: value.turns,
        allow_images: value.allowImages,
        school_levels: value.schoolLevels,
        created_by: operator.id,
        created_by_name: operator.name,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: operator.id,
      action: 'ai-tutor.plan-create',
      details: { plan_id: created.id, ...value },
    });
    return planView(created);
  }

  private async planOrThrow(id: string): Promise<PlanRow> {
    const plan = isUuid(id)
      ? await this.platform.selectFrom('platform_ai_tutor_plans').selectAll().where('id', '=', id).executeTakeFirst()
      : undefined;
    if (!plan) {
      throw notFoundError('Không tìm thấy gói', 'platform_ai_tutor_plan');
    }
    return plan;
  }

  // Sửa gói: lần mua đã ghi giữ giá, số lượt lúc mua (L0 chụp lại gói), nên sửa chỉ áp dụng cho lần mua sau
  async updatePlan(request: Request, id: string, body: RequestBody) {
    const operator = await this.operator(request);
    const plan = await this.planOrThrow(id);
    const { value, errors } = readPlanInput(body, plan.kind as AiTutorPlanKind);
    if (!value) {
      throw validationError(errors);
    }
    const updated = await this.platform
      .updateTable('platform_ai_tutor_plans')
      .set({
        name: value.name,
        price: value.price,
        turns: value.turns,
        allow_images: value.allowImages,
        school_levels: value.schoolLevels,
        updated_at: this.clock.now(),
      })
      .where('id', '=', plan.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: operator.id,
      action: 'ai-tutor.plan-update',
      details: {
        plan_id: plan.id,
        before: { name: plan.name, price: money(plan.price), turns: plan.turns, school_levels: plan.school_levels },
        after: value,
      },
    });
    return planView(updated);
  }

  // Ngừng bán hoặc mở bán lại; gói đã bán vẫn dùng tới hết hạn
  async setPlanStatus(request: Request, id: string, body: RequestBody) {
    const operator = await this.operator(request);
    const plan = await this.planOrThrow(id);
    const status = body?.status;
    if (status !== 'active' && status !== 'archived') {
      throw validationError([
        { field: 'status', message: 'Trạng thái là active (đang bán) hoặc archived (ngừng bán)' },
      ]);
    }
    const updated = await this.platform
      .updateTable('platform_ai_tutor_plans')
      .set({ status, updated_at: this.clock.now() })
      .where('id', '=', plan.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: operator.id,
      action: status === 'archived' ? 'ai-tutor.plan-archive' : 'ai-tutor.plan-restore',
      details: { plan_id: plan.id, name: plan.name },
    });
    return planView(updated);
  }

  async listOrders(request: Request, status: string | undefined) {
    await this.operator(request);
    let query = this.platform
      .selectFrom('platform_ai_tutor_orders as orders')
      .leftJoin('platform_ai_tutor_receipts as receipts', 'receipts.order_id', 'orders.id')
      .leftJoin('platform_ai_tutor_refunds as refunds', 'refunds.order_id', 'orders.id')
      .select([
        'orders.id',
        'orders.code',
        'orders.school_name',
        'orders.plan_name',
        'orders.plan_kind',
        'orders.kind',
        'orders.period_month',
        'orders.amount',
        'orders.status',
        'orders.created_at',
        'orders.paid_at',
        'receipts.number as receipt_number',
        'refunds.amount as refund_amount',
      ]);
    if (status && ['pending', 'paid', 'expired', 'cancelled', 'refunded', 'needs_refund'].includes(status)) {
      query = query.where('orders.status', '=', status as OrderStatus);
    }
    const rows = await query.orderBy('orders.created_at', 'desc').limit(200).execute();
    return rows.map((row) => ({
      ...row,
      period_month: dateText(row.period_month),
      amount: money(row.amount),
      refund_amount: row.refund_amount === null ? null : money(row.refund_amount),
    }));
  }

  private async orderForOperator(id: string): Promise<OrderRow> {
    const order = isUuid(id)
      ? await this.platform.selectFrom('platform_ai_tutor_orders').selectAll().where('id', '=', id).executeTakeFirst()
      : undefined;
    if (!order) {
      throw notFoundError('Không tìm thấy giao dịch', 'platform_ai_tutor_order');
    }
    return order;
  }

  async orderDetail(request: Request, id: string) {
    await this.operator(request);
    const order = await this.orderForOperator(id);
    const [view] = await this.ordersOf(order.school_id, { orderId: order.id });
    const payments = await this.platform
      .selectFrom('platform_ai_tutor_payments')
      .select(['provider', 'provider_reference', 'amount', 'received_at', 'outcome'])
      .where('order_id', '=', order.id)
      .orderBy('received_at')
      .execute();
    const refund = await this.platform
      .selectFrom('platform_ai_tutor_refunds')
      .select(['operator_name', 'created_at'])
      .where('order_id', '=', order.id)
      .executeTakeFirst();
    return {
      ...view,
      school_name: order.school_name,
      buyer_name: order.buyer_name,
      cancel_reason: order.cancel_reason,
      refund: view?.refund ? { ...view.refund, operator_name: refund?.operator_name ?? null } : null,
      payments: payments.map((row) => ({ ...row, amount: money(row.amount) })),
    };
  }

  async operatorCancel(request: Request, id: string, body: RequestBody) {
    const operator = await this.operator(request);
    const order = await this.orderForOperator(id);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 1 || reason.length > 500) {
      throw validationError([{ field: 'reason', message: 'Nhập lý do hủy (tối đa 500 ký tự)' }]);
    }
    if (!(await this.closePending(order, 'cancelled', reason))) {
      throw new ApplicationError('ERR_CONFLICT', 'Giao dịch đã đổi trạng thái, hãy tải lại');
    }
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: operator.id,
      action: 'ai-tutor.order-cancel',
      schoolId: order.school_id,
      details: { order_id: order.id, code: order.code, reason },
    });
    return this.orderDetail(request, id);
  }

  // Hoàn tiền giao dịch đã thu (hoặc tiền đến muộn): ghi số hoàn, lý do, người thao tác; lần mua ở trường chuyển `refunded` nên con không
  // dùng tiếp lượt của gói này. Việc chuyển tiền trả phụ huynh làm ngoài hệ thống
  async refund(request: Request, id: string, body: RequestBody) {
    const operator = await this.operator(request);
    const order = await this.orderForOperator(id);
    if (!canRefund(order.status)) {
      throw new ApplicationError('ERR_CONFLICT', 'Chỉ hoàn được giao dịch đã thu tiền');
    }
    const { value, errors } = readRefundInput(body, money(order.amount));
    if (!value) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await this.platform.transaction().execute(async (transaction) => {
      const locked = await transaction
        .updateTable('platform_ai_tutor_orders')
        .set({ status: 'refunded', updated_at: now })
        .where('id', '=', order.id)
        .where('status', 'in', ['paid', 'needs_refund'])
        .executeTakeFirst();
      if (locked.numUpdatedRows !== 1n) {
        throw new ApplicationError('ERR_CONFLICT', 'Giao dịch đã đổi trạng thái, hãy tải lại');
      }
      await transaction
        .insertInto('platform_ai_tutor_refunds')
        .values({
          order_id: order.id,
          amount: value.amount,
          reason: value.reason,
          operator_id: operator.id,
          operator_name: operator.name,
          created_at: now,
        })
        .execute();
      await this.inSchool(order.school_id, (system) =>
        system
          .updateTable('ai_tutor_subscriptions')
          .set({
            status: 'refunded',
            cancelled_at: now,
            cancel_reason: `Hoàn tiền: ${value.reason}`.slice(0, 500),
            updated_at: now,
          })
          .where('id', '=', order.subscription_id)
          .where('status', 'in', ['pending', 'active'])
          .execute(),
      );
      await writeAudit(transaction, {
        actorType: 'operator',
        actorId: operator.id,
        action: 'ai-tutor.order-refund',
        schoolId: order.school_id,
        details: { order_id: order.id, code: order.code, amount: value.amount, reason: value.reason },
      });
    });
    return this.orderDetail(request, id);
  }
}

// Việc nền theo trường: đóng giao dịch quá hạn giữ chỗ của trường đó (chạy trong ngữ cảnh của trường, 5 phút một lần)
@Injectable()
export class PlatformAiTutorExpiryJob implements OnApplicationBootstrap {
  constructor(
    private readonly sales: PlatformAiTutorSalesService,
    private readonly clock: Clock,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'ai-tutor-direct-expiry',
        intervalSeconds: EXPIRY_JOB_SECONDS,
        run: async () => {
          await this.run();
        },
      });
    }
  }

  async run(now: Date = this.clock.now()): Promise<number> {
    const tenant = currentTenant();
    return tenant ? this.sales.expireSchoolOrders(tenant.schoolId, now) : 0;
  }
}

import { sql, type Kysely, type Transaction } from 'kysely';
import type { BillingPeriod, PlatformDatabase, PriceComponent, StudentTier } from '../../platform/schema.js';
import { writeAudit } from '../provision-school.js';
import { addDays, asDateText, daysBetween } from '../school-plans.js';
import { createEInvoiceProvider } from './einvoice.js';
import { nextPeriod, periodContaining, periodLabel, previousPeriod, type BillingRange } from './periods.js';
import { computeCharges, ruleFromPlanPrices, type BillingUsage, type Charges, type PriceRule } from './pricing.js';

// Thu phí tự động (DT-SaaS phần S5b, YCTD-196; tài liệu 32 mục 14.5): chốt số liệu kỳ, lập hóa đơn, nhận tiền và đối soát, gia hạn và mở
// lại trường, nhắc gia hạn, điều chỉnh tay, hóa đơn điện tử. Hàm thư viện trên cơ sở dữ liệu nền tảng, dùng chung cho máy chủ API (việc
// nền theo trường, trang hóa đơn của trường, gọi lại của cổng), dịch vụ định danh (cổng vận hành) và lệnh `platform`.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - thu sau: cuối kỳ chốt số học sinh đang học của kỳ vừa xong rồi lập hóa đơn kỳ đó, hạn trả là cuối kỳ cộng số ngày hạn của quy tắc;
//   `schools.paid_until` là hạn đang chờ trả (bộ chuyển trạng thái của S5a dựa vào đó); trả đủ thì hạn dời tới hạn của hóa đơn kỳ sau;
// - chỉ lập hóa đơn tự động cho trường hoạt động hoặc chỉ đọc đã gán gói; tổng bằng 0 thì chỉ chốt số liệu; trường dùng thử chỉ có hóa
//   đơn do vận hành lập, trả đủ thì chuyển hoạt động;
// - tiền vào đối chiếu theo nội dung chuyển khoản chứa mã hóa đơn bỏ dấu gạch; trùng mã giao dịch của cổng bỏ qua; trả đủ thì mở lại
//   trường chỉ đọc; trường tạm ngưng do vận hành mở lại.

export interface BillingSettings {
  invoicePrefix: string;
  receivingAccount: { bankBin: string | null; accountNumber: string | null; accountName: string | null };
  einvoiceProvider: string;
  autoIssueEinvoice: boolean;
  remindDaysBefore: number[];
  remindDaysAfter: number[];
  channels: string[];
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  invoicePrefix: 'HD',
  receivingAccount: { bankBin: null, accountNumber: null, accountName: null },
  einvoiceProvider: 'none',
  autoIssueEinvoice: false,
  remindDaysBefore: [15, 7, 1],
  remindDaysAfter: [1, 3],
  channels: ['in_app'],
};

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'conflict' | 'invalid' = 'invalid',
  ) {
    super(message);
  }
}

type Executor = Kysely<PlatformDatabase> | Transaction<PlatformDatabase>;
type Actor = { type: 'operator' | 'system' | 'cli'; id?: string };

const days = (value: unknown, fallback: number[]) =>
  Array.isArray(value) ? value.filter((day): day is number => Number.isInteger(day) && day >= 0) : fallback;
const textOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export async function readBillingSettings(platform: Executor): Promise<BillingSettings> {
  const row = await platform.selectFrom('platform_settings').select('value').where('key', '=', 'billing').executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const account = (value.receiving_account ?? {}) as Record<string, unknown>;
  const prefix = typeof value.invoice_prefix === 'string' && /^[A-Z]{1,6}$/.test(value.invoice_prefix) ? value.invoice_prefix : 'HD';
  return {
    invoicePrefix: prefix,
    receivingAccount: {
      bankBin: textOrNull(account.bank_bin),
      accountNumber: textOrNull(account.account_number),
      accountName: textOrNull(account.account_name),
    },
    einvoiceProvider: typeof value.einvoice_provider === 'string' ? value.einvoice_provider : 'none',
    autoIssueEinvoice: value.auto_issue_einvoice === true,
    remindDaysBefore: days(value.remind_days_before, DEFAULT_BILLING_SETTINGS.remindDaysBefore),
    remindDaysAfter: days(value.remind_days_after, DEFAULT_BILLING_SETTINGS.remindDaysAfter),
    channels: Array.isArray(value.channels)
      ? value.channels.filter((channel): channel is string => channel === 'in_app' || channel === 'sms')
      : DEFAULT_BILLING_SETTINGS.channels,
  };
}

export async function saveBillingSettings(platform: Kysely<PlatformDatabase>, settings: BillingSettings, actor: Actor) {
  const value = {
    invoice_prefix: settings.invoicePrefix,
    receiving_account: {
      bank_bin: settings.receivingAccount.bankBin,
      account_number: settings.receivingAccount.accountNumber,
      account_name: settings.receivingAccount.accountName,
    },
    einvoice_provider: settings.einvoiceProvider,
    auto_issue_einvoice: settings.autoIssueEinvoice,
    remind_days_before: settings.remindDaysBefore,
    remind_days_after: settings.remindDaysAfter,
    channels: settings.channels,
  };
  await platform
    .insertInto('platform_settings')
    .values({ key: 'billing', value: JSON.stringify(value) })
    .onConflict((conflict) => conflict.column('key').doUpdateSet({ value: JSON.stringify(value), updated_at: new Date() }))
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'billing.settings-update',
    details: value,
  });
}

// ---------- Quy tắc tính phí của trường

export interface PriceRuleRow {
  code: string;
  name: string;
  components: PriceComponent[];
  student_tiers: StudentTier[];
  tier_mode: 'graduated' | 'volume';
  school_fee: string | number;
  module_prices: Record<string, number>;
  minimum_fee: string | number;
  period: BillingPeriod;
  vat_percent: number;
  due_days: number;
}

export function priceRuleOf(row: PriceRuleRow): PriceRule {
  return {
    code: row.code,
    name: row.name,
    components: row.components,
    studentTiers: row.student_tiers,
    tierMode: row.tier_mode,
    schoolFee: Number(row.school_fee),
    modulePrices: row.module_prices,
    minimumFee: Number(row.minimum_fee),
    period: row.period,
    vatPercent: row.vat_percent,
    dueDays: row.due_days,
  };
}

export interface SchoolBillingPlan {
  planId: string;
  planCode: string;
  planName: string;
  modules: string[] | null;
  effectiveFrom: string;
  rule: PriceRule;
}

// Gói hiện hành của trường kèm quy tắc tính phí (gói chưa chọn quy tắc thì dùng giá niêm yết của gói)
export async function loadBillingPlan(
  platform: Executor,
  schoolId: string,
  today: string,
): Promise<SchoolBillingPlan | null> {
  const row = await platform
    .selectFrom('school_plans')
    .innerJoin('plans', 'plans.id', 'school_plans.plan_id')
    .leftJoin('price_rules', 'price_rules.id', 'plans.price_rule_id')
    .select([
      'plans.id as plan_id',
      'plans.code as plan_code',
      'plans.name as plan_name',
      'plans.modules',
      'plans.pricing_mode',
      'plans.unit_price',
      'plans.minimum_fee as plan_minimum_fee',
      'plans.module_prices as plan_module_prices',
      'plans.billing_cycle',
      'school_plans.effective_from',
      'price_rules.code as rule_code',
      'price_rules.name as rule_name',
      'price_rules.components',
      'price_rules.student_tiers',
      'price_rules.tier_mode',
      'price_rules.school_fee',
      'price_rules.module_prices',
      'price_rules.minimum_fee',
      'price_rules.period',
      'price_rules.vat_percent',
      'price_rules.due_days',
    ])
    .where('school_plans.school_id', '=', schoolId)
    .where('school_plans.effective_from', '<=', today)
    .where((expression) =>
      expression.or([
        expression('school_plans.effective_to', 'is', null),
        expression('school_plans.effective_to', '>', today),
      ]),
    )
    .orderBy('school_plans.effective_from', 'desc')
    .orderBy('school_plans.created_at', 'desc')
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  const rule =
    row.rule_code && row.components && row.student_tiers && row.tier_mode && row.period
      ? priceRuleOf({
          code: row.rule_code,
          name: row.rule_name ?? row.rule_code,
          components: row.components,
          student_tiers: row.student_tiers,
          tier_mode: row.tier_mode,
          school_fee: row.school_fee ?? 0,
          module_prices: row.module_prices ?? {},
          minimum_fee: row.minimum_fee ?? 0,
          period: row.period,
          vat_percent: row.vat_percent ?? 0,
          due_days: row.due_days ?? 15,
        })
      : ruleFromPlanPrices({
          code: row.plan_code,
          name: row.plan_name,
          pricing_mode: row.pricing_mode,
          unit_price: Number(row.unit_price),
          minimum_fee: Number(row.plan_minimum_fee),
          module_prices: row.plan_module_prices,
          billing_cycle: row.billing_cycle,
        });
  return {
    planId: row.plan_id,
    planCode: row.plan_code,
    planName: row.plan_name,
    modules: Array.isArray(row.modules) ? row.modules : null,
    effectiveFrom: asDateText(row.effective_from) as string,
    rule,
  };
}

// ---------- Số liệu kỳ và hóa đơn

export async function recordUsageSnapshot(
  platform: Executor,
  input: { schoolId: string; range: BillingRange; usage: BillingUsage; source: 'scheduler' | 'operator'; now: Date },
): Promise<void> {
  const values = {
    active_students: input.usage.activeStudents,
    storage_mb: input.usage.storageMb,
    school_levels: input.usage.schoolLevels,
    modules: input.usage.modules ? JSON.stringify(input.usage.modules) : null,
    source: input.source,
    taken_at: input.now,
  };
  await platform
    .insertInto('usage_snapshots')
    .values({ school_id: input.schoolId, period_start: input.range.start, period_end: input.range.end, ...values })
    .onConflict((conflict) => conflict.columns(['school_id', 'period_start']).doUpdateSet(values))
    .execute();
}

export interface PricingContext {
  allModules: string[];
  moduleLabels?: Record<string, string>;
}

export interface IssueInvoiceInput {
  schoolId: string;
  range: BillingRange;
  usage: BillingUsage;
  plan: SchoolBillingPlan;
  kind: 'period' | 'manual';
  actor: Actor;
  now: Date;
  today: string;
  discount?: number;
  note?: string | null;
}

export interface IssuedInvoice {
  id: string;
  code: string;
  paymentContent: string;
  total: number;
  dueOn: string;
  charges: Charges;
}

const laterOf = (left: string, right: string) => (left > right ? left : right);

export async function issueInvoice(
  platform: Kysely<PlatformDatabase>,
  input: IssueInvoiceInput,
  pricing: PricingContext,
): Promise<IssuedInvoice> {
  const charges = computeCharges(input.plan.rule, input.usage, {
    ...(input.discount ? { discount: input.discount } : {}),
    allModules: pricing.allModules,
    ...(pricing.moduleLabels ? { moduleLabels: pricing.moduleLabels } : {}),
  });
  const settings = await readBillingSettings(platform);
  const dueOn =
    input.kind === 'period'
      ? laterOf(addDays(input.range.end, input.plan.rule.dueDays), input.today)
      : addDays(input.today, input.plan.rule.dueDays);
  return platform.transaction().execute(async (transaction) => {
    if (input.kind === 'period') {
      const existing = await transaction
        .selectFrom('invoices')
        .select('code')
        .where('school_id', '=', input.schoolId)
        .where('period_start', '=', input.range.start)
        .where('status', '<>', 'void')
        .executeTakeFirst();
      if (existing) {
        throw new BillingError(`Kỳ này đã có hóa đơn ${existing.code}`, 'conflict');
      }
    }
    const sequence = await sql<{ value: string }>`select nextval('invoice_number_seq') as value`.execute(transaction);
    const number = String(sequence.rows[0]?.value ?? '0').padStart(6, '0');
    const code = `${settings.invoicePrefix}-${number}`;
    const invoice = await transaction
      .insertInto('invoices')
      .values({
        school_id: input.schoolId,
        code,
        payment_content: `${settings.invoicePrefix}${number}`,
        kind: input.kind,
        period_start: input.range.start,
        period_end: input.range.end,
        plan_id: input.plan.planId,
        plan_code: input.plan.planCode,
        price_rule: JSON.stringify(input.plan.rule),
        usage: JSON.stringify(input.usage),
        subtotal: charges.subtotal,
        discount_total: charges.discountTotal,
        vat_percent: charges.vatPercent,
        vat_amount: charges.vatAmount,
        total: charges.total,
        issued_at: input.now,
        due_on: dueOn,
        created_by: input.actor.id ?? input.actor.type,
        note: input.note ?? null,
        updated_at: input.now,
      })
      .returning(['id', 'payment_content'])
      .executeTakeFirstOrThrow();
    if (charges.lines.length > 0) {
      await transaction
        .insertInto('invoice_lines')
        .values(
          charges.lines.map((line, index) => ({
            invoice_id: invoice.id,
            sort: index + 1,
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            amount: line.amount,
          })),
        )
        .execute();
    }
    // Hạn đang chờ trả của trường là hạn sớm nhất; trường dùng thử giữ hạn dùng thử
    await transaction
      .updateTable('schools')
      .set({ paid_until: sql`least(coalesce(paid_until, ${dueOn}::date), ${dueOn}::date)`, updated_at: input.now })
      .where('id', '=', input.schoolId)
      .where('status', 'in', ['active', 'read_only'])
      .execute();
    await writeAudit(transaction, {
      actorType: input.actor.type,
      ...(input.actor.id ? { actorId: input.actor.id } : {}),
      action: 'billing.invoice-issue',
      schoolId: input.schoolId,
      details: { code, kind: input.kind, period: input.range, total: charges.total, due_on: dueOn },
    });
    return { id: invoice.id, code, paymentContent: invoice.payment_content, total: charges.total, dueOn, charges };
  });
}

// Chốt kỳ vừa xong của một trường (việc nền theo trường gọi mỗi ngày): chạy lặp không lập trùng. Trả hóa đơn mới hoặc null
export async function closeDuePeriod(
  platform: Kysely<PlatformDatabase>,
  input: { schoolId: string; today: string; now: Date; usage: () => Promise<BillingUsage> },
  pricing: PricingContext,
): Promise<IssuedInvoice | null> {
  const school = await platform.selectFrom('schools').select(['status']).where('id', '=', input.schoolId).executeTakeFirst();
  if (!school || !['active', 'read_only'].includes(school.status)) {
    return null;
  }
  const plan = await loadBillingPlan(platform, input.schoolId, input.today);
  if (!plan) {
    return null;
  }
  const range = previousPeriod(periodContaining(input.today, plan.rule.period), plan.rule.period);
  if (range.end < plan.effectiveFrom) {
    return null;
  }
  const existing = await platform
    .selectFrom('invoices')
    .select('id')
    .where('school_id', '=', input.schoolId)
    .where('status', '<>', 'void')
    .where('period_start', '<=', range.start)
    .where('period_end', '>=', range.start)
    .executeTakeFirst();
  if (existing) {
    return null;
  }
  const usage = await input.usage();
  await recordUsageSnapshot(platform, { schoolId: input.schoolId, range, usage, source: 'scheduler', now: input.now });
  const preview = computeCharges(plan.rule, usage, { allModules: pricing.allModules });
  if (preview.total === 0) {
    return null;
  }
  return issueInvoice(
    platform,
    {
      schoolId: input.schoolId,
      range,
      usage,
      plan,
      kind: 'period',
      actor: { type: 'system' },
      now: input.now,
      today: input.today,
      note: `Phí ${periodLabel(range, plan.rule.period)}`,
    },
    pricing,
  );
}

// ---------- Tiền vào, đối soát, gia hạn

export interface IncomingPayment {
  provider: string;
  reference: string;
  amount: number;
  transferContent: string;
  receivedAt: Date;
  recordedBy?: string | null;
  note?: string | null;
}

export interface PaymentOutcome {
  status: 'duplicate' | 'unmatched' | 'matched';
  invoiceId: string | null;
  invoiceCode: string | null;
  schoolId: string | null;
  paid: boolean;
  reopened: boolean;
}

export const normalizeTransferContent = (content: string) => content.toUpperCase().replace(/[^A-Z0-9]/g, '');

interface InvoiceForSettlement {
  id: string;
  code: string;
  school_id: string;
  kind: 'period' | 'manual';
  status: 'issued' | 'paid' | 'void';
  total: string;
  amount_paid: string;
  period_start: unknown;
  period_end: unknown;
  price_rule: unknown;
}

// Ghi tiền vào hóa đơn đã khóa dòng; trả đủ thì đánh dấu đã trả và gia hạn trường
async function applyToInvoice(
  transaction: Transaction<PlatformDatabase>,
  invoice: InvoiceForSettlement,
  amount: number,
  now: Date,
  actor: Actor,
): Promise<{ paid: boolean; reopened: boolean }> {
  const paidAmount = Number(invoice.amount_paid) + amount;
  const becomesPaid = invoice.status === 'issued' && paidAmount >= Number(invoice.total);
  await transaction
    .updateTable('invoices')
    .set({
      amount_paid: paidAmount,
      updated_at: now,
      ...(becomesPaid ? { status: 'paid' as const, paid_at: now } : {}),
    })
    .where('id', '=', invoice.id)
    .execute();
  if (!becomesPaid) {
    return { paid: invoice.status === 'paid', reopened: false };
  }
  const reopened = await settleSchool(transaction, invoice, now, actor);
  return { paid: true, reopened };
}

// Sau khi trả đủ: hạn dời tới hạn của hóa đơn kỳ sau, hoặc hạn sớm nhất của hóa đơn khác còn nợ; trường chỉ đọc hoặc dùng thử chuyển
// hoạt động
async function settleSchool(
  transaction: Transaction<PlatformDatabase>,
  invoice: InvoiceForSettlement,
  now: Date,
  actor: Actor,
): Promise<boolean> {
  const rule = invoice.price_rule as PriceRule;
  const range = { start: asDateText(invoice.period_start) as string, end: asDateText(invoice.period_end) as string };
  const covered = addDays(nextPeriod(range, rule.period).end, rule.dueDays);
  const unpaid = await transaction
    .selectFrom('invoices')
    .select((expression) => expression.fn.min('due_on').as('due_on'))
    .where('school_id', '=', invoice.school_id)
    .where('status', '=', 'issued')
    .executeTakeFirst();
  const pending = asDateText(unpaid?.due_on);
  const school = await transaction
    .selectFrom('schools')
    .select(['status', 'paid_until'])
    .where('id', '=', invoice.school_id)
    .forUpdate()
    .executeTakeFirstOrThrow();
  const current = asDateText(school.paid_until);
  const deadline = pending ?? (current && current > covered ? current : covered);
  const reopen = school.status === 'read_only' || school.status === 'trial';
  await transaction
    .updateTable('schools')
    .set({
      paid_until: deadline,
      updated_at: now,
      ...(reopen && !pending ? { status: 'active' as const, status_changed_at: now } : {}),
    })
    .where('id', '=', invoice.school_id)
    .execute();
  const reopened = reopen && !pending;
  if (reopened) {
    await transaction
      .insertInto('dunning_events')
      .values({
        school_id: invoice.school_id,
        invoice_id: invoice.id,
        due_on: deadline,
        kind: 'reopened',
        days: 0,
        channels: JSON.stringify([]),
      })
      .onConflict((conflict) => conflict.columns(['school_id', 'due_on', 'kind', 'days']).doNothing())
      .execute();
  }
  await writeAudit(transaction, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'billing.invoice-paid',
    schoolId: invoice.school_id,
    details: { code: invoice.code, paid_until: deadline, reopened, from: school.status },
  });
  return reopened;
}

const SETTLEMENT_COLUMNS = [
  'id',
  'code',
  'school_id',
  'kind',
  'status',
  'total',
  'amount_paid',
  'period_start',
  'period_end',
  'price_rule',
] as const;

// Nhận một giao dịch tiền vào (cổng báo, giả lập, vận hành ghi tay). Trùng mã giao dịch của cổng thì bỏ qua
export async function receivePayment(
  platform: Kysely<PlatformDatabase>,
  payment: IncomingPayment,
  now: Date,
  actor: Actor = { type: 'system' },
): Promise<PaymentOutcome> {
  if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new BillingError('Số tiền phải là số nguyên dương');
  }
  const normalized = normalizeTransferContent(payment.transferContent);
  return platform.transaction().execute(async (transaction) => {
    const invoice = normalized
      ? await transaction
          .selectFrom('invoices')
          .select([...SETTLEMENT_COLUMNS])
          .where('status', '<>', 'void')
          .where(sql<boolean>`strpos(${normalized}, payment_content) > 0`)
          .orderBy(sql`length(payment_content)`, 'desc')
          .forUpdate()
          .executeTakeFirst()
      : undefined;
    const inserted = await transaction
      .insertInto('invoice_payments')
      .values({
        invoice_id: invoice?.id ?? null,
        school_id: invoice?.school_id ?? null,
        provider: payment.provider,
        provider_reference: payment.reference,
        amount: payment.amount,
        transfer_content: payment.transferContent.slice(0, 500),
        received_at: payment.receivedAt,
        status: invoice ? 'matched' : 'unmatched',
        recorded_by: payment.recordedBy ?? null,
        note: payment.note ?? null,
      })
      .onConflict((conflict) => conflict.columns(['provider', 'provider_reference']).doNothing())
      .returning('id')
      .executeTakeFirst();
    if (!inserted) {
      return { status: 'duplicate', invoiceId: null, invoiceCode: null, schoolId: null, paid: false, reopened: false };
    }
    if (!invoice) {
      await writeAudit(transaction, {
        actorType: actor.type,
        ...(actor.id ? { actorId: actor.id } : {}),
        action: 'billing.payment-unmatched',
        details: { provider: payment.provider, reference: payment.reference, amount: payment.amount },
      });
      return { status: 'unmatched', invoiceId: null, invoiceCode: null, schoolId: null, paid: false, reopened: false };
    }
    const result = await applyToInvoice(transaction, invoice, payment.amount, now, actor);
    return {
      status: 'matched',
      invoiceId: invoice.id,
      invoiceCode: invoice.code,
      schoolId: invoice.school_id,
      ...result,
    };
  });
}

// ---------- Điều chỉnh tay của vận hành (bắt buộc lý do, ghi nhật ký)

const requireReason = (reason: string) => {
  const text = reason.trim();
  if (text.length < 3 || text.length > 500) {
    throw new BillingError('Lý do từ 3 đến 500 ký tự');
  }
  return text;
};

async function lockInvoice(transaction: Transaction<PlatformDatabase>, invoiceId: string) {
  const invoice = await transaction
    .selectFrom('invoices')
    .select([...SETTLEMENT_COLUMNS, 'subtotal', 'discount_total', 'vat_percent', 'payment_content'])
    .where('id', '=', invoiceId)
    .forUpdate()
    .executeTakeFirst();
  if (!invoice) {
    throw new BillingError('Không tìm thấy hóa đơn', 'not_found');
  }
  return invoice;
}

async function recordAdjustment(
  transaction: Transaction<PlatformDatabase>,
  input: {
    schoolId: string;
    invoiceId: string | null;
    kind: 'discount' | 'free_period' | 'manual_payment' | 'void' | 'assign_payment';
    amount?: number;
    months?: number;
    reason: string;
  },
  actor: Actor,
) {
  await transaction
    .insertInto('billing_adjustments')
    .values({
      school_id: input.schoolId,
      invoice_id: input.invoiceId,
      kind: input.kind,
      amount: input.amount ?? 0,
      months: input.months ?? 0,
      reason: input.reason,
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    })
    .execute();
  await writeAudit(transaction, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: `billing.${input.kind.replace('_', '-')}`,
    schoolId: input.schoolId,
    details: { invoice_id: input.invoiceId, amount: input.amount ?? 0, months: input.months ?? 0, reason: input.reason },
  });
}

// Giảm giá hóa đơn chưa trả: tính lại VAT và tổng; giảm giá cộng dồn không vượt tổng trước giảm giá
export async function applyDiscount(
  platform: Kysely<PlatformDatabase>,
  input: { invoiceId: string; amount: number; reason: string; now: Date },
  actor: Actor,
) {
  const reason = requireReason(input.reason);
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new BillingError('Số tiền giảm phải là số nguyên dương');
  }
  return platform.transaction().execute(async (transaction) => {
    const invoice = await lockInvoice(transaction, input.invoiceId);
    if (invoice.status !== 'issued') {
      throw new BillingError('Chỉ giảm giá hóa đơn chưa trả', 'conflict');
    }
    const subtotal = Number(invoice.subtotal);
    const discount = Math.min(Number(invoice.discount_total) + input.amount, subtotal);
    const base = subtotal - discount;
    const vatAmount = Math.floor((base * invoice.vat_percent + 50) / 100);
    const total = base + vatAmount;
    await transaction.deleteFrom('invoice_lines').where('invoice_id', '=', invoice.id).where('kind', '=', 'discount').execute();
    const last = await transaction
      .selectFrom('invoice_lines')
      .select((expression) => expression.fn.max('sort').as('sort'))
      .where('invoice_id', '=', invoice.id)
      .executeTakeFirst();
    await transaction
      .insertInto('invoice_lines')
      .values({
        invoice_id: invoice.id,
        sort: Number(last?.sort ?? 0) + 1,
        kind: 'discount',
        description: `Giảm giá: ${reason}`,
        quantity: 1,
        unit_price: -discount,
        amount: -discount,
      })
      .execute();
    await transaction
      .updateTable('invoices')
      .set({ discount_total: discount, vat_amount: vatAmount, total, updated_at: input.now })
      .where('id', '=', invoice.id)
      .execute();
    await recordAdjustment(
      transaction,
      { schoolId: invoice.school_id, invoiceId: invoice.id, kind: 'discount', amount: input.amount, reason },
      actor,
    );
    if (Number(invoice.amount_paid) >= total) {
      await applyToInvoice(transaction, { ...invoice, total: String(total) }, 0, input.now, actor);
    }
    return { total, discountTotal: discount, vatAmount };
  });
}

function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

// Tặng kỳ: dời hạn đã trả phí thêm số tháng; trường chỉ đọc mở lại
export async function grantFreePeriod(
  platform: Kysely<PlatformDatabase>,
  input: { schoolId: string; months: number; reason: string; today: string; now: Date },
  actor: Actor,
) {
  const reason = requireReason(input.reason);
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 24) {
    throw new BillingError('Số tháng tặng từ 1 đến 24');
  }
  return platform.transaction().execute(async (transaction) => {
    const school = await transaction
      .selectFrom('schools')
      .select(['status', 'paid_until'])
      .where('id', '=', input.schoolId)
      .forUpdate()
      .executeTakeFirst();
    if (!school) {
      throw new BillingError('Không tìm thấy trường', 'not_found');
    }
    const current = asDateText(school.paid_until);
    const paidUntil = addMonths(current && current > input.today ? current : input.today, input.months);
    const reopen = school.status === 'read_only';
    await transaction
      .updateTable('schools')
      .set({
        paid_until: paidUntil,
        updated_at: input.now,
        ...(reopen ? { status: 'active' as const, status_changed_at: input.now } : {}),
      })
      .where('id', '=', input.schoolId)
      .execute();
    await recordAdjustment(
      transaction,
      { schoolId: input.schoolId, invoiceId: null, kind: 'free_period', months: input.months, reason },
      actor,
    );
    return { paidUntil, reopened: reopen };
  });
}

// Hủy hóa đơn chưa thu đồng nào; hạn chờ trả của trường tính lại theo hóa đơn còn nợ
export async function voidInvoice(
  platform: Kysely<PlatformDatabase>,
  input: { invoiceId: string; reason: string; now: Date },
  actor: Actor,
) {
  const reason = requireReason(input.reason);
  return platform.transaction().execute(async (transaction) => {
    const invoice = await lockInvoice(transaction, input.invoiceId);
    if (invoice.status !== 'issued' || Number(invoice.amount_paid) > 0) {
      throw new BillingError('Chỉ hủy hóa đơn chưa thu tiền', 'conflict');
    }
    const due = await transaction
      .selectFrom('invoices')
      .select('due_on')
      .where('id', '=', invoice.id)
      .executeTakeFirstOrThrow();
    await transaction
      .updateTable('invoices')
      .set({ status: 'void', voided_at: input.now, void_reason: reason, updated_at: input.now })
      .where('id', '=', invoice.id)
      .execute();
    const remaining = await transaction
      .selectFrom('invoices')
      .select((expression) => expression.fn.min('due_on').as('due_on'))
      .where('school_id', '=', invoice.school_id)
      .where('status', '=', 'issued')
      .executeTakeFirst();
    const pending = asDateText(remaining?.due_on);
    await transaction
      .updateTable('schools')
      .set({ paid_until: pending, updated_at: input.now })
      .where('id', '=', invoice.school_id)
      .where((expression) =>
        pending ? expression.val(true) : expression('paid_until', '=', asDateText(due.due_on) as string),
      )
      .execute();
    await recordAdjustment(transaction, { schoolId: invoice.school_id, invoiceId: invoice.id, kind: 'void', reason }, actor);
  });
}

// Vận hành ghi nhận tiền nhận tay (chuyển khoản đối soát tay): đi qua cùng đường với tiền vào của cổng
export async function recordManualPayment(
  platform: Kysely<PlatformDatabase>,
  input: { invoiceId: string; amount: number; reference: string; reason: string; now: Date },
  actor: Actor,
): Promise<PaymentOutcome> {
  const reason = requireReason(input.reason);
  const invoice = await platform
    .selectFrom('invoices')
    .select(['payment_content', 'school_id', 'status'])
    .where('id', '=', input.invoiceId)
    .executeTakeFirst();
  if (!invoice) {
    throw new BillingError('Không tìm thấy hóa đơn', 'not_found');
  }
  if (invoice.status === 'void') {
    throw new BillingError('Hóa đơn đã hủy', 'conflict');
  }
  const reference = input.reference.trim();
  if (!reference) {
    throw new BillingError('Thiếu mã giao dịch');
  }
  const outcome = await receivePayment(
    platform,
    {
      provider: 'manual',
      reference,
      amount: input.amount,
      transferContent: invoice.payment_content,
      receivedAt: input.now,
      recordedBy: actor.id ?? actor.type,
      note: reason,
    },
    input.now,
    actor,
  );
  if (outcome.status === 'duplicate') {
    throw new BillingError('Mã giao dịch này đã được ghi', 'conflict');
  }
  await platform.transaction().execute((transaction) =>
    recordAdjustment(
      transaction,
      { schoolId: invoice.school_id, invoiceId: input.invoiceId, kind: 'manual_payment', amount: input.amount, reason },
      actor,
    ),
  );
  return outcome;
}

// Gán tay một giao dịch chưa khớp vào hóa đơn
export async function assignPayment(
  platform: Kysely<PlatformDatabase>,
  input: { paymentId: string; invoiceId: string; reason: string; now: Date },
  actor: Actor,
) {
  const reason = requireReason(input.reason);
  return platform.transaction().execute(async (transaction) => {
    const payment = await transaction
      .selectFrom('invoice_payments')
      .select(['id', 'amount', 'status'])
      .where('id', '=', input.paymentId)
      .forUpdate()
      .executeTakeFirst();
    if (!payment) {
      throw new BillingError('Không tìm thấy giao dịch', 'not_found');
    }
    if (payment.status !== 'unmatched') {
      throw new BillingError('Giao dịch đã khớp hóa đơn', 'conflict');
    }
    const invoice = await lockInvoice(transaction, input.invoiceId);
    if (invoice.status === 'void') {
      throw new BillingError('Hóa đơn đã hủy', 'conflict');
    }
    await transaction
      .updateTable('invoice_payments')
      .set({ status: 'matched', invoice_id: invoice.id, school_id: invoice.school_id, note: reason })
      .where('id', '=', payment.id)
      .execute();
    const result = await applyToInvoice(transaction, invoice, Number(payment.amount), input.now, actor);
    await recordAdjustment(
      transaction,
      {
        schoolId: invoice.school_id,
        invoiceId: invoice.id,
        kind: 'assign_payment',
        amount: Number(payment.amount),
        reason,
      },
      actor,
    );
    return result;
  });
}

// ---------- Nhắc gia hạn

export interface DunningNotice {
  kind: 'before_due' | 'overdue';
  days: number;
  dueOn: string;
  invoiceCode: string;
  total: number;
  outstanding: number;
  channels: string[];
}

// Nhắc theo hóa đơn còn nợ sớm nhất của trường: trước hạn theo `remind_days_before`, sau hạn theo `remind_days_after`. Mỗi mốc ghi một
// dòng `dunning_events`; chạy lặp trong ngày không nhắc lại. Trả lời nhắc vừa ghi để nơi gọi gửi thông báo
export async function runDunning(
  platform: Kysely<PlatformDatabase>,
  input: { schoolId: string; today: string },
): Promise<DunningNotice | null> {
  const invoice = await platform
    .selectFrom('invoices')
    .select(['id', 'code', 'due_on', 'total', 'amount_paid'])
    .where('school_id', '=', input.schoolId)
    .where('status', '=', 'issued')
    .orderBy('due_on')
    .executeTakeFirst();
  if (!invoice) {
    return null;
  }
  const settings = await readBillingSettings(platform);
  const dueOn = asDateText(invoice.due_on) as string;
  const left = daysBetween(input.today, dueOn);
  const kind = left >= 0 ? 'before_due' : 'overdue';
  const offset = Math.abs(left);
  const scheduled = kind === 'before_due' ? settings.remindDaysBefore : settings.remindDaysAfter;
  if (!scheduled.includes(offset)) {
    return null;
  }
  const inserted = await platform
    .insertInto('dunning_events')
    .values({
      school_id: input.schoolId,
      invoice_id: invoice.id,
      due_on: dueOn,
      kind,
      days: offset,
      channels: JSON.stringify(settings.channels),
    })
    .onConflict((conflict) => conflict.columns(['school_id', 'due_on', 'kind', 'days']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) {
    return null;
  }
  return {
    kind,
    days: offset,
    dueOn,
    invoiceCode: invoice.code,
    total: Number(invoice.total),
    outstanding: Number(invoice.total) - Number(invoice.amount_paid),
    channels: settings.channels,
  };
}

// Ghi mốc chuyển trạng thái do quá hạn (chỉ đọc, tạm ngưng) vào nhật ký nhắc
export async function recordStatusDunning(
  platform: Kysely<PlatformDatabase>,
  input: { schoolId: string; to: 'read_only' | 'suspended'; dueOn: string | null; today: string },
): Promise<void> {
  await platform
    .insertInto('dunning_events')
    .values({
      school_id: input.schoolId,
      invoice_id: null,
      due_on: input.dueOn ?? input.today,
      kind: input.to,
      days: input.dueOn ? Math.max(0, daysBetween(input.dueOn, input.today)) : 0,
      channels: JSON.stringify([]),
    })
    .onConflict((conflict) => conflict.columns(['school_id', 'due_on', 'kind', 'days']).doNothing())
    .execute();
}

// ---------- Hóa đơn điện tử

export async function issueEInvoice(
  platform: Kysely<PlatformDatabase>,
  input: { invoiceId: string; now: Date },
  actor: Actor,
) {
  const settings = await readBillingSettings(platform);
  const provider = createEInvoiceProvider(settings.einvoiceProvider);
  const invoice = await platform
    .selectFrom('invoices')
    .innerJoin('schools', 'schools.id', 'invoices.school_id')
    .select([
      'invoices.id',
      'invoices.code',
      'invoices.status',
      'invoices.school_id',
      'invoices.subtotal',
      'invoices.discount_total',
      'invoices.vat_percent',
      'invoices.vat_amount',
      'invoices.total',
      'invoices.issued_at',
      'schools.name as school_name',
      'schools.code as school_code',
    ])
    .where('invoices.id', '=', input.invoiceId)
    .executeTakeFirst();
  if (!invoice) {
    throw new BillingError('Không tìm thấy hóa đơn', 'not_found');
  }
  if (invoice.status === 'void') {
    throw new BillingError('Hóa đơn đã hủy', 'conflict');
  }
  const existing = await platform
    .selectFrom('einvoice_documents')
    .select('id')
    .where('invoice_id', '=', invoice.id)
    .where('status', '=', 'issued')
    .executeTakeFirst();
  if (existing) {
    throw new BillingError('Hóa đơn đã có hóa đơn điện tử', 'conflict');
  }
  const lines = await platform
    .selectFrom('invoice_lines')
    .select(['description', 'quantity', 'unit_price', 'amount'])
    .where('invoice_id', '=', invoice.id)
    .orderBy('sort')
    .execute();
  try {
    const issued = await provider.issue({
      invoiceCode: invoice.code,
      issuedOn: input.now.toISOString().slice(0, 10),
      buyerName: invoice.school_name,
      buyerCode: invoice.school_code,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: Number(line.unit_price),
        amount: Number(line.amount),
      })),
      subtotal: Number(invoice.subtotal) - Number(invoice.discount_total),
      vatPercent: invoice.vat_percent,
      vatAmount: Number(invoice.vat_amount),
      total: Number(invoice.total),
    });
    await platform
      .insertInto('einvoice_documents')
      .values({
        invoice_id: invoice.id,
        provider: provider.code,
        status: 'issued',
        external_id: issued.externalId,
        lookup_code: issued.lookupCode,
        issued_at: input.now,
      })
      .execute();
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'billing.einvoice-issue',
      schoolId: invoice.school_id,
      details: { code: invoice.code, provider: provider.code, external_id: issued.externalId },
    });
    return { provider: provider.code, ...issued };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await platform
      .insertInto('einvoice_documents')
      .values({ invoice_id: invoice.id, provider: provider.code, status: 'failed', error: message.slice(0, 500) })
      .execute();
    throw new BillingError(message, 'conflict');
  }
}

export async function cancelEInvoice(
  platform: Kysely<PlatformDatabase>,
  input: { invoiceId: string; reason: string; now: Date },
  actor: Actor,
) {
  const reason = requireReason(input.reason);
  const document = await platform
    .selectFrom('einvoice_documents')
    .innerJoin('invoices', 'invoices.id', 'einvoice_documents.invoice_id')
    .select(['einvoice_documents.id', 'einvoice_documents.provider', 'einvoice_documents.external_id', 'invoices.school_id'])
    .where('einvoice_documents.invoice_id', '=', input.invoiceId)
    .where('einvoice_documents.status', '=', 'issued')
    .executeTakeFirst();
  if (!document) {
    throw new BillingError('Hóa đơn chưa có hóa đơn điện tử', 'not_found');
  }
  await createEInvoiceProvider(document.provider).cancel(document.external_id ?? '', reason);
  await platform
    .updateTable('einvoice_documents')
    .set({ status: 'cancelled', cancelled_at: input.now })
    .where('id', '=', document.id)
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'billing.einvoice-cancel',
    schoolId: document.school_id,
    details: { invoice_id: input.invoiceId, reason },
  });
}

// ---------- Tra cứu

export interface InvoiceListFilter {
  schoolId?: string;
  status?: 'issued' | 'paid' | 'void' | 'overdue';
  today: string;
  limit?: number;
}

export async function listInvoices(platform: Executor, filter: InvoiceListFilter) {
  let query = platform
    .selectFrom('invoices')
    .innerJoin('schools', 'schools.id', 'invoices.school_id')
    .select([
      'invoices.id',
      'invoices.code',
      'invoices.school_id',
      'schools.code as school_code',
      'schools.name as school_name',
      'invoices.kind',
      'invoices.period_start',
      'invoices.period_end',
      'invoices.total',
      'invoices.amount_paid',
      'invoices.status',
      'invoices.issued_at',
      'invoices.due_on',
      'invoices.paid_at',
      'invoices.payment_content',
      'invoices.note',
    ])
    .orderBy('invoices.issued_at', 'desc')
    .limit(Math.min(filter.limit ?? 200, 500));
  if (filter.schoolId) {
    query = query.where('invoices.school_id', '=', filter.schoolId);
  }
  if (filter.status === 'overdue') {
    query = query.where('invoices.status', '=', 'issued').where('invoices.due_on', '<', filter.today);
  } else if (filter.status) {
    query = query.where('invoices.status', '=', filter.status);
  }
  const rows = await query.execute();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    school_id: row.school_id,
    school_code: row.school_code,
    school_name: row.school_name,
    kind: row.kind,
    period_start: asDateText(row.period_start),
    period_end: asDateText(row.period_end),
    total: Number(row.total),
    amount_paid: Number(row.amount_paid),
    outstanding: row.status === 'issued' ? Math.max(0, Number(row.total) - Number(row.amount_paid)) : 0,
    status: row.status,
    overdue: row.status === 'issued' && (asDateText(row.due_on) as string) < filter.today,
    issued_at: row.issued_at,
    due_on: asDateText(row.due_on),
    paid_at: row.paid_at,
    payment_content: row.payment_content,
    note: row.note,
  }));
}

export async function invoiceDetail(platform: Executor, invoiceId: string, today: string, schoolId?: string) {
  const [invoice] = await listInvoices(platform, { today, ...(schoolId ? { schoolId } : {}), limit: 500 }).then((rows) =>
    rows.filter((row) => row.id === invoiceId),
  );
  if (!invoice) {
    return null;
  }
  const extra = await platform
    .selectFrom('invoices')
    .select(['subtotal', 'discount_total', 'vat_percent', 'vat_amount', 'usage', 'price_rule', 'last_payment_request', 'void_reason'])
    .where('id', '=', invoiceId)
    .executeTakeFirstOrThrow();
  const lines = await platform
    .selectFrom('invoice_lines')
    .select(['sort', 'kind', 'description', 'quantity', 'unit_price', 'amount'])
    .where('invoice_id', '=', invoiceId)
    .orderBy('sort')
    .execute();
  const payments = await platform
    .selectFrom('invoice_payments')
    .select(['id', 'provider', 'provider_reference', 'amount', 'received_at', 'status', 'note'])
    .where('invoice_id', '=', invoiceId)
    .orderBy('received_at')
    .execute();
  const einvoices = await platform
    .selectFrom('einvoice_documents')
    .select(['provider', 'status', 'external_id', 'lookup_code', 'issued_at', 'cancelled_at', 'error'])
    .where('invoice_id', '=', invoiceId)
    .orderBy('created_at')
    .execute();
  return {
    ...invoice,
    subtotal: Number(extra.subtotal),
    discount_total: Number(extra.discount_total),
    vat_percent: extra.vat_percent,
    vat_amount: Number(extra.vat_amount),
    usage: extra.usage,
    price_rule: extra.price_rule,
    payment_request: extra.last_payment_request,
    void_reason: extra.void_reason,
    lines: lines.map((line) => ({ ...line, unit_price: Number(line.unit_price), amount: Number(line.amount) })),
    payments: payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    einvoices,
  };
}

// Công nợ theo trường: tổng còn nợ, số hóa đơn quá hạn, hạn sớm nhất
export async function receivables(platform: Executor, today: string) {
  const rows = await platform
    .selectFrom('schools')
    .leftJoin('invoices', (join) => join.onRef('invoices.school_id', '=', 'schools.id').on('invoices.status', '=', 'issued'))
    .select((expression) => [
      'schools.id',
      'schools.code',
      'schools.name',
      'schools.status',
      'schools.paid_until',
      expression.fn.coalesce(expression.fn.sum<string>(sql`invoices.total - invoices.amount_paid`), sql`0`).as('outstanding'),
      expression.fn.count<string>('invoices.id').as('open_invoices'),
      expression.fn
        .count<string>(sql`case when invoices.due_on < ${today}::date then 1 end`)
        .as('overdue_invoices'),
      expression.fn.min('invoices.due_on').as('earliest_due'),
    ])
    .where('schools.status', 'not in', ['provisioning', 'deleted'])
    .groupBy(['schools.id', 'schools.code', 'schools.name', 'schools.status', 'schools.paid_until'])
    .orderBy('schools.code')
    .execute();
  return rows.map((row) => ({
    school_id: row.id,
    school_code: row.code,
    school_name: row.name,
    status: row.status,
    paid_until: asDateText(row.paid_until),
    outstanding: Number(row.outstanding),
    open_invoices: Number(row.open_invoices),
    overdue_invoices: Number(row.overdue_invoices),
    earliest_due: asDateText(row.earliest_due),
  }));
}

export async function listUnmatchedPayments(platform: Executor) {
  const rows = await platform
    .selectFrom('invoice_payments')
    .select(['id', 'provider', 'provider_reference', 'amount', 'transfer_content', 'received_at'])
    .where('status', '=', 'unmatched')
    .orderBy('received_at', 'desc')
    .limit(200)
    .execute();
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

// Lưu yêu cầu thanh toán gần nhất (mã QR, tài khoản ảo) để trang hóa đơn hiện lại
export async function saveInvoicePaymentRequest(platform: Executor, invoiceId: string, request: unknown, now: Date) {
  await platform
    .updateTable('invoices')
    .set({ last_payment_request: JSON.stringify(request), updated_at: now })
    .where('id', '=', invoiceId)
    .execute();
}

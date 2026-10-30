import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';
import type { DraftItem } from '../fees/fee-calculation.service.js';
import type { Period } from '../fees/registration-periods.js';
import { monthlyWindow } from './ai-tutor-rules.js';
import { purchaseLine, upgradeLine } from './school-sales-rules.js';

// Dòng thu Gia sư AI trên hóa đơn học phí của kỳ (YCTD-383 lát L1a): lần tính học phí của kỳ lập một dòng `ai_tutor` cho mỗi lần mua
// gói của trường và mỗi lần nâng gói đã áp mà chưa thu, ghi trước khi hết kỳ, của lần mua còn hiệu lực. Lần mua, lần nâng ở cơ sở dữ
// liệu hệ thống; bảng `ai_tutor_invoice_charges` ở cơ sở dữ liệu năm học ghi dòng nào đã thu gì. Hóa đơn chính còn nháp của kỳ được tính
// lại nên phần đã ghi của nó không tính là đã thu; hóa đơn đã phát hành không bị ghi đè (lần tính chỉ thay hóa đơn nháp). Lần mua, lần
// nâng ghi trước ngày bắt đầu năm học thuộc hóa đơn của năm học trước nên không thu lại
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface AiTutorCharge {
  subscriptionId: string;
  upgradeId: string | null;
  item: DraftItem;
}

const vietnamStart = (date: string) => new Date(`${date}T00:00:00+07:00`);

async function recomputableInvoiceIds(database: Executor, childIds: string[], period: Period): Promise<string[]> {
  const rows = await database
    .selectFrom('invoices')
    .select('id')
    .where('child_id', 'in', childIds)
    .where('period_year', '=', period.year)
    .where('period_month', '=', period.month)
    .where('invoice_kind', '=', 'main')
    .where('status', '=', 'draft')
    .execute();
  return rows.map((row) => row.id);
}

// Dòng thu Gia sư AI của các học sinh trong kỳ, theo học sinh
export async function aiTutorCharges(
  database: Executor,
  system: Kysely<SystemDatabase>,
  childIds: string[],
  period: Period,
  schoolYearStart: string | null,
): Promise<Map<string, AiTutorCharge[]>> {
  const result = new Map<string, AiTutorCharge[]>();
  if (childIds.length === 0) {
    return result;
  }
  const periodEnd = monthlyWindow(`${period.year}-${String(period.month).padStart(2, '0')}-01`).validUntil;
  const yearStart = schoolYearStart ? vietnamStart(schoolYearStart) : new Date(0);
  const subscriptions = await system
    .selectFrom('ai_tutor_subscriptions')
    .select(['id', 'child_id', 'plan_kind', 'plan_name', 'period_month', 'price', 'turns', 'created_at'])
    .where('child_id', 'in', childIds)
    .where('plan_source', '=', 'school')
    .where('status', '=', 'active')
    .where('created_at', '>=', yearStart)
    .where('created_at', '<', periodEnd)
    .orderBy('created_at')
    .execute();
  const upgrades = await system
    .selectFrom('ai_tutor_upgrades')
    .innerJoin('ai_tutor_subscriptions', 'ai_tutor_subscriptions.id', 'ai_tutor_upgrades.subscription_id')
    .select([
      'ai_tutor_upgrades.id',
      'ai_tutor_upgrades.subscription_id',
      'ai_tutor_upgrades.child_id',
      'ai_tutor_upgrades.from_plan_name',
      'ai_tutor_upgrades.to_plan_name',
      'ai_tutor_upgrades.remaining_days',
      'ai_tutor_upgrades.days_in_month',
      'ai_tutor_upgrades.extra_turns',
      'ai_tutor_upgrades.price_difference',
      'ai_tutor_subscriptions.period_month',
    ])
    .where('ai_tutor_upgrades.child_id', 'in', childIds)
    .where('ai_tutor_upgrades.plan_source', '=', 'school')
    .where('ai_tutor_upgrades.status', '=', 'applied')
    .where('ai_tutor_subscriptions.status', '=', 'active')
    .where('ai_tutor_upgrades.applied_at', '>=', yearStart)
    .where('ai_tutor_upgrades.applied_at', '<', periodEnd)
    .orderBy('ai_tutor_upgrades.applied_at')
    .execute();
  if (subscriptions.length === 0 && upgrades.length === 0) {
    return result;
  }
  const recomputable = await recomputableInvoiceIds(database, childIds, period);
  let chargedQuery = database
    .selectFrom('ai_tutor_invoice_charges')
    .innerJoin('invoice_items', 'invoice_items.id', 'ai_tutor_invoice_charges.invoice_item_id')
    .select(['ai_tutor_invoice_charges.subscription_id', 'ai_tutor_invoice_charges.upgrade_id'])
    .where('ai_tutor_invoice_charges.child_id', 'in', childIds);
  if (recomputable.length > 0) {
    chargedQuery = chargedQuery.where('invoice_items.invoice_id', 'not in', recomputable);
  }
  const charged = await chargedQuery.execute();
  const chargedSubscriptions = new Set(
    charged.filter((row) => row.upgrade_id === null).map((row) => row.subscription_id),
  );
  const chargedUpgrades = new Set(charged.map((row) => row.upgrade_id).filter((id): id is string => id !== null));
  const push = (childId: string, charge: AiTutorCharge) => {
    const list = result.get(childId) ?? [];
    list.push(charge);
    result.set(childId, list);
  };
  // Lần mua đã nâng gói thì dòng đăng ký mang tên gói mới; dòng thu của lần mua ghi tên gói mua ban đầu
  const subscriptionIds = subscriptions.map((row) => row.id);
  const originalNames = new Map<string, string>();
  if (subscriptionIds.length > 0) {
    const firstUpgrades = await system
      .selectFrom('ai_tutor_upgrades')
      .select(['subscription_id', 'from_plan_name'])
      .where('subscription_id', 'in', subscriptionIds)
      .where('status', '=', 'applied')
      .orderBy('applied_at', 'desc')
      .execute();
    for (const upgrade of firstUpgrades) {
      originalNames.set(upgrade.subscription_id, upgrade.from_plan_name);
    }
  }
  for (const subscription of subscriptions) {
    const amount = Number(subscription.price);
    if (amount <= 0 || chargedSubscriptions.has(subscription.id)) {
      continue;
    }
    const line = purchaseLine({
      planKind: subscription.plan_kind,
      planName: originalNames.get(subscription.id) ?? subscription.plan_name,
      periodMonth: subscription.period_month,
      turns: subscription.turns,
      createdAt: subscription.created_at,
    });
    push(subscription.child_id, {
      subscriptionId: subscription.id,
      upgradeId: null,
      item: {
        item_type: 'ai_tutor',
        service_id: null,
        service_registration_id: null,
        description: line.description,
        quantity: 1,
        unit_price: amount,
        amount,
        basis_note: line.basisNote,
      },
    });
  }
  for (const upgrade of upgrades) {
    const amount = Number(upgrade.price_difference);
    if (amount <= 0 || chargedUpgrades.has(upgrade.id) || !upgrade.period_month) {
      continue;
    }
    const line = upgradeLine({
      fromPlanName: upgrade.from_plan_name,
      toPlanName: upgrade.to_plan_name,
      periodMonth: upgrade.period_month,
      remainingDays: upgrade.remaining_days,
      daysInMonth: upgrade.days_in_month,
      extraTurns: upgrade.extra_turns,
    });
    push(upgrade.child_id, {
      subscriptionId: upgrade.subscription_id,
      upgradeId: upgrade.id,
      item: {
        item_type: 'ai_tutor',
        service_id: null,
        service_registration_id: null,
        description: line.description,
        quantity: 1,
        unit_price: amount,
        amount,
        basis_note: line.basisNote,
      },
    });
  }
  return result;
}

// Chèn dòng thu Gia sư AI của hóa đơn và ghi lần mua, lần nâng đã thu ở dòng nào (gọi trong giao dịch của lần tính, sau khi chèn các
// dòng khác; hóa đơn nháp tính lại đã xóa dòng cũ nên phần ghi cũ xóa theo)
export async function recordAiTutorCharges(
  transaction: Transaction<SchoolYearDatabase>,
  invoiceId: string,
  childId: string,
  charges: AiTutorCharge[],
): Promise<void> {
  for (const charge of charges) {
    const item = await transaction
      .insertInto('invoice_items')
      .values({ ...charge.item, invoice_id: invoiceId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('ai_tutor_invoice_charges')
      .values({
        invoice_item_id: item.id,
        child_id: childId,
        subscription_id: charge.subscriptionId,
        upgrade_id: charge.upgradeId,
        amount: charge.item.amount,
      })
      .execute();
  }
}

// Lần mua đã lên hóa đơn học phí nào chưa (kể cả hóa đơn nháp): đã lên thì phụ huynh không hủy được
export async function isSubscriptionInvoiced(database: Executor, subscriptionId: string): Promise<boolean> {
  const row = await database
    .selectFrom('ai_tutor_invoice_charges')
    .select('id')
    .where('subscription_id', '=', subscriptionId)
    .executeTakeFirst();
  return row !== undefined;
}

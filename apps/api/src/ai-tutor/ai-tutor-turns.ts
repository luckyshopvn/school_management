import type { SystemDatabase } from '@school-management/database';
import { sql, type Kysely, type Selectable } from 'kysely';
import {
  STALE_HOLD_MINUTES,
  purchaseBlock,
  subscriptionWindow,
  turnBalance,
  turnOrder,
  upgradeQuote,
  type AiTutorPlanKind,
  type AiTutorPlanSource,
  type AiTutorSchoolLevel,
  type PurchaseBlock,
  type TurnCandidate,
  type UpgradeBlockCode,
  type UpgradeQuote,
} from './ai-tutor-rules.js';

// Đăng ký gói và sổ lượt của gia sư AI trả phí (YCTD-383 lát L0) trên cơ sở dữ liệu hệ thống của trường. Lát L1a (trường bán qua hóa đơn
// học phí) và L1b (nền tảng bán qua cổng thanh toán của nền tảng) cùng gọi `createAiTutorSubscription`, `activateAiTutorSubscription`,
// và để nâng gói giữa tháng thì `createAiTutorUpgrade`, `applyAiTutorUpgrade`; lát L2 gọi `holdAiTutorTurn` trước khi gọi AI rồi
// `captureAiTutorTurn` hoặc `releaseAiTutorTurn`.

type SystemClient = Kysely<SystemDatabase>;
type SubscriptionRow = Selectable<SystemDatabase['ai_tutor_subscriptions']>;

const ONE_MONTHLY_INDEX = 'ai_tutor_subscriptions_one_monthly';

export interface AiTutorPurchaseInput {
  childId: string;
  childSchoolLevel: AiTutorSchoolLevel;
  plan: {
    source: AiTutorPlanSource;
    id: string;
    kind: AiTutorPlanKind;
    name: string;
    price: string | number;
    turns: number;
    allowImages: boolean;
    schoolLevels: readonly AiTutorSchoolLevel[];
    status: 'active' | 'archived';
  };
  periodMonth: string | null;
  buyerUserId: string;
  buyerName: string;
  // Hạn giữ chỗ của dòng chờ thanh toán (nền tảng bán); trống là giữ tới khi kích hoạt hoặc hủy
  pendingExpiresAt: Date | null;
}

export type AiTutorPurchaseResult = { ok: true; subscriptionId: string } | { ok: false; block: PurchaseBlock };

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidate = error as { code?: string; constraint?: string };
  return candidate?.code === '23505' && candidate.constraint === constraint;
}

// Ghi một lần mua ở trạng thái chờ (`pending`). Trong cùng giao dịch: hủy dòng chờ thanh toán đã quá hạn của con trong tháng đó, kiểm
// quy tắc, ghi dòng mới. Hai lần mua đồng thời cho cùng một con, cùng tháng (kể cả khác nguồn) thì chỉ mục duy nhất giữ đúng một dòng;
// lần còn lại nhận `monthly_exists`
export async function createAiTutorSubscription(
  system: SystemClient,
  input: AiTutorPurchaseInput,
  now: Date,
): Promise<AiTutorPurchaseResult> {
  try {
    return await system.transaction().execute(async (transaction) => {
      if (input.plan.kind === 'monthly' && input.periodMonth !== null) {
        await transaction
          .updateTable('ai_tutor_subscriptions')
          .set({ status: 'cancelled', cancelled_at: now, cancel_reason: 'Quá hạn thanh toán', updated_at: now })
          .where('child_id', '=', input.childId)
          .where('plan_kind', '=', 'monthly')
          .where('period_month', '=', input.periodMonth)
          .where('status', '=', 'pending')
          .where('pending_expires_at', '<=', now)
          .execute();
      }
      const existing = await transaction
        .selectFrom('ai_tutor_subscriptions')
        .select(['plan_kind', 'plan_source', 'period_month', 'status', 'pending_expires_at'])
        .where('child_id', '=', input.childId)
        .where('plan_kind', '=', 'monthly')
        .where('status', 'in', ['pending', 'active'])
        .execute();
      const block = purchaseBlock(
        {
          planKind: input.plan.kind,
          planStatus: input.plan.status,
          planSchoolLevels: input.plan.schoolLevels,
          childSchoolLevel: input.childSchoolLevel,
          periodMonth: input.periodMonth,
        },
        existing.map((row) => ({
          planKind: row.plan_kind,
          planSource: row.plan_source,
          periodMonth: row.period_month,
          status: row.status,
          pendingExpiresAt: row.pending_expires_at,
        })),
        now,
      );
      if (block) {
        return { ok: false, block } as const;
      }
      const inserted = await transaction
        .insertInto('ai_tutor_subscriptions')
        .values({
          child_id: input.childId,
          plan_source: input.plan.source,
          plan_id: input.plan.id,
          plan_kind: input.plan.kind,
          plan_name: input.plan.name,
          price: input.plan.price,
          allow_images: input.plan.kind === 'monthly' && input.plan.allowImages,
          period_month: input.periodMonth,
          status: 'pending',
          pending_expires_at: input.pendingExpiresAt,
          buyer_user_id: input.buyerUserId,
          buyer_name: input.buyerName,
          turns: input.plan.turns,
          created_at: now,
          updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { ok: true, subscriptionId: inserted.id } as const;
    });
  } catch (error) {
    if (!isUniqueViolation(error, ONE_MONTHLY_INDEX)) {
      throw error;
    }
    // Lần mua khác vừa ghi trước trong cùng tháng: đọc lại để báo nguồn đang giữ
    const holder = await system
      .selectFrom('ai_tutor_subscriptions')
      .select(['plan_source', 'status'])
      .where('child_id', '=', input.childId)
      .where('plan_kind', '=', 'monthly')
      .where('period_month', '=', input.periodMonth)
      .where('status', 'in', ['pending', 'active'])
      .executeTakeFirst();
    return {
      ok: false,
      block: {
        code: 'monthly_exists',
        source: holder?.plan_source ?? input.plan.source,
        status: holder?.status === 'active' ? 'active' : 'pending',
      },
    };
  }
}

// Kích hoạt sau khi đã ghi hóa đơn (trường bán) hoặc đã thu tiền (nền tảng bán): đặt khoảng dùng. Trả về false khi dòng không còn chờ
export async function activateAiTutorSubscription(
  system: SystemClient,
  subscriptionId: string,
  now: Date,
  externalReference: string | null,
): Promise<boolean> {
  const row = await system
    .selectFrom('ai_tutor_subscriptions')
    .select(['plan_kind', 'period_month'])
    .where('id', '=', subscriptionId)
    .executeTakeFirst();
  if (!row) {
    return false;
  }
  const window = subscriptionWindow(row.plan_kind, row.period_month, now);
  const result = await system
    .updateTable('ai_tutor_subscriptions')
    .set({
      status: 'active',
      activated_at: now,
      valid_from: window.validFrom,
      valid_until: window.validUntil,
      pending_expires_at: null,
      external_reference: externalReference,
      updated_at: now,
    })
    .where('id', '=', subscriptionId)
    .where('status', '=', 'pending')
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

function toCandidate(row: SubscriptionRow): TurnCandidate {
  return {
    id: row.id,
    planKind: row.plan_kind,
    status: row.status,
    turns: row.turns,
    usedTurns: row.used_turns,
    heldTurns: row.held_turns,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    activatedAt: row.activated_at,
  };
}

async function activeSubscriptions(system: SystemClient, childId: string, now: Date) {
  return system
    .selectFrom('ai_tutor_subscriptions')
    .selectAll()
    .where('child_id', '=', childId)
    .where('status', '=', 'active')
    .where('valid_until', '>', now)
    .execute();
}

export async function aiTutorTurnBalance(system: SystemClient, childId: string, now: Date) {
  const rows = await activeSubscriptions(system, childId, now);
  return turnBalance(rows.map(toCandidate), now);
}

export type AiTutorHoldResult =
  { ok: true; entryId: string; subscriptionId: string } | { ok: false; reason: 'no_turns' };

// Tạm giữ một lượt trước khi gọi AI. Thử lần lượt theo thứ tự trừ lượt; mỗi lần là một câu cập nhật có điều kiện "còn lượt" nên hai yêu
// cầu đồng thời không giữ quá số lượt: yêu cầu sau chờ khóa dòng, đọc lại số đã giữ rồi chuyển sang gói kế tiếp hoặc báo hết lượt
export async function holdAiTutorTurn(system: SystemClient, childId: string, now: Date): Promise<AiTutorHoldResult> {
  const ordered = turnOrder((await activeSubscriptions(system, childId, now)).map(toCandidate), now);
  for (const candidate of ordered) {
    const entry = await system.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('ai_tutor_subscriptions')
        .set((expression) => ({ held_turns: expression('held_turns', '+', 1), updated_at: now }))
        .where('id', '=', candidate.id)
        .where('status', '=', 'active')
        .where('valid_from', '<=', now)
        .where('valid_until', '>', now)
        .where(sql<boolean>`used_turns + held_turns < turns`)
        .executeTakeFirst();
      if (updated.numUpdatedRows !== 1n) {
        return null;
      }
      return transaction
        .insertInto('ai_tutor_turn_ledger')
        .values({ child_id: childId, subscription_id: candidate.id, status: 'held', held_at: now })
        .returning('id')
        .executeTakeFirstOrThrow();
    });
    if (entry) {
      return { ok: true, entryId: entry.id, subscriptionId: candidate.id };
    }
  }
  return { ok: false, reason: 'no_turns' };
}

// Chốt một lượt đang giữ: `captured` chuyển sang đã dùng, `released` trả lại. Lượt đã chốt rồi thì không đổi gì, trả về false
async function settleTurn(
  system: SystemClient,
  entryId: string,
  outcome: 'captured' | 'released',
  now: Date,
  releaseReason: string | null,
): Promise<boolean> {
  return system.transaction().execute(async (transaction) => {
    const entry = await transaction
      .updateTable('ai_tutor_turn_ledger')
      .set({ status: outcome, settled_at: now, release_reason: releaseReason })
      .where('id', '=', entryId)
      .where('status', '=', 'held')
      .returning('subscription_id')
      .executeTakeFirst();
    if (!entry) {
      return false;
    }
    await transaction
      .updateTable('ai_tutor_subscriptions')
      .set((expression) =>
        outcome === 'captured'
          ? {
              held_turns: expression('held_turns', '-', 1),
              used_turns: expression('used_turns', '+', 1),
              updated_at: now,
            }
          : { held_turns: expression('held_turns', '-', 1), updated_at: now },
      )
      .where('id', '=', entry.subscription_id)
      .execute();
    return true;
  });
}

// Trừ thật sau khi gọi AI thành công
export function captureAiTutorTurn(system: SystemClient, entryId: string, now: Date): Promise<boolean> {
  return settleTurn(system, entryId, 'captured', now, null);
}

// Hoàn lượt khi gọi AI lỗi hoặc câu hỏi bị chặn trước khi gửi
export function releaseAiTutorTurn(system: SystemClient, entryId: string, reason: string, now: Date): Promise<boolean> {
  return settleTurn(system, entryId, 'released', now, reason.slice(0, 200));
}

// Hoàn các lượt tạm giữ quá `STALE_HOLD_MINUTES` phút (máy chủ dừng giữa lúc gọi AI); việc nền gọi định kỳ. Trả về số lượt đã hoàn
export async function releaseStaleAiTutorHolds(system: SystemClient, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_HOLD_MINUTES * 60 * 1000);
  const stale = await system
    .selectFrom('ai_tutor_turn_ledger')
    .select('id')
    .where('status', '=', 'held')
    .where('held_at', '<', cutoff)
    .execute();
  let released = 0;
  for (const entry of stale) {
    if (await releaseAiTutorTurn(system, entry.id, 'Tạm giữ quá hạn', now)) {
      released += 1;
    }
  }
  return released;
}

// Giá tháng và số lượt tháng của gói đang dùng: gói đích của lần nâng gần nhất đã áp, chưa nâng thì gói mua ban đầu
export async function currentMonthlyTerms(
  system: SystemClient,
  subscription: Pick<SubscriptionRow, 'id' | 'price' | 'turns'>,
): Promise<{ price: number; turns: number }> {
  const upgrades = await system
    .selectFrom('ai_tutor_upgrades')
    .select(['to_price', 'to_turns'])
    .where('subscription_id', '=', subscription.id)
    .where('status', '=', 'applied')
    .orderBy('applied_at', 'desc')
    .execute();
  const latest = upgrades[0];
  if (latest) {
    return { price: Number(latest.to_price), turns: latest.to_turns };
  }
  return { price: Number(subscription.price), turns: subscription.turns };
}

export interface AiTutorUpgradeInput {
  subscriptionId: string;
  childSchoolLevel: AiTutorSchoolLevel;
  target: AiTutorPurchaseInput['plan'];
  buyerUserId: string;
  buyerName: string;
  // Hạn giữ chỗ khi chờ thanh toán (nền tảng bán); trống là giữ tới khi áp hoặc hủy
  pendingExpiresAt: Date | null;
}

export type AiTutorUpgradeBlock = UpgradeBlockCode | 'not_found' | 'upgrade_pending';

export type AiTutorUpgradeResult =
  { ok: true; upgradeId: string; quote: UpgradeQuote } | { ok: false; code: AiTutorUpgradeBlock };

const ONE_PENDING_UPGRADE_INDEX = 'ai_tutor_upgrades_one_pending';

// Ghi một lần nâng gói ở trạng thái chờ, kèm báo giá theo số ngày còn lại. Trong cùng giao dịch: khóa dòng đăng ký, hủy lần nâng đang
// chờ đã quá hạn giữ chỗ, kiểm quy tắc. Nơi gọi tự kiểm con thuộc phụ huynh. Trường bán gọi `applyAiTutorUpgrade` ngay sau đó
export async function createAiTutorUpgrade(
  system: SystemClient,
  input: AiTutorUpgradeInput,
  now: Date,
): Promise<AiTutorUpgradeResult> {
  try {
    return await system.transaction().execute(async (transaction) => {
      const subscription = await transaction
        .selectFrom('ai_tutor_subscriptions')
        .selectAll()
        .where('id', '=', input.subscriptionId)
        .forUpdate()
        .executeTakeFirst();
      if (!subscription) {
        return { ok: false, code: 'not_found' } as const;
      }
      await transaction
        .updateTable('ai_tutor_upgrades')
        .set({ status: 'cancelled', cancelled_at: now, cancel_reason: 'Quá hạn thanh toán', updated_at: now })
        .where('subscription_id', '=', subscription.id)
        .where('status', '=', 'pending')
        .where('pending_expires_at', '<=', now)
        .execute();
      const waiting = await transaction
        .selectFrom('ai_tutor_upgrades')
        .select('id')
        .where('subscription_id', '=', subscription.id)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      if (waiting) {
        return { ok: false, code: 'upgrade_pending' } as const;
      }
      const terms = await currentMonthlyTerms(transaction, subscription);
      const isExpired = subscription.valid_until !== null && subscription.valid_until.getTime() <= now.getTime();
      const priced = upgradeQuote(
        {
          planSource: subscription.plan_source,
          planKind: subscription.plan_kind,
          planId: subscription.plan_id,
          status: isExpired ? 'cancelled' : subscription.status,
          periodMonth: subscription.period_month,
          monthlyPrice: terms.price,
          monthlyTurns: terms.turns,
        },
        {
          source: input.target.source,
          id: input.target.id,
          kind: input.target.kind,
          status: input.target.status,
          price: Number(input.target.price),
          turns: input.target.turns,
          schoolLevels: input.target.schoolLevels,
        },
        input.childSchoolLevel,
        now,
      );
      if (!priced.ok) {
        return { ok: false, code: isExpired && priced.code === 'not_active' ? 'period_ended' : priced.code } as const;
      }
      const { quote } = priced;
      const inserted = await transaction
        .insertInto('ai_tutor_upgrades')
        .values({
          subscription_id: subscription.id,
          child_id: subscription.child_id,
          plan_source: subscription.plan_source,
          from_plan_id: subscription.plan_id,
          from_plan_name: subscription.plan_name,
          from_price: quote.fromPrice,
          from_turns: quote.fromTurns,
          to_plan_id: input.target.id,
          to_plan_name: input.target.name,
          to_price: quote.toPrice,
          to_turns: quote.toTurns,
          to_allow_images: input.target.allowImages,
          remaining_days: quote.remainingDays,
          days_in_month: quote.daysInMonth,
          price_difference: quote.priceDifference,
          extra_turns: quote.extraTurns,
          pending_expires_at: input.pendingExpiresAt,
          buyer_user_id: input.buyerUserId,
          buyer_name: input.buyerName,
          created_at: now,
          updated_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { ok: true, upgradeId: inserted.id, quote } as const;
    });
  } catch (error) {
    if (isUniqueViolation(error, ONE_PENDING_UPGRADE_INDEX)) {
      return { ok: false, code: 'upgrade_pending' };
    }
    throw error;
  }
}

// Áp lần nâng đang chờ (trường bán: ngay khi ghi; nền tảng bán: khi đã thu tiền): đổi dòng đăng ký sang gói mới, cộng thêm lượt. Trả
// về false khi lần nâng không còn chờ, đã quá hạn giữ chỗ, hoặc đăng ký không còn hiệu lực
export async function applyAiTutorUpgrade(
  system: SystemClient,
  upgradeId: string,
  now: Date,
  externalReference: string | null,
): Promise<boolean> {
  return system.transaction().execute(async (transaction) => {
    const upgrade = await transaction
      .selectFrom('ai_tutor_upgrades')
      .selectAll()
      .where('id', '=', upgradeId)
      .where('status', '=', 'pending')
      .forUpdate()
      .executeTakeFirst();
    if (!upgrade || (upgrade.pending_expires_at !== null && upgrade.pending_expires_at.getTime() <= now.getTime())) {
      return false;
    }
    const updated = await transaction
      .updateTable('ai_tutor_subscriptions')
      .set((expression) => ({
        plan_id: upgrade.to_plan_id,
        plan_name: upgrade.to_plan_name,
        allow_images: upgrade.to_allow_images,
        turns: expression('turns', '+', upgrade.extra_turns),
        updated_at: now,
      }))
      .where('id', '=', upgrade.subscription_id)
      .where('status', '=', 'active')
      .where('plan_id', '=', upgrade.from_plan_id)
      .where('valid_until', '>', now)
      .executeTakeFirst();
    if (updated.numUpdatedRows !== 1n) {
      return false;
    }
    await transaction
      .updateTable('ai_tutor_upgrades')
      .set({
        status: 'applied',
        applied_at: now,
        pending_expires_at: null,
        external_reference: externalReference,
        updated_at: now,
      })
      .where('id', '=', upgrade.id)
      .execute();
    return true;
  });
}

// Hủy lần nâng đang chờ (áp không được, phụ huynh bỏ thanh toán). Trả về false khi lần nâng không còn chờ
export async function cancelAiTutorUpgrade(
  system: SystemClient,
  upgradeId: string,
  reason: string,
  now: Date,
): Promise<boolean> {
  const result = await system
    .updateTable('ai_tutor_upgrades')
    .set({ status: 'cancelled', cancelled_at: now, cancel_reason: reason.slice(0, 500), updated_at: now })
    .where('id', '=', upgradeId)
    .where('status', '=', 'pending')
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

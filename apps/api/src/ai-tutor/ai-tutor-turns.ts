import type { SystemDatabase } from '@school-management/database';
import { sql, type Kysely, type Selectable } from 'kysely';
import {
  STALE_HOLD_MINUTES,
  purchaseBlock,
  subscriptionWindow,
  turnBalance,
  turnOrder,
  type AiTutorPlanKind,
  type AiTutorPlanSource,
  type AiTutorSchoolLevel,
  type PurchaseBlock,
  type TurnCandidate,
} from './ai-tutor-rules.js';

// Đăng ký gói và sổ lượt của gia sư AI trả phí (YCTD-383 lát L0) trên cơ sở dữ liệu hệ thống của trường. Lát L1a (trường bán qua hóa đơn
// học phí) và L1b (nền tảng bán qua cổng thanh toán của nền tảng) cùng gọi `createAiTutorSubscription`, `activateAiTutorSubscription`;
// lát L2 gọi `holdAiTutorTurn` trước khi gọi AI rồi `captureAiTutorTurn` hoặc `releaseAiTutorTurn`. Chưa có điểm cuối API ở lát này.

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

import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import {
  turnBalance,
  upgradeQuote,
  vietnamMonthOf,
  type AiTutorSchoolLevel,
  type PurchaseBlock,
  type UpgradeBlockCode,
} from './ai-tutor-rules.js';
import {
  activateAiTutorSubscription,
  applyAiTutorUpgrade,
  cancelAiTutorUpgrade,
  createAiTutorSubscription,
  createAiTutorUpgrade,
  currentMonthlyTerms,
  type AiTutorUpgradeBlock,
} from './ai-tutor-turns.js';
import { isSubscriptionInvoiced } from './school-sales-fees.js';
import {
  asAiTutorLevel,
  CANCEL_MESSAGES,
  cancelBlock,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  parsePlanInput,
  parseSchoolSettings,
  readPeriodMonth,
  type PlanInput,
} from './school-sales-rules.js';

// Gia sư AI do trường bán (YCTD-383 lát L1a; bản mẫu MH-598, MH-599): quản trị trường bật theo cấp học, tạo, sửa, ngừng bán gói,
// đặt khung giờ khóa, xem các lần mua; phụ huynh mua cho từng con (mua là đồng ý cho con dùng), hủy khi chưa lên hóa đơn học phí và
// con chưa dùng lượt, nâng gói tháng giữa tháng, xem số lượt đã dùng. Lần mua của trường kích hoạt ngay; phí vào hóa đơn học phí kỳ
// tới (`school-sales-fees.ts`). Gói, lần mua ở cơ sở dữ liệu hệ thống; con, lớp, người giám hộ ở cơ sở dữ liệu năm học đang dùng
type SystemClient = Kysely<SystemDatabase>;
type PlanRow = Selectable<SystemDatabase['ai_tutor_plans']>;

const SETTINGS_ENTITY_ID = '00000000-0000-4000-8000-000000000383';
// Lịch sử lần mua phụ huynh xem: 12 tháng gần nhất
const HISTORY_MONTHS = 12;

const PURCHASE_MESSAGES: Record<PurchaseBlock['code'], string> = {
  plan_archived: 'Gói đã ngừng bán',
  level_not_allowed: 'Gói không dành cho cấp học của con',
  period_invalid: 'Tháng dùng không hợp lệ',
  period_past: 'Không mua gói cho tháng đã qua',
  monthly_exists: 'Con đã có gói tháng trong tháng này',
};

const UPGRADE_MESSAGES: Record<AiTutorUpgradeBlock, string> = {
  not_found: 'Không tìm thấy lần mua',
  upgrade_pending: 'Đang có một lần nâng gói chờ xử lý',
  not_monthly: 'Chỉ nâng gói tháng lên gói tháng khác',
  not_active: 'Gói đang dùng chưa kích hoạt hoặc đã hủy',
  source_mismatch: 'Gói mua trực tiếp từ nền tảng nâng ở mục Mua trực tiếp',
  plan_archived: 'Gói đã ngừng bán',
  level_not_allowed: 'Gói không dành cho cấp học của con',
  same_plan: 'Con đang dùng gói này',
  not_higher: 'Chỉ nâng lên gói có giá cao hơn và số lượt không ít hơn',
  period_ended: 'Tháng của gói đã hết',
};

function money(value: string | number): number {
  return Number(value);
}

function planView(plan: PlanRow) {
  return {
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    price: money(plan.price),
    turns: plan.turns,
    allow_images: plan.allow_images,
    school_levels: plan.school_levels,
    status: plan.status,
  };
}

function planForPurchase(plan: PlanRow) {
  return {
    source: 'school' as const,
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    price: plan.price,
    turns: plan.turns,
    allowImages: plan.allow_images,
    schoolLevels: plan.school_levels,
    status: plan.status,
  };
}

export interface ChildOfGuardian {
  id: string;
  full_name: string;
  class_name: string | null;
  school_level: AiTutorSchoolLevel | null;
}

@Injectable()
export class AiTutorSchoolSalesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private get system(): SystemClient {
    return this.databases.system;
  }

  async settings() {
    const row = await this.system
      .selectFrom('ai_tutor_school_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirst();
    return {
      enabled_levels: row?.enabled_levels ?? [],
      quiet_start: row?.quiet_start ?? DEFAULT_QUIET_START,
      quiet_end: row?.quiet_end ?? DEFAULT_QUIET_END,
      updated_by_name: row?.updated_by_name ?? null,
      updated_at: row?.updated_at ?? null,
    };
  }

  // ---------- Quản trị trường (MH-599)

  async overview() {
    const now = this.clock.now();
    const plans = await this.system
      .selectFrom('ai_tutor_plans')
      .selectAll()
      .orderBy('status')
      .orderBy('kind')
      .orderBy('price')
      .execute();
    // Đang dùng: lần mua còn hiệu lực của gói (gói tháng của tháng này hoặc tháng sau, gói lượt còn hạn)
    const counts = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .select(['plan_id', (expression) => expression.fn.countAll<string>().as('count')])
      .where('plan_source', '=', 'school')
      .where('status', '=', 'active')
      .where('valid_until', '>', now)
      .groupBy('plan_id')
      .execute();
    const countOf = new Map(counts.map((row) => [row.plan_id, Number(row.count)]));
    return {
      settings: await this.settings(),
      plans: plans.map((plan) => ({ ...planView(plan), active_count: countOf.get(plan.id) ?? 0 })),
    };
  }

  async saveSettings(body: RequestBody, currentUser: CurrentUser, origin: ChangeOrigin) {
    const errors: FieldError[] = [];
    const input = parseSchoolSettings(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const before = await this.settings();
    const values = {
      enabled_levels: input.enabled_levels,
      quiet_start: input.quiet_start,
      quiet_end: input.quiet_end,
      updated_by: currentUser.id,
      updated_by_name: actorNameOf(currentUser),
      updated_at: this.clock.now(),
    };
    await this.system
      .insertInto('ai_tutor_school_settings')
      .values({ id: 1, ...values })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
      .execute();
    await this.audit(origin, 'ai_tutor_school_settings', SETTINGS_ENTITY_ID, 'update', before, input);
    return this.settings();
  }

  async createPlan(body: RequestBody, currentUser: CurrentUser, origin: ChangeOrigin) {
    const errors: FieldError[] = [];
    const input = parsePlanInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const plan = await this.system
      .insertInto('ai_tutor_plans')
      .values({
        ...input,
        created_by: currentUser.id,
        created_by_name: actorNameOf(currentUser),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit(origin, 'ai_tutor_plans', plan.id, 'create', null, input);
    return planView(plan);
  }

  // Sửa gói, ngừng bán hoặc bán lại; lần mua đã có giữ bản chụp gói lúc mua nên không đổi
  async updatePlan(planId: string, body: RequestBody, origin: ChangeOrigin) {
    const existing = await this.system
      .selectFrom('ai_tutor_plans')
      .selectAll()
      .where('id', '=', planId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy gói', 'ai_tutor_plans');
    }
    const errors: FieldError[] = [];
    const input: PlanInput = parsePlanInput(body, errors, existing.kind);
    if (body?.kind !== undefined && body.kind !== existing.kind) {
      errors.push({ field: 'kind', message: 'Không đổi loại gói; tạo gói mới' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const plan = await this.system
      .updateTable('ai_tutor_plans')
      .set({
        name: input.name,
        price: input.price,
        turns: input.turns,
        allow_images: input.allow_images,
        school_levels: input.school_levels,
        status: input.status,
        updated_at: this.clock.now(),
      })
      .where('id', '=', planId)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit(origin, 'ai_tutor_plans', planId, 'update', planView(existing), input);
    return planView(plan);
  }

  // Các lần mua của trường, mới nhất trước; lọc theo tháng mua `YYYY-MM` (giờ Việt Nam)
  async purchases(month: string | undefined) {
    let from: Date | null = null;
    let until: Date | null = null;
    if (month !== undefined) {
      const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
      if (!match) {
        throw validationError([{ field: 'month', message: 'Tháng dạng YYYY-MM' }]);
      }
      from = new Date(`${month}-01T00:00:00+07:00`);
      const next = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
      until = new Date(`${next.toISOString().slice(0, 10)}T00:00:00+07:00`);
    }
    let subscriptionQuery = this.system
      .selectFrom('ai_tutor_subscriptions')
      .selectAll()
      .where('plan_source', '=', 'school')
      .orderBy('created_at', 'desc')
      .limit(500);
    if (from && until) {
      subscriptionQuery = subscriptionQuery.where('created_at', '>=', from).where('created_at', '<', until);
    }
    const subscriptions = await subscriptionQuery.execute();
    let upgradeQuery = this.system
      .selectFrom('ai_tutor_upgrades')
      .selectAll()
      .where('plan_source', '=', 'school')
      .orderBy('created_at', 'desc')
      .limit(500);
    if (from && until) {
      upgradeQuery = upgradeQuery.where('created_at', '>=', from).where('created_at', '<', until);
    }
    const upgrades = await upgradeQuery.execute();
    const childIds = [...new Set([...subscriptions, ...upgrades].map((row) => row.child_id))];
    const current = await this.currentSchoolYear.find();
    const names = new Map<string, { full_name: string; class_name: string | null }>();
    const invoiced = new Set<string>();
    if (current && childIds.length > 0) {
      const children = await this.childrenWithClass(current.database).where('children.id', 'in', childIds).execute();
      for (const child of children) {
        names.set(child.id, { full_name: child.full_name, class_name: child.class_name });
      }
      const charges = await current.database
        .selectFrom('ai_tutor_invoice_charges')
        .select(['subscription_id', 'upgrade_id'])
        .where('child_id', 'in', childIds)
        .execute();
      for (const charge of charges) {
        invoiced.add(charge.upgrade_id ?? charge.subscription_id);
      }
    }
    return {
      purchases: subscriptions.map((row) => ({
        id: row.id,
        child_id: row.child_id,
        child_name: names.get(row.child_id)?.full_name ?? null,
        class_name: names.get(row.child_id)?.class_name ?? null,
        plan_kind: row.plan_kind,
        plan_name: row.plan_name,
        period_month: row.period_month,
        price: money(row.price),
        status: row.status,
        turns: row.turns,
        used_turns: row.used_turns,
        buyer_name: row.buyer_name,
        created_at: row.created_at,
        cancelled_at: row.cancelled_at,
        invoiced: invoiced.has(row.id),
      })),
      upgrades: upgrades.map((row) => ({
        id: row.id,
        subscription_id: row.subscription_id,
        child_id: row.child_id,
        child_name: names.get(row.child_id)?.full_name ?? null,
        from_plan_name: row.from_plan_name,
        to_plan_name: row.to_plan_name,
        remaining_days: row.remaining_days,
        days_in_month: row.days_in_month,
        price_difference: money(row.price_difference),
        extra_turns: row.extra_turns,
        status: row.status,
        buyer_name: row.buyer_name,
        created_at: row.created_at,
        invoiced: invoiced.has(row.id),
      })),
    };
  }

  // ---------- Phụ huynh (MH-598)

  private childrenWithClass(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'classes.name as class_name', 'classes.school_level']);
  }

  // Con của người giám hộ đang đăng nhập, kèm cấp học của lớp đang học; không phải con của mình thì từ chối
  private async guardianChild(currentUser: CurrentUser, childId: string): Promise<ChildOfGuardian> {
    const { database } = await this.currentSchoolYear.require();
    const row = isUuid(childId)
      ? await this.childrenWithClass(database)
          .innerJoin('child_guardians', 'child_guardians.child_id', 'children.id')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .where('children.id', '=', childId)
          .where('guardians.user_id', '=', currentUser.id)
          .executeTakeFirst()
      : undefined;
    if (!row) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
    return {
      id: row.id,
      full_name: row.full_name,
      class_name: row.class_name,
      school_level: asAiTutorLevel(row.school_level),
    };
  }

  // Trang mua của phụ huynh cho một con: gói đang bán cho cấp của con, các lần mua 12 tháng gần đây (cả hai nguồn), số lượt
  async childView(currentUser: CurrentUser, childId: string) {
    const child = await this.guardianChild(currentUser, childId);
    const settings = await this.settings();
    const now = this.clock.now();
    const enabled = child.school_level !== null && settings.enabled_levels.includes(child.school_level);
    const plans =
      enabled && child.school_level
        ? await this.system
            .selectFrom('ai_tutor_plans')
            .selectAll()
            .where('status', '=', 'active')
            .where(sql<boolean>`${child.school_level} = any(school_levels)`)
            .orderBy('kind')
            .orderBy('price')
            .execute()
        : [];
    const since = new Date(now.getTime() - HISTORY_MONTHS * 31 * 24 * 60 * 60 * 1000);
    const subscriptions = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .selectAll()
      .where('child_id', '=', child.id)
      .where('created_at', '>=', since)
      .orderBy('created_at', 'desc')
      .execute();
    const upgrades =
      subscriptions.length > 0
        ? await this.system
            .selectFrom('ai_tutor_upgrades')
            .selectAll()
            .where(
              'subscription_id',
              'in',
              subscriptions.map((row) => row.id),
            )
            .orderBy('created_at')
            .execute()
        : [];
    const { database } = await this.currentSchoolYear.require();
    const invoicedRows =
      subscriptions.length > 0
        ? await database
            .selectFrom('ai_tutor_invoice_charges')
            .select('subscription_id')
            .where(
              'subscription_id',
              'in',
              subscriptions.map((row) => row.id),
            )
            .execute()
        : [];
    const invoiced = new Set(invoicedRows.map((row) => row.subscription_id));
    const balance = turnBalance(
      subscriptions.map((row) => ({
        id: row.id,
        planKind: row.plan_kind,
        status: row.status,
        turns: row.turns,
        usedTurns: row.used_turns,
        heldTurns: row.held_turns,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        activatedAt: row.activated_at,
      })),
      now,
    );
    const currentMonth = vietnamMonthOf(now);
    const nextMonthDate = new Date(`${currentMonth}T00:00:00+07:00`);
    nextMonthDate.setUTCDate(nextMonthDate.getUTCDate() + 40);
    return {
      child,
      enabled,
      quiet_start: settings.quiet_start,
      quiet_end: settings.quiet_end,
      current_month: currentMonth,
      next_month: vietnamMonthOf(nextMonthDate),
      plans: plans.map(planView),
      balance: { monthly: balance.monthly, top_up: balance.topUp },
      subscriptions: subscriptions.map((row) => {
        const block = cancelBlock(
          { planSource: row.plan_source, status: row.status, usedTurns: row.used_turns, heldTurns: row.held_turns },
          invoiced.has(row.id),
        );
        return {
          id: row.id,
          plan_source: row.plan_source,
          plan_id: row.plan_id,
          plan_kind: row.plan_kind,
          plan_name: row.plan_name,
          period_month: row.period_month,
          price: money(row.price),
          allow_images: row.allow_images,
          status: row.status,
          turns: row.turns,
          used_turns: row.used_turns,
          held_turns: row.held_turns,
          valid_from: row.valid_from,
          valid_until: row.valid_until,
          created_at: row.created_at,
          buyer_name: row.buyer_name,
          invoiced: invoiced.has(row.id),
          can_cancel: block === null,
          cancel_note: block && block !== 'not_cancellable' ? CANCEL_MESSAGES[block] : null,
          upgrades: upgrades
            .filter((upgrade) => upgrade.subscription_id === row.id)
            .map((upgrade) => ({
              id: upgrade.id,
              from_plan_name: upgrade.from_plan_name,
              to_plan_name: upgrade.to_plan_name,
              price_difference: money(upgrade.price_difference),
              extra_turns: upgrade.extra_turns,
              remaining_days: upgrade.remaining_days,
              days_in_month: upgrade.days_in_month,
              status: upgrade.status,
              created_at: upgrade.created_at,
            })),
        };
      }),
    };
  }

  private async sellablePlan(planId: unknown, child: ChildOfGuardian): Promise<PlanRow> {
    if (!child.school_level) {
      throw ruleViolationError('BR-461', 'Gia sư AI dùng cho học sinh Tiểu học, Trung học cơ sở, Trung học phổ thông');
    }
    const settings = await this.settings();
    if (!settings.enabled_levels.includes(child.school_level)) {
      throw ruleViolationError('BR-461', 'Trường chưa bật Gia sư AI cho cấp học của con');
    }
    if (!isUuid(planId)) {
      throw validationError([{ field: 'plan_id', message: 'Chọn gói' }]);
    }
    const plan = await this.system.selectFrom('ai_tutor_plans').selectAll().where('id', '=', planId).executeTakeFirst();
    if (!plan) {
      throw notFoundError('Không tìm thấy gói', 'ai_tutor_plans');
    }
    return plan;
  }

  // Phụ huynh mua gói của trường cho con: mua là đồng ý cho con dùng; kích hoạt ngay, phí vào hóa đơn học phí kỳ tới
  async purchase(currentUser: CurrentUser, childId: string, body: RequestBody, origin: ChangeOrigin) {
    const child = await this.guardianChild(currentUser, childId);
    const plan = await this.sellablePlan(body?.plan_id, child);
    const errors: FieldError[] = [];
    const periodMonth = readPeriodMonth(body, plan.kind, errors);
    if (body?.consent !== true) {
      errors.push({ field: 'consent', message: 'Xác nhận đồng ý cho con dùng Gia sư AI' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const result = await createAiTutorSubscription(
      this.system,
      {
        childId: child.id,
        childSchoolLevel: child.school_level as AiTutorSchoolLevel,
        plan: planForPurchase(plan),
        periodMonth,
        buyerUserId: currentUser.id,
        buyerName: actorNameOf(currentUser),
        pendingExpiresAt: null,
      },
      now,
    );
    if (!result.ok) {
      const message =
        result.block.code === 'monthly_exists'
          ? result.block.source === 'platform'
            ? 'Con đã có gói tháng mua trực tiếp từ nền tảng trong tháng này'
            : 'Con đã có gói tháng của trường trong tháng này; muốn thêm lượt thì nâng gói hoặc mua gói lượt'
          : PURCHASE_MESSAGES[result.block.code];
      throw ruleViolationError('BR-462', message);
    }
    await activateAiTutorSubscription(this.system, result.subscriptionId, now, null);
    await this.audit(origin, 'ai_tutor_subscriptions', result.subscriptionId, 'create', null, {
      child_id: child.id,
      plan_id: plan.id,
      plan_name: plan.name,
      price: money(plan.price),
      period_month: periodMonth,
      consent: true,
    });
    return this.childView(currentUser, childId);
  }

  // Phụ huynh hủy lần mua của trường khi chưa lên hóa đơn học phí nào và con chưa dùng lượt (BR-463)
  async cancel(currentUser: CurrentUser, childId: string, subscriptionId: string, origin: ChangeOrigin) {
    const child = await this.guardianChild(currentUser, childId);
    const { database } = await this.currentSchoolYear.require();
    const subscription = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .selectAll()
      .where('id', '=', subscriptionId)
      .where('child_id', '=', child.id)
      .executeTakeFirst();
    if (!subscription) {
      throw notFoundError('Không tìm thấy lần mua', 'ai_tutor_subscriptions');
    }
    const block = cancelBlock(
      {
        planSource: subscription.plan_source,
        status: subscription.status,
        usedTurns: subscription.used_turns,
        heldTurns: subscription.held_turns,
      },
      await isSubscriptionInvoiced(database, subscription.id),
    );
    if (block) {
      throw ruleViolationError('BR-463', CANCEL_MESSAGES[block]);
    }
    const now = this.clock.now();
    // Điều kiện lặp lại trong câu cập nhật để lượt vừa giữ hoặc lần hủy song song không lọt qua
    const result = await this.system
      .updateTable('ai_tutor_subscriptions')
      .set({ status: 'cancelled', cancelled_at: now, cancel_reason: 'Phụ huynh hủy', updated_at: now })
      .where('id', '=', subscription.id)
      .where('status', 'in', ['pending', 'active'])
      .where('used_turns', '=', 0)
      .where('held_turns', '=', 0)
      .executeTakeFirst();
    if (result.numUpdatedRows !== 1n) {
      throw ruleViolationError('BR-463', CANCEL_MESSAGES.turns_used);
    }
    await this.audit(
      origin,
      'ai_tutor_subscriptions',
      subscription.id,
      'update',
      { status: subscription.status },
      { status: 'cancelled', cancel_reason: 'Phụ huynh hủy' },
    );
    return this.childView(currentUser, childId);
  }

  // Báo giá nâng gói tháng của trường lên gói khác, theo số ngày còn lại của tháng (BR-464)
  async upgradePreview(currentUser: CurrentUser, childId: string, subscriptionId: string, planId: unknown) {
    const child = await this.guardianChild(currentUser, childId);
    const plan = await this.sellablePlan(planId, child);
    const subscription = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .selectAll()
      .where('id', '=', subscriptionId)
      .where('child_id', '=', child.id)
      .executeTakeFirst();
    if (!subscription) {
      throw notFoundError('Không tìm thấy lần mua', 'ai_tutor_subscriptions');
    }
    const now = this.clock.now();
    const terms = await currentMonthlyTerms(this.system, subscription);
    const expired = subscription.valid_until !== null && subscription.valid_until.getTime() <= now.getTime();
    const priced = upgradeQuote(
      {
        planSource: subscription.plan_source,
        planKind: subscription.plan_kind,
        planId: subscription.plan_id,
        status: expired ? 'cancelled' : subscription.status,
        periodMonth: subscription.period_month,
        monthlyPrice: terms.price,
        monthlyTurns: terms.turns,
      },
      { ...planForPurchase(plan), price: money(plan.price) },
      child.school_level as AiTutorSchoolLevel,
      now,
    );
    if (!priced.ok) {
      const code: UpgradeBlockCode = expired && priced.code === 'not_active' ? 'period_ended' : priced.code;
      throw ruleViolationError('BR-464', UPGRADE_MESSAGES[code]);
    }
    return {
      from_plan_name: subscription.plan_name,
      to_plan_name: plan.name,
      remaining_days: priced.quote.remainingDays,
      days_in_month: priced.quote.daysInMonth,
      price_difference: priced.quote.priceDifference,
      extra_turns: priced.quote.extraTurns,
      to_allow_images: plan.allow_images,
    };
  }

  // Nâng gói tháng của trường: ghi rồi áp ngay; phần chênh lệch thành dòng thu trên hóa đơn học phí kỳ tới (BR-464)
  async upgrade(
    currentUser: CurrentUser,
    childId: string,
    subscriptionId: string,
    body: RequestBody,
    origin: ChangeOrigin,
  ) {
    const child = await this.guardianChild(currentUser, childId);
    const plan = await this.sellablePlan(body?.plan_id, child);
    const owned = await this.system
      .selectFrom('ai_tutor_subscriptions')
      .select('id')
      .where('id', '=', subscriptionId)
      .where('child_id', '=', child.id)
      .executeTakeFirst();
    if (!owned) {
      throw notFoundError('Không tìm thấy lần mua', 'ai_tutor_subscriptions');
    }
    const now = this.clock.now();
    const created = await createAiTutorUpgrade(
      this.system,
      {
        subscriptionId,
        childSchoolLevel: child.school_level as AiTutorSchoolLevel,
        target: planForPurchase(plan),
        buyerUserId: currentUser.id,
        buyerName: actorNameOf(currentUser),
        pendingExpiresAt: null,
      },
      now,
    );
    if (!created.ok) {
      throw ruleViolationError('BR-464', UPGRADE_MESSAGES[created.code]);
    }
    if (!(await applyAiTutorUpgrade(this.system, created.upgradeId, now, null))) {
      await cancelAiTutorUpgrade(this.system, created.upgradeId, 'Gói đã đổi trong lúc nâng', now);
      throw ruleViolationError('BR-464', 'Gói của con vừa thay đổi, vui lòng tải lại trang và thử lại');
    }
    await this.audit(origin, 'ai_tutor_upgrades', created.upgradeId, 'create', null, {
      subscription_id: subscriptionId,
      to_plan_id: plan.id,
      price_difference: created.quote.priceDifference,
      extra_turns: created.quote.extraTurns,
      remaining_days: created.quote.remainingDays,
      days_in_month: created.quote.daysInMonth,
    });
    return this.childView(currentUser, childId);
  }

  private async audit(
    origin: ChangeOrigin,
    entityName: string,
    entityId: string,
    action: 'create' | 'update',
    before: unknown,
    after: unknown,
  ) {
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, { origin, orgUnitId: null, entityName, entityId, action, before, after });
    }
  }
}

import type { TenantPlan } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase, SchoolStatusValue } from '../platform/schema.js';
import { writeAudit } from './provision-school.js';

// Gói dịch vụ của trường và chuyển trạng thái theo hạn (DT-SaaS phần S5a, YCTD-194; tài liệu 32 mục 14.5). Hàm thư viện dùng cho
// bộ phân giải trường (gói hiện hành vào ngữ cảnh), cổng vận hành, lệnh `platform plan-lifecycle` và bộ lập lịch theo trường của
// S1b. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - gói hiện hành là bản gán có `effective_from` ≤ hôm nay và (`effective_to` trống hoặc > hôm nay), mới nhất trước; trường chưa
//   gán gói không bị giới hạn (dùng như trước);
// - hạn của trường đang dùng thử là `trial_ends_on`, của trường hoạt động là `paid_until` (trống là không hạn); quá hạn số ngày cấu
//   hình thì chuyển chỉ đọc, quá tiếp thì tạm ngưng; không bao giờ xóa dữ liệu; trạng thái khác (đang khởi tạo, chờ xóa, đã xóa)
//   không đụng tới; trường đã chỉ đọc hoặc tạm ngưng được gia hạn thì người vận hành mở lại (không tự mở lại).

export interface PlanLifecycleSettings {
  remindDays: number[];
  readOnlyAfterDays: number;
  suspendAfterDays: number;
  defaultTrialDays: number;
}

export const DEFAULT_PLAN_LIFECYCLE: PlanLifecycleSettings = {
  remindDays: [15, 7, 1],
  readOnlyAfterDays: 7,
  suspendAfterDays: 30,
  defaultTrialDays: 30,
};

const DAY = 86_400_000;

// Ngày theo giờ Việt Nam dạng yyyy-mm-dd
export function vietnamDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function asDateText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return vietnamDate(value);
  }
  return String(value).slice(0, 10);
}

export async function readPlanLifecycleSettings(platform: Kysely<PlatformDatabase>): Promise<PlanLifecycleSettings> {
  const row = await platform
    .selectFrom('platform_settings')
    .select('value')
    .where('key', '=', 'plan_lifecycle')
    .executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const number = (key: string, fallback: number) =>
    typeof value[key] === 'number' && Number.isInteger(value[key]) && (value[key] as number) >= 0
      ? (value[key] as number)
      : fallback;
  const remind = Array.isArray(value.remind_days)
    ? (value.remind_days as unknown[]).filter((day): day is number => typeof day === 'number' && day >= 0)
    : DEFAULT_PLAN_LIFECYCLE.remindDays;
  return {
    remindDays: remind,
    readOnlyAfterDays: number('read_only_after_days', DEFAULT_PLAN_LIFECYCLE.readOnlyAfterDays),
    suspendAfterDays: number('suspend_after_days', DEFAULT_PLAN_LIFECYCLE.suspendAfterDays),
    defaultTrialDays: number('default_trial_days', DEFAULT_PLAN_LIFECYCLE.defaultTrialDays),
  };
}

// Gói hiện hành của trường (null: chưa gán gói, không giới hạn)
export async function loadCurrentPlan(
  platform: Kysely<PlatformDatabase>,
  schoolId: string,
  today: string,
): Promise<TenantPlan | null> {
  const row = await platform
    .selectFrom('school_plans')
    .innerJoin('plans', 'plans.id', 'school_plans.plan_id')
    .select([
      'plans.code',
      'plans.name',
      'plans.modules',
      'plans.max_active_students',
      'plans.max_storage_mb',
      'plans.max_school_levels',
      'plans.ai_max_requests',
      'plans.ai_max_tokens',
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
  return {
    code: row.code,
    name: row.name,
    modules: Array.isArray(row.modules) ? row.modules : null,
    maxActiveStudents: row.max_active_students,
    maxStorageMb: row.max_storage_mb,
    maxSchoolLevels: row.max_school_levels,
    aiMaxRequests: row.ai_max_requests,
    aiMaxTokens: row.ai_max_tokens,
  };
}

export interface LifecycleInput {
  status: SchoolStatusValue;
  trialEndsOn: string | null;
  paidUntil: string | null;
}

export interface LifecycleDecision {
  // Trạng thái mới, hoặc null khi giữ nguyên
  next: SchoolStatusValue | null;
  dueOn: string | null;
  daysLeft: number | null;
  // Số ngày còn lại trùng một mốc nhắc (để S1b, S4 gửi nhắc)
  remind: boolean;
}

// Quyết định chuyển trạng thái của một trường ở ngày `today` (hàm thuần)
export function decideLifecycle(
  input: LifecycleInput,
  today: string,
  settings: PlanLifecycleSettings,
): LifecycleDecision {
  const dueOn =
    input.status === 'trial'
      ? input.trialEndsOn
      : input.status === 'active' || input.status === 'read_only' || input.status === 'suspended'
        ? (input.paidUntil ?? (input.status === 'active' ? null : input.trialEndsOn))
        : null;
  if (!dueOn || !['trial', 'active', 'read_only'].includes(input.status)) {
    return { next: null, dueOn, daysLeft: dueOn ? daysBetween(today, dueOn) : null, remind: false };
  }
  const daysLeft = daysBetween(today, dueOn);
  const overdue = -daysLeft;
  let next: SchoolStatusValue | null = null;
  if (overdue > settings.suspendAfterDays) {
    next = 'suspended';
  } else if (overdue > settings.readOnlyAfterDays && input.status !== 'read_only') {
    next = 'read_only';
  }
  return { next, dueOn, daysLeft, remind: daysLeft >= 0 && settings.remindDays.includes(daysLeft) };
}

export interface LifecycleChange {
  schoolId: string;
  code: string;
  from: SchoolStatusValue;
  to: SchoolStatusValue;
  dueOn: string | null;
}

export interface LifecycleReminder {
  schoolId: string;
  code: string;
  status: SchoolStatusValue;
  dueOn: string;
  daysLeft: number;
}

// Chạy chuyển trạng thái cho mọi trường; chạy lặp trong ngày không đổi thêm (trạng thái đã chuyển thì giữ). S1b gọi từ bộ lập lịch
export async function applyPlanLifecycle(
  platform: Kysely<PlatformDatabase>,
  now: Date,
  actor: { type: 'system' | 'cli' | 'operator'; id?: string } = { type: 'system' },
  // Chỉ một trường (việc nền theo trường của S5b gọi); trống là mọi trường
  schoolId?: string,
): Promise<{ changes: LifecycleChange[]; reminders: LifecycleReminder[] }> {
  const today = vietnamDate(now);
  const settings = await readPlanLifecycleSettings(platform);
  let query = platform
    .selectFrom('schools')
    .select(['id', 'code', 'status', 'trial_ends_on', 'paid_until'])
    .where('status', 'in', ['trial', 'active', 'read_only']);
  if (schoolId) {
    query = query.where('id', '=', schoolId);
  }
  const schools = await query.orderBy('code').execute();
  const changes: LifecycleChange[] = [];
  const reminders: LifecycleReminder[] = [];
  for (const school of schools) {
    const decision = decideLifecycle(
      {
        status: school.status,
        trialEndsOn: asDateText(school.trial_ends_on),
        paidUntil: asDateText(school.paid_until),
      },
      today,
      settings,
    );
    if (decision.remind && decision.dueOn && decision.daysLeft !== null) {
      reminders.push({
        schoolId: school.id,
        code: school.code,
        status: school.status,
        dueOn: decision.dueOn,
        daysLeft: decision.daysLeft,
      });
    }
    if (!decision.next || decision.next === school.status) {
      continue;
    }
    const updated = await platform
      .updateTable('schools')
      .set({ status: decision.next, status_changed_at: now, updated_at: now })
      .where('id', '=', school.id)
      .where('status', '=', school.status)
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) === 0) {
      continue;
    }
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.plan-status',
      schoolId: school.id,
      details: { from: school.status, to: decision.next, due_on: decision.dueOn },
    });
    changes.push({
      schoolId: school.id,
      code: school.code,
      from: school.status,
      to: decision.next,
      dueOn: decision.dueOn,
    });
  }
  return { changes, reminders };
}

// Quy tắc thuần của gia sư AI trả phí (YCTD-383 lát L0; đề xuất Eric duyệt ngày 2026-10-30, Q1, Q2): khoảng dùng của gói, chặn mua trùng
// gói tháng giữa trường bán và nền tảng bán, thứ tự trừ lượt. Không đọc cơ sở dữ liệu; `ai-tutor-turns.ts` dùng các hàm này trong giao dịch.

export type AiTutorPlanKind = 'monthly' | 'top_up';
export type AiTutorPlanSource = 'school' | 'platform';
export type AiTutorSchoolLevel = 'TH' | 'THCS' | 'THPT';

// Giờ Việt Nam cố định UTC+7, không đổi giờ theo mùa
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
// Lượt mua thêm giữ 12 tháng từ ngày mua (Eric xác nhận ngày 2026-10-30)
export const TOP_UP_VALID_MONTHS = 12;
// Lượt tạm giữ quá thời gian này mà chưa trừ hoặc hoàn (máy chủ dừng giữa chừng) thì được hoàn
export const STALE_HOLD_MINUTES = 10;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-01$/;

// Tháng theo giờ Việt Nam của một thời điểm, dạng `YYYY-MM-01`
export function vietnamMonthOf(moment: Date): string {
  return `${new Date(moment.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 7)}-01`;
}

export function isPeriodMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

// Khoảng dùng của gói tháng: 0 giờ ngày đầu tháng tới 0 giờ ngày đầu tháng sau, giờ Việt Nam
export function monthlyWindow(periodMonth: string): { validFrom: Date; validUntil: Date } {
  const match = MONTH_PATTERN.exec(periodMonth);
  if (!match) {
    throw new Error(`Tháng không hợp lệ: ${periodMonth}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    validFrom: new Date(Date.UTC(year, month - 1, 1) - VIETNAM_OFFSET_MS),
    validUntil: new Date(Date.UTC(year, month, 1) - VIETNAM_OFFSET_MS),
  };
}

// Hạn của lượt mua thêm: cùng ngày, cùng giờ sau 12 tháng theo lịch Việt Nam; ngày không có ở tháng đích (29/02) lùi về ngày cuối tháng
export function topUpValidUntil(purchasedAt: Date): Date {
  const local = new Date(purchasedAt.getTime() + VIETNAM_OFFSET_MS);
  const targetYear = local.getUTCFullYear() + Math.floor((local.getUTCMonth() + TOP_UP_VALID_MONTHS) / 12);
  const targetMonth = (local.getUTCMonth() + TOP_UP_VALID_MONTHS) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const shifted = Date.UTC(
    targetYear,
    targetMonth,
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(shifted - VIETNAM_OFFSET_MS);
}

// Khoảng dùng khi kích hoạt
export function subscriptionWindow(
  planKind: AiTutorPlanKind,
  periodMonth: string | null,
  activatedAt: Date,
): { validFrom: Date; validUntil: Date } {
  if (planKind === 'monthly') {
    if (!periodMonth) {
      throw new Error('Gói tháng phải có tháng dùng');
    }
    return monthlyWindow(periodMonth);
  }
  return { validFrom: activatedAt, validUntil: topUpValidUntil(activatedAt) };
}

export interface ExistingSubscription {
  planKind: AiTutorPlanKind;
  planSource: AiTutorPlanSource;
  periodMonth: string | null;
  status: 'pending' | 'active' | 'cancelled' | 'refunded';
  pendingExpiresAt: Date | null;
}

export interface PurchaseRequest {
  planKind: AiTutorPlanKind;
  planStatus: 'active' | 'archived';
  planSchoolLevels: readonly AiTutorSchoolLevel[];
  childSchoolLevel: AiTutorSchoolLevel;
  // Gói tháng: tháng dùng `YYYY-MM-01`; gói lượt: trống
  periodMonth: string | null;
}

export type PurchaseBlock =
  | { code: 'plan_archived' }
  | { code: 'level_not_allowed' }
  | { code: 'period_invalid' }
  | { code: 'period_past' }
  | { code: 'monthly_exists'; source: AiTutorPlanSource; status: 'pending' | 'active' };

// Dòng chờ thanh toán đã quá hạn giữ chỗ thì không còn chặn (giao dịch ghi hủy dòng đó trước khi ghi dòng mới)
export function isPendingExpired(subscription: Pick<ExistingSubscription, 'status' | 'pendingExpiresAt'>, now: Date) {
  return (
    subscription.status === 'pending' &&
    subscription.pendingExpiresAt !== null &&
    subscription.pendingExpiresAt.getTime() <= now.getTime()
  );
}

// Lý do không cho mua; trống là được mua. Mỗi con chỉ một gói tháng đang chờ hoặc còn hiệu lực trong một tháng, bất kể nguồn bán (Q1);
// gói lượt ai cũng mua được, không giới hạn số lần (Q2)
export function purchaseBlock(
  request: PurchaseRequest,
  existing: readonly ExistingSubscription[],
  now: Date,
): PurchaseBlock | null {
  if (request.planStatus !== 'active') {
    return { code: 'plan_archived' };
  }
  if (!request.planSchoolLevels.includes(request.childSchoolLevel)) {
    return { code: 'level_not_allowed' };
  }
  if (request.planKind === 'top_up') {
    return request.periodMonth === null ? null : { code: 'period_invalid' };
  }
  if (request.periodMonth === null || !isPeriodMonth(request.periodMonth)) {
    return { code: 'period_invalid' };
  }
  if (request.periodMonth < vietnamMonthOf(now)) {
    return { code: 'period_past' };
  }
  const holder = existing.find(
    (subscription) =>
      subscription.planKind === 'monthly' &&
      subscription.periodMonth === request.periodMonth &&
      (subscription.status === 'active' || (subscription.status === 'pending' && !isPendingExpired(subscription, now))),
  );
  if (holder) {
    return { code: 'monthly_exists', source: holder.planSource, status: holder.status as 'pending' | 'active' };
  }
  return null;
}

export interface TurnCandidate {
  id: string;
  planKind: AiTutorPlanKind;
  status: 'pending' | 'active' | 'cancelled' | 'refunded';
  turns: number;
  usedTurns: number;
  heldTurns: number;
  validFrom: Date | null;
  validUntil: Date | null;
  activatedAt: Date | null;
}

export function remainingTurns(candidate: Pick<TurnCandidate, 'turns' | 'usedTurns' | 'heldTurns'>): number {
  return Math.max(0, candidate.turns - candidate.usedTurns - candidate.heldTurns);
}

export function isUsable(candidate: TurnCandidate, now: Date): boolean {
  return (
    candidate.status === 'active' &&
    candidate.validFrom !== null &&
    candidate.validUntil !== null &&
    candidate.validFrom.getTime() <= now.getTime() &&
    now.getTime() < candidate.validUntil.getTime() &&
    remainingTurns(candidate) > 0
  );
}

// Thứ tự trừ lượt (Q2): lượt của gói tháng trước; hết mới tới lượt mua thêm, gói sắp hết hạn trước, cùng hạn thì gói mua trước
export function turnOrder(candidates: readonly TurnCandidate[], now: Date): TurnCandidate[] {
  return candidates
    .filter((candidate) => isUsable(candidate, now))
    .sort((left, right) => {
      if (left.planKind !== right.planKind) {
        return left.planKind === 'monthly' ? -1 : 1;
      }
      const byExpiry = left.validUntil!.getTime() - right.validUntil!.getTime();
      if (byExpiry !== 0) {
        return byExpiry;
      }
      const byActivation = (left.activatedAt?.getTime() ?? 0) - (right.activatedAt?.getTime() ?? 0);
      return byActivation !== 0 ? byActivation : left.id.localeCompare(right.id);
    });
}

// Số lượt còn dùng được, tách theo gói tháng và lượt mua thêm (thanh số lượt ở ứng dụng học sinh, phụ huynh)
export function turnBalance(candidates: readonly TurnCandidate[], now: Date): { monthly: number; topUp: number } {
  let monthly = 0;
  let topUp = 0;
  for (const candidate of candidates) {
    if (!isUsable(candidate, now)) {
      continue;
    }
    if (candidate.planKind === 'monthly') {
      monthly += remainingTurns(candidate);
    } else {
      topUp += remainingTurns(candidate);
    }
  }
  return { monthly, topUp };
}

import { ruleViolationError, type FieldError } from '@school-management/server';
import { participantMinutes } from '@school-management/shared';

// Quy tắc thuần của giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277; tài liệu 47 mục 20.7). Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - giờ học dài 5 đến 240 phút (mặc định 45); điểm danh gợi ý "có mặt" khi dự từ nửa thời lượng trở lên, "vào muộn hoặc ra sớm" khi
//   có dự nhưng chưa đủ, "vắng" khi không vào; giáo viên xác nhận mới ghi kết quả hoạt động;
// - phòng chia nhỏ 2 đến 20 phòng, mỗi lần 1 đến 120 phút; chia ngẫu nhiên có hạt để giáo viên xem lại được;
// - giờ mở phòng nhóm dùng chung cấu hình giờ mở thảo luận của trường (GD-144, Eric đã chốt 2026-10-28: trường tự cấu hình, mặc định
//   không giới hạn); phòng giáo viên mở không theo giờ mở
export const LIVE_RULE_CODE = 'YCTD-277';
export const DEFAULT_DURATION_MINUTES = 45;
export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 240;
export const MIN_BREAKOUTS = 2;
export const MAX_BREAKOUTS = 20;
export const MAX_BREAKOUT_MINUTES = 120;
export const MAX_NOTICE_LENGTH = 500;

export function liveRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(LIVE_RULE_CODE, message, fields);
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

// Cài đặt của hoạt động giờ học trực tuyến: thời lượng (phút). Giờ bắt đầu là `opens_at` của hoạt động nên lịch học tập của 28e
// tự hiện giờ học
export function parseLiveSettings(raw: unknown, field: string, errors: FieldError[]): { duration_minutes: number } {
  const value = asObject(raw).duration_minutes;
  if (value === undefined || value === null) {
    return { duration_minutes: DEFAULT_DURATION_MINUTES };
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_DURATION_MINUTES ||
    value > MAX_DURATION_MINUTES
  ) {
    errors.push({
      field: `${field}.duration_minutes`,
      message: `Thời lượng giờ học từ ${MIN_DURATION_MINUTES} đến ${MAX_DURATION_MINUTES} phút`,
    });
    return { duration_minutes: DEFAULT_DURATION_MINUTES };
  }
  return { duration_minutes: value };
}

export function durationOf(settings: unknown): number {
  const value = asObject(settings).duration_minutes;
  return typeof value === 'number' && Number.isInteger(value) ? value : DEFAULT_DURATION_MINUTES;
}

export type AttendanceSuggestion = 'present' | 'partial' | 'absent';

export interface LiveEvent {
  identity: string;
  kind: 'join' | 'leave';
  at: Date;
}

// Phút dự của từng học sinh từ nhật ký vào ra của phòng giờ học và các phòng chia nhỏ (mã người dự `s:<mã học sinh>`); còn trong
// phòng thì tính đến `until`
export function attendanceOf(
  childIds: readonly string[],
  events: readonly LiveEvent[],
  until: Date,
  durationMinutes: number,
): Array<{ child_id: string; minutes: number; first_join: Date | null; suggestion: AttendanceSuggestion }> {
  return childIds.map((childId) => {
    const own = events.filter((event) => event.identity === `s:${childId}`);
    const minutes = own.length === 0 ? 0 : participantMinutes(own, until);
    const joins = own.filter((event) => event.kind === 'join').map((event) => event.at.getTime());
    const first = joins.length > 0 ? new Date(Math.min(...joins)) : null;
    const suggestion: AttendanceSuggestion =
      first === null ? 'absent' : minutes * 2 >= durationMinutes ? 'present' : 'partial';
    return { child_id: childId, minutes, first_join: first, suggestion };
  });
}

// Trạng thái kết quả hoạt động khi giáo viên xác nhận điểm danh
export function resultOfAttendance(status: unknown): 'completed' | 'not_started' | 'excused' | null {
  if (status === 'present') return 'completed';
  if (status === 'absent') return 'not_started';
  if (status === 'excused') return 'excused';
  return null;
}

// Xáo trộn có hạt (thuật toán Fisher–Yates với bộ sinh số mulberry32) rồi chia lần lượt vào `count` phòng
export function splitRandom(childIds: readonly string[], count: number, seed: number): string[][] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...childIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other] as string, shuffled[index] as string];
  }
  const rooms: string[][] = Array.from({ length: count }, () => []);
  shuffled.forEach((childId, index) => rooms[index % count]?.push(childId));
  return rooms;
}

// Số phòng chia nhỏ và thời lượng giáo viên nhập
export function parseBreakoutRequest(
  body: Record<string, unknown> | undefined,
  studentCount: number,
): { count: number | null; groupSetId: string | null; minutes: number; seed: number; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const groupSetId = typeof body?.group_set_id === 'string' && body.group_set_id !== '' ? body.group_set_id : null;
  const rawCount = body?.count;
  let count: number | null = null;
  if (!groupSetId) {
    if (
      typeof rawCount !== 'number' ||
      !Number.isInteger(rawCount) ||
      rawCount < MIN_BREAKOUTS ||
      rawCount > Math.min(MAX_BREAKOUTS, Math.max(MIN_BREAKOUTS, studentCount))
    ) {
      errors.push({
        field: 'count',
        message: `Chọn bộ nhóm hoặc số phòng từ ${MIN_BREAKOUTS} đến ${Math.min(MAX_BREAKOUTS, Math.max(MIN_BREAKOUTS, studentCount))}`,
      });
    } else {
      count = rawCount;
    }
  }
  const rawMinutes = body?.minutes;
  const minutes =
    typeof rawMinutes === 'number' &&
    Number.isInteger(rawMinutes) &&
    rawMinutes >= 1 &&
    rawMinutes <= MAX_BREAKOUT_MINUTES
      ? rawMinutes
      : null;
  if (minutes === null) {
    errors.push({ field: 'minutes', message: `Thời lượng phòng chia nhỏ từ 1 đến ${MAX_BREAKOUT_MINUTES} phút` });
  }
  const rawSeed = body?.seed;
  const seed =
    typeof rawSeed === 'number' && Number.isInteger(rawSeed) && rawSeed >= 0
      ? rawSeed
      : Math.floor(Math.random() * 2 ** 31);
  return { count, groupSetId, minutes: minutes ?? 0, seed, errors };
}

// Học sinh luôn thấy giáo viên (chủ phòng hoặc người quan sát) đang ở trong phòng (GD-149)
export function teacherWatching(participants: ReadonlyArray<{ role: string; left_at: Date | null }>): boolean {
  return participants.some((participant) => participant.role !== 'student' && participant.left_at === null);
}

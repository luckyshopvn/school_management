import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import type { RequestBody } from '../../common/request-fields.js';

// Quy tắc thuần của giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275; tài liệu 32 mục 20.7). Claude tự chọn theo ủy quyền
// của Eric ngày 2026-10-11, ghi ở YCTD-275:
// - Giờ mở thảo luận (GD-144, Eric chưa chốt): mặc định không giới hạn, trường tự đặt ở cấu hình `discussion_open_hours`
//   (khung giờ ngày học và cuối tuần); ngoài giờ học sinh chỉ đọc, giáo viên vẫn viết.
// - Câu hỏi chưa có giáo viên trả lời quá 48 giờ là quá hạn trong hàng chờ của giáo viên.
// - Báo cáo vi phạm có hạn xử lý 2 ngày; tạm khóa quyền viết từ 1 đến 30 ngày.
// - Phụ huynh xem không gian nhóm của con (GD-145, Eric chốt 2026-10-26): Tiểu học đọc toàn bộ; THCS, THPT chỉ thấy việc, hạn,
//   tệp, không đọc thảo luận.
export const DISCUSSION_RULE_CODE = 'YCTD-275';
export const MAX_TITLE = 200;
export const MAX_BODY = 5000;
export const MAX_NOTE = 20_000;
export const QUESTION_OVERDUE_HOURS = 48;
export const REPORT_DUE_DAYS = 2;
export const MAX_BAN_DAYS = 30;
export const GROUP_FILE_BYTES = 10 * 1024 * 1024;

export function discussionRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(DISCUSSION_RULE_CODE, message, fields);
}

export function readText(body: RequestBody, field: string, maximum: number, errors: FieldError[]): string {
  const value = typeof body?.[field] === 'string' ? (body[field] as string).trim() : '';
  if (value === '' || value.length > maximum) {
    errors.push({ field, message: `Từ 1 đến ${maximum} ký tự` });
  }
  return value.slice(0, maximum);
}

export function throwIfErrors(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

// ---------- Giờ mở

export interface OpenWindow {
  from: string;
  to: string;
}

export interface OpenHours {
  school_days: OpenWindow | null;
  weekend: OpenWindow | null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Đọc cấu hình giờ mở; sai dạng hoặc chưa đặt thì không giới hạn (GD-144 chưa chốt: trường tự cấu hình)
export function openHoursOf(value: unknown): OpenHours | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const window = (entry: unknown): OpenWindow | null => {
    if (entry === null || typeof entry !== 'object') return null;
    const item = entry as Record<string, unknown>;
    return typeof item.from === 'string' && typeof item.to === 'string' && TIME.test(item.from) && TIME.test(item.to)
      ? { from: item.from, to: item.to }
      : null;
  };
  const hours = { school_days: window(raw.school_days), weekend: window(raw.weekend) };
  return hours.school_days || hours.weekend ? hours : null;
}

// Đang trong giờ mở theo giờ Việt Nam: thứ Hai đến thứ Sáu dùng khung ngày học, thứ Bảy và Chủ nhật dùng khung cuối tuần; khung
// không đặt thì cả ngày mở
export function isOpenNow(hours: OpenHours | null, now: Date): boolean {
  if (!hours) return true;
  const local = new Date(now.getTime() + 7 * 3_600_000);
  const day = local.getUTCDay();
  const window = day === 0 || day === 6 ? hours.weekend : hours.school_days;
  if (!window) return true;
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMinutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  return minutes >= toMinutes(window.from) && minutes < toMinutes(window.to);
}

// ---------- Xem chủ đề

export interface ThreadVisibility {
  hidden_at: Date | null;
  private: boolean;
  author_child_id: string | null;
}

// Học sinh thấy chủ đề chưa ẩn; câu hỏi riêng chỉ người hỏi thấy (giáo viên luôn thấy mọi chủ đề, kể cả đã ẩn)
export function studentCanSee(thread: ThreadVisibility, childId: string): boolean {
  if (thread.hidden_at !== null) return false;
  return !thread.private || thread.author_child_id === childId;
}

// Câu hỏi đang chờ: chưa có câu trả lời được xác nhận và chưa có giáo viên trả lời; quá hạn sau 48 giờ
export function questionPending(
  thread: { created_at: Date; accepted_post_id: string | null },
  teacherReplied: boolean,
  now: Date,
): { pending: boolean; overdue: boolean } {
  const pending = thread.accepted_post_id === null && !teacherReplied;
  return {
    pending,
    overdue: pending && now.getTime() - thread.created_at.getTime() > QUESTION_OVERDUE_HOURS * 3_600_000,
  };
}

// Phụ huynh xem gì ở không gian nhóm của con (GD-145)
export function guardianGroupView(level: string): { discussions: boolean; notes: boolean } {
  return level === 'TH' ? { discussions: true, notes: true } : { discussions: false, notes: false };
}

// ---------- Lịch học tập

export interface CalendarItem {
  date: string;
  kind: 'lesson' | 'due' | 'opens';
  title: string;
  detail: string | null;
  time: string | null;
}

const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

const vietnamDay = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const vietnamTime = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);

// Lịch 7 ngày từ ngày bắt đầu: tiết của thời khoá biểu theo thứ (1 là thứ Hai), hạn và ngày mở của hoạt động đã giao; không xuất
// iCal (GD-157)
export function weekCalendar(input: {
  from: string;
  lessons: Array<{ weekday: number; period_no: number; subject_name: string; start_time: string | null }>;
  activities: Array<{ title: string; space: string; due_at: Date | null; opens_at: Date | null }>;
}): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(input.from, offset);
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekday = day === 0 ? 7 : day;
    for (const lesson of input.lessons
      .filter((row) => row.weekday === weekday)
      .sort((a, b) => a.period_no - b.period_no)) {
      items.push({
        date,
        kind: 'lesson',
        title: lesson.subject_name,
        detail: `Tiết ${lesson.period_no}`,
        time: lesson.start_time ? lesson.start_time.slice(0, 5) : null,
      });
    }
  }
  const last = addDays(input.from, 6);
  for (const activity of input.activities) {
    for (const [kind, at] of [
      ['opens', activity.opens_at],
      ['due', activity.due_at],
    ] as const) {
      if (!at) continue;
      const date = vietnamDay(at);
      if (date < input.from || date > last) continue;
      items.push({ date, kind, title: activity.title, detail: activity.space, time: vietnamTime(at) });
    }
  }
  return items.sort((left, right) =>
    left.date === right.date ? (left.time ?? '').localeCompare(right.time ?? '') : left.date.localeCompare(right.date),
  );
}

// Thứ Hai của tuần chứa ngày (theo giờ Việt Nam), hoặc ngày đã cho nếu đúng dạng
export function calendarStart(value: unknown, now: Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const today = vietnamDay(now);
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, -((day + 6) % 7));
}

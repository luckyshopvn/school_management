import { ruleViolationError, type FieldError } from '@school-management/server';
import type { HomeworkPolicyAction, HomeworkReminderKind } from '@school-management/database';
import type { RequestBody } from '../../common/request-fields.js';

// Quy tắc thuần của bài về nhà (DT-28 phần 28f, YCTD-276; tài liệu 47 mục 20.7). Bài về nhà là bài tập 28c ngữ cảnh `homework`.
// - Quy tắc khối lượng (GD-143, Eric chốt 2026-10-26): trường tự đặt theo cấp, khối; nền tảng không đặt giới hạn mặc định, trường
//   chưa đặt thì không chặn, không cảnh báo. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-276: khối lượng
//   tính theo **ngày đến hạn** (giờ Việt Nam) của bài; bài chưa ghi số phút dự kiến tính 0 phút; quy tắc của khối thay quy tắc
//   chung của cấp (khối 0).
// - Hạn mặc định khi giao từ sổ đầu bài: đầu tiết kế tiếp của môn với lớp (cùng nhóm của tiết) theo thời khoá biểu trong 14 ngày
//   tới, bỏ ngày nghỉ lễ; không tìm thấy thì 7 giờ sáng sau 7 ngày.
// - Nhắc: giờ yên lặng 21:00 đến 6:00 không gửi; "sắp đến hạn" gửi từ giờ nhắc (mặc định 19:00) của hôm trước ngày đến hạn; mỗi
//   loại nhắc chỉ trong 3 ngày kể từ sự việc; nhiều bài của một em gộp một thông báo mỗi lượt.
export const HOMEWORK_RULE_CODE = 'YCTD-276';
export const QUIET_START = 21 * 60;
export const QUIET_END = 6 * 60;
export const DEFAULT_REMINDER_TIME = '19:00';
export const NEXT_LESSON_DAYS = 14;
export const FALLBACK_DUE_DAYS = 7;
const REMINDER_WINDOW_MS = 72 * 3_600_000;
const VIETNAM_OFFSET_MS = 7 * 3_600_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function homeworkRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(HOMEWORK_RULE_CODE, message, fields);
}

// ---------- Ngày giờ Việt Nam

export function vietnamDate(value: Date): string {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

export function vietnamMinutes(value: Date): number {
  const local = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isoWeekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function vietnamTime(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`);
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

// Khối của lớp là số trong mã khối (`K7` là 7); không đọc được là 0
export function gradeNumber(gradeLevel: string | null | undefined): number {
  const digits = (gradeLevel ?? '').replace(/\D/g, '');
  const value = Number.parseInt(digits, 10);
  return Number.isInteger(value) && value >= 0 && value <= 12 ? value : 0;
}

// ---------- Quy tắc khối lượng của trường

export interface PolicyInput {
  school_level: 'TH' | 'THCS' | 'THPT';
  grade: number;
  no_homework: boolean;
  max_items_per_day: number | null;
  max_minutes_per_day: number | null;
  blocked_weekdays: number[];
  skip_holidays: boolean;
  action: HomeworkPolicyAction;
  basis: string | null;
}

function optionalInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  label: string,
  errors: FieldError[],
): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, message: `${label} là số nguyên từ ${min} đến ${max}` });
    return null;
  }
  return value;
}

export function parsePolicyInput(body: RequestBody): PolicyInput {
  const errors: FieldError[] = [];
  const level = body?.school_level;
  if (level !== 'TH' && level !== 'THCS' && level !== 'THPT') {
    errors.push({ field: 'school_level', message: 'Cấp là TH, THCS hoặc THPT' });
  }
  const grade = optionalInteger(body?.grade ?? 0, 'grade', 0, 12, 'Khối', errors) ?? 0;
  const maxItems = optionalInteger(body?.max_items_per_day, 'max_items_per_day', 1, 20, 'Số bài mỗi ngày', errors);
  const maxMinutes = optionalInteger(
    body?.max_minutes_per_day,
    'max_minutes_per_day',
    5,
    600,
    'Số phút mỗi ngày',
    errors,
  );
  const weekdays = Array.isArray(body?.blocked_weekdays) ? body.blocked_weekdays : [];
  if (weekdays.some((day) => typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7)) {
    errors.push({ field: 'blocked_weekdays', message: 'Thứ trong tuần là số từ 1 (thứ Hai) đến 7 (Chủ nhật)' });
  }
  const action = body?.action ?? 'warn';
  if (action !== 'warn' && action !== 'block') {
    errors.push({ field: 'action', message: 'Cách xử lý là warn (cảnh báo) hoặc block (chặn)' });
  }
  const basis = typeof body?.basis === 'string' ? body.basis.trim() : '';
  if (basis.length > 1000) {
    errors.push({ field: 'basis', message: 'Căn cứ tối đa 1.000 ký tự' });
  }
  if (errors.length > 0) {
    throw homeworkRule('Quy tắc bài về nhà chưa hợp lệ', errors);
  }
  return {
    school_level: level as PolicyInput['school_level'],
    grade,
    no_homework: body?.no_homework === true,
    max_items_per_day: maxItems,
    max_minutes_per_day: maxMinutes,
    blocked_weekdays: [...new Set(weekdays as number[])].sort(),
    skip_holidays: body?.skip_holidays === true,
    action: action as HomeworkPolicyAction,
    basis: basis === '' ? null : basis,
  };
}

export interface PolicyRow {
  school_level: string;
  grade: number;
  no_homework: boolean;
  max_items_per_day: number | null;
  max_minutes_per_day: number | null;
  blocked_weekdays: unknown;
  skip_holidays: boolean;
  action: HomeworkPolicyAction;
  basis: string | null;
}

// Quy tắc áp cho một lớp: của khối nếu có, không thì của cấp (khối 0); không có là trường chưa đặt
export function policyFor<T extends PolicyRow>(policies: T[], level: string, grade: number): T | null {
  return (
    policies.find((policy) => policy.school_level === level && policy.grade === grade && grade > 0) ??
    policies.find((policy) => policy.school_level === level && policy.grade === 0) ??
    null
  );
}

export interface WorkloadCheck {
  policy: PolicyRow | null;
  dueDate: string | null;
  holiday: boolean;
  // Bài về nhà khác của lớp có cùng ngày đến hạn (đã phát hành)
  existing: { count: number; minutes: number };
  minutes: number | null;
}

export interface WorkloadResult {
  violations: string[];
  action: HomeworkPolicyAction | null;
}

const WEEKDAY_LABELS = ['', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];

// Bài sắp phát hành có vi phạm quy tắc của trường không; trường chưa đặt quy tắc thì không có vi phạm
export function checkWorkload(input: WorkloadCheck): WorkloadResult {
  const policy = input.policy;
  if (!policy) {
    return { violations: [], action: null };
  }
  const violations: string[] = [];
  if (policy.no_homework) {
    violations.push('Khối của lớp không giao bài về nhà theo quy tắc của trường');
  }
  if (input.dueDate) {
    const weekday = isoWeekdayOf(input.dueDate);
    const blocked = Array.isArray(policy.blocked_weekdays) ? (policy.blocked_weekdays as number[]) : [];
    if (blocked.includes(weekday)) {
      violations.push(`Trường không để hạn bài về nhà vào ${WEEKDAY_LABELS[weekday]}`);
    }
    if (policy.skip_holidays && input.holiday) {
      violations.push('Ngày đến hạn là ngày nghỉ lễ của trường');
    }
    const count = input.existing.count + 1;
    if (policy.max_items_per_day !== null && count > policy.max_items_per_day) {
      violations.push(
        `Ngày ${input.dueDate} lớp đã có ${input.existing.count} bài, quá ${policy.max_items_per_day} bài mỗi ngày`,
      );
    }
    const minutes = input.existing.minutes + (input.minutes ?? 0);
    if (policy.max_minutes_per_day !== null && minutes > policy.max_minutes_per_day) {
      violations.push(
        `Ngày ${input.dueDate} lớp có khoảng ${minutes} phút bài về nhà, quá ${policy.max_minutes_per_day} phút`,
      );
    }
  }
  return { violations, action: violations.length > 0 ? policy.action : null };
}

// ---------- Hạn theo tiết kế tiếp

export interface LessonCandidate {
  date: string;
  period_no: number;
  start_time: string | null;
}

// Đầu tiết kế tiếp (sau ngày của tiết đã giao); không có tiết nào thì 7 giờ sáng sau 7 ngày
export function nextLessonDue(
  lessonDate: string,
  candidates: LessonCandidate[],
): { due_at: Date; basis: 'next_lesson' | 'default' } {
  const next = candidates
    .filter((candidate) => candidate.date > lessonDate)
    .sort((left, right) => left.date.localeCompare(right.date) || left.period_no - right.period_no)[0];
  if (next) {
    return { due_at: vietnamTime(next.date, next.start_time ?? '07:00'), basis: 'next_lesson' };
  }
  return { due_at: vietnamTime(addDays(lessonDate, FALLBACK_DUE_DAYS), '07:00'), basis: 'default' };
}

// ---------- Lịch khối lượng 7 ngày

export interface WorkloadItem {
  activity_id: string;
  title: string;
  subject_name: string | null;
  due_at: Date | null;
  minutes: number | null;
  released: boolean;
}

export function workloadDays(from: string, items: WorkloadItem[]) {
  return Array.from({ length: 7 }, (_value, index) => {
    const date = addDays(from, index);
    const day = items.filter((item) => item.due_at && vietnamDate(item.due_at) === date);
    return {
      date,
      weekday: isoWeekdayOf(date),
      count: day.filter((item) => item.released).length,
      minutes: day.filter((item) => item.released).reduce((total, item) => total + (item.minutes ?? 0), 0),
      items: day.map((item) => ({ ...item, due_at: item.due_at?.toISOString() ?? null })),
    };
  });
}

// ---------- Trạng thái bài về nhà của một em

export type HomeworkStatus = 'excused' | 'returned' | 'submitted' | 'overdue' | 'pending';

export function homeworkStatus(input: {
  excused: boolean;
  latest: 'draft' | 'submitted' | 'returned' | null;
  dueAt: Date | null;
  now: Date;
}): HomeworkStatus {
  if (input.excused) return 'excused';
  if (input.latest === 'returned') return 'returned';
  if (input.latest === 'submitted') return 'submitted';
  if (input.dueAt && input.dueAt < input.now) return 'overdue';
  return 'pending';
}

// ---------- Nhắc bài về nhà

export function reminderTimeOf(value: unknown): string {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : DEFAULT_REMINDER_TIME;
}

export function inQuietHours(now: Date): boolean {
  const minutes = vietnamMinutes(now);
  return minutes >= QUIET_START || minutes < QUIET_END;
}

export interface ReminderCandidate {
  assignment_id: string;
  child_id: string;
  title: string;
  due_at: Date | null;
  released_at: Date | null;
  excused: boolean;
  submitted: boolean;
  returned_at: Date | null;
  sent: HomeworkReminderKind[];
}

export interface PlannedReminder {
  kind: HomeworkReminderKind;
  child_id: string;
  items: Array<{ assignment_id: string; title: string }>;
}

const within = (now: Date, at: Date | null) =>
  at !== null && at <= now && now.getTime() - at.getTime() < REMINDER_WINDOW_MS;

// Các nhắc đến lượt: gộp theo em và loại; giờ yên lặng thì không có nhắc nào (để lượt sau 6:00 gửi)
export function planReminders(now: Date, reminderTime: string, candidates: ReminderCandidate[]): PlannedReminder[] {
  if (inQuietHours(now)) {
    return [];
  }
  const tomorrow = addDays(vietnamDate(now), 1);
  const afterReminderTime = vietnamMinutes(now) >= minutesOf(reminderTime);
  const planned = new Map<string, PlannedReminder>();
  const add = (kind: HomeworkReminderKind, candidate: ReminderCandidate) => {
    if (candidate.sent.includes(kind)) return;
    const key = `${kind}:${candidate.child_id}`;
    const entry = planned.get(key) ?? { kind, child_id: candidate.child_id, items: [] };
    entry.items.push({ assignment_id: candidate.assignment_id, title: candidate.title });
    planned.set(key, entry);
  };
  for (const candidate of candidates) {
    if (candidate.returned_at) {
      if (within(now, candidate.returned_at)) add('returned', candidate);
      continue;
    }
    if (candidate.excused) continue;
    if (within(now, candidate.released_at)) add('assigned', candidate);
    if (candidate.submitted || !candidate.due_at) continue;
    if (afterReminderTime && vietnamDate(candidate.due_at) === tomorrow) add('due_soon', candidate);
    if (within(now, candidate.due_at)) add('missing', candidate);
  }
  return [...planned.values()];
}

export const REMINDER_TEMPLATES: Record<HomeworkReminderKind, string> = {
  assigned: 'homework_assigned',
  due_soon: 'homework_due_soon',
  missing: 'homework_missing',
  returned: 'homework_returned',
};

export function reminderText(reminder: PlannedReminder, childName: string): { title: string; body: string } {
  const titles = reminder.items.map((item) => item.title);
  const list = titles.join('; ').slice(0, 1200);
  const count = titles.length;
  switch (reminder.kind) {
    case 'assigned':
      return { title: `${childName} có ${count} bài về nhà mới`, body: list };
    case 'due_soon':
      return { title: `${childName} có ${count} bài về nhà đến hạn ngày mai`, body: list };
    case 'missing':
      return { title: `${childName} chưa nộp ${count} bài về nhà đã quá hạn`, body: list };
    case 'returned':
      return { title: `Thầy cô đã trả ${count} bài về nhà của ${childName}`, body: list };
  }
}

import type { FieldError } from '@school-management/server';

// Lịch năm học chung toàn trường và cách đánh số tuần (BR-91)

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface CalendarInput {
  first_term: DateRange;
  second_term: DateRange;
  summer_term: DateRange | null;
  school_days_of_week: number[];
}

export interface GeneratedWeek {
  week_no: number;
  start_date: string;
  end_date: string;
}

export const DEFAULT_SCHOOL_DAYS_OF_WEEK = [1, 2, 3, 4, 5];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function parseDate(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function formatDate(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const milliseconds = parseDate(value);
  return !Number.isNaN(milliseconds) && formatDate(milliseconds) === value;
}

function readRange(body: Record<string, unknown>, field: string, errors: FieldError[]): DateRange | undefined {
  const value = body[field];
  if (typeof value !== 'object' || value === null) {
    errors.push({ field, message: 'Bắt buộc nhập ngày bắt đầu và ngày kết thúc' });
    return undefined;
  }
  const range = value as Record<string, unknown>;
  let valid = true;
  for (const key of ['start_date', 'end_date']) {
    if (!isValidDate(range[key])) {
      errors.push({ field: `${field}.${key}`, message: 'Ngày không hợp lệ, dùng dạng YYYY-MM-DD' });
      valid = false;
    }
  }
  if (!valid) {
    return undefined;
  }
  const result = { start_date: range.start_date as string, end_date: range.end_date as string };
  if (result.start_date > result.end_date) {
    errors.push({ field, message: 'Ngày bắt đầu phải trước hoặc trùng ngày kết thúc' });
    return undefined;
  }
  return result;
}

// Kiểm tra lịch: học kỳ 1 kết thúc trước khi học kỳ 2 bắt đầu; kỳ hè nằm sau học kỳ 2 (BR-91)
export function parseCalendar(body: unknown): { calendar?: CalendarInput; errors: FieldError[] } {
  const errors: FieldError[] = [];
  if (typeof body !== 'object' || body === null) {
    return { errors: [{ field: 'body', message: 'Thiếu dữ liệu lịch năm học' }] };
  }
  const input = body as Record<string, unknown>;
  const firstTerm = readRange(input, 'first_term', errors);
  const secondTerm = readRange(input, 'second_term', errors);
  const summerTerm =
    input.summer_term === null || input.summer_term === undefined
      ? null
      : (readRange(input, 'summer_term', errors) ?? null);

  let schoolDays = DEFAULT_SCHOOL_DAYS_OF_WEEK;
  if (input.school_days_of_week !== undefined) {
    const days = input.school_days_of_week;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
      new Set(days).size !== days.length
    ) {
      errors.push({
        field: 'school_days_of_week',
        message: 'Chọn ít nhất một ngày học, mỗi ngày từ 1 (thứ hai) đến 7 (chủ nhật)',
      });
    } else {
      schoolDays = [...(days as number[])].sort((left, right) => left - right);
    }
  }

  if (firstTerm && secondTerm && firstTerm.end_date >= secondTerm.start_date) {
    errors.push({ field: 'second_term.start_date', message: 'Học kỳ 2 phải bắt đầu sau khi học kỳ 1 kết thúc' });
  }
  if (secondTerm && summerTerm && secondTerm.end_date >= summerTerm.start_date) {
    errors.push({ field: 'summer_term.start_date', message: 'Kỳ hè phải bắt đầu sau khi học kỳ 2 kết thúc' });
  }
  if (errors.length > 0 || !firstTerm || !secondTerm) {
    return { errors };
  }
  return {
    calendar: {
      first_term: firstTerm,
      second_term: secondTerm,
      summer_term: summerTerm,
      school_days_of_week: schoolDays,
    },
    errors,
  };
}

export function calendarEndDate(calendar: CalendarInput): string {
  return (calendar.summer_term ?? calendar.second_term).end_date;
}

// Tuần tính từ thứ hai đến chủ nhật, đánh số liên tục từ tuần chứa ngày bắt đầu học kỳ 1 đến hết năm học (BR-91)
export function generateWeeks(calendar: CalendarInput): GeneratedWeek[] {
  const start = parseDate(calendar.first_term.start_date);
  const end = parseDate(calendarEndDate(calendar));
  const mondayOffset = (new Date(start).getUTCDay() + 6) % 7;
  const weeks: GeneratedWeek[] = [];
  for (let monday = start - mondayOffset * DAY_MILLISECONDS; monday <= end; monday += 7 * DAY_MILLISECONDS) {
    weeks.push({
      week_no: weeks.length + 1,
      start_date: formatDate(monday),
      end_date: formatDate(monday + 6 * DAY_MILLISECONDS),
    });
  }
  return weeks;
}

import { validationError, type FieldError } from '@school-management/server';
import type { ProgressPeriod, TeachingPlanPeriod } from '@school-management/database';
import type { RequestBody } from '../common/request-fields.js';

// Đọc dữ liệu vào của phân hệ giảng dạy (P03; YCTD-80)
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAXIMUM_TEACHING_TEXT = 4000;
const MAXIMUM_NAME = 200;

export function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readDate(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  required: boolean,
): string | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return undefined;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

export function optionalQueryDate(value: unknown, field: string): string | null {
  const errors: FieldError[] = [];
  const date = readDate({ [field]: value }, field, errors, false);
  check(errors);
  return date ?? null;
}

export function readTime(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = body?.[field];
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    errors.push({ field, message: 'Giờ dạng HH:MM' });
    return '';
  }
  return value;
}

// Đọc chữ có giới hạn độ dài; trống trả null, bắt buộc thì báo lỗi
export function readText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required?: boolean; maximum?: number } = {},
): string | null {
  const value = body?.[field];
  const maximum = options.maximum ?? MAXIMUM_TEACHING_TEXT;
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (options.required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return null;
  }
  if (value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return null;
  }
  return value.trim();
}

export function readName(body: RequestBody, field: string, errors: FieldError[]): string {
  return readText(body, field, errors, { required: true, maximum: MAXIMUM_NAME }) ?? '';
}

// Kỳ của kế hoạch giảng dạy và phiếu tiến độ: học kỳ HK1, HK2, HE (học hè); tháng YYYY-MM; tuần YYYY-Www
const PERIOD_PATTERNS: Record<TeachingPlanPeriod, RegExp> = {
  term: /^(HK1|HK2|HE)$/,
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  week: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
};

export function readPeriod<Period extends TeachingPlanPeriod>(
  body: RequestBody,
  errors: FieldError[],
  allowed: Period[],
): { period_type: Period; period_value: string } {
  const type = body?.period_type as Period;
  const value = body?.period_value;
  if (!allowed.includes(type)) {
    errors.push({ field: 'period_type', message: `Loại kỳ là ${allowed.join(', ')}` });
    return { period_type: type, period_value: '' };
  }
  if (typeof value !== 'string' || !PERIOD_PATTERNS[type].test(value)) {
    errors.push({
      field: 'period_value',
      message: { term: 'Học kỳ là HK1, HK2 hoặc HE', month: 'Tháng dạng YYYY-MM', week: 'Tuần dạng YYYY-Www' }[type],
    });
    return { period_type: type, period_value: '' };
  }
  return { period_type: type, period_value: value };
}

export const PROGRESS_PERIODS: ProgressPeriod[] = ['term', 'month'];

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Thứ trong tuần theo ISO: 1 là thứ Hai, 7 là Chủ nhật
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function overlaps(
  first: { start_time: string; end_time: string },
  second: { start_time: string; end_time: string },
) {
  return first.start_time < second.end_time && second.start_time < first.end_time;
}

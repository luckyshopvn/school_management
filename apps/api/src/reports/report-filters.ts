import { validationError, type FieldError } from '@school-management/server';
import { isUuid } from '../common/request-fields.js';

// Đọc bộ lọc báo cáo từ chuỗi truy vấn hoặc thân yêu cầu xuất dữ liệu (P17; YCTD-62, YCTD-83)
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export type QueryValues = Record<string, string | undefined>;

export function optionalUuid(query: QueryValues, field: string, errors: FieldError[]): string | null {
  const value = query[field];
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

export function month(query: QueryValues, errors: FieldError[]): string {
  const value = query.month;
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) {
    errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
    return '';
  }
  return value;
}

export function dateRange(query: QueryValues, errors: FieldError[]): { from: string; to: string } {
  const from = query.from ?? '';
  const to = query.to ?? '';
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    errors.push({ field: 'from', message: 'Khoảng ngày from, to theo dạng YYYY-MM-DD, from không sau to' });
  }
  return { from, to };
}

export function minimumOverdueDays(query: QueryValues, errors: FieldError[]): number | null {
  const days = query.minimum_overdue_days;
  const value = days === undefined || days === '' ? null : Number(days);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 3650)) {
    errors.push({ field: 'minimum_overdue_days', message: 'Số ngày quá hạn từ 1 đến 3650' });
  }
  return value;
}

export function flowType(query: QueryValues, errors: FieldError[]): 'income' | 'expense' | null {
  const value = query.flow_type;
  if (value !== undefined && value !== '' && value !== 'income' && value !== 'expense') {
    errors.push({ field: 'flow_type', message: 'Loại thu chi là income hoặc expense' });
  }
  return value === 'income' || value === 'expense' ? value : null;
}

// Danh sách mã đơn vị cách nhau bằng dấu phẩy; trống là mọi đơn vị trong phạm vi
export function uuidList(query: QueryValues, field: string, errors: FieldError[]): string[] {
  const value = query[field];
  if (value === undefined || value.trim() === '') {
    return [];
  }
  const ids = [...new Set(value.split(',').map((id) => id.trim()))].filter((id) => id !== '');
  if (ids.some((id) => !isUuid(id))) {
    errors.push({ field, message: 'Danh sách mã đơn vị không hợp lệ' });
    return [];
  }
  return ids;
}

export function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

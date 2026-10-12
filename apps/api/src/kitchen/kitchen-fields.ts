import { validationError, type FieldError } from '@school-management/server';
import type { MealType } from '@school-management/database';
import { isUuid, type RequestBody } from '../common/request-fields.js';

// Đọc dữ liệu vào của phân hệ bếp (YCTD-76)
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', snack: 'Bữa xế' };
const MAXIMUM_TEXT = 1000;

export function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

// Ngày trên chuỗi truy vấn; sai dạng trả ERR_VALIDATION ngay
export function queryDate(value: unknown, field: string, required = false): string | null {
  const errors: FieldError[] = [];
  const date = readDate({ [field]: value }, field, errors, required);
  check(errors);
  return date;
}

export function queryUuid(value: unknown, field: string, required = false): string | null {
  if (value === undefined || value === '') {
    if (required) {
      throw validationError([{ field, message: 'Bắt buộc chọn' }]);
    }
    return null;
  }
  if (!isUuid(value)) {
    throw validationError([{ field, message: 'Mã không hợp lệ' }]);
  }
  return value;
}

export function readText(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return null;
  }
  if (value.trim().length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    return null;
  }
  return value.trim();
}

// Số dương có phần lẻ (số lượng, định lượng); trả null khi sai hoặc thiếu
export function readQuantity(value: unknown, field: string, errors: FieldError[]): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0 || number > 1_000_000) {
    errors.push({ field, message: 'Số lớn hơn 0' });
    return null;
  }
  return Math.round(number * 1000) / 1000;
}

// Số tiền nguyên đồng không âm
export function readMoney(value: unknown, field: string, errors: FieldError[]): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000_000_000) {
    errors.push({ field, message: 'Số tiền là số nguyên đồng không âm' });
    return null;
  }
  return value;
}

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Thứ hai của tuần chứa ngày
export function weekStartOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

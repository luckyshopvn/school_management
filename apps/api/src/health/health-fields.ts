import type { FieldError } from '@school-management/server';
import type { RequestBody } from '../common/request-fields.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAXIMUM_HEALTH_TEXT = 1000;

// Đọc ngày dạng YYYY-MM-DD; trống trả undefined khi không bắt buộc
export function readHealthDate(
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

// Đọc số thập phân trong khoảng cho phép; trống trả null
export function readDecimal(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  range: { minimum: number; maximum: number },
): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < range.minimum || number > range.maximum) {
    errors.push({ field, message: `Số từ ${range.minimum} đến ${range.maximum}` });
    return null;
  }
  return number;
}

// Đọc chữ có giới hạn độ dài; trống trả null
export function readNote(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
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
  if (value.trim().length > MAXIMUM_HEALTH_TEXT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_HEALTH_TEXT} ký tự` });
    return null;
  }
  return value.trim();
}

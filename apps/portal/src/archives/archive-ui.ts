import { ApiError } from '../session/api-client.js';

// Phần dùng chung của các màn hình văn thư lưu trữ (DT-15 phần 15h2, YCTD-117)
export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

// Lỗi theo ô của biểu mẫu do máy chủ trả
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

export const selectClass =
  'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
export const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
export const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Ô số nhận dấu phẩy thập phân; chữ không đọc được gửi nguyên để máy chủ báo lỗi ở đúng ô
export function numberOrText(text: string): number | string | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : text;
}

import { platformCacheKey } from './resource-names.js';

// Tình trạng dịch vụ cho cổng vận hành (YCTD-376, ĐX-CN-1, phương án A Eric duyệt ngày 2026-10-29): tiến trình nền ghi tín hiệu còn
// sống, máy chủ API tự kiểm cơ sở dữ liệu và lưu trữ tệp rồi ghi kết quả vào Redis; dịch vụ định danh đọc các khóa này khi người vận
// hành bấm Kiểm lại. Khóa cấp nền tảng qua platformCacheKey (`platform:worker:heartbeat`, `platform:service-status:api`). Chỉ ghi
// ok hoặc lỗi và thời gian, không ghi nội dung lỗi gốc
export const WORKER_HEARTBEAT_KEY = platformCacheKey('worker', 'heartbeat');
export const API_STATUS_KEY = platformCacheKey('service-status', 'api');

// Tiến trình nền ghi mỗi 30 giây; quá 90 giây không có tín hiệu thì coi là đã dừng. Giữ giá trị một ngày để báo giờ tín hiệu cuối
export const WORKER_HEARTBEAT_SECONDS = 30;
export const WORKER_STALE_SECONDS = 90;
export const WORKER_HEARTBEAT_TTL_SECONDS = 24 * 60 * 60;

// Máy chủ API tự kiểm mỗi 60 giây; kết quả hết hạn sau 180 giây (không còn kết quả là máy chủ API không tự kiểm được)
export const API_STATUS_SECONDS = 60;
export const API_STATUS_TTL_SECONDS = 180;

// Ngưỡng "Chậm" cho mọi mục (Q2 của Eric)
export const SLOW_MILLISECONDS = 1000;

export interface CheckResult {
  ok: boolean;
  milliseconds: number;
}

export interface ApiStatusRecord {
  checked_at: string;
  database: CheckResult;
  // null: bản triển khai không dùng lưu trữ tệp dùng chung
  storage: CheckResult | null;
}

// Đo một lần kiểm: lỗi thì ok = false, không giữ nội dung lỗi
export async function timedCheck(task: () => Promise<unknown>, now: () => number = Date.now): Promise<CheckResult> {
  const started = now();
  try {
    await task();
    return { ok: true, milliseconds: now() - started };
  } catch {
    return { ok: false, milliseconds: now() - started };
  }
}

export type CheckState = 'ok' | 'slow' | 'error';

export function checkState(result: CheckResult): CheckState {
  if (!result.ok) {
    return 'error';
  }
  return result.milliseconds > SLOW_MILLISECONDS ? 'slow' : 'ok';
}

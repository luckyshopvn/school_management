import { cacheKey, cacheKeyWithPrefix } from './resource-names.js';
import type { SolverInput, SolverIssue, SolverResult } from './timetable-solver.js';

// Giao thức hàng đợi máy xếp thời khoá biểu giữa máy chủ API và tiến trình chạy nền (DT-20 phần 22c2, YCTD-164). Tiến trình
// chạy nền chỉ tính toán, không đọc cơ sở dữ liệu: máy chủ API ghi đề bài vào Redis và đẩy mã lần xếp vào hàng đợi; tiến
// trình chạy nền lấy việc, ghi tiến độ và kết quả vào Redis; máy chủ API đọc tiến độ, lưu kết quả vào cơ sở dữ liệu năm học.
// Hàng đợi dùng chung của mọi trường (không tiền tố): mỗi phần tử mang tiền tố khóa của trường (DT-SaaS phần S1b) để tiến trình
// chạy nền, vốn không có ngữ cảnh trường, tính đúng khóa đề bài, tiến độ, kết quả của trường đó
export const GENERATION_QUEUE_KEY = cacheKeyWithPrefix('', 'timetable-generation', 'queue');
// Đề bài, tiến độ, kết quả giữ một ngày rồi Redis tự xoá
export const GENERATION_TTL_SECONDS = 24 * 60 * 60;
// Giới hạn thời gian của một lần xếp (giây)
export const MINIMUM_TIME_LIMIT_SECONDS = 5;
export const MAXIMUM_TIME_LIMIT_SECONDS = 600;
export const MAXIMUM_VARIANT_COUNT = 5;

// Khóa của một lần xếp: máy chủ API không truyền tiền tố (lấy từ ngữ cảnh trường qua cacheKey); tiến trình chạy nền truyền tiền tố đọc từ
// phần tử hàng đợi
function generationKey(runId: string, part: string, keyPrefix?: string): string {
  return keyPrefix === undefined
    ? cacheKey('timetable-generation', 'runs', runId, part)
    : cacheKeyWithPrefix(keyPrefix, 'timetable-generation', 'runs', runId, part);
}

export const generationJobKey = (runId: string, keyPrefix?: string) => generationKey(runId, 'job', keyPrefix);
export const generationStateKey = (runId: string, keyPrefix?: string) => generationKey(runId, 'state', keyPrefix);
export const generationResultKey = (runId: string, keyPrefix?: string) => generationKey(runId, 'result', keyPrefix);
export const generationCancelKey = (runId: string, keyPrefix?: string) => generationKey(runId, 'cancel', keyPrefix);

// Phần tử hàng đợi: `<tiền tố>|<mã lần xếp>`; trường không có tiền tố (trường số 1, chế độ một trường) chỉ ghi mã lần xếp nên phần tử
// cũ vẫn đọc được
export function encodeGenerationQueueItem(runId: string, keyPrefix: string): string {
  return keyPrefix ? `${keyPrefix}|${runId}` : runId;
}

export function decodeGenerationQueueItem(item: string): { runId: string; keyPrefix: string } {
  const separator = item.indexOf('|');
  return separator < 0
    ? { runId: item, keyPrefix: '' }
    : { runId: item.slice(separator + 1), keyPrefix: item.slice(0, separator) };
}

export interface GenerationJob {
  run_id: string;
  input: SolverInput;
  time_limit_seconds: number;
  variant_count: number;
  seed: number;
}

export interface GenerationState {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  percent: number;
  variant: number;
  variant_count: number;
  best_score: number | null;
  best_hard: number | null;
  message: string | null;
  issues?: SolverIssue[];
  updated_at: string;
}

// Kết quả do tiến trình chạy nền ghi; máy chủ API chuyển thành phương án ở cơ sở dữ liệu
export type GenerationResult = SolverResult;

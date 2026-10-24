import { cacheKey } from './resource-names.js';
import type { SolverInput, SolverIssue, SolverResult } from './timetable-solver.js';

// Giao thức hàng đợi máy xếp thời khoá biểu giữa máy chủ API và tiến trình chạy nền (DT-20 phần 22c2, YCTD-164). Tiến trình
// chạy nền chỉ tính toán, không đọc cơ sở dữ liệu: máy chủ API ghi đề bài vào Redis và đẩy mã lần xếp vào hàng đợi; tiến
// trình chạy nền lấy việc, ghi tiến độ và kết quả vào Redis; máy chủ API đọc tiến độ, lưu kết quả vào cơ sở dữ liệu năm học.
// Tên khóa tạo qua cacheKey để khi chạy nhiều trường chỉ cần thêm tiền tố ở một chỗ
export const GENERATION_QUEUE_KEY = cacheKey('timetable-generation', 'queue');
// Đề bài, tiến độ, kết quả giữ một ngày rồi Redis tự xoá
export const GENERATION_TTL_SECONDS = 24 * 60 * 60;
// Giới hạn thời gian của một lần xếp (giây)
export const MINIMUM_TIME_LIMIT_SECONDS = 5;
export const MAXIMUM_TIME_LIMIT_SECONDS = 600;
export const MAXIMUM_VARIANT_COUNT = 5;

export const generationJobKey = (runId: string) => cacheKey('timetable-generation', 'runs', runId, 'job');
export const generationStateKey = (runId: string) => cacheKey('timetable-generation', 'runs', runId, 'state');
export const generationResultKey = (runId: string) => cacheKey('timetable-generation', 'runs', runId, 'result');
export const generationCancelKey = (runId: string) => cacheKey('timetable-generation', 'runs', runId, 'cancel');

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

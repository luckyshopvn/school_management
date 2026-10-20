// Phân hệ KPI (DT-18 phần 18d, YCTD-139): kiểu cấu hình của bộ quy tắc chấm và nhãn dùng chung. Máy chấm ở máy chủ API đọc
// mọi tham số (loại công việc, điểm chuẩn, hệ số độ khó, mức tiến độ, mức kết quả, trọng số, điểm thưởng, ngưỡng và điều kiện
// xếp loại, hạn duyệt, hạn chấm, số lần chuyển trả) từ cấu hình của phiên bản quy tắc

export type KpiScoringMode = 'progress_quality' | 'level_scale';
export type KpiSchoolLevelCode = 'MN' | 'TH' | 'THCS' | 'THPT';
export type KpiSubjectGroupCode = 'leader' | 'staff';
export type KpiFormCode =
  'task_sheet' | 'self_evaluation' | 'unit_summary' | 'monthly_sheet' | 'annual_sheet' | 'regulation';

export interface KpiCriterionItem {
  code: string;
  title: string;
  max_score: number;
  subject_groups: KpiSubjectGroupCode[];
}

export interface KpiCriterionGroup {
  code: string;
  title: string;
  items: KpiCriterionItem[];
}

export interface KpiRank {
  code: string;
  label: string;
  min_score: number;
  // Mọi việc đúng hạn; tỷ lệ tối thiểu việc vượt yêu cầu; tỷ lệ tối đa việc có tiến độ 0%
  require_all_on_time?: boolean;
  min_exceeding_percent?: number;
  max_zero_progress_percent?: number;
}

export interface KpiResultLevel {
  code: string;
  label: string;
  percent: number;
  on_time?: boolean;
  exceeded?: boolean;
  zero_progress?: boolean;
}

export interface KpiRuleConfig {
  scoring_mode: KpiScoringMode;
  total_max: number;
  general: { max: number; groups: KpiCriterionGroup[] };
  task_part: { max: number };
  axes: Array<{ code: string; name: string }>;
  task_types: Array<{ code: string; name: string; standard_score: number }>;
  difficulty_levels: Array<{ code: string; label: string; weight: number }>;
  // Chấm theo tiến độ và kết quả
  weights: { progress: number; quality: number };
  progress_levels: Array<{ max_late_days: number | null; percent: number; label: string }>;
  quality_levels: Array<{ code: string; label: string; percent: number }>;
  // Chấm theo thang mức
  result_levels: KpiResultLevel[];
  bonus: { rate_percent: number; max_total: number };
  ranks: KpiRank[];
  exclusions: Array<{ code: string; label: string }>;
  // Tỷ lệ tối đa xuất sắc: base "good_or_better" tính trên số người từ hoàn thành tốt trở lên, "all" trên mọi người
  excellent_quota: { percent: number; base: 'good_or_better' | 'all'; exclude_heads: boolean; by_group: boolean };
  deadlines: { approval_days: number; grading_days: number; max_returns: number };
  subject_groups: Array<{ code: KpiSubjectGroupCode; label: string }>;
  job_positions: Array<{ code: string; label: string; levels: KpiSchoolLevelCode[]; is_manager: boolean }>;
  indicator_targets: Partial<Record<KpiSchoolLevelCode, number>>;
  forms: KpiFormCode[];
}

export const KPI_RULE_CODE = 'YCTD-139';

export const KPI_SCHOOL_LEVELS: Array<{ value: KpiSchoolLevelCode; label: string }> = [
  { value: 'MN', label: 'Mầm non' },
  { value: 'TH', label: 'Tiểu học' },
  { value: 'THCS', label: 'Trung học cơ sở' },
  { value: 'THPT', label: 'Trung học phổ thông' },
];

export const KPI_SCORING_MODE_LABELS: Record<KpiScoringMode, string> = {
  progress_quality: 'Theo tiến độ và kết quả từng việc',
  level_scale: 'Theo thang mức của chỉ báo công việc',
};

export const KPI_PERIOD_TYPE_LABELS: Record<string, string> = {
  month: 'Tháng',
  quarter: 'Quý',
  term: 'Học kỳ',
  year: 'Năm',
  custom: 'Khác',
};

export const KPI_TASK_STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Chờ duyệt đăng ký',
  assigned: 'Chờ xác nhận',
  returned_to_assigner: 'Đã chuyển trả người giao',
  in_progress: 'Đang thực hiện',
  self_assessed: 'Chờ chấm',
  rework: 'Trả lại làm lại',
  graded: 'Đã chấm',
  rejected: 'Không duyệt',
  cancelled: 'Đã hủy',
};

export const KPI_TASK_ORIGIN_LABELS: Record<string, string> = {
  assigned: 'Được giao',
  registered: 'Tự đăng ký',
  arising: 'Phát sinh',
  legacy: 'Chuyển từ hệ thống cũ',
};

export const KPI_EVALUATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Chưa nộp',
  submitted: 'Đã nộp, chờ cấp trên',
  returned: 'Trả lại tự đánh giá lại',
  concluded: 'Cấp trên đã kết luận',
};

export const KPI_FORM_LABELS: Record<KpiFormCode, string> = {
  task_sheet: 'Bảng tính điểm KPI',
  self_evaluation: 'Bản tự đánh giá, xếp loại của cá nhân',
  unit_summary: 'Bảng tổng hợp kết quả đánh giá, xếp loại',
  monthly_sheet: 'Phiếu theo dõi, đánh giá tháng',
  annual_sheet: 'Phiếu xếp loại chất lượng năm',
  regulation: 'Quy chế đánh giá, xếp loại của đơn vị',
};

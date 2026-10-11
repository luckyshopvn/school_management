import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối y tế học đường (P10; YCTD-74)
export type IndicatorStatus = 'below' | 'normal' | 'above';
export type Evaluation = Partial<Record<'height_cm' | 'weight_kg' | 'bmi', IndicatorStatus>>;

export interface Campaign {
  id: string;
  org_unit_id: string;
  name: string;
  from_date: string;
  to_date: string;
  status: 'open' | 'closed';
}

export interface Schedule {
  id: string;
  class_id: string;
  class_name: string;
  check_date: string;
  location: string;
}

export interface ResultRow {
  child_id: string;
  full_name: string;
  class_name: string;
  result_id: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  conclusion: string | null;
  published_at: string | null;
  evaluation: Evaluation;
}

export interface MedicalEvent {
  id: string;
  child_id: string;
  full_name: string;
  occurred_at: string;
  symptoms: string;
  handling: string;
  handler_name: string;
  severity: 'mild' | 'moderate' | 'severe';
  parent_acknowledged_at: string | null;
}

export interface ReportRequest {
  id: string;
  child_id: string;
  full_name: string;
  report_type: 'growth' | 'medical' | 'full';
  period_from: string;
  period_to: string;
  note: string | null;
  status: 'pending' | 'sent';
  requested_at: string;
  sent_at: string | null;
}

export interface Standard {
  id: string;
  indicator_code: 'height_cm' | 'weight_kg' | 'bmi';
  gender: 'male' | 'female';
  age_month_from: number;
  age_month_to: number;
  lower_value: string;
  upper_value: string;
  source_document: string;
}

export const INDICATOR_LABELS = { height_cm: 'Chiều cao (cm)', weight_kg: 'Cân nặng (kg)', bmi: 'Chỉ số khối cơ thể' };
export const STATUS_LABELS: Record<IndicatorStatus, string> = {
  below: 'Dưới ngưỡng',
  normal: 'Bình thường',
  above: 'Trên ngưỡng',
};
export const SEVERITY_LABELS = { mild: 'Nhẹ', moderate: 'Vừa', severe: 'Nặng' };
export const REPORT_TYPE_LABELS = { growth: 'Tăng trưởng', medical: 'Y tế', full: 'Đầy đủ' };

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function describeEvaluation(evaluation: Evaluation): string {
  const flagged = Object.entries(evaluation).filter(([, status]) => status !== 'normal');
  return flagged.length === 0
    ? ''
    : flagged
        .map(
          ([indicator, status]) =>
            `${INDICATOR_LABELS[indicator as keyof typeof INDICATOR_LABELS]}: ${STATUS_LABELS[status as IndicatorStatus]}`,
        )
        .join('; ');
}

export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

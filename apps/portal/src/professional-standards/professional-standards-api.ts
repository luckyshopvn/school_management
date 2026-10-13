import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối đánh giá chuẩn nghề nghiệp (YCTD-102)
export type StandardType = 'teacher' | 'principal';
export type Level = 'not_met' | 'met' | 'good' | 'excellent';
export type EvaluationStatus = 'self_assessing' | 'self_submitted' | 'finalized';

export const STANDARD_TYPE_LABELS: Record<StandardType, string> = {
  teacher: 'Chuẩn giáo viên mầm non',
  principal: 'Chuẩn hiệu trưởng',
};
export const LEVEL_LABELS: Record<Level, string> = {
  not_met: 'Chưa đạt',
  met: 'Đạt',
  good: 'Khá',
  excellent: 'Tốt',
};
export const STATUS_LABELS: Record<EvaluationStatus, string> = {
  self_assessing: 'Chờ tự đánh giá',
  self_submitted: 'Chờ đánh giá',
  finalized: 'Đã chốt',
};

export interface Criterion {
  id: string;
  standard_id: string;
  code: string;
  name: string;
  is_key: boolean;
  status: 'active' | 'inactive';
}

export interface Standard {
  id: string;
  standard_type: StandardType;
  code: string;
  name: string;
  criteria: Criterion[];
}

export interface EvaluationSummary {
  id: string;
  staff_id: string;
  full_name: string;
  org_unit_name: string;
  standard_type: StandardType;
  status: EvaluationStatus;
  overall_level: Level | null;
  can_assess: boolean;
}

export interface EvaluationItem {
  criterion_id: string;
  standard_code: string;
  standard_name: string;
  criterion_code: string;
  criterion_name: string;
  is_key: boolean;
  self_rating: Level | null;
  self_evidence: string | null;
  assessor_rating: Level | null;
  assessor_note: string | null;
}

export interface EvaluationDetail extends EvaluationSummary {
  assessor_comment: string | null;
  finalized_by_name: string | null;
  is_self: boolean;
  items: EvaluationItem[];
}

export interface StandardStatistics {
  standard_type: StandardType;
  total: number;
  finalized: number;
  pending: number;
  levels: Record<Level, number>;
  level_rates: Record<Level, number>;
}

export const listStandards = (): Promise<Standard[]> => requestJson('/api/v1/professional-standards');
export const updateCriterion = (criterionId: string, patch: { is_key?: boolean; status?: 'active' | 'inactive' }) =>
  requestJson<Criterion>(`/api/v1/professional-criteria/${criterionId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
export const createCriterion = (input: { standard_id: string; name: string; is_key: boolean }) =>
  requestJson<Criterion>('/api/v1/professional-criteria', { method: 'POST', body: JSON.stringify(input) });
export const readMyEvaluation = (): Promise<{ evaluation: EvaluationDetail | null }> =>
  requestJson('/api/v1/me/professional-evaluation');
export const listEvaluations = (orgUnitId: string): Promise<EvaluationSummary[]> =>
  requestJson(`/api/v1/professional-evaluations?org_unit_id=${orgUnitId}`);
export const readEvaluation = (evaluationId: string): Promise<EvaluationDetail> =>
  requestJson(`/api/v1/professional-evaluations/${evaluationId}`);
export const readStatistics = (orgUnitId: string): Promise<StandardStatistics[]> =>
  requestJson(`/api/v1/professional-evaluations/statistics?org_unit_id=${orgUnitId}`);
export const openEvaluations = (standardType: StandardType, staffIds: string[]) =>
  requestJson<{ created_count: number; skipped_staff_ids: string[] }>('/api/v1/professional-evaluations', {
    method: 'POST',
    body: JSON.stringify({ standard_type: standardType, staff_ids: staffIds }),
  });
export const saveSelf = (
  evaluationId: string,
  items: Array<{ criterion_id: string; rating: Level | null; evidence: string | null }>,
) =>
  requestJson<EvaluationDetail>(`/api/v1/professional-evaluations/${evaluationId}/self`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
export const submitSelf = (evaluationId: string) =>
  requestJson<EvaluationDetail>(`/api/v1/professional-evaluations/${evaluationId}/submit-self`, { method: 'POST' });
export const saveAssessment = (
  evaluationId: string,
  items: Array<{ criterion_id: string; rating: Level | null; note: string | null }>,
  comment: string | null,
) =>
  requestJson<EvaluationDetail>(`/api/v1/professional-evaluations/${evaluationId}/assessment`, {
    method: 'PUT',
    body: JSON.stringify({ items, comment }),
  });
export const finalizeEvaluation = (evaluationId: string) =>
  requestJson<EvaluationDetail>(`/api/v1/professional-evaluations/${evaluationId}/finalize`, { method: 'POST' });

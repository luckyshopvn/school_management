import type {
  EvidenceValidityCode,
  KpiSchoolLevelCode,
  QualityAssessmentStatusCode,
  QualityCouncilPositionCode,
  QualityEvidenceStatusCode,
  QualityImprovementAction,
  QualityLevelSummary,
  QualityReportStatusCode,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149)
const API = '/api/v1/quality';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | boolean | undefined | null>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      parameters.set(key, String(value));
    }
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export interface QualityOverview {
  has_staff: boolean;
  can_manage: boolean;
  can_use: boolean;
  staff: Array<{ id: string; full_name: string; department_name: string | null }>;
}

export interface QualityFramework {
  id: string;
  code: string;
  name: string;
  school_level: KpiSchoolLevelCode | null;
  legal_basis: string | null;
  max_level: number;
  sort_order: number;
  status: 'active' | 'inactive';
  standard_count: number;
  criterion_count: number;
  indicator_count: number;
  assessment_count: number;
}

export type FrameworkInput = Pick<
  QualityFramework,
  'code' | 'name' | 'school_level' | 'legal_basis' | 'max_level' | 'sort_order' | 'status'
>;

export interface QualityIndicator {
  id: string;
  criterion_id: string;
  level: number;
  code: string;
  content: string;
  sort_order: number;
}

export interface QualityCriterion {
  id: string;
  standard_id: string;
  code: string;
  title: string;
  evidence_hint: string | null;
  sort_order: number;
  indicators: QualityIndicator[];
}

export interface QualityStandard {
  id: string;
  code: string;
  title: string;
  sort_order: number;
  criteria: QualityCriterion[];
}

export interface QualityFrameworkTree extends Omit<
  QualityFramework,
  'standard_count' | 'criterion_count' | 'indicator_count' | 'assessment_count'
> {
  standards: QualityStandard[];
}

export interface QualityAssessment {
  id: string;
  title: string;
  framework_id: string;
  framework_name: string;
  decision_number: string | null;
  decision_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: QualityAssessmentStatusCode;
  status_label: string;
  self_level: number | null;
  external_level: number | null;
  recognition_date: string | null;
  report_count: number;
  approved_count: number;
  evidence_count: number;
}

export interface AssessmentInput {
  framework_id: string;
  title: string;
  decision_number: string | null;
  decision_date: string | null;
  start_date: string | null;
  end_date: string | null;
  introduction: string | null;
  conclusion: string | null;
}

export interface CriterionRow {
  report_id: string;
  criterion_id: string;
  work_group_id: string | null;
  work_group_name: string | null;
  status: QualityReportStatusCode;
  status_label: string;
  self_level: number | null;
  level_label: string;
  criterion_code: string;
  criterion_title: string;
  standard_code: string;
  standard_title: string;
  evidence_count: number;
}

export interface QualityAssessmentDetail extends AssessmentInput {
  id: string;
  status: QualityAssessmentStatusCode;
  status_label: string;
  self_level: number | null;
  completed_at: string | null;
  completed_by_name: string | null;
  external_level: number | null;
  recognition_decision: string | null;
  recognition_date: string | null;
  recognition_valid_until: string | null;
  work_plan_ids: string[];
  framework: { id: string; name: string; max_level: number };
  council: Array<{
    id: string;
    staff_id: string;
    staff_name: string;
    position: QualityCouncilPositionCode;
    position_label: string;
    duty: string | null;
  }>;
  groups: Array<{
    id: string;
    name: string;
    leader_staff_id: string | null;
    leader_name: string | null;
    members: Array<{ staff_id: string; staff_name: string }>;
    criterion_ids: string[];
  }>;
  criteria: CriterionRow[];
  summary: QualityLevelSummary;
  evidence_status: Record<QualityEvidenceStatusCode, number>;
  can_manage: boolean;
  my_group_ids: string[];
  is_council_member: boolean;
}

export interface QualityReportRow {
  id: string;
  assessment_id: string;
  assessment_title: string;
  criterion_code: string;
  criterion_title: string;
  standard_code: string;
  work_group_name: string | null;
  status: QualityReportStatusCode;
  status_label: string;
  self_level: number | null;
  level_label: string;
  updated_at: string;
}

export interface QualityEvidenceBrief {
  id: string;
  code: string;
  display_code: string;
  validity: EvidenceValidityCode;
  validity_label: string;
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  status: QualityEvidenceStatusCode;
  status_label: string;
  shared: boolean;
}

export interface QualityReportDetail {
  id: string;
  assessment_id: string;
  status: QualityReportStatusCode;
  status_label: string;
  current_state: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_actions: QualityImprovementAction[];
  indicator_results: Record<string, boolean>;
  self_level: number | null;
  suggested_level: number | null;
  return_note: string | null;
  submitted_by_name: string | null;
  reviewed_by_name: string | null;
  updated_by_name: string | null;
  work_group_name: string | null;
  assessment: { id: string; title: string; status: QualityAssessmentStatusCode; framework_id: string };
  criterion: {
    id: string;
    code: string;
    title: string;
    evidence_hint: string | null;
    standard_code: string;
    standard_title: string;
  };
  indicators: QualityIndicator[];
  evidences: QualityEvidenceBrief[];
  can_edit: boolean;
  can_review: boolean;
  can_add_evidence: boolean;
}

export type ReportInput = Pick<
  QualityReportDetail,
  'current_state' | 'strengths' | 'weaknesses' | 'improvement_actions' | 'indicator_results' | 'self_level'
>;

export type RecognitionState = 'valid' | 'expiring' | 'expired' | 'unknown';

export interface QualityRecognition {
  today: string;
  review: {
    accreditation_year: number | null;
    accreditation_date: string | null;
    accreditation_level: string | null;
    national_standard_year: number | null;
    national_standard_date: string | null;
    national_standard_level: string | null;
    valid_until: string | null;
    state: RecognitionState;
  } | null;
  records: Array<{
    id: string;
    title: string;
    framework_name: string;
    self_level_label: string;
    external_level_label: string;
    recognition_decision: string | null;
    recognition_date: string | null;
    valid_until: string | null;
    state: RecognitionState;
  }>;
}

export const readQualityOverview = (): Promise<QualityOverview> => requestJson(`${API}/overview`);

export const listFrameworks = (includeInactive = false) =>
  requestJson<QualityFramework[]>(`${API}/frameworks${query({ include_inactive: includeInactive })}`);
export const readFramework = (id: string) => requestJson<QualityFrameworkTree>(`${API}/frameworks/${id}`);
export const saveFramework = (id: string | null, input: FrameworkInput) =>
  requestJson<QualityFramework>(id ? `${API}/frameworks/${id}` : `${API}/frameworks`, json(id ? 'PUT' : 'POST', input));
export const deleteFramework = (id: string): Promise<void> => requestJson(`${API}/frameworks/${id}`, json('DELETE'));
export const loadDefaultFrameworks = (level: KpiSchoolLevelCode): Promise<{ created: number; skipped: number }> =>
  requestJson(`${API}/frameworks/defaults`, json('POST', { school_level: level }));

// Tiêu chuẩn, tiêu chí, chỉ báo: thêm dưới cha, sửa, xóa theo mã
export type TreeKind = 'standards' | 'criteria' | 'indicators';
const PARENT_PATH: Record<TreeKind, string> = {
  standards: 'frameworks',
  criteria: 'standards',
  indicators: 'criteria',
};
export const saveTreeItem = (kind: TreeKind, id: string | null, parentId: string, input: Record<string, unknown>) =>
  requestJson<{ id: string }>(
    id ? `${API}/${kind}/${id}` : `${API}/${PARENT_PATH[kind]}/${parentId}/${kind}`,
    json(id ? 'PUT' : 'POST', input),
  );
export const deleteTreeItem = (kind: TreeKind, id: string): Promise<void> =>
  requestJson(`${API}/${kind}/${id}`, json('DELETE'));

export const listAssessments = () => requestJson<QualityAssessment[]>(`${API}/assessments`);
export const readAssessment = (id: string) => requestJson<QualityAssessmentDetail>(`${API}/assessments/${id}`);
export const saveAssessment = (id: string | null, input: AssessmentInput) =>
  requestJson<{ id: string }>(id ? `${API}/assessments/${id}` : `${API}/assessments`, json(id ? 'PUT' : 'POST', input));
export const deleteAssessment = (id: string): Promise<void> => requestJson(`${API}/assessments/${id}`, json('DELETE'));
export const saveCouncil = (
  id: string,
  members: Array<{ staff_id: string; position: QualityCouncilPositionCode; duty: string | null }>,
) => requestJson<QualityAssessmentDetail>(`${API}/assessments/${id}/council`, json('PUT', { members }));
export const saveGroups = (
  id: string,
  groups: Array<{ name: string; leader_staff_id: string | null; member_staff_ids: string[]; criterion_ids: string[] }>,
) => requestJson<QualityAssessmentDetail>(`${API}/assessments/${id}/groups`, json('PUT', { groups }));
export const assessmentAction = (id: string, action: 'start' | 'complete' | 'reopen', body?: unknown) =>
  requestJson<QualityAssessmentDetail>(`${API}/assessments/${id}/${action}`, json('POST', body ?? {}));
export const saveRecognition = (
  id: string,
  input: {
    external_level: number | null;
    recognition_decision: string | null;
    recognition_date: string | null;
    recognition_valid_until: string | null;
  },
) => requestJson<QualityAssessmentDetail>(`${API}/assessments/${id}/recognition`, json('PUT', input));
export const applyRecognition = (id: string) =>
  requestJson<{ accreditation_level: string; accreditation_date: string }>(
    `${API}/assessments/${id}/recognition/apply`,
    json('POST'),
  );
export const createImprovementPlan = (id: string) =>
  requestJson<{ work_plan_ids: string[]; plans: number; items: number }>(
    `${API}/assessments/${id}/work-plan`,
    json('POST'),
  );
export const exportSelfReport = (id: string, format: 'docx' | 'pdf') =>
  download(`${API}/assessments/${id}/report?format=${format}`, `bao-cao-tu-danh-gia.${format}`);
export const readRecognition = () => requestJson<QualityRecognition>(`${API}/recognition`);

export const listReports = (filter: { assessment_id?: string; mine?: boolean }) =>
  requestJson<QualityReportRow[]>(`${API}/reports${query(filter)}`);
export const readReport = (id: string) => requestJson<QualityReportDetail>(`${API}/reports/${id}`);
export const updateReport = (id: string, input: ReportInput) =>
  requestJson<QualityReportDetail>(`${API}/reports/${id}`, json('PUT', input));
export const reportAction = (id: string, action: 'submit' | 'approve' | 'return' | 'reopen', note?: string) =>
  requestJson<QualityReportDetail>(`${API}/reports/${id}/${action}`, json('POST', note ? { note } : {}));

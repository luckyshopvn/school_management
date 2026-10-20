import type { KpiRuleConfig } from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi điểm cuối của phân hệ KPI (DT-18 phần 18d, YCTD-139)
export interface RuleVersionSummary {
  id: string;
  rule_set_id: string;
  version_no: number;
  status: 'draft' | 'published';
  note: string | null;
  published_at: string | null;
  published_by_name: string | null;
}

export interface RuleSet {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_default: boolean;
  status: 'active' | 'inactive';
  versions: RuleVersionSummary[];
}

export interface RuleVersion extends RuleVersionSummary {
  config: KpiRuleConfig;
  rule_set_code: string;
  rule_set_name: string;
}

export interface Period {
  id: string;
  code: string;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  register_from: string | null;
  register_to: string | null;
  self_from: string | null;
  self_to: string | null;
  review_from: string | null;
  review_to: string | null;
  advisory_from: string | null;
  advisory_to: string | null;
  status: 'open' | 'locked';
  locked_by_name: string | null;
  lock_note: string | null;
  rule_versions: Array<{ rule_set_id: string; rule_set_version_id: string; rule_set_name: string; version_no: number }>;
}

export interface Profile {
  staff_id: string;
  staff_code: string;
  full_name: string;
  org_unit_id: string;
  org_unit_name: string;
  job_title_name: string | null;
  profile_id: string | null;
  rule_set_id: string | null;
  rule_set_name: string | null;
  subject_group: 'leader' | 'staff' | null;
  school_level: string | null;
  job_position: string | null;
  is_head: boolean | null;
  excluded: boolean | null;
  superior_staff_id: string | null;
  superior_name: string | null;
}

export interface CatalogItem {
  id: string;
  org_unit_id: string | null;
  org_unit_name: string | null;
  rule_set_id: string | null;
  rule_set_name: string | null;
  code: string;
  name: string;
  output_result: string | null;
  axis_code: string;
  task_type: string;
  difficulty_code: string;
  expected_evidence: string | null;
  deadline_hint: string | null;
  school_level: string | null;
  job_position: string | null;
  is_required: boolean;
  is_confidential: boolean;
  status: 'active' | 'inactive' | 'proposed' | 'rejected';
  proposed_by_name: string | null;
  decision_note: string | null;
}

export interface Task {
  id: string;
  period_id: string;
  staff_id: string;
  full_name: string;
  org_unit_name: string;
  catalog_item_id: string | null;
  name: string;
  output_result: string | null;
  axis_code: string;
  task_type: string;
  standard_score: number;
  difficulty_code: string;
  difficulty_weight: number;
  max_converted: number;
  is_confidential: boolean;
  origin: string;
  in_plan: boolean;
  status: string;
  deadline: string;
  original_deadline: string;
  assigned_by_name: string | null;
  evaluator_staff_id: string | null;
  evaluator_name: string | null;
  approval_due_at: string | null;
  auto_approved: boolean;
  decision_note: string | null;
  return_count: number;
  return_reason: string | null;
  requested_deadline: string | null;
  extension_reason: string | null;
  extension_status: string | null;
  actual_finish_date: string | null;
  evidence_text: string | null;
  document_number: string | null;
  self_quality_code: string | null;
  self_result_code: string | null;
  bonus_proposed: boolean;
  bonus_reason: string | null;
  grading_due_at: string | null;
  late_days: number | null;
  progress_percent: number | null;
  quality_code: string | null;
  result_code: string | null;
  task_percent: number | null;
  exceeded: boolean;
  bonus_approved: boolean;
  execution_score: number | null;
  converted_score: number | null;
  bonus_score: number | null;
  grader_comment: string | null;
  graded_by_name: string | null;
  auto_graded: boolean;
  rework_reason: string | null;
  file_count: number;
  files?: Array<{ id: string; file_name: string; content_type: string; uploaded_by_name: string }>;
}

export interface StaffOption {
  id: string;
  code: string;
  full_name: string;
  org_unit_id: string;
  org_unit_name: string;
  rule_set_id: string;
  rule_set_version_id: string | null;
}

export interface EvaluationDetail {
  id: string;
  period_id: string;
  staff_id: string;
  full_name: string;
  org_unit_name: string;
  period_name: string;
  period_status: 'open' | 'locked';
  rule_set_name: string;
  version_no: number;
  subject_group: 'leader' | 'staff';
  status: 'draft' | 'submitted' | 'returned' | 'concluded';
  general_self: number;
  general_score: number;
  plan_max: number;
  actual_total: number;
  task_score: number;
  bonus_score: number;
  total_score: number;
  suggested_rank: string | null;
  self_rank: string | null;
  self_comment: string | null;
  return_reason: string | null;
  exclusions: string[];
  exclusion_note: string | null;
  superior_rank: string | null;
  superior_comment: string | null;
  superior_by_name: string | null;
  advisory_rank: string | null;
  final_rank: string | null;
  criteria: Array<{
    code: string;
    title: string;
    items: Array<{
      code: string;
      title: string;
      max_score: number;
      self_satisfied: boolean;
      superior_satisfied: boolean | null;
      note: string | null;
      score: number;
    }>;
  }>;
  tasks: Array<
    Pick<
      Task,
      | 'id'
      | 'name'
      | 'is_confidential'
      | 'axis_code'
      | 'status'
      | 'in_plan'
      | 'deadline'
      | 'max_converted'
      | 'progress_percent'
      | 'task_percent'
      | 'converted_score'
      | 'exceeded'
    >
  >;
  votes: Array<{ voter_name: string; vote_rank: string; comment: string | null }>;
  config: Pick<
    KpiRuleConfig,
    'scoring_mode' | 'total_max' | 'axes' | 'ranks' | 'exclusions' | 'quality_levels' | 'result_levels' | 'bonus' | 'forms'
  > & { general_max: number; task_part_max: number };
}

export interface EvaluationRow {
  id: string | null;
  staff_id: string;
  staff_code: string;
  full_name: string;
  org_unit_id: string;
  org_unit_name: string;
  rule_set_name: string;
  subject_group: 'leader' | 'staff';
  is_head: boolean;
  status: string;
  general_score: number;
  task_score: number;
  bonus_score: number;
  total_score: number;
  suggested_rank: string | null;
  self_rank: string | null;
  superior_rank: string | null;
  superior_by_name: string | null;
  advisory_rank: string | null;
  advisory_comment: string | null;
  final_rank: string | null;
  rule_set_version_id: string | null;
  votes?: Record<string, number>;
  my_vote?: string | null;
}

export interface QuotaRow {
  group: string;
  base: number;
  limit: number;
  excellent: number;
  exceeded: boolean;
  rule_set_name: string;
}

export interface SummaryRow {
  id: string;
  full_name: string;
  job_title_name: string | null;
  org_unit_name: string;
  status_label: string;
  general_score: number;
  task_score: number;
  bonus_score: number;
  total_score: number;
  self_rank: string;
  superior_rank: string;
  advisory_rank: string;
  final_rank: string;
  staff_id: string;
}

export interface ManagerActionRow {
  manager_name: string;
  org_unit_name: string | null;
  action: string;
  action_label: string;
  total: number;
  on_time: number;
  late: number;
  automatic: number;
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => `${detail.field}: ${detail.message}`)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const send = <Result>(method: string, path: string, body?: unknown) =>
  requestJson<Result>(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

export const listRuleSets = () => requestJson<RuleSet[]>('/api/v1/kpi/rule-sets');
export const readRuleVersion = (id: string) => requestJson<RuleVersion>(`/api/v1/kpi/rule-versions/${id}`);
export const listPeriods = () => requestJson<Period[]>('/api/v1/kpi/periods');
export const listProfiles = (orgUnitId: string, keyword: string) =>
  requestJson<Profile[]>(`/api/v1/kpi/profiles?org_unit_id=${orgUnitId}${keyword ? `&q=${encodeURIComponent(keyword)}` : ''}`);
export const listCatalog = (query: string) => requestJson<CatalogItem[]>(`/api/v1/kpi/catalog${query ? `?${query}` : ''}`);
export const listIndicatorProgress = () =>
  requestJson<Array<{ rule_set_name: string; school_level: string; target: number; entered: number }>>(
    '/api/v1/kpi/catalog/indicator-progress',
  );
export const listMyTasks = (periodId: string) => requestJson<Task[]>(`/api/v1/kpi/tasks/mine?period_id=${periodId}`);
export const listTasks = (periodId: string, query = '') =>
  requestJson<Task[]>(`/api/v1/kpi/tasks?period_id=${periodId}${query ? `&${query}` : ''}`);
export const readTask = (id: string) => requestJson<Task>(`/api/v1/kpi/tasks/${id}`);
export const listStaffOptions = (periodId: string) =>
  requestJson<StaffOption[]>(`/api/v1/kpi/tasks/staff-options?period_id=${periodId}`);
export const readMyEvaluation = (periodId: string) =>
  requestJson<EvaluationDetail>(`/api/v1/kpi/evaluations/mine?period_id=${periodId}`);
export const readEvaluation = (id: string) => requestJson<EvaluationDetail>(`/api/v1/kpi/evaluations/${id}`);
export const listEvaluations = (periodId: string) =>
  requestJson<EvaluationRow[]>(`/api/v1/kpi/evaluations?period_id=${periodId}`);
export const readAdvisory = (periodId: string) =>
  requestJson<{ rows: EvaluationRow[]; quotas: QuotaRow[] }>(`/api/v1/kpi/advisory?period_id=${periodId}`);
export const listVoting = (periodId: string) => requestJson<EvaluationRow[]>(`/api/v1/kpi/voting?period_id=${periodId}`);
export const listSummary = (periodId: string) => requestJson<SummaryRow[]>(`/api/v1/kpi/reports/periods/${periodId}/summary`);
export const listManagerActions = (periodId: string) =>
  requestJson<ManagerActionRow[]>(`/api/v1/kpi/reports/periods/${periodId}/manager-actions`);

// Tải tệp do máy chủ dựng (mẫu báo cáo, tệp mẫu, minh chứng)
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

// Gửi tệp; máy chủ trả JSON hoặc tệp danh sách lỗi
export async function uploadFile<Result>(path: string, fields: Record<string, string>, file: File): Promise<Result> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  form.set('file', file);
  const response = await fetchWithSession(path, { method: 'POST', body: form });
  if (!response.ok) {
    throw await readError(response);
  }
  if (!response.headers.get('content-type')?.includes('json')) {
    saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'danh-sach-loi.xlsx');
    return { errorFile: true } as Result;
  }
  return (await response.json()) as Result;
}

export function rankLabel(config: Pick<KpiRuleConfig, 'ranks'> | undefined, code: string | null | undefined): string {
  if (!code) {
    return '';
  }
  return config?.ranks.find((rank) => rank.code === code)?.label ?? code;
}

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

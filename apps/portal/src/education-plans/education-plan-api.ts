import type {
  EducationPlanContent,
  EducationPlanPeriodCode,
  EducationPlanScopeCode,
  EducationPlanSection,
  EducationPlanSectionDiff,
  EducationPlanStatusCode,
  EducationPlanStepCode,
  KpiSchoolLevelCode,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147)
const API = '/api/v1';
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

export interface EducationPlanOverview {
  has_staff: boolean;
  can_use: boolean;
  can_review: boolean;
  can_approve: boolean;
  can_finalize: boolean;
  can_manage: boolean;
  signer_description: string;
  previous_year: string | null;
  my_department: { id: string; name: string } | null;
  my_groups: Array<{ kind: 'department' | 'work_group'; id: string; name: string }>;
  classes: Array<{ id: string; name: string; org_unit_id: string }>;
  org_units: Array<{ id: string; name: string }>;
}

export interface EducationPlanTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevelCode | null;
  scope: EducationPlanScopeCode;
  period: EducationPlanPeriodCode;
  sections: EducationPlanSection[];
  approval_steps: EducationPlanStepCode[];
  requires_signing: boolean;
  archive_folder_id: string | null;
  archive_folder_name: string | null;
  revision: number;
  sort_order: number;
  status: 'active' | 'inactive';
  plan_count: number;
}

export type TemplateInput = Omit<EducationPlanTemplate, 'id' | 'archive_folder_name' | 'revision' | 'plan_count'>;

export interface EducationPlan {
  id: string;
  template_id: string | null;
  template_name: string;
  scope: EducationPlanScopeCode;
  period: EducationPlanPeriodCode;
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  owner_name: string;
  owner_user_id: string;
  department_name: string | null;
  work_group_name: string | null;
  class_name: string | null;
  org_unit_name: string;
  status: EducationPlanStatusCode;
  status_label: string;
  current_step: EducationPlanStepCode | null;
  approval_steps: EducationPlanStepCode[];
  requires_signing: boolean;
  version_no: number;
  submitted_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  signed_at: string | null;
  source_year_name: string | null;
  updated_at: string;
}

export interface EducationPlanDetail extends EducationPlan {
  sections: EducationPlanSection[];
  content: EducationPlanContent;
  has_source: boolean;
  scope_label: string;
  period_type_label: string;
  return_note: string | null;
  signed_file_id: string | null;
  signature_method: string | null;
  signer_description: string;
  work_plan_id: string | null;
  archived_document: { id: string; folder_name: string; branch: string } | null;
  versions: Array<{
    version_no: number;
    title: string;
    note: string | null;
    created_by_name: string;
    created_at: string;
  }>;
  events: Array<{
    id: string;
    action: string;
    step: EducationPlanStepCode | null;
    note: string | null;
    actor_name: string;
    created_at: string;
  }>;
  actions: {
    edit: boolean;
    submit: boolean;
    delete: boolean;
    withdraw: boolean;
    approve: boolean;
    return: boolean;
    work_plan: boolean;
  };
}

export interface PlanCreateInput {
  template_id: string;
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  org_unit_id: string | null;
  department_id: string | null;
  work_group_id: string | null;
  class_id: string | null;
}

export interface PlanUpdateInput {
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  content: EducationPlanContent;
}

export interface PlanDiff {
  from_label: string;
  to_label: string;
  changed: number;
  sections: EducationPlanSectionDiff[];
}

interface ProgressRow {
  name: string;
  draft: number;
  pending: number;
  approved: number;
  returned: number;
  total: number;
  approved_percent: number;
}

export interface PlanProgress {
  totals: Omit<ProgressRow, 'name'>;
  by_step: Record<EducationPlanStepCode, number>;
  by_template: ProgressRow[];
  by_department: ProgressRow[];
  waiting: Array<{
    id: string;
    title: string;
    owner_name: string;
    template_name: string;
    department_name: string | null;
    current_step: EducationPlanStepCode | null;
    step_label: string;
    submitted_at: string | null;
    waiting_days: number;
  }>;
}

export interface PreviousPlans {
  year_name: string | null;
  plans: Array<{
    id: string;
    template_id: string | null;
    template_name: string;
    scope: EducationPlanScopeCode;
    title: string;
    period_label: string | null;
    owner_name: string;
    status: EducationPlanStatusCode;
    status_label: string;
  }>;
}

export const readPlanOverview = (): Promise<EducationPlanOverview> => requestJson(`${API}/education-plans/overview`);

export const listPlanTemplates = (level?: KpiSchoolLevelCode, includeInactive = false) =>
  requestJson<EducationPlanTemplate[]>(
    `${API}/education-plan-templates${query({ school_level: level, include_inactive: includeInactive })}`,
  );
export const savePlanTemplate = (id: string | null, input: TemplateInput): Promise<EducationPlanTemplate> =>
  requestJson(
    id ? `${API}/education-plan-templates/${id}` : `${API}/education-plan-templates`,
    json(id ? 'PUT' : 'POST', input),
  );
export const deletePlanTemplate = (id: string): Promise<void> =>
  requestJson(`${API}/education-plan-templates/${id}`, json('DELETE'));
export const loadDefaultTemplates = (level: KpiSchoolLevelCode): Promise<{ created: number; skipped: number }> =>
  requestJson(`${API}/education-plan-templates/defaults`, json('POST', { school_level: level }));

export const listPlans = (filter: {
  view: string;
  status?: string;
  template_id?: string;
  q?: string;
  processed?: boolean;
}): Promise<EducationPlan[]> => requestJson(`${API}/education-plans${query(filter)}`);
export const readPlan = (id: string): Promise<EducationPlanDetail> => requestJson(`${API}/education-plans/${id}`);
export const createPlan = (input: PlanCreateInput): Promise<EducationPlanDetail> =>
  requestJson(`${API}/education-plans`, json('POST', input));
export const updatePlan = (id: string, input: PlanUpdateInput): Promise<EducationPlanDetail> =>
  requestJson(`${API}/education-plans/${id}`, json('PUT', input));
export const deletePlan = (id: string): Promise<void> => requestJson(`${API}/education-plans/${id}`, json('DELETE'));
export const planAction = (id: string, action: 'submit' | 'withdraw' | 'approve' | 'return', note?: string) =>
  requestJson<EducationPlanDetail>(`${API}/education-plans/${id}/${action}`, json('POST', note ? { note } : {}));
export const createWorkPlan = (id: string): Promise<{ work_plan_id: string; items: number }> =>
  requestJson(`${API}/education-plans/${id}/work-plan`, json('POST'));
export const readPlanDiff = (id: string, from: string, to?: string): Promise<PlanDiff> =>
  requestJson(`${API}/education-plans/${id}/diff${query({ from, to })}`);
export const exportPlan = (id: string, format: 'docx' | 'pdf') =>
  download(`${API}/education-plans/${id}/export?format=${format}`, `ke-hoach.${format}`);
export const downloadSignedPlan = (id: string) =>
  download(`${API}/education-plans/${id}/signed-file`, 'ke-hoach-da-ki.pdf');

export const readPlanProgress = (templateId?: string): Promise<PlanProgress> =>
  requestJson(`${API}/education-plans/progress${query({ template_id: templateId })}`);
export const exportPlanProgress = (templateId?: string) =>
  download(
    `${API}/education-plans/progress/export${query({ template_id: templateId, format: 'xlsx' })}`,
    'tien-do.xlsx',
  );

export const listPreviousPlans = (): Promise<PreviousPlans> => requestJson(`${API}/education-plans/previous-year`);
export const copyPreviousPlan = (input: {
  source_id: string;
  title: string | null;
  class_id: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
}): Promise<EducationPlanDetail> => requestJson(`${API}/education-plans/copy`, json('POST', input));

import type {
  KpiSchoolLevelCode,
  MyWorkCount,
  MyWorkItem,
  MyWorkSourceCode,
  ProfessionalApprovalFlowCode,
  ProfessionalBranchCode,
  ProfessionalDocumentStatusCode,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e, YCTD-142)
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

// ---- Việc của tôi ----

export interface MyWorkResult {
  items: MyWorkItem[];
  count: MyWorkCount;
  failed_sources: MyWorkSourceCode[];
}

export const listMyWork = (filter: { source?: string; state?: string; q?: string }): Promise<MyWorkResult> =>
  requestJson(`${API}/my-work${query(filter)}`);
export const readMyWorkCount = (): Promise<MyWorkCount> => requestJson(`${API}/my-work/count`);

// ---- Hồ sơ chuyên môn ----

export interface ProfessionalOverview {
  locked: boolean;
  locked_at: string | null;
  locked_by_name: string | null;
  has_staff: boolean;
  can_use: boolean;
  can_review: boolean;
  can_approve: boolean;
  can_manage: boolean;
  signer_description: string;
  my_groups: Array<{ kind: 'department' | 'work_group'; id: string; name: string; leader?: boolean }>;
}

export interface ProfessionalFolder {
  id: string;
  parent_id: string | null;
  branch: ProfessionalBranchCode;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevelCode | null;
  approval_flow: ProfessionalApprovalFlowCode;
  requires_signing: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
  document_count: number;
}

export interface FolderInput {
  parent_id: string | null;
  branch: ProfessionalBranchCode;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevelCode | null;
  approval_flow: ProfessionalApprovalFlowCode;
  requires_signing: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface ProfessionalDocument {
  id: string;
  folder_id: string;
  folder_name: string;
  branch: ProfessionalBranchCode;
  round_id: string | null;
  round_title: string | null;
  round_due_at: string | null;
  title: string;
  owner_name: string;
  owner_user_id: string;
  department_name: string | null;
  work_group_name: string | null;
  org_unit_name: string;
  status: ProfessionalDocumentStatusCode;
  status_label: string;
  approval_flow: ProfessionalApprovalFlowCode;
  requires_signing: boolean;
  current_version: number;
  submitted_at: string | null;
  submitted_late: boolean;
  leader_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  signed_at: string | null;
  updated_at: string;
}

export interface ProfessionalDocumentDetail extends ProfessionalDocument {
  description: string | null;
  return_note: string | null;
  round_status: 'open' | 'closed' | null;
  signature_method: string | null;
  signed_file_id: string | null;
  locked: boolean;
  signer_description: string;
  versions: Array<{
    id: string;
    version_no: number;
    note: string | null;
    sha256: string;
    created_by_name: string;
    created_at: string;
    file_name: string;
    size_bytes: number;
  }>;
  events: Array<{ id: string; action: string; note: string | null; actor_name: string; created_at: string }>;
  actions: {
    upload: boolean;
    submit: boolean;
    withdraw: boolean;
    delete: boolean;
    leader_approve: boolean;
    approve: boolean;
    return: boolean;
  };
}

export interface DocumentFilter {
  view: 'mine' | 'groups' | 'school' | 'review';
  all?: boolean;
  folder_id?: string;
  round_id?: string;
  status?: string;
  q?: string;
  processed?: boolean;
}

export interface ProfessionalRound {
  id: string;
  folder_id: string;
  folder_name: string;
  branch: ProfessionalBranchCode;
  title: string;
  description: string | null;
  submitter_kind: 'staff' | 'group';
  org_unit_id: string | null;
  org_unit_name: string | null;
  department_ids: string[] | null;
  opens_on: string;
  due_at: string;
  status: 'open' | 'closed';
  reminded_at: string | null;
  created_by_name: string | null;
  expected: number;
  on_time: number;
  late: number;
  missing: number;
  my_state: 'on_time' | 'late' | 'missing' | 'draft' | null;
  my_document_id: string | null;
  overdue: boolean;
}

export interface RoundInput {
  folder_id: string;
  title: string;
  description: string | null;
  submitter_kind: 'staff' | 'group';
  org_unit_id: string | null;
  department_ids: string[];
  opens_on: string;
  due_at: string;
}

export interface RoundSubmitter {
  key: string;
  name: string;
  department_name: string | null;
  org_unit_name: string | null;
  document_id: string | null;
  status: ProfessionalDocumentStatusCode | null;
  submitted_at: string | null;
  state: 'on_time' | 'late' | 'missing' | 'draft';
}

export interface WorkGroup {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  members: Array<{ staff_id: string; is_leader: boolean; full_name: string; code: string }>;
}

export interface ProfessionalStatistics {
  rounds: Array<{
    id: string;
    title: string;
    due_at: string;
    status: 'open' | 'closed';
    submitter_kind: 'staff' | 'group';
    expected: number;
    on_time: number;
    late: number;
    missing: number;
    on_time_percent: number | null;
  }>;
  departments: Array<{ department: string; on_time: number; late: number; missing: number }>;
  totals: { expected: number; on_time: number; late: number; missing: number };
}

export const readProfessionalOverview = (): Promise<ProfessionalOverview> =>
  requestJson(`${API}/professional-records/overview`);
export interface ProfessionalOptions {
  units: Array<{ id: string; name: string; unit_type: string }>;
  departments: Array<{ id: string; name: string; org_unit_id: string }>;
  staff: Array<{ id: string; code: string; full_name: string; org_unit_id: string; department_name: string | null }>;
}
export const readProfessionalOptions = (): Promise<ProfessionalOptions> =>
  requestJson(`${API}/professional-records/options`);
export const setProfessionalLock = (locked: boolean): Promise<ProfessionalOverview> =>
  requestJson(`${API}/professional-records/lock`, json('PUT', { locked }));
export const readProfessionalStatistics = (roundId?: string): Promise<ProfessionalStatistics> =>
  requestJson(`${API}/professional-records/statistics${query({ round_id: roundId })}`);

export const listProfessionalFolders = (branch?: ProfessionalBranchCode, includeInactive = false) =>
  requestJson<ProfessionalFolder[]>(
    `${API}/professional-folders${query({ branch, include_inactive: includeInactive })}`,
  );
export const saveProfessionalFolder = (id: string | null, input: FolderInput): Promise<ProfessionalFolder> =>
  requestJson(
    id ? `${API}/professional-folders/${id}` : `${API}/professional-folders`,
    json(id ? 'PUT' : 'POST', input),
  );
export const deleteProfessionalFolder = (id: string): Promise<void> =>
  requestJson(`${API}/professional-folders/${id}`, json('DELETE'));
export const loadDefaultFolders = (level: KpiSchoolLevelCode): Promise<{ created: number; skipped: number }> =>
  requestJson(`${API}/professional-folders/defaults`, json('POST', { school_level: level }));

export const listWorkGroups = (): Promise<WorkGroup[]> => requestJson(`${API}/professional-work-groups`);
export const saveWorkGroup = (
  id: string | null,
  input: {
    org_unit_id: string;
    name: string;
    description: string | null;
    status: 'active' | 'inactive';
    members: Array<{ staff_id: string; is_leader: boolean }>;
  },
): Promise<WorkGroup> =>
  requestJson(
    id ? `${API}/professional-work-groups/${id}` : `${API}/professional-work-groups`,
    json(id ? 'PUT' : 'POST', input),
  );

export const listProfessionalRounds = (status: 'open' | 'closed' | 'all'): Promise<ProfessionalRound[]> =>
  requestJson(`${API}/professional-rounds${query({ status })}`);
export const saveProfessionalRound = (id: string | null, input: RoundInput) =>
  requestJson<ProfessionalRound>(
    id ? `${API}/professional-rounds/${id}` : `${API}/professional-rounds`,
    json(id ? 'PUT' : 'POST', input),
  );
export const roundAction = (id: string, action: 'close' | 'reopen' | 'remind') =>
  requestJson<{ reminded?: number }>(`${API}/professional-rounds/${id}/${action}`, json('POST'));
export const readRoundStatus = (id: string): Promise<{ round: ProfessionalRound; submitters: RoundSubmitter[] }> =>
  requestJson(`${API}/professional-rounds/${id}/status`);

export const listProfessionalDocuments = (filter: DocumentFilter): Promise<ProfessionalDocument[]> =>
  requestJson(`${API}/professional-documents${query({ ...filter })}`);
export const readProfessionalDocument = (id: string): Promise<ProfessionalDocumentDetail> =>
  requestJson(`${API}/professional-documents/${id}`);
export const createProfessionalDocument = (input: {
  folder_id: string;
  round_id?: string | null;
  title: string;
  description?: string | null;
  department_id?: string | null;
  work_group_id?: string | null;
}): Promise<{ id: string }> => requestJson(`${API}/professional-documents`, json('POST', input));
export const updateProfessionalDocument = (
  id: string,
  input: { title: string; description: string | null },
): Promise<ProfessionalDocumentDetail> => requestJson(`${API}/professional-documents/${id}`, json('PUT', input));
export const deleteProfessionalDocument = (id: string): Promise<void> =>
  requestJson(`${API}/professional-documents/${id}`, json('DELETE'));
export async function uploadProfessionalVersion(
  id: string,
  file: File,
  note: string,
): Promise<ProfessionalDocumentDetail> {
  const form = new FormData();
  form.append('note', note);
  form.append('file', file);
  const response = await fetchWithSession(`${API}/professional-documents/${id}/versions`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as ProfessionalDocumentDetail;
}
export const downloadProfessionalVersion = (id: string, version: { id: string; file_name: string }) =>
  download(`${API}/professional-documents/${id}/versions/${version.id}/file`, version.file_name);
export const downloadSignedProfessional = (id: string) =>
  download(`${API}/professional-documents/${id}/signed-file`, 'ho-so-da-ki.pdf');
export const professionalAction = (
  id: string,
  action: 'submit' | 'withdraw' | 'leader-approve' | 'approve' | 'return',
  note?: string,
): Promise<ProfessionalDocumentDetail> =>
  requestJson(`${API}/professional-documents/${id}/${action}`, json('POST', note ? { note } : {}));

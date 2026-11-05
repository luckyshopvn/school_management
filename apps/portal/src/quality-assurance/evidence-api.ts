import type {
  EvidenceEventActionCode,
  EvidenceRecordTypeCode,
  EvidenceValidityCode,
  QualityEvidenceStatusCode,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Kho minh chứng dùng chung (YCTD-396 lát L1)
const API = '/api/v1/quality/evidences';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | undefined | null>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      parameters.set(key, value);
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

export interface EvidenceNode {
  id: string;
  code: string;
  title: string;
  missing?: boolean;
}

export interface EvidenceFramework {
  id: string;
  code: string;
  name: string;
  school_level: string | null;
  status: string;
  // Loại bộ, đối tượng (nhà trường hoặc cá nhân), lát L3, L6
  kind: string;
  subject: 'school' | 'person';
  standards: Array<{ id: string; code: string; title: string; criteria: EvidenceNode[] }>;
}

export interface EvidenceFrameworks {
  can_contribute: boolean;
  can_manage: boolean;
  school_year_name: string;
  frameworks: EvidenceFramework[];
}

export interface EvidenceRow {
  id: string;
  code: string;
  display_code: string;
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  status: QualityEvidenceStatusCode;
  status_label: string;
  valid_until: string | null;
  validity: EvidenceValidityCode;
  validity_label: string;
  school_year_names: string[];
  has_personal_data: boolean;
  primary_node: EvidenceNode;
  shared_nodes: EvidenceNode[];
  source_label: string;
  version_no: number | null;
}

export interface EvidenceDetail {
  id: string;
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  description: string | null;
  school_year_names: string[];
  valid_until: string | null;
  status: QualityEvidenceStatusCode;
  status_label: string;
  validity: EvidenceValidityCode;
  validity_label: string;
  has_personal_data: boolean;
  owner_name: string | null;
  can_edit: boolean;
  can_delete: boolean;
  can_download: boolean;
  source_changed: boolean;
  codes: Array<{
    framework_id: string;
    framework_name: string;
    code: string;
    display_code: string;
    primary_node: EvidenceNode;
    shared_nodes: EvidenceNode[];
  }>;
  versions: Array<{
    version_no: number;
    source_kind: 'upload' | 'record';
    source_label: string;
    record_type: EvidenceRecordTypeCode | null;
    record_id: string | null;
    record_label: string | null;
    record_school_year: string | null;
    file_name: string | null;
    size_bytes: number | null;
    has_file: boolean;
    note: string | null;
    created_by_name: string | null;
    created_at: string;
  }>;
  events: Array<{
    action: EvidenceEventActionCode;
    action_label: string;
    version_no: number | null;
    detail: string | null;
    actor_name: string | null;
    created_at: string;
  }>;
}

export interface EvidenceInput {
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  description: string | null;
  valid_until: string | null;
  status: QualityEvidenceStatusCode;
  school_year_names: string[];
  shared_node_ids: string[];
}

export const readEvidenceFrameworks = () => requestJson<EvidenceFrameworks>(`${API}/frameworks`);
export const listStoreEvidences = (filter: {
  framework_id: string;
  node_id?: string;
  status?: string;
  validity?: string;
  q?: string;
  subject_user_id?: string;
}) => requestJson<EvidenceRow[]>(`${API}${query(filter)}`);
export const readEvidence = (id: string) => requestJson<EvidenceDetail>(`${API}/${id}`);
export const createStoreEvidence = (
  input: EvidenceInput & {
    framework_id: string;
    node_id: string;
    box: number | null;
    record_type: EvidenceRecordTypeCode | null;
    record_id: string | null;
    subject_user_id?: string | null;
  },
) => requestJson<{ id: string; code: string; display_code: string }>(API, json('POST', input));
export const updateStoreEvidence = (id: string, frameworkId: string, input: EvidenceInput) =>
  requestJson<EvidenceDetail>(`${API}/${id}`, json('PUT', { ...input, framework_id: frameworkId }));
export const attachEvidence = (id: string, frameworkId: string, nodeId: string) =>
  requestJson<{ code: string; display_code: string }>(
    `${API}/${id}/codes`,
    json('POST', { framework_id: frameworkId, node_id: nodeId }),
  );
export const deleteStoreEvidence = (id: string): Promise<void> => requestJson(`${API}/${id}`, json('DELETE'));
export async function addUploadVersion(id: string, file: File): Promise<{ version_no: number }> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetchWithSession(`${API}/${id}/versions`, { method: 'POST', body: form });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as { version_no: number };
}
export const addRecordVersion = (id: string, recordType: EvidenceRecordTypeCode, recordId: string) =>
  requestJson<{ version_no: number }>(
    `${API}/${id}/versions`,
    json('POST', { record_type: recordType, record_id: recordId }),
  );
export const downloadEvidenceVersion = (id: string, versionNo: number | null) =>
  download(
    `${API}/${id}/file${query({ version: versionNo === null ? null : String(versionNo), download: 'true' })}`,
    'minh-chung',
  );
export const exportStoreEvidences = (
  frameworkId: string,
  format: 'xlsx' | 'docx' | 'pdf' = 'xlsx',
  subjectUserId: string | null = null,
) =>
  download(
    `${API}/export${query({ framework_id: frameworkId, format, subject_user_id: subjectUserId })}`,
    `danh-muc-minh-chung.${format}`,
  );
export const listEvidenceByRecord = (recordType: EvidenceRecordTypeCode, recordId: string) =>
  requestJson<
    Array<{ id: string; title: string; code: string | null; framework_id: string | null; display_code: string | null }>
  >(`${API}/by-record${query({ record_type: recordType, record_id: recordId })}`);
export const listRecordSources = (recordType: EvidenceRecordTypeCode, q: string) =>
  requestJson<Array<{ id: string; label: string }>>(`${API}/sources${query({ record_type: recordType, q })}`);

// Tổng quan, độ phủ, phân công phụ trách tiêu chí (YCTD-396 lát L4)
export interface EvidenceAssignee {
  user_id: string;
  user_name: string;
  due_date: string | null;
  note: string | null;
}

export interface EvidenceCoverageRow {
  id: string;
  code: string;
  title: string;
  evidence_hint: string | null;
  standard_id: string;
  standard_code: string;
  standard_title: string;
  sufficient: number;
  collecting: number;
  missing: number;
  needs_update: number;
  expired: number;
  out_of_cycle: number;
  covered: boolean;
  assignee: EvidenceAssignee | null;
  group_leader: { user_id: string; user_name: string } | null;
}

export interface EvidenceCoverage {
  framework: { id: string; code: string; name: string; kind: string; cycle_years: number };
  school_year_name: string;
  cycle_year_names: string[];
  can_manage: boolean;
  criterion_count: number;
  covered_count: number;
  covered_percent: number;
  criteria: EvidenceCoverageRow[];
}

export interface EvidenceOverview {
  school_year_name: string;
  can_manage: boolean;
  frameworks: Array<{
    id: string;
    code: string;
    name: string;
    criterion_count: number;
    covered_count: number;
    covered_percent: number;
    missing_count: number;
    standards: Array<{
      code: string;
      title: string;
      criterion_count: number;
      covered_count: number;
      covered_percent: number;
    }>;
    missing: Array<{ id: string; code: string; title: string; assignee_name: string | null; due_date: string | null }>;
  }>;
  expiring: Array<{
    id: string;
    title: string;
    valid_until: string;
    validity: EvidenceValidityCode;
    validity_label: string;
  }>;
  // Bộ của cá nhân mà người xem đã có minh chứng (lát L6)
  personal: Array<{
    id: string;
    code: string;
    name: string;
    criterion_count: number;
    covered_count: number;
    covered_percent: number;
  }>;
  mine: Array<{
    framework_id: string;
    framework_name: string;
    id: string;
    code: string;
    title: string;
    due_date: string | null;
    covered: boolean;
  }>;
}

export interface EvidenceAssignInput {
  framework_id: string;
  node_ids: string[];
  user_id: string | null;
  due_date: string | null;
  note: string | null;
}

export const readEvidenceOverview = () => requestJson<EvidenceOverview>(`${API}/overview`);
export const readEvidenceCoverage = (frameworkId: string, subjectUserId: string | null = null) =>
  requestJson<EvidenceCoverage>(
    `${API}/coverage${query({ framework_id: frameworkId, subject_user_id: subjectUserId })}`,
  );
export const listEvidenceAssignees = () =>
  requestJson<Array<{ user_id: string; full_name: string; code: string }>>(`${API}/assignees`);
export const assignEvidenceCriteria = (input: EvidenceAssignInput) =>
  requestJson<{ assigned: number; removed: number }>(`${API}/assignments`, json('PUT', input));
export const assignEvidenceFromGroups = (frameworkId: string) =>
  requestJson<{ assigned: number }>(`${API}/assignments/from-groups`, json('POST', { framework_id: frameworkId }));

// Xuất danh mục, gói hồ sơ minh chứng, kiểm mã trích dẫn của báo cáo tự đánh giá (YCTD-396 lát L5)
export const requestEvidencePackage = (frameworkId: string) =>
  requestJson<{ job: { id: string; title: string } }>(`${API}/package`, json('POST', { framework_id: frameworkId }));
export const checkReportCitations = (assessmentId: string) =>
  requestJson<{ cited_count: number; unknown: Array<{ code: string; location: string }> }>(
    `/api/v1/quality/assessments/${assessmentId}/report/citations`,
  );

// Đoàn đánh giá ngoài (YCTD-396 lát L8): giao bộ tiêu chí cho tài khoản vai trò VT-23 đến hết ngày giao
export interface EvidenceReviewGrant {
  id: string;
  user_id: string;
  user_name: string;
  framework_id: string;
  framework_code: string;
  framework_name: string;
  valid_until: string;
  note: string | null;
  granted_by_name: string | null;
  expired: boolean;
}

export const listReviewGrants = () => requestJson<EvidenceReviewGrant[]>(`${API}/reviewers`);
export const saveReviewGrant = (input: {
  user_id: string;
  user_name: string;
  framework_id: string;
  valid_until: string;
  note: string | null;
}) => requestJson<{ id: string }>(`${API}/reviewers`, json('PUT', input));
export const revokeReviewGrant = (id: string): Promise<void> => requestJson(`${API}/reviewers/${id}`, json('DELETE'));

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
}) => requestJson<EvidenceRow[]>(`${API}${query(filter)}`);
export const readEvidence = (id: string) => requestJson<EvidenceDetail>(`${API}/${id}`);
export const createStoreEvidence = (
  input: EvidenceInput & {
    framework_id: string;
    node_id: string;
    box: number | null;
    record_type: EvidenceRecordTypeCode | null;
    record_id: string | null;
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
export const exportStoreEvidences = (frameworkId: string) =>
  download(`${API}/export${query({ framework_id: frameworkId, format: 'xlsx' })}`, 'danh-muc-minh-chung.xlsx');
export const listRecordSources = (recordType: EvidenceRecordTypeCode, q: string) =>
  requestJson<Array<{ id: string; label: string }>>(`${API}/sources${query({ record_type: recordType, q })}`);

import type {
  LearningResourceReportKind,
  LearningResourceStatus,
  ResourceVersionKind,
  ResourceVisibility,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Kho học liệu số (DT-22 phần 22h1, YCTD-183)
const API = '/api/v1/learning-resources';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | null | undefined>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) {
      parameters.set(key, value);
    }
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}

export interface ResourceType {
  id: string;
  code: string;
  name: string;
  requires_school_review: boolean;
  status: 'active' | 'inactive';
}

export interface ResourceLicense {
  id: string;
  code: string;
  name: string;
  blocked: boolean;
  private_only: boolean;
  requires_grant_source: boolean;
  status: 'active' | 'inactive';
}

export interface ResourceTopic {
  id: string;
  name: string;
  subject_code: string | null;
  grade_level_code: string | null;
  status: 'active' | 'inactive';
}

export interface ResourceCatalog {
  types: ResourceType[];
  licenses: ResourceLicense[];
  topics: ResourceTopic[];
  subjects: Array<{ code: string; name: string; school_level: string }>;
  grades: Array<{ code: string; name: string; school_level: string }>;
}

export interface LearningResource {
  id: string;
  title: string;
  description: string | null;
  type_id: string;
  type_name: string;
  school_level: string | null;
  grade_level_code: string | null;
  subject_code: string | null;
  subject_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  week_no: number | null;
  keywords: string[];
  author_name: string | null;
  license_id: string | null;
  license_name: string | null;
  license_source: string | null;
  origin: string | null;
  responsible_name: string | null;
  visibility: ResourceVisibility;
  status: LearningResourceStatus;
  needs_school_review: boolean;
  owner_name: string;
  department_name: string | null;
  current_version: number;
  published_version: number | null;
  return_note: string | null;
  // Học liệu do trợ lý AI soạn nháp (DT-23 phần 23d)
  ai_generated?: boolean;
  can_review: boolean;
  is_owner: boolean;
}

export interface ResourceInput {
  title: string;
  description: string | null;
  type_id: string;
  school_level: string | null;
  grade_level_code: string | null;
  subject_code: string | null;
  topic_id: string | null;
  week_no: number | null;
  keywords: string[];
  author_name: string | null;
  license_id: string | null;
  license_source: string | null;
  origin: string | null;
  responsible_name: string | null;
  visibility: ResourceVisibility;
}

export interface ResourceDetail {
  resource: LearningResource;
  versions: Array<{
    id: string;
    version_no: number;
    kind: ResourceVersionKind;
    file_name: string | null;
    size_bytes: number | null;
    url: string | null;
    link_title: string | null;
    created_at: string;
  }>;
  events: Array<{
    action: string;
    version_no: number | null;
    note: string | null;
    actor_name: string;
    created_at: string;
  }>;
  views: number;
  downloads: number;
}

export interface ResourceCollection {
  id: string;
  name: string;
  description: string | null;
  visibility: 'private' | 'unit' | 'school';
  owner_name: string;
  items: number;
  is_owner: boolean;
}

export interface ResourceReport {
  id: string;
  resource_id: string;
  resource_title: string;
  kind: LearningResourceReportKind;
  description: string;
  status: 'open' | 'resolved' | 'rejected';
  reporter_name: string;
  response: string | null;
  handled_by_name: string | null;
  created_at: string;
}

export interface ResourceStatistics {
  total: number;
  published: number;
  pending: number;
  overdue: number;
  license_expiring: Array<{ id: string; title: string; license_expires_on: string }>;
  by_subject: Array<{ label: string; total: number }>;
  by_grade: Array<{ label: string; total: number }>;
  by_type: Array<{ label: string; total: number }>;
  by_license: Array<{ label: string; total: number }>;
  by_department: Array<{ label: string; total: number }>;
  contributors: Array<{ label: string; total: number }>;
  top: Array<{ id: string; title: string; views: number; downloads: number; reports: number }>;
}

export const readResourceCatalog = (): Promise<ResourceCatalog> => requestJson(`${API}/catalog`);
export const saveResourceType = (id: string | null, input: Partial<ResourceType>) =>
  requestJson(id ? `${API}/types/${id}` : `${API}/types`, json(id ? 'PATCH' : 'POST', input));
export const saveResourceLicense = (id: string | null, input: Partial<ResourceLicense>) =>
  requestJson(id ? `${API}/licenses/${id}` : `${API}/licenses`, json(id ? 'PATCH' : 'POST', input));
export const saveResourceTopic = (id: string | null, input: Partial<ResourceTopic>) =>
  requestJson(id ? `${API}/topics/${id}` : `${API}/topics`, json(id ? 'PATCH' : 'POST', input));

export const searchResources = (filter: Record<string, string | null | undefined>): Promise<LearningResource[]> =>
  requestJson(`${API}${query(filter)}`);
export const createResource = (input: ResourceInput): Promise<LearningResource> =>
  requestJson(API, json('POST', input));
export const readResource = (id: string): Promise<ResourceDetail> => requestJson(`${API}/${id}`);
export function uploadResourceFile(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return requestJson(`${API}/${id}/files`, { method: 'POST', body: form });
}
export const addResourceLink = (id: string, url: string, linkTitle: string | null) =>
  requestJson(`${API}/${id}/links`, json('POST', { url, link_title: linkTitle }));
export const submitResource = (id: string): Promise<LearningResource> =>
  requestJson(`${API}/${id}/submit`, json('POST'));
export const reviewResource = (id: string, decision: 'approve' | 'return', note: string | null) =>
  requestJson(`${API}/${id}/review`, json('POST', { decision, note }));
export const setResourceLifecycle = (id: string, action: 'hide' | 'restore' | 'retire', note: string | null) =>
  requestJson(`${API}/${id}/${action}`, json('POST', { note }));
export const reportResource = (id: string, kind: LearningResourceReportKind, description: string) =>
  requestJson(`${API}/${id}/reports`, json('POST', { kind, description }));

// Tải phiên bản: tệp thì lưu xuống; liên kết ngoài mở ở thẻ mới; kế hoạch bài dạy trả nội dung để hiện
export async function downloadResource(id: string, versionNo?: number) {
  const response = await fetchWithSession(`${API}/${id}/download${versionNo ? `?version=${versionNo}` : ''}`);
  if (!response.ok) {
    throw await readError(response);
  }
  if ((response.headers.get('content-type') ?? '').startsWith('application/json')) {
    return (await response.json()) as { kind: 'link' | 'lesson_plan'; url?: string; lesson_plan?: unknown };
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'hoc-lieu');
  return { kind: 'file' as const };
}

export const listCollections = (): Promise<ResourceCollection[]> => requestJson(`${API}/collections`);
export const createCollection = (input: { name: string; visibility: string }): Promise<ResourceCollection> =>
  requestJson(`${API}/collections`, json('POST', input));
export const readCollection = (id: string): Promise<{ collection: ResourceCollection; items: LearningResource[] }> =>
  requestJson(`${API}/collections/${id}`);
export const setCollectionItems = (id: string, resourceIds: string[]) =>
  requestJson(`${API}/collections/${id}/items`, json('PUT', { resource_ids: resourceIds }));
export const deleteCollection = (id: string) => requestJson(`${API}/collections/${id}`, json('DELETE'));
export async function exportCollection(id: string) {
  const response = await fetchWithSession(`${API}/collections/${id}/export`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'bo-suu-tap.xlsx');
}

export const listResourceReports = (): Promise<ResourceReport[]> => requestJson(`${API}/reports`);
export const handleResourceReport = (
  id: string,
  input: { status: 'resolved' | 'rejected'; response: string; hide: boolean },
) => requestJson(`${API}/reports/${id}/handle`, json('POST', input));
export const readResourceStatistics = (): Promise<ResourceStatistics> => requestJson(`${API}/statistics`);

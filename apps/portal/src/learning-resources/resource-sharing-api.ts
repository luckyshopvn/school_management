import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184)
const API = '/api/v1/resource-sharing';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export type BankKind = 'question' | 'exam' | 'matrix';

export const BANK_KIND_LABELS: Record<BankKind, string> = { question: 'Câu hỏi', exam: 'Đề', matrix: 'Ma trận' };
export const BANK_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  review: 'Chờ thẩm định',
  approved: 'Dùng được',
  retired: 'Ngừng dùng',
  submitted: 'Chờ thẩm định',
  locked: 'Đã khoá',
  active: 'Đang dùng',
  inactive: 'Ngừng dùng',
};
export const COGNITIVE_LABELS: Record<string, string> = {
  recognition: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
  high_application: 'Vận dụng cao',
};

export interface BankItem {
  kind: BankKind;
  id: string;
  title: string;
  subject_name: string;
  grade_level_code: string;
  topic_name?: string | null;
  cognitive_level?: string;
  status: string;
  exams?: number;
  attempts?: number;
  difficulty?: number | null;
  link: string;
}

export interface CollectionBankItem {
  kind: BankKind;
  kind_label: string;
  id: string;
  title: string;
  status: string;
  link: string;
}

export interface SharingStatistics {
  questions: number;
  used_questions: number;
  questions_by_subject: Array<{ label: string; total: number }>;
  questions_by_topic: Array<{ label: string; total: number }>;
  questions_by_level: Array<{
    level: string;
    label: string;
    questions: number;
    used: number;
    attempts: number;
    difficulty: number | null;
  }>;
  resources_by_subject: Array<{ label: string; total: number }>;
  gaps: Array<{ name: string; resources: number; questions: number }>;
}

export interface RubricLevel {
  label: string;
  score: number;
}
export interface RubricCriterion {
  name: string;
  weight: number;
  descriptors: string[];
}
export interface Rubric {
  id: string;
  name: string;
  description: string | null;
  levels: RubricLevel[];
  criteria: RubricCriterion[];
  max_score: number;
  visibility: 'private' | 'school';
  status: 'active' | 'archived';
  owner_name: string;
  subject_name: string | null;
  question_content: string | null;
  is_owner: boolean;
}

export interface PackagePreview {
  collection: { id: string; name: string };
  exportable: Array<{ id: string; title: string; kind: string; license_code: string }>;
  skipped: Array<{ title: string; reason: string }>;
}

export interface PackageImport {
  id: string;
  package_code: string;
  source_school: string;
  imported_count: number;
  skipped: Array<{ title: string; reason: string }>;
  imported_by_name: string;
  created_at: string;
}

export const searchBank = (filter: { kind: BankKind; q?: string; cognitive_level?: string }): Promise<BankItem[]> => {
  const parameters = new URLSearchParams(
    Object.entries(filter).filter(([, value]) => value) as Array<[string, string]>,
  );
  return requestJson(`${API}/bank?${parameters.toString()}`);
};
export const readSharingStatistics = (): Promise<SharingStatistics> => requestJson(`${API}/statistics`);
export const readCollectionBankItems = (id: string): Promise<CollectionBankItem[]> =>
  requestJson(`${API}/collections/${id}/items`);
export const setCollectionBankItems = (id: string, items: Array<{ kind: BankKind; id: string }>) =>
  requestJson(`${API}/collections/${id}/items`, json('PUT', { items }));

export const listRubrics = (): Promise<Rubric[]> => requestJson(`${API}/rubrics`);
export const saveRubric = (id: string | null, body: unknown): Promise<Rubric> =>
  requestJson(id ? `${API}/rubrics/${id}` : `${API}/rubrics`, json(id ? 'PUT' : 'POST', body));
export const rubricAction = (id: string, action: 'clone' | 'archive' | 'restore'): Promise<Rubric> =>
  requestJson(`${API}/rubrics/${id}/${action}`, json('POST'));

export const previewPackage = (collectionId: string): Promise<PackagePreview> =>
  requestJson(`${API}/packages/preview?collection_id=${collectionId}`);
export const listPackageImports = (): Promise<PackageImport[]> => requestJson(`${API}/packages/imports`);
export function importPackage(file: File): Promise<PackageImport & { resource_ids: string[] }> {
  const form = new FormData();
  form.append('file', file);
  return requestJson(`${API}/packages/import`, { method: 'POST', body: form });
}

export async function downloadSharingFile(path: string, fallback: string) {
  const response = await fetchWithSession(`${API}/${path}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallback);
}

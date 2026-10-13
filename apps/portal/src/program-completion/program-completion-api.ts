import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối hoàn thành chương trình giáo dục mầm non (YCTD-102)
export type CompletionResult = 'completed' | 'not_completed';

export const RESULT_LABELS: Record<CompletionResult, string> = {
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};

export interface CompletionClass {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  grade_level_name: string;
  children_count: number;
  completed_count: number;
  not_completed_count: number;
  unmarked_count: number;
  completion_rate: number;
  confirmed: boolean;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
}

export interface CompletionClassDetail extends CompletionClass {
  can_manage: boolean;
  can_approve: boolean;
  children: Array<{
    child_id: string;
    full_name: string;
    dob: string;
    result: CompletionResult | null;
    note: string | null;
    recorded_by_name: string | null;
  }>;
}

export interface CompletionStatistics {
  classes: CompletionClass[];
  units: Array<{
    org_unit_id: string;
    org_unit_name: string;
    class_count: number;
    confirmed_class_count: number;
    children_count: number;
    completed_count: number;
    not_completed_count: number;
    unmarked_count: number;
    completion_rate: number;
  }>;
  total: {
    class_count: number;
    children_count: number;
    completed_count: number;
    not_completed_count: number;
    unmarked_count: number;
    completion_rate: number;
  };
}

const unitQuery = (orgUnitId: string) => (orgUnitId ? `?org_unit_id=${orgUnitId}` : '');

export const readCompletionStatistics = (orgUnitId: string): Promise<CompletionStatistics> =>
  requestJson(`/api/v1/program-completion/statistics${unitQuery(orgUnitId)}`);
export const readCompletionClass = (classId: string): Promise<CompletionClassDetail> =>
  requestJson(`/api/v1/program-completion/classes/${classId}`);
export const recordCompletion = (
  classId: string,
  items: Array<{ child_id: string; result: CompletionResult; note: string | null }>,
): Promise<CompletionClassDetail> =>
  requestJson(`/api/v1/program-completion/classes/${classId}`, { method: 'PUT', body: JSON.stringify({ items }) });
export const confirmCompletion = (classId: string): Promise<CompletionClassDetail> =>
  requestJson(`/api/v1/program-completion/classes/${classId}/confirm`, { method: 'POST' });
export const unconfirmCompletion = (classId: string, reason: string): Promise<CompletionClassDetail> =>
  requestJson(`/api/v1/program-completion/classes/${classId}/unconfirm`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// Tải danh sách ra Excel; máy chủ ghi nhật ký xuất rồi trả tệp
export async function exportCompletion(filter: { classId?: string; orgUnitId?: string }): Promise<void> {
  const parameters = new URLSearchParams();
  if (filter.classId) parameters.set('class_id', filter.classId);
  if (filter.orgUnitId) parameters.set('org_unit_id', filter.orgUnitId);
  const response = await fetchWithSession(`/api/v1/program-completion/export?${parameters.toString()}`);
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'hoan-thanh-chuong-trinh.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

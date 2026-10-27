import { ApiError, requestJson } from '../session/api-client.js';
import type { Group } from './classroom-logic.ts';

// Gọi máy chủ cho công cụ lớp học (DT-23 phần 23b, YCTD-212); giao diện không chứa quy tắc nghiệp vụ (QU-09)
export interface ToolsConfig {
  offline_enabled: boolean;
  roster_ttl_hours: number;
  conduct_enabled: boolean;
}

export interface RosterResponse {
  class_id: string;
  class_name: string;
  generated_at: string;
  students: Array<{ id: string; order_no: number; full_name: string; code: string | null; absent_today: boolean }>;
}

export interface CallRecord {
  id: string;
  child_id: string;
  full_name: string;
  called_by_name: string;
  called_at: string;
}

export interface QueuedCall {
  client_id: string;
  class_id: string;
  child_id: string;
  called_at: string;
}

export interface QueuedScore {
  client_id: string;
  class_id: string;
  session_key: string;
  target_kind: 'group' | 'student';
  group_name: string | null;
  child_id: string | null;
  delta: number;
  occurred_at: string;
}

export interface ConductCriterion {
  id: string;
  code: string;
  name: string;
  kind: 'plus' | 'minus';
  points: number;
  school_level: string;
  status: string;
}

const BASE = '/api/v1/classroom-tools';

// Lỗi mạng là lỗi không có phản hồi từ máy chủ; lỗi nghiệp vụ (có phản hồi) không đưa vào hàng đợi
export function isNetworkError(error: unknown): boolean {
  return !(error instanceof ApiError);
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

export const fetchToolsConfig = () => requestJson<ToolsConfig>(`${BASE}/config`);

export const fetchRoster = (classId: string) => requestJson<RosterResponse>(`${BASE}/classes/${classId}/roster`);

export const sendCalls = (classId: string, calls: Array<Omit<QueuedCall, 'class_id'>>) =>
  requestJson<{ saved: number; duplicates: number }>(`${BASE}/calls`, {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, calls }),
  });

export const fetchCalls = (classId: string) => requestJson<CallRecord[]>(`${BASE}/classes/${classId}/calls`);

export const deleteCalls = (classId: string, callId?: string) =>
  requestJson<{ deleted: number }>(`${BASE}/classes/${classId}/calls${callId ? `/${callId}` : ''}`, {
    method: 'DELETE',
  });

export const fetchGrouping = (classId: string) =>
  requestJson<{ groups: Group[]; updated_at: string | null }>(`${BASE}/classes/${classId}/grouping`);

// Lưu bản chia thành bộ nhóm của công cụ lớp học; chọn bộ sẵn có thì gửi kèm mã bộ nguồn (DT-28 phần 28a)
export const saveGrouping = (classId: string, groups: Group[], groupSetId?: string) =>
  requestJson<{ groups: Group[] }>(`${BASE}/classes/${classId}/grouping`, {
    method: 'PUT',
    body: JSON.stringify(groupSetId ? { groups, group_set_id: groupSetId } : { groups }),
  });

// Bộ nhóm dùng chung của lớp (DT-28 phần 28a, YCTD-271): chia theo năng lực, cân bằng giới tính trên máy chủ (cần mạng)
export type ServerSplitMethod = 'gender_balanced' | 'ability_mixed' | 'ability_tiered';

export interface GroupSetSummary {
  id: string;
  name: string;
  purpose: 'subject' | 'activity' | 'classroom';
  subject_name: string | null;
  owner_name: string;
  group_count: number;
}

export const fetchGroupSets = (classId: string) =>
  requestJson<GroupSetSummary[]>(`/api/v1/group-sets?class_id=${classId}`);

export const fetchGroupSet = (groupSetId: string) =>
  requestJson<{ id: string; groups: Group[] }>(`/api/v1/group-sets/${groupSetId}`);

export const fetchGroupSubjects = (classId: string) =>
  requestJson<Array<{ id: string; name: string }>>(`/api/v1/group-sets/subjects?class_id=${classId}`);

export const previewGroups = (body: {
  class_id: string;
  subject_id: string | null;
  method: ServerSplitMethod;
  by: 'count' | 'size';
  value: number;
  exclude_absent: boolean;
}) =>
  requestJson<{ groups: Group[]; violations: unknown[] }>('/api/v1/group-sets/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const sendScores = (
  classId: string,
  sessionKey: string,
  events: Array<Omit<QueuedScore, 'class_id' | 'session_key'>>,
) =>
  requestJson<{ saved: number; duplicates: number }>(`${BASE}/scores`, {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, session_key: sessionKey, events }),
  });

export const discardSession = (classId: string, sessionKey: string) =>
  requestJson<{ deleted: number }>(`${BASE}/classes/${classId}/scores/${sessionKey}`, { method: 'DELETE' });

export const confirmSession = (
  classId: string,
  sessionKey: string,
  body: { criterion_id: string; targets?: Array<{ kind: 'group' | 'student'; key: string }> },
) =>
  requestJson<{ confirmed_events: number; net: number; quantity: number }>(
    `${BASE}/classes/${classId}/scores/${sessionKey}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const fetchCriteria = (schoolLevel: string) =>
  requestJson<ConductCriterion[]>(`/api/v1/conduct/criteria?school_level=${encodeURIComponent(schoolLevel)}`);

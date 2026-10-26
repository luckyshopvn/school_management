import { requestJson } from '../session/api-client.js';

// Lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272): lớp học trực tuyến, chương, hoạt động, tiến độ, khoá học mẫu,
// quyết định hình thức và nội quy dạy học trực tuyến (Thông tư 09/2021/TT-BGDĐT)
const json = (method: string, body?: unknown) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export type TeachingMode = 'support' | 'replace';
export type CompletionRule = 'view' | 'submit' | 'pass' | 'teacher';

export interface LearningConfig {
  can_teach: boolean;
  can_template: boolean;
  can_decide: boolean;
  can_view: boolean;
  can_review: boolean;
  link_domains: string[] | null;
  activity_kinds: Array<{
    code: string;
    label: string;
    completion_rules: CompletionRule[];
    default_completion: CompletionRule;
    allowed_in_template: boolean;
  }>;
}

export interface SpaceSummary {
  id: string;
  kind: 'class_subject' | 'elective';
  title: string;
  class_id: string | null;
  class_name: string | null;
  subject_name: string | null;
  school_level: string;
  visible_to_students: boolean;
  status: 'active' | 'archived';
  activity_count: number;
  teacher_names: string;
  source_template_id: string | null;
}

export interface Section {
  id: string;
  title: string;
  position: number;
  planned_week: number | null;
}

export interface Activity {
  id: string;
  section_id: string;
  kind: string;
  kind_label: string;
  title: string;
  instructions: string | null;
  status: 'draft' | 'published';
  required: boolean;
  teaching_mode: TeachingMode;
  due_at: string | null;
  opens_at: string | null;
  completion_rule: CompletionRule;
  planned_week: number | null;
  settings: Record<string, unknown>;
  template_item_key: string | null;
}

export interface SpaceDetail {
  space: SpaceSummary & { description: string | null };
  can_teach: boolean;
  replace_allowed_today: boolean;
  teachers: Array<{ user_id: string; user_name: string; source: string }>;
  student_count: number;
  sections: Section[];
  activities: Activity[];
}

export interface Progress {
  activities: Array<{ id: string; title: string; kind: string; required: boolean; due_at: string | null }>;
  students: Array<{
    child_id: string;
    full_name: string;
    summary: { required: number; done: number; overdue: number; percent: number };
    results: Record<string, { status: string; score: number | null }>;
  }>;
}

export interface WeekPlan {
  weeks: Array<{
    week: number | null;
    items: Array<{
      activity_id: string;
      section_title: string;
      title: string;
      kind: string;
      teaching_mode: TeachingMode;
      status: string;
    }>;
  }>;
}

export interface TemplateItem {
  key: string;
  kind: string;
  title: string;
  settings: Record<string, unknown>;
  planned_week?: number | null;
}

export interface TemplateContent {
  sections: Array<{ key: string; title: string; planned_week: number | null; items: TemplateItem[] }>;
}

export interface CourseTemplate {
  id: string;
  title: string;
  description: string | null;
  school_level: 'TH' | 'THCS' | 'THPT';
  subject_name: string | null;
  owner_name: string;
  status: 'draft' | 'pending_unit' | 'pending_school' | 'published' | 'returned' | 'retired';
  version: number;
  published_version: number | null;
  content: TemplateContent | null;
  return_reason: string | null;
  can_edit: boolean;
  can_review: boolean;
}

export interface Decision {
  id: string;
  decision_no: string;
  decision_date: string;
  reason: string;
  class_ids: string[];
  starts_on: string;
  ends_on: string;
  status: 'active' | 'revoked';
  created_by_name: string;
}

export interface RuleState {
  current: { id: string; version: number; content: string; published_at: string; published_by_name: string } | null;
  acknowledged: number;
}

export const readLearningConfig = (): Promise<LearningConfig> => requestJson('/api/v1/learning/config');
export const listSpaces = (scope: 'mine' | 'all'): Promise<SpaceSummary[]> =>
  requestJson(`/api/v1/learning/spaces?scope=${scope}`);
export const syncSpaces = (): Promise<{ created: number; teachers_added: number; teachers_removed: number }> =>
  requestJson('/api/v1/learning/spaces/sync', json('POST'));
export const createElective = (input: { title: string; school_level: string; description?: string | null }) =>
  requestJson<{ id: string }>('/api/v1/learning/spaces', json('POST', input));
export const readSpace = (id: string): Promise<SpaceDetail> => requestJson(`/api/v1/learning/spaces/${id}`);
export const updateSpace = (id: string, changes: { visible_to_students?: boolean; status?: string; title?: string }) =>
  requestJson<SpaceDetail>(`/api/v1/learning/spaces/${id}`, json('PATCH', changes));
export const createSection = (spaceId: string, input: { title: string; planned_week: number | null }) =>
  requestJson<Section>(`/api/v1/learning/spaces/${spaceId}/sections`, json('POST', input));
export const removeSection = (id: string) => requestJson(`/api/v1/learning/sections/${id}`, json('DELETE'));
export const createActivity = (spaceId: string, input: Record<string, unknown>) =>
  requestJson<Activity>(`/api/v1/learning/spaces/${spaceId}/activities`, json('POST', input));
export const updateActivity = (id: string, changes: Record<string, unknown>) =>
  requestJson<Activity>(`/api/v1/learning/activities/${id}`, json('PATCH', changes));
export const publishActivity = (id: string, published: boolean) =>
  requestJson<Activity>(`/api/v1/learning/activities/${id}/publish`, json('POST', { published }));
export const removeActivity = (id: string) => requestJson(`/api/v1/learning/activities/${id}`, json('DELETE'));
export const recordResult = (id: string, input: { child_id: string; status: string }) =>
  requestJson(`/api/v1/learning/activities/${id}/results`, json('POST', input));
export const readProgress = (spaceId: string): Promise<Progress> =>
  requestJson(`/api/v1/learning/spaces/${spaceId}/progress`);
export const readPlan = (spaceId: string): Promise<WeekPlan> => requestJson(`/api/v1/learning/spaces/${spaceId}/plan`);

export const listTemplates = (): Promise<CourseTemplate[]> => requestJson('/api/v1/learning/templates');
export const createTemplate = (input: {
  title: string;
  school_level: string;
  subject_id?: string | null;
  content: TemplateContent;
}) => requestJson<CourseTemplate>('/api/v1/learning/templates', json('POST', input));
export const saveTemplate = (id: string, input: { content: TemplateContent }) =>
  requestJson<CourseTemplate>(`/api/v1/learning/templates/${id}`, json('PUT', input));
export const submitTemplate = (id: string) =>
  requestJson<CourseTemplate>(`/api/v1/learning/templates/${id}/submit`, json('POST'));
export const reviewTemplate = (id: string, input: { decision: 'approve' | 'return'; note?: string }) =>
  requestJson<CourseTemplate>(`/api/v1/learning/templates/${id}/review`, json('POST', input));
export const applyTemplate = (id: string, spaceIds: string[]) =>
  requestJson<{ spaces: Array<{ space_id: string; created: number; updated: number; kept_local: number }> }>(
    `/api/v1/learning/templates/${id}/apply`,
    json('POST', { space_ids: spaceIds }),
  );

export const listDecisions = (): Promise<Decision[]> => requestJson('/api/v1/learning/decisions');
export const createDecision = (input: Omit<Decision, 'id' | 'status' | 'created_by_name'>) =>
  requestJson<Decision>('/api/v1/learning/decisions', json('POST', input));
export const revokeDecision = (id: string) =>
  requestJson<Decision>(`/api/v1/learning/decisions/${id}/revoke`, json('POST'));
export const readRules = (): Promise<RuleState> => requestJson('/api/v1/learning/rules');
export const publishRules = (content: string) => requestJson('/api/v1/learning/rules', json('POST', { content }));

export const TEMPLATE_STATUS_LABELS: Record<CourseTemplate['status'], string> = {
  draft: 'Nháp',
  pending_unit: 'Chờ tổ duyệt',
  pending_school: 'Chờ Ban Giám hiệu duyệt',
  published: 'Đã duyệt',
  returned: 'Bị trả lại',
  retired: 'Ngừng dùng',
};

export const MODE_LABELS: Record<TeachingMode, string> = {
  support: 'Hỗ trợ dạy trực tiếp',
  replace: 'Thay thế dạy trực tiếp',
};

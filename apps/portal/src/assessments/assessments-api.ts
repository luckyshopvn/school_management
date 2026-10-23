import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161)
export type YearResultCode = 'excellent' | 'good' | 'completed' | 'not_completed';

export interface AssessmentLevel {
  id: string;
  scale: 'subject' | 'competency';
  code: string;
  name: string;
  rank: number;
}

export interface AssessmentPeriod {
  id: string;
  code: string;
  name: string;
  term_type: 'first_term' | 'second_term';
  kind: 'mid' | 'end';
  is_year_end: boolean;
  entry_deadline: string | null;
}

export interface CompetencyItem {
  id: string;
  group_code: 'quality' | 'general' | 'specific';
  code: string;
  name: string;
  status?: 'active' | 'inactive';
}

export interface AssessmentConfig {
  levels: AssessmentLevel[];
  items: CompetencyItem[];
  periods: AssessmentPeriod[];
  tests: Array<{ period_id: string; subject_id: string; subject_name: string; grade_level_code: string }>;
  templates: Array<{ id: string; target: string; content: string; status: string }>;
}

export interface ClassOverview {
  class: { id: string; name: string; grade_level: string };
  access: { manage: boolean; homeroom: boolean; subject_ids: string[]; competency: boolean };
  subjects: Array<{ subject_id: string; subject_code: string; subject_name: string }>;
  periods: Array<AssessmentPeriod & { deadline: string | null; locked: { locked_by_name: string } | null }>;
  levels: AssessmentLevel[];
  items: CompetencyItem[];
  templates: Array<{ id: string; target: string; content: string }>;
}

export interface SubjectSheet {
  has_test: boolean;
  can_edit: boolean;
  deadline: string | null;
  locked: { locked_by_name: string } | null;
  rows: Array<{
    child_id: string;
    full_name: string;
    result: { level_code: string | null; score: number | null; comment: string | null } | null;
  }>;
}

export interface CompetencySheet {
  can_edit: boolean;
  deadline: string | null;
  locked: { locked_by_name: string } | null;
  items: CompetencyItem[];
  rows: Array<{
    child_id: string;
    full_name: string;
    results: Array<{ item_id: string; level_code: string | null; comment: string | null }>;
  }>;
}

export interface ClassSummary {
  student_count: number;
  levels: Array<{ scale: string; code: string; name: string }>;
  subjects: Array<{
    subject_id: string;
    subject_name: string;
    by_level: Record<string, number>;
    missing: number;
    scores: Record<string, number> | null;
  }>;
  items: Array<{ id: string; name: string; by_level: Record<string, number>; missing: number }>;
}

export interface YearResults {
  can_confirm: boolean;
  locked: { locked_by_name: string } | null;
  rows: Array<{
    child_id: string;
    full_name: string;
    suggested: YearResultCode | null;
    confirmed: { result: YearResultCode; note: string | null; confirmed_by_name: string } | null;
  }>;
}

export const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export const readConfig = () => requestJson<AssessmentConfig>('/api/v1/assessment/config?school_level=TH');
export const loadDefaults = () =>
  requestJson<Record<string, number>>('/api/v1/assessment/config/defaults', {
    method: 'POST',
    body: JSON.stringify({ school_level: 'TH' }),
  });
export const updatePeriod = (periodId: string, changes: { entry_deadline: string | null }) =>
  requestJson(`/api/v1/assessment/config/periods/${periodId}`, { method: 'PATCH', body: JSON.stringify(changes) });
export const readOverview = (classId: string) => requestJson<ClassOverview>(`/api/v1/assessment/classes/${classId}`);
export const readSubjectSheet = (classId: string, subjectId: string, periodId: string) =>
  requestJson<SubjectSheet>(`/api/v1/assessment/classes/${classId}/subjects/${subjectId}?period_id=${periodId}`);
export const saveSubjectSheet = (
  classId: string,
  subjectId: string,
  periodId: string,
  entries: Array<{ child_id: string; level_code: string | null; score: number | null; comment: string | null }>,
) =>
  requestJson<SubjectSheet>(`/api/v1/assessment/classes/${classId}/subjects/${subjectId}`, {
    method: 'PUT',
    body: JSON.stringify({ period_id: periodId, entries }),
  });
export const readCompetencySheet = (classId: string, periodId: string) =>
  requestJson<CompetencySheet>(`/api/v1/assessment/classes/${classId}/competencies?period_id=${periodId}`);
export const saveCompetencySheet = (
  classId: string,
  periodId: string,
  entries: Array<{ child_id: string; item_id: string; level_code: string | null; comment: string | null }>,
) =>
  requestJson<CompetencySheet>(`/api/v1/assessment/classes/${classId}/competencies`, {
    method: 'PUT',
    body: JSON.stringify({ period_id: periodId, entries }),
  });
export const readSummary = (classId: string, periodId: string) =>
  requestJson<ClassSummary>(`/api/v1/assessment/classes/${classId}/summary?period_id=${periodId}`);
export const readYearResults = (classId: string) =>
  requestJson<YearResults>(`/api/v1/assessment/classes/${classId}/year-results`);
export const confirmYearResults = (
  classId: string,
  entries: Array<{ child_id: string; result: YearResultCode; note: string | null }>,
) =>
  requestJson<YearResults>(`/api/v1/assessment/classes/${classId}/year-results`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
export const readLocks = (periodId: string) =>
  requestJson<{
    classes: Array<{ class_id: string; class_name: string; locked_by_name: string | null; locked_at: string | null }>;
  }>(`/api/v1/assessment/locks?period_id=${periodId}`);
export const lockPeriod = (periodId: string, classIds: string[] | null) =>
  requestJson<{ locked_class_count: number }>('/api/v1/assessment/locks', {
    method: 'POST',
    body: JSON.stringify({ period_id: periodId, class_ids: classIds }),
  });
export const unlockPeriod = (periodId: string, classId: string, reason: string) =>
  requestJson('/api/v1/assessment/locks/unlock', {
    method: 'POST',
    body: JSON.stringify({ period_id: periodId, class_id: classId, reason }),
  });
export const readComments = (classId: string, from: string, to: string) =>
  requestJson<
    Array<{
      id: string;
      child_id: string;
      subject_name: string | null;
      comment_date: string;
      content: string;
      author_name: string;
    }>
  >(`/api/v1/assessment/classes/${classId}/comments?from=${from}&to=${to}`);
export const addComment = (
  classId: string,
  input: { child_id: string; subject_id: string | null; date: string; content: string },
) => requestJson(`/api/v1/assessment/classes/${classId}/comments`, { method: 'POST', body: JSON.stringify(input) });

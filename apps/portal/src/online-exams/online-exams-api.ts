import type { SchoolLevelCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Thi trực tuyến, phía giáo viên (DT-23 phần 23a, YCTD-211)
export type WindowState = 'upcoming' | 'open' | 'closed';

export interface AssignmentSummary {
  id: string;
  title: string;
  subject_name: string;
  created_by_name: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  status: 'published' | 'cancelled';
  window: WindowState;
  students: number;
  started: number;
  submitted: number;
  flagged: number;
}

export interface AttemptSummary {
  id: string;
  attempt_no: number;
  status: 'in_progress' | 'submitted';
  started_at: string;
  submitted_at: string | null;
  submit_reason: string | null;
  objective_score: number | null;
  total_score: number | null;
  max_score: number | null;
  needs_marking: boolean;
  flagged: boolean;
  flag_reasons: string[];
  camera_state: string;
  sheet_synced: boolean;
}

export interface MonitorStudent {
  child_id: string;
  full_name: string;
  class_name: string | null;
  attempts: AttemptSummary[];
  violations: number;
  event_counts: Record<string, number>;
}

export interface AssignmentDetail {
  id: string;
  exam_id: string;
  title: string;
  subject_name: string;
  school_level: string;
  status: 'published' | 'cancelled';
  window: WindowState;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  max_attempts: number;
  attempt_policy: string;
  result_mode: string;
  results_released_at: string | null;
  fullscreen_required: boolean;
  max_violations: number;
  violation_action: string;
  camera_enabled: boolean;
  camera_fallback: string;
  single_session_mode: string;
  targets: Array<{ kind: 'class' | 'student'; label: string }>;
  students: MonitorStudent[];
}

export interface AttemptDetail {
  id: string;
  assignment_id: string;
  title: string;
  full_name: string;
  attempt_no: number;
  status: string;
  variant_code: string;
  started_at: string;
  submitted_at: string | null;
  submit_reason: string | null;
  objective_score: number | null;
  essay_score: number | null;
  total_score: number | null;
  max_score: number | null;
  needs_marking: boolean;
  flagged: boolean;
  flag_reasons: string[];
  camera_state: string;
  sheet_synced: boolean;
  events: Array<{ type: string; label: string; occurred_at: string; detail: Record<string, number> }>;
  questions: Array<{
    position: number;
    number: number;
    question_id: string;
    type: string;
    content: string;
    options: Array<{ label: string; content: string }>;
    score: number;
    student_answer: string[];
    correct_answer: string[];
    guidance: string | null;
    earned: number | null;
    correct: boolean | null;
    essay_mark: number | null;
  }>;
}

export interface LevelSetting {
  school_level: SchoolLevelCode;
  student_login_enabled: boolean;
  updated_by_name: string | null;
  updated_at: string | null;
}

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const listLockedExams = (
  level: SchoolLevelCode,
): Promise<Array<{ id: string; title: string; subject_name: string; grade_level_code: string }>> =>
  requestJson(`/api/v1/online-exams/exams?school_level=${level}`);
export const listClassesForExam = (examId: string): Promise<Array<{ id: string; name: string }>> =>
  requestJson(`/api/v1/online-exams/classes?exam_id=${examId}`);
export const listAssignments = (level: SchoolLevelCode): Promise<AssignmentSummary[]> =>
  requestJson(`/api/v1/online-exams/assignments?school_level=${level}`);
export const createAssignment = (input: Record<string, unknown>): Promise<AssignmentDetail> =>
  requestJson('/api/v1/online-exams/assignments', json('POST', input));
export const readAssignment = (id: string): Promise<AssignmentDetail> =>
  requestJson(`/api/v1/online-exams/assignments/${id}`);
export const assignmentAction = (id: string, action: 'cancel' | 'release-results'): Promise<AssignmentDetail> =>
  requestJson(`/api/v1/online-exams/assignments/${id}/${action}`, json('POST', {}));
export const readAttempt = (id: string): Promise<AttemptDetail> => requestJson(`/api/v1/online-exams/attempts/${id}`);
export const markEssay = (id: string, marks: Record<string, number>): Promise<AttemptDetail> =>
  requestJson(`/api/v1/online-exams/attempts/${id}/essay-marks`, json('PUT', { marks }));
export const forceSubmit = (id: string): Promise<AttemptDetail> =>
  requestJson(`/api/v1/online-exams/attempts/${id}/force-submit`, json('POST', {}));
export const listLevelSettings = (): Promise<LevelSetting[]> => requestJson('/api/v1/online-exams/settings');
export const updateLevelSetting = (level: SchoolLevelCode, enabled: boolean): Promise<LevelSetting[]> =>
  requestJson(`/api/v1/online-exams/settings/${level}`, json('PUT', { student_login_enabled: enabled }));

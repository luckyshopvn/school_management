import type { SchoolLevelCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';
import type { CognitiveLevel, QuestionType } from '../exams/exams-api.js';

// Chấm bài kiểm tra, báo cáo kết quả (DT-21 phần 22g2, YCTD-173)
export const SESSION_STATUS_LABELS: Record<string, string> = {
  grading: 'Đang chấm',
  locked: 'Đã khoá điểm',
  transferred: 'Đã chuyển sổ điểm',
};
export const TERM_LABELS: Record<string, string> = { first_term: 'Học kỳ I', second_term: 'Học kỳ II' };
export const SCORE_KIND_LABELS: Record<string, string> = {
  regular: 'Thường xuyên',
  mid: 'Giữa kỳ',
  final: 'Cuối kỳ',
};

export interface SessionSummary {
  id: string;
  exam_id: string;
  exam_title: string;
  class_id: string;
  class_name: string;
  subject_name: string;
  term_type: string;
  score_kind: string;
  score_seq: number;
  status: string;
  created_by_name: string;
  graded: number;
  average: number | null;
}

export interface SheetRow {
  child_id: string;
  full_name: string;
  sheet: {
    variant_code: string | null;
    absent: boolean;
    answers: Record<string, string[]>;
    essay: Record<string, { first: number | null; second: number | null }>;
    objective_score: number | null;
    essay_score: number | null;
    total_score: number | null;
    needs_review: boolean;
    source: string;
  } | null;
}

export interface SessionDetail extends Omit<SessionSummary, 'graded' | 'average'> {
  subject_id: string;
  double_marking: boolean;
  mark_tolerance: number;
  true_false_rule: string;
  absent_policy: string;
  locked_by_name: string | null;
  transferred_by_name: string | null;
  total_score: number;
  variants: Array<{
    code: string;
    items: Array<{
      number: number;
      question_id: string;
      question_type: QuestionType;
      option_count: number;
      score: number;
    }>;
  }>;
  students: SheetRow[];
  blockers: { missing: string[]; review: string[]; incomplete: string[] };
}

export interface GroupRate {
  key: string;
  label?: string;
  questions: number;
  max: number;
  rate: number;
}

export interface ExamReport {
  exam: { id: string; title: string; subject_name: string; grade_level_code: string };
  papers: number;
  average: number | null;
  questions: Array<{
    number: number;
    question_id: string;
    content: string;
    question_type: QuestionType;
    cognitive_level: CognitiveLevel;
    topic_name: string | null;
    score: number;
    attempts: number;
    difficulty: number;
    discrimination: number | null;
    review: boolean;
  }>;
  review: ExamReport['questions'];
  topics: GroupRate[];
  levels: GroupRate[];
  classes: Array<{
    class_id: string;
    class_name: string;
    teacher: string;
    papers: number;
    average: number;
    min: number;
    max: number;
    pass_rate: number;
  }>;
  distribution: number[];
}

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const lockedExams = (
  level: SchoolLevelCode,
): Promise<Array<{ id: string; title: string; subject_name: string; grade_level_code: string }>> =>
  requestJson(`/api/v1/exam-grading/exams?school_level=${level}`);
export const classesForExam = (examId: string): Promise<Array<{ id: string; name: string }>> =>
  requestJson(`/api/v1/exam-grading/classes?exam_id=${examId}`);
export const listSessions = (level: SchoolLevelCode): Promise<SessionSummary[]> =>
  requestJson(`/api/v1/exam-grading/sessions?school_level=${level}`);
export const createSession = (input: Record<string, unknown>): Promise<SessionDetail> =>
  requestJson('/api/v1/exam-grading/sessions', json('POST', input));
export const readSession = (id: string): Promise<SessionDetail> => requestJson(`/api/v1/exam-grading/sessions/${id}`);
export const saveSheet = (id: string, childId: string, body: unknown): Promise<SessionDetail> =>
  requestJson(`/api/v1/exam-grading/sessions/${id}/sheets/${childId}`, json('PUT', body));
export const sessionAction = (
  id: string,
  action: 'lock' | 'unlock' | 'transfer',
  body?: unknown,
): Promise<SessionDetail & { written?: number }> =>
  requestJson(`/api/v1/exam-grading/sessions/${id}/${action}`, json('POST', body ?? {}));
export const importSheets = (
  id: string,
  file: File,
): Promise<{ imported: number; errors: Array<{ row: number; column: string | null; message: string }> }> => {
  const form = new FormData();
  form.set('file', file);
  return requestJson(`/api/v1/exam-grading/sessions/${id}/import`, { method: 'POST', body: form });
};
export const readReport = (examId: string, classId?: string): Promise<ExamReport> =>
  requestJson(`/api/v1/exam-grading/reports/${examId}${classId ? `?class_id=${classId}` : ''}`);

// Ô đáp án nhập tay giống tệp quét: B hoặc AB; ĐSĐĐ hoặc Đ,S,Đ,Đ; trả lời ngắn là cả ô
export function parseAnswer(type: QuestionType, text: string): string[] {
  const value = text.trim();
  if (value === '') return [];
  if (type === 'short_answer') return [value];
  const parts = /[,;\s]/.test(value) ? value.split(/[,;\s]+/) : [...value];
  return parts.map((part) => part.trim().toUpperCase()).filter(Boolean);
}

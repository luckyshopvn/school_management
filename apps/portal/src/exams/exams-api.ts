import type { SchoolLevelCode } from '@school-management/shared';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168): ngân hàng câu hỏi, chủ đề, ma trận, kế hoạch kiểm tra, đề
export type CognitiveLevel = 'recognition' | 'comprehension' | 'application' | 'high_application';
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

export const COGNITIVE_LABELS: Record<CognitiveLevel, string> = {
  recognition: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
  high_application: 'Vận dụng cao',
};
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Nhiều lựa chọn',
  true_false: 'Đúng sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
};
export const QUESTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  review: 'Chờ thẩm định',
  approved: 'Dùng được',
  retired: 'Ngừng dùng',
};
export const EXAM_STATUS_LABELS: Record<string, string> = {
  draft: 'Đang soạn',
  submitted: 'Chờ thẩm định',
  approved: 'Đã thẩm định',
  locked: 'Đã khoá',
};
export const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Trả lại',
};
export const PLAN_KIND_LABELS: Record<string, string> = {
  regular: 'Thường xuyên',
  midterm: 'Giữa kỳ',
  final: 'Cuối kỳ',
};
export const PLAN_FORM_LABELS: Record<string, string> = {
  written: 'Tự luận',
  multiple_choice: 'Trắc nghiệm',
  mixed: 'Trắc nghiệm và tự luận',
  practical: 'Thực hành',
  oral: 'Vấn đáp',
};

export interface Topic {
  id: string;
  subject_id: string;
  grade_level_code: string | null;
  name: string;
}

export interface Question {
  id: string;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  topic_id: string | null;
  topic_name: string | null;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  content: string;
  options: Array<{ key: string; content: string }>;
  answer: string[];
  guidance: string | null;
  score: string;
  status: string;
  review_note: string | null;
  author_user_id: string;
  author_name: string;
  use_count: number;
}

export interface MatrixRow {
  topic_id: string | null;
  topic_name: string;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  count: number;
  score_each: number;
  requirement?: string | null;
}

export interface Matrix {
  id: string;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  name: string;
  total_score: number;
  target_ratios: Record<CognitiveLevel, number>;
  tolerance: number;
  rows: MatrixRow[];
  summary: { count: number; score: number; ratios: Record<CognitiveLevel, number> };
  issues: Array<{ code: string; message: string }>;
}

export interface Plan {
  id: string;
  term: 'HK1' | 'HK2';
  grade_level_code: string;
  subject_id: string;
  subject_name: string;
  kind: string;
  form: string;
  duration_minutes: number;
  planned_date: string | null;
  status: string;
  review_note: string | null;
  exam_count: number;
  locked_count: number;
  timetable_note: string | null;
}

export interface ExamSummary {
  id: string;
  title: string;
  subject_name: string;
  grade_level_code: string;
  status: string;
  author_user_id: string;
  author_name: string;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  due_date: string | null;
  overdue: boolean;
}

export interface ExamDetail extends ExamSummary {
  subject_id: string;
  matrix_id: string | null;
  variant_count: number;
  duration_minutes: number;
  review_note: string | null;
  matrix: { id: string; name: string; issues: Array<{ message: string }> } | null;
  questions: Array<{
    question_id: string;
    order_no: number;
    score: number;
    snapshot: {
      content: string;
      question_type: QuestionType;
      cognitive_level: CognitiveLevel;
      topic_name: string | null;
      options: Array<{ key: string; content: string }>;
      answer: string[];
    };
  }>;
  total_score: number;
  variants: Array<{ code: string; answers: Array<{ number: number; answer: string[] }> }>;
}

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const query = (values: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(values).filter(([, value]) => value) as Array<[string, string]>).toString();

export const listSubjects = (level: SchoolLevelCode): Promise<Array<{ id: string; code: string; name: string }>> =>
  requestJson(`/api/v1/subjects?school_level=${level}`);
export const listGrades = (level: SchoolLevelCode): Promise<Array<{ code: string; name: string }>> =>
  requestJson(`/api/v1/grade-levels?school_level=${level}&status=active`);
export const listTopics = (subjectId: string): Promise<Topic[]> =>
  requestJson(`/api/v1/question-topics?subject_id=${subjectId}`);
export const createTopic = (input: { subject_id: string; grade_level_code: string | null; name: string }) =>
  requestJson('/api/v1/question-topics', json('POST', input));

export const listQuestions = (filter: Record<string, string | undefined>): Promise<Question[]> =>
  requestJson(`/api/v1/questions?${query(filter)}`);
export const saveQuestion = (id: string | null, input: Record<string, unknown>): Promise<Question> =>
  requestJson(id ? `/api/v1/questions/${id}` : '/api/v1/questions', json(id ? 'PUT' : 'POST', input));
export const questionAction = (id: string, action: 'submit' | 'review' | 'retire', body?: unknown): Promise<Question> =>
  requestJson(`/api/v1/questions/${id}/${action}`, json('POST', body));
export const questionStats = (
  subjectId: string,
  grade: string,
): Promise<
  Array<{ topic_name: string | null; cognitive_level: CognitiveLevel; question_type: QuestionType; count: number }>
> => requestJson(`/api/v1/questions/stats?subject_id=${subjectId}&grade_level_code=${grade}`);
export const importQuestions = (
  level: SchoolLevelCode,
  file: File,
): Promise<{ imported: number; errors: Array<{ row: number; column: string | null; message: string }> }> => {
  const form = new FormData();
  form.set('file', file);
  return requestJson(`/api/v1/questions/import?school_level=${level}`, { method: 'POST', body: form });
};

export async function downloadFile(path: string, fileName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không tải được tệp');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export const listMatrices = (level: SchoolLevelCode): Promise<Matrix[]> =>
  requestJson(`/api/v1/exam-matrices?school_level=${level}`);
export const saveMatrix = (id: string | null, input: Record<string, unknown>): Promise<Matrix> =>
  requestJson(id ? `/api/v1/exam-matrices/${id}` : '/api/v1/exam-matrices', json(id ? 'PUT' : 'POST', input));

export const listPlans = (level: SchoolLevelCode): Promise<Plan[]> =>
  requestJson(`/api/v1/assessment-plans?school_level=${level}`);
export const createPlan = (input: Record<string, unknown>): Promise<Plan> =>
  requestJson('/api/v1/assessment-plans', json('POST', input));
export const planAction = (id: string, action: 'submit' | 'decide', body?: unknown): Promise<Plan> =>
  requestJson(`/api/v1/assessment-plans/${id}/${action}`, json('POST', body));

export const listExams = (level: SchoolLevelCode): Promise<ExamSummary[]> =>
  requestJson(`/api/v1/exams?school_level=${level}`);
export const listStaff = (): Promise<Array<{ user_id: string; name: string }>> => requestJson('/api/v1/exams/staff');
export const createExam = (input: Record<string, unknown>): Promise<ExamDetail> =>
  requestJson('/api/v1/exams', json('POST', input));
export const readExam = (id: string): Promise<ExamDetail> => requestJson(`/api/v1/exams/${id}`);
export const examAction = (
  id: string,
  action: 'generate' | 'variants' | 'submit' | 'review' | 'lock' | 'unlock' | 'questions',
  body?: unknown,
): Promise<ExamDetail> => requestJson(`/api/v1/exams/${id}/${action}`, json('POST', body ?? {}));
export const removeExamQuestion = (id: string, questionId: string): Promise<ExamDetail> =>
  requestJson(`/api/v1/exams/${id}/questions/${questionId}`, json('DELETE'));

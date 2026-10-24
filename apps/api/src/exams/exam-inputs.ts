import { validationError, type FieldError } from '@school-management/server';
import { isSchoolLevelCode, type SchoolLevelCode } from '@school-management/shared';
import {
  isUuid,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import {
  COGNITIVE_LEVELS,
  DEFAULT_RATIOS,
  OPTION_KEYS,
  QUESTION_TYPES,
  type CognitiveLevel,
  type MatrixRow,
  type QuestionType,
} from './exam-rules.js';

// Đọc, kiểm tra dữ liệu gửi lên của kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168). Câu hỏi theo dạng:
// - nhiều lựa chọn: 2 đến 6 lựa chọn A, B, ...; đáp án là các khoá đúng (ít nhất một);
// - đúng sai: 2 đến 6 ý a, b, ...; đáp án là Đ hoặc S của từng ý theo thứ tự;
// - trả lời ngắn: không có lựa chọn; đáp án là một hoặc vài đáp số chấp nhận;
// - tự luận: không có lựa chọn, không có đáp án; có hướng dẫn chấm.
export const TRUE_FALSE_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
export const TRUE_FALSE_VALUES = ['Đ', 'S'];

export interface QuestionOption {
  key: string;
  content: string;
}

export interface QuestionInput {
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  topic_id: string | null;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  content: string;
  options: QuestionOption[];
  answer: string[];
  guidance: string | null;
  score: number;
}

function readLevel(body: RequestBody, errors: FieldError[]): SchoolLevelCode {
  const value = body?.school_level;
  if (!isSchoolLevelCode(value) || value === 'MN') {
    errors.push({ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' });
    return 'THCS';
  }
  return value;
}

function readChoice<T extends string>(body: RequestBody, field: string, choices: readonly T[], errors: FieldError[]) {
  const value = body?.[field];
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) {
    errors.push({ field, message: `Giá trị là ${choices.join(', ')}` });
    return choices[0] as T;
  }
  return value as T;
}

function readScore(body: RequestBody, field: string, errors: FieldError[], max: number, fallback: number): number {
  const value = body?.[field];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    errors.push({ field, message: `Điểm là số lớn hơn 0, không quá ${max}` });
    return fallback;
  }
  return Math.round(value * 100) / 100;
}

function readTextList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null;
  }
  return (value as string[]).map((item) => item.trim());
}

export function parseQuestion(body: RequestBody): QuestionInput {
  const errors: FieldError[] = [];
  const questionType = readChoice(body, 'question_type', QUESTION_TYPES, errors);
  const input: QuestionInput = {
    school_level: readLevel(body, errors),
    subject_id: readRequiredUuid(body, 'subject_id', errors, 'Bắt buộc chọn môn'),
    grade_level_code: readRequiredText(body, 'grade_level_code', errors),
    topic_id: readOptionalUuid(body, 'topic_id', errors) ?? null,
    cognitive_level: readChoice(body, 'cognitive_level', COGNITIVE_LEVELS, errors),
    question_type: questionType,
    content: readRequiredText(body, 'content', errors),
    options: [],
    answer: [],
    guidance: readOptionalText(body, 'guidance', errors) ?? null,
    score: readScore(body, 'score', errors, 10, 1),
  };
  if (input.content.length > 10000) {
    errors.push({ field: 'content', message: 'Nội dung tối đa 10.000 ký tự' });
  }
  const contents = readTextList(body?.options) ?? [];
  const answer = readTextList(body?.answer) ?? [];
  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    const keys = questionType === 'multiple_choice' ? OPTION_KEYS : TRUE_FALSE_KEYS;
    if (contents.length < 2 || contents.length > keys.length || contents.some((content) => !content)) {
      errors.push({ field: 'options', message: `Cần 2 đến ${keys.length} lựa chọn, không để trống` });
    }
    input.options = contents.map((content, index) => ({ key: keys[index] as string, content }));
    if (questionType === 'multiple_choice') {
      const valid = OPTION_KEYS.slice(0, contents.length);
      const unique = [...new Set(answer.map((key) => key.toUpperCase()))].sort();
      if (unique.length === 0 || unique.some((key) => !valid.includes(key))) {
        errors.push({ field: 'answer', message: `Đáp án là một hoặc vài khoá trong ${valid.join(', ')}` });
      }
      input.answer = unique;
    } else {
      if (answer.length !== contents.length || answer.some((value) => !TRUE_FALSE_VALUES.includes(value))) {
        errors.push({ field: 'answer', message: 'Đáp án là Đ hoặc S cho từng ý theo thứ tự' });
      }
      input.answer = answer;
    }
  } else if (questionType === 'short_answer') {
    if (answer.length === 0 || answer.some((value) => !value)) {
      errors.push({ field: 'answer', message: 'Cần ít nhất một đáp số chấp nhận' });
    }
    input.answer = answer.filter(Boolean);
  } else if (!input.guidance) {
    errors.push({ field: 'guidance', message: 'Câu tự luận cần hướng dẫn chấm' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export interface MatrixInputBody {
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  name: string;
  total_score: number;
  target_ratios: Record<CognitiveLevel, number>;
  tolerance: number;
  rows: MatrixRow[];
}

export function parseMatrix(body: RequestBody): MatrixInputBody {
  const errors: FieldError[] = [];
  const rawRatios = (
    typeof body?.target_ratios === 'object' && body.target_ratios !== null ? body.target_ratios : {}
  ) as Record<string, unknown>;
  const ratios = { ...DEFAULT_RATIOS };
  for (const level of COGNITIVE_LEVELS) {
    const value = rawRatios[level];
    if (value === undefined) continue;
    if (typeof value !== 'number' || value < 0 || value > 100) {
      errors.push({ field: `target_ratios.${level}`, message: 'Tỉ lệ từ 0 đến 100' });
    } else {
      ratios[level] = value;
    }
  }
  if (
    body?.target_ratios !== undefined &&
    Math.abs(COGNITIVE_LEVELS.reduce((sum, level) => sum + ratios[level], 0) - 100) > 0.001
  ) {
    errors.push({ field: 'target_ratios', message: 'Tổng tỉ lệ các mức là 100' });
  }
  const rawRows = Array.isArray(body?.rows) ? (body.rows as unknown[]) : null;
  if (!rawRows) {
    errors.push({ field: 'rows', message: 'Cần danh sách dòng của ma trận' });
  }
  const rows: MatrixRow[] = (rawRows ?? []).map((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const prefix = `rows[${index}]`;
    const count = item.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100) {
      errors.push({ field: `${prefix}.count`, message: 'Số câu là số nguyên từ 0 đến 100' });
    }
    const scoreEach = item.score_each;
    if (typeof scoreEach !== 'number' || !(scoreEach > 0) || scoreEach > 10) {
      errors.push({ field: `${prefix}.score_each`, message: 'Điểm mỗi câu lớn hơn 0, không quá 10' });
    }
    if (item.topic_id !== null && item.topic_id !== undefined && !isUuid(item.topic_id)) {
      errors.push({ field: `${prefix}.topic_id`, message: 'Mã chủ đề không hợp lệ' });
    }
    const level = item.cognitive_level;
    const type = item.question_type;
    if (!(COGNITIVE_LEVELS as readonly unknown[]).includes(level)) {
      errors.push({ field: `${prefix}.cognitive_level`, message: 'Mức nhận thức không hợp lệ' });
    }
    if (!(QUESTION_TYPES as readonly unknown[]).includes(type)) {
      errors.push({ field: `${prefix}.question_type`, message: 'Dạng câu hỏi không hợp lệ' });
    }
    return {
      topic_id: (item.topic_id as string | null | undefined) ?? null,
      topic_name: typeof item.topic_name === 'string' ? item.topic_name.trim() : '',
      cognitive_level: level as CognitiveLevel,
      question_type: type as QuestionType,
      count: count as number,
      score_each: Math.round(((scoreEach as number) ?? 0) * 100) / 100,
      requirement: typeof item.requirement === 'string' && item.requirement.trim() ? item.requirement.trim() : null,
    };
  });
  const input: MatrixInputBody = {
    school_level: readLevel(body, errors),
    subject_id: readRequiredUuid(body, 'subject_id', errors, 'Bắt buộc chọn môn'),
    grade_level_code: readRequiredText(body, 'grade_level_code', errors),
    name: readRequiredText(body, 'name', errors),
    total_score: readScore(body, 'total_score', errors, 100, 10),
    target_ratios: ratios,
    tolerance: readInteger(body, 'tolerance', errors, { min: 0, max: 50 }) ?? 5,
    rows,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export const PLAN_KINDS = ['regular', 'midterm', 'final'] as const;
export const PLAN_FORMS = ['written', 'multiple_choice', 'mixed', 'practical', 'oral'] as const;

export interface PlanInput {
  school_level: SchoolLevelCode;
  term: 'HK1' | 'HK2';
  grade_level_code: string;
  subject_id: string;
  kind: (typeof PLAN_KINDS)[number];
  form: (typeof PLAN_FORMS)[number];
  duration_minutes: number;
  planned_date: string | null;
  note: string | null;
}

export function readDate(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

export function parsePlan(body: RequestBody): PlanInput {
  const errors: FieldError[] = [];
  const input: PlanInput = {
    school_level: readLevel(body, errors),
    term: readChoice(body, 'term', ['HK1', 'HK2'] as const, errors),
    grade_level_code: readRequiredText(body, 'grade_level_code', errors),
    subject_id: readRequiredUuid(body, 'subject_id', errors, 'Bắt buộc chọn môn'),
    kind: readChoice(body, 'kind', PLAN_KINDS, errors),
    form: readChoice(body, 'form', PLAN_FORMS, errors),
    duration_minutes: readInteger(body, 'duration_minutes', errors, { min: 5, max: 300 }) ?? 45,
    planned_date: readDate(body, 'planned_date', errors),
    note: readOptionalText(body, 'note', errors) ?? null,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export interface ExamInput {
  plan_id: string | null;
  matrix_id: string | null;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  title: string;
  duration_minutes: number;
  variant_count: number;
  avoid_recent_days: number;
  author_user_id: string;
  reviewer_user_id: string | null;
  due_date: string | null;
}

export function parseExam(body: RequestBody): ExamInput {
  const errors: FieldError[] = [];
  const input: ExamInput = {
    plan_id: readOptionalUuid(body, 'plan_id', errors) ?? null,
    matrix_id: readOptionalUuid(body, 'matrix_id', errors) ?? null,
    school_level: readLevel(body, errors),
    subject_id: readRequiredUuid(body, 'subject_id', errors, 'Bắt buộc chọn môn'),
    grade_level_code: readRequiredText(body, 'grade_level_code', errors),
    title: readRequiredText(body, 'title', errors),
    duration_minutes: readInteger(body, 'duration_minutes', errors, { min: 5, max: 300 }) ?? 45,
    variant_count: readInteger(body, 'variant_count', errors, { min: 1, max: 24 }) ?? 4,
    avoid_recent_days: readInteger(body, 'avoid_recent_days', errors, { min: 0, max: 3650 }) ?? 0,
    author_user_id: readRequiredUuid(body, 'author_user_id', errors, 'Bắt buộc chọn người ra đề'),
    reviewer_user_id: readOptionalUuid(body, 'reviewer_user_id', errors) ?? null,
    due_date: readDate(body, 'due_date', errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export function readDecision(body: RequestBody): { approve: boolean; note: string | null } {
  const errors: FieldError[] = [];
  const decision = body?.decision;
  if (decision !== 'approve' && decision !== 'return') {
    errors.push({ field: 'decision', message: 'Quyết định là approve (duyệt) hoặc return (trả lại)' });
  }
  const note = readOptionalText(body, 'note', errors) ?? null;
  if (decision === 'return' && !note) {
    errors.push({ field: 'note', message: 'Trả lại cần ghi lý do' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { approve: decision === 'approve', note };
}

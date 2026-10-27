import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import type { AssignmentGrading, AssignmentItemKind } from '@school-management/database';
import { gradeObjective, roundScore, type TrueFalseRule } from '../../exam-grading/grading-rules.js';
import { isUuid, type RequestBody } from '../../common/request-fields.js';
import type { QuestionSnapshot } from '../../exams/exams.js';
import type { RubricCriterion, RubricLevel } from '../../learning-resources/resource-sharing-rules.js';
import type { CompletionRule, ResultStatus } from '../learning-rules.js';

// Quy tắc thuần của bài tập trực tuyến (DT-28 phần 28c, YCTD-273; tài liệu 32 mục 20.7). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11, ghi ở YCTD-273:
// - Điểm của bài là thang 10: tổng điểm các câu (trắc nghiệm máy chấm, tự luận, ảnh, tệp, ghi âm giáo viên chấm) quy về 10 theo
//   tổng điểm tối đa của phiên bản; chấm theo thang tiêu chí thì quy tổng mức đã chọn về 10 theo điểm tối đa của thang (22h2).
// - Nộp muộn (GD-147): mặc định cho nộp đến khi giáo viên đóng bài, đánh dấu muộn, không tự trừ điểm; giáo viên chọn "chặn"
//   thì hết hạn là không nộp được.
// - Phiên bản bài: đích học sinh ưu tiên hơn đích nhóm, nhóm hơn lớp; danh sách học sinh nhận bài chốt khi phát hành.
// - Bài nhóm: mỗi học sinh nhận bài phải có đúng một nhóm trong bộ nhóm của bài; điểm cá nhân là điểm của nhóm trừ khi giáo viên
//   điều chỉnh có lý do.
export const ASSIGNMENT_RULE_CODE = 'YCTD-273';
export const MAX_ITEMS = 50;
export const MAX_VARIANTS = 6;
export const MAX_PROMPT = 5000;
export const MAX_ANSWER_TEXT = 10_000;
export const MAX_FEEDBACK = 4000;

// Giới hạn tệp mỗi bài nộp (GD-150, Claude tự chọn): 10 ảnh, tổng 20 MB, tài liệu 10 MB mỗi tệp, ghi âm 5 phút (máy học sinh
// dừng ghi ở 5 phút; máy chủ chặn tệp ghi âm quá 6 MB). Trường đổi được ở cấu hình `assignment_upload_limits`
export interface UploadLimits {
  max_images: number;
  max_total_bytes: number;
  max_document_bytes: number;
  max_audio_bytes: number;
  max_audio_seconds: number;
}
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  max_images: 10,
  max_total_bytes: 20 * 1024 * 1024,
  max_document_bytes: 10 * 1024 * 1024,
  max_audio_bytes: 6 * 1024 * 1024,
  max_audio_seconds: 300,
};

export function uploadLimitsOf(value: unknown): UploadLimits {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pick = (key: keyof UploadLimits) => {
    const candidate = raw[key];
    return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0
      ? Math.min(candidate, DEFAULT_UPLOAD_LIMITS[key] * 5)
      : DEFAULT_UPLOAD_LIMITS[key];
  };
  return {
    max_images: pick('max_images'),
    max_total_bytes: pick('max_total_bytes'),
    max_document_bytes: pick('max_document_bytes'),
    max_audio_bytes: pick('max_audio_bytes'),
    max_audio_seconds: pick('max_audio_seconds'),
  };
}

export function assignmentRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(ASSIGNMENT_RULE_CODE, message, fields);
}

// ---------- Đọc dữ liệu soạn bài

export interface VariantInput {
  code: string;
  name: string;
}

export interface ItemInput {
  variant_code: string | null;
  kind: AssignmentItemKind;
  question_id: string | null;
  resource_id: string | null;
  prompt: string | null;
  score: number;
}

export interface TargetInput {
  kind: 'class' | 'group' | 'child';
  group_id: string | null;
  child_id: string | null;
  variant_code: string | null;
}

export interface AssignmentInput {
  context: 'in_class' | 'homework';
  work_mode: 'individual' | 'group';
  group_set_id: string | null;
  late_policy: 'allow' | 'block';
  max_attempts: number;
  grading: AssignmentGrading;
  rubric_id: string | null;
  show_results: 'after_submit' | 'after_return';
  estimated_minutes: number | null;
  variants: VariantInput[];
  items: ItemInput[];
  targets: TargetInput[];
}

const ITEM_KINDS: readonly AssignmentItemKind[] = ['question', 'essay', 'upload', 'audio', 'resource'];
const GRADINGS: readonly AssignmentGrading[] = ['score', 'rubric', 'level', 'completion', 'none'];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | null {
  if (value === undefined || value === null) {
    return fallback;
  }
  return allowed.includes(value as T) ? (value as T) : null;
}

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, maximum + 1);
}

export function parseAssignmentInput(body: RequestBody): AssignmentInput {
  const errors: FieldError[] = [];
  const context = oneOf(body?.context, ['in_class', 'homework'] as const, 'in_class');
  if (!context) errors.push({ field: 'context', message: 'Ngữ cảnh là in_class (trên lớp) hoặc homework (về nhà)' });
  const workMode = oneOf(body?.work_mode, ['individual', 'group'] as const, 'individual');
  if (!workMode) errors.push({ field: 'work_mode', message: 'Cách làm là individual (cá nhân) hoặc group (nhóm)' });
  const groupSetId = isUuid(body?.group_set_id) ? body.group_set_id : null;
  if (workMode === 'group' && !groupSetId) {
    errors.push({ field: 'group_set_id', message: 'Bài nhóm phải chọn bộ nhóm của lớp' });
  }
  const latePolicy = oneOf(body?.late_policy, ['allow', 'block'] as const, 'allow');
  if (!latePolicy)
    errors.push({ field: 'late_policy', message: 'Nộp muộn là allow (cho, đánh dấu muộn) hoặc block (chặn)' });
  const attempts = body?.max_attempts ?? 1;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    errors.push({ field: 'max_attempts', message: 'Số lần nộp từ 1 đến 5' });
  }
  const grading = oneOf(body?.grading, GRADINGS, 'score');
  if (!grading) errors.push({ field: 'grading', message: 'Cách chấm là score, rubric, level, completion hoặc none' });
  const rubricId = isUuid(body?.rubric_id) ? body.rubric_id : null;
  if (grading === 'rubric' && !rubricId) {
    errors.push({ field: 'rubric_id', message: 'Chấm theo thang tiêu chí phải chọn một thang tiêu chí' });
  }
  const showResults = oneOf(body?.show_results, ['after_submit', 'after_return'] as const, 'after_return');
  if (!showResults)
    errors.push({ field: 'show_results', message: 'Hiện kết quả trắc nghiệm after_submit hoặc after_return' });
  const minutes = body?.estimated_minutes ?? null;
  if (minutes !== null && (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
    errors.push({ field: 'estimated_minutes', message: 'Thời lượng dự kiến từ 1 đến 600 phút' });
  }

  const variants: VariantInput[] = [];
  const rawVariants = Array.isArray(body?.variants) ? (body.variants as unknown[]) : [];
  if (rawVariants.length > MAX_VARIANTS) {
    errors.push({ field: 'variants', message: `Tối đa ${MAX_VARIANTS} phiên bản bài` });
  }
  rawVariants.slice(0, MAX_VARIANTS).forEach((raw, index) => {
    const variant = (raw ?? {}) as Record<string, unknown>;
    const code = typeof variant.code === 'string' ? variant.code.trim().toUpperCase() : '';
    const name = text(variant.name, 120);
    if (!/^[A-Z]$/.test(code) || variants.some((other) => other.code === code)) {
      errors.push({ field: `variants.${index}.code`, message: 'Mã phiên bản là một chữ cái in hoa, không trùng' });
    }
    if (!name || name.length > 120) {
      errors.push({ field: `variants.${index}.name`, message: 'Tên phiên bản từ 1 đến 120 ký tự' });
    }
    variants.push({ code, name: name ?? '' });
  });
  const codes = new Set(variants.map((variant) => variant.code));
  const variantOf = (value: unknown, field: string) => {
    if (value === undefined || value === null || value === '') return null;
    const code = String(value).toUpperCase();
    if (!codes.has(code)) {
      errors.push({ field, message: 'Phiên bản không có trong bài' });
      return null;
    }
    return code;
  };

  const items: ItemInput[] = [];
  const rawItems = Array.isArray(body?.items) ? (body.items as unknown[]) : [];
  if (rawItems.length === 0) {
    errors.push({ field: 'items', message: 'Bài tập có ít nhất một câu hoặc yêu cầu' });
  }
  if (rawItems.length > MAX_ITEMS) {
    errors.push({ field: 'items', message: `Tối đa ${MAX_ITEMS} câu` });
  }
  rawItems.slice(0, MAX_ITEMS).forEach((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const field = `items.${index}`;
    const kind = ITEM_KINDS.includes(item.kind as AssignmentItemKind) ? (item.kind as AssignmentItemKind) : null;
    if (!kind) {
      errors.push({ field: `${field}.kind`, message: 'Loại câu là question, essay, upload, audio hoặc resource' });
      return;
    }
    const questionId = isUuid(item.question_id) ? item.question_id : null;
    const resourceId = isUuid(item.resource_id) ? item.resource_id : null;
    const prompt = text(item.prompt, MAX_PROMPT);
    if (kind === 'question' && !questionId) {
      errors.push({ field: `${field}.question_id`, message: 'Chọn câu hỏi đã duyệt của ngân hàng câu hỏi' });
    }
    if (kind === 'resource' && !resourceId) {
      errors.push({ field: `${field}.resource_id`, message: 'Chọn học liệu đã công bố' });
    }
    if (['essay', 'upload', 'audio'].includes(kind) && !prompt) {
      errors.push({ field: `${field}.prompt`, message: 'Nhập yêu cầu của câu' });
    }
    if (prompt && prompt.length > MAX_PROMPT) {
      errors.push({ field: `${field}.prompt`, message: `Yêu cầu tối đa ${MAX_PROMPT} ký tự` });
    }
    const score = item.score ?? (kind === 'resource' ? 0 : 1);
    if (typeof score !== 'number' || score < 0 || score > 10 || Math.round(score * 100) !== score * 100) {
      errors.push({ field: `${field}.score`, message: 'Điểm câu từ 0 đến 10, tối đa hai chữ số thập phân' });
    }
    items.push({
      variant_code: variantOf(item.variant_code, `${field}.variant_code`),
      kind,
      question_id: kind === 'question' ? questionId : null,
      resource_id: kind === 'resource' ? resourceId : null,
      prompt,
      score: typeof score === 'number' ? score : 0,
    });
  });

  const targets: TargetInput[] = [];
  const rawTargets = Array.isArray(body?.targets) ? (body.targets as unknown[]) : [{ kind: 'class' }];
  if (rawTargets.length === 0) {
    errors.push({ field: 'targets', message: 'Chọn lớp, nhóm hoặc học sinh nhận bài' });
  }
  rawTargets.slice(0, 200).forEach((raw, index) => {
    const target = (raw ?? {}) as Record<string, unknown>;
    const field = `targets.${index}`;
    const kind = ['class', 'group', 'child'].includes(target.kind as string)
      ? (target.kind as TargetInput['kind'])
      : null;
    if (!kind) {
      errors.push({ field: `${field}.kind`, message: 'Đích giao là class, group hoặc child' });
      return;
    }
    const groupId = isUuid(target.group_id) ? target.group_id : null;
    const childId = isUuid(target.child_id) ? target.child_id : null;
    if (kind === 'group' && !groupId) errors.push({ field: `${field}.group_id`, message: 'Chọn nhóm' });
    if (kind === 'child' && !childId) errors.push({ field: `${field}.child_id`, message: 'Chọn học sinh' });
    targets.push({
      kind,
      group_id: kind === 'group' ? groupId : null,
      child_id: kind === 'child' ? childId : null,
      variant_code: variantOf(target.variant_code, `${field}.variant_code`),
    });
  });
  const scored = (list: ItemInput[]) =>
    list.reduce((sum, item) => sum + (item.kind === 'resource' ? 0 : item.score), 0);
  if (grading === 'score') {
    const lists =
      variants.length > 0
        ? variants.map((variant) =>
            items.filter((item) => item.variant_code === variant.code || item.variant_code === null),
          )
        : [items];
    if (lists.some((list) => scored(list) <= 0)) {
      errors.push({ field: 'items', message: 'Chấm điểm thì mỗi phiên bản phải có câu có điểm' });
    }
  }
  if (variants.length > 0) {
    for (const variant of variants) {
      const own = items.filter((item) => item.variant_code === variant.code || item.variant_code === null);
      if (own.every((item) => item.kind === 'resource')) {
        errors.push({ field: 'items', message: `Phiên bản ${variant.code} chưa có câu nào để làm` });
      }
    }
  } else if (items.some((item) => item.variant_code !== null)) {
    errors.push({ field: 'items', message: 'Bài chưa có phiên bản, câu không gắn phiên bản' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    context: context ?? 'in_class',
    work_mode: workMode ?? 'individual',
    group_set_id: workMode === 'group' ? groupSetId : null,
    late_policy: latePolicy ?? 'allow',
    max_attempts: attempts as number,
    grading: grading ?? 'score',
    rubric_id: grading === 'rubric' ? rubricId : null,
    show_results: showResults ?? 'after_return',
    estimated_minutes: minutes as number | null,
    variants,
    items,
    targets,
  };
}

// ---------- Chốt danh sách nhận bài

export interface ResolvedRecipient {
  child_id: string;
  group_id: string | null;
  variant_code: string | null;
}

// Học sinh nhận bài từ các đích (chỉ học sinh của lớp học trực tuyến); phiên bản theo đích cụ thể nhất. Bài nhóm gắn nhóm của
// em trong bộ nhóm của bài; em chưa có nhóm được liệt kê để giáo viên xếp trước khi phát hành
export function resolveRecipients(input: {
  targets: TargetInput[];
  students: string[];
  groupMembers: Map<string, string[]>;
  workGroups: Map<string, string> | null;
}): { recipients: ResolvedRecipient[]; withoutGroup: string[]; outside: string[] } {
  const students = new Set(input.students);
  const chosen = new Map<string, { rank: number; variant: string | null }>();
  const outside: string[] = [];
  const offer = (childId: string, rank: number, variant: string | null) => {
    if (!students.has(childId)) {
      outside.push(childId);
      return;
    }
    const current = chosen.get(childId);
    if (!current || rank > current.rank || (rank === current.rank && current.variant === null)) {
      chosen.set(childId, { rank, variant });
    }
  };
  for (const target of input.targets) {
    if (target.kind === 'class') {
      input.students.forEach((childId) => offer(childId, 1, target.variant_code));
    } else if (target.kind === 'group') {
      (input.groupMembers.get(target.group_id ?? '') ?? []).forEach((childId) =>
        offer(childId, 2, target.variant_code),
      );
    } else if (target.child_id) {
      offer(target.child_id, 3, target.variant_code);
    }
  }
  const recipients: ResolvedRecipient[] = [];
  const withoutGroup: string[] = [];
  for (const childId of input.students) {
    const pick = chosen.get(childId);
    if (!pick) continue;
    const groupId = input.workGroups ? (input.workGroups.get(childId) ?? null) : null;
    if (input.workGroups && !groupId) {
      withoutGroup.push(childId);
      continue;
    }
    recipients.push({ child_id: childId, group_id: groupId, variant_code: pick.variant });
  }
  return { recipients, withoutGroup, outside: [...new Set(outside)] };
}

// ---------- Nộp bài

export interface SubmitWindow {
  now: Date;
  dueAt: Date | null;
  closedAt: Date | null;
  latePolicy: 'allow' | 'block';
  attemptsUsed: number;
  maxAttempts: number;
  excused: boolean;
}

// Có nộp được không và nộp có muộn không; lý do bằng lời cho học sinh
export function submitCheck(window: SubmitWindow): { allowed: boolean; late: boolean; reason: string | null } {
  if (window.excused) {
    return { allowed: false, late: false, reason: 'Em được miễn bài này' };
  }
  if (window.closedAt !== null && window.closedAt <= window.now) {
    return { allowed: false, late: false, reason: 'Giáo viên đã đóng bài, không nộp thêm được' };
  }
  if (window.attemptsUsed >= window.maxAttempts) {
    return { allowed: false, late: false, reason: `Bài chỉ cho nộp ${window.maxAttempts} lần` };
  }
  const late = window.dueAt !== null && window.dueAt < window.now;
  if (late && window.latePolicy === 'block') {
    return { allowed: false, late: true, reason: 'Đã quá hạn nộp, bài không nhận nộp muộn' };
  }
  return { allowed: true, late, reason: null };
}

// ---------- Câu cho học sinh, chấm trắc nghiệm

export interface ItemRow {
  id: string;
  variant_id: string | null;
  position: number;
  kind: AssignmentItemKind;
  snapshot: QuestionSnapshot | null;
  prompt: string | null;
  score: number;
  settings: Record<string, unknown>;
}

export function itemsForVariant<T extends Pick<ItemRow, 'variant_id' | 'position'>>(
  items: T[],
  variantId: string | null,
) {
  return items
    .filter((item) => item.variant_id === null || item.variant_id === variantId)
    .sort((left, right) => left.position - right.position);
}

// Câu trắc nghiệm gửi xuống máy học sinh: không có đáp án, hướng dẫn chấm
export function studentItem(item: ItemRow) {
  return {
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    score: item.score,
    question: item.snapshot
      ? {
          content: item.snapshot.content,
          question_type: item.snapshot.question_type,
          options: item.snapshot.options,
          // Số ý của câu đúng sai để máy học sinh dựng đủ ô chọn
          parts: item.snapshot.question_type === 'true_false' ? item.snapshot.answer.length : null,
        }
      : null,
    resource_id: typeof item.settings.resource_id === 'string' ? item.settings.resource_id : null,
  };
}

export type Answers = Record<string, { choices?: string[]; text?: string }>;

// Đọc câu trả lời học sinh gửi: chỉ nhận câu có trong phiên bản của em, chữ tối đa 10.000 ký tự
export function parseAnswers(raw: unknown, items: ItemRow[]): Answers {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: FieldError[] = [];
  const answers: Answers = {};
  for (const item of items) {
    const value = source[item.id];
    if (value === undefined || value === null || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    if (item.kind === 'question') {
      const choices = Array.isArray(entry.choices)
        ? entry.choices
            .filter((choice): choice is string => typeof choice === 'string')
            .map((choice) => choice.slice(0, 200))
        : [];
      answers[item.id] = { choices: choices.slice(0, 10) };
    } else if (item.kind === 'essay' || item.kind === 'upload' || item.kind === 'audio') {
      const body = typeof entry.text === 'string' ? entry.text : '';
      if (body.length > MAX_ANSWER_TEXT) {
        errors.push({ field: `answers.${item.id}`, message: `Câu trả lời tối đa ${MAX_ANSWER_TEXT} ký tự` });
      }
      answers[item.id] = { text: body.slice(0, MAX_ANSWER_TEXT) };
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return answers;
}

export interface ObjectiveGrade {
  // Điểm đạt từng câu trắc nghiệm theo điểm câu
  earned: Record<string, number>;
  correct: Record<string, boolean>;
  objective: number;
  // Còn câu giáo viên phải chấm (tự luận, ảnh, tệp, ghi âm có điểm)
  needsMarking: boolean;
}

export function gradeObjectiveItems(
  items: ItemRow[],
  answers: Answers,
  rule: TrueFalseRule = 'tiered',
): ObjectiveGrade {
  const earned: Record<string, number> = {};
  const correct: Record<string, boolean> = {};
  let objective = 0;
  let needsMarking = false;
  for (const item of items) {
    if (item.kind === 'question' && item.snapshot) {
      const value =
        gradeObjective(
          item.snapshot.question_type,
          item.snapshot.answer,
          answers[item.id]?.choices,
          item.score,
          rule,
        ) ?? 0;
      earned[item.id] = value;
      correct[item.id] = value >= item.score && item.score > 0;
      objective += value;
      if (item.snapshot.question_type === 'essay') {
        needsMarking = true;
      }
    } else if (item.kind !== 'resource' && item.score > 0) {
      needsMarking = true;
    }
  }
  return { earned, correct, objective: Math.round(objective * 100) / 100, needsMarking };
}

// Tổng điểm thang 10 từ điểm từng câu: câu tự chấm lấy điểm máy, câu giáo viên chấm lấy điểm giáo viên (thiếu thì chưa đủ)
export function scoreOfItems(
  items: ItemRow[],
  objective: Record<string, number>,
  marks: Record<string, number>,
): { score: number | null; missing: string[] } {
  let earned = 0;
  let maximum = 0;
  const missing: string[] = [];
  for (const item of items) {
    if (item.kind === 'resource' || item.score <= 0) continue;
    maximum += item.score;
    const automatic = item.kind === 'question' && item.snapshot && item.snapshot.question_type !== 'essay';
    const value = automatic ? objective[item.id] : marks[item.id];
    if (value === undefined) {
      missing.push(item.id);
      continue;
    }
    earned += Math.min(Math.max(value, 0), item.score);
  }
  if (missing.length > 0 || maximum === 0) {
    return { score: null, missing };
  }
  return { score: roundScore((earned / maximum) * 10), missing };
}

export interface RubricSnapshot {
  name: string;
  levels: RubricLevel[];
  criteria: RubricCriterion[];
}

// Điểm theo thang tiêu chí: mỗi tiêu chí chọn một mức (chỉ số trong `levels`); quy tổng có trọng số về thang 10
export function rubricScore(rubric: RubricSnapshot, chosen: unknown): { score: number; levels: number[] } {
  const values = Array.isArray(chosen) ? chosen : [];
  const errors: FieldError[] = [];
  const levels = rubric.criteria.map((criterion, index) => {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= rubric.levels.length) {
      errors.push({ field: `criteria_scores.${index}`, message: `Chọn mức cho tiêu chí "${criterion.name}"` });
      return 0;
    }
    return value;
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  const top = Math.max(0, ...rubric.levels.map((level) => level.score));
  const maximum = rubric.criteria.reduce((sum, criterion) => sum + criterion.weight * top, 0);
  const earned = rubric.criteria.reduce(
    (sum, criterion, index) => sum + criterion.weight * (rubric.levels[levels[index] ?? 0]?.score ?? 0),
    0,
  );
  return { score: maximum > 0 ? roundScore((earned / maximum) * 10) : 0, levels };
}

// ---------- Kết quả hoạt động khi nộp và khi trả bài

export interface ReturnedGrade {
  score: number | null;
  level: 'excellent' | 'completed' | 'not_completed' | null;
}

// Kết quả ghi vào `activity_results` của lõi. Khi nộp: cách tính "nộp" thì hoàn thành, còn lại là đang làm. Khi trả: "đạt điểm"
// thì đạt hoặc chưa đạt theo điểm đạt của hoạt động (chấm theo mức: chưa hoàn thành là chưa đạt), còn lại là hoàn thành
export function resultOnSubmit(rule: CompletionRule): ResultStatus {
  return rule === 'submit' ? 'completed' : 'in_progress';
}

export function resultOnReturn(rule: CompletionRule, passScore: number | null, grade: ReturnedGrade): ResultStatus {
  if (rule !== 'pass') {
    return 'completed';
  }
  if (grade.score !== null) {
    return grade.score >= (passScore ?? 5) ? 'passed' : 'failed';
  }
  if (grade.level !== null) {
    return grade.level === 'not_completed' ? 'failed' : 'passed';
  }
  return 'completed';
}

// Điểm của từng em trong bài nhóm: điểm nhóm, hoặc điểm giáo viên điều chỉnh có lý do
export function memberScore(groupScore: number | null, adjusted: number | null): number | null {
  return adjusted ?? groupScore;
}

// ---------- Tệp nộp bài

export type SubmissionFileKind = 'image' | 'document' | 'audio';

const SIGNATURES: Array<{ contentType: string; kind: SubmissionFileKind; offset: number; bytes: number[] }> = [
  { contentType: 'image/jpeg', kind: 'image', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', kind: 'image', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', kind: 'document', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { contentType: 'audio/webm', kind: 'audio', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { contentType: 'audio/ogg', kind: 'audio', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { contentType: 'audio/mp4', kind: 'audio', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { contentType: 'audio/mpeg', kind: 'audio', offset: 0, bytes: [0x49, 0x44, 0x33] },
];

// Định dạng nhận theo các byte đầu, không tin phần mở rộng hay loại trình duyệt gửi
export function detectSubmissionFile(body: Buffer): { contentType: string; kind: SubmissionFileKind } | null {
  const found = SIGNATURES.find((signature) =>
    signature.bytes.every((byte, index) => body[signature.offset + index] === byte),
  );
  return found ? { contentType: found.contentType, kind: found.kind } : null;
}

// Bỏ các khối APP1 đến APP15 của JPEG (EXIF có vị trí, thời điểm, máy chụp; XMP; IPTC) và khối chú thích; giữ APP0 (JFIF) và
// dữ liệu ảnh. Máy học sinh đã vẽ lại ảnh để bỏ siêu dữ liệu; máy chủ làm thêm một lần phòng ảnh gửi thẳng
export function stripJpegMetadata(body: Buffer): Buffer {
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) {
    return body;
  }
  const parts: Buffer[] = [body.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= body.length) {
    if (body[offset] !== 0xff) {
      return body;
    }
    const marker = body[offset + 1] as number;
    // Bắt đầu dữ liệu ảnh: phần còn lại giữ nguyên
    if (marker === 0xda) {
      parts.push(body.subarray(offset));
      return Buffer.concat(parts);
    }
    const length = body.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > body.length) {
      return body;
    }
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) {
      parts.push(body.subarray(offset, offset + 2 + length));
    }
    offset += 2 + length;
  }
  return body;
}

// Kiểm giới hạn tệp của một bài nộp trước khi nhận thêm tệp
export function checkUpload(
  limits: UploadLimits,
  existing: Array<{ kind: SubmissionFileKind; size_bytes: number }>,
  incoming: { kind: SubmissionFileKind; size: number },
): string | null {
  if (incoming.kind === 'image' && existing.filter((file) => file.kind === 'image').length >= limits.max_images) {
    return `Mỗi bài nộp tối đa ${limits.max_images} ảnh`;
  }
  if (incoming.kind === 'document' && incoming.size > limits.max_document_bytes) {
    return `Tài liệu tối đa ${Math.round(limits.max_document_bytes / 1024 / 1024)} MB`;
  }
  if (incoming.kind === 'audio' && incoming.size > limits.max_audio_bytes) {
    return `Ghi âm tối đa ${Math.round(limits.max_audio_seconds / 60)} phút`;
  }
  const total = existing.reduce((sum, file) => sum + file.size_bytes, 0) + incoming.size;
  if (total > limits.max_total_bytes) {
    return `Tổng tệp của bài nộp tối đa ${Math.round(limits.max_total_bytes / 1024 / 1024)} MB`;
  }
  return null;
}

// ---------- Đề cho gợi ý nhận xét AI (GD-142): chỉ đề, không bao giờ có bài làm

// Chữ đề của bài gửi trợ lý AI: yêu cầu của câu tự luận, ảnh, tệp, ghi âm và nội dung câu trắc nghiệm (không đáp án)
export function taskTextForAi(items: ItemRow[]): string[] {
  return items
    .filter((item) => item.kind !== 'resource')
    .map((item) => (item.snapshot ? item.snapshot.content : (item.prompt ?? '')))
    .filter((line) => line.trim() !== '');
}

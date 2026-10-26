import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { isUuid, type RequestBody } from '../common/request-fields.js';

// Hàm thuần của lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272; tài liệu 32 mục 20.7): sinh lớp học trực tuyến từ
// phân công giảng dạy, điều kiện mở hoạt động, hoàn thành, tiến độ, kế hoạch dạy học trực tuyến theo tuần, quyết định hình
// thức dạy thay thế (Thông tư 09/2021/TT-BGDĐT), nội dung khoá học mẫu và cách nhận cập nhật của mẫu. Không đọc cơ sở dữ liệu
export const LEARNING_RULE_CODE = 'YCTD-272';
export const MAX_OPEN_RULES = 10;
export const MAX_TEMPLATE_SECTIONS = 60;
export const MAX_TEMPLATE_ITEMS = 300;
export const LEARNING_LEVELS = ['TH', 'THCS', 'THPT'] as const;
export type LearningLevel = (typeof LEARNING_LEVELS)[number];
export type CompletionRule = 'view' | 'submit' | 'pass' | 'teacher';
export type TeachingModeValue = 'support' | 'replace';
export type ResultStatus = 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed' | 'excused';

export function learningRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(LEARNING_RULE_CODE, message, fields);
}

// ---------- Sinh lớp học trực tuyến từ phân công ----------

export interface ClassSource {
  id: string;
  name: string;
  school_level: string;
  grade_level: string | null;
}
export interface SubjectSource {
  id: string;
  name: string;
}
export interface AssignmentSource {
  class_id: string;
  subject_id: string;
  staff_user_id: string;
  staff_name: string;
}
export interface LessonSource {
  class_id: string;
  subject_id: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
}
export interface PlannedTeacher {
  user_id: string;
  user_name: string;
  source: 'assignment' | 'timetable';
}
export interface PlannedSpace {
  class_id: string;
  subject_id: string;
  title: string;
  school_level: LearningLevel;
  grade_level: string | null;
  teachers: PlannedTeacher[];
}

// Mỗi cặp lớp, môn có phân công giảng dạy (hoặc, khi lớp chưa phân công môn đó, có tiết trong thời khoá biểu đang áp dụng) là
// một lớp học trực tuyến. Giáo viên lấy từ phân công; cặp chỉ có trong thời khoá biểu thì lấy giáo viên của các tiết. Lớp
// Mầm non, lớp không rõ cấp bỏ qua (hệ thống quản lý học tập chỉ cho TH, THCS, THPT theo Thông tư 09/2021 Điều 1)
export function planClassSpaces(
  classes: ClassSource[],
  subjects: SubjectSource[],
  assignments: AssignmentSource[],
  lessons: LessonSource[],
): PlannedSpace[] {
  const classById = new Map(classes.map((row) => [row.id, row]));
  const subjectById = new Map(subjects.map((row) => [row.id, row]));
  const pairs = new Map<string, Map<string, PlannedTeacher>>();
  const key = (classId: string, subjectId: string) => `${classId}|${subjectId}`;
  for (const row of assignments) {
    const teachers = pairs.get(key(row.class_id, row.subject_id)) ?? new Map<string, PlannedTeacher>();
    teachers.set(row.staff_user_id, { user_id: row.staff_user_id, user_name: row.staff_name, source: 'assignment' });
    pairs.set(key(row.class_id, row.subject_id), teachers);
  }
  for (const row of lessons) {
    const pairKey = key(row.class_id, row.subject_id);
    const existing = pairs.get(pairKey);
    if (existing && [...existing.values()].some((teacher) => teacher.source === 'assignment')) {
      continue;
    }
    const teachers = existing ?? new Map<string, PlannedTeacher>();
    if (row.teacher_user_id && row.teacher_name) {
      teachers.set(row.teacher_user_id, {
        user_id: row.teacher_user_id,
        user_name: row.teacher_name,
        source: 'timetable',
      });
    }
    pairs.set(pairKey, teachers);
  }
  const planned: PlannedSpace[] = [];
  for (const [pairKey, teachers] of pairs) {
    const [classId, subjectId] = pairKey.split('|') as [string, string];
    const classRow = classById.get(classId);
    const subject = subjectById.get(subjectId);
    if (!classRow || !subject || !(LEARNING_LEVELS as readonly string[]).includes(classRow.school_level)) {
      continue;
    }
    planned.push({
      class_id: classId,
      subject_id: subjectId,
      title: `${subject.name} - ${classRow.name}`,
      school_level: classRow.school_level as LearningLevel,
      grade_level: classRow.grade_level,
      teachers: [...teachers.values()].sort((left, right) => left.user_name.localeCompare(right.user_name, 'vi')),
    });
  }
  return planned.sort((left, right) => left.title.localeCompare(right.title, 'vi'));
}

export interface ExistingTeacher {
  user_id: string;
  source: 'assignment' | 'timetable' | 'manual';
}

// Đồng bộ giáo viên của lớp học trực tuyến: giáo viên thêm tay giữ nguyên; giáo viên lấy từ phân công, thời khoá biểu theo
// kế hoạch mới (người không còn được phân công thì bỏ, nội dung của lớp không đổi)
export function diffTeachers(existing: ExistingTeacher[], planned: PlannedTeacher[]) {
  const plannedIds = new Set(planned.map((teacher) => teacher.user_id));
  const existingIds = new Set(existing.map((teacher) => teacher.user_id));
  return {
    add: planned.filter((teacher) => !existingIds.has(teacher.user_id)),
    remove: existing
      .filter((teacher) => teacher.source !== 'manual' && !plannedIds.has(teacher.user_id))
      .map((teacher) => teacher.user_id),
  };
}

// ---------- Điều kiện mở ----------

export type OpenRule =
  | { type: 'after_activity'; activity_id: string }
  | { type: 'after_section'; section_id: string }
  | { type: 'min_score'; activity_id: string; score: number }
  | { type: 'from_date'; at: string }
  | { type: 'in_group'; group_id: string };
export interface OpenRules {
  mode: 'all' | 'any';
  rules: OpenRule[];
}

export function parseOpenRules(value: unknown, field: string, errors: FieldError[]): OpenRules | null {
  if (value === undefined || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const mode = raw.mode ?? 'all';
  const rules = Array.isArray(raw.rules) ? raw.rules : null;
  if ((mode !== 'all' && mode !== 'any') || !rules || rules.length > MAX_OPEN_RULES) {
    errors.push({ field, message: `Điều kiện mở có mode (all, any) và tối đa ${MAX_OPEN_RULES} điều kiện` });
    return null;
  }
  const parsed: OpenRule[] = [];
  rules.forEach((item, index) => {
    const rule = (item ?? {}) as Record<string, unknown>;
    const at = `${field}.rules[${index}]`;
    if (rule.type === 'after_activity' && isUuid(rule.activity_id)) {
      parsed.push({ type: 'after_activity', activity_id: rule.activity_id });
    } else if (rule.type === 'after_section' && isUuid(rule.section_id)) {
      parsed.push({ type: 'after_section', section_id: rule.section_id });
    } else if (
      rule.type === 'min_score' &&
      isUuid(rule.activity_id) &&
      typeof rule.score === 'number' &&
      rule.score >= 0 &&
      rule.score <= 10
    ) {
      parsed.push({ type: 'min_score', activity_id: rule.activity_id, score: rule.score });
    } else if (rule.type === 'from_date' && typeof rule.at === 'string' && !Number.isNaN(Date.parse(rule.at))) {
      parsed.push({ type: 'from_date', at: new Date(rule.at).toISOString() });
    } else if (rule.type === 'in_group' && isUuid(rule.group_id)) {
      parsed.push({ type: 'in_group', group_id: rule.group_id });
    } else {
      errors.push({ field: at, message: 'Điều kiện không hợp lệ' });
    }
  });
  return parsed.length === 0 ? null : { mode, rules: parsed };
}

export interface ResultSnapshot {
  status: ResultStatus;
  score: number | null;
}
export interface OpenContext {
  now: Date;
  results: Map<string, ResultSnapshot>;
  activityTitles: Map<string, string>;
  sectionDone: (sectionId: string) => boolean;
  sectionTitles: Map<string, string>;
  groupIds: Set<string>;
}

export function isDone(status: ResultStatus | undefined): boolean {
  return status === 'completed' || status === 'passed' || status === 'excused';
}

// Hoạt động mở hay khóa với một học sinh, kèm lý do để học sinh biết cần làm gì ("Hoàn thành ... để mở")
export function evaluateOpenRules(rules: OpenRules | null, context: OpenContext): { open: boolean; reasons: string[] } {
  if (!rules || rules.rules.length === 0) {
    return { open: true, reasons: [] };
  }
  const checks = rules.rules.map((rule): { ok: boolean; reason: string } => {
    switch (rule.type) {
      case 'after_activity': {
        const title = context.activityTitles.get(rule.activity_id) ?? 'hoạt động trước';
        return { ok: isDone(context.results.get(rule.activity_id)?.status), reason: `Hoàn thành "${title}" để mở` };
      }
      case 'after_section': {
        const title = context.sectionTitles.get(rule.section_id) ?? 'chương trước';
        return { ok: context.sectionDone(rule.section_id), reason: `Hoàn thành chương "${title}" để mở` };
      }
      case 'min_score': {
        const title = context.activityTitles.get(rule.activity_id) ?? 'hoạt động trước';
        const score = context.results.get(rule.activity_id)?.score;
        return {
          ok: score !== null && score !== undefined && score >= rule.score,
          reason: `Đạt từ ${rule.score} điểm ở "${title}" để mở`,
        };
      }
      case 'from_date':
        return { ok: context.now.getTime() >= Date.parse(rule.at), reason: `Mở từ ${rule.at}` };
      case 'in_group':
        return { ok: context.groupIds.has(rule.group_id), reason: 'Chỉ dành cho nhóm được giao' };
    }
  });
  const open = rules.mode === 'all' ? checks.every((check) => check.ok) : checks.some((check) => check.ok);
  return { open, reasons: open ? [] : checks.filter((check) => !check.ok).map((check) => check.reason) };
}

// Các hoạt động mà điều kiện mở trỏ tới phải nằm trong cùng lớp học trực tuyến và không trỏ vào chính nó
export function openRuleReferences(rules: OpenRules | null) {
  return {
    activityIds: (rules?.rules ?? []).flatMap((rule) =>
      rule.type === 'after_activity' || rule.type === 'min_score' ? [rule.activity_id] : [],
    ),
    sectionIds: (rules?.rules ?? []).flatMap((rule) => (rule.type === 'after_section' ? [rule.section_id] : [])),
  };
}

// ---------- Hoàn thành, tiến độ ----------

export interface ActivityForProgress {
  id: string;
  section_id: string;
  required: boolean;
  due_at: Date | null;
}

// Trạng thái hoàn thành theo cách tính của hoạt động: xem xong, nộp, đạt điểm, giáo viên đánh dấu
export function resultFromCompletion(
  rule: CompletionRule,
  input: {
    viewed?: boolean;
    progress?: number | null;
    submitted?: boolean;
    score?: number | null;
    passScore?: number | null;
  },
): ResultStatus {
  switch (rule) {
    case 'view':
      return input.viewed || (input.progress ?? 0) >= 100 ? 'completed' : 'in_progress';
    case 'submit':
      return input.submitted ? 'completed' : 'in_progress';
    case 'pass': {
      if (input.score === null || input.score === undefined) {
        return input.submitted ? 'in_progress' : 'not_started';
      }
      return input.score >= (input.passScore ?? 5) ? 'passed' : 'failed';
    }
    case 'teacher':
      return 'in_progress';
  }
}

export function summarizeProgress(
  activities: ActivityForProgress[],
  results: Map<string, ResultSnapshot>,
  now: Date,
): { required: number; done: number; overdue: number; percent: number } {
  const required = activities.filter((activity) => activity.required);
  const done = required.filter((activity) => isDone(results.get(activity.id)?.status)).length;
  const overdue = required.filter(
    (activity) => activity.due_at !== null && activity.due_at < now && !isDone(results.get(activity.id)?.status),
  ).length;
  return {
    required: required.length,
    done,
    overdue,
    percent: required.length === 0 ? 0 : Math.round((done / required.length) * 100),
  };
}

export function sectionDone(
  sectionId: string,
  activities: ActivityForProgress[],
  results: Map<string, ResultSnapshot>,
) {
  return activities
    .filter((activity) => activity.section_id === sectionId && activity.required)
    .every((activity) => isDone(results.get(activity.id)?.status));
}

// ---------- Hình thức dạy học trực tuyến ----------

export interface DecisionSource {
  status: 'active' | 'revoked';
  class_ids: string[];
  starts_on: string;
  ends_on: string;
}

// Dạy học trực tuyến thay thế (Thông tư 09/2021 Điều 5 khoản 4) chỉ khi có quyết định còn hiệu lực của Hiệu trưởng cho lớp
// vào ngày đó; quyết định không ghi lớp là toàn trường
export function replaceAllowed(decisions: DecisionSource[], classId: string | null, date: string): boolean {
  return decisions.some(
    (decision) =>
      decision.status === 'active' &&
      decision.starts_on <= date &&
      date <= decision.ends_on &&
      (decision.class_ids.length === 0 || (classId !== null && decision.class_ids.includes(classId))),
  );
}

// ---------- Kế hoạch dạy học trực tuyến theo tuần (Thông tư 09/2021 Điều 8 khoản 1 điểm c) ----------

export interface PlanSection {
  id: string;
  title: string;
  position: number;
  planned_week: number | null;
}
export interface PlanActivity {
  id: string;
  section_id: string;
  title: string;
  kind: string;
  position: number;
  planned_week: number | null;
  teaching_mode: TeachingModeValue;
  status: 'draft' | 'published';
  due_at: Date | null;
}

export function weeklyPlan(sections: PlanSection[], activities: PlanActivity[]) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const weeks = new Map<number | null, Array<Record<string, unknown>>>();
  const ordered = [...activities].sort((left, right) => {
    const leftSection = sectionById.get(left.section_id)?.position ?? 0;
    const rightSection = sectionById.get(right.section_id)?.position ?? 0;
    return leftSection - rightSection || left.position - right.position;
  });
  for (const activity of ordered) {
    const section = sectionById.get(activity.section_id);
    const week = activity.planned_week ?? section?.planned_week ?? null;
    const items = weeks.get(week) ?? [];
    items.push({
      activity_id: activity.id,
      section_title: section?.title ?? '',
      title: activity.title,
      kind: activity.kind,
      teaching_mode: activity.teaching_mode,
      status: activity.status,
      due_at: activity.due_at,
    });
    weeks.set(week, items);
  }
  return [...weeks.entries()]
    .sort(([left], [right]) => (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER))
    .map(([week, items]) => ({ week, items }));
}

// ---------- Nhập liệu chung ----------

export function readBoundedText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  limits: { required: boolean; max: number },
): string | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    if (limits.required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return undefined;
  }
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    if (limits.required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
      return undefined;
    }
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > limits.max) {
    errors.push({ field, message: `Chữ tối đa ${limits.max} ký tự` });
    return undefined;
  }
  return value.trim();
}

export function readOptionalTime(body: RequestBody, field: string, errors: FieldError[]): Date | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Thời điểm dạng ISO 8601' });
    return undefined;
  }
  return new Date(value);
}

export function readOptionalWeek(body: RequestBody, field: string, errors: FieldError[]): number | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 60) {
    errors.push({ field, message: 'Tuần là số nguyên từ 1 đến 60' });
    return undefined;
  }
  return value;
}

export function throwIfErrors(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

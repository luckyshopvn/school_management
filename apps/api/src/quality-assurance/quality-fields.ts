import type { FieldError } from '@school-management/server';
import {
  KPI_SCHOOL_LEVELS,
  QUALITY_COUNCIL_POSITION_LABELS,
  QUALITY_LIMITS,
  QUALITY_MAXIMUM_LEVEL,
  type KpiSchoolLevelCode,
  type QualityCouncilPositionCode,
  type QualityImprovementAction,
} from '@school-management/shared';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import {
  isDate,
  readChoice,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
} from '../incoming-documents/incoming-fields.js';

// Đọc và kiểm tra dữ liệu gửi lên của bảo đảm chất lượng (DT-18 phần 22f, YCTD-149)
export const LEVEL_LABELS = Object.fromEntries(KPI_SCHOOL_LEVELS.map((level) => [level.value, level.label])) as Record<
  KpiSchoolLevelCode,
  string
>;
const STATUS_LABELS = { active: 'Đang dùng', inactive: 'Ngừng dùng' };

export interface FrameworkInput {
  code: string;
  name: string;
  school_level: KpiSchoolLevelCode | null;
  legal_basis: string | null;
  max_level: number;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface StandardInput {
  code: string;
  title: string;
  sort_order: number;
}

export interface CriterionInput {
  code: string;
  title: string;
  evidence_hint: string | null;
  sort_order: number;
}

export interface IndicatorInput {
  level: number;
  code: string;
  content: string;
  sort_order: number;
}

export interface AssessmentInput {
  framework_id: string;
  title: string;
  decision_number: string | null;
  decision_date: string | null;
  start_date: string | null;
  end_date: string | null;
  introduction: string | null;
  conclusion: string | null;
}

export interface CouncilMemberInput {
  staff_id: string;
  position: QualityCouncilPositionCode;
  duty: string | null;
}

export interface WorkGroupInput {
  name: string;
  leader_staff_id: string | null;
  member_staff_ids: string[];
  criterion_ids: string[];
}

export interface ReportInput {
  current_state: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_actions: QualityImprovementAction[];
  indicator_results: Record<string, boolean>;
  self_level: number | null;
}

export interface RecognitionInput {
  external_level: number | null;
  recognition_decision: string | null;
  recognition_date: string | null;
  recognition_valid_until: string | null;
}

const CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

function readCode(body: RequestBody, errors: FieldError[], maximum: number): string {
  const code = readText(body, 'code', errors, { required: true, maximum }) ?? '';
  if (code && !CODE_PATTERN.test(code)) {
    errors.push({ field: 'code', message: 'Mã gồm chữ không dấu, số, dấu chấm, gạch ngang' });
  }
  return code;
}

const sortOrder = (body: RequestBody, errors: FieldError[]) =>
  readInteger(body, 'sort_order', errors, { min: 0, max: 100_000 }, 0) ?? 0;

export function readFramework(body: RequestBody, errors: FieldError[]): FrameworkInput {
  const level = body?.school_level ? readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors) : null;
  return {
    code: readCode(body, errors, 50),
    name: readText(body, 'name', errors, { required: true, maximum: 300 }) ?? '',
    school_level: level,
    legal_basis: readText(body, 'legal_basis', errors, { maximum: 1000 }),
    max_level: readInteger(body, 'max_level', errors, { min: 1, max: QUALITY_MAXIMUM_LEVEL }, 3) ?? 3,
    sort_order: sortOrder(body, errors),
    status: readChoice(body, 'status', STATUS_LABELS, 'active', errors),
  };
}

export function readStandard(body: RequestBody, errors: FieldError[]): StandardInput {
  return {
    code: readCode(body, errors, 20),
    title: readText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    sort_order: sortOrder(body, errors),
  };
}

export function readCriterion(body: RequestBody, errors: FieldError[]): CriterionInput {
  return {
    code: readCode(body, errors, 20),
    title: readText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    evidence_hint: readText(body, 'evidence_hint', errors, { maximum: 2000 }),
    sort_order: sortOrder(body, errors),
  };
}

export function readIndicator(body: RequestBody, errors: FieldError[]): IndicatorInput {
  const level = readInteger(body, 'level', errors, { min: 1, max: QUALITY_MAXIMUM_LEVEL });
  if (level === null && !errors.some((error) => error.field === 'level')) {
    errors.push({ field: 'level', message: 'Bắt buộc chọn mức' });
  }
  return {
    level: level ?? 1,
    code: readCode(body, errors, 10),
    content: readText(body, 'content', errors, { required: true, maximum: 2000 }) ?? '',
    sort_order: sortOrder(body, errors),
  };
}

export function readAssessment(body: RequestBody, errors: FieldError[]): AssessmentInput {
  const input: AssessmentInput = {
    framework_id: readUuid(body, 'framework_id', errors, true) ?? '',
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    decision_number: readText(body, 'decision_number', errors, { maximum: 100 }),
    decision_date: readDate(body, 'decision_date', errors),
    start_date: readDate(body, 'start_date', errors),
    end_date: readDate(body, 'end_date', errors),
    introduction: readText(body, 'introduction', errors, { maximum: QUALITY_LIMITS.text }),
    conclusion: readText(body, 'conclusion', errors, { maximum: QUALITY_LIMITS.text }),
  };
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    errors.push({ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
  }
  return input;
}

export function readCouncil(body: RequestBody, errors: FieldError[]): CouncilMemberInput[] {
  const value = body?.members;
  if (!Array.isArray(value) || value.length > QUALITY_LIMITS.members) {
    errors.push({ field: 'members', message: `Danh sách tối đa ${QUALITY_LIMITS.members} thành viên` });
    return [];
  }
  const members: CouncilMemberInput[] = [];
  const seen = new Set<string>();
  value.forEach((item: RequestBody, index) => {
    const field = `members.${index}`;
    if (!isUuid(item?.staff_id)) {
      errors.push({ field: `${field}.staff_id`, message: 'Bắt buộc chọn nhân sự' });
      return;
    }
    if (seen.has(item.staff_id)) {
      errors.push({ field: `${field}.staff_id`, message: 'Nhân sự đã có trong hội đồng' });
      return;
    }
    seen.add(item.staff_id);
    const local: FieldError[] = [];
    const position = readChoice(item, 'position', QUALITY_COUNCIL_POSITION_LABELS, 'member', local);
    const duty = readText(item, 'duty', local, { maximum: 500 });
    errors.push(...local.map((error) => ({ ...error, field: `${field}.${error.field}` })));
    members.push({ staff_id: item.staff_id, position, duty });
  });
  if (members.filter((member) => member.position === 'chair').length > 1) {
    errors.push({ field: 'members', message: 'Hội đồng chỉ có một Chủ tịch' });
  }
  return members;
}

export function readGroups(body: RequestBody, errors: FieldError[]): WorkGroupInput[] {
  const value = body?.groups;
  if (!Array.isArray(value) || value.length > QUALITY_LIMITS.groups) {
    errors.push({ field: 'groups', message: `Tối đa ${QUALITY_LIMITS.groups} nhóm công tác` });
    return [];
  }
  const assigned = new Set<string>();
  return value.map((item: RequestBody, index) => {
    const local: FieldError[] = [];
    const group: WorkGroupInput = {
      name: readText(item, 'name', local, { required: true, maximum: 200 }) ?? '',
      leader_staff_id: readUuid(item, 'leader_staff_id', local),
      member_staff_ids: readUuidList(item, 'member_staff_ids', local, QUALITY_LIMITS.members),
      criterion_ids: readUuidList(item, 'criterion_ids', local, 500),
    };
    for (const criterionId of group.criterion_ids) {
      if (assigned.has(criterionId)) {
        local.push({ field: 'criterion_ids', message: 'Mỗi tiêu chí chỉ phân công cho một nhóm' });
        break;
      }
      assigned.add(criterionId);
    }
    errors.push(...local.map((error) => ({ ...error, field: `groups.${index}.${error.field}` })));
    return group;
  });
}

export function readReport(body: RequestBody, errors: FieldError[]): ReportInput {
  const actions: QualityImprovementAction[] = [];
  const value = body?.improvement_actions;
  if (value !== undefined && value !== null) {
    if (!Array.isArray(value) || value.length > QUALITY_LIMITS.actions) {
      errors.push({ field: 'improvement_actions', message: `Tối đa ${QUALITY_LIMITS.actions} việc cải tiến` });
    } else {
      value.forEach((item: RequestBody, index) => {
        const local: FieldError[] = [];
        const action: QualityImprovementAction = {
          content: readText(item, 'content', local, { required: true, maximum: 500 }) ?? '',
          owner_staff_id: readUuid(item, 'owner_staff_id', local),
          due_date: readDate(item, 'due_date', local),
          resources: readText(item, 'resources', local, { maximum: 500 }),
        };
        errors.push(...local.map((error) => ({ ...error, field: `improvement_actions.${index}.${error.field}` })));
        actions.push(action);
      });
    }
  }
  const results: Record<string, boolean> = {};
  const raw = body?.indicator_results;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ field: 'indicator_results', message: 'Kết quả chỉ báo không hợp lệ' });
    } else {
      for (const [key, met] of Object.entries(raw as Record<string, unknown>)) {
        if (!isUuid(key) || typeof met !== 'boolean') {
          errors.push({ field: 'indicator_results', message: 'Kết quả chỉ báo không hợp lệ' });
          break;
        }
        results[key] = met;
      }
    }
  }
  return {
    current_state: readText(body, 'current_state', errors, { maximum: QUALITY_LIMITS.text }),
    strengths: readText(body, 'strengths', errors, { maximum: QUALITY_LIMITS.text }),
    weaknesses: readText(body, 'weaknesses', errors, { maximum: QUALITY_LIMITS.text }),
    improvement_actions: actions,
    indicator_results: results,
    self_level: readInteger(body, 'self_level', errors, { min: 0, max: QUALITY_MAXIMUM_LEVEL }),
  };
}

export function readRecognition(body: RequestBody, errors: FieldError[]): RecognitionInput {
  const input: RecognitionInput = {
    external_level: readInteger(body, 'external_level', errors, { min: 0, max: QUALITY_MAXIMUM_LEVEL }),
    recognition_decision: readText(body, 'recognition_decision', errors, { maximum: 200 }),
    recognition_date: readDate(body, 'recognition_date', errors),
    recognition_valid_until: readDate(body, 'recognition_valid_until', errors),
  };
  if (
    input.recognition_date &&
    input.recognition_valid_until &&
    isDate(input.recognition_valid_until) &&
    input.recognition_valid_until <= input.recognition_date
  ) {
    errors.push({ field: 'recognition_valid_until', message: 'Ngày hết hiệu lực sau ngày công nhận' });
  }
  return input;
}

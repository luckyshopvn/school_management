import type { FieldError } from '@school-management/server';
import {
  EMULATION_APPEAL_KIND_LABELS,
  EMULATION_CAMPAIGN_KIND_LABELS,
  EMULATION_DECISION_KIND_LABELS,
  EMULATION_KIND_LABELS,
  EMULATION_LEVEL_LABELS,
  EMULATION_LIMITS,
  EMULATION_POSITION_LABELS,
  EMULATION_TARGET_LABELS,
  EMULATION_VOTE_LABELS,
  KPI_SCHOOL_LEVELS,
  type EmulationAppealKindCode,
  type EmulationCriterion,
  type EmulationDecisionLevelCode,
  type EmulationPositionCode,
  type EmulationTargetCode,
  type EmulationTitleKindCode,
  type EmulationVoteCode,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import {
  isDate,
  readBoolean,
  readChoice,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
} from '../incoming-documents/incoming-fields.js';

// Đọc và kiểm tra dữ liệu vào của thi đua, khen thưởng (DT-18 phần 22d, YCTD-148). Mã danh hiệu, mã tiêu chí là chữ in hoa,
// chữ thường, số, gạch nối, gạch dưới để dùng làm khóa đối chiếu nhiều năm
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
const CRITERION_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const YEAR_NAME = /^\d{4}\s*[-–]\s*\d{4}$/;
const MEETING_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LEVEL_LABELS = Object.fromEntries(KPI_SCHOOL_LEVELS.map((level) => [level.value, level.label])) as Record<
  KpiSchoolLevelCode,
  string
>;

export interface TitleInput {
  code: string;
  name: string;
  description: string | null;
  kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  decision_level: EmulationDecisionLevelCode;
  school_level: KpiSchoolLevelCode | null;
  min_kpi_rank: string | null;
  requires_initiative: boolean;
  prerequisite_code: string | null;
  consecutive_years: number;
  quota_percent: number | null;
  quota_base_code: string | null;
  vote_threshold_percent: number;
  min_score: number | null;
  criteria: EmulationCriterion[];
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface CampaignInput {
  code: string;
  name: string;
  kind: 'regular' | 'thematic';
  description: string | null;
  title_ids: string[];
  kpi_period_id: string | null;
  registration_deadline: string | null;
  nomination_deadline: string | null;
  appeal_days: number;
}

export interface SubjectInput {
  campaign_id: string;
  title_id: string;
  target: EmulationTargetCode;
  staff_id: string | null;
  department_id: string | null;
}

export interface RegistrationInput extends SubjectInput {
  commitment: string | null;
}

export interface NominationUpdate {
  achievements: string | null;
  initiative: string | null;
  scores: Record<string, number>;
}

export interface MemberInput {
  user_id: string;
  position: EmulationPositionCode;
}

export interface MeetingInput {
  held_at: Date;
  location: string | null;
  content: string | null;
}

export interface VoteInput {
  nomination_id: string;
  choice: EmulationVoteCode;
}

export interface AppealInput {
  campaign_id: string;
  nomination_id: string | null;
  kind: EmulationAppealKindCode;
  content: string;
}

export interface DecisionInput {
  campaign_id: string;
  kind: 'decision' | 'proposal';
  title: string;
  basis: string | null;
  signer_name: string | null;
  signer_title: string | null;
  nomination_ids: string[];
}

export interface ManualAwardInput {
  year_name: string;
  year_start: number;
  title_code: string;
  title_name: string;
  title_kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  staff_id: string | null;
  department_id: string | null;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
  note: string | null;
}

export function readNumber(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  range: { min: number; max: number },
): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
    errors.push({ field, message: `Phải là số từ ${range.min} đến ${range.max}` });
    return null;
  }
  return Math.round(value * 100) / 100;
}

function readCode(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = readText(body, field, errors, { required, maximum: 50 });
  if (value && !CODE_PATTERN.test(value)) {
    errors.push({ field, message: 'Mã gồm chữ, số, gạch nối, gạch dưới, bắt đầu bằng chữ hoặc số' });
    return null;
  }
  return value;
}

function readCriteria(body: RequestBody, errors: FieldError[]): EmulationCriterion[] {
  const value = body?.criteria;
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > EMULATION_LIMITS.criteria) {
    errors.push({ field: 'criteria', message: `Tối đa ${EMULATION_LIMITS.criteria} tiêu chí` });
    return [];
  }
  const codes = new Set<string>();
  return value.map((item: unknown, index): EmulationCriterion => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const field = `criteria.${index}`;
    const code = typeof row.code === 'string' ? row.code.trim() : '';
    if (!CRITERION_PATTERN.test(code) || codes.has(code)) {
      errors.push({ field: `${field}.code`, message: 'Mã tiêu chí là chữ thường, số, gạch dưới, không trùng' });
    }
    codes.add(code);
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (title === '' || title.length > 300) {
      errors.push({ field: `${field}.title`, message: 'Tên tiêu chí từ 1 đến 300 ký tự' });
    }
    const weight = typeof row.weight === 'number' && row.weight > 0 && row.weight <= 100 ? row.weight : null;
    if (weight === null) {
      errors.push({ field: `${field}.weight`, message: 'Trọng số lớn hơn 0, tối đa 100' });
    }
    const max = typeof row.max_score === 'number' && row.max_score > 0 && row.max_score <= 1000 ? row.max_score : null;
    if (max === null) {
      errors.push({ field: `${field}.max_score`, message: 'Điểm tối đa lớn hơn 0, tối đa 1000' });
    }
    return { code, title, weight: weight ?? 0, max_score: max ?? 0 };
  });
}

export function readTitle(body: RequestBody, errors: FieldError[]): TitleInput {
  const levelValue = body?.school_level;
  const schoolLevel =
    levelValue === undefined || levelValue === null || levelValue === ''
      ? null
      : readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
  const prerequisite = readCode(body, 'prerequisite_code', errors, false);
  const consecutive = readInteger(body, 'consecutive_years', errors, { min: 0, max: 10 }, 0) ?? 0;
  if ((prerequisite === null) !== (consecutive === 0)) {
    errors.push({
      field: 'consecutive_years',
      message: 'Danh hiệu tiền đề đi cùng số năm liên tục (từ 1 năm); không có tiền đề thì để 0',
    });
  }
  const quota = readNumber(body, 'quota_percent', errors, { min: 0.01, max: 100 });
  const quotaBase = readCode(body, 'quota_base_code', errors, false);
  if ((quota === null) !== (quotaBase === null)) {
    errors.push({ field: 'quota_base_code', message: 'Tỉ lệ tối đa đi cùng danh hiệu làm gốc tính tỉ lệ' });
  }
  const rank = readText(body, 'min_kpi_rank', errors, { maximum: 50 });
  return {
    code: readCode(body, 'code', errors, true) ?? '',
    name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 2000 }),
    kind: readChoice<EmulationTitleKindCode>(body, 'kind', EMULATION_KIND_LABELS, 'title', errors),
    target: readChoice<EmulationTargetCode>(body, 'target', EMULATION_TARGET_LABELS, 'individual', errors),
    decision_level: readChoice<EmulationDecisionLevelCode>(
      body,
      'decision_level',
      EMULATION_LEVEL_LABELS,
      'school',
      errors,
    ),
    school_level: schoolLevel,
    min_kpi_rank: rank,
    requires_initiative: readBoolean(body, 'requires_initiative', errors),
    prerequisite_code: prerequisite,
    consecutive_years: consecutive,
    quota_percent: quota,
    quota_base_code: quotaBase,
    vote_threshold_percent: readNumber(body, 'vote_threshold_percent', errors, { min: 1, max: 100 }) ?? 50,
    min_score: readNumber(body, 'min_score', errors, { min: 0, max: 100 }),
    criteria: readCriteria(body, errors),
    sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 10_000 }, 0) ?? 0,
    status: readChoice<'active' | 'inactive'>(
      body,
      'status',
      { active: 'Đang dùng', inactive: 'Ngừng dùng' },
      'active',
      errors,
    ),
  };
}

export function readCampaign(body: RequestBody, errors: FieldError[]): CampaignInput {
  const titleIds = readUuidList(body, 'title_ids', errors, 50);
  if (titleIds.length === 0 && !errors.some((error) => error.field === 'title_ids')) {
    errors.push({ field: 'title_ids', message: 'Chọn ít nhất một danh hiệu, hình thức khen thưởng' });
  }
  const registration = readDate(body, 'registration_deadline', errors);
  const nomination = readDate(body, 'nomination_deadline', errors);
  if (registration && nomination && nomination < registration) {
    errors.push({ field: 'nomination_deadline', message: 'Hạn nộp hồ sơ không trước hạn đăng ký' });
  }
  return {
    code: readCode(body, 'code', errors, true) ?? '',
    name: readText(body, 'name', errors, { required: true, maximum: 300 }) ?? '',
    kind: readChoice<'regular' | 'thematic'>(body, 'kind', EMULATION_CAMPAIGN_KIND_LABELS, 'regular', errors),
    description: readText(body, 'description', errors, { maximum: 10_000 }),
    title_ids: titleIds,
    kpi_period_id: readUuid(body, 'kpi_period_id', errors),
    registration_deadline: registration,
    nomination_deadline: nomination,
    appeal_days: readInteger(body, 'appeal_days', errors, { min: 1, max: 60 }, 7) ?? 7,
  };
}

export function readSubject(body: RequestBody, errors: FieldError[]): SubjectInput {
  const target = readChoice<EmulationTargetCode>(body, 'target', EMULATION_TARGET_LABELS, 'individual', errors);
  const staffId = readUuid(body, 'staff_id', errors);
  const departmentId = readUuid(body, 'department_id', errors);
  if (target === 'collective' && !departmentId) {
    errors.push({ field: 'department_id', message: 'Chọn tổ, tập thể' });
  }
  return {
    campaign_id: readUuid(body, 'campaign_id', errors, true) ?? '',
    title_id: readUuid(body, 'title_id', errors, true) ?? '',
    target,
    staff_id: target === 'individual' ? staffId : null,
    department_id: target === 'collective' ? departmentId : null,
  };
}

export function readRegistration(body: RequestBody, errors: FieldError[]): RegistrationInput {
  return { ...readSubject(body, errors), commitment: readText(body, 'commitment', errors, { maximum: 4000 }) };
}

export function readNominationUpdate(body: RequestBody, errors: FieldError[]): NominationUpdate {
  const raw = body?.scores;
  const scores: Record<string, number> = {};
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ field: 'scores', message: 'Điểm tự chấm theo mã tiêu chí' });
    } else {
      for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!CRITERION_PATTERN.test(code) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          errors.push({ field: `scores.${code}`, message: 'Điểm là số không âm' });
          continue;
        }
        scores[code] = Math.round(value * 100) / 100;
      }
    }
  }
  return {
    achievements: readText(body, 'achievements', errors, { maximum: EMULATION_LIMITS.achievements }),
    initiative: readText(body, 'initiative', errors, { maximum: 4000 }),
    scores,
  };
}

export function readMembers(body: RequestBody, errors: FieldError[]): MemberInput[] {
  const value = body?.members;
  if (!Array.isArray(value) || value.length > EMULATION_LIMITS.members) {
    errors.push({ field: 'members', message: `Danh sách thành viên tối đa ${EMULATION_LIMITS.members} người` });
    return [];
  }
  const seen = new Set<string>();
  const members = value.map((item: unknown, index): MemberInput => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (!isUuid(row.user_id) || seen.has(row.user_id)) {
      errors.push({ field: `members.${index}.user_id`, message: 'Chọn tài khoản, không trùng' });
    }
    seen.add(String(row.user_id));
    const position =
      typeof row.position === 'string' && row.position in EMULATION_POSITION_LABELS
        ? (row.position as EmulationPositionCode)
        : null;
    if (!position) {
      errors.push({ field: `members.${index}.position`, message: 'Chọn chức danh trong hội đồng' });
    }
    return { user_id: String(row.user_id), position: position ?? 'member' };
  });
  if (members.filter((member) => member.position === 'chair').length > 1) {
    errors.push({ field: 'members', message: 'Hội đồng có một Chủ tịch' });
  }
  return members;
}

export function readMeeting(body: RequestBody, errors: FieldError[]): MeetingInput {
  const raw = body?.held_at;
  let heldAt = new Date(Number.NaN);
  if (typeof raw !== 'string' || !MEETING_TIME.test(raw) || Number.isNaN(Date.parse(raw))) {
    errors.push({ field: 'held_at', message: 'Thời gian họp dạng YYYY-MM-DDTHH:mm' });
  } else {
    heldAt = new Date(`${raw}:00+07:00`);
  }
  return {
    held_at: heldAt,
    location: readText(body, 'location', errors, { maximum: 300 }),
    content: readText(body, 'content', errors, { maximum: 4000 }),
  };
}

export function readVotes(body: RequestBody, errors: FieldError[]): VoteInput[] {
  const value = body?.votes;
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
    errors.push({ field: 'votes', message: 'Chọn phiếu cho từ 1 đến 500 hồ sơ' });
    return [];
  }
  return value.flatMap((item: unknown, index): VoteInput[] => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (!isUuid(row.nomination_id) || typeof row.choice !== 'string' || !(row.choice in EMULATION_VOTE_LABELS)) {
      errors.push({ field: `votes.${index}`, message: 'Phiếu gồm mã hồ sơ và lựa chọn đồng ý, không đồng ý' });
      return [];
    }
    return [{ nomination_id: row.nomination_id, choice: row.choice as EmulationVoteCode }];
  });
}

export function readAppeal(body: RequestBody, errors: FieldError[]): AppealInput {
  const kind = readChoice<EmulationAppealKindCode>(body, 'kind', EMULATION_APPEAL_KIND_LABELS, 'review', errors);
  const nominationId = readUuid(body, 'nomination_id', errors, kind === 'review');
  return {
    campaign_id: readUuid(body, 'campaign_id', errors, true) ?? '',
    nomination_id: nominationId,
    kind,
    content: readText(body, 'content', errors, { required: true, maximum: 4000 }) ?? '',
  };
}

export function readDecision(body: RequestBody, errors: FieldError[]): DecisionInput {
  const ids = readUuidList(body, 'nomination_ids', errors, 500);
  if (ids.length === 0 && !errors.some((error) => error.field === 'nomination_ids')) {
    errors.push({ field: 'nomination_ids', message: 'Chọn ít nhất một hồ sơ đã được hội đồng thông qua' });
  }
  return {
    campaign_id: readUuid(body, 'campaign_id', errors, true) ?? '',
    kind: readChoice<'decision' | 'proposal'>(body, 'kind', EMULATION_DECISION_KIND_LABELS, 'decision', errors),
    title: readText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    basis: readText(body, 'basis', errors, { maximum: 4000 }),
    signer_name: readText(body, 'signer_name', errors, { maximum: 200 }),
    signer_title: readText(body, 'signer_title', errors, { maximum: 200 }),
    nomination_ids: ids,
  };
}

export function readManualAward(body: RequestBody, errors: FieldError[]): ManualAwardInput {
  const yearName = readText(body, 'year_name', errors, { required: true, maximum: 50 }) ?? '';
  let yearStart = 0;
  if (yearName && !YEAR_NAME.test(yearName)) {
    errors.push({ field: 'year_name', message: 'Năm học dạng 2024-2025' });
  } else if (yearName) {
    yearStart = Number(yearName.slice(0, 4));
  }
  const target = readChoice<EmulationTargetCode>(body, 'target', EMULATION_TARGET_LABELS, 'individual', errors);
  const staffId = readUuid(body, 'staff_id', errors, target === 'individual');
  const departmentId = readUuid(body, 'department_id', errors, target === 'collective');
  const date = body?.decision_date;
  if (date !== undefined && date !== null && date !== '' && !isDate(date)) {
    errors.push({ field: 'decision_date', message: 'Ngày dạng YYYY-MM-DD' });
  }
  return {
    // Viết như tên năm học ở hệ thống (gạch nối dài)
    year_name: yearName.replace(/\s*[-–]\s*/, '–'),
    year_start: yearStart,
    title_code: readCode(body, 'title_code', errors, true) ?? '',
    title_name: readText(body, 'title_name', errors, { required: true, maximum: 200 }) ?? '',
    title_kind: readChoice<EmulationTitleKindCode>(body, 'title_kind', EMULATION_KIND_LABELS, 'title', errors),
    target,
    staff_id: target === 'individual' ? staffId : null,
    department_id: target === 'collective' ? departmentId : null,
    decision_number: readText(body, 'decision_number', errors, { maximum: 100 }),
    decision_date: isDate(date) ? date : null,
    issuer: readText(body, 'issuer', errors, { maximum: 300 }),
    note: readText(body, 'note', errors, { maximum: 1000 }),
  };
}

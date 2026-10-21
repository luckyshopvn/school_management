import type { FieldError } from '@school-management/server';
import {
  EDUCATION_PLAN_LIMITS,
  EDUCATION_PLAN_PERIOD_LABELS,
  EDUCATION_PLAN_SCOPE_LABELS,
  EDUCATION_PLAN_STEPS,
  KPI_SCHOOL_LEVELS,
  type EducationPlanColumn,
  type EducationPlanContent,
  type EducationPlanPeriodCode,
  type EducationPlanScopeCode,
  type EducationPlanSection,
  type EducationPlanStepCode,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import type { RequestBody } from '../common/request-fields.js';
import { isDate, readBoolean, readChoice, readDate, readInteger, readText, readUuid } from '../incoming-documents/incoming-fields.js';

// Đọc và kiểm tra dữ liệu vào của kế hoạch giáo dục (DT-18 phần 22i, YCTD-147): mẫu (mục, cột, bước duyệt) và nội dung kế
// hoạch theo mục của mẫu đã chụp lại. Mã mục, mã cột là chữ thường, số, gạch dưới để làm khóa nội dung
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const LEVEL_LABELS = Object.fromEntries(KPI_SCHOOL_LEVELS.map((level) => [level.value, level.label])) as Record<
  KpiSchoolLevelCode,
  string
>;

export interface TemplateInput {
  code: string;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevelCode | null;
  scope: EducationPlanScopeCode;
  period: EducationPlanPeriodCode;
  sections: EducationPlanSection[];
  approval_steps: EducationPlanStepCode[];
  requires_signing: boolean;
  archive_folder_id: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface PlanInput {
  template_id: string;
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  org_unit_id: string | null;
  department_id: string | null;
  work_group_id: string | null;
  class_id: string | null;
}

export interface PlanUpdate {
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  content: EducationPlanContent;
}

export interface CopyInput {
  source_id: string;
  title: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  class_id: string | null;
}

function readSchoolLevel(body: RequestBody, errors: FieldError[]): KpiSchoolLevelCode | null {
  const value = body?.school_level;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return readChoice(body, 'school_level', LEVEL_LABELS, 'MN', errors);
}

function readColumns(value: unknown, field: string, errors: FieldError[]): EducationPlanColumn[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > EDUCATION_PLAN_LIMITS.columns) {
    errors.push({ field, message: `Mục bảng có từ 1 đến ${EDUCATION_PLAN_LIMITS.columns} cột` });
    return [];
  }
  const keys = new Set<string>();
  return value.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const key = typeof item.key === 'string' ? item.key.trim() : '';
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!KEY_PATTERN.test(key) || keys.has(key)) {
      errors.push({ field: `${field}.${index}.key`, message: 'Mã cột là chữ thường, số, gạch dưới, không trùng' });
    }
    keys.add(key);
    if (label === '' || label.length > 100) {
      errors.push({ field: `${field}.${index}.label`, message: 'Tên cột từ 1 đến 100 kí tự' });
    }
    return { key, label, ...(item.type === 'date' ? { type: 'date' as const } : {}) };
  });
}

// Danh sách mục của mẫu
export function readSections(value: unknown, errors: FieldError[]): EducationPlanSection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > EDUCATION_PLAN_LIMITS.sections) {
    errors.push({ field: 'sections', message: `Mẫu có từ 1 đến ${EDUCATION_PLAN_LIMITS.sections} mục` });
    return [];
  }
  const keys = new Set<string>();
  return value.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const field = `sections.${index}`;
    const key = typeof item.key === 'string' ? item.key.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const hint = typeof item.hint === 'string' ? item.hint.trim() : '';
    if (!KEY_PATTERN.test(key) || keys.has(key)) {
      errors.push({ field: `${field}.key`, message: 'Mã mục là chữ thường, số, gạch dưới, không trùng' });
    }
    keys.add(key);
    if (title === '' || title.length > 200) {
      errors.push({ field: `${field}.title`, message: 'Tên mục từ 1 đến 200 kí tự' });
    }
    if (hint.length > 500) {
      errors.push({ field: `${field}.hint`, message: 'Gợi ý tối đa 500 kí tự' });
    }
    if (item.kind !== 'text' && item.kind !== 'table') {
      errors.push({ field: `${field}.kind`, message: 'Loại mục là text hoặc table' });
    }
    const kind = item.kind === 'table' ? 'table' : 'text';
    return {
      key,
      title,
      kind,
      ...(hint ? { hint } : {}),
      ...(kind === 'table' ? { columns: readColumns(item.columns, `${field}.columns`, errors) } : {}),
    };
  });
}

function readSteps(value: unknown, errors: FieldError[]): EducationPlanStepCode[] {
  if (!Array.isArray(value) || value.some((step) => !EDUCATION_PLAN_STEPS.includes(step as EducationPlanStepCode))) {
    errors.push({ field: 'approval_steps', message: 'Bước duyệt là leader, vice_principal, principal' });
    return [];
  }
  // Giữ thứ tự cố định tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng dù chọn theo thứ tự nào
  return EDUCATION_PLAN_STEPS.filter((step) => value.includes(step));
}

export function readTemplate(body: RequestBody, errors: FieldError[]): TemplateInput {
  const code = readText(body, 'code', errors, { required: true, maximum: 50 }) ?? '';
  if (code && !/^[A-Za-z0-9_-]+$/.test(code)) {
    errors.push({ field: 'code', message: 'Mã mẫu là chữ, số, gạch nối, gạch dưới' });
  }
  return {
    code,
    name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
    description: readText(body, 'description', errors, { maximum: 1000 }),
    school_level: readSchoolLevel(body, errors),
    scope: readChoice(body, 'scope', EDUCATION_PLAN_SCOPE_LABELS, 'personal', errors),
    period: readChoice(body, 'period', EDUCATION_PLAN_PERIOD_LABELS, 'year', errors),
    sections: readSections(body?.sections, errors),
    approval_steps: readSteps(body?.approval_steps ?? [], errors),
    requires_signing: readBoolean(body, 'requires_signing', errors),
    archive_folder_id: readUuid(body, 'archive_folder_id', errors),
    sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 100000 }, 0) ?? 0,
    status: readChoice<'active' | 'inactive'>(
      body,
      'status',
      { active: 'Đang dùng', inactive: 'Ngừng dùng' },
      'active',
      errors,
    ),
  };
}

function readPeriodDates(body: RequestBody, errors: FieldError[]) {
  const start = readDate(body, 'period_start', errors);
  const end = readDate(body, 'period_end', errors);
  if (start && end && end < start) {
    errors.push({ field: 'period_end', message: 'Ngày kết thúc không trước ngày bắt đầu' });
  }
  return {
    period_label: readText(body, 'period_label', errors, { maximum: 100 }),
    period_start: start,
    period_end: end,
  };
}

export function readPlan(body: RequestBody, errors: FieldError[]): PlanInput {
  return {
    template_id: readUuid(body, 'template_id', errors, true) ?? '',
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    ...readPeriodDates(body, errors),
    org_unit_id: readUuid(body, 'org_unit_id', errors),
    department_id: readUuid(body, 'department_id', errors),
    work_group_id: readUuid(body, 'work_group_id', errors),
    class_id: readUuid(body, 'class_id', errors),
  };
}

export function readCopy(body: RequestBody, errors: FieldError[]): CopyInput {
  return {
    source_id: readUuid(body, 'source_id', errors, true) ?? '',
    title: readText(body, 'title', errors, { maximum: 300 }),
    ...readPeriodDates(body, errors),
    class_id: readUuid(body, 'class_id', errors),
  };
}

// Nội dung theo mục của kế hoạch: bỏ mã không có trong mục, cắt dòng trống, kiểm tra độ dài, ô ngày dạng YYYY-MM-DD
export function readContent(
  sections: EducationPlanSection[],
  value: unknown,
  errors: FieldError[],
): EducationPlanContent {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const content: EducationPlanContent = {};
  for (const section of sections) {
    const field = `content.${section.key}`;
    const item = raw[section.key];
    if (section.kind === 'text') {
      const text = typeof item === 'string' ? item.replace(/\r\n/g, '\n').trim() : '';
      if (text.length > EDUCATION_PLAN_LIMITS.textLength) {
        errors.push({ field, message: `Mục tối đa ${EDUCATION_PLAN_LIMITS.textLength} kí tự` });
      }
      content[section.key] = text;
      continue;
    }
    const columns = section.columns ?? [];
    const rows = (Array.isArray(item) ? item : [])
      .map((row: unknown) =>
        columns.map((_column, index) => {
          const cell = Array.isArray(row) ? row[index] : undefined;
          return typeof cell === 'string' ? cell.trim() : typeof cell === 'number' ? String(cell) : '';
        }),
      )
      .filter((row) => row.some((cell) => cell !== ''));
    if (rows.length > EDUCATION_PLAN_LIMITS.rows) {
      errors.push({ field, message: `Bảng tối đa ${EDUCATION_PLAN_LIMITS.rows} dòng` });
    }
    rows.forEach((row, rowIndex) =>
      row.forEach((cell, columnIndex) => {
        if (cell.length > EDUCATION_PLAN_LIMITS.cellLength) {
          errors.push({
            field: `${field}.${rowIndex}.${columnIndex}`,
            message: `Ô tối đa ${EDUCATION_PLAN_LIMITS.cellLength} kí tự`,
          });
        }
        if (columns[columnIndex]?.type === 'date' && cell !== '' && !isDate(cell)) {
          errors.push({ field: `${field}.${rowIndex}.${columnIndex}`, message: 'Ngày dạng YYYY-MM-DD' });
        }
      }),
    );
    content[section.key] = rows;
  }
  return content;
}

export function readPlanUpdate(sections: EducationPlanSection[], body: RequestBody, errors: FieldError[]): PlanUpdate {
  return {
    title: readText(body, 'title', errors, { required: true, maximum: 300 }) ?? '',
    ...readPeriodDates(body, errors),
    content: readContent(sections, body?.content, errors),
  };
}

// Nội dung cũ (năm trước, mẫu đã đổi) đưa về mục hiện tại: giữ mục trùng mã và cùng loại
export function mapContent(sections: EducationPlanSection[], content: EducationPlanContent): EducationPlanContent {
  const errors: FieldError[] = [];
  return readContent(sections, content, errors);
}

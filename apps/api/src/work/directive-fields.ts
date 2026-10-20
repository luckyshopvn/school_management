import type {
  TaskAssignmentRole,
  TaskAssignmentStatus,
  TaskAssignmentTarget,
  TaskPriority,
  TaskRecurrence,
} from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { DirectiveStatusFilter } from '@school-management/shared';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { readWorkDate, readWorkText } from './work-access.js';

// Đọc dữ liệu giao việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141). Biểu mẫu "THÔNG TIN CÔNG VIỆC": lãnh đạo giao việc,
// nội dung nhiệm vụ (bắt buộc), văn bản liên quan, mức độ, số ngày thực hiện, nhắc việc cho người giao việc, nhắc việc định
// kì; "PHÂN CÔNG THỰC HIỆN": mỗi dòng một vai (xử lý chính, phối hợp, theo dõi) cho một phòng ban hoặc một cá nhân, có ngày
// bắt đầu, ngày hết hạn. Ngày hết hạn trống thì lấy ngày bắt đầu cộng số ngày thực hiện (Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11)
export const DIRECTIVE_RULE_CODE = 'YCTD-141';
export const DIRECTIVE_ROLES: TaskAssignmentRole[] = ['main', 'coordinate', 'follow'];
export const DIRECTIVE_TARGETS: TaskAssignmentTarget[] = ['unit', 'staff'];
export const DIRECTIVE_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high'];
export const DIRECTIVE_RECURRENCES: TaskRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];
export const DIRECTIVE_STATUS_FILTERS: DirectiveStatusFilter[] = [
  'open',
  'open_on_time',
  'open_overdue',
  'done',
  'done_on_time',
  'done_late',
  'pending_approval',
  'approved',
  'approved_not_done',
  'approved_done',
];
export const OPEN_ASSIGNMENT_STATUSES: TaskAssignmentStatus[] = ['todo', 'in_progress'];
const MAXIMUM_ASSIGNMENTS = 100;
const DAY_MILLISECONDS = 86_400_000;

export interface AssignmentInput {
  role: TaskAssignmentRole;
  target_type: TaskAssignmentTarget;
  org_unit_id: string | null;
  department_id: string | null;
  staff_id: string | null;
  start_date: string | null;
  due_date: string | null;
}

export interface DirectiveInput {
  content: string;
  leader_user_id: string | null;
  priority: TaskPriority;
  start_date: string | null;
  duration_days: number | null;
  remind_assigner: boolean;
  recurrence: TaskRecurrence;
  source_document_id: string | null;
  related_documents: string | null;
  assignments: AssignmentInput[];
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MILLISECONDS).toISOString().slice(0, 10);
}

// Lần nhắc định kì kế tiếp sau một ngày; hằng tháng giữ ngày trong tháng, tháng ngắn hơn thì lấy ngày cuối tháng
export function nextReminder(date: string, recurrence: TaskRecurrence): string | null {
  if (recurrence === 'none') {
    return null;
  }
  if (recurrence === 'daily') {
    return shiftDate(date, 1);
  }
  if (recurrence === 'weekly') {
    return shiftDate(date, 7);
  }
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

// Ngày hết hạn của một dòng phân công: nhập thì giữ, trống thì ngày bắt đầu cộng số ngày thực hiện
export function resolveDueDate(startDate: string, dueDate: string | null, durationDays: number | null): string | null {
  if (dueDate) {
    return dueDate;
  }
  return durationDays ? shiftDate(startDate, durationDays) : null;
}

function readBoolean(body: RequestBody, field: string, errors: FieldError[]): boolean {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Giá trị là true hoặc false' });
    return false;
  }
  return value;
}

function readId(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

export function parseAssignments(value: unknown, errors: FieldError[], field = 'assignments'): AssignmentInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ field, message: 'Chọn ít nhất một phòng ban hoặc cá nhân thực hiện' });
    return [];
  }
  if (value.length > MAXIMUM_ASSIGNMENTS) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_ASSIGNMENTS} dòng phân công` });
    return [];
  }
  const rows: AssignmentInput[] = [];
  value.forEach((raw, index) => {
    const body = (raw ?? {}) as RequestBody;
    const rowErrors: FieldError[] = [];
    const role = readEnum(body, 'role', DIRECTIVE_ROLES, rowErrors, true);
    const target = readEnum(body, 'target_type', DIRECTIVE_TARGETS, rowErrors, true);
    const row: AssignmentInput = {
      role: role ?? 'main',
      target_type: target ?? 'staff',
      org_unit_id: readId(body, 'org_unit_id', rowErrors),
      department_id: readId(body, 'department_id', rowErrors),
      staff_id: readId(body, 'staff_id', rowErrors),
      start_date: readWorkDate(body, 'start_date', rowErrors),
      due_date: readWorkDate(body, 'due_date', rowErrors),
    };
    if (target === 'staff' && !row.staff_id) {
      rowErrors.push({ field: 'staff_id', message: 'Chọn cá nhân' });
    }
    if (target === 'unit' && !row.org_unit_id) {
      rowErrors.push({ field: 'org_unit_id', message: 'Chọn đơn vị hoặc phòng ban' });
    }
    if (row.start_date && row.due_date && row.due_date < row.start_date) {
      rowErrors.push({ field: 'due_date', message: 'Ngày hết hạn không trước ngày bắt đầu' });
    }
    errors.push(...rowErrors.map((error) => ({ field: `${field}[${index}].${error.field}`, message: error.message })));
    rows.push(row);
  });
  // Một đơn vị, phòng ban hay cá nhân chỉ nhận một vai trong cùng một việc
  const keys = rows.map((row) =>
    row.target_type === 'staff' ? `staff:${row.staff_id}` : `unit:${row.org_unit_id}:${row.department_id ?? ''}`,
  );
  if (new Set(keys).size !== keys.length) {
    errors.push({ field, message: 'Một phòng ban hoặc cá nhân chỉ nhận một vai trong cùng một việc' });
  }
  return rows;
}

export function parseDirectiveInput(body: RequestBody): DirectiveInput {
  const errors: FieldError[] = [];
  const duration = body?.duration_days;
  let durationDays: number | null = null;
  if (duration !== undefined && duration !== null && duration !== '') {
    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 3650) {
      errors.push({ field: 'duration_days', message: 'Số ngày thực hiện là số nguyên từ 1 đến 3650' });
    } else {
      durationDays = duration;
    }
  }
  const input: DirectiveInput = {
    content: readWorkText(body, 'content', errors, { required: true }) ?? '',
    leader_user_id: readId(body, 'leader_user_id', errors),
    priority: readEnum(body, 'priority', DIRECTIVE_PRIORITIES, errors, false) ?? 'normal',
    start_date: readWorkDate(body, 'start_date', errors),
    duration_days: durationDays,
    remind_assigner: readBoolean(body, 'remind_assigner', errors),
    recurrence: readEnum(body, 'recurrence', DIRECTIVE_RECURRENCES, errors, false) ?? 'none',
    source_document_id: readId(body, 'source_document_id', errors),
    related_documents: readWorkText(body, 'related_documents', errors, { maximum: 1000 }),
    assignments: parseAssignments(body?.assignments, errors),
  };
  if (input.assignments.length > 0 && !input.assignments.some((row) => row.role === 'main')) {
    errors.push({ field: 'assignments', message: 'Phải có ít nhất một phòng ban hoặc cá nhân xử lý chính' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

// Tên việc là dòng đầu của nội dung nhiệm vụ, tối đa 200 ký tự
export function titleOf(content: string): string {
  const firstLine = content.split(/\r?\n/)[0]?.trim() ?? '';
  return (firstLine || content).slice(0, 200);
}

// Trạng thái của việc theo các dòng xử lý chính còn hiệu lực: xong hết là hoàn thành, có dòng đã làm là đang làm
export function taskStatusOf(mains: Array<{ status: TaskAssignmentStatus; progress_percent: number }>): {
  status: 'todo' | 'in_progress' | 'done';
  progress: number;
} {
  const active = mains.filter((row) => row.status !== 'cancelled');
  if (active.length === 0) {
    return { status: 'todo', progress: 0 };
  }
  const progress = Math.round(active.reduce((sum, row) => sum + row.progress_percent, 0) / active.length);
  if (active.every((row) => row.status === 'done')) {
    return { status: 'done', progress: 100 };
  }
  return { status: progress > 0 || active.some((row) => row.status !== 'todo') ? 'in_progress' : 'todo', progress };
}

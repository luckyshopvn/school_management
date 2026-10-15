import type { ArchiveRecordStatus, ArchiveRetention } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';

// Kiểm tra biểu mẫu của văn thư lưu trữ (DT-15 phần 15h2, YCTD-117): hồ sơ tài liệu, phông lưu trữ, thông tin lưu trữ và
// bộ lọc danh sách. Mọi lỗi của biểu mẫu gom lại trả một lần ERR_VALIDATION kèm tên ô
export const ARCHIVE_RULE_CODE = 'YCTD-117';
export const ARCHIVE_STATUS_LABELS: Record<ArchiveRecordStatus, string> = {
  pending: 'Chưa hoàn thành',
  completed: 'Hoàn thành',
};
export const ARCHIVE_RETENTION_LABELS: Record<ArchiveRetention, string> = {
  permanent: 'Vĩnh viễn',
  limited: 'Có thời hạn',
};
const STATUSES = Object.keys(ARCHIVE_STATUS_LABELS);
const RETENTIONS = Object.keys(ARCHIVE_RETENTION_LABELS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_NOTE = 2000;

export interface ArchiveFondInput {
  code: string;
  name: string;
  note: string | null;
}

export interface ArchiveHoldingInput {
  fond_id: string;
  period_from_year: number;
  period_to_year: number;
  arranged: boolean;
  expired: boolean;
  retention: ArchiveRetention;
  retention_years: number | null;
  bundle_count: number;
  box_count: number;
  shelf_meters: number;
  storage_location: string;
  note: string | null;
}

export interface ArchiveRecordInput {
  code: string;
  title: string;
  fond_id: string | null;
  handler_name: string;
  opened_on: string;
  due_date: string | null;
  status: ArchiveRecordStatus;
  completed_on: string | null;
  retention: ArchiveRetention;
  retention_years: number | null;
  sheet_count: number | null;
  note: string | null;
}

export interface ArchiveRecordFilter {
  status: ArchiveRecordStatus | null;
  search: string | null;
  fond_id: string | null;
  handler: string | null;
  due_from: string | null;
  due_to: string | null;
  // Chỉ hồ sơ chưa hoàn thành đã quá thời hạn
  overdue: boolean;
}

function readText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  maximum: number,
  required: boolean,
): string | null {
  const value = readOptionalText(body, field, errors);
  if (!value) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

// Số nguyên trong khoảng; không bắt buộc thì để trống được
function readWholeNumber(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  range: { min: number; max: number },
  required: boolean,
): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
    errors.push({ field, message: `Phải là số nguyên từ ${range.min} đến ${range.max}` });
    return null;
  }
  return value;
}

function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  choices: string[],
  message: string,
): Value | null {
  const value = body?.[field];
  if (typeof value !== 'string' || !choices.includes(value)) {
    errors.push({ field, message });
    return null;
  }
  return value as Value;
}

function readBoolean(body: RequestBody, field: string, errors: FieldError[], fallback?: boolean): boolean {
  const value = body?.[field];
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Chọn có hoặc không' });
    return false;
  }
  return value;
}

// Thời hạn bảo quản vĩnh viễn thì không có số năm; có thời hạn thì số năm từ 1 đến 100
function readRetention(
  body: RequestBody,
  errors: FieldError[],
): { retention: ArchiveRetention; retention_years: number | null } {
  const retention = readChoice<ArchiveRetention>(
    body,
    'retention',
    errors,
    RETENTIONS,
    'Chọn thời hạn bảo quản: vĩnh viễn hoặc có thời hạn',
  );
  let years: number | null = null;
  if (retention === 'limited') {
    years = readWholeNumber(body, 'retention_years', errors, { min: 1, max: 100 }, true);
  } else if (retention === 'permanent' && body?.retention_years !== undefined && body.retention_years !== null) {
    errors.push({ field: 'retention_years', message: 'Bảo quản vĩnh viễn thì không nhập số năm' });
  }
  return { retention: retention ?? 'permanent', retention_years: years };
}

function readOptionalFond(body: RequestBody, errors: FieldError[], required: boolean): string | null {
  const value = body?.fond_id;
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field: 'fond_id', message: 'Chọn phông lưu trữ' });
    }
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field: 'fond_id', message: 'Mã phông không hợp lệ' });
    return null;
  }
  return value;
}

function throwIfAny(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function parseFondInput(body: RequestBody): ArchiveFondInput {
  const errors: FieldError[] = [];
  const code = readText(body, 'code', errors, 50, true);
  const name = readText(body, 'name', errors, 200, true);
  const note = readText(body, 'note', errors, MAXIMUM_NOTE, false);
  throwIfAny(errors);
  return { code: code ?? '', name: name ?? '', note };
}

// Thông tin lưu trữ: giai đoạn theo năm, từ năm không sau đến năm; chỉ tài liệu có thời hạn mới hết giá trị
export function parseHoldingInput(body: RequestBody): ArchiveHoldingInput {
  const errors: FieldError[] = [];
  const fondId = readOptionalFond(body, errors, true);
  const fromYear = readWholeNumber(body, 'period_from_year', errors, { min: 1900, max: 2200 }, true);
  const toYear = readWholeNumber(body, 'period_to_year', errors, { min: 1900, max: 2200 }, true);
  if (fromYear !== null && toYear !== null && toYear < fromYear) {
    errors.push({ field: 'period_to_year', message: 'Đến năm không được trước từ năm' });
  }
  const arranged = readBoolean(body, 'arranged', errors);
  const expired = readBoolean(body, 'expired', errors, false);
  const { retention, retention_years } = readRetention(body, errors);
  if (expired && body?.retention === 'permanent') {
    errors.push({ field: 'expired', message: 'Tài liệu bảo quản vĩnh viễn không hết giá trị' });
  }
  const bundleCount = readWholeNumber(body, 'bundle_count', errors, { min: 0, max: 1_000_000 }, false);
  const boxCount = readWholeNumber(body, 'box_count', errors, { min: 0, max: 1_000_000 }, false);
  let shelfMeters = 0;
  const meters = body?.shelf_meters;
  if (meters !== undefined && meters !== null && meters !== '') {
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0 || meters > 99_999_999) {
      errors.push({ field: 'shelf_meters', message: 'Số mét giá là số không âm' });
    } else if (Math.round(meters * 100) !== meters * 100) {
      errors.push({ field: 'shelf_meters', message: 'Số mét giá lấy tối đa hai chữ số thập phân' });
    } else {
      shelfMeters = meters;
    }
  }
  const location = readText(body, 'storage_location', errors, 200, true);
  const note = readText(body, 'note', errors, MAXIMUM_NOTE, false);
  throwIfAny(errors);
  return {
    fond_id: fondId ?? '',
    period_from_year: fromYear ?? 0,
    period_to_year: toYear ?? 0,
    arranged,
    expired,
    retention,
    retention_years,
    bundle_count: bundleCount ?? 0,
    box_count: boxCount ?? 0,
    shelf_meters: shelfMeters,
    storage_location: location ?? '',
    note,
  };
}

// Hồ sơ tài liệu: hoàn thành thì bắt buộc ngày hoàn thành, chưa hoàn thành thì không có; thời hạn và ngày hoàn thành không
// trước ngày mở hồ sơ
export function parseRecordInput(body: RequestBody): ArchiveRecordInput {
  const errors: FieldError[] = [];
  const code = readText(body, 'code', errors, 50, true);
  const title = readText(body, 'title', errors, 500, true);
  const fondId = readOptionalFond(body, errors, false);
  const handlerName = readText(body, 'handler_name', errors, 200, true);
  const openedOn = readDate(body, 'opened_on', errors, true);
  const dueDate = readDate(body, 'due_date', errors, false);
  if (openedOn && dueDate && dueDate < openedOn) {
    errors.push({ field: 'due_date', message: 'Thời hạn không được trước ngày mở hồ sơ' });
  }
  const status = readChoice<ArchiveRecordStatus>(
    body,
    'status',
    errors,
    STATUSES,
    'Chọn trạng thái: hoàn thành hoặc chưa hoàn thành',
  );
  const completedOn = readDate(body, 'completed_on', errors, status === 'completed');
  if (status === 'pending' && completedOn) {
    errors.push({ field: 'completed_on', message: 'Hồ sơ chưa hoàn thành thì không nhập ngày hoàn thành' });
  }
  if (status === 'completed' && openedOn && completedOn && completedOn < openedOn) {
    errors.push({ field: 'completed_on', message: 'Ngày hoàn thành không được trước ngày mở hồ sơ' });
  }
  const { retention, retention_years } = readRetention(body, errors);
  const sheetCount = readWholeNumber(body, 'sheet_count', errors, { min: 0, max: 100_000 }, false);
  const note = readText(body, 'note', errors, MAXIMUM_NOTE, false);
  throwIfAny(errors);
  return {
    code: code ?? '',
    title: title ?? '',
    fond_id: fondId,
    handler_name: handlerName ?? '',
    opened_on: openedOn ?? '',
    due_date: dueDate,
    status: status ?? 'pending',
    completed_on: status === 'completed' ? completedOn : null,
    retention,
    retention_years,
    sheet_count: sheetCount,
    note,
  };
}

// Bộ lọc danh sách hồ sơ đọc từ chuỗi truy vấn hoặc thân yêu cầu xuất Excel
export function readRecordFilter(query: Record<string, unknown>, errors: FieldError[]): ArchiveRecordFilter {
  const text = (field: string): string | null => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value !== 'string') {
      errors.push({ field, message: 'Phải là chữ' });
      return null;
    }
    return value.trim() || null;
  };
  const status = text('status');
  if (status && !STATUSES.includes(status)) {
    errors.push({ field: 'status', message: 'Trạng thái là pending hoặc completed' });
  }
  const fondId = text('fond_id');
  if (fondId && !isUuid(fondId)) {
    errors.push({ field: 'fond_id', message: 'Mã phông không hợp lệ' });
  }
  const dates: Record<'due_from' | 'due_to', string | null> = { due_from: null, due_to: null };
  for (const field of ['due_from', 'due_to'] as const) {
    const value = text(field);
    if (value && (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value)))) {
      errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    } else {
      dates[field] = value;
    }
  }
  const overdue = query.overdue;
  return {
    status: status && STATUSES.includes(status) ? (status as ArchiveRecordStatus) : null,
    search: text('search'),
    fond_id: fondId && isUuid(fondId) ? fondId : null,
    handler: text('handler'),
    due_from: dates.due_from,
    due_to: dates.due_to,
    overdue: overdue === true || overdue === 'true',
  };
}

import type {
  DocumentCatalogKind,
  IncomingAssignmentRole,
  IncomingCopyType,
  IncomingDocumentAuthority,
  IncomingDocumentKind,
  IncomingTransferMethod,
} from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import {
  INCOMING_AUTHORITY_LABELS,
  INCOMING_COPY_LABELS,
  INCOMING_KIND_LABELS,
  INCOMING_TRANSFER_LABELS,
} from '@school-management/shared';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';

// Đọc và kiểm tra dữ liệu gửi lên của phân hệ văn bản đến (DT-18 phần 18a); lỗi gom lại trả một lần ERR_VALIDATION
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAXIMUM_TEXT = 500;
export const MAXIMUM_LONG_TEXT = 4000;
export const MAXIMUM_BATCH = 200;
export const CATALOG_KINDS: DocumentCatalogKind[] = ['form', 'urgency', 'secrecy', 'field'];

export function throwIfAny(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  options: { required?: boolean; maximum?: number } = {},
): string | null {
  const value = readOptionalText(body, field, errors) ?? null;
  const maximum = options.maximum ?? MAXIMUM_TEXT;
  if (!value && options.required) {
    errors.push({ field, message: 'Bắt buộc nhập' });
  }
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function readDate(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (!isDate(value)) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

export function readUuid(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc chọn' });
    }
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

export function readUuidList(body: RequestBody, field: string, errors: FieldError[], maximum = MAXIMUM_BATCH): string[] {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > maximum || !value.every(isUuid)) {
    errors.push({ field, message: `Danh sách tối đa ${maximum} mã hợp lệ` });
    return [];
  }
  return [...new Set(value)];
}

export function readIds(body: RequestBody, errors: FieldError[]): string[] {
  const ids = readUuidList(body, 'ids', errors);
  if (ids.length === 0 && !errors.some((error) => error.field === 'ids')) {
    errors.push({ field: 'ids', message: `Chọn từ 1 đến ${MAXIMUM_BATCH} văn bản` });
  }
  return ids;
}

export function readBoolean(body: RequestBody, field: string, errors: FieldError[], fallback = false): boolean {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Phải là đúng hoặc sai' });
    return fallback;
  }
  return value;
}

export function readInteger(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  range: { min: number; max: number },
  fallback: number | null = null,
): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
    errors.push({ field, message: `Phải là số nguyên từ ${range.min} đến ${range.max}` });
    return fallback;
  }
  return value;
}

function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  labels: Record<Value, string>,
  fallback: Value,
  errors: FieldError[],
): Value {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !(value in labels)) {
    errors.push({ field, message: `Chọn một trong: ${Object.values<string>(labels).join(', ')}` });
    return fallback;
  }
  return value as Value;
}

// ---- Văn bản đến: các trường của biểu mẫu THÔNG TIN VĂN BẢN ĐẾN ----

export interface IncomingDocumentInput {
  summary: string;
  symbol: string;
  issuer_unit_id: string | null;
  issuer_name: string | null;
  document_date: string;
  form_id: string | null;
  urgency_id: string | null;
  secrecy_id: string | null;
  field_id: string | null;
  deadline: string | null;
  authority: IncomingDocumentAuthority;
  document_kind: IncomingDocumentKind;
  transfer_method: IncomingTransferMethod;
  copy_type: IncomingCopyType;
  has_paper: boolean;
  processing_note: string | null;
}

export interface RegistrationInput {
  book_id: string;
  // Trống thì cấp số kế tiếp của sổ
  arrival_number: number | null;
  arrival_date: string;
}

export function parseDocumentInput(body: RequestBody, errors: FieldError[]): IncomingDocumentInput {
  const input: IncomingDocumentInput = {
    summary: readText(body, 'summary', errors, { required: true, maximum: 2000 }) ?? '',
    symbol: readText(body, 'symbol', errors, { required: true, maximum: 100 }) ?? '',
    issuer_unit_id: readUuid(body, 'issuer_unit_id', errors),
    issuer_name: readText(body, 'issuer_name', errors, { maximum: 300 }),
    document_date: readDate(body, 'document_date', errors, true) ?? '',
    form_id: readUuid(body, 'form_id', errors),
    urgency_id: readUuid(body, 'urgency_id', errors),
    secrecy_id: readUuid(body, 'secrecy_id', errors),
    field_id: readUuid(body, 'field_id', errors),
    deadline: readDate(body, 'deadline', errors),
    authority: readChoice(body, 'authority', INCOMING_AUTHORITY_LABELS, 'normal', errors),
    document_kind: readChoice(body, 'document_kind', INCOMING_KIND_LABELS, 'new', errors),
    transfer_method: readChoice(body, 'transfer_method', INCOMING_TRANSFER_LABELS, 'hand', errors),
    copy_type: readChoice(body, 'copy_type', INCOMING_COPY_LABELS, 'original', errors),
    has_paper: readBoolean(body, 'has_paper', errors),
    processing_note: readText(body, 'processing_note', errors, { maximum: MAXIMUM_LONG_TEXT }),
  };
  // Đơn vị ban hành chọn ở danh mục Đơn vị bên ngoài hoặc nhập tên
  if (!input.issuer_unit_id && !input.issuer_name) {
    errors.push({ field: 'issuer_name', message: 'Chọn hoặc nhập đơn vị ban hành' });
  }
  return input;
}

export function parseRegistration(body: RequestBody, errors: FieldError[]): RegistrationInput {
  return {
    book_id: readUuid(body, 'book_id', errors, true) ?? '',
    arrival_number: readInteger(body, 'arrival_number', errors, { min: 1, max: 9_999_999 }),
    arrival_date: readDate(body, 'arrival_date', errors, true) ?? '',
  };
}

// ---- Luồng xử lý ----

export interface TransferRecipient {
  user_id: string;
  role: IncomingAssignmentRole;
  deadline: string | null;
}

export type TransferMode = 'leader' | 'process' | 'rotate';
const TRANSFER_MODES: TransferMode[] = ['leader', 'process', 'rotate'];
const PROCESS_ROLES: IncomingAssignmentRole[] = ['main', 'coordinate', 'view'];

export interface TransferInput {
  mode: TransferMode;
  recipients: TransferRecipient[];
  note: string | null;
  deadline: string | null;
}

export function parseTransfer(body: RequestBody): TransferInput {
  const errors: FieldError[] = [];
  const mode = body?.mode as TransferMode;
  if (!TRANSFER_MODES.includes(mode)) {
    errors.push({ field: 'mode', message: 'Chọn Trình lãnh đạo, Chuyển xử lý hoặc Luân chuyển' });
  }
  const raw = body?.recipients;
  const recipients: TransferRecipient[] = [];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    errors.push({ field: 'recipients', message: 'Chọn từ 1 đến 100 người nhận' });
  } else {
    raw.forEach((item: RequestBody, index) => {
      const role = mode === 'leader' ? 'leader' : (item?.role as IncomingAssignmentRole);
      if (!isUuid(item?.user_id)) {
        errors.push({ field: `recipients.${index}.user_id`, message: 'Mã người nhận không hợp lệ' });
      }
      if (mode !== 'leader' && !PROCESS_ROLES.includes(role)) {
        errors.push({ field: `recipients.${index}.role`, message: 'Chọn Xử lý chính, Phối hợp hoặc Xem để biết' });
      }
      const deadline = item?.deadline;
      if (deadline !== undefined && deadline !== null && deadline !== '' && !isDate(deadline)) {
        errors.push({ field: `recipients.${index}.deadline`, message: 'Ngày dạng YYYY-MM-DD' });
      }
      recipients.push({ user_id: item?.user_id as string, role, deadline: isDate(deadline) ? deadline : null });
    });
  }
  const users = recipients.map((recipient) => recipient.user_id);
  if (new Set(users).size !== users.length) {
    errors.push({ field: 'recipients', message: 'Mỗi người chỉ nhận một vai trò trong một lần chuyển' });
  }
  if (recipients.filter((recipient) => recipient.role === 'main').length > 1) {
    errors.push({ field: 'recipients', message: 'Mỗi lần chuyển chỉ có một người xử lý chính' });
  }
  if (mode === 'rotate' && recipients.length !== 1) {
    errors.push({ field: 'recipients', message: 'Luân chuyển cho đúng một người' });
  }
  const note = readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT });
  const deadline = readDate(body, 'deadline', errors);
  throwIfAny(errors);
  return { mode, recipients, note, deadline };
}

// ---- Danh sách ----

export const LIST_VIEWS = [
  'inbox',
  'processed',
  'registered',
  'processing',
  'completed',
  'for_information',
  'starred',
  'followed',
  'search',
  'interconnect',
] as const;
export type ListView = (typeof LIST_VIEWS)[number];
export const ROLE_FILTERS = ['all', 'main', 'coordinate', 'view'] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number];

export interface IncomingListFilter {
  view: ListView;
  role: RoleFilter;
  q: string | null;
  symbol: string | null;
  arrival_number: number | null;
  issuer: string | null;
  arrival_from: string | null;
  arrival_to: string | null;
  book_id: string | null;
  form_id: string | null;
  urgency_id: string | null;
  overdue: boolean;
  due_soon: boolean;
}

const queryText = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

export function readListFilter(query: Record<string, unknown>): IncomingListFilter {
  const errors: FieldError[] = [];
  const view = (queryText(query.view) ?? 'inbox') as ListView;
  if (!LIST_VIEWS.includes(view)) {
    errors.push({ field: 'view', message: 'Danh sách không hợp lệ' });
  }
  const role = (queryText(query.role) ?? 'all') as RoleFilter;
  if (!ROLE_FILTERS.includes(role)) {
    errors.push({ field: 'role', message: 'Vai trò không hợp lệ' });
  }
  const uuid = (field: string) => {
    const value = queryText(query[field]);
    if (value && !isUuid(value)) {
      errors.push({ field, message: 'Mã không hợp lệ' });
      return null;
    }
    return value;
  };
  const date = (field: string) => {
    const value = queryText(query[field]);
    if (value && !isDate(value)) {
      errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      return null;
    }
    return value;
  };
  const numberText = queryText(query.arrival_number);
  const arrivalNumber = numberText === null ? null : Number(numberText);
  if (arrivalNumber !== null && (!Number.isInteger(arrivalNumber) || arrivalNumber < 1)) {
    errors.push({ field: 'arrival_number', message: 'Số đến là số nguyên dương' });
  }
  const filter: IncomingListFilter = {
    view,
    role,
    q: queryText(query.q),
    symbol: queryText(query.symbol),
    arrival_number: arrivalNumber,
    issuer: queryText(query.issuer),
    arrival_from: date('arrival_from'),
    arrival_to: date('arrival_to'),
    book_id: uuid('book_id'),
    form_id: uuid('form_id'),
    urgency_id: uuid('urgency_id'),
    overdue: query.overdue === 'true',
    due_soon: query.due_soon === 'true',
  };
  throwIfAny(errors);
  return filter;
}

// Ký tự đại diện của LIKE trong chữ người dùng nhập được hiểu đúng là ký tự
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

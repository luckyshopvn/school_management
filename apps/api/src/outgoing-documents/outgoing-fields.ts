import type { IncomingDocumentKind } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import { INCOMING_KIND_LABELS } from '@school-management/shared';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import {
  isDate,
  MAXIMUM_LONG_TEXT,
  readBoolean,
  readChoice,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from '../incoming-documents/incoming-fields.js';

// Đọc và kiểm tra dữ liệu gửi lên của văn bản đi (DT-18 phần 18b, YCTD-140); dùng chung các hàm đọc của văn bản đến (18a),
// lỗi gom lại trả một lần ERR_VALIDATION
const MEETING_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
export const MAXIMUM_RECIPIENTS = 200;

// ---- Biểu mẫu văn bản đi của iOffice ----

export interface OutgoingDocumentInput {
  submission_number: string | null;
  summary: string;
  form_id: string | null;
  urgency_id: string | null;
  secrecy_id: string | null;
  field_id: string | null;
  document_kind: IncomingDocumentKind;
  priority: boolean;
  meeting_at: Date | null;
  meeting_place: string | null;
  insert_qr: boolean;
  drafter_id: string | null;
  drafting_unit_id: string | null;
  signer_id: string | null;
  content_note: string | null;
  reply_to_id: string | null;
}

export interface RecipientInput {
  external_unit_id: string | null;
  org_unit_id: string | null;
}

export interface LinkInput {
  link_type: 'related' | 'original';
  outgoing_id: string | null;
  incoming_id: string | null;
}

export function parseOutgoingInput(body: RequestBody, errors: FieldError[]): OutgoingDocumentInput {
  const meeting = body?.meeting_at;
  let meetingAt: Date | null = null;
  if (meeting !== undefined && meeting !== null && meeting !== '') {
    if (typeof meeting !== 'string' || !MEETING_TIME.test(meeting) || Number.isNaN(Date.parse(meeting))) {
      errors.push({ field: 'meeting_at', message: 'Thời gian họp dạng YYYY-MM-DDTHH:mm' });
    } else {
      meetingAt = new Date(meeting);
    }
  }
  return {
    submission_number: readText(body, 'submission_number', errors, { maximum: 50 }),
    summary: readText(body, 'summary', errors, { required: true, maximum: 2000 }) ?? '',
    form_id: readUuid(body, 'form_id', errors),
    urgency_id: readUuid(body, 'urgency_id', errors),
    secrecy_id: readUuid(body, 'secrecy_id', errors),
    field_id: readUuid(body, 'field_id', errors),
    document_kind: readChoice(body, 'document_kind', INCOMING_KIND_LABELS, 'new', errors),
    priority: readBoolean(body, 'priority', errors),
    meeting_at: meetingAt,
    meeting_place: readText(body, 'meeting_place', errors, { maximum: 300 }),
    insert_qr: readBoolean(body, 'insert_qr', errors, true),
    drafter_id: readUuid(body, 'drafter_id', errors),
    drafting_unit_id: readUuid(body, 'drafting_unit_id', errors),
    signer_id: readUuid(body, 'signer_id', errors),
    content_note: readText(body, 'content_note', errors, { maximum: MAXIMUM_LONG_TEXT }),
    reply_to_id: readUuid(body, 'reply_to_id', errors),
  };
}

// Đơn vị dự kiến nhận: mỗi dòng một đơn vị bên ngoài (danh mục 2.2) hoặc một đơn vị trong trường (cây đơn vị năm học)
export function parseRecipients(body: RequestBody, errors: FieldError[]): RecipientInput[] | undefined {
  const raw = body?.recipients;
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.length > MAXIMUM_RECIPIENTS) {
    errors.push({ field: 'recipients', message: `Tối đa ${MAXIMUM_RECIPIENTS} đơn vị nhận` });
    return [];
  }
  const recipients: RecipientInput[] = [];
  raw.forEach((item: RequestBody, index) => {
    const external = item?.external_unit_id;
    const internal = item?.org_unit_id;
    const externalId = isUuid(external) ? external : null;
    const internalId = isUuid(internal) ? internal : null;
    if ((externalId === null) === (internalId === null)) {
      errors.push({ field: `recipients.${index}`, message: 'Chọn một đơn vị bên ngoài hoặc một đơn vị trong trường' });
      return;
    }
    recipients.push({ external_unit_id: externalId, org_unit_id: internalId });
  });
  const keys = recipients.map((recipient) => recipient.external_unit_id ?? recipient.org_unit_id);
  if (new Set(keys).size !== keys.length) {
    errors.push({ field: 'recipients', message: 'Mỗi đơn vị nhận chỉ chọn một lần' });
  }
  return recipients;
}

// Văn bản liên quan, văn bản gốc: chọn văn bản đi hoặc văn bản đến khác
export function parseLinks(body: RequestBody, errors: FieldError[]): LinkInput[] | undefined {
  const raw = body?.links;
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.length > 50) {
    errors.push({ field: 'links', message: 'Tối đa 50 văn bản liên quan' });
    return [];
  }
  const links: LinkInput[] = [];
  raw.forEach((item: RequestBody, index) => {
    const type = item?.link_type ?? 'related';
    const outgoing = isUuid(item?.outgoing_id) ? item.outgoing_id : null;
    const incoming = isUuid(item?.incoming_id) ? item.incoming_id : null;
    if ((type !== 'related' && type !== 'original') || (outgoing === null) === (incoming === null)) {
      errors.push({ field: `links.${index}`, message: 'Chọn loại liên kết và một văn bản đi hoặc văn bản đến' });
      return;
    }
    links.push({ link_type: type, outgoing_id: outgoing, incoming_id: incoming });
  });
  return links;
}

// ---- Lấy ý kiến ----

export interface ConsultInput {
  user_ids: string[];
  deadline: string | null;
  note: string | null;
}

export function parseConsult(body: RequestBody): ConsultInput {
  const errors: FieldError[] = [];
  const userIds = readUuidList(body, 'user_ids', errors, 100);
  if (userIds.length === 0 && !errors.some((error) => error.field === 'user_ids')) {
    errors.push({ field: 'user_ids', message: 'Chọn người cho ý kiến' });
  }
  const input = {
    user_ids: userIds,
    deadline: readDate(body, 'deadline', errors),
    note: readText(body, 'note', errors, { maximum: MAXIMUM_LONG_TEXT }),
  };
  throwIfAny(errors);
  return input;
}

// ---- Cấp số và phát hành ----

export interface IssueInput {
  book_id: string;
  // Trống thì cấp số kế tiếp của sổ
  issue_number: number | null;
  // Phần sau số của số ký hiệu, ví dụ QĐ-THCS: số ký hiệu là "số/QĐ-THCS"
  symbol_suffix: string | null;
  issue_date: string;
  copies: number;
}

export function parseIssue(body: RequestBody): IssueInput {
  const errors: FieldError[] = [];
  const suffix = readText(body, 'symbol_suffix', errors, { maximum: 80 });
  if (suffix && !/^[^\s/][^/]*$/.test(suffix)) {
    errors.push({ field: 'symbol_suffix', message: 'Phần ký hiệu không bắt đầu bằng khoảng trắng, không có dấu "/"' });
  }
  const input: IssueInput = {
    book_id: readUuid(body, 'book_id', errors, true) ?? '',
    issue_number: readInteger(body, 'issue_number', errors, { min: 1, max: 9_999_999 }),
    symbol_suffix: suffix,
    issue_date: readDate(body, 'issue_date', errors, true) ?? '',
    copies: readInteger(body, 'copies', errors, { min: 1, max: 9999 }, 1) ?? 1,
  };
  throwIfAny(errors);
  return input;
}

export function symbolOf(number: number, suffix: string | null): string {
  return suffix ? `${number}/${suffix}` : String(number);
}

// ---- Danh sách ----

export const OUTGOING_LIST_VIEWS = ['drafts', 'pending', 'processed', 'to_issue', 'issued', 'search'] as const;
export type OutgoingListView = (typeof OUTGOING_LIST_VIEWS)[number];

export interface OutgoingListFilter {
  view: OutgoingListView;
  q: string | null;
  symbol: string | null;
  issue_number: number | null;
  signer: string | null;
  issue_from: string | null;
  issue_to: string | null;
  book_id: string | null;
  form_id: string | null;
  urgency_id: string | null;
  published: boolean;
}

const queryText = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

export function readOutgoingFilter(query: Record<string, unknown>): OutgoingListFilter {
  const errors: FieldError[] = [];
  const view = (queryText(query.view) ?? 'drafts') as OutgoingListView;
  if (!OUTGOING_LIST_VIEWS.includes(view)) {
    errors.push({ field: 'view', message: 'Danh sách không hợp lệ' });
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
  const numberText = queryText(query.issue_number);
  const issueNumber = numberText === null ? null : Number(numberText);
  if (issueNumber !== null && (!Number.isInteger(issueNumber) || issueNumber < 1)) {
    errors.push({ field: 'issue_number', message: 'Số đi là số nguyên dương' });
  }
  const filter: OutgoingListFilter = {
    view,
    q: queryText(query.q),
    symbol: queryText(query.symbol),
    issue_number: issueNumber,
    signer: queryText(query.signer),
    issue_from: date('issue_from'),
    issue_to: date('issue_to'),
    book_id: uuid('book_id'),
    form_id: uuid('form_id'),
    urgency_id: uuid('urgency_id'),
    published: query.published === 'true',
  };
  throwIfAny(errors);
  return filter;
}

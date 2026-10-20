import type {
  DocumentCatalogKind,
  IncomingAssignmentRole,
  IncomingAssignmentStatus,
  IncomingCopyType,
  IncomingDocumentAuthority,
  IncomingDocumentKind,
  IncomingDocumentStatus,
  IncomingTransferMethod,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138)
export type IncomingListView =
  | 'inbox'
  | 'processed'
  | 'registered'
  | 'processing'
  | 'completed'
  | 'for_information'
  | 'starred'
  | 'followed'
  | 'search'
  | 'interconnect';
export type IncomingRoleFilter = 'all' | 'main' | 'coordinate' | 'view';
export type IncomingAction =
  | 'update'
  | 'delete'
  | 'register'
  | 'acknowledge'
  | 'submit_leader'
  | 'transfer'
  | 'rotate'
  | 'return'
  | 'refuse'
  | 'finish'
  | 'revoke'
  | 'request_extension'
  | 'decide_extension'
  | 'complete'
  | 'restrict'
  | 'reply'
  | 'archive'
  | 'upload';
export type SlipType = 'submission' | 'processing' | 'handover';

export interface CatalogItem {
  id: string;
  kind: DocumentCatalogKind;
  code: string;
  name: string;
  level: number;
  education_level: string | null;
  sort_order: number;
  active: boolean;
}

export interface ExternalUnit {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  electronic_code: string | null;
  sort_order: number;
  active: boolean;
  group_names: string[];
}

export interface ExternalUnitGroup {
  id: string;
  name: string;
  note: string | null;
  sort_order: number;
  unit_ids: string[];
  unit_names: string[];
}

export interface DocumentLeader {
  user_id: string;
  user_name: string;
  title: string | null;
  sort_order: number;
}

export interface StaffAccount {
  user_id: string;
  full_name: string;
  org_unit_name: string | null;
  department_name: string | null;
  job_title_name: string | null;
}

export interface DocumentBook {
  id: string;
  direction: 'incoming' | 'outgoing';
  name: string;
  org_unit_id: string | null;
  org_unit_name: string | null;
  year: number;
  start_number: number;
  start_date: string;
  end_date: string | null;
  sort_order: number;
  document_count: number;
  next_number: number;
  followers: Array<{ user_id: string; user_name: string }>;
  admins: Array<{ user_id: string; user_name: string }>;
}

export interface IncomingListItem {
  id: string;
  book_id: string | null;
  book_name: string | null;
  arrival_number: number | null;
  arrival_date: string | null;
  summary: string;
  symbol: string;
  issuer_name: string;
  document_date: string;
  deadline: string | null;
  effective_deadline: string | null;
  status: IncomingDocumentStatus;
  restricted: boolean;
  source: 'manual' | 'interconnect' | 'internal';
  interconnect_status: 'received' | 'acknowledged' | null;
  received_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  form_name: string | null;
  urgency_name: string | null;
  urgency_level: number | null;
  secrecy_name: string | null;
  secrecy_level: number | null;
  starred: boolean;
  followed: boolean;
  my_role: IncomingAssignmentRole | null;
  my_status: IncomingAssignmentStatus | null;
  unread: boolean;
  overdue: boolean;
  due_soon: boolean;
  main_handler_name: string | null;
  directed: boolean;
  file_count: number;
  updated_at: string;
}

export interface IncomingAssignment {
  id: string;
  parent_id: string | null;
  user_id: string;
  user_name: string;
  user_title: string | null;
  role: IncomingAssignmentRole;
  status: IncomingAssignmentStatus;
  deadline: string | null;
  note: string | null;
  result_note: string | null;
  assigned_by_name: string;
  created_at: string;
  read_at: string | null;
  finished_at: string | null;
  extension_until: string | null;
  extension_reason: string | null;
  extension_status: 'requested' | 'approved' | 'rejected' | null;
  extension_decided_by_name: string | null;
  overdue: boolean;
  due_soon: boolean;
}

export interface IncomingFile {
  id: string;
  kind: 'main' | 'related';
  file_name: string;
  content_type: string;
  size_bytes: number;
  scanned: boolean;
  created_by_name: string;
  created_at: string;
}

export interface IncomingDocument {
  id: string;
  book_id: string | null;
  book_name: string | null;
  arrival_number: number | null;
  arrival_date: string | null;
  summary: string;
  symbol: string;
  issuer_unit_id: string | null;
  issuer_name: string;
  document_date: string;
  form_id: string | null;
  form_name: string | null;
  urgency_id: string | null;
  urgency_name: string | null;
  urgency_level: number | null;
  secrecy_id: string | null;
  secrecy_name: string | null;
  field_id: string | null;
  field_name: string | null;
  deadline: string | null;
  authority: IncomingDocumentAuthority;
  document_kind: IncomingDocumentKind;
  transfer_method: IncomingTransferMethod;
  copy_type: IncomingCopyType;
  has_paper: boolean;
  processing_note: string | null;
  status: IncomingDocumentStatus;
  restricted: boolean;
  restricted_by_name: string | null;
  source: 'manual' | 'interconnect' | 'internal';
  interconnect_status: 'received' | 'acknowledged' | null;
  interconnect_reference: string | null;
  received_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  reply_symbol: string | null;
  reply_date: string | null;
  reply_note: string | null;
  replied_by_name: string | null;
  archive_record_id: string | null;
  archive_record_code: string | null;
  archive_record_title: string | null;
  archived_by_name: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  completion_note: string | null;
  registered_by_name: string | null;
  // Liên thông nội bộ từ văn bản đi của trường (DT-18 phần 18b)
  outgoing_document_id: string | null;
  recipient_org_unit_name: string | null;
  created_by_name: string;
  updated_at: string;
  overdue: boolean;
  due_soon: boolean;
  starred: boolean;
  followed: boolean;
  files: IncomingFile[];
  related: Array<{
    id: string;
    symbol: string;
    summary: string;
    arrival_number: number | null;
    arrival_date: string | null;
  }>;
  assignments: IncomingAssignment[];
  events: Array<{ id: string; action: string; note: string | null; actor_name: string; created_at: string }>;
  my_pending_assignment_id: string | null;
  actions: IncomingAction[];
  exchange: { connected: boolean; description: string };
}

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
  arrival_number: number | null;
  arrival_date: string;
}

export interface IncomingFilter {
  view: IncomingListView;
  role?: IncomingRoleFilter;
  q?: string;
  symbol?: string;
  arrival_number?: string;
  issuer?: string;
  arrival_from?: string;
  arrival_to?: string;
  book_id?: string;
  form_id?: string;
  urgency_id?: string;
  overdue?: boolean;
  due_soon?: boolean;
}

export interface TransferRecipientInput {
  user_id: string;
  role?: IncomingAssignmentRole;
  deadline?: string | null;
}

export interface BatchResult {
  id: string;
  ok: boolean;
  message: string | null;
}

const BASE = '/api/v1/incoming-documents';
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function query(values: Record<string, string | number | boolean | undefined | null>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      parameters.set(key, String(value));
    }
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}

// ---- Văn bản đến ----

export const listIncoming = (
  filter: IncomingFilter & { page: number; pageSize: number },
): Promise<{ items: IncomingListItem[]; total: number }> => {
  const { pageSize, ...rest } = filter;
  return requestJson(`${BASE}${query({ ...rest, page_size: pageSize })}`);
};

export const readIncoming = (id: string): Promise<IncomingDocument> => requestJson(`${BASE}/${id}`);
export const nextArrivalNumber = (bookId: string): Promise<{ next_number: number }> =>
  requestJson(`${BASE}/next-number${query({ book_id: bookId })}`);
export const createIncoming = (input: IncomingDocumentInput & RegistrationInput): Promise<IncomingDocument> =>
  requestJson(BASE, json('POST', input));
export const receiveInterconnect = (input: IncomingDocumentInput): Promise<IncomingDocument> =>
  requestJson(`${BASE}/interconnect`, json('POST', input));
export const updateIncoming = (id: string, input: IncomingDocumentInput): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}`, json('PUT', input));
export const deleteIncoming = (id: string): Promise<void> => requestJson(`${BASE}/${id}`, json('DELETE'));
export const registerIncoming = (id: string, input: RegistrationInput): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/register`, json('POST', input));
export const acknowledgeIncoming = (
  id: string,
  acknowledged: boolean,
  reference: string | null,
): Promise<IncomingDocument> => requestJson(`${BASE}/${id}/acknowledge`, json('POST', { acknowledged, reference }));

export function uploadIncomingFile(
  id: string,
  file: File,
  options: { kind: 'main' | 'related'; scanned: boolean },
): Promise<IncomingDocument> {
  const form = new FormData();
  form.set('file', file, file.name);
  form.set('kind', options.kind);
  form.set('scanned', String(options.scanned));
  return requestJson(`${BASE}/${id}/files`, { method: 'POST', body: form });
}

export const deleteIncomingFile = (id: string, fileId: string): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/files/${fileId}`, json('DELETE'));

export async function downloadIncomingFile(id: string, file: IncomingFile): Promise<void> {
  const response = await fetchWithSession(`${BASE}/${id}/files/${file.id}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), '', file.file_name);
}

export async function downloadSlip(id: string, type: SlipType): Promise<void> {
  const response = await fetchWithSession(`${BASE}/${id}/slips/${type}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', `${type}.pdf`);
}

export const setRelations = (id: string, relatedIds: string[]): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/relations`, json('PUT', { related_ids: relatedIds }));
export const transferIncoming = (
  id: string,
  input: {
    mode: 'leader' | 'process' | 'rotate';
    recipients: TransferRecipientInput[];
    note: string | null;
    deadline: string | null;
  },
): Promise<IncomingDocument> => requestJson(`${BASE}/${id}/transfer`, json('POST', input));
export const returnIncoming = (id: string, note: string): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/return`, json('POST', { note }));
export const refuseIncoming = (id: string, note: string): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/refuse`, json('POST', { note }));
export const revokeIncoming = (id: string): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/revoke`, json('POST'));
export const finishIncoming = (id: string, note: string | null): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/finish`, json('POST', { note }));
export const requestExtension = (id: string, until: string, reason: string): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/extension`, json('POST', { until, reason }));
export const decideExtension = (
  id: string,
  assignmentId: string,
  approve: boolean,
  note: string | null,
): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/extension/decide`, json('POST', { assignment_id: assignmentId, approve, note }));
export const completeIncoming = (id: string, note: string | null): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/complete`, json('POST', { note }));
export const completeMany = (ids: string[], note: string | null): Promise<BatchResult[]> =>
  requestJson(`${BASE}/complete`, json('POST', { ids, note }));
export const archiveMany = (ids: string[], archiveRecordId: string): Promise<BatchResult[]> =>
  requestJson(`${BASE}/archive`, json('POST', { ids, archive_record_id: archiveRecordId }));
export const restrictIncoming = (id: string, restricted: boolean): Promise<IncomingDocument> =>
  requestJson(`${BASE}/${id}/restrict`, json('POST', { restricted }));
export const replyIncoming = (
  id: string,
  input: { reply_symbol: string; reply_date: string; note: string | null },
): Promise<IncomingDocument> => requestJson(`${BASE}/${id}/reply`, json('POST', input));
export const setFlags = (
  ids: string[],
  flags: { starred?: boolean; followed?: boolean },
): Promise<{ updated: number }> => requestJson(`${BASE}/flags`, json('POST', { ids, ...flags }));
export const markUnread = (id: string): Promise<{ unread: boolean }> =>
  requestJson(`${BASE}/${id}/unread`, json('POST'));

// ---- Quản trị văn bản ----

export const listCatalog = (kind?: DocumentCatalogKind): Promise<CatalogItem[]> =>
  requestJson(`/api/v1/document-catalogs${query({ kind })}`);
export const saveCatalog = (id: string | null, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> =>
  requestJson(id ? `/api/v1/document-catalogs/${id}` : '/api/v1/document-catalogs', json(id ? 'PUT' : 'POST', input));
export const deleteCatalog = (id: string): Promise<void> =>
  requestJson(`/api/v1/document-catalogs/${id}`, json('DELETE'));

export const listExternalUnits = (search?: string): Promise<ExternalUnit[]> =>
  requestJson(`/api/v1/external-units${query({ q: search })}`);
export const saveExternalUnit = (
  id: string | null,
  input: Omit<ExternalUnit, 'id' | 'group_names'>,
): Promise<ExternalUnit> =>
  requestJson(id ? `/api/v1/external-units/${id}` : '/api/v1/external-units', json(id ? 'PUT' : 'POST', input));
export const deleteExternalUnit = (id: string): Promise<void> =>
  requestJson(`/api/v1/external-units/${id}`, json('DELETE'));

export const listUnitGroups = (): Promise<ExternalUnitGroup[]> => requestJson('/api/v1/external-unit-groups');
export const saveUnitGroup = (
  id: string | null,
  input: { name: string; note: string | null; sort_order: number; unit_ids: string[] },
): Promise<ExternalUnitGroup> =>
  requestJson(
    id ? `/api/v1/external-unit-groups/${id}` : '/api/v1/external-unit-groups',
    json(id ? 'PUT' : 'POST', input),
  );
export const deleteUnitGroup = (id: string): Promise<void> =>
  requestJson(`/api/v1/external-unit-groups/${id}`, json('DELETE'));

export const listLeaders = (): Promise<DocumentLeader[]> => requestJson('/api/v1/document-leaders');
export const saveLeaders = (leaders: Array<{ user_id: string; title: string | null }>): Promise<DocumentLeader[]> =>
  requestJson('/api/v1/document-leaders', json('PUT', { leaders }));
export const listDocumentStaff = (): Promise<StaffAccount[]> => requestJson('/api/v1/document-staff');

export const listBooks = (year?: number, direction: 'incoming' | 'outgoing' = 'incoming'): Promise<DocumentBook[]> =>
  requestJson(`/api/v1/document-books${query({ direction, year })}`);
export const saveBook = (
  id: string | null,
  input: {
    name: string;
    org_unit_id: string | null;
    year: number | string;
    start_number: number | string;
    start_date: string;
    end_date: string | null;
    sort_order: number;
    follower_ids: string[];
    admin_ids: string[];
  },
  direction: 'incoming' | 'outgoing' = 'incoming',
): Promise<DocumentBook> =>
  requestJson(
    id ? `/api/v1/document-books/${id}` : '/api/v1/document-books',
    json(id ? 'PUT' : 'POST', { direction, ...input }),
  );
export const deleteBook = (id: string): Promise<void> => requestJson(`/api/v1/document-books/${id}`, json('DELETE'));

export interface RegisterRow {
  id: string;
  arrival_date: string;
  arrival_number: number;
  issuer_name: string;
  symbol: string;
  document_date: string;
  summary: string;
  recipients: string;
  form_name: string | null;
  urgency_name: string | null;
  field_name: string | null;
  main_handler: string;
}

export const readRegister = (bookId: string, from: string, to: string): Promise<{ items: RegisterRow[] }> =>
  requestJson(`/api/v1/document-books/${bookId}/register${query({ from, to })}`);

export async function exportRegister(bookId: string, from: string, to: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/document-books/${bookId}/register/export${query({ from, to })}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'so-van-ban-den.xlsx');
}

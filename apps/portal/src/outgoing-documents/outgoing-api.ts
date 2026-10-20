import type {
  IncomingDocumentKind,
  OutgoingDocumentStatus,
  OutgoingFileKind,
  OutgoingOpinionStatus,
  OutgoingRecipientType,
  OutgoingSendStatus,
} from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';
import type { BatchResult } from '../incoming-documents/incoming-api.js';

// Văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140)
export type OutgoingListView = 'drafts' | 'pending' | 'processed' | 'to_issue' | 'issued' | 'search';
export type OutgoingAction =
  | 'update'
  | 'delete'
  | 'upload'
  | 'consult'
  | 'end_consult'
  | 'opinion'
  | 'finish_opinion'
  | 'submit'
  | 'revoke'
  | 'sign'
  | 'decline'
  | 'return'
  | 'issue'
  | 'send'
  | 'publish'
  | 'freeze'
  | 'archive';

export interface OutgoingListItem {
  id: string;
  eoffice_number: number;
  submission_number: string | null;
  summary: string;
  status: OutgoingDocumentStatus;
  priority: boolean;
  drafter_name: string;
  drafting_unit_name: string | null;
  signer_name: string | null;
  book_id: string | null;
  book_name: string | null;
  issue_number: number | null;
  symbol: string | null;
  issue_date: string | null;
  copies: number | null;
  published: boolean;
  frozen: boolean;
  form_name: string | null;
  urgency_name: string | null;
  urgency_level: number | null;
  secrecy_name: string | null;
  pending_recipients: number;
  updated_at: string;
}

export interface OutgoingFile {
  id: string;
  kind: OutgoingFileKind;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  created_by_name: string;
  created_at: string;
}

export interface OutgoingOpinion {
  id: string;
  round: number;
  user_id: string;
  user_name: string;
  user_title: string | null;
  status: OutgoingOpinionStatus;
  deadline: string | null;
  request_note: string | null;
  opinion: string | null;
  answered_at: string | null;
  requested_by_name: string;
  created_at: string;
}

export interface OutgoingRecipient {
  id: string;
  recipient_type: OutgoingRecipientType;
  external_unit_id: string | null;
  org_unit_id: string | null;
  name: string;
  electronic_code: string | null;
  send_status: OutgoingSendStatus;
  sent_at: string | null;
  sent_by_name: string | null;
  reference: string | null;
  incoming_document_id: string | null;
}

export interface OutgoingLink {
  id: string;
  link_type: 'related' | 'original';
  outgoing_id: string | null;
  incoming_id: string | null;
  symbol: string | null;
  summary: string | null;
}

export interface OutgoingDocument {
  id: string;
  eoffice_number: number;
  submission_number: string | null;
  summary: string;
  form_id: string | null;
  form_name: string | null;
  urgency_id: string | null;
  urgency_name: string | null;
  urgency_level: number | null;
  secrecy_id: string | null;
  secrecy_name: string | null;
  secrecy_level: number | null;
  field_id: string | null;
  field_name: string | null;
  document_kind: IncomingDocumentKind;
  priority: boolean;
  meeting_at: string | null;
  meeting_place: string | null;
  insert_qr: boolean;
  drafter_id: string;
  drafter_name: string;
  drafting_unit_id: string | null;
  drafting_unit_name: string | null;
  signer_id: string | null;
  signer_name: string | null;
  signer_title: string | null;
  content_note: string | null;
  status: OutgoingDocumentStatus;
  return_note: string | null;
  returned_at: string | null;
  returned_by_name: string | null;
  submitted_at: string | null;
  signed_at: string | null;
  signature_method: string | null;
  verification_code: string | null;
  book_id: string | null;
  book_name: string | null;
  issue_number: number | null;
  symbol: string | null;
  issue_date: string | null;
  copies: number | null;
  issued_at: string | null;
  issued_by_name: string | null;
  published: boolean;
  published_at: string | null;
  published_by_name: string | null;
  frozen: boolean;
  frozen_at: string | null;
  frozen_by_name: string | null;
  archive_record_code: string | null;
  archive_record_title: string | null;
  archived_by_name: string | null;
  reply_to_id: string | null;
  reply_to_symbol: string | null;
  reply_to_summary: string | null;
  created_by_name: string;
  updated_at: string;
  files: OutgoingFile[];
  links: OutgoingLink[];
  opinions: OutgoingOpinion[];
  recipients: OutgoingRecipient[];
  events: Array<{ id: string; action: string; note: string | null; actor_name: string; created_at: string }>;
  my_open_opinion_id: string | null;
  actions: OutgoingAction[];
  exchange: { connected: boolean; description: string };
  signer_description: string;
}

export interface OutgoingDocumentInput {
  submission_number: string | null;
  summary: string;
  form_id: string | null;
  urgency_id: string | null;
  secrecy_id: string | null;
  field_id: string | null;
  document_kind: IncomingDocumentKind;
  priority: boolean;
  meeting_at: string | null;
  meeting_place: string | null;
  insert_qr: boolean;
  drafter_id: string | null;
  drafting_unit_id: string | null;
  signer_id: string | null;
  content_note: string | null;
  reply_to_id: string | null;
  recipients: Array<{ external_unit_id?: string; org_unit_id?: string }>;
  links: Array<{ link_type: 'related' | 'original'; outgoing_id?: string; incoming_id?: string }>;
}

export interface OutgoingFilter {
  view: OutgoingListView;
  q?: string;
  symbol?: string;
  issue_number?: string;
  signer?: string;
  issue_from?: string;
  issue_to?: string;
  book_id?: string;
  form_id?: string;
  urgency_id?: string;
  published?: boolean;
}

export interface RecipientRow {
  id: string;
  document_id: string;
  recipient_type: OutgoingRecipientType;
  name: string;
  electronic_code: string | null;
  send_status: OutgoingSendStatus;
  sent_at: string | null;
  sent_by_name: string | null;
  reference: string | null;
  symbol: string;
  summary: string;
  issue_date: string;
  frozen: boolean;
}

export interface OutgoingRegisterRow {
  id: string;
  issue_date: string;
  issue_number: number;
  symbol: string;
  summary: string;
  signer_name: string | null;
  drafting_unit_name: string | null;
  copies: number | null;
  recipients: string;
  form_name: string | null;
  urgency_name: string | null;
  field_name: string | null;
}

export interface VerificationResult {
  code: string;
  school_name: string | null;
  issued: boolean;
  symbol: string | null;
  issue_date: string | null;
  summary: string | null;
  signer_name: string | null;
  signer_title: string | null;
  signed_at: string | null;
  internal_signature: boolean;
  signed_sha256: string | null;
  signed_size_bytes: number | null;
}

const BASE = '/api/v1/outgoing-documents';
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

export const listOutgoing = (
  filter: OutgoingFilter & { page: number; pageSize: number },
): Promise<{ items: OutgoingListItem[]; total: number }> => {
  const { pageSize, ...rest } = filter;
  return requestJson(`${BASE}${query({ ...rest, page_size: pageSize })}`);
};
export const listRecipients = (status: OutgoingSendStatus | 'all'): Promise<RecipientRow[]> =>
  requestJson(`${BASE}/recipients${query({ status })}`);
export const readOutgoing = (id: string): Promise<OutgoingDocument> => requestJson(`${BASE}/${id}`);
export const createOutgoing = (input: OutgoingDocumentInput): Promise<OutgoingDocument> =>
  requestJson(BASE, json('POST', input));
export const updateOutgoing = (id: string, input: OutgoingDocumentInput): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}`, json('PUT', input));
export const deleteOutgoing = (id: string): Promise<void> => requestJson(`${BASE}/${id}`, json('DELETE'));
export const nextIssueNumber = (bookId: string): Promise<{ next_number: number }> =>
  requestJson(`${BASE}/next-number${query({ book_id: bookId })}`);

export function uploadOutgoingFile(id: string, file: File, kind: OutgoingFileKind): Promise<OutgoingDocument> {
  const form = new FormData();
  form.set('file', file, file.name);
  form.set('kind', kind);
  return requestJson(`${BASE}/${id}/files`, { method: 'POST', body: form });
}

export const deleteOutgoingFile = (id: string, fileId: string): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/files/${fileId}`, json('DELETE'));

export async function downloadOutgoingFile(id: string, file: OutgoingFile): Promise<void> {
  const response = await fetchWithSession(`${BASE}/${id}/files/${file.id}`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), '', file.file_name);
}

export async function downloadOutgoingSlip(id: string): Promise<void> {
  const response = await fetchWithSession(`${BASE}/${id}/slip`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'phieu-trinh-ky.pdf');
}

export const consultOutgoing = (
  id: string,
  input: { user_ids: string[]; deadline: string | null; note: string | null },
): Promise<OutgoingDocument> => requestJson(`${BASE}/${id}/consult`, json('POST', input));
export const endConsultation = (id: string): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/consult/end`, json('POST'));
export const giveOpinion = (id: string, input: { opinion: string | null; finish: boolean }): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/opinion`, json('POST', input));
export const submitOutgoing = (id: string, input: { signer_id: string | null; note: string | null }) =>
  requestJson<OutgoingDocument>(`${BASE}/${id}/submit`, json('POST', input));
export const revokeOutgoing = (id: string): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/revoke`, json('POST'));
export const signOutgoing = (id: string): Promise<OutgoingDocument> => requestJson(`${BASE}/${id}/sign`, json('POST'));
export const declineOutgoing = (id: string, note: string): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/decline`, json('POST', { note }));
// Văn thư trả lại thì văn bản về dự thảo và văn thư không còn xem được: máy chủ trả trạng thái thay cho chi tiết
export const returnOutgoing = (id: string, note: string): Promise<Partial<OutgoingDocument>> =>
  requestJson(`${BASE}/${id}/return`, json('POST', { note }));
export const issueOutgoing = (
  id: string,
  input: {
    book_id: string;
    issue_number: number | null;
    symbol_suffix: string | null;
    issue_date: string;
    copies: number;
  },
): Promise<OutgoingDocument> => requestJson(`${BASE}/${id}/issue`, json('POST', input));
export const markSent = (
  id: string,
  input: { recipient_ids: string[]; sent: boolean; reference: string | null },
): Promise<OutgoingDocument> => requestJson(`${BASE}/${id}/send`, json('POST', input));
export const publishOutgoing = (id: string, published: boolean): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/publish`, json('POST', { published }));
export const freezeOutgoing = (id: string, frozen: boolean): Promise<OutgoingDocument> =>
  requestJson(`${BASE}/${id}/freeze`, json('POST', { frozen }));
export const archiveOutgoing = (ids: string[], archiveRecordId: string): Promise<BatchResult[]> =>
  requestJson(`${BASE}/archive`, json('POST', { ids, archive_record_id: archiveRecordId }));

// ---- Sổ văn bản đi ----

export const readOutgoingRegister = (bookId: string, from: string, to: string): Promise<{ items: OutgoingRegisterRow[] }> =>
  requestJson(`/api/v1/document-books/${bookId}/outgoing-register${query({ from, to })}`);

export async function exportOutgoingRegister(bookId: string, from: string, to: string): Promise<void> {
  const response = await fetchWithSession(
    `/api/v1/document-books/${bookId}/outgoing-register/export${query({ from, to })}`,
  );
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'so-van-ban-di.xlsx');
}

// ---- Tra cứu mã QR (trang công khai, không cần đăng nhập) ----

export async function verifyOutgoing(code: string): Promise<VerificationResult> {
  const response = await fetch(`/api/v1/public/outgoing-documents/verify${query({ code })}`);
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as VerificationResult;
}

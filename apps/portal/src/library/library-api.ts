import type { SchoolLevelCode } from '@school-management/shared';
import { saveResponseFile } from '../exports/export-api.js';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối thư viện trường học (DT-22 phần 22a, YCTD-181; tài liệu 32 mục 13.4)
export type CopyCondition = 'good' | 'damaged' | 'lost' | 'disposed';
export type ReturnCondition = 'good' | 'damaged' | 'lost';
export type CopySource = 'purchase' | 'donation' | 'supplied';
export type ReaderKind = 'staff' | 'student';
export type LoanStatus = 'open' | 'overdue' | 'returned' | 'lost';

export const CONDITION_LABELS: Record<CopyCondition, string> = {
  good: 'Tốt',
  damaged: 'Hỏng',
  lost: 'Mất',
  disposed: 'Đã thanh lý',
};
export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = { good: 'Tốt', damaged: 'Hỏng', lost: 'Mất' };
export const SOURCE_LABELS: Record<CopySource, string> = { purchase: 'Mua', donation: 'Tặng', supplied: 'Cấp' };
export const READER_KIND_LABELS: Record<ReaderKind, string> = { staff: 'Cán bộ', student: 'Học sinh' };
export const LEVEL_LABELS: Record<SchoolLevelCode, string> = {
  MN: 'Mầm non',
  TH: 'Tiểu học',
  THCS: 'Trung học cơ sở',
  THPT: 'Trung học phổ thông',
};
export const RESERVATION_LABELS: Record<string, string> = {
  waiting: 'Đang chờ',
  ready: 'Đã giữ bản',
  fulfilled: 'Đã mượn',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn giữ chỗ',
};

export interface LibraryCategory {
  id: string;
  code: string;
  name: string;
  lendable: boolean;
  order_no: number;
  status: 'active' | 'inactive';
}

export interface LoanRule {
  reader_kind: ReaderKind;
  max_items: number;
  loan_days: number;
  max_renewals: number;
  fine_per_day: number;
}

export interface LibraryIndicator {
  code: string;
  name: string;
  threshold: number | null;
  enabled: boolean;
  order_no: number;
}

export interface LibrarySettings {
  student_levels: SchoolLevelCode[];
  hold_days: number;
  rules: LoanRule[];
  categories: LibraryCategory[];
  indicators: LibraryIndicator[];
}

export interface LibraryTitle {
  id: string;
  category_id: string;
  category_name: string;
  lendable: boolean;
  title: string;
  authors: string | null;
  publisher: string | null;
  publish_year: number | null;
  isbn: string | null;
  school_level: SchoolLevelCode | null;
  grade_level: string | null;
  subject_id: string | null;
  topic: string | null;
  language: string;
  shelf: string | null;
  description: string | null;
  status: 'active' | 'retired';
  copies_total: number;
  copies_available: number;
}

export interface LibraryCopy {
  id: string;
  title_id: string;
  title: string;
  copy_no: string;
  source: CopySource;
  price: number | null;
  acquired_on: string | null;
  shelf: string | null;
  condition: CopyCondition;
  note: string | null;
  disposed_on: string | null;
  disposal_reason: string | null;
  loan_id: string | null;
  loan_due_on: string | null;
}

export interface TitleFile {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface LibraryTitleDetail extends LibraryTitle {
  copies: LibraryCopy[];
  files: TitleFile[];
}

export interface TitleInput {
  category_id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  publish_year: number | null;
  isbn: string | null;
  school_level: SchoolLevelCode | null;
  grade_level: string | null;
  topic: string | null;
  language: string;
  shelf: string | null;
  description: string | null;
}

export interface Page<T> {
  total: number;
  items: T[];
}

export interface Reader {
  id: string;
  reader_kind: ReaderKind;
  staff_id: string | null;
  child_id: string | null;
  card_no: string;
  status: 'active' | 'locked';
  locked_reason: string | null;
  issued_on: string;
  full_name: string;
  person_code: string | null;
  org_unit_id: string;
  person_active: boolean;
  class_id: string | null;
  class_name: string | null;
  open_loans: number;
  overdue_loans: number;
}

export interface Loan {
  id: string;
  copy_id: string;
  copy_no: string;
  title: string;
  reader_id: string;
  card_no: string;
  reader_kind: ReaderKind;
  reader_name: string;
  class_id: string | null;
  kind: 'regular' | 'textbook';
  loaned_on: string;
  due_on: string;
  returned_on: string | null;
  renewals: number;
  status: 'open' | 'returned' | 'lost';
  return_condition: ReturnCondition | null;
  fine_amount: number | string;
  note: string | null;
  overdue_days: number;
}

export interface LendResult {
  reader: { id: string; full_name: string; card_no: string };
  loans: Array<{ id: string; copy_no: string; title: string; due_on: string }>;
}

export interface ReturnResult {
  id: string;
  status: 'returned' | 'lost';
  returned_on: string;
  fine_amount: number | string;
  return_condition: ReturnCondition;
  copy_no: string;
  reader_name: string;
  overdue_days: number;
  reservation_for: string | null;
}

export interface Reservation {
  id: string;
  title_id: string;
  title: string;
  reader_id: string;
  card_no: string;
  reader_name: string;
  status: string;
  copy_no: string | null;
  reserved_at: string;
  ready_on: string | null;
  expires_on: string | null;
}

export interface TextbookSet {
  id: string;
  name: string;
  grade_level: string;
  status: 'active' | 'inactive';
  titles: Array<{ title_id: string; title: string }>;
}

export interface IssueResult {
  class_name: string;
  students: number;
  issued: number;
  due_on: string;
  without_card: string[];
  shortages: Array<{ title_id: string; title: string; missing: number }>;
}

export interface OutstandingTextbook {
  id: string;
  copy_no: string;
  title: string;
  reader_name: string;
  loaned_on: string;
  due_on: string;
}

export interface Stocktake {
  id: string;
  name: string;
  shelf: string | null;
  status: 'open' | 'closed';
  started_by_name: string;
  started_at: string;
  closed_at: string | null;
  scanned: number;
}

export interface StocktakeItem {
  id: string;
  copy_no: string;
  title: string;
  shelf: string | null;
  condition: CopyCondition;
  on_loan: boolean;
}

export interface StocktakeReport {
  id: string;
  name: string;
  shelf: string | null;
  status: 'open' | 'closed';
  started_at: string;
  closed_at: string | null;
  expected: number;
  found: number;
  missing: StocktakeItem[];
  surplus: StocktakeItem[];
  damaged: StocktakeItem[];
}

export interface ScanResult {
  copy_no: string;
  title: string;
  condition: CopyCondition;
  shelf: string | null;
  duplicate: boolean;
  on_loan: boolean;
  outside_shelf: boolean;
  scanned: number;
}

export interface LibraryOverview {
  as_of: string;
  students: number;
  teachers: number;
  titles: number;
  copies: number;
  by_category: Array<{ code: string; name: string; titles: number; copies: number }>;
  by_grade: Array<{ grade_level: string; copies: number }>;
  by_condition: Array<{ condition: CopyCondition; copies: number }>;
  loans: { total: number; open: number; overdue: number; lost: number };
  by_month: Array<{ month: string; loans: number }>;
  by_class: Array<{ class_name: string; loans: number }>;
  top_titles: Array<{ title: string; loans: number }>;
  top_readers: Array<{ reader_name: string; card_no: string; loans: number }>;
  indicators: Array<{
    code: string;
    name: string;
    value: number | null;
    threshold: number | null;
    passed: boolean | null;
  }>;
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10).split('-').reverse().join('/') : '';
}

export function formatMoney(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString('vi-VN')} đ`;
}

function queryOf(filter: Record<string, string | number | undefined | null>): string {
  const parameters = new URLSearchParams(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();
  return parameters ? `?${parameters}` : '';
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// Tải tệp máy chủ trả về (PDF, Excel, tệp tài liệu số) bằng mã phiên nên không dùng liên kết trực tiếp
async function downloadFile(path: string, init: RequestInit, fallbackName: string): Promise<void> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  const response = await fetchWithSession(path, { ...init, headers });
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
  saveResponseFile(
    await response.blob(),
    encoded ? `filename="${decodeURIComponent(encoded)}"` : disposition,
    fallbackName,
  );
}

// Thiết lập, phân loại
export const readLibrarySettings = () => requestJson<LibrarySettings>('/api/v1/library/settings');
export const saveLibrarySettings = (input: {
  student_levels: SchoolLevelCode[];
  hold_days: number;
  rules: LoanRule[];
  indicators: Array<{ code: string; threshold: number | null; enabled: boolean }>;
}) => requestJson<LibrarySettings>('/api/v1/library/settings', json('PUT', input));
export const createLibraryCategory = (input: { code: string; name: string; lendable: boolean; order_no: number }) =>
  requestJson<LibraryCategory>('/api/v1/library/categories', json('POST', input));
export const updateLibraryCategory = (
  categoryId: string,
  changes: Partial<Pick<LibraryCategory, 'name' | 'lendable' | 'order_no' | 'status'>>,
) => requestJson<LibraryCategory>(`/api/v1/library/categories/${categoryId}`, json('PATCH', changes));

// Ấn phẩm, bản sao
export interface TitleFilter {
  query?: string;
  category_id?: string;
  grade_level?: string;
  school_level?: string;
  status?: 'active' | 'retired';
  limit: number;
  offset: number;
}
export const listTitles = (filter: TitleFilter) =>
  requestJson<Page<LibraryTitle>>(`/api/v1/library/titles${queryOf({ ...filter })}`);
export const readTitle = (titleId: string) => requestJson<LibraryTitleDetail>(`/api/v1/library/titles/${titleId}`);
export const createTitle = (input: TitleInput) =>
  requestJson<{ id: string }>('/api/v1/library/titles', json('POST', input));
export const updateTitle = (titleId: string, changes: Partial<TitleInput> & { status?: 'active' | 'retired' }) =>
  requestJson<LibraryTitleDetail>(`/api/v1/library/titles/${titleId}`, json('PATCH', changes));
export const addCopies = (
  titleId: string,
  input: {
    quantity: number;
    source: CopySource;
    price: number | null;
    acquired_on: string | null;
    shelf: string | null;
  },
) =>
  requestJson<Array<{ id: string; copy_no: string }>>(`/api/v1/library/titles/${titleId}/copies`, json('POST', input));
export const updateCopy = (
  copyId: string,
  changes: { condition?: 'good' | 'damaged'; shelf?: string | null; note?: string | null },
) => requestJson(`/api/v1/library/copies/${copyId}`, json('PATCH', changes));
export const disposeCopies = (copyIds: string[], reason: string) =>
  requestJson<{ disposed: string[] }>('/api/v1/library/copies/dispose', json('POST', { copy_ids: copyIds, reason }));
export const printLabels = (copyIds: string[]) =>
  downloadFile('/api/v1/library/labels', json('POST', { copy_ids: copyIds }), 'tem-ma-sach.pdf');
export const downloadRegistry = (format: 'xlsx' | 'pdf') =>
  downloadFile(`/api/v1/library/registry?format=${format}`, {}, `so-dang-ky-ca-biet.${format}`);
export function uploadTitleFile(titleId: string, file: File): Promise<TitleFile> {
  const form = new FormData();
  form.set('file', file, file.name);
  return requestJson(`/api/v1/library/titles/${titleId}/files`, { method: 'POST', body: form });
}
export const downloadTitleFile = (titleId: string, file: TitleFile) =>
  downloadFile(`/api/v1/library/titles/${titleId}/files/${file.id}`, {}, file.file_name);
export const deleteTitleFile = (titleId: string, fileId: string) =>
  requestJson<void>(`/api/v1/library/titles/${titleId}/files/${fileId}`, { method: 'DELETE' });

// Bạn đọc
export interface ReaderFilter {
  kind?: ReaderKind;
  class_id?: string;
  status?: 'active' | 'locked';
  query?: string;
  limit: number;
  offset: number;
}
export const listReaders = (filter: ReaderFilter) =>
  requestJson<Page<Reader>>(`/api/v1/library/readers${queryOf({ ...filter })}`);
export const lookupReaders = (text: string) =>
  requestJson<Reader[]>(`/api/v1/library/readers/lookup${queryOf({ q: text })}`);
export const syncReaders = () =>
  requestJson<{ issued_staff: number; issued_students: number; locked: number }>(
    '/api/v1/library/readers/sync',
    json('POST'),
  );
export const setReaderStatus = (readerId: string, status: 'active' | 'locked', reason: string | null) =>
  requestJson(`/api/v1/library/readers/${readerId}`, json('PATCH', { status, reason }));
export const printReaderCards = (readerIds: string[]) =>
  downloadFile('/api/v1/library/readers/cards', json('POST', { reader_ids: readerIds }), 'the-ban-doc.pdf');
export const readerLoanHistory = (readerId: string) =>
  requestJson<Page<Loan>>(`/api/v1/library/readers/${readerId}/loans`);

// Mượn, trả, đặt trước
export const listLoans = (filter: { status?: LoanStatus; query?: string; limit: number; offset: number }) =>
  requestJson<Page<Loan>>(`/api/v1/library/loans${queryOf({ ...filter })}`);
export const lendCopies = (input: { reader_id: string; copy_codes: string[]; class_id: string | null }) =>
  requestJson<LendResult>('/api/v1/library/loans', json('POST', input));
export const returnCopy = (copyCode: string, condition: ReturnCondition) =>
  requestJson<ReturnResult>('/api/v1/library/loans/return', json('POST', { copy_code: copyCode, condition }));
export const returnMany = (items: Array<{ loan_id: string; condition: ReturnCondition }>) =>
  requestJson<{ returned: number; loans: ReturnResult[] }>(
    '/api/v1/library/loans/return-many',
    json('POST', { items }),
  );
export const renewLoan = (loanId: string) =>
  requestJson<{ id: string; due_on: string; renewals: number }>(`/api/v1/library/loans/${loanId}/renew`, json('POST'));
export const reportLost = (loanId: string, note: string | null) =>
  requestJson<ReturnResult>(`/api/v1/library/loans/${loanId}/lost`, json('POST', { note }));
export const remindOverdue = () =>
  requestJson<{ readers: number; loans: number }>('/api/v1/library/loans/remind', json('POST'));
export const listReservations = () => requestJson<Reservation[]>('/api/v1/library/reservations');
export const createReservation = (readerId: string, titleId: string) =>
  requestJson('/api/v1/library/reservations', json('POST', { reader_id: readerId, title_id: titleId }));
export const cancelReservation = (reservationId: string) =>
  requestJson<void>(`/api/v1/library/reservations/${reservationId}`, { method: 'DELETE' });

// Sách giáo khoa
export const listTextbookSets = () => requestJson<TextbookSet[]>('/api/v1/library/textbook-sets');
export const createTextbookSet = (input: { name: string; grade_level: string; title_ids: string[] }) =>
  requestJson<{ id: string }>('/api/v1/library/textbook-sets', json('POST', input));
export const updateTextbookSet = (
  setId: string,
  input: { name: string; grade_level: string; title_ids: string[]; status?: 'active' | 'inactive' },
) => requestJson<{ id: string }>(`/api/v1/library/textbook-sets/${setId}`, json('PATCH', input));
export const issueTextbooks = (classId: string, setId: string) =>
  requestJson<IssueResult>('/api/v1/library/textbooks/issue', json('POST', { class_id: classId, set_id: setId }));
export const listOutstandingTextbooks = (classId: string) =>
  requestJson<OutstandingTextbook[]>(`/api/v1/library/textbooks/outstanding${queryOf({ class_id: classId })}`);

// Kiểm kê, báo cáo
export const listStocktakes = () => requestJson<Stocktake[]>('/api/v1/library/stocktakes');
export const startStocktake = (name: string, shelf: string | null) =>
  requestJson<{ id: string }>('/api/v1/library/stocktakes', json('POST', { name, shelf }));
export const readStocktake = (stocktakeId: string) =>
  requestJson<StocktakeReport>(`/api/v1/library/stocktakes/${stocktakeId}`);
export const scanStocktake = (stocktakeId: string, code: string) =>
  requestJson<ScanResult>(`/api/v1/library/stocktakes/${stocktakeId}/scan`, json('POST', { code }));
export const closeStocktake = (stocktakeId: string) =>
  requestJson<StocktakeReport>(`/api/v1/library/stocktakes/${stocktakeId}/close`, json('POST'));
export const resolveStocktake = (
  stocktakeId: string,
  input: { copy_ids: string[]; action: 'lost' | 'dispose'; reason: string },
) => requestJson(`/api/v1/library/stocktakes/${stocktakeId}/resolve`, json('POST', input));
export const readLibraryOverview = () => requestJson<LibraryOverview>('/api/v1/library/reports/overview');
export const downloadLibraryReport = (type: 'overview' | 'loans' | 'overdue', format: 'xlsx' | 'pdf') =>
  downloadFile(
    `/api/v1/library/reports/export?type=${type}&format=${format}`,
    {},
    `bao-cao-thu-vien-${type}.${format}`,
  );

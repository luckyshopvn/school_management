import { downloadExport, saveResponseFile } from '../exports/export-api.js';
import { filterParameters, type ChildPage, type StudentFilter } from '../children/children-api.js';
import type { ImportCatalog } from '../imports/import-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối hồ sơ học sinh đủ theo hệ thống của Sở (DT-16 phần 16g): xóa hồ sơ, cấp mã định danh Bộ, xuất file lỗi,
// sắp xếp học sinh, điện thoại nhận tin hàng loạt, số định danh, tài khoản học và thi, chuyển lớp hàng loạt, chuyển trường,
// công cụ nhập học sinh 82 cột
const post = <T>(path: string, body?: unknown): Promise<T> =>
  requestJson(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export const deleteChild = (childId: string) =>
  requestJson<{ deleted: boolean }>(`/api/v1/children/${childId}`, { method: 'DELETE' });

export const assignMoetCodes = (items: Array<{ child_id: string; moet_student_code: string }>) =>
  post<{ assigned: number }>('/api/v1/children/moet-codes', { items });

export const downloadMoetFile = (filter: StudentFilter) =>
  downloadExport('/api/v1/children/moet-file', filter, 'hoc-sinh-theo-mau-bo.xlsx');

export const downloadErrorFile = (filter: StudentFilter) =>
  downloadExport('/api/v1/children/error-file', filter, 'hoc-sinh-file-loi.xlsx');

export const bulkTransferClass = (input: {
  items: Array<{ child_id: string; class_id: string }>;
  reason: string;
  from_date?: string;
  confirm_over_capacity?: boolean;
}) => post<{ transferred: number }>('/api/v1/children/bulk-transfer-class', input);

export type SmsRelation = 'father' | 'mother' | 'legal_guardian' | 'primary' | 'none';
export const SMS_RELATION_LABELS: Record<SmsRelation, string> = {
  mother: 'Số của mẹ',
  father: 'Số của cha',
  legal_guardian: 'Số của người giám hộ',
  primary: 'Số của người liên hệ chính',
  none: 'Bỏ chọn số nhận tin',
};

export const bulkSmsGuardians = (childIds: string[], relation: SmsRelation) =>
  post<{ updated: number; skipped: string[] }>('/api/v1/children/sms-guardians', { child_ids: childIds, relation });

// Sắp xếp học sinh (4.1.3)
export interface OrderedStudent {
  id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  moet_student_code: string | null;
  order_number: number | null;
}

export const readClassOrder = (classId: string) =>
  requestJson<{ class: { id: string; name: string }; items: OrderedStudent[] }>(
    `/api/v1/student-order?class_id=${classId}`,
  );

export const sortStudents = (classId: string | null) =>
  post<{ classes: number; students: number }>('/api/v1/student-order/sort', classId ? { class_id: classId } : {});

export const saveClassOrder = (classId: string, childIds: string[]) =>
  requestJson(`/api/v1/student-order/${classId}`, { method: 'PUT', body: JSON.stringify({ child_ids: childIds }) });

// Số định danh (4.1.8–4.1.9, 5.5)
export const verifyNationalIds = (childIds: string[]) =>
  post<{ verified: number; already: number }>('/api/v1/national-ids/verify', { child_ids: childIds });

export const unverifyNationalIds = (childIds: string[]) =>
  post<{ unverified: number }>('/api/v1/national-ids/unverify', { child_ids: childIds });

export const setResidenceNote = (childId: string, note: string) =>
  requestJson(`/api/v1/children/${childId}/residence-change`, {
    method: 'PUT',
    body: JSON.stringify({ note: note || null }),
  });

export interface VerificationProgressRow {
  class_id: string | null;
  class_name: string;
  org_unit_name: string;
  total: number;
  verified: number;
  ratio: number;
}

export const readVerificationProgress = () =>
  requestJson<{ items: VerificationProgressRow[]; total: { total: number; verified: number; ratio: number } }>(
    '/api/v1/national-ids/progress',
  );

export interface DuplicateStudent {
  id: string;
  group: number;
  full_name: string;
  dob: string;
  status: string;
  moet_student_code: string | null;
  national_id_masked: string;
  class_name: string | null;
  org_unit_name: string;
}

export const readDuplicates = () => requestJson<{ items: DuplicateStudent[] }>('/api/v1/national-ids/duplicates');

// Tài khoản học và thi (4.1.10, 5.4)
export interface LearningAccountRow {
  id: string;
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  status: string;
  class_name: string | null;
  username: string | null;
  issued_at: string | null;
  issued_by_name: string | null;
  reset_count: number;
}

export interface IssuedAccounts {
  mode: 'create' | 'reset';
  items: Array<{ child_id: string; full_name: string; class_name: string; username: string; password: string }>;
  skipped: number;
  file: { name: string; content_base64: string };
}

export function listLearningAccounts(filter: StudentFilter, page: number, pageSize: number) {
  const parameters = filterParameters(filter);
  parameters.set('page', String(page));
  parameters.set('page_size', String(pageSize));
  return requestJson<Omit<ChildPage, 'items'> & { items: LearningAccountRow[] }>(
    `/api/v1/learning-accounts?${parameters.toString()}`,
  );
}

export const issueLearningAccounts = (childIds: string[], mode: 'create' | 'reset') =>
  post<IssuedAccounts>('/api/v1/learning-accounts/issue', { child_ids: childIds, mode });

export const exportLearningAccounts = (filter: StudentFilter) =>
  downloadExport('/api/v1/learning-accounts/export', filter, 'tai-khoan-hoc-sinh.xlsx');

// Tệp danh sách tài khoản vừa tạo: máy chủ trả một lần cùng mật khẩu, không lưu lại
export function saveIssuedFile(file: IssuedAccounts['file']): void {
  const bytes = Uint8Array.from(atob(file.content_base64), (character) => character.charCodeAt(0));
  saveResponseFile(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `attachment; filename="${file.name}"`,
    file.name,
  );
}

// Chuyển trường (4.2)
export type TransferDirection = 'out' | 'in';
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'received';
export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  received: 'Đã tiếp nhận',
};

export interface StudentTransfer {
  id: string;
  direction: TransferDirection;
  status: TransferStatus;
  child_id: string | null;
  full_name: string;
  dob: string | null;
  school_name: string;
  province_name: string | null;
  ward_name: string | null;
  transfer_date: string;
  reason: string | null;
  requested_by_name: string;
  decided_by_name: string | null;
  decision_note: string | null;
  org_unit_name: string;
  moet_student_code: string | null;
}

export interface TransferPlace {
  school_name: string;
  province_name?: string;
  ward_name?: string;
  transfer_date?: string;
  reason?: string;
}

export function listTransfers(filter: { direction?: string; status?: string; q?: string }, page: number, size: number) {
  const parameters = new URLSearchParams({ page: String(page), page_size: String(size) });
  for (const [key, value] of Object.entries(filter)) {
    if (value) {
      parameters.set(key, value);
    }
  }
  return requestJson<{ items: StudentTransfer[]; total: number; counts: Record<string, number> }>(
    `/api/v1/student-transfers?${parameters.toString()}`,
  );
}

export const requestTransferOut = (childId: string, place: TransferPlace) =>
  post<StudentTransfer>('/api/v1/student-transfers/out', { child_id: childId, ...place });

export const decideTransfer = (transferId: string, approve: boolean, note: string) =>
  post<StudentTransfer>(`/api/v1/student-transfers/${transferId}/${approve ? 'approve' : 'reject'}`, { note });

export const downloadDossier = (transferId: string, format: 'xlsx' | 'pdf') =>
  download(`/api/v1/student-transfers/${transferId}/dossier?format=${format}`, `ho-so-chuyen-truong.${format}`);

export function receiveTransfer(orgUnitId: string, place: TransferPlace, file: File) {
  const form = new FormData();
  form.set('org_unit_id', orgUnitId);
  for (const [key, value] of Object.entries(place)) {
    if (value) {
      form.set(key, value);
    }
  }
  form.set('file', file);
  return requestJson<{
    created: number;
    errors: Array<{ row: number; column: string | null; message: string }>;
    transfers: Array<{ id: string; child_id: string }>;
  }>('/api/v1/student-transfers/in', { method: 'POST', body: form });
}

// Nhập học sinh 82 cột (4.1.2)
export const readMoetCatalogs = async (): Promise<ImportCatalog[]> =>
  (await requestJson<{ items: ImportCatalog[] }>('/api/v1/student-imports/moet-catalogs')).items;

export const downloadMoetTemplate = (withData: boolean) =>
  download(
    `/api/v1/student-imports/moet-template${withData ? '?with_data=true' : ''}`,
    `mau-nhap-hoc-sinh-82-cot${withData ? '-kem-du-lieu' : ''}.xlsx`,
  );

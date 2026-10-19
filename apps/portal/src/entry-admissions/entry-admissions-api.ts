import type {
  AdmissionSupportStatus,
  FinalYearCheckItem,
  FinalYearFileKind,
  FinalYearIdentityType,
  FinalYearRegistrationSource,
  FinalYearResidenceType,
  FinalYearReviewStatus,
  FinalYearStatus,
} from '@school-management/shared';
import { ApiError } from '../session/api-client.js';
import { downloadExport, saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi điểm cuối của phân hệ Tuyển sinh đầu cấp (DT-17 phần 17c)
export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const formatDate = (value: string | null) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '');
export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';

// "Xem vị trí": mở bản đồ ngoài theo tọa độ ở thẻ mới, không nhúng thư viện bản đồ
export function openMap(latitude: number, longitude: number): void {
  window.open(
    `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
    '_blank',
    'noopener',
  );
}

export interface FinalYearFile {
  id: string;
  kind: FinalYearFileKind;
  file_name: string;
  content_type: string;
  uploaded_by_name: string;
  uploaded_by_parent: boolean;
  created_at: string;
}

export interface FinalYearGuardian {
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  is_primary: boolean;
}

export interface FinalYearRecord {
  id: string;
  child_id: string;
  org_unit_id: string;
  org_unit_name: string;
  class_id: string;
  class_name: string;
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  place_of_birth: string | null;
  national_id: string;
  identity_type: FinalYearIdentityType;
  residence_type: FinalYearResidenceType | null;
  current_residence: string | null;
  house_number: string | null;
  street: string | null;
  residential_group: string | null;
  quarter: string | null;
  ward: string | null;
  province: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  guardians: FinalYearGuardian[];
  latitude: number | null;
  longitude: number | null;
  routed_school: string | null;
  beneficiary: string | null;
  priority_form: string | null;
  registration_source: FinalYearRegistrationSource;
  parent_proposal: string | null;
  parent_proposed_at: string | null;
  status: FinalYearStatus;
  review_status: FinalYearReviewStatus;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  confirmed_by_school: boolean;
  approved_at: string | null;
  approved_by_name: string | null;
  admission_consent: boolean;
  admission_consent_at: string | null;
  missing: FinalYearCheckItem[];
  check_text: string;
  files: FinalYearFile[];
  has_parent_account: boolean;
  updated_at: string;
}

// Bộ lọc của 1.1; khóa theo tên tham số của máy chủ, ô trống thì không lọc
export type FinalYearFilter = Partial<
  Record<
    | 'class_id'
    | 'national_id'
    | 'q'
    | 'check'
    | 'identity_type'
    | 'status'
    | 'registration_source'
    | 'review_status'
    | 'has_location'
    | 'admission_consent'
    | 'order',
    string
  >
>;

const cleanFilter = (filter: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined && value !== ''));

export function listFinalYearRecords(filter: FinalYearFilter) {
  const parameters = new URLSearchParams(cleanFilter(filter) as Record<string, string>);
  return requestJson<{ items: FinalYearRecord[]; edit_deadline: string | null; today: string }>(
    `/api/v1/final-year-records?${parameters.toString()}`,
  );
}

export type FinalYearInput = Partial<
  Pick<
    FinalYearRecord,
    | 'identity_type'
    | 'residence_type'
    | 'current_residence'
    | 'house_number'
    | 'street'
    | 'residential_group'
    | 'quarter'
    | 'ward'
    | 'province'
    | 'contact_name'
    | 'contact_phone'
    | 'contact_email'
    | 'latitude'
    | 'longitude'
    | 'routed_school'
    | 'beneficiary'
    | 'priority_form'
    | 'registration_source'
  >
>;

export function updateFinalYearRecord(id: string, input: FinalYearInput) {
  return requestJson<FinalYearRecord>(`/api/v1/final-year-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function actOnFinalYearRecords(action: 'confirm' | 'edited' | 'approve' | 'unapprove', ids: string[]) {
  return requestJson<{ done: number; skipped: Array<{ id: string; full_name: string; reason: string }> }>(
    '/api/v1/final-year-records/actions',
    { method: 'POST', body: JSON.stringify({ action, ids }) },
  );
}

export function saveEditDeadline(editDeadline: string | null) {
  return requestJson<{ edit_deadline: string | null }>('/api/v1/final-year-records/settings', {
    method: 'PUT',
    body: JSON.stringify({ edit_deadline: editDeadline }),
  });
}

export interface FinalYearAccount {
  record_id: string;
  child_name: string;
  class_name: string;
  guardian_name: string;
  relationship: string | null;
  phone: string | null;
  user_id: string | null;
  has_account: boolean;
}

export function finalYearAccounts(ids: string[]) {
  return requestJson<{ items: FinalYearAccount[] }>('/api/v1/final-year-records/accounts', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function exportFinalYearRecords(filter: FinalYearFilter) {
  return downloadExport('/api/v1/final-year-records/export', { filter: cleanFilter(filter) }, 'ho-so-cuoi-cap.xlsx');
}

export function downloadFinalYearPdf(input: {
  format: 'a5' | 'a4_folded';
  kind?: 'information' | 'declaration';
  split?: boolean;
  ids?: string[] | null;
  filter: FinalYearFilter;
}) {
  return downloadExport(
    '/api/v1/final-year-records/pdf',
    { ...input, filter: cleanFilter(input.filter) },
    input.split ? 'ho-so-cuoi-cap.zip' : 'ho-so-cuoi-cap.pdf',
  );
}

export interface ImportRowError {
  row: number;
  column: string | null;
  message: string;
}

export async function importFinalYearRecords(file: File, errorFile = false) {
  const form = new FormData();
  form.set('file', file);
  const response = await fetchWithSession(`/api/v1/final-year-records/import${errorFile ? '?error_file=true' : ''}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw await readError(response);
  }
  if (errorFile) {
    saveResponseFile(
      await response.blob(),
      response.headers.get('content-disposition') ?? '',
      'danh-sach-loi-ho-so-cuoi-cap.xlsx',
    );
    return null;
  }
  return (await response.json()) as { updated: number; errors: ImportRowError[] };
}

export async function uploadFinalYearFile(recordId: string, kind: FinalYearFileKind, file: File, parent = false) {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  return requestJson<FinalYearFile>(`/api/v1/${parent ? 'parent/' : ''}final-year-records/${recordId}/files`, {
    method: 'POST',
    body: form,
  });
}

export async function openFinalYearFile(fileId: string) {
  const response = await fetchWithSession(`/api/v1/final-year-records/files/${fileId}`);
  if (!response.ok) {
    throw await readError(response);
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}

export function removeFinalYearFile(fileId: string) {
  return requestJson<{ removed: boolean }>(`/api/v1/final-year-records/files/${fileId}`, { method: 'DELETE' });
}

export interface CompletionRow {
  class_id: string;
  class_name: string;
  org_unit_id: string;
  org_unit_name: string;
  total: number;
  complete: number;
  missing: number;
  confirmed: boolean;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
}

export const listCompletion = () => requestJson<{ items: CompletionRow[] }>('/api/v1/final-year-completion');
export const saveCompletion = (items: Array<{ class_id: string; confirmed: boolean }>) =>
  requestJson<{ items: CompletionRow[] }>('/api/v1/final-year-completion', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
export const exportCompletion = () =>
  downloadExport('/api/v1/final-year-completion/export', {}, 'xac-nhan-hoan-thanh-ho-so-cuoi-cap.xlsx');

export interface StatisticsRow {
  org_unit_id: string;
  org_unit_name: string;
  unit_type: string;
  total: number;
  missing: number;
  complete_rate: number;
}

export const listStatistics = () => requestJson<{ items: StatisticsRow[] }>('/api/v1/final-year-statistics');
export const exportStatistics = () =>
  downloadExport('/api/v1/final-year-statistics/export', {}, 'thong-ke-ho-so-cuoi-cap.xlsx');

export interface MapUnit {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  province: string | null;
  ward: string | null;
  quarter: string | null;
  map_confirmed_at: string | null;
  map_confirmed_by_name: string | null;
  missing: string[];
  check_text: string;
}

export const readSchoolMap = () =>
  requestJson<{ school: MapUnit | null; sites: MapUnit[] }>('/api/v1/entry-school-map');
export const saveSchoolMap = (
  unitId: string,
  input: Partial<Pick<MapUnit, 'latitude' | 'longitude' | 'province' | 'ward' | 'quarter' | 'phone' | 'address'>>,
) =>
  requestJson<{ school: MapUnit | null; sites: MapUnit[] }>(`/api/v1/entry-school-map/${unitId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const confirmSchoolMap = () =>
  requestJson<{ school: MapUnit | null; sites: MapUnit[] }>('/api/v1/entry-school-map/confirm', { method: 'POST' });

export interface SchoolService {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  finance_service_name: string | null;
}

export function listSchoolServices(filter: { code: string; name: string }) {
  const parameters = new URLSearchParams(cleanFilter(filter) as Record<string, string>);
  return requestJson<{ items: SchoolService[] }>(`/api/v1/school-services?${parameters.toString()}`);
}
export const saveSchoolService = (id: string | null, input: { code: string; name: string; sort_order: number }) =>
  requestJson<SchoolService>(id ? `/api/v1/school-services/${id}` : '/api/v1/school-services', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
export const removeSchoolServices = (ids: string[]) =>
  requestJson<{ removed: number }>('/api/v1/school-services/delete', { method: 'POST', body: JSON.stringify({ ids }) });
export const exportSchoolServices = (filter: { code: string; name: string }) =>
  downloadExport('/api/v1/school-services/export', { filter: cleanFilter(filter) }, 'dich-vu-tai-truong.xlsx');

export interface EntryStaff {
  id: string;
  identifier: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  job_title: string | null;
}

export function listEntryStaff(filter: { code: string; name: string; phone: string }) {
  const parameters = new URLSearchParams(cleanFilter(filter) as Record<string, string>);
  return requestJson<{ items: EntryStaff[] }>(`/api/v1/entry-admissions/staff?${parameters.toString()}`);
}
export const exportEntryStaff = (filter: { code: string; name: string; phone: string }) =>
  downloadExport('/api/v1/entry-admissions/staff/export', { filter: cleanFilter(filter) }, 'danh-sach-nhan-su.xlsx');

export interface EntryClass {
  id: string;
  name: string;
  grade_level: string;
  grade_level_name: string;
  sort_order: number | null;
  homeroom_teachers: string;
}

export const listEntryClasses = (gradeLevel: string) =>
  requestJson<{ items: EntryClass[]; grade_levels: Array<{ code: string; name: string }> }>(
    `/api/v1/entry-admissions/classes${gradeLevel ? `?grade_level=${encodeURIComponent(gradeLevel)}` : ''}`,
  );

export interface SupportRequest {
  id: string;
  org_unit_id: string;
  child_id: string | null;
  requester_name: string;
  child_name: string | null;
  child_dob: string | null;
  national_id: string | null;
  email: string | null;
  phone: string | null;
  content: string;
  status: AdmissionSupportStatus;
  reply: string | null;
  replied_by_name: string | null;
  replied_at: string | null;
  notified_at: string | null;
  notified_channels: string | null;
  created_at: string;
}

export function listSupportRequests(filter: { q: string; national_id: string; status: string }) {
  const parameters = new URLSearchParams(cleanFilter(filter) as Record<string, string>);
  return requestJson<{ items: SupportRequest[] }>(`/api/v1/admission-support?${parameters.toString()}`);
}
export const replySupportRequest = (id: string, reply: string | null) =>
  requestJson<{ id: string; status: AdmissionSupportStatus }>(`/api/v1/admission-support/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ reply }),
  });
export const notifySupportRequests = (ids: string[]) =>
  requestJson<{ sent: number; skipped: Array<{ id: string; reason: string }>; email_available: boolean }>(
    '/api/v1/admission-support/notify',
    { method: 'POST', body: JSON.stringify({ ids }) },
  );
export const exportSupportRequests = (filter: { q: string; national_id: string; status: string }) =>
  downloadExport('/api/v1/admission-support/export', { filter: cleanFilter(filter) }, 'ho-tro-tuyen-sinh.xlsx');

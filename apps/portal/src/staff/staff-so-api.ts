import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';
import type { StaffFilter } from './staff-api.js';

// Gọi các điểm cuối nhân sự đủ theo hệ thống của Sở (DT-16 phần 16f): xóa hồ sơ, tệp theo mẫu Bộ, 3.1.2 nhân sự phân hiệu,
// 3.1.3 mẫu 75 cột, 3.1.5 xác thực số định danh (bản chạy nội bộ), 3.5 biến động nhân sự, 5.2 thống kê, 5.6 tiến độ xác thực
export interface Paged<Item> {
  items: Item[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

const query = (values: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(values)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

async function download(path: string, fallbackName: string, init?: RequestInit): Promise<void> {
  const response = await fetchWithSession(path, init);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const filterBody = (filter: StaffFilter) =>
  Object.fromEntries(Object.entries(filter).filter((entry) => typeof entry[1] === 'string' && entry[1] !== ''));

// 3.1.1: xóa hồ sơ chưa có dữ liệu liên quan; "Xuất tệp theo mẫu Bộ", "Xuất file lỗi"
export interface DeleteResult {
  deleted_count: number;
  results: Array<{ id: string; full_name: string; deleted: boolean; reason: string | null }>;
}
export const deleteStaff = (staffIds: string[]) =>
  requestJson<DeleteResult>('/api/v1/staff/delete', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds }),
  });
export const exportMinistryFile = (filter: StaffFilter) =>
  download('/api/v1/staff/ministry-export', 'ho-so-can-bo-theo-mau-bo.xlsx', postJson(filterBody(filter)));
export const exportMinistryErrors = (filter: StaffFilter) =>
  download('/api/v1/staff/ministry-errors', 'ho-so-can-bo-loi.xlsx', postJson(filterBody(filter)));

// 3.1.3: mẫu 75 cột (kèm dữ liệu), danh mục của Bộ
export const downloadMinistryTemplate = (withData: boolean) =>
  download(
    `/api/v1/staff/ministry-template${withData ? '?with_data=true' : ''}`,
    `mau-nhap-nhan-su-75-cot${withData ? '-kem-du-lieu' : ''}.xlsx`,
  );
export interface MinistryCatalog {
  key: string;
  title: string;
  column: string;
  items: Array<{ code: string; name: string }>;
}
export async function readMinistryCatalogs(): Promise<MinistryCatalog[]> {
  return (await requestJson<{ items: MinistryCatalog[] }>('/api/v1/staff/ministry-catalogs')).items;
}

// 3.1.2 Nhân sự phân hiệu
export interface StaffBranchRow {
  id: string;
  code: string;
  full_name: string;
  org_unit_id: string;
  unit_name: string;
  has_account: boolean;
  branches: Array<{ org_unit_id: string; name: string; source: 'manual' | 'teaching' }>;
}
export interface StaffBranchPage extends Paged<StaffBranchRow> {
  branch_units: Array<{ id: string; code: string; name: string; unit_type: string }>;
}
export const listStaffBranches = (filter: {
  org_unit_id?: string;
  branch_id?: string;
  q?: string;
  page: number;
  page_size: number;
}): Promise<StaffBranchPage> => requestJson(`/api/v1/staff-branches?${query(filter)}`);
export const assignBranches = (staffIds: string[], orgUnitIds: string[]) =>
  requestJson<{ assigned_count: number }>('/api/v1/staff-branches/assign', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds, org_unit_ids: orgUnitIds }),
  });
export const unassignBranches = (staffIds: string[], orgUnitIds: string[]) =>
  requestJson<{ removed_count: number }>('/api/v1/staff-branches/unassign', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds, org_unit_ids: orgUnitIds }),
  });
export const branchesFromTeaching = (staffIds: string[]) =>
  requestJson<{ assigned_count: number; without_account_count: number }>('/api/v1/staff-branches/from-teaching', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds }),
  });

// 3.1.5 Xác thực số định danh (bản chạy nội bộ)
export type IdVerificationStatus = 'unverified' | 'verified' | 'invalid';
export const ID_VERIFICATION_LABELS: Record<IdVerificationStatus, string> = {
  unverified: 'Chưa xác thực',
  verified: 'Đã xác thực',
  invalid: 'Sai thông tin',
};
export interface StaffIdentityRow {
  id: string;
  code: string;
  moet_staff_code: string | null;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  id_number_masked: string | null;
  permanent_address: string;
  address: string | null;
  id_verification_status: IdVerificationStatus;
  id_verified_at: string | null;
  id_verified_by_name: string | null;
  id_verification_note: string | null;
  unit_name: string;
  department_name: string | null;
}
export const listStaffIdentity = (filter: {
  org_unit_id?: string;
  status?: string;
  q?: string;
  page: number;
  page_size: number;
}): Promise<Paged<StaffIdentityRow> & { automatic: boolean }> => requestJson(`/api/v1/staff-identity?${query(filter)}`);
export interface MarkResult {
  updated_count: number;
  results: Array<{ id: string; full_name: string; status: IdVerificationStatus | null; error: string | null }>;
}
export const markStaffIdentity = (staffIds: string[], status: IdVerificationStatus, note: string) =>
  requestJson<MarkResult>('/api/v1/staff-identity/mark', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds, status, note: note || null }),
  });

// 5.6 Tiến độ xác thực, trùng số định danh
export interface IdentityProgress {
  group_by: 'unit' | 'department';
  items: Array<{ name: string; total: number; verified: number; invalid: number; rate: number }>;
  totals: { total: number; verified: number; invalid: number; rate: number };
}
export const readIdentityProgress = (orgUnitId: string | undefined, groupBy: 'unit' | 'department') =>
  requestJson<IdentityProgress>(`/api/v1/staff-identity/progress?${query({ org_unit_id: orgUnitId, group_by: groupBy })}`);
export interface DuplicateGroup {
  id_number_masked: string;
  staff: Array<{ id: string; code: string; full_name: string; dob: string | null; status: string; unit_name: string }>;
}
export const readIdentityDuplicates = (orgUnitId: string | undefined) =>
  requestJson<{ groups: DuplicateGroup[] }>(`/api/v1/staff-identity/duplicates?${query({ org_unit_id: orgUnitId })}`);

// 3.5 Biến động nhân sự
export type MovementType = 'transfer_in' | 'transfer_out' | 'guest_out' | 'guest_in';
export type MovementStatus = 'pending' | 'approved' | 'rejected';
export interface StaffMovement {
  id: string;
  movement_type: MovementType;
  status: MovementStatus;
  status_label: string;
  org_unit_id: string;
  unit_name: string;
  staff_id: string | null;
  staff_code: string | null;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  other_province: string | null;
  other_ward: string | null;
  other_school: string | null;
  movement_date: string;
  end_date: string | null;
  subject: string | null;
  decision_no: string | null;
  reason: string | null;
  note: string | null;
  confirmed: boolean;
  confirmed_on: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  has_dossier: boolean;
}
export const listStaffMovements = (filter: {
  type: MovementType;
  org_unit_id?: string;
  status?: string;
  q?: string;
  page: number;
  page_size: number;
}): Promise<Paged<StaffMovement>> => requestJson(`/api/v1/staff-movements?${query(filter)}`);
export const createStaffMovement = (body: Record<string, unknown>) =>
  requestJson<StaffMovement>('/api/v1/staff-movements', { method: 'POST', body: JSON.stringify(body) });
export function createTransferInFromFile(file: File, fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  form.set('file', file);
  return requestJson<StaffMovement>('/api/v1/staff-movements/transfer-in-file', { method: 'POST', body: form });
}
export const approveStaffMovement = (id: string) =>
  requestJson<StaffMovement>(`/api/v1/staff-movements/${id}/approve`, { method: 'POST' });
export const rejectStaffMovement = (id: string, note: string) =>
  requestJson<StaffMovement>(`/api/v1/staff-movements/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
export const confirmStaffMovement = (id: string, confirmedOn: string) =>
  requestJson<StaffMovement>(`/api/v1/staff-movements/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ confirmed_on: confirmedOn }),
  });
export const downloadMovementPdf = (id: string) =>
  download(`/api/v1/staff-movements/${id}/pdf`, 'bien-dong-nhan-su.pdf');
export const downloadMovementMinistryFile = (id: string) =>
  download(`/api/v1/staff-movements/${id}/ministry-file`, 'ho-so-chuyen.xlsx');

// 5.2 Thống kê nhân sự
export interface CatalogCount {
  value: string;
  in_catalog: boolean;
  count: number;
  female: number;
  percent: number;
}
export type LevelCounts = Record<'not_met' | 'met' | 'good' | 'excellent', number>;
export interface StandardStatistics {
  standard_type: 'teacher' | 'principal';
  evaluations: number;
  finalized: number;
  overall: LevelCounts;
  overall_rates: LevelCounts;
  criteria: Array<{ standard_code: string; standard_name: string; code: string; name: string; levels: LevelCounts }>;
}
export interface StaffStatistics {
  totals: { staff_count: number; female_count: number };
  by_qualification: CatalogCount[];
  by_job_position: CatalogCount[];
  by_contract_form: CatalogCount[];
  by_position_group: CatalogCount[];
  standards: StandardStatistics[];
}
export const readStaffStatistics = (orgUnitId: string | undefined) =>
  requestJson<StaffStatistics>(`/api/v1/statistics/staff-so?${query({ org_unit_id: orgUnitId })}`);

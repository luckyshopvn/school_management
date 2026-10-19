import type { MoetProfileEntry } from '../imports/MoetProfileSection.js';
import { downloadPost } from '../children/children-api.js';
import type { ExportFormat } from '../exports/export-api.js';
import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối hồ sơ nhân sự và hợp đồng lao động (P07-01, P07-02, P07-04; YCTD-58)
export type ContractType = 'probation' | 'fixed_term' | 'indefinite';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  probation: 'Thử việc',
  fixed_term: 'Có thời hạn',
  indefinite: 'Không thời hạn',
};

export interface Staff {
  id: string;
  org_unit_id: string;
  unit_name: string;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  id_number_masked: string | null;
  department_id: string | null;
  department_name: string | null;
  job_title_id: string | null;
  job_title_name: string | null;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'terminated';
  has_account: boolean;
  // DT-16 phần 16f
  bank_account_number?: string | null;
  bank_name?: string | null;
  tax_code?: string | null;
  special_difficulty_commune?: boolean;
  // DT-17 phần 17a
  concurrent_disability_support?: boolean;
  concurrent_shared_position?: boolean;
  id_verification_status?: 'unverified' | 'verified' | 'invalid';
}

export interface Contract {
  id: string;
  contract_no: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  base_salary: number;
  allowances: Array<{ name: string; amount: number }>;
  status: 'active' | 'terminated';
  terminated_on: string | null;
  terminate_reason: string | null;
}

export interface StaffDetail extends Staff {
  contracts: Contract[] | null;
  // Mã định danh Bộ GD&ĐT và thông tin theo CSDL ngành, chỉ đọc (YCTD-100)
  moet_staff_code?: string | null;
  moet_profile?: MoetProfileEntry[] | null;
  // Giá trị gốc của các ô theo Sở, ô bí mật đã che (YCTD-112)
  moet_fields?: Record<string, string | boolean>;
}

export interface StaffInput {
  org_unit_id: string;
  code: string;
  full_name: string;
  dob?: string;
  gender?: 'male' | 'female';
  phone?: string;
  email?: string;
  id_number?: string;
  department_id?: string;
  job_title_id?: string;
  start_date: string;
}

export interface ExpiringContract {
  id: string;
  contract_no: string;
  end_date: string;
  staff_id: string;
  full_name: string;
}

export const listStaff = (orgUnitId: string, search: string): Promise<Staff[]> =>
  requestJson(`/api/v1/staff?org_unit_id=${orgUnitId}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
export const readStaff = (staffId: string): Promise<StaffDetail> => requestJson(`/api/v1/staff/${staffId}`);
export const createStaff = (input: StaffInput) =>
  requestJson<StaffDetail>('/api/v1/staff', { method: 'POST', body: JSON.stringify(input) });
export const linkAccount = (staffId: string, login: string) =>
  requestJson<StaffDetail>(`/api/v1/staff/${staffId}/account`, { method: 'POST', body: JSON.stringify({ login }) });
export const unlinkAccount = (staffId: string) =>
  requestJson<StaffDetail>(`/api/v1/staff/${staffId}/account`, { method: 'DELETE' });
export const createContract = (
  staffId: string,
  input: {
    contract_no: string;
    contract_type: ContractType;
    start_date: string;
    end_date?: string;
    base_salary: number;
    allowances: Array<{ name: string; amount: number }>;
  },
) => requestJson<Contract>(`/api/v1/staff/${staffId}/contracts`, { method: 'POST', body: JSON.stringify(input) });
export const terminateContract = (contractId: string, terminatedOn: string, reason: string) =>
  requestJson<Contract>(`/api/v1/employment-contracts/${contractId}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ terminated_on: terminatedOn, reason }),
  });
export const listExpiringContracts = (): Promise<ExpiringContract[]> => requestJson('/api/v1/staff/expiring-contracts');

// 3.1.1 Hồ sơ cán bộ, giáo viên theo Sở (DT-15 phần 15d, YCTD-112)
export const STAFF_STATUS_LABELS: Record<Staff['status'], string> = {
  active: 'Đang làm việc',
  terminated: 'Đã nghỉ việc',
};

// Dòng của lưới; cột hợp đồng chỉ có giá trị khi người dùng xem được hợp đồng của đơn vị (BR-46)
export interface StaffListItem {
  id: string;
  org_unit_id: string;
  unit_name: string;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  status: Staff['status'];
  start_date: string;
  moet_staff_code: string | null;
  department_name: string | null;
  job_title_name: string | null;
  ethnicity: string | null;
  job_position: string | null;
  position_group: string | null;
  contract_form: string | null;
  professional_qualification: string | null;
  party_member: boolean;
  special_difficulty_commune: boolean;
  id_verification_status: 'unverified' | 'verified' | 'invalid';
  bank_account_number: string | null;
  tax_code: string | null;
  id_number_masked: string | null;
  has_account: boolean;
  contract_no: string | null;
  contract_type: ContractType | null;
  contract_end_date: string | null;
  base_salary: number | null;
}

export interface StaffPage {
  items: StaffListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  contract_fields_visible: boolean;
}

// Bộ lọc mở rộng (mục 3.1.1, 3.1.4 của Sở); giá trị rỗng là không lọc
export interface StaffFilter {
  org_unit_id?: string;
  department_id?: string;
  status?: string;
  q?: string;
  gender?: string;
  moet_staff_code?: string;
  id_number?: string;
  party_member?: string;
  age_from?: string;
  age_to?: string;
  job_position?: string;
  // Xã đặc biệt khó khăn, trạng thái xác thực số định danh (DT-16 phần 16f)
  special_difficulty_commune?: string;
  id_verification?: string;
}

const filterEntries = (filter: StaffFilter) =>
  Object.entries(filter).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');

export function searchStaff(filter: StaffFilter & { page: number; pageSize: number }): Promise<StaffPage> {
  const { page, pageSize, ...rest } = filter;
  const parameters = new URLSearchParams(filterEntries(rest));
  parameters.set('page', String(page));
  parameters.set('page_size', String(pageSize));
  return requestJson(`/api/v1/staff/search?${parameters.toString()}`);
}

// Xuất Excel hoặc PDF theo bộ lọc và các cột đang hiện trên lưới
export const exportStaff = (filter: StaffFilter, columns: string[], format: ExportFormat = 'xlsx') =>
  downloadPost(
    '/api/v1/staff/export',
    { ...Object.fromEntries(filterEntries(filter)), columns, format },
    `danh-sach-can-bo-giao-vien.${format}`,
  );

// Ghi hồ sơ theo biểu mẫu của Sở và thông tin riêng của trường; chỉ gửi ô đã đổi
export const updateStaffProfile = (staffId: string, changes: Record<string, unknown>) =>
  requestJson<StaffDetail>(`/api/v1/staff/${staffId}/profile`, { method: 'PATCH', body: JSON.stringify(changes) });

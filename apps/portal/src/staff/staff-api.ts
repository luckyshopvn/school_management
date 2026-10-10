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

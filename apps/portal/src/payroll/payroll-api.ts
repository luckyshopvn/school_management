import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối danh mục lương, biểu thuế, bảng lương và phiếu lương (P08-06, P08-08, P08-11; YCTD-60)
export type PayItemKind = 'allowance' | 'deduction';
export type PayCalculationMethod = 'fixed_monthly' | 'per_workday' | 'percent_of_base';

export const METHOD_LABELS: Record<PayCalculationMethod, string> = {
  fixed_monthly: 'Cố định mỗi tháng',
  per_workday: 'Mỗi ngày đi làm',
  percent_of_base: 'Phần trăm lương hợp đồng',
};

export const PAYROLL_STATUS_LABELS = { draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt' } as const;
export const SECTION_LABELS = {
  prepaid: 'Trả trước tháng này',
  adjustment: 'Điều chỉnh theo công tháng trước',
  tax: 'Thuế',
};

export interface PayItemType {
  id: string;
  kind: PayItemKind;
  code: string;
  name: string;
  calculation_method: PayCalculationMethod;
  default_amount: number | null;
  rate_percent: number | null;
  is_tax_exempt: boolean;
  is_mandatory_insurance: boolean;
  status: 'active' | 'inactive';
}

export interface PayItemTypeInput {
  kind: PayItemKind;
  code: string;
  name: string;
  calculation_method: PayCalculationMethod;
  default_amount: number | null;
  rate_percent: number | null;
  is_tax_exempt: boolean;
  is_mandatory_insurance: boolean;
}

export interface StaffPayItems {
  staff_id: string;
  dependents_count: number;
  can_manage: boolean;
  items: Array<{
    id: string;
    pay_item_type_id: string;
    kind: PayItemKind;
    code: string;
    name: string;
    calculation_method: PayCalculationMethod;
    amount: number | null;
    rate_percent: number | null;
    default_amount: number | null;
    default_rate_percent: number | null;
  }>;
}

export interface TaxTable {
  id: string;
  effective_from: string;
  personal_deduction: number;
  dependent_deduction: number;
  brackets: Array<{ up_to: number | null; rate_percent: number }>;
}

export interface PayslipLine {
  id: string;
  section: 'prepaid' | 'adjustment' | 'tax';
  line_type: string;
  code: string;
  name: string;
  amount: number;
  basis: string;
}

export interface Payslip {
  id: string;
  staff_id: string;
  full_name?: string;
  code?: string;
  unit_name?: string;
  period_year?: number;
  period_month?: number;
  prepaid_amount: number;
  adjustment_amount: number;
  taxable_income: number;
  tax_amount: number;
  net_amount: number;
  lines: PayslipLine[];
}

export interface PayrollSummary {
  id: string;
  period_year: number;
  period_month: number;
  status: keyof typeof PAYROLL_STATUS_LABELS;
  total_net: number;
}

export interface Payroll extends PayrollSummary {
  requires_principal: boolean;
  return_reason: string | null;
  can_manage: boolean;
  can_approve: boolean;
  skipped: Array<{ staff_id: string; full_name: string; reason: string }>;
  payslips: Payslip[];
}

const send = <T>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const listPayItemTypes = (): Promise<PayItemType[]> => requestJson('/api/v1/pay-item-types');
export const createPayItemType = (input: PayItemTypeInput) =>
  send<PayItemType>('POST', '/api/v1/pay-item-types', input);
export const updatePayItemType = (typeId: string, input: PayItemTypeInput & { status: 'active' | 'inactive' }) =>
  send<PayItemType>('PUT', `/api/v1/pay-item-types/${typeId}`, input);
export const readStaffPayItems = (staffId: string): Promise<StaffPayItems> =>
  requestJson(`/api/v1/staff/${staffId}/pay-items`);
export const addStaffPayItem = (
  staffId: string,
  input: { pay_item_type_id: string; amount: number | null; rate_percent: number | null },
) => send<StaffPayItems>('POST', `/api/v1/staff/${staffId}/pay-items`, input);
export const removeStaffPayItem = (itemId: string) => send<void>('DELETE', `/api/v1/staff-pay-items/${itemId}`);
export const setDependents = (staffId: string, count: number) =>
  send<StaffPayItems>('PUT', `/api/v1/staff/${staffId}/dependents`, { dependents_count: count });
export const listTaxTables = (): Promise<TaxTable[]> => requestJson('/api/v1/tax-tables');
export const createTaxTable = (input: Omit<TaxTable, 'id'>) => send<TaxTable>('POST', '/api/v1/tax-tables', input);

export const listPayrolls = (): Promise<PayrollSummary[]> => requestJson('/api/v1/payrolls');
export const readPayroll = (payrollId: string): Promise<Payroll> => requestJson(`/api/v1/payrolls/${payrollId}`);
export const calculatePayroll = (month: string) => send<Payroll>('POST', '/api/v1/payrolls', { month });
export const submitPayroll = (payrollId: string) => send<Payroll>('POST', `/api/v1/payrolls/${payrollId}/submit`);
export const approvePayroll = (payrollId: string) => send<Payroll>('POST', `/api/v1/payrolls/${payrollId}/approve`);
export const returnPayroll = (payrollId: string, reason: string) =>
  send<Payroll>('POST', `/api/v1/payrolls/${payrollId}/return`, { reason });
export const readMyPayslips = (): Promise<Payslip[]> => requestJson('/api/v1/me/payslips');

export const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

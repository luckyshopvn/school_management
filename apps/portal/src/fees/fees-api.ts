import { requestJson } from '../session/api-client.js';
import type { CatalogStatus } from '../catalogs/catalogs-api.js';

// Gọi nhóm điểm cuối danh mục học phí và tài chính của máy chủ API (P05-01, P05-02, P05-11, P06-10; YCTD-49)
export type CalculationMethod = 'monthly' | 'per_present_day';

export const CALCULATION_METHOD_LABELS: Record<CalculationMethod, string> = {
  monthly: 'Theo tháng',
  per_present_day: 'Theo ngày có mặt',
};

export interface Service {
  id: string;
  code: string;
  name: string;
  unit: string;
  calculation_method: CalculationMethod;
  is_mandatory: boolean;
  is_system: boolean;
  status: CatalogStatus;
}

export interface FeeScheduleItem {
  grade_level: string;
  fee_type: 'tuition' | 'service';
  service_id: string | null;
  service_name?: string | null;
  amount: number;
}

export interface FeeSchedule {
  id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
  is_editable: boolean;
  items: FeeScheduleItem[];
}

export interface DiscountType {
  id: string;
  code: string;
  name: string;
  calculation_method: 'percent' | 'amount';
  value: number;
  applies_to: string[];
  condition_note: string | null;
  status: CatalogStatus;
}

export interface CashflowCategory {
  id: string;
  code: string;
  name: string;
  group_name: string;
  flow_type: 'income' | 'expense';
  status: CatalogStatus;
}

const send = <Result>(path: string, method: string, body: unknown): Promise<Result> =>
  requestJson(path, { method, body: JSON.stringify(body) });

export const listServices = (): Promise<Service[]> => requestJson('/api/v1/services');
export const createService = (input: Omit<Service, 'id' | 'status' | 'is_system'>) =>
  send<Service>('/api/v1/services', 'POST', input);
export const updateService = (id: string, changes: Partial<Omit<Service, 'id' | 'code' | 'is_system'>>) =>
  send<Service>(`/api/v1/services/${id}`, 'PATCH', changes);

export const listFeeSchedules = (): Promise<FeeSchedule[]> => requestJson('/api/v1/fee-schedules');
export const createFeeSchedule = (input: { name: string; effective_from: string; items: FeeScheduleItem[] }) =>
  send<FeeSchedule>('/api/v1/fee-schedules', 'POST', input);
export const replaceFeeSchedule = (id: string, input: { name: string; items: FeeScheduleItem[] }) =>
  send<FeeSchedule>(`/api/v1/fee-schedules/${id}`, 'PUT', input);
export const deleteFeeSchedule = (id: string) => requestJson(`/api/v1/fee-schedules/${id}`, { method: 'DELETE' });

export const listDiscountTypes = (): Promise<DiscountType[]> => requestJson('/api/v1/discount-types');
export const createDiscountType = (input: Omit<DiscountType, 'id' | 'status'>) =>
  send<DiscountType>('/api/v1/discount-types', 'POST', input);
export const updateDiscountType = (id: string, changes: Partial<Pick<DiscountType, 'name' | 'value' | 'status'>>) =>
  send<DiscountType>(`/api/v1/discount-types/${id}`, 'PATCH', changes);

export const listCashflowCategories = (): Promise<CashflowCategory[]> => requestJson('/api/v1/cashflow-categories');
export const createCashflowCategory = (input: Omit<CashflowCategory, 'id' | 'status'>) =>
  send<CashflowCategory>('/api/v1/cashflow-categories', 'POST', input);
export const updateCashflowCategory = (
  id: string,
  changes: Partial<Pick<CashflowCategory, 'name' | 'group_name' | 'status'>>,
) => send<CashflowCategory>(`/api/v1/cashflow-categories/${id}`, 'PATCH', changes);

export const formatMoney = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

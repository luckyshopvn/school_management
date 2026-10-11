import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối bảng điều khiển và báo cáo cơ bản (P17; YCTD-62)
export interface Dashboard {
  month: string;
  children_count: number;
  classes_count: number;
  staff_count: number;
  tuition: { invoice_count: number; payable_amount: number; paid_amount: number; outstanding_amount: number };
  debt: { outstanding_amount: number; overdue_amount: number };
  attendance: { present_count: number; record_count: number; rate_percent: number | null };
}

export interface Birthday {
  id: string;
  full_name: string;
  dob: string;
  class_name: string;
  turning_age: number;
}

export type ReportRow = Record<string, string | number | null>;

const query = (values: Record<string, string | null | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`)
    .join('&');

export const readDashboard = (
  kind: 'leadership' | 'unit',
  month: string,
  orgUnitId: string | null,
): Promise<Dashboard> => requestJson(`/api/v1/dashboard/${kind}?${query({ month, org_unit_id: orgUnitId })}`);
export const readBirthdays = (month: string): Promise<Birthday[]> =>
  requestJson(`/api/v1/dashboard/birthdays?${query({ month })}`);
export const readReport = (
  path: string,
  values: Record<string, string | null | undefined>,
): Promise<Record<string, unknown>> => requestJson(`/api/v1/reports/${path}?${query(values)}`);

export const formatNumber = (value: unknown) =>
  typeof value === 'number' ? new Intl.NumberFormat('vi-VN').format(value) : String(value ?? '');

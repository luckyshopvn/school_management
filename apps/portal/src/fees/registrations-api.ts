import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối đăng ký dịch vụ và học hè của máy chủ API (P05-03, P05-04, P05-13; YCTD-50)
export type RegistrationStatus = 'active' | 'pending_late' | 'pending_cancel' | 'cancelled' | 'rejected';

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  active: 'Đã đăng ký',
  pending_late: 'Chờ duyệt đăng ký trễ',
  pending_cancel: 'Chờ duyệt hủy',
  cancelled: 'Đã hủy',
  rejected: 'Bị từ chối',
};

export interface Registration {
  id: string;
  child_id: string;
  service_id: string;
  status: RegistrationStatus;
  source: string;
  is_late: boolean;
  service_start_date: string | null;
  late_charge_method: 'full_month' | 'actual_days' | null;
}

export interface PeriodInfo {
  period: string;
  is_summer: boolean;
}

export interface RegistrationSheet {
  period: string;
  is_summer: boolean;
  closing_date: string;
  is_locked: boolean;
  is_late: boolean;
  services: Array<{ id: string; code: string; name: string; is_mandatory: boolean }>;
  children: Array<{
    child_id: string;
    full_name: string;
    class_name: string;
    summer_registered: boolean;
    registrations: Registration[];
  }>;
}

export interface PendingRegistration extends Registration {
  child_name: string;
  service_name: string;
  period_year: number;
  period_month: number;
  registered_at: string;
}

const post = <Result>(path: string, body: unknown = {}): Promise<Result> =>
  requestJson(path, { method: 'POST', body: JSON.stringify(body) });

export const listPeriods = (): Promise<PeriodInfo[]> => requestJson('/api/v1/service-registrations/periods');
export const readSheet = (orgUnitId: string, period: string): Promise<RegistrationSheet> =>
  requestJson(`/api/v1/service-registrations?org_unit_id=${orgUnitId}&period=${period}`);
export const listPending = (orgUnitId: string): Promise<PendingRegistration[]> =>
  requestJson(`/api/v1/service-registrations/pending?org_unit_id=${orgUnitId}`);
export const registerService = (input: {
  child_id: string;
  period: string;
  service_id: string;
  service_start_date?: string | null;
}) => post<Registration>('/api/v1/service-registrations', input);
export const cancelRegistration = (id: string) => post<Registration>(`/api/v1/service-registrations/${id}/cancel`);
export const lockPeriod = (orgUnitId: string, period: string) =>
  post<RegistrationSheet>('/api/v1/service-registrations/lock', { org_unit_id: orgUnitId, period });
export const approveLate = (id: string, chargeMethod: 'full_month' | 'actual_days' | null) =>
  post<Registration>(
    `/api/v1/service-registrations/${id}/approve-late`,
    chargeMethod ? { charge_method: chargeMethod } : {},
  );
export const rejectLate = (id: string, reason: string) =>
  post<Registration>(`/api/v1/service-registrations/${id}/reject-late`, { reason });
export const registerSummer = (childId: string, period: string) =>
  post('/api/v1/summer-registrations', { child_id: childId, period });

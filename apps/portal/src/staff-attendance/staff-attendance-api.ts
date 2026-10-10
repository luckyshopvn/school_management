import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối ngày nghỉ lễ, lịch học bù, nghỉ bù và chấm công nhân sự (P08-01, P08-09, P08-10; YCTD-59)
export type StaffDay =
  | { date: string; kind: 'work' }
  | { date: string; kind: 'holiday'; name: string; is_paid: boolean }
  | { date: string; kind: 'compensatory_day_off' }
  | { date: string; kind: 'rest' };

export interface AttendanceLog {
  id: string;
  staff_id: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  source: 'self' | 'manual';
  note: string | null;
}

export interface MyAttendance {
  staff: { id: string; code: string; full_name: string; status: 'active' | 'terminated' };
  today: string;
  today_log: AttendanceLog | null;
  days: StaffDay[];
  logs: AttendanceLog[];
}

export interface AttendanceSheet {
  org_unit_id: string;
  month: string;
  today: string;
  work_hours: { start_time: string | null; end_time: string | null; lunch_break_minutes: number };
  can_manage: boolean;
  days: StaffDay[];
  staff: Array<{
    id: string;
    code: string;
    full_name: string;
    start_date: string;
    end_date: string | null;
    status: 'active' | 'terminated';
    logs: AttendanceLog[];
  }>;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
  is_paid: boolean;
}

export type SchoolDayChangeType = 'makeup_school_day' | 'compensatory_day_off';

export const SCHOOL_DAY_CHANGE_LABELS: Record<SchoolDayChangeType, string> = {
  makeup_school_day: 'Học bù thứ bảy',
  compensatory_day_off: 'Nghỉ bù',
};

export interface SchoolDayChange {
  id: string;
  change_date: string;
  change_type: SchoolDayChangeType;
  note: string | null;
}

const send = <T>(method: string, path: string, body?: unknown) =>
  requestJson<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const readMyAttendance = (month: string): Promise<MyAttendance> =>
  requestJson(`/api/v1/me/attendance-logs?month=${month}`);
export const checkIn = () => send<MyAttendance>('POST', '/api/v1/me/attendance-logs/check-in');
export const checkOut = () => send<MyAttendance>('POST', '/api/v1/me/attendance-logs/check-out');
export const readAttendanceSheet = (orgUnitId: string, month: string): Promise<AttendanceSheet> =>
  requestJson(`/api/v1/attendance-logs?org_unit_id=${orgUnitId}&month=${month}`);
export const saveAttendanceLog = (input: {
  staff_id: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  note: string | null;
}) => send<AttendanceLog>('PUT', '/api/v1/attendance-logs', input);

export const listSchoolDays = (year: number): Promise<{ holidays: Holiday[]; changes: SchoolDayChange[] }> =>
  requestJson(`/api/v1/school-days?year=${year}`);
export const createHoliday = (input: { holiday_date: string; name: string; is_paid: boolean }) =>
  send<Holiday>('POST', '/api/v1/holidays', input);
export const updateHoliday = (holidayId: string, input: { name: string; is_paid: boolean }) =>
  send<Holiday>('PUT', `/api/v1/holidays/${holidayId}`, input);
export const deleteHoliday = (holidayId: string) => send<void>('DELETE', `/api/v1/holidays/${holidayId}`);
export const createSchoolDayChange = (input: {
  change_date: string;
  change_type: SchoolDayChangeType;
  note: string | null;
}) => send<SchoolDayChange>('POST', '/api/v1/school-day-changes', input);
export const deleteSchoolDayChange = (changeId: string) =>
  send<void>('DELETE', `/api/v1/school-day-changes/${changeId}`);

export function formatMinutes(total: number | null): string {
  if (total === null) {
    return '';
  }
  return `${Math.floor(total / 60)} giờ ${String(total % 60).padStart(2, '0')} phút`;
}

export function describeDay(day: StaffDay): string {
  switch (day.kind) {
    case 'work':
      return 'Ngày làm việc';
    case 'holiday':
      return `Nghỉ lễ: ${day.name}${day.is_paid ? '' : ' (không lương)'}`;
    case 'compensatory_day_off':
      return 'Nghỉ bù';
    case 'rest':
      return 'Ngày nghỉ';
  }
}

// Phép năm, đơn nghỉ phép, chốt và mở lại bảng công (P08-03, P08-04, P08-11; YCTD-59)
export type DayHalf = 'morning' | 'afternoon';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
};

export interface LeaveRequest {
  id: string;
  staff_id: string;
  full_name: string;
  staff_code: string;
  org_unit_id: string;
  leave_type_id: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  first_day_half: DayHalf | null;
  last_day_half: DayHalf | null;
  days: string | number;
  reason: string;
  status: LeaveRequestStatus;
  created_by: string;
  reject_reason: string | null;
}

export interface LeaveBalance {
  granted: boolean;
  policy_missing: boolean;
  entitled_days: number | null;
  used_days: number;
  remaining_days: number | null;
  adjust_reason: string | null;
}

export interface LeavePolicy {
  id: string;
  job_title_id: string;
  job_title_name: string;
  unit_name: string;
  seniority_from_years: number;
  seniority_to_years: number | null;
  entitled_days: number;
  status: 'active' | 'inactive';
}

export interface LeaveRequestInput {
  staff_id?: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  first_day_half: DayHalf | null;
  last_day_half: DayHalf | null;
  reason: string;
}

export interface TimesheetPeriod {
  org_unit_id: string;
  month: string;
  status: 'open' | 'closed' | 'reopened';
  closed_at: string | null;
  can_close: boolean;
  can_approve_reopen: boolean;
  reopen_requests: Array<{
    id: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    requested_at: string;
    reject_reason: string | null;
  }>;
  summary: Array<{
    staff_id: string;
    code: string;
    full_name: string;
    present_days: number;
    leave_days: number;
    absent_days: number;
    unpaid_days: number;
    insurance_days: number;
    overtime_minutes: number;
  }>;
}

export const readMyLeave = (): Promise<{
  staff: { id: string; full_name: string };
  balance: LeaveBalance & { year: number };
  requests: LeaveRequest[];
}> => requestJson('/api/v1/me/leave-requests');
export const listLeaveRequests = (
  orgUnitId: string,
  status: LeaveRequestStatus | '',
): Promise<{ can_approve: boolean; can_manage: boolean; requests: LeaveRequest[] }> =>
  requestJson(`/api/v1/leave-requests?org_unit_id=${orgUnitId}${status ? `&status=${status}` : ''}`);
export const createLeaveRequest = (input: LeaveRequestInput) =>
  send<LeaveRequest>('POST', '/api/v1/leave-requests', input);
export const approveLeaveRequest = (requestId: string) =>
  send<LeaveRequest>('POST', `/api/v1/leave-requests/${requestId}/approve`);
export const rejectLeaveRequest = (requestId: string, reason: string) =>
  send<LeaveRequest>('POST', `/api/v1/leave-requests/${requestId}/reject`, { reason });
export const cancelLeaveRequest = (requestId: string) =>
  send<LeaveRequest>('POST', `/api/v1/leave-requests/${requestId}/cancel`);

export const listLeavePolicies = (): Promise<LeavePolicy[]> => requestJson('/api/v1/leave-policies');
export const createLeavePolicy = (input: {
  job_title_id: string;
  seniority_from_years: number;
  seniority_to_years: number | null;
  entitled_days: number;
}) => send<LeavePolicy>('POST', '/api/v1/leave-policies', input);
export const updateLeavePolicy = (
  policyId: string,
  input: {
    job_title_id: string;
    seniority_from_years: number;
    seniority_to_years: number | null;
    entitled_days: number;
    status: 'active' | 'inactive';
  },
) => send<LeavePolicy>('PUT', `/api/v1/leave-policies/${policyId}`, input);
export const listLeaveBalances = (
  orgUnitId: string,
  year: number,
): Promise<Array<LeaveBalance & { staff_id: string; code: string; full_name: string }>> =>
  requestJson(`/api/v1/leave-balances?org_unit_id=${orgUnitId}&year=${year}`);
export const adjustLeaveBalance = (input: { staff_id: string; year: number; entitled_days: number; reason: string }) =>
  send<LeaveBalance>('PUT', '/api/v1/leave-balances', input);

export const readTimesheetPeriod = (orgUnitId: string, month: string): Promise<TimesheetPeriod> =>
  requestJson(`/api/v1/timesheet-periods?org_unit_id=${orgUnitId}&month=${month}`);
export const closeTimesheet = (orgUnitId: string, month: string) =>
  send<TimesheetPeriod>('POST', '/api/v1/attendance-logs/lock', { org_unit_id: orgUnitId, month });
export const requestTimesheetReopen = (orgUnitId: string, month: string, reason: string) =>
  send<unknown>('POST', '/api/v1/attendance-logs/reopen-requests', { org_unit_id: orgUnitId, month, reason });
export const approveTimesheetReopen = (requestId: string) =>
  send<TimesheetPeriod>('POST', `/api/v1/attendance-logs/reopen-requests/${requestId}/approve`);
export const rejectTimesheetReopen = (requestId: string, reason: string) =>
  send<TimesheetPeriod>('POST', `/api/v1/attendance-logs/reopen-requests/${requestId}/reject`, { reason });

export function describeLeaveDates(
  request: Pick<LeaveRequest, 'from_date' | 'to_date' | 'first_day_half' | 'last_day_half'>,
): string {
  const half = (value: DayHalf | null) =>
    value === 'morning' ? ' (buổi sáng)' : value === 'afternoon' ? ' (buổi chiều)' : '';
  return request.from_date === request.to_date
    ? `${request.from_date}${half(request.first_day_half)}`
    : `${request.from_date}${half(request.first_day_half)} đến ${request.to_date}${half(request.last_day_half)}`;
}

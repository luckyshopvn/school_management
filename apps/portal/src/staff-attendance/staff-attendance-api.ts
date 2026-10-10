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

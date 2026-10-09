import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối năm học của máy chủ API (17_DAC_TA_API.md mục P01)
export type AcademicYearStatus = 'draft' | 'open' | 'closed';

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: AcademicYearStatus;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface Calendar {
  first_term: DateRange;
  second_term: DateRange;
  summer_term: DateRange | null;
  school_days_of_week: number[];
}

export interface SchoolWeek {
  week_no: number;
  start_date: string;
  end_date: string;
  is_off: boolean;
  note: string | null;
}

export function listAcademicYears(): Promise<AcademicYear[]> {
  return requestJson('/api/v1/academic-years');
}

export function createAcademicYear(name: string): Promise<AcademicYear> {
  return requestJson('/api/v1/academic-years', { method: 'POST', body: JSON.stringify({ name }) });
}

export function readCalendar(academicYearId: string): Promise<Calendar> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/calendar`);
}

export function saveCalendar(academicYearId: string, calendar: Calendar): Promise<Calendar> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/calendar`, {
    method: 'PUT',
    body: JSON.stringify(calendar),
  });
}

export function listWeeks(academicYearId: string): Promise<SchoolWeek[]> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/weeks`);
}

export function updateWeeks(
  academicYearId: string,
  weeks: Array<Pick<SchoolWeek, 'week_no' | 'is_off' | 'note'>>,
): Promise<SchoolWeek[]> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/weeks`, {
    method: 'PATCH',
    body: JSON.stringify({ weeks }),
  });
}

export function openAcademicYear(academicYearId: string): Promise<AcademicYear> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/open`, { method: 'POST' });
}

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

export type TermType = 'first_term' | 'second_term' | 'summer_term';

export interface SchoolWeek {
  week_no: number;
  start_date: string;
  end_date: string;
  // Tuần nghỉ là tuần đệm, ghi chú là tên tuần đệm ở 3.4 Khai báo tuần (DT-16 phần 16e)
  is_off: boolean;
  note: string | null;
  // Học kỳ đang áp dụng (chọn riêng hoặc theo lịch), học kỳ chọn riêng, hiển thị (DT-16 phần 16e)
  term: TermType | null;
  term_type: TermType | null;
  is_visible: boolean;
}

export type WeekChange = Pick<SchoolWeek, 'week_no' | 'is_off' | 'note'> &
  Partial<Pick<SchoolWeek, 'term_type' | 'is_visible'>>;

export const TERM_LABELS: Record<TermType, string> = {
  first_term: 'Học kỳ 1',
  second_term: 'Học kỳ 2',
  summer_term: 'Kỳ hè',
};

// 5.7 Chuyển hồ sơ lên năm học mới (DT-16 phần 16e)
export interface RolloverStatus {
  current: AcademicYear | null;
  candidates: AcademicYear[];
  cancel: { allowed: boolean; reason: string | null };
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

export function updateWeeks(academicYearId: string, weeks: WeekChange[]): Promise<SchoolWeek[]> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/weeks`, {
    method: 'PATCH',
    body: JSON.stringify({ weeks }),
  });
}

export function openAcademicYear(academicYearId: string): Promise<AcademicYear> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/open`, { method: 'POST' });
}

export function readRolloverStatus(): Promise<RolloverStatus> {
  return requestJson('/api/v1/academic-years/rollover/status');
}

export function cancelOpenAcademicYear(academicYearId: string): Promise<AcademicYear> {
  return requestJson(`/api/v1/academic-years/${academicYearId}/cancel-open`, { method: 'POST' });
}

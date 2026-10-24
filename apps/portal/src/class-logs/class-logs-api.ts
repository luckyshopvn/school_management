import type {
  LessonRating,
  LessonRatingRule,
  LessonRatingSettings,
  PeriodAttendanceStatus,
  SchoolLevelCode,
} from '@school-management/shared';
import { downloadFile } from '../growth/growth-api.js';
import { requestJson } from '../session/api-client.js';

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162); tiết nhóm, quy tắc xếp loại tiết theo cấp, sơ đồ chỗ ngồi,
// xuất sổ tuần (DT-21 phần 21d, YCTD-171)
export interface ClassLog {
  id: string;
  lesson_title: string;
  content: string | null;
  comment: string | null;
  rating: LessonRating | null;
  status: 'draft' | 'signed';
  teacher_name: string;
  signed_at: string | null;
}

export interface ClassLogWeek {
  class: { id: string; name: string; school_level: SchoolLevelCode };
  week_start: string;
  days: Array<{
    date: string;
    weekday: number;
    lessons: Array<{
      period_no: number;
      // Nhóm học (21b): 0 là cả lớp
      group_no: number;
      subject_name: string | null;
      teacher_name: string | null;
      log: ClassLog | null;
      absent_count: number;
      late_count: number;
    }>;
  }>;
  review: { reviewer_name: string; comment: string | null; signed_at: string } | null;
}

export interface SeatingView {
  id: string;
  effective_from: string;
  desk_columns: number;
  desk_rows: number;
  seats_per_desk: number;
  assignments: Array<{ child_id: string; full_name: string; column_no: number; row_no: number; seat_no: number }>;
}

export interface ClassLogDetail {
  lesson_date: string;
  period_no: number;
  group_no: number;
  group_filtered: boolean;
  subject_name: string | null;
  teacher_name: string | null;
  log: ClassLog | null;
  rating: LessonRatingSettings;
  seating: SeatingView | null;
  students: Array<{
    child_id: string;
    full_name: string;
    absence_reason: string | null;
    status: PeriodAttendanceStatus;
    note: string | null;
  }>;
}

export interface ClassLogSettingsRow extends LessonRatingSettings {
  school_level: SchoolLevelCode;
  rating_mode: LessonRatingRule;
  updated_by_name: string | null;
}

export interface PeriodAttendanceSummary {
  lessons: number;
  students: Array<{
    child_id: string;
    full_name: string;
    present: number;
    late: number;
    absent_excused: number;
    absent_unexcused: number;
    absent_days: number;
    notice_days: number;
    absent_without_notice_days: number;
    notice_but_present_days: number;
    daily_absent_days: number;
  }>;
}

export const readClassLogWeek = (classId: string, date: string): Promise<ClassLogWeek> =>
  requestJson(`/api/v1/class-logs/week?class_id=${classId}&date=${date}`);
export const readClassLogDetail = (
  classId: string,
  date: string,
  periodNo: number,
  groupNo = 0,
): Promise<ClassLogDetail> =>
  requestJson(`/api/v1/class-logs/lesson?class_id=${classId}&date=${date}&period_no=${periodNo}&group_no=${groupNo}`);
export const signClassLogWeek = (classId: string, date: string, comment: string) =>
  requestJson('/api/v1/class-logs/reviews', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, date, comment: comment || null }),
  });
export const exportClassLogWeek = (classId: string, date: string, format: 'xlsx' | 'pdf') =>
  downloadFile(
    `/api/v1/class-logs/week/export?class_id=${classId}&date=${date}&format=${format}`,
    `so-dau-bai.${format}`,
  );
export const readClassLogSettings = (): Promise<ClassLogSettingsRow[]> => requestJson('/api/v1/class-logs/settings');
export const saveClassLogSettings = (level: SchoolLevelCode, settings: LessonRatingSettings) =>
  requestJson<ClassLogSettingsRow>('/api/v1/class-logs/settings', {
    method: 'PUT',
    body: JSON.stringify({ school_level: level, ...settings }),
  });
export const readPeriodAttendanceSummary = (
  classId: string,
  from: string,
  to: string,
): Promise<PeriodAttendanceSummary> =>
  requestJson(`/api/v1/period-attendance/summary?class_id=${classId}&from=${from}&to=${to}`);

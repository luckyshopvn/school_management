import type { PeriodAttendanceStatus } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162)
export interface ClassLog {
  id: string;
  lesson_title: string;
  content: string | null;
  comment: string | null;
  rating: string | null;
  status: 'draft' | 'signed';
  teacher_name: string;
  signed_at: string | null;
}

export interface ClassLogWeek {
  class: { id: string; name: string };
  week_start: string;
  days: Array<{
    date: string;
    weekday: number;
    lessons: Array<{
      period_no: number;
      subject_name: string | null;
      teacher_name: string | null;
      log: ClassLog | null;
      absent_count: number;
      late_count: number;
    }>;
  }>;
  review: { reviewer_name: string; comment: string | null; signed_at: string } | null;
}

export interface ClassLogDetail {
  lesson_date: string;
  period_no: number;
  subject_name: string | null;
  teacher_name: string | null;
  log: ClassLog | null;
  students: Array<{
    child_id: string;
    full_name: string;
    absence_reason: string | null;
    status: PeriodAttendanceStatus;
    note: string | null;
  }>;
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
export const readClassLogDetail = (classId: string, date: string, periodNo: number): Promise<ClassLogDetail> =>
  requestJson(`/api/v1/class-logs/lesson?class_id=${classId}&date=${date}&period_no=${periodNo}`);
export const signClassLogWeek = (classId: string, date: string, comment: string) =>
  requestJson('/api/v1/class-logs/reviews', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, date, comment: comment || null }),
  });
export const readPeriodAttendanceSummary = (
  classId: string,
  from: string,
  to: string,
): Promise<PeriodAttendanceSummary> =>
  requestJson(`/api/v1/period-attendance/summary?class_id=${classId}&from=${from}&to=${to}`);

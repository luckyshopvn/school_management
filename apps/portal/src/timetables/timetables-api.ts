import type { SchoolLevelCode } from '@school-management/shared';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Thời khoá biểu phần khung (DT-20 phần 22c1, YCTD-160): khung giờ tiết học, bản thời khoá biểu, tiết, xung đột, ban hành,
// nhập Excel, xem bản đang áp dụng
export interface PeriodSlot {
  period_no: number;
  session: 'morning' | 'afternoon';
  start_time: string;
  end_time: string;
}

export interface TimetableVersion {
  id: string;
  school_level: SchoolLevelCode;
  name: string;
  effective_from: string;
  status: 'draft' | 'published';
  source: 'manual' | 'import' | 'generator';
  note: string | null;
  published_at: string | null;
  published_by_name: string | null;
  is_current?: boolean;
}

export interface TimetableLesson {
  id: string;
  version_id: string;
  class_id: string;
  class_name: string;
  weekday: number;
  period_no: number;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  room_name: string | null;
  // 0 là tiết cả lớp, 1 đến 9 là nhóm học (DT-21 phần 21b)
  group_no: number;
}

export interface TimetableConflict {
  severity: 'hard' | 'soft';
  code: string;
  message: string;
  class_id?: string;
  weekday?: number;
  period_no?: number;
}

export interface TimetableView {
  versions: Array<{ id: string; school_level: SchoolLevelCode; name: string; effective_from: string }>;
  slots: Partial<Record<SchoolLevelCode, PeriodSlot[]>>;
  lessons: TimetableLesson[];
}

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const listPeriodSlots = (level: SchoolLevelCode): Promise<PeriodSlot[]> =>
  requestJson(`/api/v1/period-slots?school_level=${level}`);
export const savePeriodSlots = (level: SchoolLevelCode, slots: PeriodSlot[]): Promise<PeriodSlot[]> =>
  requestJson('/api/v1/period-slots', json('PUT', { school_level: level, slots }));
export const listTimetableVersions = (level: SchoolLevelCode): Promise<TimetableVersion[]> =>
  requestJson(`/api/v1/timetable-versions?school_level=${level}`);
export const createTimetableVersion = (input: {
  school_level: SchoolLevelCode;
  name: string;
  effective_from: string;
  copy_from_id: string | null;
}): Promise<TimetableVersion> => requestJson('/api/v1/timetable-versions', json('POST', input));
export const deleteTimetableVersion = (id: string): Promise<void> =>
  requestJson(`/api/v1/timetable-versions/${id}`, json('DELETE'));
export const readVersionLessons = (
  id: string,
  filter: { class_id?: string; teacher_user_id?: string; room_id?: string } = {},
): Promise<{ version: TimetableVersion; slots: PeriodSlot[]; lessons: TimetableLesson[] }> => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as Array<[string, string]>);
  return requestJson(`/api/v1/timetable-versions/${id}/lessons?${query.toString()}`);
};
export const saveClassLessons = (
  versionId: string,
  classId: string,
  lessons: Array<{ weekday: number; period_no: number; subject_id: string; room_id: string | null; group_no: number }>,
): Promise<TimetableLesson[]> =>
  requestJson(`/api/v1/timetable-versions/${versionId}/classes/${classId}/lessons`, json('PUT', { lessons }));
export const readConflicts = (id: string): Promise<TimetableConflict[]> =>
  requestJson(`/api/v1/timetable-versions/${id}/conflicts`);
export const publishTimetable = (id: string): Promise<TimetableVersion> =>
  requestJson(`/api/v1/timetable-versions/${id}/publish`, json('POST'));
export const importTimetable = (
  id: string,
  file: File,
): Promise<{
  imported: number;
  classes: number;
  errors: Array<{ row: number; column: string | null; message: string }>;
}> => {
  const form = new FormData();
  form.set('file', file);
  return requestJson(`/api/v1/timetable-versions/${id}/import`, { method: 'POST', body: form });
};
export async function downloadTimetableTemplate(id: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/timetable-versions/${id}/import-template`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không tải được mẫu');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = 'mau-thoi-khoa-bieu.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
// Xuất Excel bản thời khoá biểu (YCTD-317): theo lớp, giáo viên, phòng đang chọn; không chọn thì mọi lớp, mỗi lớp một trang
export async function exportTimetableVersion(
  id: string,
  filter: { class_id?: string; teacher_user_id?: string; room_id?: string },
): Promise<void> {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as Array<[string, string]>);
  const response = await fetchWithSession(`/api/v1/timetable-versions/${id}/export?${query.toString()}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không xuất được thời khoá biểu');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = 'thoi-khoa-bieu.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
export const readTimetableView = (filter: {
  class_id?: string;
  teacher_user_id?: string;
  room_id?: string;
}): Promise<TimetableView> => {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as Array<[string, string]>);
  return requestJson(`/api/v1/timetables?${query.toString()}`);
};

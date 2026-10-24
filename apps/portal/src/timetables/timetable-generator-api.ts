import type { SchoolLevelCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';
import type { PeriodSlot, TimetableConflict, TimetableLesson, TimetableVersion } from './timetables-api.js';

// Máy xếp thời khoá biểu, dạy thay, đổi tiết, báo cáo, mã tra cứu (DT-20 phần 22c2, YCTD-164)
export type SoftConstraintCode = 'double_period' | 'avoid_last_period' | 'spread_week' | 'teacher_gaps' | 'class_gaps';

export interface GeneratorSettings {
  school_level: SchoolLevelCode;
  weights: Record<SoftConstraintCode, number>;
  time_limit_seconds: number;
  variant_count: number;
  soft_constraints: Array<{ code: SoftConstraintCode; label: string; default_weight: number }>;
  hard_constraints: Array<{ code: string; label: string }>;
}

export interface SubjectRule {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  double_period: boolean;
  avoid_last_period: boolean;
  max_per_day: number | null;
  room_id: string | null;
}

export interface TeacherBusy {
  slots: PeriodSlot[];
  school_days: number[];
  teachers: Array<{
    teacher_user_id: string;
    teacher_name: string;
    busy: Array<{ weekday: number; period_no: number }>;
  }>;
}

export interface GeneratorIssue {
  code: string;
  severity: 'hard' | 'soft';
  message: string;
}

export interface GenerationRun {
  id: string;
  school_level: SchoolLevelCode;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  time_limit_seconds: number;
  variant_count: number;
  percent: number;
  best_score: string | null;
  best_hard: number | null;
  message: string | null;
  issues: GeneratorIssue[];
  created_by_name: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface GenerationVariant {
  variant_no: number;
  score: number;
  hard_count: number;
  soft: Array<{ code: SoftConstraintCode; label: string; penalty: number; weight: number }>;
  violations: Array<{ code: string; message: string }>;
  violation_count: number;
  version_id: string | null;
  version_name: string | null;
}

export interface TimetableChange {
  id: string;
  change_date: string;
  kind: 'substitute' | 'swap';
  pair_id: string | null;
  class_id: string;
  class_name: string;
  period_no: number;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  original_subject_name: string | null;
  original_teacher_name: string | null;
  reason: string | null;
  created_by_name: string | null;
}

export interface EffectiveLesson {
  class_id: string;
  class_name: string;
  period_no: number;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_name: string | null;
  change: { id: string; kind: 'substitute' | 'swap'; original_teacher_name: string | null } | null;
}

export interface TeachingReport {
  from: string;
  to: string;
  days: number;
  teachers: Array<{
    teacher_user_id: string;
    teacher_name: string;
    planned: number;
    substitute_taught: number;
    substituted_away: number;
    swapped: number;
    actual: number;
  }>;
}

export interface RoomReport {
  date: string;
  slot_count: number;
  rooms: Array<{
    room_id: string;
    room_name: string;
    periods: number;
    usage_percent: number;
    by_weekday: Record<string, number>;
    classes: string[];
  }>;
}

export interface LookupCode {
  id: string;
  kind: 'class' | 'teacher';
  target_id: string;
  target_name: string;
  code: string;
}

export interface PublicLookup {
  kind: 'class' | 'teacher';
  target_name: string;
  versions: Array<{ name: string; effective_from: string }>;
  slots: Partial<Record<SchoolLevelCode, PeriodSlot[]>>;
  lessons: Array<{
    weekday: number;
    period_no: number;
    class_name: string;
    subject_name: string;
    teacher_name: string | null;
    room_name: string | null;
  }>;
  changes: Array<{
    change_date: string;
    kind: 'substitute' | 'swap';
    class_name: string;
    period_no: number;
    subject_name: string;
    teacher_name: string | null;
    original_subject_name: string | null;
    original_teacher_name: string | null;
  }>;
}

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const readGeneratorSettings = (level: SchoolLevelCode): Promise<GeneratorSettings> =>
  requestJson(`/api/v1/timetable-generator/settings?school_level=${level}`);
export const saveGeneratorSettings = (
  level: SchoolLevelCode,
  input: Pick<GeneratorSettings, 'weights' | 'time_limit_seconds' | 'variant_count'>,
): Promise<GeneratorSettings> =>
  requestJson('/api/v1/timetable-generator/settings', json('PUT', { school_level: level, ...input }));
export const readSubjectRules = (
  level: SchoolLevelCode,
): Promise<{ subjects: SubjectRule[]; rooms: Array<{ id: string; code: string; name: string }> }> =>
  requestJson(`/api/v1/timetable-generator/subject-rules?school_level=${level}`);
export const saveSubjectRules = (level: SchoolLevelCode, rules: SubjectRule[]) =>
  requestJson('/api/v1/timetable-generator/subject-rules', json('PUT', { school_level: level, rules }));
export const readTeacherBusy = (level: SchoolLevelCode): Promise<TeacherBusy> =>
  requestJson(`/api/v1/timetable-generator/teacher-busy?school_level=${level}`);
export const saveTeacherBusy = (teacherUserId: string, slots: Array<{ weekday: number; period_no: number }>) =>
  requestJson(`/api/v1/timetable-generator/teacher-busy/${teacherUserId}`, json('PUT', { slots }));
export const readPrecheck = (
  level: SchoolLevelCode,
): Promise<{ classes: number; teachers: number; lessons: number; slots: number; issues: GeneratorIssue[] }> =>
  requestJson(`/api/v1/timetable-generator/precheck?school_level=${level}`);
export const listGenerationRuns = (level: SchoolLevelCode): Promise<GenerationRun[]> =>
  requestJson(`/api/v1/timetable-generations?school_level=${level}`);
export const startGeneration = (level: SchoolLevelCode): Promise<GenerationRun> =>
  requestJson('/api/v1/timetable-generations', json('POST', { school_level: level }));
export const readGenerationRun = (id: string): Promise<GenerationRun & { variants: GenerationVariant[] }> =>
  requestJson(`/api/v1/timetable-generations/${id}`);
export const cancelGeneration = (id: string) => requestJson(`/api/v1/timetable-generations/${id}/cancel`, json('POST'));
export const readVariant = (
  id: string,
  variantNo: number,
): Promise<{ slots: PeriodSlot[]; lessons: TimetableLesson[] }> =>
  requestJson(`/api/v1/timetable-generations/${id}/variants/${variantNo}`);
export const applyVariant = (
  id: string,
  variantNo: number,
  input: { name: string; effective_from: string },
): Promise<TimetableVersion> =>
  requestJson(`/api/v1/timetable-generations/${id}/variants/${variantNo}/apply`, json('POST', input));

export const checkClassLessons = (
  versionId: string,
  classId: string,
  lessons: Array<{ weekday: number; period_no: number; subject_id: string; room_id: string | null; group_no: number }>,
): Promise<TimetableConflict[]> =>
  requestJson(`/api/v1/timetable-versions/${versionId}/classes/${classId}/check`, json('POST', { lessons }));

export const listChanges = (from: string, to: string): Promise<TimetableChange[]> =>
  requestJson(`/api/v1/timetable-changes?from=${from}&to=${to}`);
export const readDay = (date: string, classId: string): Promise<EffectiveLesson[]> =>
  requestJson(`/api/v1/timetable-changes/day?date=${date}&class_id=${classId}`);
export const listSubstituteTeachers = (): Promise<Array<{ teacher_user_id: string; teacher_name: string }>> =>
  requestJson('/api/v1/timetable-changes/teachers');
export const createChange = (input: Record<string, unknown>) =>
  requestJson('/api/v1/timetable-changes', json('POST', input));
export const deleteChange = (id: string): Promise<void> =>
  requestJson(`/api/v1/timetable-changes/${id}`, json('DELETE'));

export const readTeachingReport = (from: string, to: string): Promise<TeachingReport> =>
  requestJson(`/api/v1/timetable-reports/teaching?from=${from}&to=${to}`);
export const readRoomReport = (date: string): Promise<RoomReport> =>
  requestJson(`/api/v1/timetable-reports/rooms?date=${date}`);

export const listLookupCodes = (): Promise<LookupCode[]> => requestJson('/api/v1/timetable-lookup-codes');
export const createLookupCode = (kind: 'class' | 'teacher', targetId: string): Promise<LookupCode> =>
  requestJson('/api/v1/timetable-lookup-codes', json('POST', { kind, target_id: targetId }));
export const revokeLookupCode = (id: string): Promise<void> =>
  requestJson(`/api/v1/timetable-lookup-codes/${id}`, json('DELETE'));
export const readPublicLookup = (code: string): Promise<PublicLookup> =>
  requestJson(`/api/v1/public/timetable-lookup/${encodeURIComponent(code)}`);

// Địa chỉ trang tra cứu ghép từ tên miền đang mở của cổng quản trị, không ghi cứng tên miền
export const lookupUrl = (code: string) =>
  `${window.location.origin}/tra-cuu-thoi-khoa-bieu?ma=${encodeURIComponent(code)}`;

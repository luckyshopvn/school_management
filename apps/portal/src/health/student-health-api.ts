import type { PhysicalEducationValue, StudentHealthTermValue } from '@school-management/shared';
import { downloadFile } from '../growth/growth-api.js';
import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối thông tin sức khỏe học sinh theo học kỳ (DT-16 phần 16h; mục 4.6 của hệ thống Sở)
export interface StudentHealthRow {
  child_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  record_id: string | null;
  measured_on: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  growth_round_id: string | null;
  physical_education: PhysicalEducationValue | null;
  can_swim: boolean | null;
  eye_conditions: string[];
  note: string | null;
  latest_growth: { round_name: string; measured_on: string; weight_kg: number | null; height_cm: number | null } | null;
}

export interface StudentHealthGrid {
  class: { id: string; name: string; org_unit_id: string };
  term: StudentHealthTermValue;
  term_range: { start_date: string; end_date: string } | null;
  can_edit: boolean;
  rows: StudentHealthRow[];
}

export interface StudentHealthSave {
  child_id: string;
  weight_kg: string | null;
  height_cm: string | null;
  measured_on: string | null;
  physical_education: PhysicalEducationValue | null;
  can_swim: boolean | null;
  eye_conditions: string[];
  note: string | null;
}

export const readStudentHealth = (classId: string, term: StudentHealthTermValue): Promise<StudentHealthGrid> =>
  requestJson(`/api/v1/student-health?class_id=${classId}&term=${term}`);

export const saveStudentHealth = (classId: string, term: StudentHealthTermValue, rows: StudentHealthSave[]) =>
  requestJson<{ saved_count: number; removed_count: number }>('/api/v1/student-health', {
    method: 'PUT',
    body: JSON.stringify({ class_id: classId, term, rows }),
  });

export const pullGrowth = (classId: string, term: StudentHealthTermValue) =>
  requestJson<{ updated_count: number; missing_count: number }>('/api/v1/student-health/pull-growth', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, term }),
  });

export const exportStudentHealth = (classId: string, term: StudentHealthTermValue) =>
  downloadFile(`/api/v1/student-health/export?class_id=${classId}&term=${term}`, 'suc-khoe-hoc-sinh.xlsx');

import type { StudentHealthTermValue } from '@school-management/shared';
import { downloadFile } from '../growth/growth-api.js';
import { requestJson } from '../session/api-client.js';
import type { Breakdown } from './statistics-api.js';

// Gọi điểm cuối 5.3 Thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h)
export interface CountWithFemale {
  count: number;
  female: number;
}

export interface TermHealthCounts {
  recorded: CountWithFemale;
  swimming: CountWithFemale;
  not_swimming: CountWithFemale;
  eye_any: CountWithFemale;
  eye_conditions: Array<{ value: string; label: string } & CountWithFemale>;
  physical_education_passed: CountWithFemale;
  physical_education_not_passed: CountWithFemale;
}

export interface AgeRow {
  total: number;
  female: number;
  ages: Record<string, number>;
}

export interface CompletionCategory {
  key: string;
  label: string;
  count: number;
  completed: number;
  not_completed: number;
  percent: number;
}

export interface EthnicStudent {
  id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  org_unit_name: string;
  class_name: string | null;
  ethnicity: string | null;
}

export interface StudentStatistics {
  on_date: string;
  term: StudentHealthTermValue;
  term_range: { start_date: string; end_date: string } | null;
  totals: { children_count: number; female_count: number };
  age_groups: Array<{ key: string; label: string }>;
  by_age: Array<{ key: string; label: string; count: number; female: number; percent: number }>;
  by_class: Array<AgeRow & { class_id: string | null; class_name: string; org_unit_name: string }>;
  by_ethnicity: Breakdown[];
  completion: { class_count: number; categories: CompletionCategory[] };
  policy_by_age: Array<AgeRow & { value: string }>;
  term_health: {
    recorded: number;
    totals: TermHealthCounts;
    by_age: Array<TermHealthCounts & { key: string; label: string; total: number }>;
  };
  ethnic: {
    count: number;
    female: number;
    by_ethnicity: Array<AgeRow & { value: string }>;
    students: EthnicStudent[];
  };
}

const query = (orgUnitId: string, term: string, extra: Record<string, string> = {}) =>
  new URLSearchParams(
    Object.entries({ org_unit_id: orgUnitId, term, ...extra }).filter(([, value]) => value !== ''),
  ).toString();

// Cấp học trống là mọi cấp (DT-19 phần 19d, YCTD-154)
export const readStudentStatistics = (orgUnitId: string, term: string, schoolLevel = ''): Promise<StudentStatistics> =>
  requestJson(`/api/v1/statistics/students?${query(orgUnitId, term, { school_level: schoolLevel })}`);

export const exportStudentStatistics = (orgUnitId: string, term: string, format: 'xlsx' | 'pdf', schoolLevel = '') =>
  downloadFile(
    `/api/v1/statistics/students/export?${query(orgUnitId, term, { format, school_level: schoolLevel })}`,
    `thong-ke-hoc-sinh.${format}`,
  );

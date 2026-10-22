import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối thống kê theo tiêu chí ngành và hồ sơ chưa nhập đủ (DT-14 phần 14a, YCTD-102; mục 5.1, 5.2, 5.3, 5.8,
// 5.9 của hệ thống Sở)
export interface Breakdown {
  value: string;
  count: number;
  female: number;
  percent: number;
}

export interface ClassStatistics {
  groups: Array<{
    key: string;
    label: string;
    stage: 'nursery' | 'kindergarten';
    class_count: number;
    class_percent: number;
    children_count: number;
    female_count: number;
    children_percent: number;
  }>;
  // Lớp ngoài cấp Mầm non thống kê theo khối (DT-19 phần 19d, YCTD-154)
  grade_groups?: Array<{
    grade_level: string;
    label: string;
    school_level: string;
    class_count: number;
    class_percent: number;
    children_count: number;
    female_count: number;
    children_percent: number;
  }>;
  totals: { class_count: number; children_count: number; female_count: number };
}

export interface ChildStatistics {
  on_date: string;
  totals: { children_count: number; female_count: number };
  by_age: Array<{ key: string; label: string; count: number; female: number; percent: number }>;
  by_ethnicity: Breakdown[];
  disability: { count: number; by_type: Breakdown[] };
  policy: { count: number; by_type: Breakdown[] };
  swimming: { count: number; female: number; percent: number };
  eye_disease: { count: number; by_type: Breakdown[] };
}

export interface StaffStatistics {
  totals: { staff_count: number; female_count: number };
  by_qualification: Breakdown[];
  by_job_position: Breakdown[];
  by_contract_form: Breakdown[];
  by_position_group: Breakdown[];
}

export interface MissingFields<Record> {
  total: number;
  fields: Array<{ key: string; label: string; missing_count: number }>;
  field: string | null;
  records: Record[];
}

export interface MissingChild {
  id: string;
  full_name: string;
  dob: string;
  org_unit_name: string;
  class_name: string | null;
}

export interface MissingStaff {
  id: string;
  code: string;
  full_name: string;
  org_unit_name: string;
  job_title_name: string | null;
}

const withUnit = (path: string, orgUnitId: string, extra: Record<string, string> = {}) => {
  const query = new URLSearchParams(
    Object.entries({ org_unit_id: orgUnitId, ...extra }).filter(([, value]) => value !== ''),
  ).toString();
  return query ? `${path}?${query}` : path;
};

export const readClassStatistics = (orgUnitId: string, schoolLevel = ''): Promise<ClassStatistics> =>
  requestJson(withUnit('/api/v1/statistics/classes', orgUnitId, { school_level: schoolLevel }));

export const readChildStatistics = (orgUnitId: string): Promise<ChildStatistics> =>
  requestJson(withUnit('/api/v1/statistics/children', orgUnitId));

export const readStaffStatistics = (orgUnitId: string): Promise<StaffStatistics> =>
  requestJson(withUnit('/api/v1/statistics/staff', orgUnitId));

export const readMissingChildFields = (orgUnitId: string, field: string): Promise<MissingFields<MissingChild>> =>
  requestJson(withUnit('/api/v1/statistics/missing-child-fields', orgUnitId, { field }));

export const readMissingStaffFields = (orgUnitId: string, field: string): Promise<MissingFields<MissingStaff>> =>
  requestJson(withUnit('/api/v1/statistics/missing-staff-fields', orgUnitId, { field }));

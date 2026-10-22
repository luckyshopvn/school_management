import type { AttendanceStage } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng và suất ăn theo lớp của bếp (YCTD-100)
export type AttendancePeriod = 'day' | 'week' | 'month';

export interface ReportDay {
  date: string;
  weekday: string;
  code: 'NH' | 'HB' | 'T7' | 'CN' | 'NL' | 'NB' | 'NK';
  counted: 0 | 1;
  holiday_name: string | null;
  passed: boolean;
}

export interface DayCounts {
  date: string;
  enrolled: number;
  expected: number;
  present: number;
  absent: number;
  absent_p: number;
  absent_k: number;
  absent_b: number;
  unmarked: number;
  meal_count: number;
  pending: number;
}

export interface Totals {
  enrolled: number;
  expected: number;
  present: number;
  absent: number;
  absent_p: number;
  absent_k: number;
  absent_b: number;
  unmarked: number;
  meal_count: number;
  rate_percent: number | null;
}

export interface ClassRow extends Totals {
  class_id: string;
  class_name: string;
  org_unit_name: string;
  grade_level: string;
  grade_level_name: string;
  // Nhóm khối: Nhà trẻ, Mẫu giáo của Mầm non; cấp khác theo cấp (DT-19 phần 19d, YCTD-154)
  stage: AttendanceStage;
  days: DayCounts[];
}

export interface GroupRow extends Totals {
  kind: 'grade' | 'stage' | 'school';
  key: string;
  label: string;
  class_ids: string[];
  days: DayCounts[];
}

export interface AttendanceMealsReport {
  period: AttendancePeriod;
  from: string;
  to: string;
  today: string;
  days: ReportDay[];
  meal_day_count: number;
  holiday_count: number;
  classes: ClassRow[];
  groups: GroupRow[];
  totals: GroupRow;
}

export interface ClassMatrix {
  days: ReportDay[];
  children: Array<{
    child_id: string;
    full_name: string;
    codes: Record<string, string>;
    present: number;
    absent: number;
    rate_percent: number | null;
  }>;
}

export interface KitchenDay {
  date: string;
  enrolled: number;
  meal_count: number;
  pending: number;
  absent: number;
}

export interface KitchenMealCounts {
  period: AttendancePeriod;
  from: string;
  to: string;
  today: string;
  days: ReportDay[];
  classes: Array<{ class_id: string; class_name: string; grade_level: string; stage: string; days: KitchenDay[] }>;
  groups: Array<{ kind: string; key: string; label: string; days: KitchenDay[] }>;
  totals: { days: KitchenDay[] };
  note: string | null;
}

const query = (values: Record<string, string | null | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`)
    .join('&');

export const readAttendanceMeals = (
  values: Record<string, string | null | undefined>,
): Promise<AttendanceMealsReport> => requestJson(`/api/v1/reports/attendance-meals?${query(values)}`);

export const readClassMatrix = (values: Record<string, string | null | undefined>): Promise<ClassMatrix> =>
  requestJson(`/api/v1/reports/attendance-meals/children?${query(values)}`);

export const readKitchenMealCounts = (values: Record<string, string | null | undefined>): Promise<KitchenMealCounts> =>
  requestJson(`/api/v1/kitchen/meal-counts?${query(values)}`);

// Mã loại ngày hiển thị ở đầu cột (mẫu điểm danh của nhà trường)
export const DAY_CODE_LABELS: Record<ReportDay['code'], string> = {
  NH: 'Ngày học',
  HB: 'Ngày học bù',
  T7: 'Thứ Bảy',
  CN: 'Chủ Nhật',
  NL: 'Ngày lễ, Tết',
  NB: 'Ngày nghỉ bù',
  NK: 'Ngày nghỉ khác',
};

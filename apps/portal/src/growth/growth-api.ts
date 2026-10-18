import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối cân nặng, chiều cao theo đợt cân đo và tổng hợp (DT-14 phần 14a, YCTD-102; mục 4.3.1, 4.3.2 của hệ thống
// Sở). Chỉ số Z và kênh tăng trưởng do máy chủ tính theo chuẩn WHO, giao diện chỉ hiển thị
export type GrowthStatus = 'normal' | 'underweight' | 'above_age' | 'stunted' | 'wasted' | 'overweight' | 'obese';
export type GrowthChannel = GrowthStatus | 'not_measured';

export const GROWTH_STATUS_LABELS: Record<GrowthChannel, string> = {
  normal: 'Bình thường',
  underweight: 'Suy dinh dưỡng thể nhẹ cân',
  above_age: 'Cân nặng cao hơn tuổi',
  stunted: 'Suy dinh dưỡng thể thấp còi',
  wasted: 'Suy dinh dưỡng thể gầy còm',
  overweight: 'Thừa cân',
  obese: 'Béo phì',
  not_measured: 'Chưa cân đo',
};

export const statusLabel = (status: string | null | undefined) =>
  status ? (GROWTH_STATUS_LABELS[status as GrowthChannel] ?? status) : '';

export interface GrowthRound {
  id: string;
  org_unit_id: string;
  name: string;
  measured_on: string;
  note: string | null;
  measurement_count: number;
  can_manage: boolean;
}

export interface GrowthAssessment {
  age_months: number;
  bmi: number | null;
  weight_for_age_z: number | null;
  height_for_age_z: number | null;
  weight_for_height_z: number | null;
  bmi_for_age_z: number | null;
  weight_height_basis: 'weight_for_height' | 'bmi_for_age' | null;
  weight_status: GrowthStatus | null;
  height_status: GrowthStatus | null;
  weight_height_status: GrowthStatus | null;
}

export interface GridRow {
  child_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  weight_kg: number | null;
  height_cm: number | null;
  note: string | null;
  assessment: GrowthAssessment;
}

export interface Grid {
  round: { id: string; name: string; measured_on: string };
  class: { id: string; name: string };
  can_edit: boolean;
  rows: GridRow[];
}

export interface GrowthPoint {
  measured_on: string;
  source: 'growth_round' | 'measurement' | 'health_check';
  weight_kg: number | null;
  height_cm: number | null;
  assessment: GrowthAssessment;
}

export interface CurvePoint {
  month: number;
  minus3: number;
  minus2: number;
  median: number;
  plus2: number;
  plus3: number;
}

export interface ChildGrowth {
  child: { id: string; full_name: string; dob: string; gender: 'male' | 'female' };
  points: GrowthPoint[];
  curves: { weight_for_age: CurvePoint[]; height_for_age: CurvePoint[] };
}

export type SummaryRow = Record<string, string | number | null>;

export interface GrowthComparison {
  first_rounds: Array<{ id: string; name: string; measured_on: string }>;
  last_rounds: Array<{ id: string; name: string; measured_on: string }>;
  classes: Array<{
    class_id: string;
    class_name: string;
    grade_name: string;
    first: Record<string, number>;
    last: Record<string, number>;
    change: Record<string, number>;
  }>;
  totals: { first: Record<string, number>; last: Record<string, number>; change: Record<string, number> };
}

export interface GrowthReport {
  rounds: Array<{ id: string; org_unit_id: string; name: string; measured_on: string }>;
  // Tổng hợp theo học kỳ và so sánh hai lần cân đo (DT-16 phần 16h)
  term: string | null;
  term_range: { start_date: string; end_date: string } | null;
  comparison: GrowthComparison | null;
  classes: SummaryRow[];
  grades: SummaryRow[];
  units: SummaryRow[];
  totals: SummaryRow;
  children: SummaryRow[];
}

export interface ImportResult {
  saved_count: number;
  removed_count: number;
  errors: Array<{ row: number; column: string | null; message: string }>;
}

export const listRounds = (orgUnitId: string): Promise<GrowthRound[]> =>
  requestJson(`/api/v1/growth-rounds?org_unit_id=${orgUnitId}`);

export const createRound = (input: { org_unit_id: string; name: string; measured_on: string }) =>
  requestJson<GrowthRound>('/api/v1/growth-rounds', { method: 'POST', body: JSON.stringify(input) });

export const readGrid = (roundId: string, classId: string): Promise<Grid> =>
  requestJson(`/api/v1/growth-rounds/${roundId}/measurements?class_id=${classId}`);

export const saveMeasurements = (
  roundId: string,
  rows: Array<{ child_id: string; weight_kg: string | null; height_cm: string | null; note: string | null }>,
) =>
  requestJson<{ saved_count: number; removed_count: number }>(`/api/v1/growth-rounds/${roundId}/measurements`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });

export const readChildGrowth = (childId: string): Promise<ChildGrowth> =>
  requestJson(`/api/v1/children/${childId}/growth`);

export function importMeasurements(roundId: string, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.set('file', file);
  return requestJson(`/api/v1/growth-rounds/${roundId}/import`, { method: 'POST', body: form });
}

const query = (filters: Record<string, string | null | undefined>) =>
  new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));

export const readGrowthReport = (filters: Record<string, string | null | undefined>): Promise<GrowthReport> =>
  requestJson(`/api/v1/reports/growth?${query(filters).toString()}`);

// Tải tệp về máy: tệp mẫu nhập số đo của lớp hoặc tệp tổng hợp
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export const downloadTemplate = (roundId: string, classId: string) =>
  downloadFile(`/api/v1/growth-rounds/${roundId}/template?class_id=${classId}`, 'can-do.xlsx');

export const exportGrowthReport = (filters: Record<string, string | null | undefined>) =>
  downloadFile(`/api/v1/reports/growth/export?${query(filters).toString()}`, 'tong-hop-can-do.xlsx');

import type { SchoolLevelCode, SeatAssignment } from '@school-management/shared';
import { downloadFile } from '../growth/growth-api.js';
import { requestJson } from '../session/api-client.js';

// Sơ đồ chỗ ngồi theo lớp (DT-21 phần 21d, YCTD-171)
export interface SeatingChart {
  id: string;
  class_id: string;
  subject_id: string | null;
  subject_name?: string | null;
  effective_from: string;
  desk_columns: number;
  desk_rows: number;
  seats_per_desk: number;
  note: string | null;
  updated_by_name: string | null;
}

export interface SeatingChartDetail extends SeatingChart {
  assignments: Array<SeatAssignment & { full_name: string }>;
}

export interface SeatingList {
  class: { id: string; name: string; school_level: SchoolLevelCode };
  can_manage: boolean;
  current_chart_id: string | null;
  charts: SeatingChart[];
  students: Array<{ id: string; full_name: string }>;
}

export interface SeatingChartInput {
  class_id?: string;
  subject_id?: string | null;
  effective_from: string;
  desk_columns: number;
  desk_rows: number;
  seats_per_desk: number;
  note?: string | null;
  mode?: 'manual' | 'by_name' | 'rotate';
  from_chart_id?: string | null;
  rotate?: 'columns' | 'rows';
  assignments?: SeatAssignment[];
}

export const listSeatingCharts = (classId: string): Promise<SeatingList> =>
  requestJson(`/api/v1/seating-charts?class_id=${classId}`);
export const readSeatingChart = (chartId: string): Promise<SeatingChartDetail> =>
  requestJson(`/api/v1/seating-charts/${chartId}`);
export const createSeatingChart = (input: SeatingChartInput) =>
  requestJson<SeatingChartDetail>('/api/v1/seating-charts', { method: 'POST', body: JSON.stringify(input) });
export const updateSeatingChart = (chartId: string, input: SeatingChartInput) =>
  requestJson<SeatingChartDetail>(`/api/v1/seating-charts/${chartId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const deleteSeatingChart = (chartId: string) =>
  requestJson(`/api/v1/seating-charts/${chartId}`, { method: 'DELETE' });
export const printSeatingChart = (chartId: string, format: 'pdf' | 'xlsx') =>
  downloadFile(`/api/v1/seating-charts/${chartId}/export?format=${format}`, `so-do-cho-ngoi.${format}`);

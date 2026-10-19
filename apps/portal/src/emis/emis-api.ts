import type { EmisColumn, EmisFormCode } from '@school-management/shared';
import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối các biểu báo cáo EMIS (DT-16 phần 16j)
export interface EmisFormRow {
  code: string;
  label: string;
  unit: string;
  values: Record<string, number | null>;
  // Cột TT, dòng tiêu đề nhóm, dòng máy chủ tự tính khi ghi (DT-17 phần 17a)
  order?: string;
  heading?: boolean;
  computed?: boolean;
}

export interface EmisTab {
  key: string;
  label: string;
  columns: EmisColumn[];
  rows: EmisFormRow[];
  editable: boolean;
  can_fill: boolean;
  can_copy_previous_year: boolean;
  saved_at: string | null;
  saved_by_name: string | null;
  locked: boolean;
}

export interface EmisFormView {
  code: EmisFormCode;
  menu: string;
  name: string;
  school_name: string;
  administrative_unit_name: string | null;
  academic_year: string;
  generated_on: string;
  locked: boolean;
  tabs: EmisTab[];
  warnings: string[];
}

const base = (code: EmisFormCode) => `/api/v1/reports/emis/forms/${code}`;

export const readEmisForm = (code: EmisFormCode): Promise<EmisFormView> => requestJson(base(code));

export const saveEmisTab = (
  code: EmisFormCode,
  tab: string,
  rows: Array<{ code: string; values: Record<string, number | null> }>,
): Promise<EmisFormView> =>
  requestJson(`${base(code)}/tabs/${tab}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

export const clearEmisTab = (code: EmisFormCode, tab: string): Promise<EmisFormView> =>
  requestJson(`${base(code)}/tabs/${tab}`, { method: 'DELETE' });

export const fillEmisTab = (
  code: EmisFormCode,
  tab: string,
  source: 'data' | 'previous_year',
): Promise<{ rows: EmisFormRow[]; source_name: string }> =>
  requestJson(`${base(code)}/tabs/${tab}/fill`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source }),
  });

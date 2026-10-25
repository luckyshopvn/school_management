import { ApiError, requestJson } from '../session/api-client.js';
import { downloadFile } from '../growth/growth-api.js';

// Gọi các điểm cuối báo cáo, thống kê, EMIS Tiểu học (DT-20 phần 20f, YCTD-165); biểu EMIS THCS, THPT dùng cùng hàm với gốc
// `secondary-reports` (DT-21 phần 21g, YCTD-175)
export type EmisBase = 'primary-reports' | 'secondary-reports';
export type ReportGroup = 'class' | 'grade' | 'school';
export type RowKind = 'heading' | 'formula' | 'manual';

export interface EmisRow {
  code: string;
  label: string;
  unit: string | null;
  kind: RowKind;
  formula: string | null;
  values: Record<string, number | null>;
}

export interface EmisView {
  code: string;
  name: string;
  note: string | null;
  columns: Array<{ key: string; label: string }>;
  rows: EmisRow[];
  warnings: string[];
  locked: boolean;
  can_edit_values: boolean;
  can_edit_form: boolean;
}

export const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();

export const readReport = <T>(report: string, params: Record<string, string | undefined>) =>
  requestJson<T>(`/api/v1/primary-reports/${report}?${query(params)}`);
export const exportReport = (report: string, params: Record<string, string | undefined>, format: 'xlsx' | 'pdf') =>
  downloadFile(
    `/api/v1/primary-reports/${report}/export?${query({ ...params, format })}`,
    `bao-cao-tieu-hoc-${report}.${format}`,
  );
export const readPeriods = () =>
  requestJson<{ periods: Array<{ id: string; name: string }> }>('/api/v1/assessment/config?school_level=TH');
export const listEmisForms = (base: EmisBase = 'primary-reports') =>
  requestJson<Array<{ code: string; name: string }>>(`/api/v1/${base}/emis`);
export const readEmis = (code: string, base: EmisBase = 'primary-reports') =>
  requestJson<EmisView>(`/api/v1/${base}/emis/${code}`);
export const saveEmisValues = (
  code: string,
  rows: Array<{ code: string; values: Record<string, number | null> }>,
  base: EmisBase = 'primary-reports',
) =>
  requestJson<EmisView>(`/api/v1/${base}/emis/${code}/values`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
export const saveEmisRows = (
  code: string,
  rows: Array<{ code: string; label: string; unit: string | null; kind: RowKind; formula: string | null }>,
  base: EmisBase = 'primary-reports',
) =>
  requestJson<EmisView>(`/api/v1/${base}/emis/${code}/rows`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
export const exportEmis = (code: string, format: 'xlsx' | 'pdf', base: EmisBase = 'primary-reports') =>
  downloadFile(`/api/v1/${base}/emis/${code}/export?format=${format}`, `${code}.${format}`);

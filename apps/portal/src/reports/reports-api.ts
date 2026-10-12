import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối bảng điều khiển và báo cáo cơ bản (P17; YCTD-62)
export interface Dashboard {
  month: string;
  children_count: number;
  classes_count: number;
  staff_count: number;
  tuition: { invoice_count: number; payable_amount: number; paid_amount: number; outstanding_amount: number };
  debt: { outstanding_amount: number; overdue_amount: number };
  attendance: { present_count: number; record_count: number; rate_percent: number | null };
}

export interface Birthday {
  id: string;
  full_name: string;
  dob: string;
  class_name: string;
  turning_age: number;
}

export type ReportRow = Record<string, string | number | null>;

const query = (values: Record<string, string | null | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`)
    .join('&');

export const readDashboard = (
  kind: 'leadership' | 'unit',
  month: string,
  orgUnitId: string | null,
): Promise<Dashboard> => requestJson(`/api/v1/dashboard/${kind}?${query({ month, org_unit_id: orgUnitId })}`);
export const readBirthdays = (month: string): Promise<Birthday[]> =>
  requestJson(`/api/v1/dashboard/birthdays?${query({ month })}`);
export const readReport = (
  path: string,
  values: Record<string, string | null | undefined>,
): Promise<Record<string, unknown>> => requestJson(`/api/v1/reports/${path}?${query(values)}`);

// Báo cáo giai đoạn 2 (P17-10 đến P17-12; YCTD-83)
export interface ReportSection {
  code: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: ReportRow[];
}

export interface OperationsReport {
  from: string;
  to: string;
  sections: ReportSection[];
}

export interface ConsolidatedReport {
  month: string;
  units: ReportRow[];
  totals: ReportRow;
}

export interface ExportLog {
  id: string;
  actor_name: string;
  report_code: string;
  filters_data: Record<string, string>;
  row_count: number;
  contains_personal_data: boolean;
  file_name: string;
  exported_at: string;
}

export const readOperationsReport = (values: Record<string, string | null | undefined>): Promise<OperationsReport> =>
  requestJson(`/api/v1/reports/activities?${query(values)}`);
export const readConsolidatedReport = (month: string, orgUnitIds: string[]): Promise<ConsolidatedReport> =>
  requestJson(`/api/v1/reports/consolidated?${query({ month, org_unit_ids: orgUnitIds.join(',') })}`);
export const readExportLogs = (from: string, to: string): Promise<ExportLog[]> =>
  requestJson(`/api/v1/reports/export-logs?${query({ from, to })}`);

// Xuất báo cáo ra Excel (P17-12, BR-74): máy chủ ghi nhật ký xuất rồi trả tệp, trình duyệt tải về
export async function exportReport(code: string, filters: Record<string, string | null | undefined>): Promise<void> {
  const body = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const response = await fetchWithSession(`/api/v1/reports/${code}/export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `bao-cao-${code}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export const formatNumber = (value: unknown) =>
  typeof value === 'number' ? new Intl.NumberFormat('vi-VN').format(value) : String(value ?? '');

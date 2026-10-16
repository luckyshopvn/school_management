import { downloadPost } from '../children/children-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-118)
export type ArchiveRecordStatus = 'pending' | 'completed';
export type ArchiveRetention = 'permanent' | 'limited';

export const ARCHIVE_STATUS_LABELS: Record<ArchiveRecordStatus, string> = {
  pending: 'Chưa hoàn thành',
  completed: 'Hoàn thành',
};

export const ARCHIVE_RETENTION_LABELS: Record<ArchiveRetention, string> = {
  permanent: 'Vĩnh viễn',
  limited: 'Có thời hạn',
};

export const retentionText = (retention: ArchiveRetention, years: number | null) =>
  retention === 'limited' && years ? `${years} năm` : ARCHIVE_RETENTION_LABELS[retention];

export const periodText = (fromYear: number, toYear: number) =>
  fromYear === toYear ? String(fromYear) : `${fromYear}–${toYear}`;

export interface ArchiveFond {
  id: string;
  code: string;
  name: string;
  note: string | null;
  org_unit_id: string | null;
  org_unit_name: string | null;
  holding_count: number;
  record_count: number;
  updated_at: string;
}

export interface ArchiveFondInput {
  code: string;
  name: string;
  note: string | null;
  // Trống là toàn trường (YCTD-119)
  org_unit_id: string | null;
}

export interface ArchiveHolding {
  id: string;
  fond_id: string;
  fond_code: string;
  fond_name: string;
  org_unit_id: string | null;
  period_from_year: number;
  period_to_year: number;
  arranged: boolean;
  expired: boolean;
  retention: ArchiveRetention;
  retention_years: number | null;
  bundle_count: number;
  box_count: number;
  shelf_meters: number;
  storage_location: string;
  note: string | null;
  updated_at: string;
}

// Ô số giữ nguyên chữ người dùng gõ khi không đọc được để máy chủ báo lỗi ở đúng ô
export type NumberInput = number | string | null;

export interface ArchiveHoldingInput {
  fond_id: string;
  period_from_year: NumberInput;
  period_to_year: NumberInput;
  // Chưa chọn thì gửi null để máy chủ báo lỗi ở ô
  arranged: boolean | null;
  expired: boolean;
  retention: ArchiveRetention;
  retention_years: NumberInput;
  bundle_count: NumberInput;
  box_count: NumberInput;
  shelf_meters: NumberInput;
  storage_location: string;
  note: string | null;
}

export interface ArchiveRecordFile {
  id: string;
  file_name: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface ArchiveRecord {
  id: string;
  code: string;
  title: string;
  fond_id: string | null;
  fond_code: string | null;
  fond_name: string | null;
  org_unit_id: string | null;
  org_unit_name: string | null;
  handler_staff_id: string | null;
  handler_name: string;
  opened_on: string;
  due_date: string | null;
  status: ArchiveRecordStatus;
  completed_on: string | null;
  retention: ArchiveRetention;
  retention_years: number | null;
  sheet_count: number | null;
  note: string | null;
  file_count: number;
  overdue: boolean;
  // Chưa hoàn thành, thời hạn trong 3 ngày tới (YCTD-119)
  due_soon: boolean;
  updated_at: string;
}

export interface ArchiveRecordDetail extends ArchiveRecord {
  files: ArchiveRecordFile[];
}

export interface ArchiveRecordInput {
  code: string;
  title: string;
  fond_id: string | null;
  org_unit_id: string | null;
  handler_staff_id: string | null;
  handler_name: string;
  opened_on: string;
  due_date: string | null;
  status: ArchiveRecordStatus;
  completed_on: string | null;
  retention: ArchiveRetention;
  retention_years: NumberInput;
  sheet_count: NumberInput;
  note: string | null;
}

export interface ArchiveRecordFilter {
  status?: ArchiveRecordStatus;
  search?: string;
  fond_id?: string;
  org_unit_id?: string;
  handler?: string;
  due_from?: string;
  due_to?: string;
  overdue?: boolean;
  due_soon?: boolean;
}

// Nhân sự đang làm việc để chọn người giải quyết (YCTD-119)
export interface ArchiveHandler {
  id: string;
  code: string;
  full_name: string;
  org_unit_id: string;
}

export interface ArchiveRecordPage {
  items: ArchiveRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ArchiveReportFilter {
  fond_id?: string;
  org_unit_id?: string;
  storage_location?: string;
}

export interface ArchiveReportRow {
  fond_id: string;
  fond_code: string;
  fond_name: string;
  period_from_year: number;
  period_to_year: number;
  total_meters: number;
  arranged_meters: number;
  unarranged_meters: number;
  expired_meters: number;
  permanent_meters: number;
  limited_meters: number;
  bundle_count: number;
  box_count: number;
  storage_locations: string;
}

export interface ArchiveReport {
  rows: ArchiveReportRow[];
  totals: Omit<
    ArchiveReportRow,
    'fond_id' | 'fond_code' | 'fond_name' | 'period_from_year' | 'period_to_year' | 'storage_locations'
  >;
}

function filterParameters(filter: object): URLSearchParams {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '' && value !== false) {
      parameters.set(key, String(value));
    }
  }
  return parameters;
}

export const listArchiveFonds = (): Promise<ArchiveFond[]> => requestJson('/api/v1/archive-fonds');
export const createArchiveFond = (input: ArchiveFondInput): Promise<ArchiveFond> =>
  requestJson('/api/v1/archive-fonds', { method: 'POST', body: JSON.stringify(input) });
export const updateArchiveFond = (id: string, input: ArchiveFondInput): Promise<ArchiveFond> =>
  requestJson(`/api/v1/archive-fonds/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteArchiveFond = (id: string): Promise<void> =>
  requestJson(`/api/v1/archive-fonds/${id}`, { method: 'DELETE' });

export const listArchiveHoldings = (fondId: string): Promise<ArchiveHolding[]> =>
  requestJson(`/api/v1/archive-holdings${fondId ? `?fond_id=${fondId}` : ''}`);
export const createArchiveHolding = (input: ArchiveHoldingInput): Promise<ArchiveHolding> =>
  requestJson('/api/v1/archive-holdings', { method: 'POST', body: JSON.stringify(input) });
export const updateArchiveHolding = (id: string, input: ArchiveHoldingInput): Promise<ArchiveHolding> =>
  requestJson(`/api/v1/archive-holdings/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteArchiveHolding = (id: string): Promise<void> =>
  requestJson(`/api/v1/archive-holdings/${id}`, { method: 'DELETE' });

export function searchArchiveRecords(
  filter: ArchiveRecordFilter & { page: number; pageSize: number },
): Promise<ArchiveRecordPage> {
  const { page, pageSize, ...rest } = filter;
  const parameters = filterParameters(rest);
  parameters.set('page', String(page));
  parameters.set('page_size', String(pageSize));
  return requestJson(`/api/v1/archive-records?${parameters.toString()}`);
}
export const listArchiveHandlers = (): Promise<ArchiveHandler[]> => requestJson('/api/v1/archive-handlers');
export const readArchiveRecord = (id: string): Promise<ArchiveRecordDetail> =>
  requestJson(`/api/v1/archive-records/${id}`);
export const createArchiveRecord = (input: ArchiveRecordInput): Promise<ArchiveRecordDetail> =>
  requestJson('/api/v1/archive-records', { method: 'POST', body: JSON.stringify(input) });
export const updateArchiveRecord = (id: string, input: ArchiveRecordInput): Promise<ArchiveRecordDetail> =>
  requestJson(`/api/v1/archive-records/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteArchiveRecord = (id: string): Promise<void> =>
  requestJson(`/api/v1/archive-records/${id}`, { method: 'DELETE' });

// Xuất Excel danh sách hồ sơ theo bộ lọc và các cột đang hiện trên lưới; máy chủ ghi nhật ký xuất
export const exportArchiveRecords = (filter: ArchiveRecordFilter, columns: string[]) =>
  downloadPost('/api/v1/archive-records/export', { ...filter, columns }, 'ho-so-tai-lieu.xlsx');

export function uploadArchiveFile(recordId: string, file: File): Promise<ArchiveRecordFile> {
  const form = new FormData();
  form.set('file', file, file.name);
  return requestJson(`/api/v1/archive-records/${recordId}/files`, { method: 'POST', body: form });
}

export const deleteArchiveFile = (recordId: string, fileId: string): Promise<void> =>
  requestJson(`/api/v1/archive-records/${recordId}/files/${fileId}`, { method: 'DELETE' });

// Tải tệp đính kèm bằng mã phiên nên không dùng liên kết trực tiếp
export async function downloadArchiveFile(recordId: string, file: ArchiveRecordFile): Promise<void> {
  const response = await fetchWithSession(`/api/v1/archive-records/${recordId}/files/${file.id}`);
  if (!response.ok) {
    throw await readError(response);
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = file.file_name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function readArchiveReport(filter: ArchiveReportFilter): Promise<ArchiveReport> {
  const parameters = filterParameters(filter);
  return requestJson(`/api/v1/archive-report${parameters.size ? `?${parameters.toString()}` : ''}`);
}

export const exportArchiveReport = (filter: ArchiveReportFilter) =>
  downloadPost('/api/v1/archive-report/export', filter, 'bao-cao-luu-tru.xlsx');

import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Xuất tệp dùng chung của cổng quản trị (DT-16 phần 16a): tải tệp máy chủ trả về; danh sách lớn thì máy chủ trả 202 kèm tác
// vụ xuất nền, hàm trả lời nhắn để màn hình báo người dùng xem ở "Tệp đã tạo"
export type ExportFormat = 'xlsx' | 'pdf';
export const BACKGROUND_EXPORT_NOTICE =
  'Danh sách lớn nên hệ thống đang tạo tệp ở chế độ nền; xem trạng thái và tải về ở "Quản trị hệ thống › 3.5. Tệp đã tạo".';

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'expired';

export interface ExportJob {
  id: string;
  report_code: string;
  title: string;
  // Gói toàn bộ dữ liệu của trường là ZIP (DT-18 phần 18h)
  format: ExportFormat | 'zip';
  status: ExportJobStatus;
  row_count: number | null;
  file_name: string | null;
  size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
}

export function saveResponseFile(blob: Blob, disposition: string, fallbackName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

// Gửi yêu cầu xuất rồi tải tệp; trả lời nhắn khi máy chủ tạo tác vụ xuất nền
export async function downloadExport(path: string, body: unknown, fallbackName: string): Promise<string | undefined> {
  const response = await fetchWithSession(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 202) {
    return BACKGROUND_EXPORT_NOTICE;
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
  return undefined;
}

export async function listExportJobs(): Promise<ExportJob[]> {
  return (await requestJson<{ items: ExportJob[] }>('/api/v1/export-jobs')).items;
}

export async function downloadExportJob(job: ExportJob): Promise<void> {
  const response = await fetchWithSession(`/api/v1/export-jobs/${job.id}/file`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', job.file_name ?? 'tep');
}

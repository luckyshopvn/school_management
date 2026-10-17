import { saveResponseFile } from '../exports/export-api.js';
import { ApiError, fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối công cụ nhập Excel dùng chung (DT-16 phần 16a): cột của mẫu để chọn cột nhập, tra cứu danh mục, tải
// file mẫu (kèm dữ liệu), xuất file lỗi
export interface ImportColumnInfo {
  key: string;
  header: string;
  note: string;
  // Cột khóa hoặc bắt buộc, luôn nhập
  locked: boolean;
}

export interface ImportColumnsResponse {
  columns: ImportColumnInfo[];
  updates_existing: boolean;
  template_with_data: boolean;
}

export interface ImportCatalog {
  key: string;
  title: string;
  column: string;
  items: Array<{ code: string; name: string; note?: string }>;
}

export interface RowMessage {
  row: number;
  column: string | null;
  message: string;
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return [error.message, ...error.details.map((detail) => detail.message)].join('. ');
  }
  return 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', fallbackName);
}

export const readImportColumns = (type: string): Promise<ImportColumnsResponse> =>
  requestJson(`/api/v1/imports/templates/${type}/columns`);

export async function readImportCatalogs(type: string): Promise<ImportCatalog[]> {
  return (await requestJson<{ items: ImportCatalog[] }>(`/api/v1/imports/catalogs/${type}`)).items;
}

export const downloadImportTemplate = (type: string, withData: boolean) =>
  download(
    `/api/v1/imports/templates/${type}${withData ? '?with_data=true' : ''}`,
    `mau-nhap-${type}${withData ? '-kem-du-lieu' : ''}.xlsx`,
  );

export const downloadImportErrorFile = (jobId: string) =>
  download(`/api/v1/imports/${jobId}/error-file`, 'tep-loi.xlsx');

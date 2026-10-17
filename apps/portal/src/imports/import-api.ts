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

// Đường dẫn gốc của công cụ nhập chung; phân hệ có lần nhập riêng (thực đơn bữa ăn, DT-16 phần 16h) dùng đường dẫn gốc của
// mình với cùng dạng điểm cuối. `search` là tham số thêm (ví dụ đơn vị) gửi kèm khi tra danh mục, tải file mẫu
export const IMPORTS_API_BASE = '/api/v1/imports';
const withSearch = (path: string, search: Record<string, string>) => {
  const query = new URLSearchParams(Object.entries(search).filter(([, value]) => value !== '')).toString();
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
};

export const readImportColumns = (type: string, base = IMPORTS_API_BASE): Promise<ImportColumnsResponse> =>
  requestJson(`${base}/templates/${type}/columns`);

export async function readImportCatalogs(
  type: string,
  base = IMPORTS_API_BASE,
  search: Record<string, string> = {},
): Promise<ImportCatalog[]> {
  return (await requestJson<{ items: ImportCatalog[] }>(withSearch(`${base}/catalogs/${type}`, search))).items;
}

export const downloadImportTemplate = (
  type: string,
  withData: boolean,
  base = IMPORTS_API_BASE,
  search: Record<string, string> = {},
) =>
  download(
    withSearch(`${base}/templates/${type}${withData ? '?with_data=true' : ''}`, search),
    `mau-nhap-${type}${withData ? '-kem-du-lieu' : ''}.xlsx`,
  );

export const downloadImportErrorFile = (jobId: string, base = IMPORTS_API_BASE) =>
  download(`${base}/${jobId}/error-file`, 'tep-loi.xlsx');

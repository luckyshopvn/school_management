import {
  PlatformValidationError,
  type FieldProblem,
  type SupportAccessPolicy,
  type SupportStartReply,
} from './platform-api.js';

// Danh mục đơn vị toàn quốc, trang đăng nhập ở tên miền chung, chính sách vào trường của quản trị nền tảng (DT-24, YCTD-220)
export interface CatalogImportTotals {
  rows_read: number;
  departments_inserted: number;
  departments_updated: number;
  communes_inserted: number;
  communes_updated: number;
  units_inserted: number;
  units_updated: number;
  units_unchanged: number;
  units_skipped: number;
  units_flagged: number;
  units_missing: number;
  units_deactivated: number;
}

export interface CatalogImportReport {
  run_id: string | null;
  dry_run: boolean;
  totals: CatalogImportTotals;
  flags: Record<string, number>;
  skipped: Array<{ line: number; reason: string; code?: string }>;
}

export interface CatalogOverview {
  departments: number;
  communes: number;
  units: number;
  by_level: Record<string, number>;
  flags: Record<string, number>;
  linked_schools: number;
  runs: Array<{
    id: string;
    source: string;
    file_name: string | null;
    dry_run: boolean;
    totals: Record<string, number>;
    actor_name: string;
    started_at: string;
  }>;
  levels: Array<{ code: string; name: string }>;
  flag_labels: Record<string, string>;
  department_list: Array<{ code: string; name: string }>;
}

export interface CatalogUnitRow {
  moet_code: string;
  name: string;
  commune_code: string | null;
  commune_name: string | null;
  levels: string[];
  status: string;
  quality_flags: string[];
  school_code: string | null;
}

// Vào trường từ danh mục (YCTD-314): trạng thái trường của đơn vị và phiên quản trị nền tảng khi trường đã sẵn sàng
export interface CatalogOpenReply {
  state: 'not_provisioned' | 'provisioning' | 'ready' | 'unavailable';
  school_code: string | null;
  session: SupportStartReply | null;
}

export interface LoginPageSettings {
  title: string;
  subtitle: string;
  support_lines: string[];
}

async function send<T>(
  token: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  contentType = 'application/json',
): Promise<T> {
  const response = await fetch(`/api/v1/auth/platform${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': contentType }),
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  if (!response.ok) {
    let message = 'Không thực hiện được, vui lòng thử lại';
    let problems: FieldProblem[] = [];
    try {
      const parsed = (await response.json()) as { error?: { message?: string; details?: FieldProblem[] } };
      message = parsed.error?.message ?? message;
      problems = parsed.error?.details ?? [];
    } catch {
      // Phản hồi không phải JSON: giữ thông điệp mặc định
    }
    throw new PlatformValidationError(response.status, message, problems);
  }
  return (await response.json()) as T;
}

function query(values: Record<string, string | number | boolean | null | undefined>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      parameters.set(key, String(value));
    }
  }
  return parameters.toString();
}

export const catalogApi = {
  overview: (token: string) => send<CatalogOverview>(token, 'GET', '/catalog'),
  // Tính năng trả phí bật riêng cho một trường (YCTD-314)
  setAddonModules: (token: string, code: string, modules: string[]) =>
    send<{ addon_modules: string[] }>(token, 'PUT', `/schools/${encodeURIComponent(code)}/addon-modules`, { modules }),
  open: (token: string, moetCode: string) =>
    send<CatalogOpenReply>(token, 'POST', `/catalog/units/${encodeURIComponent(moetCode)}/open`, {}),
  units: (
    token: string,
    filter: {
      department: string;
      q?: string;
      level?: string;
      flag?: string;
      offset?: number;
      include_inactive?: boolean;
    },
  ) =>
    send<{ items: CatalogUnitRow[]; has_more: boolean }>(
      token,
      'GET',
      `/catalog/units?${query({ ...filter, limit: 50 })}`,
    ),
  // Gửi nguyên văn bản tệp CSV (UTF-8); chạy thử chỉ tính báo cáo
  importCsv: (
    token: string,
    text: string,
    options: { kind: 'units' | 'communes'; file_name: string; dry_run: boolean; deactivate_missing: boolean },
  ) => send<CatalogImportReport>(token, 'POST', `/catalog/import?${query(options)}`, text, 'text/csv'),
  linkSchool: (token: string, code: string, moetCode: string | null) =>
    send<{ code: string; moet_code: string | null }>(
      token,
      'PUT',
      `/schools/${encodeURIComponent(code)}/catalog-unit`,
      {
        moet_code: moetCode,
      },
    ),
  loginPage: (token: string) => send<LoginPageSettings>(token, 'GET', '/login-page'),
  saveLoginPage: (token: string, input: LoginPageSettings) =>
    send<LoginPageSettings>(token, 'PUT', '/login-page', input),
  policy: (token: string) => send<SupportAccessPolicy>(token, 'GET', '/support-policy'),
  savePolicy: (token: string, input: SupportAccessPolicy & { otp_code: string }) =>
    send<SupportAccessPolicy>(token, 'PUT', '/support-policy', input),
};

import { PlatformValidationError, type FieldProblem } from './platform-api.js';

// Đơn vị cấp trên (DT-SaaS phần S6, YCTD-202): quản lý cây đơn vị, tài khoản cấp trên ở cổng nền tảng (dịch vụ định danh) và trang
// của tài khoản cấp trên: đăng nhập, phạm vi (dịch vụ định danh), số liệu tổng hợp, xuất tệp (máy chủ API `/api/v1/parent-org`)
async function send<T>(accessToken: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

export type AdminUnitLevel = 'ministry' | 'department' | 'commune';
export type AggregateCategory = 'scale' | 'attendance' | 'learning' | 'facilities' | 'staff' | 'emis';

export const LEVEL_LABELS: Record<AdminUnitLevel, string> = {
  ministry: 'Bộ',
  department: 'Sở',
  commune: 'Phòng Văn hóa – Xã hội',
};

export interface AdminUnit {
  id: string;
  level: AdminUnitLevel;
  code: string;
  name: string;
  parent_id: string | null;
  status: 'active' | 'inactive' | 'merged';
  merged_into_id: string | null;
  school_count: number;
  user_count: number;
}

export interface AdminUnitsOverview {
  units: AdminUnit[];
  schools: Array<{ id: string; code: string; name: string; status: string; admin_unit_id: string | null }>;
  users: Array<{
    id: string;
    login: string;
    full_name: string;
    admin_unit_id: string;
    status: string;
    last_login_at: string | null;
  }>;
}

export interface TotpEnrollment {
  secret: string;
  otpauth_uri: string;
  recovery_codes: string[];
}

const platform = (token: string, method: string, path: string, body?: unknown) =>
  send<unknown>(token, method, `/api/v1/auth/platform${path}`, body);

export const adminUnitsApi = {
  overview: (token: string) => send<AdminUnitsOverview>(token, 'GET', '/api/v1/auth/platform/admin-units'),
  create: (token: string, input: { level: AdminUnitLevel; code: string; name: string; parent_id: string | null }) =>
    platform(token, 'POST', '/admin-units', input),
  importDefault: (token: string) =>
    send<{ created: number; skipped: number }>(token, 'POST', '/api/v1/auth/platform/admin-units/import', {
      preset: 'default',
    }),
  update: (token: string, id: string, input: { name?: string; status?: string }) =>
    platform(token, 'PUT', `/admin-units/${id}`, input),
  merge: (token: string, id: string, intoId: string) =>
    platform(token, 'POST', `/admin-units/${id}/merge`, { into_id: intoId }),
  assignSchool: (token: string, code: string, unitId: string | null) =>
    platform(token, 'PUT', `/schools/${encodeURIComponent(code)}/admin-unit`, { admin_unit_id: unitId }),
  createUser: (token: string, input: { login: string; full_name: string; password: string; admin_unit_id: string }) =>
    send<{ user: { id: string; login: string }; totp: TotpEnrollment }>(
      token,
      'POST',
      '/api/v1/auth/platform/parent-org-users',
      input,
    ),
  resetTotp: (token: string, id: string) =>
    send<TotpEnrollment>(token, 'POST', `/api/v1/auth/platform/parent-org-users/${id}/totp`, {}),
  setStatus: (token: string, id: string, status: 'active' | 'locked') =>
    platform(token, 'POST', `/parent-org-users/${id}/status`, { status }),
};

export interface ParentOrgProfile {
  id: string;
  login: string;
  full_name: string;
  unit: { id: string; code: string; name: string; level: AdminUnitLevel };
  level_label: string;
  units: Array<{ id: string; code: string; name: string; level: AdminUnitLevel; parent_id: string | null }>;
  schools: Array<{ id: string; code: string; name: string; admin_unit_id: string }>;
  categories: Array<{ key: AggregateCategory; label: string }>;
}

export interface AggregateView {
  unit: { id: string; code: string; name: string; level: AdminUnitLevel };
  category: AggregateCategory;
  min_group: number;
  schools_count: number;
  total: Record<string, unknown> | null;
  total_hidden_reason: string | null;
  hidden_cells: string[];
  children: Array<{
    id: string;
    code: string;
    name: string;
    level: AdminUnitLevel;
    schools_count: number;
    total: Record<string, unknown> | null;
  }>;
  schools: Array<{
    id: string;
    code: string;
    name: string;
    unit_id: string;
    captured_at: string | null;
    metrics: Record<string, unknown> | null;
  }>;
}

export interface AccessRequest {
  id: string;
  school_code: string;
  school_name: string;
  categories: AggregateCategory[];
  reason: string;
  hours: number;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  decided_by_name: string | null;
  expires_at: string | null;
  created_at: string;
}

export const parentOrgApi = {
  login: (login: string, password: string, otpCode: string) =>
    send<{ access_token: string; user: ParentOrgProfile }>(null, 'POST', '/api/v1/auth/parent-org/login', {
      login,
      password,
      otp_code: otpCode,
    }),
  me: (token: string) => send<ParentOrgProfile>(token, 'GET', '/api/v1/auth/parent-org/me'),
  aggregate: (token: string, unitId: string, category: AggregateCategory) =>
    send<AggregateView>(
      token,
      'GET',
      `/api/v1/parent-org/aggregate?unit=${encodeURIComponent(unitId)}&category=${category}`,
    ),
  requests: (token: string) =>
    send<{ items: AccessRequest[] }>(token, 'GET', '/api/v1/auth/parent-org/access-requests'),
  createRequest: (
    token: string,
    input: { school_code: string; categories: AggregateCategory[]; reason: string; hours: number },
  ) => send<{ id: string }>(token, 'POST', '/api/v1/auth/parent-org/access-requests', input),
  openRequest: (token: string, id: string) =>
    send<{ handoff: { path: string; host: string | null; expires_in_seconds: number } }>(
      token,
      'POST',
      `/api/v1/auth/parent-org/access-requests/${id}/open`,
      {},
    ),
  async download(token: string, unitId: string, category: AggregateCategory, format: 'xlsx' | 'pdf'): Promise<void> {
    const response = await fetch(
      `/api/v1/parent-org/aggregate/export?unit=${encodeURIComponent(unitId)}&category=${category}&format=${format}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new PlatformValidationError(response.status, 'Không xuất được tệp', []);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `tong-hop-${category}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

// Gọi dịch vụ định danh cho tài khoản vận hành nền tảng; cùng tên miền của cổng nền tảng nên không cần CORS
export interface Operator {
  id: string;
  login: string;
  full_name: string;
  // Vai trò nhân viên vận hành (YCTD-311)
  role: 'quan_tri' | 'ho_tro' | 'ky_thuat' | 'ke_toan';
  // Còn mật khẩu tạm do quản trị cấp: cổng chỉ hiện màn đổi mật khẩu (YCTD-323)
  must_change_password: boolean;
}

export interface OperatorProfile extends Operator {
  school_count: number;
}

export class PlatformApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // Trường máy chủ báo lỗi (details[].field), ví dụ otp_code khi cần mã xác thực hai lớp
    readonly fields: string[] = [],
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<PlatformApiError> {
  let message = 'Không thực hiện được, vui lòng thử lại';
  let fields: string[] = [];
  try {
    const body = (await response.json()) as {
      error?: { message?: string; details?: Array<{ field?: string }> };
    };
    message = body.error?.message ?? message;
    fields = (body.error?.details ?? []).flatMap((detail) => (detail.field ? [detail.field] : []));
  } catch {
    // Phản hồi không phải JSON: giữ thông điệp mặc định
  }
  return new PlatformApiError(response.status, message, fields);
}

// Xác thực hai lớp bắt buộc (DT-SaaS phần S8b): mã TOTP 6 số hoặc mã khôi phục gửi kèm
export async function loginOperator(
  login: string,
  password: string,
  otpCode: string,
  // Mã xác nhận (YCTD-313): bước 1 gửi mã ảnh và chữ đã nhập; bước mã hai lớp chỉ gửi lại mã ảnh của bước 1
  captcha: { captcha_id: string; captcha_text?: string } | null = null,
): Promise<{ accessToken: string; operator: Operator }> {
  const response = await fetch('/api/v1/auth/platform/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login, password, otp_code: otpCode, ...captcha }),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const body = (await response.json()) as { access_token: string; operator: Operator };
  return { accessToken: body.access_token, operator: body.operator };
}

export interface CaptchaChallenge {
  captcha_id: string;
  image: string;
  expires_in_seconds: number;
}

// Ảnh mã xác nhận mới cho trang đăng nhập (YCTD-313); nút làm mới gọi lại
export async function issueCaptcha(): Promise<CaptchaChallenge> {
  const response = await fetch('/api/v1/auth/platform/captcha', { method: 'POST' });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as CaptchaChallenge;
}

export async function fetchProfile(accessToken: string): Promise<OperatorProfile> {
  const response = await fetch('/api/v1/auth/platform/me', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as OperatorProfile;
}

// Nhân viên vận hành tự đổi mật khẩu (YCTD-323): mật khẩu hiện tại, mã hai lớp, mật khẩu mới từ 12 ký tự
export async function changeOperatorPassword(
  accessToken: string,
  input: { current_password: string; new_password: string; otp_code: string },
): Promise<void> {
  const response = await fetch('/api/v1/auth/platform/password', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    // Báo đủ lý do từng ô (mật khẩu hiện tại sai, mật khẩu mới ngắn, thiếu mã) để người dùng sửa đúng chỗ
    let message = 'Không đổi được mật khẩu, vui lòng thử lại';
    let fields: string[] = [];
    try {
      const body = (await response.json()) as {
        error?: { message?: string; details?: Array<{ field?: string; message?: string }> };
      };
      const details = body.error?.details ?? [];
      message =
        details.length > 0 ? details.map((detail) => detail.message).join('. ') : (body.error?.message ?? message);
      fields = details.flatMap((detail) => (detail.field ? [detail.field] : []));
    } catch {
      // Phản hồi không phải JSON: giữ thông điệp mặc định
    }
    throw new PlatformApiError(response.status, message, fields);
  }
}

// Quản lý trường (DT-SaaS phần S2, YCTD-193)
export interface FieldProblem {
  field: string;
  message: string;
}

export class PlatformValidationError extends PlatformApiError {
  constructor(
    status: number,
    message: string,
    readonly problems: FieldProblem[],
  ) {
    super(status, message);
  }
}

async function request<T>(accessToken: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/auth/platform/schools${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
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

export interface SchoolSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  data_class: string;
  legacy: boolean;
  created_at: string;
  delete_after: string | null;
  domains: Array<{ host: string; status: string }>;
}

export interface SchoolDetail {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
  data_class: string;
  legacy: boolean;
  school_levels: string[];
  first_academic_year: string | null;
  // Mã Bộ của đơn vị trong danh mục toàn quốc (DT-24)
  moet_code?: string | null;
  // Gói hiện hành, tính năng trả phí bật riêng cho trường (YCTD-314)
  plan?: { code: string; name: string; modules: string[] | null } | null;
  addon_modules?: string[];
  paid_modules?: Array<{ key: string; label: string }>;
  suspended_at: string | null;
  deletion_requested_at: string | null;
  delete_after: string | null;
  deleted_at: string | null;
  domains: Array<{
    host: string;
    kind: string;
    status: string;
    provider: string;
    verification_token: string | null;
    cname_target: string | null;
    last_checked_at: string | null;
    check_error: string | null;
  }>;
  consents: Array<{
    id: string;
    kind: string;
    template_code: string;
    template_version?: string;
    signer_name: string;
    signer_title?: string;
    signed_on?: string;
    valid_from: string;
    valid_until: string | null;
    withdrawn_on?: string | null;
    data_scope?: string;
    file_sha256?: string;
    recorded_by_name?: string | null;
  }>;
  hosting: Array<{
    id: string;
    provider: string;
    service: string;
    region: string;
    role: string;
    stores_personal_data?: boolean;
    started_on?: string;
    ended_on?: string | null;
  }>;
  // Còn thiếu gì để chuyển sang `consented` (YCTD-343); rỗng là đủ hồ sơ
  consent_gaps?: string[];
  jobs: Array<{ id: string; kind: string; status: string; current_step: string | null; error: string | null }>;
  events: Array<{
    id: string;
    event: string;
    from_status: string | null;
    to_status: string | null;
    reason: string | null;
    at: string;
  }>;
  invitations: Array<{ login: string; full_name: string; expires_at: string; used_at: string | null }>;
  backups: Array<{
    id: string;
    kind: 'backup' | 'restore' | 'drill' | 'cluster-move';
    status: 'running' | 'done' | 'failed';
    file_name: string | null;
    file_bytes: string | null;
    tables: number | null;
    rows: string | null;
    details: Record<string, unknown>;
    error: string | null;
    started_at: string;
    finished_at: string | null;
  }>;
}

export interface PlatformSettings {
  system_domain: string | null;
  ingress_host: string | null;
  domain_provider: string;
  deletion_grace_days: number;
  data_policy: 'any' | 'consent-required' | 'synthetic-only';
}

export interface ProvisionReply {
  job_id: string;
  status: string;
  error: string | null;
  school: { code: string; status: string } | null;
  activation: { path: string; host: string | null } | null;
}

export interface ConsentRecordInput {
  kind: string;
  template_code: string;
  template_version: string;
  signer_name: string;
  signer_title: string;
  signed_on: string;
  valid_from: string;
  valid_until?: string | null;
  data_scope: string;
  file_sha256: string;
}

export interface HostingRecordInput {
  provider: string;
  service: string;
  region: string;
  role: 'subprocessor' | 'transit';
  stores_personal_data: boolean;
  started_on: string;
}

export const schoolsApi = {
  list: (token: string) => request<{ items: SchoolSummary[] }>(token, ''),
  settings: (token: string) => request<PlatformSettings>(token, '/settings'),
  detail: (token: string, code: string) => request<SchoolDetail>(token, `/${encodeURIComponent(code)}`),
  provision: (token: string, input: unknown) => request<ProvisionReply>(token, '', input),
  resumeJob: (token: string, id: string) => request<ProvisionReply>(token, `/jobs/${id}/resume`, {}),
  rollbackJob: (token: string, id: string) => request<{ status: string }>(token, `/jobs/${id}/rollback`, {}),
  changeStatus: (token: string, code: string, action: string, reason: string) =>
    request<{ status: string }>(token, `/${encodeURIComponent(code)}/${action}`, { reason }),
  reissue: (token: string, code: string) =>
    request<{ activation: { path: string } }>(token, `/${encodeURIComponent(code)}/invitation`, {}),
  addDomain: (token: string, code: string, host: string) =>
    request<unknown>(token, `/${encodeURIComponent(code)}/domains`, { host }),
  // Hồ sơ đồng ý, vùng máy chủ, loại dữ liệu của trường đã tạo (YCTD-343); máy chủ chỉ nhận vai trò quản trị, kỹ thuật
  addConsent: (token: string, code: string, input: ConsentRecordInput) =>
    request<SchoolDetail>(token, `/${encodeURIComponent(code)}/consents`, input),
  addHosting: (token: string, code: string, input: HostingRecordInput) =>
    request<SchoolDetail>(token, `/${encodeURIComponent(code)}/hosting`, input),
  changeDataClass: (token: string, code: string, dataClass: string) =>
    request<SchoolDetail>(token, `/${encodeURIComponent(code)}/data-class`, { data_class: dataClass }),
  verifyDomain: (token: string, code: string, host: string) =>
    request<{ verified: boolean; problems: string[] }>(
      token,
      `/${encodeURIComponent(code)}/domains/${encodeURIComponent(host)}/verify`,
      {},
    ),
};

// Bảng điều khiển nền tảng, thông báo bảo trì, phiên hỗ trợ (DT-SaaS phần S4, YCTD-197)
async function call<T>(accessToken: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/auth/platform${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
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

export interface DashboardAlert {
  kind: string;
  message: string;
}

export interface DashboardSchool {
  id: string;
  code: string;
  name: string;
  status: string;
  data_class: string;
  plan: { code: string; name: string; max_active_students: number | null; max_storage_mb: number | null } | null;
  metrics: {
    captured_at: string;
    users_total: number;
    users_active: number;
    active_students: number | null;
    storage_mb: number | null;
    database_mb: number | null;
    last_login_at: string | null;
    schema_versions: Record<string, string | null>;
    schema_current: boolean;
  } | null;
  errors: { last_hour: number; last_day: number; last_at: string | null };
  failing_jobs: Array<{ job: string; last_run_at: string; last_error: string | null }>;
  support: { operator_name: string; scope: string; expires_at: string } | null;
  alerts: DashboardAlert[];
}

export interface DashboardOverview {
  generated_at: string;
  error_alert_per_hour: number;
  totals: {
    schools: number;
    serving: number;
    with_alerts: number;
    users: number;
    active_students: number;
    storage_mb: number;
    errors_last_day: number;
    platform_errors_last_day: number;
  };
  items: DashboardSchool[];
}

export interface ErrorCountRow {
  school_code: string | null;
  service: string;
  bucket: string;
  route: string;
  status: number;
  count: number;
  last_code: string | null;
  last_at: string;
}

export interface MaintenanceNotice {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  starts_at: string;
  ends_at: string;
  audience: 'all' | 'schools';
  school_codes: string[];
  created_by_name: string;
  created_at: string;
  cancelled_at: string | null;
  state: 'scheduled' | 'active' | 'ended' | 'cancelled';
}

export interface SupportGrant {
  id: string;
  granted_by_name: string;
  scope: 'read' | 'full';
  reason: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface SupportSessionRow {
  id: string;
  operator_name: string;
  scope: 'read' | 'full';
  reason: string;
  created_at: string;
  started_at: string | null;
  expires_at: string;
  ended_at: string | null;
  end_reason: string | null;
  // Căn cứ mở phiên (DT-24)
  access_basis?: 'school_grant' | 'platform_policy' | 'access_request';
}

// Chính sách vào trường của quản trị nền tảng (DT-24)
export interface SupportAccessPolicy {
  mode: 'any_school' | 'school_grant';
  default_hours: number;
  max_hours: number;
}

export interface SupportStartReply {
  session_id: string;
  scope: 'read' | 'full';
  access_basis?: 'school_grant' | 'platform_policy';
  expires_at: string;
  handoff: { path: string; host: string | null; expires_in_seconds: number };
}

export const dashboardApi = {
  overview: (token: string) => call<DashboardOverview>(token, '/dashboard'),
  errors: (token: string, school: string, hours: number) =>
    call<{ hours: number; items: ErrorCountRow[] }>(
      token,
      `/dashboard/errors?hours=${hours}${school ? `&school=${encodeURIComponent(school)}` : ''}`,
    ),
  notices: (token: string) => call<{ items: MaintenanceNotice[] }>(token, '/maintenance-notices'),
  createNotice: (token: string, input: unknown) => call<MaintenanceNotice>(token, '/maintenance-notices', input),
  cancelNotice: (token: string, id: string) => call<unknown>(token, `/maintenance-notices/${id}/cancel`, {}),
  support: (token: string, code: string) =>
    call<{
      active_grant: SupportGrant | null;
      grants: SupportGrant[];
      sessions: SupportSessionRow[];
      policy?: SupportAccessPolicy;
      // Tài khoản Admin (vai trò quan_tri) vào thẳng mọi trường bằng một lần bấm (YCTD-314)
      direct_entry?: boolean;
    }>(token, `/schools/${encodeURIComponent(code)}/support`),
  // Quyền quản trị nền tảng (DT-24): không có cho phép của trường thì gửi kèm mã xác thực hai lớp, phạm vi, số giờ
  startSupport: (
    token: string,
    code: string,
    reason: string,
    access: { otp_code?: string; scope?: 'read' | 'full'; hours?: number } = {},
  ) => call<SupportStartReply>(token, `/schools/${encodeURIComponent(code)}/support-sessions`, { reason, ...access }),
  endSupport: (token: string, id: string) => call<unknown>(token, `/support-sessions/${id}/end`, {}),
};

// Gọi dịch vụ định danh cho tài khoản vận hành nền tảng; cùng tên miền của cổng nền tảng nên không cần CORS
export interface Operator {
  id: string;
  login: string;
  full_name: string;
}

export interface OperatorProfile extends Operator {
  school_count: number;
}

export class PlatformApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<PlatformApiError> {
  let message = 'Không thực hiện được, vui lòng thử lại';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    message = body.error?.message ?? message;
  } catch {
    // Phản hồi không phải JSON: giữ thông điệp mặc định
  }
  return new PlatformApiError(response.status, message);
}

export async function loginOperator(
  login: string,
  password: string,
): Promise<{ accessToken: string; operator: Operator }> {
  const response = await fetch('/api/v1/auth/platform/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const body = (await response.json()) as { access_token: string; operator: Operator };
  return { accessToken: body.access_token, operator: body.operator };
}

export async function fetchProfile(accessToken: string): Promise<OperatorProfile> {
  const response = await fetch('/api/v1/auth/platform/me', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw await readError(response);
  }
  return (await response.json()) as OperatorProfile;
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
    signer_name: string;
    valid_from: string;
    valid_until: string | null;
  }>;
  hosting: Array<{ id: string; provider: string; service: string; region: string; role: string }>;
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
  verifyDomain: (token: string, code: string, host: string) =>
    request<{ verified: boolean; problems: string[] }>(
      token,
      `/${encodeURIComponent(code)}/domains/${encodeURIComponent(host)}/verify`,
      {},
    ),
};

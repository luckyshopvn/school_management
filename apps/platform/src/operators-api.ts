import { PlatformValidationError, type FieldProblem } from './platform-api.js';

// Nhân viên vận hành của công ty (YCTD-311): quản trị nền tảng tạo, phân vai, khóa, mở khóa, cấp lại khóa xác thực hai lớp
export type OperatorRole = 'quan_tri' | 'ho_tro' | 'ky_thuat' | 'ke_toan';

export const OPERATOR_ROLE_LABELS: Record<OperatorRole, string> = {
  quan_tri: 'Quản trị',
  ho_tro: 'Hỗ trợ',
  ky_thuat: 'Kỹ thuật',
  ke_toan: 'Kế toán',
};

export interface OperatorRow {
  id: string;
  login: string;
  full_name: string;
  role: OperatorRole;
  status: 'active' | 'locked';
  locked_until: string | null;
  last_login_at: string | null;
  totp_enrolled: boolean;
}

export interface OperatorCredentials {
  id?: string;
  temporary_password?: string;
  totp_secret: string;
  otpauth_uri: string;
  recovery_codes: string[];
}

async function send<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/auth/platform/operators${path}`, {
    method,
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

export const operatorsApi = {
  list: (token: string) => send<{ login_rule: 'cccd' | 'email'; items: OperatorRow[] }>(token, 'GET', ''),
  create: (token: string, body: { login: string; full_name: string; role: OperatorRole; otp_code: string }) =>
    send<OperatorCredentials>(token, 'POST', '', body),
  update: (token: string, id: string, body: { role?: OperatorRole; status?: 'active' | 'locked' }) =>
    send<{ id: string }>(token, 'PATCH', `/${encodeURIComponent(id)}`, body),
  resetTotp: (token: string, id: string, otpCode: string) =>
    send<OperatorCredentials>(token, 'POST', `/${encodeURIComponent(id)}/totp-reset`, { otp_code: otpCode }),
};

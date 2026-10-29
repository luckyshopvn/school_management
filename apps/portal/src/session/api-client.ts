// Gọi giao diện lập trình ứng dụng; giao diện không chứa quy tắc nghiệp vụ, chỉ hiển thị kết quả (QU-09)
import { setViewedAcademicYear, VIEWED_ACADEMIC_YEAR_HEADER, viewedAcademicYear } from './viewed-year.js';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  password_change_required: boolean;
  // Hạn mật khẩu của tài khoản nhân sự (YCTD-110); máy chủ cũ không trả thì coi như không áp dụng
  password_expired?: boolean;
  password_expires_in_days?: number | null;
}

export interface CurrentUser {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  must_change_password: boolean;
  assignments: Array<{ role_code: string; role_name: string; org_unit_id: string | null; permissions: string[] }>;
  // Phân hệ của cổng quản trị được dùng theo 1.2 Phân quyền nhóm theo phần mềm (DT-16 phần 16d); máy cũ không trả thì hiện đủ
  workspaces?: string[];
  // Phiên đăng nhập thay (DT-18 phần 18h): người đang đăng nhập thay tài khoản này; phiên thường là null
  impersonation?: {
    id: string;
    impersonator_id: string;
    impersonator_name: string;
    started_at: string;
    expires_at: string;
  } | null;
  // Cấp đang làm việc đã chọn ở thanh đầu trang (DT-19 phần 19c): null hoặc không có là "Tất cả"
  working_school_level?: string | null;
  // Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): null hoặc không có là phiên thường
  support?: { id: string; scope: 'read' | 'full'; operator_name: string; expires_at: string } | null;
}

// Mã phiên chỉ giữ trong bộ nhớ của trang; mã làm mới nằm trong cookie httpOnly (RG-04, BM-71)
let accessToken: string | undefined;

export function setAccessToken(value: string | undefined): void {
  accessToken = value;
}

export async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: FieldError[] } };
    return new ApiError(
      response.status,
      body.error?.code ?? 'ERR_INTERNAL',
      body.error?.message ?? 'Hệ thống gặp lỗi, vui lòng thử lại sau',
      body.error?.details ?? [],
    );
  } catch {
    return new ApiError(response.status, 'ERR_INTERNAL', 'Hệ thống gặp lỗi, vui lòng thử lại sau');
  }
}

// Đang xem năm học đã đóng (YCTD-342) thì mọi yêu cầu mang mã năm đó; máy chủ đọc năm đó và từ chối ghi
function withViewedYear(headers: Headers): void {
  const year = viewedAcademicYear();
  if (year) {
    headers.set(VIEWED_ACADEMIC_YEAR_HEADER, year.id);
  }
}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // Biểu mẫu nhiều phần để trình duyệt tự đặt kiểu nội dung kèm ranh giới
  if (typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  withViewedYear(headers);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  // Máy chủ trả null (ví dụ chưa có Trường chính) thì thân rỗng; đọc thành null thay vì báo mất kết nối
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Yêu cầu không cần phiên đăng nhập: trang đăng nhập, quên mật khẩu (DT-16 phần 16c)
export function publicJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  return send<T>(path, init);
}

let pendingRefresh: Promise<TokenResponse> | undefined;

// Nhiều yêu cầu cùng gặp mã hết hạn chỉ làm mới một lần
export function refreshSession(): Promise<TokenResponse> {
  pendingRefresh ??= send<TokenResponse>('/api/v1/auth/refresh', { method: 'POST' })
    .then((tokens) => {
      setAccessToken(tokens.access_token);
      return tokens;
    })
    .finally(() => {
      pendingRefresh = undefined;
    });
  return pendingRefresh;
}

// Gặp mã phiên hết hạn thì làm mới một lần rồi gửi lại
export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await send<T>(path, init);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !accessToken) {
      throw error;
    }
    await refreshSession();
    return send<T>(path, init);
  }
}

// Tải nội dung không phải JSON như tệp đính kèm, kèm mã phiên; gặp mã hết hạn thì làm mới một lần
export async function fetchWithSession(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => {
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }
    withViewedYear(headers);
    return fetch(path, { ...init, headers, credentials: 'same-origin' });
  };
  const response = await attempt();
  if (response.status !== 401 || !accessToken) {
    return response;
  }
  await refreshSession();
  return attempt();
}

// Mã xác nhận gửi kèm khi trang đăng nhập đang hiện ảnh mã (DT-16 phần 16c)
export interface CaptchaAnswer {
  captcha_id: string;
  captcha_text: string;
}

export async function login(
  loginIdentifier: string,
  password: string,
  captcha?: CaptchaAnswer,
  otpCode?: string,
  // "Ghi nhớ" (YCTD-310): máy chủ giữ phiên lâu và cookie bền; mật khẩu không lưu ở trình duyệt
  remember = false,
): Promise<TokenResponse> {
  const tokens = await send<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: loginIdentifier,
      password,
      channel: 'portal',
      ...captcha,
      ...(otpCode ? { otp_code: otpCode } : {}),
      ...(remember ? { remember: true } : {}),
    }),
  });
  setAccessToken(tokens.access_token);
  return tokens;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  otpCode?: string,
): Promise<TokenResponse> {
  const tokens = await requestJson<TokenResponse>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      ...(otpCode ? { otp_code: otpCode } : {}),
    }),
  });
  setAccessToken(tokens.access_token);
  return tokens;
}

// Gửi mã xác nhận tới số điện thoại khi tài khoản còn mật khẩu mặc định (YCTD-323)
export async function sendChangePasswordCode(): Promise<{ phone: string; expires_in_seconds: number }> {
  return requestJson<{ phone: string; expires_in_seconds: number }>('/api/v1/auth/change-password/code', {
    method: 'POST',
  });
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(undefined);
    setViewedAcademicYear(null);
  }
}

// Đăng nhập thay (DT-18 phần 18h): cookie cổng quản trị chuyển sang phiên của tài khoản đích
export async function startImpersonation(userId: string, reason: string): Promise<TokenResponse> {
  const tokens = await requestJson<TokenResponse>('/api/v1/auth/impersonation', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, reason }),
  });
  setAccessToken(tokens.access_token);
  return tokens;
}

// Thoát đăng nhập thay: quay về phiên của quản trị; phiên đó đã hết hạn thì máy chủ trả signed_out
export async function exitImpersonation(): Promise<{ signedOut: boolean }> {
  const result = await requestJson<Partial<TokenResponse> & { signed_out: boolean }>(
    '/api/v1/auth/impersonation/exit',
    {
      method: 'POST',
    },
  );
  setAccessToken(result.signed_out ? undefined : result.access_token);
  return { signedOut: result.signed_out };
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/v1/auth/me');
}

// Gọi dịch vụ định danh và máy chủ API từ ứng dụng giáo viên; giao diện không chứa quy tắc nghiệp vụ (QU-09)
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
}

// Ảnh mã xác nhận ở đăng nhập (YCTD-353): máy chủ đòi khi tài khoản đã nhập sai nhiều lần
export interface CaptchaChallenge {
  captcha_id: string;
  image: string;
}

export interface CaptchaAnswer {
  captcha_id: string;
  captcha_text: string;
}

export interface CurrentUser {
  id: string;
  full_name: string;
  phone: string | null;
  assignments: Array<{ role_code: string; org_unit_id: string | null; permissions: string[] }>;
}

// Mã phiên chỉ giữ trong bộ nhớ; mã làm mới nằm trong cookie httpOnly (BM-71)
let accessToken: string | undefined;

async function readError(response: Response): Promise<ApiError> {
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

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
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

function remember(tokens: TokenResponse): TokenResponse {
  accessToken = tokens.access_token;
  return tokens;
}

let pendingRefresh: Promise<TokenResponse> | undefined;

export function refreshSession(): Promise<TokenResponse> {
  pendingRefresh ??= send<TokenResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ channel: 'teacher' }),
  })
    .then(remember)
    .finally(() => {
      pendingRefresh = undefined;
    });
  return pendingRefresh;
}

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

// Tải nội dung không phải JSON như ảnh thuốc, kèm mã phiên; gặp mã hết hạn thì làm mới một lần
export async function fetchWithSession(path: string): Promise<Response> {
  const attempt = () =>
    fetch(path, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: 'same-origin',
    });
  const response = await attempt();
  if (response.status !== 401 || !accessToken) {
    return response;
  }
  await refreshSession();
  return attempt();
}

export async function loginWithPassword(
  loginIdentifier: string,
  password: string,
  otpCode?: string,
  captcha?: CaptchaAnswer,
): Promise<TokenResponse> {
  return remember(
    await send<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        login: loginIdentifier,
        password,
        channel: 'teacher',
        ...(otpCode ? { otp_code: otpCode } : {}),
        ...captcha,
      }),
    }),
  );
}

export function issueCaptcha(): Promise<CaptchaChallenge> {
  return send<CaptchaChallenge>('/api/v1/auth/captcha', { method: 'POST', body: JSON.stringify({}) });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  return remember(
    await requestJson<TokenResponse>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  );
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    accessToken = undefined;
  }
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/v1/auth/me');
}

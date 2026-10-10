// Gọi giao diện lập trình ứng dụng; giao diện không chứa quy tắc nghiệp vụ, chỉ hiển thị kết quả (QU-09)

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

export interface CurrentUser {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  must_change_password: boolean;
  assignments: Array<{ role_code: string; role_name: string; org_unit_id: string | null; permissions: string[] }>;
}

// Mã phiên chỉ giữ trong bộ nhớ của trang; mã làm mới nằm trong cookie httpOnly (RG-04, BM-71)
let accessToken: string | undefined;

export function setAccessToken(value: string | undefined): void {
  accessToken = value;
}

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
  // Biểu mẫu nhiều phần để trình duyệt tự đặt kiểu nội dung kèm ranh giới
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
  return (await response.json()) as T;
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

export async function login(loginIdentifier: string, password: string): Promise<TokenResponse> {
  const tokens = await send<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginIdentifier, password, channel: 'portal' }),
  });
  setAccessToken(tokens.access_token);
  return tokens;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  const tokens = await requestJson<TokenResponse>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  setAccessToken(tokens.access_token);
  return tokens;
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(undefined);
  }
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/v1/auth/me');
}

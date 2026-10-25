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

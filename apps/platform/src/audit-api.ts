import { PlatformValidationError, type FieldProblem } from './platform-api.js';

// Nhật ký truy cập và số liệu tổng quan của cổng vận hành (YCTD-324)
export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  label: string;
  actor: string;
  school_code: string | null;
  school_name: string | null;
  reason: string | null;
  scope: string | null;
  ip: string | null;
}

export type AuditGroup = 'all' | 'entry' | 'provision' | 'features';

export interface AuditFilter {
  group: AuditGroup;
  school: string;
  from: string;
  to: string;
  page: number;
}

export interface PlatformOverview {
  schools_total: number;
  schools_today: number;
  schools_with_addons: number;
  admin_entries_7d: number;
  recent_schools: Array<{
    code: string;
    name: string;
    status: string;
    moet_code: string | null;
    created_at: string;
    plan_name: string | null;
  }>;
  recent_activity: AuditEntry[];
}

async function get(token: string, path: string): Promise<Response> {
  const response = await fetch(`/api/v1/auth/platform${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    let message = 'Không đọc được dữ liệu, vui lòng thử lại';
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
  return response;
}

function query(filter: AuditFilter, extra: Record<string, string> = {}): string {
  const parameters = new URLSearchParams();
  if (filter.group !== 'all') {
    parameters.set('group', filter.group);
  }
  for (const key of ['school', 'from', 'to'] as const) {
    if (filter[key]) {
      parameters.set(key, filter[key]);
    }
  }
  parameters.set('page', String(filter.page));
  for (const [key, value] of Object.entries(extra)) {
    parameters.set(key, value);
  }
  return parameters.toString();
}

export const auditApi = {
  overview: async (token: string) => (await (await get(token, '/overview')).json()) as PlatformOverview,
  list: async (token: string, filter: AuditFilter) =>
    (await (await get(token, `/audit-log?${query(filter)}`)).json()) as { items: AuditEntry[]; has_more: boolean },
  // Tải tệp CSV đúng bộ lọc (kèm mã phiên nên không dùng liên kết thường)
  downloadCsv: async (token: string, filter: AuditFilter) => {
    const blob = await (await get(token, `/audit-log?${query({ ...filter, page: 1 }, { format: 'csv' })}`)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nhat-ky-truy-cap.csv';
    link.click();
    URL.revokeObjectURL(url);
  },
};

const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function auditTime(value: string): string {
  return TIME.format(new Date(value));
}

// Trạng thái của trường theo cách gọi của thiết kế; trả kèm tông màu của nhãn
export function schoolStatusLabel(status: string, createdAt?: string): { label: string; tone: string } {
  if (status === 'provisioning') {
    return { label: 'Đang khởi tạo', tone: 'warn' };
  }
  if (status === 'trial' || status === 'active') {
    const fresh = createdAt ? Date.now() - new Date(createdAt).getTime() < 7 * 86_400_000 : false;
    return fresh ? { label: 'Vừa khởi tạo', tone: 'info' } : { label: 'Đang dùng', tone: 'ok' };
  }
  if (status === 'read_only') {
    return { label: 'Chỉ đọc', tone: 'warn' };
  }
  if (status === 'suspended') {
    return { label: 'Tạm ngưng', tone: 'warn' };
  }
  if (status === 'pending_deletion') {
    return { label: 'Chờ xóa', tone: 'warn' };
  }
  return { label: status, tone: 'idle' };
}

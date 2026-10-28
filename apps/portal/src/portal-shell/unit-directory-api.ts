import { publicJson } from '../session/api-client.js';
import type { CaptchaChallenge } from './portal-shell-api.js';

// Đăng nhập theo đơn vị (DT-24, YCTD-220): chế độ trang đăng nhập theo tên miền và ô chọn Sở → Phường/Xã → Cấp học → Trường
// (YCTD-310) đọc danh mục của nền tảng (phân trang, tìm kiếm ở máy chủ)
export interface LoginPageSettings {
  title: string;
  subtitle: string;
  support_lines: string[];
}

export type LoginContext =
  | { mode: 'single' }
  | { mode: 'directory'; page: LoginPageSettings }
  | {
      mode: 'school';
      unit: {
        name: string;
        moet_code: string | null;
        department_name: string | null;
        commune_name: string | null;
        levels: string[];
      };
    };

export interface DirectoryOption {
  code: string;
  name: string;
}

export interface DirectoryPage<T> {
  items: T[];
  has_more: boolean;
}

export interface DirectoryUnit {
  moet_code: string;
  name: string;
  commune_name: string | null;
  levels: string[];
}

export interface DirectoryUnitDetail extends DirectoryUnit {
  department_name: string;
  available: boolean;
  login_host: string | null;
  message: string | null;
}

export interface DirectoryLoginInput {
  unit: string;
  login: string;
  password: string;
  captcha_id?: string;
  captcha_text?: string;
  otp_code?: string;
}

export interface DirectoryLoginReply {
  handoff: { host: string | null; path: string; expires_in_seconds: number };
}

const DIRECTORY = '/api/v1/auth/directory';

function query(values: Record<string, string | number | null | undefined>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      parameters.set(key, String(value));
    }
  }
  return parameters.toString();
}

// Chế độ một trường (máy chủ chưa có nền tảng nhiều trường) không có điểm cuối này hoặc trả lỗi: trang giữ hành vi cũ
export async function readLoginContext(): Promise<LoginContext> {
  try {
    return await publicJson<LoginContext>(`${DIRECTORY}/context`);
  } catch {
    return { mode: 'single' };
  }
}

export function listDepartments(): Promise<{ items: DirectoryOption[] }> {
  return publicJson(`${DIRECTORY}/departments`);
}

// Có sở, phường thì máy chủ chỉ trả cấp học có trường trong phạm vi đó (YCTD-310)
export function listLevels(
  scope: { department?: string | null; commune?: string | null } = {},
): Promise<{ items: Array<DirectoryOption & { moet_code: string }> }> {
  const parameters = query(scope);
  return publicJson(`${DIRECTORY}/levels${parameters ? `?${parameters}` : ''}`);
}

export function listCommunes(department: string, q: string, offset: number): Promise<DirectoryPage<DirectoryOption>> {
  return publicJson(`${DIRECTORY}/communes?${query({ department, q, offset, limit: 30 })}`);
}

export function listUnits(
  filter: { department: string; level: string | null; commune: string | null },
  q: string,
  offset: number,
): Promise<DirectoryPage<DirectoryUnit>> {
  return publicJson(`${DIRECTORY}/units?${query({ ...filter, q, offset, limit: 30 })}`);
}

export function readUnit(code: string): Promise<DirectoryUnitDetail> {
  return publicJson(`${DIRECTORY}/unit?${query({ code })}`);
}

export function issueDirectoryCaptcha(unit: string): Promise<CaptchaChallenge> {
  return publicJson(`${DIRECTORY}/captcha`, { method: 'POST', body: JSON.stringify({ unit }) });
}

export function directoryLogin(input: DirectoryLoginInput): Promise<DirectoryLoginReply> {
  return publicJson(`${DIRECTORY}/login`, { method: 'POST', body: JSON.stringify(input) });
}

export function exchangeHandoff(code: string): Promise<unknown> {
  return publicJson('/api/v1/auth/handoff/exchange', { method: 'POST', body: JSON.stringify({ code }) });
}

// Địa chỉ trang đổi mã ở tên miền của trường: cùng giao thức, cổng, đường dẫn gốc với trang đang mở (ứng dụng cổng quản trị
// phục vụ cả tên miền chung và tên miền của trường)
export function handoffUrl(reply: DirectoryLoginReply): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const host = reply.handoff.host ?? window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${host}${port}${base}${reply.handoff.path}`;
}

export function schoolPageUrl(host: string, path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${host}${port}${base}${path}`;
}

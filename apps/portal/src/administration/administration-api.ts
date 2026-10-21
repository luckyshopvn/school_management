import type { DemoAccountApp, ImpersonationStatus } from '@school-management/shared';
import { publicJson, requestJson } from '../session/api-client.js';
import type { ExportJob } from '../exports/export-api.js';

// Quản trị và trình diễn (DT-18 phần 18h): nhật ký đăng nhập thay, gói toàn bộ dữ liệu, trạng thái bản trình diễn
export interface Impersonation {
  id: string;
  impersonator_user_id: string;
  impersonator_name: string;
  target_user_id: string;
  target_name: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  status: ImpersonationStatus;
  ip_address: string | null;
}

export interface ImpersonationPage {
  items: Impersonation[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ImpersonationAction {
  id: string;
  impersonation_id: string;
  impersonator_name: string;
  target_name: string;
  method: string;
  path: string;
  status_code: number;
  ip_address: string | null;
  created_at: string;
}

export interface SchoolDataExport extends Omit<ExportJob, 'format'> {
  format: 'zip';
  user_name: string;
  download_count: number;
  last_downloaded_at: string | null;
}

export interface DemoAccount {
  login: string;
  full_name: string;
  role_code: string;
  role_name: string;
  app: DemoAccountApp;
}

export interface DemoStatus {
  enabled: boolean;
  seeded_at: string | null;
  next_reset_at: string | null;
  reset_interval_hours: number | null;
  accounts: DemoAccount[];
  password: string | null;
}

export function listImpersonations(page: number, keyword: string): Promise<ImpersonationPage> {
  const query = new URLSearchParams({ page: String(page) });
  if (keyword.trim()) {
    query.set('q', keyword.trim());
  }
  return requestJson<ImpersonationPage>(`/api/v1/auth/impersonations?${query.toString()}`);
}

export async function listImpersonationActions(impersonationId: string): Promise<ImpersonationAction[]> {
  return (
    await requestJson<{ items: ImpersonationAction[] }>(
      `/api/v1/impersonation-actions?impersonation_id=${encodeURIComponent(impersonationId)}`,
    )
  ).items;
}

export async function listSchoolDataExports(): Promise<SchoolDataExport[]> {
  return (await requestJson<{ items: SchoolDataExport[] }>('/api/v1/school-data-exports')).items;
}

export async function requestSchoolDataExport(): Promise<ExportJob> {
  return (await requestJson<{ job: ExportJob }>('/api/v1/school-data-exports', { method: 'POST' })).job;
}

// Điểm cuối công khai: trang đăng nhập đọc khi chưa đăng nhập
export function readDemoStatus(): Promise<DemoStatus> {
  return publicJson<DemoStatus>('/api/v1/public/demo');
}

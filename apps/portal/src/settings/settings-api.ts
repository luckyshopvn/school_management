import { requestJson } from '../session/api-client.js';

// Gọi điểm cuối cấu hình theo đơn vị (máy chủ API) và cấu hình chung (dịch vụ định danh)
export type SettingSource = 'unit' | 'truong_chinh' | 'default' | 'missing';

export interface EffectiveSetting {
  key: string;
  label: string;
  value_type: 'closing_day' | 'day_of_month' | 'day_list' | 'boolean' | 'positive_integer';
  value: unknown;
  source: SettingSource;
  unit_value: unknown;
}

export function readSettings(orgUnitId: string): Promise<EffectiveSetting[]> {
  return requestJson(`/api/v1/settings?org_unit_id=${orgUnitId}`);
}

export function saveSettings(orgUnitId: string, values: Record<string, unknown>): Promise<EffectiveSetting[]> {
  return requestJson('/api/v1/settings', { method: 'PUT', body: JSON.stringify({ org_unit_id: orgUnitId, values }) });
}

export function readIdentitySettings(): Promise<{ account_inactivity_lock_days: number }> {
  return requestJson('/api/v1/auth/settings');
}

export function saveIdentitySettings(days: number): Promise<{ account_inactivity_lock_days: number }> {
  return requestJson('/api/v1/auth/settings', {
    method: 'PUT',
    body: JSON.stringify({ account_inactivity_lock_days: days }),
  });
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  actor_name: string | null;
  org_unit_id?: string | null;
  entity_name: string;
  entity_id: string;
  action: string;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  page: number;
  total: number;
  total_pages: number;
}

export function listAuditLogs(
  source: 'business' | 'identity',
  page: number,
  entityName: string,
): Promise<AuditLogPage> {
  const parameters = new URLSearchParams({ page: String(page), page_size: '20' });
  if (entityName && source === 'business') {
    parameters.set('entity_name', entityName);
  }
  const path = source === 'business' ? '/api/v1/audit-logs' : '/api/v1/users/audit-logs';
  return requestJson(`${path}?${parameters.toString()}`);
}

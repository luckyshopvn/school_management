import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối tài khoản, vai trò, quyền của dịch vụ định danh (P01-06, P01-07)
export interface Assignment {
  assignment_id: string;
  role_code: string;
  role_name: string;
  org_unit_id: string | null;
}

export interface Account {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  status: 'active' | 'locked';
  must_change_password: boolean;
  valid_until: string | null;
  last_login_at: string | null;
  assignments: Assignment[];
}

export interface AccountPage {
  items: Account[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface RoleGrant {
  role_code: string;
  org_unit_id: string | null;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

export interface Permission {
  code: string;
  module_code: string;
  description: string;
}

export function listAccounts(filter: { q: string; status: string; page: number }): Promise<AccountPage> {
  const parameters = new URLSearchParams({ page: String(filter.page), page_size: '20' });
  if (filter.q) {
    parameters.set('q', filter.q);
  }
  if (filter.status) {
    parameters.set('status', filter.status);
  }
  return requestJson(`/api/v1/users?${parameters.toString()}`);
}

export function createAccount(input: {
  full_name: string;
  phone: string | null;
  username: string | null;
  valid_until: string | null;
  roles: RoleGrant[];
}): Promise<{ account: Account; temporary_password: string | null; uses_default_password: boolean }> {
  return requestJson('/api/v1/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAccount(
  userId: string,
  changes: Partial<Pick<Account, 'full_name' | 'phone' | 'username' | 'valid_until' | 'status'>>,
): Promise<Account> {
  return requestJson(`/api/v1/users/${userId}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function resetPassword(userId: string): Promise<{ temporary_password: string }> {
  return requestJson(`/api/v1/users/${userId}/reset-password`, { method: 'POST' });
}

export function addRole(userId: string, grant: RoleGrant): Promise<Account> {
  return requestJson(`/api/v1/users/${userId}/roles`, { method: 'POST', body: JSON.stringify(grant) });
}

export function removeRole(userId: string, assignmentId: string): Promise<Account> {
  return requestJson(`/api/v1/users/${userId}/roles/${assignmentId}`, { method: 'DELETE' });
}

export function listRoles(): Promise<Role[]> {
  return requestJson('/api/v1/roles');
}

export function createRole(code: string, name: string): Promise<Role> {
  return requestJson('/api/v1/roles', { method: 'POST', body: JSON.stringify({ code, name }) });
}

export function replaceRolePermissions(roleId: string, permissionCodes: string[]): Promise<Role> {
  return requestJson(`/api/v1/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permission_codes: permissionCodes }),
  });
}

export function listPermissions(): Promise<Permission[]> {
  return requestJson('/api/v1/permissions');
}

import { downloadPost } from '../children/children-api.js';
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
  // Thời điểm đặt mật khẩu gần nhất (YCTD-110)
  password_changed_at: string;
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
  // Hiệu lực, số người dùng, phân hệ được dùng (DT-16 phần 16d)
  is_active: boolean;
  user_count: number;
  permissions: string[];
  workspaces: string[];
}

export interface Permission {
  code: string;
  module_code: string;
  description: string;
}

// Bộ lọc của 1.4 Danh sách người dùng theo Sở (DT-15 phần 15e); ô trống thì không lọc
export interface AccountFilter {
  q: string;
  status: string;
  roleCode: string;
  login: string;
  fullName: string;
  // "true", "false" hoặc trống
  mustChangePassword: string;
  // Mã nhân sự hoặc mã định danh Bộ GD&ĐT; ngày hết hạn mật khẩu từ, đến (DT-16 phần 16d)
  identifier: string;
  passwordExpiresFrom: string;
  passwordExpiresTo: string;
}

export const EMPTY_ACCOUNT_FILTER: AccountFilter = {
  q: '',
  status: '',
  roleCode: '',
  login: '',
  fullName: '',
  mustChangePassword: '',
  identifier: '',
  passwordExpiresFrom: '',
  passwordExpiresTo: '',
};

export function listAccounts(filter: AccountFilter & { page: number; pageSize: number }): Promise<AccountPage> {
  const parameters = new URLSearchParams({ page: String(filter.page), page_size: String(filter.pageSize) });
  const optional: Array<[string, string]> = [
    ['q', filter.q],
    ['status', filter.status],
    ['role_code', filter.roleCode],
    ['login', filter.login],
    ['full_name', filter.fullName],
    ['must_change_password', filter.mustChangePassword],
  ];
  for (const [name, value] of optional) {
    if (value.trim()) {
      parameters.set(name, value.trim());
    }
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

// Xem đủ tên đăng nhập (số CCCD) của tài khoản; máy chủ ghi nhật ký mỗi lần xem (YCTD-353)
export function viewLoginIdentifier(userId: string): Promise<{ username: string | null }> {
  return requestJson(`/api/v1/users/${userId}/login-identifier`);
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

// Chính sách hạn mật khẩu của tài khoản nhân sự (DT-15 phần 15g, YCTD-110)
// DT-SaaS phần S8b: thêm độ dài tối thiểu, số lần nhập sai trước khi tạm khóa và số phút tạm khóa (riêng từng trường)
export interface PasswordPolicy {
  password_max_age_days: number;
  password_expiry_warning_days: number;
  password_min_length: number;
  login_max_failed_attempts: number;
  login_lock_minutes: number;
}

export function readPasswordPolicy(): Promise<PasswordPolicy> {
  return requestJson('/api/v1/auth/settings/password-policy');
}

export function savePasswordPolicy(policy: PasswordPolicy): Promise<PasswordPolicy> {
  return requestJson('/api/v1/auth/settings/password-policy', { method: 'PUT', body: JSON.stringify(policy) });
}

// 1.1 Nhóm người dùng: sửa tên, hiệu lực; xóa nhóm chưa có người dùng (DT-16 phần 16d)
export function updateRole(roleId: string, changes: { name?: string; is_active?: boolean }): Promise<Role> {
  return requestJson(`/api/v1/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function deleteRole(roleId: string): Promise<void> {
  return requestJson(`/api/v1/roles/${roleId}`, { method: 'DELETE' });
}

// 1.2 Phân quyền nhóm theo phần mềm: thay toàn bộ phân hệ nhóm được dùng
export function replaceRoleWorkspaces(roleId: string, workspaceKeys: string[]): Promise<Role> {
  return requestJson(`/api/v1/roles/${roleId}/workspaces`, {
    method: 'PUT',
    body: JSON.stringify({ workspace_keys: workspaceKeys }),
  });
}

// Xuất Excel 1.1 Nhóm người dùng theo từ khóa, các cột đang hiện (DT-16 phần 16b); máy chủ API đọc lại nhóm ở dịch vụ định
// danh và ghi nhật ký xuất
export function exportRoles(keyword: string, columns: string[]): Promise<string | undefined> {
  return downloadPost('/api/v1/account-exports/roles', { q: keyword, columns }, 'nhom-nguoi-dung.xlsx');
}

// 1.4 Danh sách người dùng đủ theo Sở: máy chủ API ghép tài khoản với hồ sơ nhân sự (mã nhân sự, mã Bộ)
export interface DirectoryAccount extends Account {
  password_expires_at: string | null;
  staff_id: string | null;
  staff_code: string | null;
  moet_staff_code: string | null;
}

export interface DirectoryPage {
  items: DirectoryAccount[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

function directoryEntries(filter: AccountFilter): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ['q', filter.q],
    ['status', filter.status],
    ['role_code', filter.roleCode],
    ['login', filter.login],
    ['full_name', filter.fullName],
    ['must_change_password', filter.mustChangePassword],
    ['identifier', filter.identifier],
    ['password_expires_from', filter.passwordExpiresFrom],
    ['password_expires_to', filter.passwordExpiresTo],
  ];
  return entries.filter(([, value]) => value.trim() !== '').map(([name, value]) => [name, value.trim()]);
}

export function listAccountDirectory(
  filter: AccountFilter & { page: number; pageSize: number },
): Promise<DirectoryPage> {
  const parameters = new URLSearchParams(directoryEntries(filter));
  parameters.set('page', String(filter.page));
  parameters.set('page_size', String(filter.pageSize));
  return requestJson(`/api/v1/account-directory?${parameters.toString()}`);
}

export const exportAccounts = (filter: AccountFilter, columns: string[]) =>
  downloadPost(
    '/api/v1/account-directory/export',
    { ...Object.fromEntries(directoryEntries(filter)), columns },
    'danh-sach-nguoi-dung.xlsx',
  );

export interface BulkPasswordResult {
  user_id: string;
  full_name: string | null;
  login: string | null;
  temporary_password: string | null;
  skipped_reason: string | null;
}

export function bulkResetPassword(userIds: string[]): Promise<{ items: BulkPasswordResult[] }> {
  return requestJson('/api/v1/users/bulk-reset-password', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function bulkAddRole(
  userIds: string[],
  role: RoleGrant,
): Promise<{
  items: Array<{ user_id: string; full_name: string | null; added: boolean; skipped_reason: string | null }>;
}> {
  return requestJson('/api/v1/users/bulk-roles', { method: 'POST', body: JSON.stringify({ user_ids: userIds, role }) });
}

export interface StaffWithoutAccount {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  org_unit_id: string;
  org_unit_name: string | null;
  suggested_username: string | null;
}

export function listStaffWithoutAccount(): Promise<StaffWithoutAccount[]> {
  return requestJson('/api/v1/account-directory/staff-without-account');
}

export interface StaffAccountResult {
  staff_id: string;
  code: string | null;
  full_name: string | null;
  login: string | null;
  temporary_password: string | null;
  error: string | null;
}

export function createStaffAccounts(staffIds: string[], roleCode: string): Promise<{ items: StaffAccountResult[] }> {
  return requestJson('/api/v1/account-directory/staff-accounts', {
    method: 'POST',
    body: JSON.stringify({ staff_ids: staffIds, role_code: roleCode }),
  });
}

// 1.6 Tài khoản đồng bộ của Bộ, của Sở; máy chủ không bao giờ trả mật khẩu
export interface SyncAccount {
  target: 'moet' | 'doet';
  label: string;
  username: string | null;
  password_configured: boolean;
  updated_at: string | null;
  sync_available: boolean;
}

export function listSyncAccounts(): Promise<SyncAccount[]> {
  return requestJson('/api/v1/sync-accounts');
}

export function saveSyncAccount(target: SyncAccount['target'], input: { username: string; password: string }) {
  return requestJson<SyncAccount>(`/api/v1/sync-accounts/${target}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteSyncAccount(target: SyncAccount['target']): Promise<void> {
  return requestJson(`/api/v1/sync-accounts/${target}`, { method: 'DELETE' });
}

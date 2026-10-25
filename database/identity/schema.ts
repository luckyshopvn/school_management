import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu định danh, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;

export type UserStatus = 'active' | 'locked';
export type SessionChannel = 'portal' | 'teacher' | 'parent';
// Đăng nhập thay (DT-18 phần 18h) mở phiên của tài khoản được đăng nhập thay với cách đăng nhập 'impersonation'
export type LoginMethod = 'password' | 'one_time_code' | 'impersonation';

export interface UsersTable {
  id: Generated<string>;
  full_name: string;
  phone: string | null;
  username: string | null;
  // Để trống nghĩa là tài khoản phụ huynh còn dùng mật khẩu mặc định chung (PQ-06, YCTD-43)
  password_hash: string | null;
  status: Generated<UserStatus>;
  last_login_at: Date | null;
  failed_login_count: Generated<number>;
  locked_until: Date | null;
  must_change_password: Generated<boolean>;
  valid_until: ColumnType<string | null, string | null | undefined, string | null>;
  // Thời điểm đặt mật khẩu gần nhất, dùng tính hạn mật khẩu (YCTD-110)
  password_changed_at: ColumnType<Date, Date | undefined, Date>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface RolesTable {
  id: Generated<string>;
  code: string;
  name: string;
  is_system: Generated<boolean>;
  // Hiệu lực của nhóm người dùng (DT-16 phần 16d); nhóm hết hiệu lực không cấp quyền, phân hệ cho tài khoản
  is_active: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

// Phân hệ của cổng quản trị mà nhóm người dùng không được dùng (1.2 Phân quyền nhóm theo phần mềm, DT-16 phần 16d)
export interface RoleWorkspaceExclusionsTable {
  role_id: string;
  workspace_key: string;
  created_at: CreatedTimestamp;
}

export interface PermissionsTable {
  id: Generated<string>;
  code: string;
  module_code: string;
  description: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_id: string;
}

export interface UserRolesTable {
  id: Generated<string>;
  user_id: string;
  role_id: string;
  org_unit_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  channel: SessionChannel;
  refresh_token_hash: string;
  issued_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  login_method: Generated<LoginMethod>;
  impersonation_id: Generated<string | null>;
}

export type ImpersonationEndReason = 'exit' | 'expired' | 'logout';

// Nhật ký đăng nhập thay (DT-18 phần 18h): quản trị nào vào tài khoản nào, lý do, lúc bắt đầu, lúc kết thúc
export interface ImpersonationsTable {
  id: Generated<string>;
  impersonator_user_id: string;
  impersonator_name: string;
  target_user_id: string;
  target_name: string;
  original_session_id: string;
  reason: string;
  started_at: CreatedTimestamp;
  expires_at: Date;
  ended_at: Date | null;
  end_reason: ImpersonationEndReason | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface SecurityEventsTable {
  id: Generated<string>;
  event_type: string;
  user_id: string | null;
  login_identifier: string | null;
  ip_address: string | null;
  created_at: CreatedTimestamp;
}

export interface IdentityAuditLogsTable {
  id: Generated<string>;
  actor_user_id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  before_data: ColumnType<unknown, string | null, string | null>;
  after_data: ColumnType<unknown, string | null, string | null>;
  ip_address: string | null;
  actor_name: string | null;
  created_at: CreatedTimestamp;
}

export interface IdentitySettingsTable {
  key: string;
  value: ColumnType<unknown, string, string>;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export interface OneTimeCodesTable {
  id: Generated<string>;
  user_id: string;
  phone: string;
  purpose: string;
  code_hash: string;
  expires_at: Date;
  attempt_count: Generated<number>;
  used_at: Date | null;
  created_at: CreatedTimestamp;
}

// Giá trị băm các mật khẩu người dùng đã tự đặt, để không cho dùng lại mật khẩu gần đây (DT-16 phần 16c)
export interface PasswordHistoryTable {
  id: Generated<string>;
  user_id: string;
  password_hash: string;
  created_at: CreatedTimestamp;
}

export type ApiClientScope = 'reports' | 'finance' | 'children' | 'staff';

export interface ApiClientsTable {
  id: Generated<string>;
  name: string;
  partner_type: string;
  scopes: ColumnType<ApiClientScope[], string, string>;
  legal_basis: string | null;
  key_prefix: string;
  key_hash: string;
  allowed_ips: ColumnType<string[], string, string>;
  valid_until: string;
  status: Generated<'active' | 'revoked'>;
  created_by: string;
  created_at: CreatedTimestamp;
  revoked_by: string | null;
  revoked_at: Date | null;
  last_used_at: Date | null;
}
// Phạm vi cấp học của người dùng (DT-19 phần 19a): không có dòng nào là mọi cấp
// Ưu tiên của người dùng (DT-19 phần 19c): cấp học đang làm việc, trống là mọi cấp
export interface UserPreferencesTable {
  user_id: string;
  working_school_level: string | null;
  updated_at: UpdatedTimestamp;
}

export interface UserSchoolLevelsTable {
  user_id: string;
  school_level: string;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

// Xác thực hai lớp tuỳ chọn của người dùng trường (DT-SaaS phần S8b, YCTD-201)
export interface UserTotpTable {
  id: Generated<string>;
  user_id: string;
  secret_encrypted: string;
  confirmed_at: Date | null;
  last_step: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UserRecoveryCodesTable {
  id: Generated<string>;
  user_id: string;
  code_hash: string;
  used_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface IdentityDatabase {
  users: UsersTable;
  user_totp: UserTotpTable;
  user_recovery_codes: UserRecoveryCodesTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  role_workspace_exclusions: RoleWorkspaceExclusionsTable;
  user_roles: UserRolesTable;
  sessions: SessionsTable;
  impersonations: ImpersonationsTable;
  security_events: SecurityEventsTable;
  identity_audit_logs: IdentityAuditLogsTable;
  identity_settings: IdentitySettingsTable;
  one_time_codes: OneTimeCodesTable;
  api_clients: ApiClientsTable;
  password_history: PasswordHistoryTable;
  user_school_levels: UserSchoolLevelsTable;
  user_preferences: UserPreferencesTable;
}

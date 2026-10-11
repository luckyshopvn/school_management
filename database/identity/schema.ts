import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu định danh, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;

export type UserStatus = 'active' | 'locked';
export type SessionChannel = 'portal' | 'teacher' | 'parent';
export type LoginMethod = 'password' | 'one_time_code';

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
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface RolesTable {
  id: Generated<string>;
  code: string;
  name: string;
  is_system: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
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
export interface IdentityDatabase {
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  sessions: SessionsTable;
  security_events: SecurityEventsTable;
  identity_audit_logs: IdentityAuditLogsTable;
  identity_settings: IdentitySettingsTable;
  one_time_codes: OneTimeCodesTable;
  api_clients: ApiClientsTable;
}

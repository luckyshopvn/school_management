import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu định danh, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;

export type UserStatus = 'active' | 'locked';
export type SessionChannel = 'portal' | 'teacher' | 'parent';

export interface UsersTable {
  id: Generated<string>;
  full_name: string;
  phone: string | null;
  username: string | null;
  password_hash: string;
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
}

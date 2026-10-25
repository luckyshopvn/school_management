import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu nền tảng, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;

export type SchoolStatusValue =
  'provisioning' | 'trial' | 'active' | 'read_only' | 'suspended' | 'pending_deletion' | 'deleted';
export type SchoolDataClassValue = 'synthetic' | 'consented' | 'production';
export type SchoolDomainKind = 'system' | 'custom';
export type SchoolDomainStatus = 'pending' | 'verified' | 'active' | 'disabled';
export type SchoolDatabaseKind = 'identity' | 'system' | 'school-year';
export type SchoolDatabaseLayoutValue = 'database' | 'schema';
export type SchoolDatabaseStatus = 'active' | 'read_only' | 'dropped';
export type PlatformOperatorStatus = 'active' | 'locked';
export type PlatformAuditActorType = 'operator' | 'system' | 'cli';

export interface SchoolClustersTable {
  id: Generated<string>;
  name: string;
  host: string;
  port: Generated<number>;
  role: Generated<'primary' | 'replica'>;
  created_at: CreatedTimestamp;
}

export interface SchoolsTable {
  id: Generated<string>;
  code: string;
  name: string;
  status: Generated<SchoolStatusValue>;
  data_class: Generated<SchoolDataClassValue>;
  cluster_id: string | null;
  key_prefix: Generated<string>;
  year_database_prefix: string;
  legacy: Generated<boolean>;
  notes: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolDomainsTable {
  id: Generated<string>;
  school_id: string;
  host: string;
  kind: Generated<SchoolDomainKind>;
  status: Generated<SchoolDomainStatus>;
  verified_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolDatabasesTable {
  id: Generated<string>;
  school_id: string;
  kind: SchoolDatabaseKind;
  name: string;
  layout: Generated<SchoolDatabaseLayoutValue>;
  host: string;
  port: Generated<number>;
  database_name: string;
  schema_name: string | null;
  role_name: string;
  password_encrypted: string;
  status: Generated<SchoolDatabaseStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolKeysTable {
  school_id: string;
  child_encryption_key_encrypted: string;
  child_hash_key_encrypted: string;
  wrapped_with: Generated<string>;
  created_at: CreatedTimestamp;
  rotated_at: Date | null;
}

export interface PlatformSettingsTable {
  key: string;
  value: ColumnType<unknown, string, string>;
  updated_at: UpdatedTimestamp;
}

export interface PlatformOperatorsTable {
  id: Generated<string>;
  login: string;
  full_name: string;
  password_hash: string;
  status: Generated<PlatformOperatorStatus>;
  failed_login_count: Generated<number>;
  locked_until: Date | null;
  last_login_at: Date | null;
  must_change_password: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PlatformAuditLogTable {
  id: Generated<string>;
  at: ColumnType<Date, Date | undefined, never>;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  action: string;
  school_id: string | null;
  details: ColumnType<unknown, string | undefined, never>;
  ip_address: string | null;
}

export interface PlatformDatabase {
  school_clusters: SchoolClustersTable;
  schools: SchoolsTable;
  school_domains: SchoolDomainsTable;
  school_databases: SchoolDatabasesTable;
  school_keys: SchoolKeysTable;
  platform_settings: PlatformSettingsTable;
  platform_operators: PlatformOperatorsTable;
  platform_audit_log: PlatformAuditLogTable;
}

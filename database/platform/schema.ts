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
  // Gói dịch vụ (S5a): hạn dùng thử, hạn đã trả phí, thời điểm đổi trạng thái
  trial_ends_on: ColumnType<string | null, string | null | undefined, string | null>;
  paid_until: ColumnType<string | null, string | null | undefined, string | null>;
  status_changed_at: Date | null;
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

// Gói dịch vụ và gán gói cho trường (DT-SaaS phần S5a)
export type PlanPricingModeValue = 'per_student' | 'per_school' | 'per_module';
export type PlanBillingCycleValue = 'monthly' | 'term' | 'yearly';

export interface PlansTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  // Mảng mã phân hệ; null là mọi phân hệ
  modules: ColumnType<string[] | null, string | null | undefined, string | null>;
  max_active_students: number | null;
  max_storage_mb: number | null;
  max_school_levels: number | null;
  trial_days: Generated<number>;
  pricing_mode: Generated<PlanPricingModeValue>;
  unit_price: ColumnType<string, number | undefined, number>;
  minimum_fee: ColumnType<string, number | undefined, number>;
  module_prices: ColumnType<Record<string, number>, string | undefined, string>;
  billing_cycle: Generated<PlanBillingCycleValue>;
  status: Generated<'active' | 'archived'>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolPlansTable {
  id: Generated<string>;
  school_id: string;
  plan_id: string;
  effective_from: ColumnType<string, string, string>;
  effective_to: ColumnType<string | null, string | null | undefined, string | null>;
  assigned_by: string | null;
  note: string | null;
  created_at: CreatedTimestamp;
}

export interface SchedulerStateTable {
  school_id: string;
  job: string;
  last_run_at: Date;
  run_count: ColumnType<string, number | undefined, number | undefined>;
  last_status: 'ok' | 'error' | null;
  last_duration_ms: number | null;
  last_error: string | null;
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
  plans: PlansTable;
  school_plans: SchoolPlansTable;
  scheduler_state: SchedulerStateTable;
}

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
  // Bước setup và vòng đời (DT-SaaS phần S2)
  address: string | null;
  school_levels: ColumnType<string[], string | undefined, string>;
  first_academic_year: string | null;
  suspended_at: Date | null;
  deletion_requested_at: Date | null;
  delete_after: Date | null;
  deleted_at: Date | null;
  deletion_record: ColumnType<unknown, string | null | undefined, string | null>;
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
  provider: Generated<string>;
  verification_token: string | null;
  cname_target: string | null;
  last_checked_at: Date | null;
  check_error: string | null;
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
  // Tên đăng nhập qua bộ gom kết nối của nhà cung cấp khi khác tên vai trò (S9); trống là tên vai trò
  login_name: string | null;
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

// Khởi tạo, vòng đời, hồ sơ đồng ý (DT-SaaS phần S2, YCTD-193)
export type ProvisioningJobKind = 'provision' | 'purge';
export type ProvisioningJobStatus = 'pending' | 'running' | 'failed' | 'done' | 'rolled_back';
export type SchoolConsentKind = 'dpa' | 'consent' | 'impact-assessment' | 'risk-acceptance';
type JsonColumn<T> = ColumnType<T, string | undefined, string>;

export interface ProvisioningJobsTable {
  id: Generated<string>;
  school_id: string | null;
  school_code: string;
  kind: ProvisioningJobKind;
  status: Generated<ProvisioningJobStatus>;
  current_step: string | null;
  completed_steps: JsonColumn<string[]>;
  input: JsonColumn<Record<string, unknown>>;
  error: string | null;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  finished_at: Date | null;
}

export interface SchoolLifecycleEventsTable {
  id: Generated<string>;
  school_id: string;
  event: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  at: ColumnType<Date, Date | undefined, never>;
}

export interface SchoolAdminInvitationsTable {
  id: Generated<string>;
  school_id: string;
  user_id: string;
  login: string;
  full_name: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface SchoolMigrationsTable {
  id: Generated<string>;
  school_id: string;
  wave_id: string;
  database_kind: string;
  database_name: string;
  status: 'done' | 'failed' | 'skipped';
  applied: JsonColumn<string[]>;
  error: string | null;
  canary: Generated<boolean>;
  at: ColumnType<Date, Date | undefined, never>;
}

export interface SchoolConsentsTable {
  id: Generated<string>;
  school_id: string;
  kind: SchoolConsentKind;
  template_code: string;
  template_version: string;
  signer_name: string;
  signer_title: string;
  signed_on: ColumnType<string, string, string>;
  valid_from: ColumnType<string, string, string>;
  valid_until: ColumnType<string | null, string | null | undefined, string | null>;
  data_scope: string;
  hosting_snapshot: JsonColumn<unknown[]>;
  file_sha256: string;
  file_key: string | null;
  file_name: string | null;
  submitted_to_authority_on: ColumnType<string | null, string | null | undefined, string | null>;
  authority_reference: string | null;
  recorded_by: string | null;
  recorded_by_name: string;
  withdrawn_on: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: CreatedTimestamp;
}

export interface SchoolHostingTable {
  id: Generated<string>;
  school_id: string;
  provider: string;
  service: string;
  region: string;
  role: Generated<'subprocessor' | 'transit'>;
  stores_personal_data: Generated<boolean>;
  started_on: ColumnType<string, string, string>;
  ended_on: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: CreatedTimestamp;
}

// Nhật ký đổi khóa mã hóa dữ liệu trẻ (DT-SaaS phần S3, YCTD-195)
export interface SchoolKeyRotationsTable {
  id: Generated<string>;
  school_id: string;
  status: Generated<'running' | 'completed' | 'failed'>;
  new_encryption_key_encrypted: string;
  new_hash_key_encrypted: string;
  progress: ColumnType<Record<string, string>, string | undefined, string>;
  rows_done: ColumnType<string, number | string | undefined, number | string>;
  started_by: string;
  started_at: CreatedTimestamp;
  finished_at: Date | null;
  error: string | null;
}

// Xác thực hai lớp của tài khoản vận hành nền tảng (DT-SaaS phần S8b, YCTD-201)
export interface PlatformOperatorTotpTable {
  operator_id: string;
  secret_encrypted: string;
  last_step: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  created_at: CreatedTimestamp;
}

export interface PlatformOperatorRecoveryCodesTable {
  id: Generated<string>;
  operator_id: string;
  code_hash: string;
  used_at: Date | null;
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

// Sao lưu, khôi phục, diễn tập, chuyển cụm theo từng trường (DT-SaaS phần S7b, YCTD-199)
export type BackupRunKind = 'backup' | 'restore' | 'drill' | 'cluster-move';
export type BackupRunStatus = 'running' | 'done' | 'failed';

export interface BackupRunsTable {
  id: Generated<string>;
  school_id: string | null;
  school_code: string;
  kind: BackupRunKind;
  status: Generated<BackupRunStatus>;
  file_name: string | null;
  file_bytes: ColumnType<string | null, number | null | undefined, number | null>;
  file_sha256: string | null;
  databases: number | null;
  tables: number | null;
  rows: ColumnType<string | null, number | null | undefined, number | null>;
  details: ColumnType<Record<string, unknown>, string | undefined, string>;
  error: string | null;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  started_at: ColumnType<Date, Date | undefined, Date>;
  finished_at: Date | null;
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
  provisioning_jobs: ProvisioningJobsTable;
  school_lifecycle_events: SchoolLifecycleEventsTable;
  school_admin_invitations: SchoolAdminInvitationsTable;
  school_migrations: SchoolMigrationsTable;
  school_consents: SchoolConsentsTable;
  school_hosting: SchoolHostingTable;
  scheduler_state: SchedulerStateTable;
  school_key_rotations: SchoolKeyRotationsTable;
  platform_operator_totp: PlatformOperatorTotpTable;
  platform_operator_recovery_codes: PlatformOperatorRecoveryCodesTable;
  backup_runs: BackupRunsTable;
}

import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu nền tảng, khớp với tệp thay đổi cấu trúc
export type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
export type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;

// Bảng của từng phần nằm ở schema-parts/<phần>.ts: mỗi tệp thêm bảng vào PlatformDatabase bằng declare module, không sửa tệp này
// (YCTD-294); schema-parts.generated.ts do database/sinh-chi-muc.mjs sinh khi dựng
export type * from './schema-parts.generated.js';

export type SchoolStatusValue =
  'provisioning' | 'trial' | 'active' | 'read_only' | 'suspended' | 'pending_deletion' | 'deleted';
export type SchoolDataClassValue = 'synthetic' | 'consented' | 'production';
export type SchoolDomainKind = 'system' | 'custom';
export type SchoolDomainStatus = 'pending' | 'verified' | 'active' | 'disabled';
export type SchoolDatabaseKind = 'identity' | 'system' | 'school-year';
export type SchoolDatabaseLayoutValue = 'database' | 'schema';
export type SchoolDatabaseStatus = 'active' | 'read_only' | 'dropped';
export type PlatformOperatorStatus = 'active' | 'locked';
// Vai trò nhân viên vận hành (YCTD-311): quản trị, hỗ trợ, kỹ thuật, kế toán
export type PlatformOperatorRole = 'quan_tri' | 'ho_tro' | 'ky_thuat' | 'ke_toan';
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
  // Nút quản lý ở cây đơn vị hành chính (DT-SaaS phần S6)
  admin_unit_id: ColumnType<string | null, string | null | undefined, string | null>;
  // Mã Bộ của đơn vị trong danh mục toàn quốc (DT-24)
  moet_code: ColumnType<string | null, string | null | undefined, string | null>;
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
  role: Generated<PlatformOperatorRole>;
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
  // Hạn mức AI mỗi tháng (DT-23 phần 23d); null là không giới hạn, 0 là không dùng AI
  ai_max_requests: number | null;
  ai_max_tokens: number | null;
  // Giới hạn lớp video mỗi tháng và dung lượng bản ghi (DT-27 phần 27a); null là không giới hạn, 0 là không có
  video_max_minutes: ColumnType<number | null, number | null | undefined, number | null>;
  video_max_recording_mb: ColumnType<number | null, number | null | undefined, number | null>;
  trial_days: Generated<number>;
  pricing_mode: Generated<PlanPricingModeValue>;
  unit_price: ColumnType<string, number | undefined, number>;
  minimum_fee: ColumnType<string, number | undefined, number>;
  module_prices: ColumnType<Record<string, number>, string | undefined, string>;
  billing_cycle: Generated<PlanBillingCycleValue>;
  status: Generated<'active' | 'archived'>;
  // Quy tắc tính phí (S5b); trống là tính theo giá niêm yết của gói
  price_rule_id: string | null;
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

// Thu phí tự động (DT-SaaS phần S5b)
export type PriceComponent = 'per_student' | 'per_school' | 'per_module';
export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';
export type ServiceInvoiceStatus = 'issued' | 'paid' | 'void';
export type InvoiceLineKind = PriceComponent | 'minimum' | 'discount' | 'ai';
export interface StudentTier {
  up_to: number | null;
  unit_price: number;
}
type Money = ColumnType<string, number | undefined, number>;

export interface PriceRulesTable {
  id: Generated<string>;
  code: string;
  name: string;
  components: ColumnType<PriceComponent[], string | undefined, string>;
  student_tiers: ColumnType<StudentTier[], string | undefined, string>;
  tier_mode: Generated<'graduated' | 'volume'>;
  school_fee: Money;
  module_prices: ColumnType<Record<string, number>, string | undefined, string>;
  minimum_fee: Money;
  period: Generated<BillingPeriod>;
  vat_percent: Generated<number>;
  due_days: Generated<number>;
  status: Generated<'active' | 'archived'>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UsageSnapshotsTable {
  id: Generated<string>;
  school_id: string;
  period_start: ColumnType<string, string, string>;
  period_end: ColumnType<string, string, string>;
  active_students: number;
  storage_mb: Generated<number>;
  school_levels: Generated<number>;
  modules: ColumnType<string[] | null, string | null | undefined, string | null>;
  source: Generated<'scheduler' | 'operator'>;
  taken_at: ColumnType<Date, Date | undefined, Date>;
}

export interface InvoicesTable {
  id: Generated<string>;
  school_id: string;
  code: string;
  payment_content: string;
  kind: Generated<'period' | 'manual'>;
  period_start: ColumnType<string, string, string>;
  period_end: ColumnType<string, string, string>;
  plan_id: string | null;
  plan_code: string | null;
  price_rule: ColumnType<unknown, string, string>;
  usage: ColumnType<unknown, string, string>;
  subtotal: Money;
  discount_total: Money;
  vat_percent: Generated<number>;
  vat_amount: Money;
  total: Money;
  amount_paid: Money;
  status: Generated<ServiceInvoiceStatus>;
  issued_at: ColumnType<Date, Date | undefined, Date>;
  due_on: ColumnType<string, string, string>;
  paid_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  last_payment_request: ColumnType<unknown, string | null | undefined, string | null>;
  created_by: string;
  note: string | null;
  updated_at: UpdatedTimestamp;
}

export interface InvoiceLinesTable {
  id: Generated<string>;
  invoice_id: string;
  sort: number;
  kind: InvoiceLineKind;
  description: string;
  quantity: Generated<number>;
  unit_price: Money;
  amount: Money;
}

export interface InvoicePaymentsTable {
  id: Generated<string>;
  invoice_id: string | null;
  school_id: string | null;
  provider: string;
  provider_reference: string;
  amount: Money;
  transfer_content: Generated<string>;
  received_at: Date;
  status: 'matched' | 'unmatched';
  recorded_by: string | null;
  note: string | null;
  created_at: CreatedTimestamp;
}

export interface BillingAdjustmentsTable {
  id: Generated<string>;
  school_id: string;
  invoice_id: string | null;
  kind: 'discount' | 'free_period' | 'manual_payment' | 'void' | 'assign_payment';
  amount: Money;
  months: Generated<number>;
  reason: string;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  created_at: CreatedTimestamp;
}

export interface EinvoiceDocumentsTable {
  id: Generated<string>;
  invoice_id: string;
  provider: string;
  status: 'issued' | 'cancelled' | 'failed';
  external_id: string | null;
  lookup_code: string | null;
  error: string | null;
  issued_at: Date | null;
  cancelled_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface DunningEventsTable {
  id: Generated<string>;
  school_id: string;
  invoice_id: string | null;
  due_on: ColumnType<string, string, string>;
  kind: 'before_due' | 'overdue' | 'read_only' | 'suspended' | 'reopened';
  days: Generated<number>;
  channels: ColumnType<string[], string | undefined, string>;
  created_at: CreatedTimestamp;
}

export interface PlatformIntegrationSecretsTable {
  connector: string;
  enabled: Generated<boolean>;
  values_encrypted: string;
  hints: ColumnType<Record<string, string>, string | undefined, string>;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

// Trợ lý AI (DT-23 phần 23d, YCTD-214)
export interface AiTokenUsageTable {
  school_id: string;
  usage_date: ColumnType<string, string, string>;
  model: string;
  config: 'school' | 'platform';
  requests: Generated<number>;
  input_tokens: ColumnType<string, number | string | undefined, number | string>;
  output_tokens: ColumnType<string, number | string | undefined, number | string>;
  updated_at: UpdatedTimestamp;
}

export interface PlanAiPricingTable {
  plan_id: string;
  free_tokens: ColumnType<string, number | undefined, number>;
  input_price_per_1k: ColumnType<string | null, number | null | undefined, number | null>;
  output_price_per_1k: ColumnType<string | null, number | null | undefined, number | null>;
  model_prices: ColumnType<Record<string, { input: number; output: number }>, string | undefined, string>;
  minimum_fee: ColumnType<string, number | undefined, number>;
  rounding_step: Generated<number>;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197)
export type SupportScope = 'read' | 'full';
export type MaintenanceSeverity = 'info' | 'warning' | 'critical';

export interface SchoolMetricsTable {
  id: Generated<string>;
  school_id: string;
  captured_at: ColumnType<Date, Date | undefined, Date>;
  users_total: number;
  users_active: number;
  active_students: number | null;
  storage_mb: ColumnType<string | null, number | null | undefined, number | null>;
  database_mb: ColumnType<string | null, number | null | undefined, number | null>;
  last_login_at: Date | null;
  schema_versions: ColumnType<Record<string, string | null>, string | undefined, string>;
  schema_current: Generated<boolean>;
}

export interface SchoolErrorCountsTable {
  id: Generated<string>;
  school_id: string | null;
  service: 'api' | 'identity';
  bucket: Date;
  route: string;
  status: number;
  count: Generated<number>;
  last_code: string | null;
  last_at: ColumnType<Date, Date | undefined, Date>;
}

export interface MaintenanceNoticesTable {
  id: Generated<string>;
  title: string;
  body: string;
  severity: Generated<MaintenanceSeverity>;
  starts_at: Date;
  ends_at: Date;
  audience: Generated<'all' | 'schools'>;
  school_codes: ColumnType<string[], string | undefined, string>;
  created_by: string | null;
  created_by_name: string;
  created_at: CreatedTimestamp;
  cancelled_at: Date | null;
}

export interface SupportSessionsTable {
  id: Generated<string>;
  school_id: string;
  operator_id: string;
  operator_name: string;
  // Cho phép hỗ trợ của trường (S4); phiên xem chi tiết của cấp trên (S6) không có, đi theo access_request_id
  grant_id: string | null;
  requester_kind: Generated<SupportRequesterKind>;
  access_request_id: string | null;
  scope: SupportScope;
  reason: string;
  handoff_token_hash: string;
  handoff_expires_at: Date;
  identity_session_id: string | null;
  expires_at: Date;
  created_at: CreatedTimestamp;
  started_at: Date | null;
  ended_at: Date | null;
  end_reason: string | null;
  // Căn cứ mở phiên (DT-24): trường cho phép, chính sách nền tảng hoặc đề nghị đã duyệt của cấp trên
  access_basis: Generated<SupportAccessBasis>;
}

export interface SupportSessionActionsTable {
  id: Generated<string>;
  support_session_id: string;
  service: 'api' | 'identity';
  method: string;
  route: string;
  status: number;
  at: ColumnType<Date, Date | undefined, Date>;
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

// Đơn vị cấp trên (DT-SaaS phần S6, YCTD-202)
export type AdminUnitLevel = 'ministry' | 'department' | 'commune';
export type AggregateCategory = 'scale' | 'attendance' | 'learning' | 'facilities' | 'staff' | 'emis';
export type SupportRequesterKind = 'operator' | 'parent_org';

export interface AdminUnitsTable {
  id: Generated<string>;
  level: AdminUnitLevel;
  code: string;
  name: string;
  parent_id: string | null;
  status: Generated<'active' | 'inactive' | 'merged'>;
  merged_into_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ParentOrgUsersTable {
  id: Generated<string>;
  login: string;
  full_name: string;
  password_hash: string;
  admin_unit_id: string;
  status: Generated<'active' | 'locked'>;
  failed_login_count: Generated<number>;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ParentOrgUserTotpTable {
  user_id: string;
  secret_encrypted: string;
  last_step: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  created_at: CreatedTimestamp;
}

export interface ParentOrgUserRecoveryCodesTable {
  id: Generated<string>;
  user_id: string;
  code_hash: string;
  used_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface SchoolAggregateConsentsTable {
  id: Generated<string>;
  school_id: string;
  level: AdminUnitLevel;
  category: AggregateCategory;
  granted_at: ColumnType<Date, Date | undefined, Date>;
  granted_by_user_id: string;
  granted_by_name: string;
  revoked_at: Date | null;
  revoked_by_name: string | null;
}

export interface AggregateSnapshotsTable {
  id: Generated<string>;
  school_id: string;
  category: AggregateCategory;
  academic_year: string | null;
  metrics: ColumnType<Record<string, unknown>, string, string>;
  captured_at: ColumnType<Date, Date | undefined, Date>;
}

export interface ParentOrgAccessRequestsTable {
  id: Generated<string>;
  school_id: string;
  user_id: string;
  user_name: string;
  unit_name: string;
  categories: ColumnType<AggregateCategory[], string, string>;
  reason: string;
  hours: number;
  status: Generated<'pending' | 'approved' | 'rejected' | 'revoked'>;
  decided_at: Date | null;
  decided_by_name: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: CreatedTimestamp;
}

// Danh mục đơn vị giáo dục toàn quốc (DT-24, YCTD-220)
export type SupportAccessBasis = 'school_grant' | 'platform_policy' | 'access_request';
export type CatalogEntryStatus = 'active' | 'inactive';

export interface CatalogDepartmentsTable {
  code: string;
  name: string;
  status: Generated<CatalogEntryStatus>;
  updated_at: UpdatedTimestamp;
}

export interface CatalogLevelsTable {
  code: string;
  moet_code: string;
  name: string;
  sort: number;
}

export interface CatalogCommunesTable {
  code: string;
  department_code: string;
  name: string;
  name_search: string;
  status: Generated<CatalogEntryStatus>;
  updated_at: UpdatedTimestamp;
}

export interface CatalogUnitsTable {
  id: Generated<string>;
  moet_code: string;
  name: string;
  name_search: string;
  department_code: string;
  commune_code: string | null;
  commune_name_raw: string | null;
  school_year: string | null;
  source: string;
  status: Generated<CatalogEntryStatus>;
  quality_flags: ColumnType<string[], string[] | undefined, string[]>;
  first_seen_at: CreatedTimestamp;
  last_seen_at: ColumnType<Date, Date | undefined, Date>;
  updated_at: UpdatedTimestamp;
}

export interface CatalogUnitLevelsTable {
  unit_id: string;
  level_code: string;
}

export interface CatalogImportRunsTable {
  id: Generated<string>;
  source: string;
  file_name: string | null;
  dry_run: Generated<boolean>;
  totals: ColumnType<Record<string, number>, string, string>;
  skipped: ColumnType<Array<{ line: number; reason: string; code?: string }>, string | undefined, string>;
  actor_type: PlatformAuditActorType;
  actor_id: string | null;
  actor_name: string;
  started_at: ColumnType<Date, Date | undefined, Date>;
  finished_at: Date | null;
}

// Khóa VAPID của nền tảng (DT-26 phần 26b, YCTD-232)
export interface PlatformPushKeysTable {
  id: Generated<string>;
  public_key: string;
  private_key_encrypted: string;
  subject: string;
  created_at: CreatedTimestamp;
  retired_at: Date | null;
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
  price_rules: PriceRulesTable;
  usage_snapshots: UsageSnapshotsTable;
  invoices: InvoicesTable;
  invoice_lines: InvoiceLinesTable;
  invoice_payments: InvoicePaymentsTable;
  billing_adjustments: BillingAdjustmentsTable;
  einvoice_documents: EinvoiceDocumentsTable;
  dunning_events: DunningEventsTable;
  platform_integration_secrets: PlatformIntegrationSecretsTable;
  ai_token_usage: AiTokenUsageTable;
  plan_ai_pricing: PlanAiPricingTable;
  school_metrics: SchoolMetricsTable;
  school_error_counts: SchoolErrorCountsTable;
  maintenance_notices: MaintenanceNoticesTable;
  support_sessions: SupportSessionsTable;
  support_session_actions: SupportSessionActionsTable;
  platform_operator_totp: PlatformOperatorTotpTable;
  platform_operator_recovery_codes: PlatformOperatorRecoveryCodesTable;
  backup_runs: BackupRunsTable;
  admin_units: AdminUnitsTable;
  parent_org_users: ParentOrgUsersTable;
  parent_org_user_totp: ParentOrgUserTotpTable;
  parent_org_user_recovery_codes: ParentOrgUserRecoveryCodesTable;
  school_aggregate_consents: SchoolAggregateConsentsTable;
  aggregate_snapshots: AggregateSnapshotsTable;
  parent_org_access_requests: ParentOrgAccessRequestsTable;
  catalog_departments: CatalogDepartmentsTable;
  catalog_levels: CatalogLevelsTable;
  catalog_communes: CatalogCommunesTable;
  catalog_units: CatalogUnitsTable;
  catalog_unit_levels: CatalogUnitLevelsTable;
  catalog_import_runs: CatalogImportRunsTable;
  platform_push_keys: PlatformPushKeysTable;
}

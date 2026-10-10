import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu năm học, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;
type JsonValue = ColumnType<unknown, string | null, string | null>;

export type OrgUnitType = 'truong_chinh' | 'phan_hieu' | 'diem_truong';
export type OrgUnitStatus = 'active' | 'inactive';

export interface OrgUnitsTable {
  id: Generated<string>;
  code: string;
  name: string;
  unit_type: OrgUnitType;
  parent_id: string | null;
  address: string | null;
  phone: string | null;
  manager_user_id: string | null;
  status: Generated<OrgUnitStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface AuditLogsTable {
  id: Generated<string>;
  actor_user_id: string;
  org_unit_id: string | null;
  entity_name: string;
  entity_id: string;
  action: string;
  before_data: JsonValue;
  after_data: JsonValue;
  ip_address: string | null;
  actor_name: string | null;
  created_at: CreatedTimestamp;
}

export interface SettingsTable {
  id: Generated<string>;
  org_unit_id: string;
  key: string;
  value: ColumnType<unknown, string, string>;
  value_type: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export type CatalogStatus = 'active' | 'inactive';

interface CatalogRecordColumns {
  id: Generated<string>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface DepartmentsTable extends CatalogRecordColumns {
  org_unit_id: string;
  parent_id: string | null;
  name: string;
  status: Generated<CatalogStatus>;
}

export interface JobTitlesTable extends CatalogRecordColumns {
  org_unit_id: string;
  name: string;
  level: string | null;
  status: Generated<CatalogStatus>;
}

export interface CatalogItemsTable extends CatalogRecordColumns {
  catalog_type: string;
  code: string;
  name: string;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
}

export type ApprovalThresholdStatus = 'active' | 'expired';

export interface ApprovalThresholdsTable extends CatalogRecordColumns {
  org_unit_id: string;
  document_type: string;
  // Kiểu numeric được đọc ra dạng chuỗi để không mất chính xác
  threshold_amount: ColumnType<string, string | number, string | number>;
  effective_from: string;
  status: Generated<ApprovalThresholdStatus>;
  updated_by: string | null;
}

export interface RoomsTable extends CatalogRecordColumns {
  org_unit_id: string;
  code: string;
  name: string;
  capacity: number;
  status: Generated<CatalogStatus>;
}

export interface GradeLevelsTable extends CatalogRecordColumns {
  code: string;
  name: string;
  age_from_months: number;
  age_to_months: number;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
}

export type ClassStatus = 'active' | 'closed';

export interface ClassesTable extends CatalogRecordColumns {
  org_unit_id: string;
  academic_year_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
  status: Generated<ClassStatus>;
}

export type AssignmentRole = 'homeroom' | 'subject';
export type AssignmentStatus = 'active' | 'ended';

export interface ClassStaffAssignmentsTable extends CatalogRecordColumns {
  class_id: string;
  staff_user_id: string;
  staff_name: string;
  assignment_role: AssignmentRole;
  subject_name: string | null;
  from_date: string;
  to_date: string | null;
  status: Generated<AssignmentStatus>;
}

export type FilePurpose = 'birth_certificate' | 'photo_consent' | 'import' | 'pickup_photo' | 'payment_voucher';

export interface FilesTable extends CatalogRecordColumns {
  org_unit_id: string | null;
  purpose: FilePurpose;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
}

export type ChildStatus = 'draft' | 'pending' | 'active' | 'paused' | 'withdrawn' | 'graduated';
export type ChildGender = 'male' | 'female';
export type PhotoConsent = 'pending' | 'granted' | 'refused';
export type PhotoConsentMethod = 'paper' | 'app';

export interface ChildrenTable extends CatalogRecordColumns {
  org_unit_id: string;
  full_name: string;
  dob: string;
  gender: ChildGender;
  place_of_birth: string | null;
  address: string | null;
  national_id_encrypted: string;
  national_id_hash: string;
  national_id_last4: string;
  moet_student_code: string | null;
  birth_certificate_file_id: string | null;
  status: Generated<ChildStatus>;
  is_staff_child: Generated<boolean>;
  related_staff_user_id: string | null;
  related_staff_name: string | null;
  special_needs_note: string | null;
  photo_consent: PhotoConsent;
  photo_consent_method: PhotoConsentMethod | null;
  photo_consent_by: string | null;
  photo_consent_at: Date | null;
  photo_consent_file_id: string | null;
  enroll_date: string | null;
  leave_date: string | null;
  leave_reason: string | null;
  note: string | null;
  reject_reason: string | null;
  submitted_by: string | null;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
}

export interface HealthProfilesTable extends CatalogRecordColumns {
  child_id: string;
  blood_type: string | null;
  has_allergies: boolean | null;
  allergies: string | null;
  chronic_conditions: string | null;
  note: string | null;
}

export interface GuardiansTable extends CatalogRecordColumns {
  full_name: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  user_id: string | null;
}

export interface ChildGuardiansTable extends CatalogRecordColumns {
  child_id: string;
  guardian_id: string;
  relationship_item_id: string;
  is_primary: Generated<boolean>;
  can_pickup: Generated<boolean>;
}

export interface ClassEnrollmentsTable extends CatalogRecordColumns {
  child_id: string;
  class_id: string;
  from_date: string;
  to_date: string | null;
  reason: string | null;
  is_current: Generated<boolean>;
}

export interface PhotoConsentHistoriesTable {
  id: Generated<string>;
  child_id: string;
  action: PhotoConsent;
  method: PhotoConsentMethod | null;
  file_id: string | null;
  actor_user_id: string;
  created_at: CreatedTimestamp;
}

export interface DataAccessLogsTable {
  id: Generated<string>;
  actor_user_id: string | null;
  actor_name: string | null;
  api_client_id: string | null;
  org_unit_id: string | null;
  entity_name: string;
  entity_id: string;
  scope: string;
  record_count: Generated<number>;
  purpose: string | null;
  ip_address: string | null;
  created_at: CreatedTimestamp;
}

export interface NotificationsTable {
  id: Generated<string>;
  org_unit_id: string | null;
  template_code: string;
  title: string;
  body: string;
  target_type: string;
  target_id: string;
  created_at: CreatedTimestamp;
}

export interface NotificationRecipientsTable {
  id: Generated<string>;
  notification_id: string;
  user_id: string | null;
  role_code: string | null;
  org_unit_id: string | null;
  channel: 'in_app' | 'sms';
  is_read: Generated<boolean>;
  read_at: Date | null;
  channel_status: Generated<'pending' | 'sent' | 'failed'>;
  sent_at: Date | null;
}

export type ImportType = 'classes' | 'children' | 'moet_codes' | 'opening_debts';
export type ImportStatus = 'validated' | 'failed' | 'committed';

export interface DataImportJobsTable {
  id: Generated<string>;
  org_unit_id: string | null;
  import_type: ImportType;
  file_id: string;
  status: ImportStatus;
  total_rows: number;
  error_rows: number;
  errors: ColumnType<unknown, string, string>;
  error_report_file_id: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  committed_by: string | null;
  committed_at: Date | null;
}

export type AttendanceStatus =
  'present' | 'absent_notified' | 'absent_unnotified' | 'late' | 'early_leave' | 'late_and_early_leave';
export type AttendanceSource = 'teacher' | 'manager' | 'parent' | 'system';

export interface AttendanceRecordsTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  org_unit_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
  source: AttendanceSource;
  recorded_by: string;
  recorded_at: Date;
  is_backfilled: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AttendanceDaysTable {
  id: Generated<string>;
  class_id: string;
  attendance_date: string;
  status: 'open' | 'locked';
  locked_by: string | null;
  locked_at: Date | null;
  unlocked_by: string | null;
  unlocked_at: Date | null;
  unlock_reason: string | null;
}

export interface AbsenceRecordsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  absence_date: string;
  reason: string | null;
  is_advised: boolean;
  advised_at: Date;
  source: 'teacher' | 'manager' | 'parent';
  reported_by: string;
  created_at: CreatedTimestamp;
}

export type PickupType = 'handover' | 'gate_check';
export type PickupPersonKind = 'guardian' | 'authorized' | 'parent_confirmed';
export type PickupConfirmationStatus = 'pending' | 'confirmed' | 'refused';

export interface AuthorizedPickupsTable {
  id: Generated<string>;
  child_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  valid_from: string;
  valid_to: string | null;
  status: Generated<'active' | 'revoked'>;
  source: 'parent' | 'staff';
  created_by: string;
  created_at: CreatedTimestamp;
  revoked_by: string | null;
  revoked_at: Date | null;
}

export interface PickupConfirmationRequestsTable {
  id: Generated<string>;
  child_id: string;
  pickup_date: string;
  person_name: string;
  relationship: string;
  phone: string | null;
  status: Generated<PickupConfirmationStatus>;
  requested_by: string;
  requested_at: CreatedTimestamp;
  responded_by: string | null;
  responded_at: Date | null;
}

export interface PickupRecordsTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  org_unit_id: string;
  pickup_date: string;
  pickup_type: PickupType;
  person_kind: PickupPersonKind;
  person_name: string;
  relationship: string;
  phone: string | null;
  guardian_id: string | null;
  authorized_pickup_id: string | null;
  confirmation_request_id: string | null;
  photo_file_id: string | null;
  recorded_by: string;
  recorded_at: Date;
  created_at: CreatedTimestamp;
}

// Số tiền kiểu bigint đọc ra dạng chuỗi để không mất chính xác; đơn vị đồng
type Money = ColumnType<string, string | number, string | number>;
export type ServiceCalculationMethod = 'monthly' | 'per_present_day';
export type FeeType = 'tuition' | 'service';
export type DiscountCalculationMethod = 'percent' | 'amount';
export type CashflowType = 'income' | 'expense';

export interface ServicesTable extends CatalogRecordColumns {
  code: string;
  name: string;
  unit: string;
  calculation_method: ServiceCalculationMethod;
  is_mandatory: Generated<boolean>;
  is_system: Generated<boolean>;
  status: Generated<CatalogStatus>;
}

export interface FeeSchedulesTable extends CatalogRecordColumns {
  name: string;
  effective_from: string;
  effective_to: string | null;
}

export interface FeeScheduleItemsTable {
  id: Generated<string>;
  fee_schedule_id: string;
  grade_level: string;
  fee_type: FeeType;
  service_id: string | null;
  amount: Money;
}

export interface DiscountTypesTable extends CatalogRecordColumns {
  code: string;
  name: string;
  calculation_method: DiscountCalculationMethod;
  value: Money;
  applies_to: ColumnType<string[], string, string>;
  condition_note: string | null;
  status: Generated<CatalogStatus>;
}

export interface CashflowCategoriesTable extends CatalogRecordColumns {
  code: string;
  name: string;
  group_name: string;
  flow_type: CashflowType;
  status: Generated<CatalogStatus>;
}

export type RegistrationStatus = 'active' | 'pending_late' | 'pending_cancel' | 'cancelled' | 'rejected';
export type RegistrationSource = 'parent' | 'staff' | 'system' | 'carried';
export type LateChargeMethod = 'full_month' | 'actual_days';

export interface ServiceRegistrationsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  service_id: string;
  status: RegistrationStatus;
  source: RegistrationSource;
  registered_by: string | null;
  // Đăng ký lại sau khi hủy thì ghi lại thời điểm
  registered_at: UpdatedTimestamp;
  is_late: Generated<boolean>;
  service_start_date: string | null;
  late_charge_method: LateChargeMethod | null;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  cancel_requested_by: string | null;
  cancel_requested_at: Date | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  updated_at: UpdatedTimestamp;
}

export interface RegistrationPeriodsTable {
  id: Generated<string>;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  status: 'open' | 'locked';
  locked_by: string | null;
  locked_at: Date | null;
}

export interface SummerRegistrationsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  status: 'active' | 'cancelled';
  source: 'parent' | 'staff';
  registered_by: string;
  // Đăng ký lại sau khi hủy thì ghi lại thời điểm
  registered_at: UpdatedTimestamp;
  cancelled_by: string | null;
  cancelled_at: Date | null;
}

export type InvoiceKind = 'main' | 'supplementary' | 'opening';
export type InvoiceStatus = 'draft' | 'issued';

export interface FeeCalculationRunsTable {
  id: Generated<string>;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  status: 'running' | 'succeeded' | 'failed';
  started_at: CreatedTimestamp;
  finished_at: Date | null;
  error_detail: string | null;
  child_count: number | null;
  total_amount: ColumnType<string | null, string | number | null, string | number | null>;
  run_by: string;
}

export interface InvoicesTable {
  id: Generated<string>;
  code: string | null;
  child_id: string;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  invoice_kind: InvoiceKind;
  status: InvoiceStatus;
  calculation_run_id: string | null;
  total_amount: Money;
  basis: ColumnType<Record<string, unknown>, string, string>;
  review_flags: ColumnType<string[], string | undefined, string>;
  due_date: string | null;
  issued_at: Date | null;
  issued_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface InvoiceItemsTable {
  id: Generated<string>;
  invoice_id: string;
  item_type: 'tuition' | 'service' | 'opening';
  service_id: string | null;
  service_registration_id: string | null;
  description: string;
  quantity: ColumnType<string, string | number, string | number>;
  unit_price: Money;
  amount: Money;
  basis_note: string | null;
}

export interface DocumentSequencesTable {
  document_type: string;
  last_value: number;
}

export type FeeDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface DiscountsTable {
  id: Generated<string>;
  invoice_id: string;
  child_id: string;
  org_unit_id: string;
  discount_type_id: string;
  basis: string;
  calculation_method: DiscountCalculationMethod;
  rate_value: Money;
  base_amount: Money;
  applied_amount: Money;
  status: FeeDocumentStatus;
  requires_principal: boolean;
  copied_from_id: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export interface InvoiceAdjustmentsTable {
  id: Generated<string>;
  code: string;
  invoice_id: string;
  child_id: string;
  org_unit_id: string;
  reason: string;
  amount: Money;
  status: FeeDocumentStatus;
  requires_principal: boolean;
  created_by: string;
  created_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export type CashAccountType = 'cash' | 'bank';
export type ReceiptMethod = 'cash' | 'transfer' | 'other';
export type ReceiptStatus = 'issued' | 'pending_reversal' | 'reversed';

export interface CashAccountsTable {
  id: Generated<string>;
  org_unit_id: string;
  account_type: CashAccountType;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  opening_balance: Money;
  current_balance: Money;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ReceiptsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  child_id: string;
  payer_name: string;
  amount: Money;
  method: ReceiptMethod;
  account_id: string;
  category_id: string;
  receipt_date: string;
  content: string | null;
  status: Generated<ReceiptStatus>;
  request_key: string;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface ReceiptAllocationsTable {
  id: Generated<string>;
  receipt_id: string;
  invoice_id: string;
  amount: Money;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface AccountTransactionsTable {
  id: Generated<string>;
  account_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: Money;
  balance_after: Money;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: CreatedTimestamp;
}

export interface ReceiptReversalsTable {
  id: Generated<string>;
  code: string;
  receipt_id: string;
  org_unit_id: string;
  child_id: string;
  amount: Money;
  reason: string;
  status: FeeDocumentStatus;
  requires_principal: boolean;
  created_by: string;
  created_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export type PaymentType = 'regular' | 'refund' | 'payroll';
export type PaymentStatus = 'draft' | 'pending' | 'issued' | 'pending_reversal' | 'reversed';

export interface PaymentsTable {
  id: Generated<string>;
  code: string | null;
  org_unit_id: string;
  payment_type: PaymentType;
  child_id: string | null;
  payee_name: string;
  amount: Money;
  content: string;
  account_id: string;
  category_id: string;
  payment_date: string | null;
  status: Generated<PaymentStatus>;
  requires_principal: boolean | null;
  request_key: string;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
}

export interface PaymentAttachmentsTable {
  payment_id: string;
  file_id: string;
}

export interface PaymentRefundSourcesTable {
  id: Generated<string>;
  payment_id: string;
  receipt_id: string;
  amount: Money;
}

export interface SchoolYearDatabase {
  org_units: OrgUnitsTable;
  audit_logs: AuditLogsTable;
  settings: SettingsTable;
  departments: DepartmentsTable;
  job_titles: JobTitlesTable;
  catalog_items: CatalogItemsTable;
  approval_thresholds: ApprovalThresholdsTable;
  rooms: RoomsTable;
  grade_levels: GradeLevelsTable;
  classes: ClassesTable;
  class_staff_assignments: ClassStaffAssignmentsTable;
  files: FilesTable;
  children: ChildrenTable;
  health_profiles: HealthProfilesTable;
  guardians: GuardiansTable;
  child_guardians: ChildGuardiansTable;
  class_enrollments: ClassEnrollmentsTable;
  photo_consent_histories: PhotoConsentHistoriesTable;
  data_access_logs: DataAccessLogsTable;
  notifications: NotificationsTable;
  notification_recipients: NotificationRecipientsTable;
  data_import_jobs: DataImportJobsTable;
  attendance_records: AttendanceRecordsTable;
  attendance_days: AttendanceDaysTable;
  absence_records: AbsenceRecordsTable;
  authorized_pickups: AuthorizedPickupsTable;
  pickup_confirmation_requests: PickupConfirmationRequestsTable;
  pickup_records: PickupRecordsTable;
  services: ServicesTable;
  fee_schedules: FeeSchedulesTable;
  fee_schedule_items: FeeScheduleItemsTable;
  discount_types: DiscountTypesTable;
  cashflow_categories: CashflowCategoriesTable;
  service_registrations: ServiceRegistrationsTable;
  registration_periods: RegistrationPeriodsTable;
  summer_registrations: SummerRegistrationsTable;
  fee_calculation_runs: FeeCalculationRunsTable;
  invoices: InvoicesTable;
  invoice_items: InvoiceItemsTable;
  document_sequences: DocumentSequencesTable;
  discounts: DiscountsTable;
  invoice_adjustments: InvoiceAdjustmentsTable;
  cash_accounts: CashAccountsTable;
  receipts: ReceiptsTable;
  receipt_allocations: ReceiptAllocationsTable;
  account_transactions: AccountTransactionsTable;
  receipt_reversals: ReceiptReversalsTable;
  payments: PaymentsTable;
  payment_attachments: PaymentAttachmentsTable;
  payment_refund_sources: PaymentRefundSourcesTable;
}

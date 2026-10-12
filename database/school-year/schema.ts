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
  attributes: ColumnType<Record<string, unknown>, string | undefined, string>;
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

export type FilePurpose =
  | 'birth_certificate'
  | 'photo_consent'
  | 'import'
  | 'pickup_photo'
  | 'payment_voucher'
  | 'medicine_photo'
  | 'prescription';

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
  channel_status: Generated<'pending' | 'sent' | 'failed' | 'limited'>;
  sent_at: Date | null;
  // Gửi lại khi lỗi (CB-07, YCTD-71)
  attempt_count: Generated<number>;
  next_attempt_at: Date | null;
  last_error: string | null;
}

export type ImportType = 'classes' | 'children' | 'moet_codes' | 'opening_debts' | 'staff';
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
  receives_online_payments: Generated<boolean>;
  online_payment_category_id: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ReceiptsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  child_id: string | null;
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
  staff_id: string | null;
  settlement_id: string | null;
  // Số dư có chuyển từ năm học trước (YCTD-69)
  carried_over: Generated<boolean>;
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
  payroll_id: string | null;
  settlement_id: string | null;
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

export interface PaymentReversalsTable {
  id: Generated<string>;
  code: string;
  payment_id: string;
  org_unit_id: string;
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

export type OnlineMatchStatus = 'matched' | 'wrong_amount' | 'unknown_invoice' | 'already_paid';

export interface PaymentRequestsTable {
  id: Generated<string>;
  invoice_id: string;
  child_id: string;
  org_unit_id: string;
  amount: Money;
  transfer_content: string;
  provider: string;
  provider_reference: string;
  virtual_account_number: string;
  qr_content: string;
  status: Generated<'active' | 'paid' | 'cancelled'>;
  expires_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
  closed_at: Date | null;
}

export interface OnlinePaymentTransactionsTable {
  id: Generated<string>;
  provider: string;
  provider_transaction_ref: string;
  virtual_account_number: string | null;
  amount: Money;
  transfer_content: string;
  received_at: Date;
  match_status: OnlineMatchStatus;
  payment_request_id: string | null;
  invoice_id: string | null;
  child_id: string | null;
  org_unit_id: string | null;
  receipt_id: string | null;
  resolution_note: string | null;
  handled_by: string | null;
  handled_at: Date | null;
  created_at: CreatedTimestamp;
}

export type ContractType = 'probation' | 'fixed_term' | 'indefinite';

export interface StaffTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  id_number_encrypted: string | null;
  id_number_last4: string | null;
  department_id: string | null;
  job_title_id: string | null;
  start_date: string;
  end_date: string | null;
  status: Generated<'active' | 'terminated'>;
  user_id: string | null;
  dependents_count: Generated<number>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmploymentContractsTable {
  id: Generated<string>;
  staff_id: string;
  contract_no: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  base_salary: Money;
  allowances: ColumnType<Array<{ name: string; amount: number }>, string | undefined, string>;
  status: Generated<'active' | 'terminated'>;
  terminated_on: string | null;
  terminate_reason: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface HolidaysTable {
  id: Generated<string>;
  holiday_date: string;
  name: string;
  is_paid: boolean;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type SchoolDayChangeType = 'makeup_school_day' | 'compensatory_day_off';

export interface SchoolDayChangesTable {
  id: Generated<string>;
  change_date: string;
  change_type: SchoolDayChangeType;
  note: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export interface AttendanceLogsTable {
  id: Generated<string>;
  staff_id: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  source: 'self' | 'manual';
  note: string | null;
  updated_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

type Decimal = ColumnType<string, string | number | undefined, string | number>;

export interface LeavePoliciesTable {
  id: Generated<string>;
  job_title_id: string;
  seniority_from_years: number;
  seniority_to_years: number | null;
  entitled_days: Decimal;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LeaveBalancesTable {
  id: Generated<string>;
  staff_id: string;
  balance_year: number;
  entitled_days: Decimal;
  used_days: Decimal;
  policy_id: string | null;
  adjust_reason: string | null;
  updated_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type DayHalf = 'morning' | 'afternoon';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestsTable {
  id: Generated<string>;
  staff_id: string;
  leave_type_id: string;
  is_paid: boolean;
  deducts_annual_leave: boolean;
  insurance_paid: boolean;
  from_date: string;
  to_date: string;
  first_day_half: DayHalf | null;
  last_day_half: DayHalf | null;
  days: Decimal;
  reason: string;
  status: Generated<LeaveRequestStatus>;
  created_by: string;
  requested_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export interface TimesheetPeriodsTable {
  id: Generated<string>;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  status: 'closed' | 'reopened';
  closed_by: string | null;
  closed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type TimesheetDayStatus = 'present' | 'leave' | 'absent' | 'holiday' | 'day_off';

export interface TimesheetDaysTable {
  id: Generated<string>;
  period_id: string;
  staff_id: string;
  work_date: string;
  status: TimesheetDayStatus;
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  overtime_minutes: Generated<number>;
  leave_request_id: string | null;
  leave_days: Decimal;
  absent_days: Decimal;
  unpaid_days: Decimal;
  insurance_days: Decimal;
  note: string | null;
}

export interface TimesheetReopenRequestsTable {
  id: Generated<string>;
  period_id: string;
  reason: string;
  status: Generated<'pending' | 'approved' | 'rejected'>;
  requested_by: string;
  requested_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export type PayItemKind = 'allowance' | 'deduction';
export type PayCalculationMethod = 'fixed_monthly' | 'per_workday' | 'percent_of_base';

export interface PayItemTypesTable {
  id: Generated<string>;
  kind: PayItemKind;
  code: string;
  name: string;
  calculation_method: PayCalculationMethod;
  default_amount: Money | null;
  rate_percent: Decimal | null;
  is_tax_exempt: Generated<boolean>;
  is_mandatory_insurance: Generated<boolean>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface StaffPayItemsTable {
  id: Generated<string>;
  staff_id: string;
  pay_item_type_id: string;
  amount: Money | null;
  rate_percent: Decimal | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export interface TaxBracket {
  up_to: number | null;
  rate_percent: number;
}

export interface TaxTablesTable {
  id: Generated<string>;
  effective_from: string;
  personal_deduction: Money;
  dependent_deduction: Money;
  brackets: ColumnType<TaxBracket[], string, string>;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export type PayrollStatus = 'draft' | 'pending' | 'approved';

export interface PayrollsTable {
  id: Generated<string>;
  period_year: number;
  period_month: number;
  status: Generated<PayrollStatus>;
  total_net: Money;
  requires_principal: Generated<boolean>;
  tax_table_id: string | null;
  skipped: ColumnType<
    Array<{ staff_id: string; org_unit_id: string; full_name: string; reason: string }>,
    string | undefined,
    string
  >;
  calculated_by: string | null;
  calculated_at: Date | null;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  return_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PayslipsTable {
  id: Generated<string>;
  payroll_id: string;
  staff_id: string;
  org_unit_id: string;
  contract_id: string | null;
  prepaid_amount: Money;
  adjustment_amount: Money;
  taxable_income: Money;
  tax_amount: Money;
  net_amount: Money;
}

export type PayslipSection = 'prepaid' | 'adjustment' | 'tax';

export interface PayslipLinesTable {
  id: Generated<string>;
  payslip_id: string;
  section: PayslipSection;
  line_type: string;
  code: string;
  name: string;
  amount: Money;
  basis: string;
  order_no: number;
}

export interface SettlementLine {
  code: string;
  name: string;
  amount: number;
  basis: string;
}

export interface PayrollSettlementsTable {
  id: Generated<string>;
  staff_id: string;
  contract_id: string;
  terminated_on: string;
  status: Generated<PayrollStatus>;
  earned_amount: Money;
  prepaid_amount: Money;
  tax_difference: Money;
  payable_amount: Money;
  lines: ColumnType<SettlementLine[], string, string>;
  requires_principal: Generated<boolean>;
  calculated_by: string | null;
  calculated_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  return_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PayrollAdjustmentsTable {
  id: Generated<string>;
  staff_id: string;
  target_year: number;
  target_month: number;
  amount: Money;
  reason: string;
  status: Generated<'pending' | 'approved' | 'rejected'>;
  requires_principal: boolean;
  created_by: string;
  created_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export interface NotificationReadsTable {
  id: Generated<string>;
  notification_id: string;
  user_id: string;
  read_at: CreatedTimestamp;
}

export interface NotificationTemplatesTable {
  template_code: string;
  title_template: string;
  body_template: string;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export type JournalMood = 'happy' | 'normal' | 'tired' | 'sad' | 'unwell';

export interface DailyJournalsTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  journal_date: string;
  meal_note: string | null;
  sleep_note: string | null;
  hygiene_note: string | null;
  mood: JournalMood | null;
  activity_note: string | null;
  status: Generated<'draft' | 'published'>;
  published_at: Date | null;
  published_by: string | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface JournalAmendmentsTable {
  id: Generated<string>;
  journal_id: string;
  reason: string;
  before_data: ColumnType<unknown, string, string>;
  after_data: ColumnType<unknown, string, string>;
  amended_by: string;
  amended_at: CreatedTimestamp;
}
// Lịch sử chuyển đơn vị của trẻ (P02-07, YCTD-67)
export interface ChildUnitTransfersTable {
  id: Generated<string>;
  child_id: string;
  from_org_unit_id: string;
  to_org_unit_id: string;
  from_class_id: string | null;
  to_class_id: string;
  effective_date: string;
  reason: string;
  created_by: string;
  created_at: CreatedTimestamp;
}

// Lịch nghỉ và lịch công tác (P08-02, YCTD-68)
export type WorkScheduleType = 'business_trip' | 'day_off';

export interface WorkSchedulesTable {
  id: Generated<string>;
  staff_id: string;
  org_unit_id: string;
  schedule_date: string;
  schedule_type: WorkScheduleType;
  note: string | null;
  status: Generated<'draft' | 'published'>;
  published_at: Date | null;
  published_by: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

// Y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc (P10; YCTD-74)
export type HealthIndicator = 'height_cm' | 'weight_kg' | 'bmi';
export type MedicalEventSeverity = 'mild' | 'moderate' | 'severe';
export type HealthReportType = 'growth' | 'medical' | 'full';

export interface HealthMeasurementsTable {
  id: Generated<string>;
  child_id: string;
  measured_on: string;
  height_cm: Decimal | null;
  weight_kg: Decimal | null;
  vision_left: string | null;
  vision_right: string | null;
  note: string | null;
  recorded_by: string;
  created_at: CreatedTimestamp;
}

export interface HealthStandardsTable {
  id: Generated<string>;
  indicator_code: HealthIndicator;
  gender: ChildGender;
  age_month_from: number;
  age_month_to: number;
  lower_value: Decimal;
  upper_value: Decimal;
  source_document: string;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface HealthCheckCampaignsTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  from_date: string;
  to_date: string;
  status: Generated<'open' | 'closed'>;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface HealthCheckSchedulesTable {
  id: Generated<string>;
  campaign_id: string;
  class_id: string;
  check_date: string;
  location: string;
  published_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface HealthCheckResultsTable {
  id: Generated<string>;
  campaign_id: string;
  child_id: string;
  height_cm: Decimal | null;
  weight_kg: Decimal | null;
  result_data: ColumnType<Record<string, unknown>, string | undefined, string>;
  conclusion: string | null;
  note: string | null;
  recorded_by: string;
  recorded_at: UpdatedTimestamp;
  published_at: Date | null;
}

export interface MedicalEventsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  occurred_at: Date;
  symptoms: string;
  handling: string;
  handler_name: string;
  severity: MedicalEventSeverity;
  recorded_by: string;
  notified_guardians_at: Date | null;
  parent_acknowledged_at: Date | null;
  parent_acknowledged_by: string | null;
  created_at: CreatedTimestamp;
}

export interface DailyCareLogsTable {
  id: Generated<string>;
  child_id: string;
  care_date: string;
  recorded_at: Date;
  temperature: Decimal | null;
  condition_note: string | null;
  special_care_note: string | null;
  recorded_by: string;
  created_at: CreatedTimestamp;
}

export interface HealthReportRequestsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  report_type: HealthReportType;
  period_from: string;
  period_to: string;
  note: string | null;
  status: Generated<'pending' | 'sent'>;
  requested_by: string;
  requested_at: CreatedTimestamp;
  report_data: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  response_note: string | null;
  sent_by: string | null;
  sent_at: Date | null;
}

// Thuốc: danh mục, nhà thuốc, dặn thuốc, cho uống thuốc, đề nghị mua, phiếu mua, phiếu cấp (P10-02 đến P10-05, P10-09;
// YCTD-75)
export type MedicationRequestStatus = 'pending' | 'administering' | 'completed' | 'rejected';
export type MedicationAssignedRole = 'nurse' | 'homeroom';
export type MedicinePurchaseRequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered';

export interface PharmaciesTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface MedicinesTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  name: string;
  active_ingredient: string | null;
  unit: string;
  pharmacy_id: string | null;
  stock_qty: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface MedicationRequestsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  class_id: string | null;
  requested_by: string;
  medicine_name: string;
  dosage: string;
  times: string[];
  from_date: string;
  to_date: string;
  allergy_note: string;
  note: string | null;
  medicine_photo_ids: string[];
  prescription_photo_id: string | null;
  assigned_role: MedicationAssignedRole;
  status: Generated<MedicationRequestStatus>;
  received_quantity: string | null;
  received_note: string | null;
  received_by: string | null;
  received_at: Date | null;
  reject_reason: string | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  completed_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface MedicationAdministrationsTable {
  id: Generated<string>;
  request_id: string;
  scheduled_date: string;
  scheduled_time: string;
  administered_at: Date | null;
  administered_by: string;
  dose_note: string | null;
  is_skipped: Generated<boolean>;
  skip_reason: string | null;
  parent_acknowledged_at: Date | null;
  parent_acknowledged_by: string | null;
  created_at: CreatedTimestamp;
}

export interface MedicinePurchaseRequestsTable {
  id: Generated<string>;
  org_unit_id: string;
  medicine_id: string;
  quantity: number;
  estimated_unit_price: Decimal;
  estimated_amount: Decimal;
  reason: string;
  status: Generated<MedicinePurchaseRequestStatus>;
  requires_principal: boolean;
  created_by: string;
  created_at: CreatedTimestamp;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
}

export interface MedicinePurchaseOrdersTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  request_id: string;
  pharmacy_id: string;
  order_date: string;
  total_amount: Decimal;
  status: Generated<'received'>;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface MedicinePurchaseOrderItemsTable {
  id: Generated<string>;
  order_id: string;
  medicine_id: string;
  quantity: number;
  unit_price: Decimal;
  amount: Decimal;
  received_qty: number;
}

export interface MedicineIssuesTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  medicine_id: string;
  quantity: number;
  recipient: string;
  reason: string;
  issued_by: string;
  issued_at: CreatedTimestamp;
}

// Kho, tài sản và mua hàng (P13; YCTD-77)
export type AssetLocationType = 'store' | 'room' | 'class' | 'staff' | 'unit';
export type AssetStatus = 'in_stock' | 'assigned' | 'on_loan' | 'damaged' | 'lost' | 'disposed';
export type StockTransactionType = 'opening' | 'receipt' | 'issue' | 'count_adjustment' | 'carry_over';
export type StockCountStatus = 'matched' | 'pending' | 'approved' | 'rejected';
export type PurchaseRequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered';

export interface SuppliersTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  tax_code: string | null;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AssetsTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  original_cost: Money;
  purchase_date: string;
  location_type: Generated<AssetLocationType>;
  location_id: string | null;
  location_name: string | null;
  status: Generated<AssetStatus>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AssetAssignmentsTable {
  id: Generated<string>;
  code: string;
  asset_id: string;
  assigned_to_type: Exclude<AssetLocationType, 'store'>;
  assigned_to_id: string | null;
  assigned_to_name: string;
  received_by_name: string;
  assigned_on: string;
  handed_by: string;
  note: string | null;
  return_code: string | null;
  returned_on: string | null;
  returned_by_name: string | null;
  return_received_by: string | null;
  return_note: string | null;
  created_at: CreatedTimestamp;
}

export interface AssetLoansTable {
  id: Generated<string>;
  code: string;
  asset_id: string;
  borrower_name: string;
  borrower_user_id: string | null;
  from_date: string;
  due_date: string;
  status: Generated<'open' | 'returned'>;
  note: string | null;
  lent_by: string;
  returned_on: string | null;
  return_received_by: string | null;
  return_note: string | null;
  created_at: CreatedTimestamp;
}

export interface AssetDamagesTable {
  id: Generated<string>;
  code: string;
  asset_id: string;
  org_unit_id: string;
  incident_type: 'damaged' | 'lost';
  severity: 'minor' | 'major' | 'total';
  description: string;
  occurred_on: string;
  proposed_handling: string;
  status: Generated<'pending' | 'approved' | 'rejected'>;
  reported_by: string;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  created_at: CreatedTimestamp;
}

export interface StockItemsTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  name: string;
  unit: string;
  min_qty: Decimal;
  current_qty: Decimal;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface StockTransactionsTable {
  id: Generated<string>;
  code: string;
  stock_item_id: string;
  transaction_type: StockTransactionType;
  quantity: Decimal;
  unit_price: Money | null;
  balance_after: Decimal;
  reference_type: string | null;
  reference_id: string | null;
  transaction_date: string;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface StockCountsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  count_date: string;
  status: StockCountStatus;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  decided_by: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
}

export interface StockCountLinesTable {
  id: Generated<string>;
  count_id: string;
  stock_item_id: string;
  system_qty: Decimal;
  actual_qty: Decimal;
  difference: Decimal;
  note: string | null;
}

export interface PurchaseRequestsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  requester_id: string;
  requester_name: string;
  needed_by: string;
  reason: string;
  total_amount: Money;
  requires_principal: boolean;
  status: Generated<PurchaseRequestStatus>;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  created_at: CreatedTimestamp;
}

export interface PurchaseRequestItemsTable {
  id: Generated<string>;
  request_id: string;
  item_name: string;
  quantity: Decimal;
  unit: string;
  estimated_price: Money;
  note: string | null;
}

export interface PurchaseOrdersTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  request_id: string;
  supplier_id: string;
  order_date: string;
  total_amount: Money;
  status: Generated<'ordered' | 'received'>;
  payment_status: Generated<'awaiting_payment' | 'paid'>;
  payment_id: string | null;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  received_by: string | null;
  received_at: Date | null;
}

export interface PurchaseOrderItemsTable {
  id: Generated<string>;
  order_id: string;
  stock_item_id: string | null;
  item_name: string;
  quantity: Decimal;
  unit_price: Money;
  amount: Money;
  received_qty: Decimal;
}

// Công việc, kế hoạch, đánh giá, quá trình công tác, thưởng và khấu trừ (YCTD-81)
export type WorkPeriodType = 'month' | 'term' | 'year';
export type TaskType = 'assigned' | 'personal';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type PlanStatus = 'draft' | 'active' | 'closed';
export type EvaluationStatus = 'draft' | 'published' | 'superseded';

export interface PlansTable {
  id: Generated<string>;
  org_unit_id: string;
  period_type: WorkPeriodType;
  period_value: string;
  title: string;
  objectives: string | null;
  status: Generated<PlanStatus>;
  created_by: string;
  activated_at: Date | null;
  closed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface TasksTable {
  id: Generated<string>;
  org_unit_id: string;
  task_type: TaskType;
  title: string;
  description: string | null;
  assigner_user_id: string;
  assigner_name: string;
  assignee_staff_id: string;
  due_date: string | null;
  priority: Generated<TaskPriority>;
  status: Generated<TaskStatus>;
  progress_percent: Generated<number>;
  plan_item_id: string | null;
  completed_at: Date | null;
  cancel_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface TaskUpdatesTable {
  id: Generated<string>;
  task_id: string;
  content: string | null;
  progress_percent: number;
  status: TaskStatus;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface PlanItemsTable {
  id: Generated<string>;
  plan_id: string;
  content: string;
  owner_staff_id: string;
  due_date: string;
  task_id: string | null;
  order_no: number;
}

export interface EvaluationCriteriaTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  name: string;
  weight: Decimal;
  max_score: Decimal;
  status: Generated<CatalogStatus>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EvaluationsTable {
  id: Generated<string>;
  staff_id: string;
  org_unit_id: string;
  period_type: WorkPeriodType;
  period_value: string;
  total_score: Decimal;
  comment: string | null;
  status: Generated<EvaluationStatus>;
  replaces_id: string | null;
  reevaluation_reason: string | null;
  evaluated_by: string;
  evaluated_by_name: string;
  published_by: string | null;
  published_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EvaluationScoresTable {
  id: Generated<string>;
  evaluation_id: string;
  criterion_id: string;
  criterion_code: string;
  criterion_name: string;
  weight: Decimal;
  max_score: Decimal;
  score: Decimal;
  comment: string | null;
}

export interface StaffWorkHistoryTable {
  id: Generated<string>;
  staff_id: string;
  org_unit_id: string;
  from_date: string;
  to_date: string | null;
  department_id: string | null;
  job_title_id: string | null;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface StaffCertificatesTable {
  id: Generated<string>;
  staff_id: string;
  name: string;
  certificate_no: string | null;
  issued_by: string;
  issued_date: string;
  expire_date: string | null;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface StaffBonusDeductionsTable {
  id: Generated<string>;
  staff_id: string;
  pay_item_type_id: string;
  target_year: number;
  target_month: number;
  amount: Money;
  basis: string;
  status: Generated<'active' | 'cancelled'>;
  created_by: string;
  created_at: CreatedTimestamp;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
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
  payment_reversals: PaymentReversalsTable;
  payment_requests: PaymentRequestsTable;
  online_payment_transactions: OnlinePaymentTransactionsTable;
  staff: StaffTable;
  employment_contracts: EmploymentContractsTable;
  holidays: HolidaysTable;
  school_day_changes: SchoolDayChangesTable;
  attendance_logs: AttendanceLogsTable;
  leave_policies: LeavePoliciesTable;
  leave_balances: LeaveBalancesTable;
  leave_requests: LeaveRequestsTable;
  timesheet_periods: TimesheetPeriodsTable;
  timesheet_days: TimesheetDaysTable;
  timesheet_reopen_requests: TimesheetReopenRequestsTable;
  pay_item_types: PayItemTypesTable;
  staff_pay_items: StaffPayItemsTable;
  tax_tables: TaxTablesTable;
  payrolls: PayrollsTable;
  payslips: PayslipsTable;
  payslip_lines: PayslipLinesTable;
  payroll_settlements: PayrollSettlementsTable;
  payroll_adjustments: PayrollAdjustmentsTable;
  notification_reads: NotificationReadsTable;
  notification_templates: NotificationTemplatesTable;
  daily_journals: DailyJournalsTable;
  journal_amendments: JournalAmendmentsTable;
  child_unit_transfers: ChildUnitTransfersTable;
  work_schedules: WorkSchedulesTable;
  health_measurements: HealthMeasurementsTable;
  health_standards: HealthStandardsTable;
  health_check_campaigns: HealthCheckCampaignsTable;
  health_check_schedules: HealthCheckSchedulesTable;
  health_check_results: HealthCheckResultsTable;
  medical_events: MedicalEventsTable;
  daily_care_logs: DailyCareLogsTable;
  health_report_requests: HealthReportRequestsTable;
  pharmacies: PharmaciesTable;
  medicines: MedicinesTable;
  medication_requests: MedicationRequestsTable;
  medication_administrations: MedicationAdministrationsTable;
  medicine_purchase_requests: MedicinePurchaseRequestsTable;
  medicine_purchase_orders: MedicinePurchaseOrdersTable;
  medicine_purchase_order_items: MedicinePurchaseOrderItemsTable;
  medicine_issues: MedicineIssuesTable;
  suppliers: SuppliersTable;
  assets: AssetsTable;
  asset_assignments: AssetAssignmentsTable;
  asset_loans: AssetLoansTable;
  asset_damages: AssetDamagesTable;
  stock_items: StockItemsTable;
  stock_transactions: StockTransactionsTable;
  stock_counts: StockCountsTable;
  stock_count_lines: StockCountLinesTable;
  purchase_requests: PurchaseRequestsTable;
  purchase_request_items: PurchaseRequestItemsTable;
  purchase_orders: PurchaseOrdersTable;
  purchase_order_items: PurchaseOrderItemsTable;
  plans: PlansTable;
  tasks: TasksTable;
  task_updates: TaskUpdatesTable;
  plan_items: PlanItemsTable;
  evaluation_criteria: EvaluationCriteriaTable;
  evaluations: EvaluationsTable;
  evaluation_scores: EvaluationScoresTable;
  staff_work_history: StaffWorkHistoryTable;
  staff_certificates: StaffCertificatesTable;
  staff_bonus_deductions: StaffBonusDeductionsTable;
}

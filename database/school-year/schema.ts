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
  // Khoảng cách đến cơ sở chính (km) và diện tích (m²) của phân hiệu, điểm trường (DT-15 phần 15b); numeric đọc ra chuỗi
  distance_km: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  area_m2: ColumnType<string | null, string | number | null | undefined, string | number | null>;
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
  // Khai báo cơ sở vật chất (YCTD-102): khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính theo quy chuẩn
  room_block: ColumnType<string | null, string | null | undefined, string | null>;
  room_type: ColumnType<string | null, string | null | undefined, string | null>;
  condition: ColumnType<string | null, string | null | undefined, string | null>;
  area_m2: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  facility_attributes: ColumnType<Record<string, unknown>, string | undefined, string>;
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
export type ClassAgeGroup = 'months_3_12' | 'months_13_24' | 'months_25_36' | 'years_3_4' | 'years_4_5' | 'years_5_6';

export interface ClassesTable extends CatalogRecordColumns {
  org_unit_id: string;
  academic_year_id: string;
  code: string;
  name: string;
  grade_level: string;
  room_id: string | null;
  max_size: number;
  status: Generated<ClassStatus>;
  // Thông tin lớp theo Sở (DT-15 phần 15b): nhóm tuổi (trống là theo bậc học), thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2
  // hoặc 3 độ tuổi, lớp ghép và lớp được ghép vào, lớp bán trú
  age_group: ColumnType<ClassAgeGroup | null, ClassAgeGroup | null | undefined, ClassAgeGroup | null>;
  sort_order: ColumnType<number | null, number | null | undefined, number | null>;
  two_sessions_per_day: Generated<boolean>;
  mixed_age_count: ColumnType<number | null, number | null | undefined, number | null>;
  is_combined: Generated<boolean>;
  combined_into_class_id: ColumnType<string | null, string | null | undefined, string | null>;
  boarding: Generated<boolean>;
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
  | 'activity_photo'
  | 'content_file'
  | 'medicine_photo'
  | 'prescription'
  | 'candidate_cv';

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
  // Các cột của tệp CSDL ngành không có cột riêng, khóa tiếng Anh cố định (YCTD-100)
  moet_profile: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  // Học 2 buổi/ngày, học sinh lớp bán trú (YCTD-108)
  two_sessions_per_day: Generated<boolean>;
  boarding: Generated<boolean>;
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
  // Năm sinh, số định danh mã hóa kèm bốn số cuối, nhập từ CSDL ngành (YCTD-100)
  birth_year: ColumnType<number | null, number | null | undefined, number | null>;
  id_number_encrypted: ColumnType<string | null, string | null | undefined, string | null>;
  id_number_last4: ColumnType<string | null, string | null | undefined, string | null>;
}

export interface ChildGuardiansTable extends CatalogRecordColumns {
  child_id: string;
  guardian_id: string;
  relationship_item_id: string;
  is_primary: Generated<boolean>;
  can_pickup: Generated<boolean>;
  // Phụ huynh có số điện thoại nhận tin của học sinh, tối đa một mỗi học sinh (YCTD-108)
  receives_sms: Generated<boolean>;
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

// Kênh thông báo: trong ứng dụng, tin nhắn, Zalo Official Account (YCTD-71, YCTD-90)
export type NotificationChannel = 'in_app' | 'sms' | 'zalo';

export interface NotificationRecipientsTable {
  id: Generated<string>;
  notification_id: string;
  user_id: string | null;
  role_code: string | null;
  org_unit_id: string | null;
  channel: NotificationChannel;
  is_read: Generated<boolean>;
  read_at: Date | null;
  channel_status: Generated<'pending' | 'sent' | 'failed' | 'limited'>;
  sent_at: Date | null;
  // Gửi lại khi lỗi (CB-07, YCTD-71)
  attempt_count: Generated<number>;
  next_attempt_at: Date | null;
  last_error: string | null;
  // Kênh thực tế đã gửi; kênh zalo gửi tin nhắn khi người nhận chưa liên kết Zalo (YCTD-90)
  delivered_via: NotificationChannel | null;
}

export type ImportType =
  | 'classes'
  | 'children'
  | 'moet_codes'
  | 'opening_debts'
  | 'staff'
  | 'moet_children'
  | 'moet_staff'
  | 'professional_ratings';
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
  // Số dòng tạo mới, cập nhật, bỏ qua và ghi chú từng dòng của lần nhập CSDL ngành (YCTD-100)
  preview: ColumnType<unknown, string | null | undefined, string | null>;
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
  item_type: 'tuition' | 'service' | 'opening' | 'extracurricular';
  service_id: string | null;
  service_registration_id: string | null;
  // Đăng ký ngoại khóa đã lập khoản thu (YCTD-78)
  extracurricular_registration_id: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Cổng thanh toán trực tuyến của tài khoản (trống là cổng mặc định) và mã BIN ngân hàng cho mã VietQR (YCTD-89)
  payment_provider: string | null;
  bank_bin: string | null;
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
  // Mã định danh Bộ GD&ĐT và các cột khác của tệp CSDL ngành (YCTD-100)
  moet_staff_code: ColumnType<string | null, string | null | undefined, string | null>;
  moet_profile: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  // Tài khoản ngân hàng, mã số thuế (mục 5.9 của Sở), xã đặc biệt khó khăn, xác thực số định danh bản chạy nội bộ (DT-16
  // phần 16f)
  bank_account_number: ColumnType<string | null, string | null | undefined, string | null>;
  bank_name: ColumnType<string | null, string | null | undefined, string | null>;
  tax_code: ColumnType<string | null, string | null | undefined, string | null>;
  special_difficulty_commune: Generated<boolean>;
  id_verification_status: Generated<StaffIdVerificationStatus>;
  id_verified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  id_verified_by: ColumnType<string | null, string | null | undefined, string | null>;
  id_verified_by_name: ColumnType<string | null, string | null | undefined, string | null>;
  id_verification_note: ColumnType<string | null, string | null | undefined, string | null>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type StaffIdVerificationStatus = 'unverified' | 'verified' | 'invalid';

// Phân hiệu, điểm trường nhân sự làm việc ngoài đơn vị chính (mục 3.1.2 của Sở, DT-16 phần 16f)
export interface StaffBranchAssignmentsTable {
  id: Generated<string>;
  staff_id: string;
  org_unit_id: string;
  source: 'manual' | 'teaching';
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export type StaffMovementType = 'transfer_in' | 'transfer_out' | 'guest_out' | 'guest_in';
export type StaffMovementStatus = 'pending' | 'approved' | 'rejected';

// Biến động nhân sự (mục 3.5 của Sở, DT-16 phần 16f), mỗi trường tự ghi vì chưa liên thông giữa các trường
export interface StaffMovementsTable {
  id: Generated<string>;
  movement_type: StaffMovementType;
  status: Generated<StaffMovementStatus>;
  org_unit_id: string;
  staff_id: string | null;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  other_province: string | null;
  other_ward: string | null;
  other_school: string | null;
  movement_date: string;
  end_date: string | null;
  subject: string | null;
  decision_no: string | null;
  reason: string | null;
  note: string | null;
  confirmed: Generated<boolean>;
  confirmed_on: string | null;
  dossier: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
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
  // Số đo thuộc đợt cân đo (YCTD-102), mỗi trẻ một dòng trong một đợt
  growth_round_id: ColumnType<string | null, string | null | undefined, string | null>;
}

// Đợt cân đo cân nặng, chiều cao của đơn vị (DT-14 phần 14a, YCTD-102)
export interface GrowthRoundsTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  measured_on: string;
  note: string | null;
  created_by: string;
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
  // Thiết bị trong danh mục thiết bị dạy học mà tài sản được tính vào số hiện có (YCTD-102)
  equipment_item_id: ColumnType<string | null, string | null | undefined, string | null>;
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

// Giảng dạy (P03; YCTD-80)
export type LessonPlanStatus = 'draft' | 'submitted' | 'leader_approved' | 'approved' | 'returned';
export type LessonPlanReviewStage = 'leader' | 'manager';
export type TeachingPlanPeriod = 'term' | 'month' | 'week';
export type TeachingPlanStatus = 'planned' | 'in_progress' | 'completed';
export type ProgressPeriod = 'term' | 'month';
export type ProgressLevel = 'achieved' | 'developing' | 'not_yet';
export type ActivityScheduleStatus = 'draft' | 'published' | 'cancelled';

export interface LessonDomainsTable extends CatalogRecordColumns {
  org_unit_id: string;
  name: string;
  order_no: Generated<number>;
  status: Generated<'active' | 'inactive'>;
}

export interface LessonGroupsTable extends CatalogRecordColumns {
  org_unit_id: string;
  domain_id: string;
  name: string;
  order_no: Generated<number>;
  status: Generated<'active' | 'inactive'>;
}

export interface ThemesTable extends CatalogRecordColumns {
  org_unit_id: string;
  name: string;
  age_group: string | null;
  start_date: string;
  end_date: string;
  status: Generated<'active' | 'inactive'>;
}

export interface LessonsTable {
  id: Generated<string>;
  org_unit_id: string;
  theme_id: string | null;
  domain_id: string | null;
  lesson_group_id: string | null;
  name: string;
  age_group: string | null;
  objectives: string;
  materials: string | null;
  is_shared: Generated<boolean>;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LessonPlansTable {
  id: Generated<string>;
  lesson_id: string;
  class_id: string;
  org_unit_id: string;
  teacher_id: string;
  teacher_name: string;
  planned_date: string;
  activities: string;
  duration_minutes: number;
  materials: string | null;
  status: Generated<LessonPlanStatus>;
  submitted_at: Date | null;
  leader_reviewed_by: string | null;
  leader_reviewed_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  review_comment: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LessonPlanReviewsTable {
  id: Generated<string>;
  lesson_plan_id: string;
  reviewer_id: string;
  reviewer_name: string;
  stage: LessonPlanReviewStage;
  decision: 'approved' | 'returned';
  comment: string | null;
  created_at: CreatedTimestamp;
}

export interface TimetablesTable {
  id: Generated<string>;
  class_id: string;
  effective_from: string;
  weekday: number;
  period_no: number;
  start_time: string;
  end_time: string;
  activity_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  status: Generated<'draft' | 'published'>;
  published_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface TeachingPlansTable {
  id: Generated<string>;
  class_id: string;
  org_unit_id: string;
  period_type: TeachingPlanPeriod;
  period_value: string;
  objectives: string;
  content: string;
  progress_note: string | null;
  status: Generated<TeachingPlanStatus>;
  created_by: string;
  updated_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ChildProgressTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  period_type: ProgressPeriod;
  period_value: string;
  domain_id: string | null;
  indicator_code: string;
  level: ProgressLevel;
  comment: string | null;
  recorded_by: string;
  published_at: Date | null;
  published_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ClassActivitySchedulesTable {
  id: Generated<string>;
  class_id: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  activity_name: string;
  note: string | null;
  status: Generated<ActivityScheduleStatus>;
  published_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Tương tác và ý kiến, đồ bị mất của trẻ (P15, P02-11; YCTD-79)
export type MessageSenderSide = 'guardian' | 'staff';
export type FeedbackCategory = 'teaching' | 'care' | 'meal' | 'facility' | 'fee' | 'other';
export type FeedbackPrivacy = 'named' | 'anonymous';
export type FeedbackStatus = 'received' | 'in_progress' | 'resolved';
export type PollType = 'poll' | 'vote' | 'survey';
export type PollAudience = 'guardians' | 'staff' | 'everyone';
export type PollStatus = 'draft' | 'open' | 'closed';
export type PollAnswerType = 'single_choice' | 'multiple_choice' | 'text' | 'rating';
export type InteractionCommentTargetType = 'poll';
export type LikeTargetType = 'poll' | 'comment';
export type CommentModerationAction = 'hide' | 'restore' | 'note';
export type LostItemReportType = 'lost' | 'found';
export type LostItemStatus = 'reported' | 'found' | 'returned' | 'not_found' | 'cancelled';

export interface SurveyTemplateQuestion {
  question_text: string;
  answer_type: PollAnswerType;
  is_required: boolean;
  options: string[];
}

export interface MessageThreadsTable {
  id: Generated<string>;
  org_unit_id: string;
  child_id: string;
  guardian_user_id: string;
  created_by: string;
  created_at: CreatedTimestamp;
  last_message_at: UpdatedTimestamp;
}

export interface MessagesTable {
  id: Generated<string>;
  thread_id: string;
  sender_user_id: string;
  sender_side: MessageSenderSide;
  sender_name: string;
  content: string;
  sent_at: CreatedTimestamp;
  read_at: Date | null;
  read_by: string | null;
}

export interface FeedbacksTable {
  id: Generated<string>;
  org_unit_id: string;
  child_id: string | null;
  submitted_by_user_id: string;
  submitter_name: string;
  category: FeedbackCategory;
  content: string;
  privacy_level: FeedbackPrivacy;
  status: Generated<FeedbackStatus>;
  assigned_to_user_id: string | null;
  handled_by: string | null;
  handled_at: Date | null;
  handling_note: string | null;
  created_at: CreatedTimestamp;
}

export interface SurveyTemplatesTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  questions: ColumnType<SurveyTemplateQuestion[], string, string>;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface PollsTable {
  id: Generated<string>;
  org_unit_id: string;
  poll_type: PollType;
  title: string;
  description: string | null;
  class_id: string | null;
  audience: PollAudience;
  start_at: Date;
  end_at: Date;
  is_anonymous: Generated<boolean>;
  survey_template_id: string | null;
  status: Generated<PollStatus>;
  published_at: Date | null;
  closed_at: Date | null;
  results_published_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface PollQuestionsTable {
  id: Generated<string>;
  poll_id: string;
  question_text: string;
  answer_type: PollAnswerType;
  order_no: number;
  is_required: Generated<boolean>;
}

export interface PollOptionsTable {
  id: Generated<string>;
  poll_id: string;
  question_id: string;
  label: string;
  order_no: number;
}

export interface PollResponsesTable {
  id: Generated<string>;
  poll_id: string;
  user_id: string;
  submitted_at: CreatedTimestamp;
}

export interface PollAnswersTable {
  id: Generated<string>;
  response_id: string;
  question_id: string;
  option_id: string | null;
  answer_text: string | null;
  answer_number: number | null;
}

export interface InteractionCommentsTable {
  id: Generated<string>;
  org_unit_id: string;
  target_type: InteractionCommentTargetType;
  target_id: string;
  user_id: string;
  author_name: string;
  author_side: MessageSenderSide;
  content: string;
  created_at: CreatedTimestamp;
  reported_at: Date | null;
  reported_by: string | null;
  hidden_at: Date | null;
  hidden_by: string | null;
  hide_reason: string | null;
}

export interface CommentModerationsTable {
  id: Generated<string>;
  comment_id: string;
  action: CommentModerationAction;
  reason: string;
  handled_by: string;
  handled_at: CreatedTimestamp;
}

export interface InteractionLikesTable {
  id: Generated<string>;
  target_type: LikeTargetType;
  target_id: string;
  user_id: string;
  created_at: CreatedTimestamp;
}

export interface LostItemsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  child_id: string | null;
  class_id: string | null;
  report_type: LostItemReportType;
  description: string;
  noticed_on: string;
  photo_file_id: string | null;
  status: LostItemStatus;
  reported_by: string;
  reported_at: CreatedTimestamp;
  found_by: string | null;
  found_at: Date | null;
  found_note: string | null;
  closed_by: string | null;
  closed_at: Date | null;
  result_note: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
}

// Hoạt động, hình ảnh, tin tức, thư viện, hình tô màu, ngoại khóa, bình luận (YCTD-78)
export type ActivityStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'hidden';
export type ContentStatus = 'draft' | 'published' | 'hidden';
export type ContentScopeType = 'school' | 'unit' | 'class' | 'child';
export type CommentTargetType = 'activity' | 'news' | 'library_item' | 'library_album';
export type ExtracurricularFeeType = 'free' | 'per_activity' | 'monthly';

interface AuthoredColumns {
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

interface PublishingColumns {
  scope_type: ColumnType<ContentScopeType, ContentScopeType | undefined, ContentScopeType>;
  scope_id: string | null;
  status: ColumnType<ContentStatus, ContentStatus | undefined, ContentStatus>;
  published_at: Date | null;
  published_by: string | null;
  hidden_reason: string | null;
  hidden_by: string | null;
  hidden_at: Date | null;
}

export interface ContentCatalogTable extends AuthoredColumns {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  order_no: Generated<number>;
  status: Generated<'active' | 'inactive'>;
}

export interface ActivitiesTable extends AuthoredColumns {
  id: Generated<string>;
  org_unit_id: string;
  class_id: string;
  category_id: string;
  title: string;
  content: string;
  activity_date: string;
  status: ActivityStatus;
  created_by_name: string;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  published_at: Date | null;
  hidden_reason: string | null;
  hidden_by: string | null;
  hidden_at: Date | null;
}

export interface ActivityMediaTable {
  id: Generated<string>;
  activity_id: string;
  file_id: string;
  caption: string | null;
  order_no: Generated<number>;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface ActivityMediaChildrenTable {
  media_id: string;
  child_id: string;
}

export interface ActivityLikesTable {
  activity_id: string;
  user_id: string;
  created_at: CreatedTimestamp;
}

export interface NewsTable extends AuthoredColumns, PublishingColumns {
  id: Generated<string>;
  org_unit_id: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  cover_file_id: string | null;
}

export interface LibraryAlbumsTable extends AuthoredColumns {
  id: Generated<string>;
  org_unit_id: string;
  topic_id: string | null;
  title: string;
  cover_file_id: string | null;
  status: Generated<'active' | 'inactive'>;
}

export interface LibraryItemsTable extends AuthoredColumns, PublishingColumns {
  id: Generated<string>;
  org_unit_id: string;
  topic_id: string | null;
  album_id: string | null;
  title: string;
  description: string | null;
  age_group: string | null;
  file_id: string | null;
}

export interface ColoringPagesTable extends AuthoredColumns, PublishingColumns {
  id: Generated<string>;
  org_unit_id: string;
  title: string;
  topic: string | null;
  age_group: string | null;
  file_id: string;
}

export interface ContentCommentsTable {
  id: Generated<string>;
  target_type: CommentTargetType;
  target_id: string;
  org_unit_id: string;
  user_id: string;
  author_name: string;
  is_parent: Generated<boolean>;
  content: string;
  created_at: CreatedTimestamp;
  hidden_reason: string | null;
  hidden_by: string | null;
  hidden_at: Date | null;
}

export interface ExtracurricularActivitiesTable extends AuthoredColumns {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  grade_levels: ColumnType<string[], string | undefined, string>;
  quota: number;
  fee_type: ExtracurricularFeeType;
  fee_amount: Money;
  status: Generated<'draft' | 'published' | 'closed'>;
}

export interface ExtracurricularRegistrationsTable {
  id: Generated<string>;
  activity_id: string;
  child_id: string;
  org_unit_id: string;
  registered_by: string;
  registered_at: CreatedTimestamp;
  effective_from: string;
  effective_to: string | null;
  status: Generated<'active' | 'withdrawn'>;
  withdrawn_by: string | null;
  withdrawn_at: Date | null;
}

// Bếp, thực đơn, định lượng, suất ăn, phiếu đi chợ (P12; YCTD-76)
export type MealType = 'breakfast' | 'lunch' | 'snack';
export type MenuStatus = 'draft' | 'submitted' | 'published';
export type MarketPurchaseStatus = 'draft' | 'received' | 'cancelled';
export type MarketPurchasePaymentStatus = 'awaiting_payment' | 'paid';

export interface IngredientsTable extends CatalogRecordColumns {
  org_unit_id: string;
  code: string;
  name: string;
  unit: string;
  current_stock: Generated<Decimal>;
  status: Generated<CatalogStatus>;
}

export interface DishesTable extends CatalogRecordColumns {
  org_unit_id: string;
  name: string;
  group_name: string | null;
  recipe_note: string | null;
  status: Generated<CatalogStatus>;
}

export interface IngredientNormsTable {
  id: Generated<string>;
  dish_id: string;
  ingredient_id: string;
  quantity_per_serving: Decimal;
}

export interface MenusTable {
  id: Generated<string>;
  org_unit_id: string;
  week_start_date: string;
  age_group: Generated<string>;
  status: Generated<MenuStatus>;
  note: string | null;
  submitted_by: string | null;
  submitted_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  published_at: Date | null;
  reject_reason: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  // Tên thực đơn, tháng (YYYY-MM), tuần, từ ngày–đến ngày, khối áp dụng như màn hình 4.5 của Sở (DT-16 phần 16h)
  name: ColumnType<string | null, string | null | undefined, string | null>;
  month: ColumnType<string | null, string | null | undefined, string | null>;
  week_no: ColumnType<number | null, number | null | undefined, number | null>;
  from_date: ColumnType<string | null, string | null | undefined, string | null>;
  to_date: ColumnType<string | null, string | null | undefined, string | null>;
  grade_levels: ColumnType<string[], string[] | undefined, string[]>;
}

// Lần nhập thực đơn từ Excel (DT-16 phần 16h): dòng lỗi và các thực đơn đọc được chờ ghi
export interface MenuImportJobsTable {
  id: Generated<string>;
  org_unit_id: string;
  file_id: string;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: ColumnType<unknown[], string | undefined, string>;
  menus: ColumnType<unknown[], string | undefined, string>;
  created_by: string;
  created_at: CreatedTimestamp;
  committed_at: Date | null;
}

// Thông tin sức khỏe học sinh theo học kỳ (mục 4.6 của Sở; DT-16 phần 16h)
export type StudentHealthTerm = 'first_term' | 'second_term';
export type PhysicalEducationResult = 'passed' | 'not_passed';

export interface StudentHealthRecordsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  term_type: StudentHealthTerm;
  measured_on: string | null;
  weight_kg: Decimal | null;
  height_cm: Decimal | null;
  growth_round_id: string | null;
  physical_education: PhysicalEducationResult | null;
  can_swim: boolean | null;
  eye_conditions: ColumnType<string[], string[] | undefined, string[]>;
  note: string | null;
  recorded_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface MenuItemsTable {
  id: Generated<string>;
  menu_id: string;
  weekday: number;
  meal_type: MealType;
  dish_id: string;
  note: string | null;
}

export interface MealReportsTable {
  id: Generated<string>;
  class_id: string;
  org_unit_id: string;
  report_date: string;
  headcount: number;
  note: string | null;
  reported_by: string;
  reported_at: Date;
}

export interface MealPlansTable {
  id: Generated<string>;
  org_unit_id: string;
  meal_date: string;
  meal_type: MealType;
  headcount: number;
  computed_from: 'attendance' | 'mixed';
  status: 'provisional' | 'final';
  computed_by: string;
  computed_at: Date;
}

export interface BuffetEventsTable {
  id: Generated<string>;
  org_unit_id: string;
  buffet_date: string;
  occasion: string;
  class_id: string | null;
  menu_note: string;
  status: Generated<'draft' | 'approved' | 'cancelled'>;
  created_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface FoodSuppliersTable extends CatalogRecordColumns {
  org_unit_id: string;
  name: string;
  food_groups: string | null;
  tax_code: string | null;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  status: Generated<CatalogStatus>;
}

export interface MarketPurchasesTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  purchase_date: string;
  supplier_id: string;
  total_amount: Money;
  note: string | null;
  status: Generated<MarketPurchaseStatus>;
  payment_status: MarketPurchasePaymentStatus | null;
  payment_id: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  received_by: string | null;
  received_at: Date | null;
  paid_linked_by: string | null;
  paid_linked_at: Date | null;
}

export interface MarketPurchaseItemsTable {
  id: Generated<string>;
  purchase_id: string;
  ingredient_id: string;
  quantity: Decimal;
  planned_quantity: Decimal | null;
  unit_price: Money;
  amount: Money;
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

// Nhật ký xuất dữ liệu (P17-12, BR-74, YCTD-83)
export interface ExportLogsTable {
  id: Generated<string>;
  user_id: string;
  actor_name: string;
  report_code: string;
  filters_data: ColumnType<Record<string, unknown>, string, string>;
  org_unit_ids: string[];
  row_count: number;
  contains_personal_data: boolean;
  file_name: string;
  ip_address: string | null;
  exported_at: CreatedTimestamp;
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

// Tài chính giai đoạn 2 (P05-10, P05-12, P06-06, P06-07, P06-09; YCTD-82)
export interface DebtRemindersTable {
  id: Generated<string>;
  org_unit_id: string;
  child_id: string;
  invoice_id: string;
  milestone_days: number;
  overdue_days: number;
  outstanding_amount: Money;
  sent_by: string;
  sent_at: CreatedTimestamp;
}

export type DebtResolutionStatus = 'pending' | 'decided';

export interface DebtResolutionsTable {
  id: Generated<string>;
  org_unit_id: string;
  child_id: string;
  invoice_id: string | null;
  overdue_amount: Money;
  overdue_days: number;
  proposal: string;
  proposed_by: string;
  proposed_at: CreatedTimestamp;
  decision: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  status: Generated<DebtResolutionStatus>;
}

export interface BankStatementLinesTable {
  id: Generated<string>;
  account_id: string;
  org_unit_id: string;
  transaction_date: string;
  amount: Money;
  description: string;
  bank_reference: string | null;
  status: Generated<'unmatched' | 'matched'>;
  matched_transaction_id: string | null;
  matched_by: string | null;
  matched_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
  // Lần nhập tệp sao kê tạo ra dòng và hóa đơn được đề xuất lập phiếu thu (YCTD-89)
  import_id: string | null;
  suggested_invoice_id: string | null;
}

export type BankStatementAmountMode = 'signed' | 'split';
export type BankStatementDateFormat = 'dmy' | 'ymd' | 'mdy';

export interface BankStatementProfilesTable {
  id: Generated<string>;
  account_id: string;
  org_unit_id: string;
  header_row: Generated<number>;
  date_column: string;
  date_format: Generated<BankStatementDateFormat>;
  amount_mode: BankStatementAmountMode;
  amount_column: string | null;
  credit_column: string | null;
  debit_column: string | null;
  description_column: string;
  reference_column: string | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface BankStatementImportsTable {
  id: Generated<string>;
  account_id: string;
  org_unit_id: string;
  file_name: string;
  file_format: 'xlsx' | 'csv';
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  auto_matched_count: Generated<number>;
  suggested_count: Generated<number>;
  errors: ColumnType<unknown, string | undefined, string>;
  duplicates: ColumnType<unknown, string | undefined, string>;
  created_by: string;
  created_at: CreatedTimestamp;
}

export type PayableSourceType = 'manual' | 'purchase_order' | 'medicine_purchase_order' | 'market_purchase';
export type PayableStatus = 'open' | 'paid' | 'cancelled';

export interface PayablesTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  supplier_id: string | null;
  payee_name: string;
  source_type: PayableSourceType;
  source_id: string | null;
  document_ref: string | null;
  description: string;
  amount: Money;
  document_date: string;
  due_date: string;
  status: Generated<PayableStatus>;
  payment_id: string | null;
  paid_at: Date | null;
  cancel_reason: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export type FiscalPeriodStatus = 'pending' | 'closed' | 'rejected';

export interface FiscalPeriodsTable {
  id: Generated<string>;
  org_unit_id: string;
  period_year: number;
  period_month: number;
  status: Generated<FiscalPeriodStatus>;
  summary: ColumnType<Record<string, unknown>, string, string>;
  request_note: string | null;
  close_requested_by: string;
  close_requested_at: ColumnType<Date, Date | undefined, Date>;
  closed_by: string | null;
  closed_at: Date | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  reject_reason: string | null;
}

// Kết nối ngoài: cấu hình toàn trường, phụ huynh quan tâm Zalo Official Account, bài đăng Fanpage (P14-08, G3-08, YCTD-90)
export type IntegrationConnector = 'facebook' | 'zalo';
export type FacebookPostSourceType = 'activity' | 'news';
export type FacebookPostStatus = 'posted' | 'failed';

export interface IntegrationSettingsTable {
  id: Generated<string>;
  connector: IntegrationConnector;
  enabled: Generated<boolean>;
  config_data: ColumnType<Record<string, string>, string | undefined, string>;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface ZaloFollowersTable {
  id: Generated<string>;
  phone: string;
  zalo_user_id: string;
  display_name: string | null;
  linked_by: string;
  linked_at: CreatedTimestamp;
}

export interface FacebookPostsTable {
  id: Generated<string>;
  source_type: FacebookPostSourceType;
  source_id: string;
  org_unit_id: string;
  title: string;
  message: string;
  photo_file_ids: ColumnType<string[], string[] | undefined, string[]>;
  excluded_photo_count: Generated<number>;
  status: FacebookPostStatus;
  page_id: string;
  provider: string;
  external_post_id: string | null;
  last_error: string | null;
  attempt_count: Generated<number>;
  posted_by: string;
  posted_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Tuyển dụng (P18; YCTD-87)
export type RecruitmentRequestStatus = 'pending' | 'approved' | 'rejected' | 'closed';
export type JobPostingStatus = 'draft' | 'published' | 'closed';
export type CandidateSource = 'website' | 'referral' | 'job_board' | 'social_media' | 'walk_in' | 'other';
export type CandidateStatus = 'new' | 'screening' | 'interviewing' | 'hired' | 'rejected' | 'withdrawn';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewResult = 'passed' | 'failed';

export interface RecruitmentRequestsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  position: string;
  quantity: number;
  requirements: string;
  reason: string;
  needed_by: string | null;
  status: Generated<RecruitmentRequestStatus>;
  requester_id: string;
  requester_name: string;
  approved_by: string | null;
  approver_name: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  closed_by: string | null;
  closed_at: Date | null;
  close_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface JobPostingsTable {
  id: Generated<string>;
  request_id: string;
  org_unit_id: string;
  title: string;
  description: string;
  requirements: string;
  deadline: string;
  status: Generated<JobPostingStatus>;
  published_at: Date | null;
  published_by: string | null;
  closed_at: Date | null;
  closed_by: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface CandidatesTable {
  id: Generated<string>;
  posting_id: string;
  org_unit_id: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string;
  email: string | null;
  address: string | null;
  source: CandidateSource;
  cv_file_id: string | null;
  cover_letter: string | null;
  consent_at: Date | null;
  status: Generated<CandidateStatus>;
  status_reason: string | null;
  note: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  staff_id: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface InterviewsTable {
  id: Generated<string>;
  candidate_id: string;
  round: number;
  scheduled_at: Date;
  location: string;
  interviewer_staff_ids: string[];
  status: Generated<InterviewStatus>;
  result: InterviewResult | null;
  score: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  evaluation: string | null;
  cancel_reason: string | null;
  recorded_by: string | null;
  recorded_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Tuyển sinh trực tuyến (P16; YCTD-86)
export type AdmissionCampaignStatus = 'draft' | 'open' | 'closed';
export type AdmissionApplicationStatus = 'submitted' | 'received' | 'passed' | 'rejected' | 'converted';
export type AdmissionApplicationSource = 'online' | 'staff';
export type AdmissionPostStatus = 'draft' | 'published' | 'hidden';

export interface AdmissionCampaignsTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  description: string | null;
  quota: number;
  open_from: string;
  open_to: string;
  status: Generated<AdmissionCampaignStatus>;
  opened_at: Date | null;
  closed_at: Date | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AdmissionApplicationsTable {
  id: Generated<string>;
  code: string;
  campaign_id: string;
  org_unit_id: string;
  source: AdmissionApplicationSource;
  child_full_name: string;
  child_dob: string;
  child_gender: 'male' | 'female';
  child_national_id_encrypted: string | null;
  child_national_id_hash: string | null;
  child_national_id_last4: string | null;
  child_has_allergies: boolean | null;
  child_allergies: string | null;
  guardian_full_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  guardian_relationship_item_id: string | null;
  address: string | null;
  note: string | null;
  status: Generated<AdmissionApplicationStatus>;
  received_by: string | null;
  received_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  reject_reason: string | null;
  planned_class_id: string | null;
  created_child_id: string | null;
  converted_by: string | null;
  converted_at: Date | null;
  submitted_ip: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AdmissionPostsTable {
  id: Generated<string>;
  campaign_id: string;
  title: string;
  content: string;
  publish_from: string;
  publish_to: string | null;
  status: Generated<AdmissionPostStatus>;
  published_at: Date | null;
  hidden_reason: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Sổ kế toán kép (G3-06, N5; YCTD-88)
export type LedgerNormalBalance = 'debit' | 'credit' | 'both';
export type JournalEntryType = 'auto' | 'manual' | 'opening';
export type JournalEntryStatus = 'posted' | 'voided';

export interface LedgerAccountsTable {
  id: Generated<string>;
  code: string;
  name: string;
  parent_id: string | null;
  normal_balance: LedgerNormalBalance;
  is_system: Generated<boolean>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LedgerPostingRulesTable {
  id: Generated<string>;
  document_type: string;
  category_id: string | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface JournalEntriesTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  entry_date: string;
  description: string;
  entry_type: JournalEntryType;
  source_type: string | null;
  source_id: string | null;
  source_code: string | null;
  total_amount: Money;
  status: Generated<JournalEntryStatus>;
  request_key: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  voided_by: string | null;
  voided_at: Date | null;
  void_reason: string | null;
}

export interface JournalLinesTable {
  id: Generated<string>;
  entry_id: string;
  line_no: number;
  account_id: string;
  debit: Money;
  credit: Money;
  description: string | null;
}

// Hoàn thành chương trình, nhóm trẻ, chuẩn nghề nghiệp (DT-14 phần 14c, YCTD-102)
export type ProgramCompletionResult = 'completed' | 'not_completed';
export type ProfessionalStandardType = 'teacher' | 'principal';
export type ProfessionalLevel = 'not_met' | 'met' | 'good' | 'excellent';
export type ProfessionalEvaluationStatus = 'self_assessing' | 'self_submitted' | 'finalized';

export interface ProgramCompletionsTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  org_unit_id: string;
  result: ProgramCompletionResult;
  note: string | null;
  recorded_by: string;
  recorded_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProgramCompletionConfirmationsTable {
  id: Generated<string>;
  class_id: string;
  org_unit_id: string;
  completed_count: number;
  children_count: number;
  confirmed_by: string;
  confirmed_by_name: string;
  confirmed_at: CreatedTimestamp;
}

export interface ChildGroupsTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  description: string | null;
  teacher_staff_id: string | null;
  status: Generated<'active' | 'inactive'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ChildGroupMembersTable {
  group_id: string;
  child_id: string;
  added_by: string;
  created_at: CreatedTimestamp;
}

export interface ProfessionalStandardsTable {
  id: Generated<string>;
  standard_type: ProfessionalStandardType;
  code: string;
  name: string;
  order_no: number;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalCriteriaTable {
  id: Generated<string>;
  standard_id: string;
  standard_type: ProfessionalStandardType;
  code: string;
  name: string;
  is_key: Generated<boolean>;
  order_no: number;
  status: Generated<'active' | 'inactive'>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalEvaluationsTable {
  id: Generated<string>;
  staff_id: string;
  org_unit_id: string;
  standard_type: ProfessionalStandardType;
  status: Generated<ProfessionalEvaluationStatus>;
  self_submitted_at: Date | null;
  overall_level: ProfessionalLevel | null;
  assessor_comment: string | null;
  opened_by: string;
  finalized_by: string | null;
  finalized_by_name: string | null;
  finalized_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalEvaluationItemsTable {
  id: Generated<string>;
  evaluation_id: string;
  criterion_id: string;
  standard_code: string;
  standard_name: string;
  criterion_code: string;
  criterion_name: string;
  is_key: boolean;
  order_no: number;
  self_rating: ProfessionalLevel | null;
  self_evidence: string | null;
  assessor_rating: ProfessionalLevel | null;
  assessor_note: string | null;
}

// Thiết bị dạy học tối thiểu, số lượng hiện có nhập tay, hồ sơ trường (DT-14 phần 14d, YCTD-102)
export interface EquipmentItemsTable {
  id: Generated<string>;
  code: string;
  name: string;
  unit: string;
  equipment_group: string;
  development_area: string | null;
  age_group: string;
  quantity: ColumnType<string, string | number, string | number>;
  norm_basis: Generated<string>;
  target_users: Generated<string>;
  equipment_type: string | null;
  is_minimum: Generated<boolean>;
  is_seeded: Generated<boolean>;
  order_no: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  note: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EquipmentHoldingsTable {
  id: Generated<string>;
  equipment_item_id: string;
  org_unit_id: string;
  class_id: string | null;
  quantity: ColumnType<string, string | number, string | number>;
  next_year_need: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  note: string | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

type JsonSection = ColumnType<Record<string, unknown>, string | undefined, string>;

export interface SchoolProfilesTable {
  id: Generated<string>;
  org_unit_id: string;
  general: JsonSection;
  other_info: JsonSection;
  foreign_elements: JsonSection;
  internet: JsonSection;
  it_infrastructure: JsonSection;
  office_accounts: ColumnType<Array<Record<string, unknown>>, string | undefined, string>;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
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
  staff_branch_assignments: StaffBranchAssignmentsTable;
  staff_movements: StaffMovementsTable;
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
  growth_rounds: GrowthRoundsTable;
  health_standards: HealthStandardsTable;
  health_check_campaigns: HealthCheckCampaignsTable;
  health_check_schedules: HealthCheckSchedulesTable;
  health_check_results: HealthCheckResultsTable;
  medical_events: MedicalEventsTable;
  daily_care_logs: DailyCareLogsTable;
  health_report_requests: HealthReportRequestsTable;
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
  lesson_domains: LessonDomainsTable;
  lesson_groups: LessonGroupsTable;
  themes: ThemesTable;
  lessons: LessonsTable;
  lesson_plans: LessonPlansTable;
  lesson_plan_reviews: LessonPlanReviewsTable;
  timetables: TimetablesTable;
  teaching_plans: TeachingPlansTable;
  child_progress: ChildProgressTable;
  class_activity_schedules: ClassActivitySchedulesTable;
  message_threads: MessageThreadsTable;
  messages: MessagesTable;
  feedbacks: FeedbacksTable;
  survey_templates: SurveyTemplatesTable;
  polls: PollsTable;
  poll_questions: PollQuestionsTable;
  poll_options: PollOptionsTable;
  poll_responses: PollResponsesTable;
  poll_answers: PollAnswersTable;
  interaction_comments: InteractionCommentsTable;
  comment_moderations: CommentModerationsTable;
  interaction_likes: InteractionLikesTable;
  lost_items: LostItemsTable;
  activity_categories: ContentCatalogTable;
  news_categories: ContentCatalogTable;
  library_topics: ContentCatalogTable;
  activities: ActivitiesTable;
  activity_media: ActivityMediaTable;
  activity_media_children: ActivityMediaChildrenTable;
  activity_likes: ActivityLikesTable;
  news: NewsTable;
  library_albums: LibraryAlbumsTable;
  library_items: LibraryItemsTable;
  coloring_pages: ColoringPagesTable;
  content_comments: ContentCommentsTable;
  extracurricular_activities: ExtracurricularActivitiesTable;
  extracurricular_registrations: ExtracurricularRegistrationsTable;
  ingredients: IngredientsTable;
  dishes: DishesTable;
  ingredient_norms: IngredientNormsTable;
  menus: MenusTable;
  menu_items: MenuItemsTable;
  menu_import_jobs: MenuImportJobsTable;
  student_health_records: StudentHealthRecordsTable;
  meal_reports: MealReportsTable;
  meal_plans: MealPlansTable;
  buffet_events: BuffetEventsTable;
  food_suppliers: FoodSuppliersTable;
  market_purchases: MarketPurchasesTable;
  market_purchase_items: MarketPurchaseItemsTable;
  pharmacies: PharmaciesTable;
  medicines: MedicinesTable;
  medication_requests: MedicationRequestsTable;
  medication_administrations: MedicationAdministrationsTable;
  medicine_purchase_requests: MedicinePurchaseRequestsTable;
  medicine_purchase_orders: MedicinePurchaseOrdersTable;
  medicine_purchase_order_items: MedicinePurchaseOrderItemsTable;
  medicine_issues: MedicineIssuesTable;
  export_logs: ExportLogsTable;
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
  debt_reminders: DebtRemindersTable;
  debt_resolutions: DebtResolutionsTable;
  bank_statement_lines: BankStatementLinesTable;
  payables: PayablesTable;
  fiscal_periods: FiscalPeriodsTable;
  integration_settings: IntegrationSettingsTable;
  zalo_followers: ZaloFollowersTable;
  facebook_posts: FacebookPostsTable;
  recruitment_requests: RecruitmentRequestsTable;
  job_postings: JobPostingsTable;
  candidates: CandidatesTable;
  interviews: InterviewsTable;
  admission_campaigns: AdmissionCampaignsTable;
  admission_applications: AdmissionApplicationsTable;
  admission_posts: AdmissionPostsTable;
  bank_statement_profiles: BankStatementProfilesTable;
  bank_statement_imports: BankStatementImportsTable;
  ledger_accounts: LedgerAccountsTable;
  ledger_posting_rules: LedgerPostingRulesTable;
  journal_entries: JournalEntriesTable;
  journal_lines: JournalLinesTable;
  program_completions: ProgramCompletionsTable;
  program_completion_confirmations: ProgramCompletionConfirmationsTable;
  child_groups: ChildGroupsTable;
  child_group_members: ChildGroupMembersTable;
  professional_standards: ProfessionalStandardsTable;
  professional_criteria: ProfessionalCriteriaTable;
  professional_evaluations: ProfessionalEvaluationsTable;
  professional_evaluation_items: ProfessionalEvaluationItemsTable;
  equipment_items: EquipmentItemsTable;
  equipment_holdings: EquipmentHoldingsTable;
  school_profiles: SchoolProfilesTable;
}

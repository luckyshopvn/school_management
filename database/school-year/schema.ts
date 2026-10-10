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

export type FilePurpose = 'birth_certificate' | 'photo_consent';

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
  birth_certificate_file_id: string;
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
  user_id: string;
  channel: 'in_app' | 'sms';
  is_read: Generated<boolean>;
  read_at: Date | null;
  channel_status: Generated<'pending' | 'sent' | 'failed'>;
  sent_at: Date | null;
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
}

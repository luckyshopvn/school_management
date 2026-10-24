import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu hệ thống, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;
type DateText = ColumnType<string, string, string>;

export type AcademicYearStatus = 'draft' | 'open' | 'closed';
export type AcademicTermType = 'first_term' | 'second_term' | 'summer_term';
export type AcademicYearDatabaseStatus = 'active' | 'read_only';
// Cấp học của lịch riêng (DT-19 phần 19b, YCTD-152); trống là lịch chung cả trường
type CalendarSchoolLevel = 'MN' | 'TH' | 'THCS' | 'THPT';
type CalendarLevelColumn = ColumnType<
  CalendarSchoolLevel | null,
  CalendarSchoolLevel | null | undefined,
  CalendarSchoolLevel | null
>;

export interface AcademicYearsTable {
  id: Generated<string>;
  name: string;
  start_date: ColumnType<string | null, string | null | undefined, string | null>;
  end_date: ColumnType<string | null, string | null | undefined, string | null>;
  school_days_of_week: ColumnType<number[], number[] | undefined, number[]>;
  status: Generated<AcademicYearStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface AcademicTermsTable {
  id: Generated<string>;
  academic_year_id: string;
  term_type: AcademicTermType;
  start_date: DateText;
  end_date: DateText;
  school_level: CalendarLevelColumn;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface SchoolWeeksTable {
  id: Generated<string>;
  academic_year_id: string;
  week_no: number;
  start_date: DateText;
  end_date: DateText;
  is_off: Generated<boolean>;
  note: string | null;
  // Khai báo tuần theo Sở (DT-16 phần 16e): học kỳ chọn khác lịch, hiển thị
  term_type: ColumnType<AcademicTermType | null, AcademicTermType | null | undefined, AcademicTermType | null>;
  is_visible: Generated<boolean>;
  school_level: CalendarLevelColumn;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

// Ngày học trong tuần riêng của một cấp (YCTD-152); cấp không có dòng thì theo năm học
// Khung giờ tiết học theo năm học và cấp (DT-20 phần 22c1, YCTD-160)
export type PeriodSession = 'morning' | 'afternoon';

export interface PeriodSlotsTable {
  id: Generated<string>;
  academic_year_id: string;
  school_level: CalendarSchoolLevel;
  period_no: number;
  session: PeriodSession;
  start_time: string;
  end_time: string;
  created_at: CreatedTimestamp;
  created_by: string | null;
}

export interface AcademicYearLevelSettingsTable {
  academic_year_id: string;
  school_level: CalendarSchoolLevel;
  school_days_of_week: ColumnType<number[], number[], number[]>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface AcademicYearDatabasesTable {
  id: Generated<string>;
  academic_year_id: string;
  database_name: string;
  status: AcademicYearDatabaseStatus;
  opened_at: Date;
  closed_at: Date | null;
  carried_over_by: string | null;
  // Giờ chuyển xong hồ sơ lên năm học (DT-16 phần 16e), dùng cho "Hủy" chuyển hồ sơ
  carried_over_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

// Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d)
export type IntegrationCredentialConnector = 'zalo' | 'moet_sync' | 'doet_sync';

// Khóa truy cập kết nối ngoài đã mã hóa, dùng chung toàn trường qua các năm học (YCTD-92)
export interface IntegrationCredentialsTable {
  connector: IntegrationCredentialConnector;
  id: Generated<string>;
  access_token_encrypted: string | null;
  access_token_expires_at: Date | null;
  refresh_token_encrypted: string | null;
  refreshed_at: Date | null;
  // Tài khoản đồng bộ của Bộ, của Sở: tên đăng nhập và mật khẩu đã mã hóa (DT-16 phần 16d)
  account_username: ColumnType<string | null, string | null | undefined, string | null>;
  account_secret_encrypted: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

// Lối tắt truy cập nhanh trên trang chủ cổng quản trị, riêng từng tài khoản (YCTD-102)
export interface UserQuickLinksTable {
  id: Generated<string>;
  user_id: string;
  path: string;
  label: string;
  position: number;
  created_at: CreatedTimestamp;
}

// Cấu hình lưới dữ liệu riêng từng tài khoản: cột hiển thị theo thứ tự, số dòng mỗi trang (DT-15 phần 15a)
export interface UserGridSettingsValue {
  columns?: string[];
  page_size?: number;
}

export interface UserGridSettingsTable {
  id: Generated<string>;
  user_id: string;
  grid_key: string;
  settings: ColumnType<UserGridSettingsValue, string, string>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type UserFeedbackType = 'suggestion' | 'bug' | 'request';
export type UserFeedbackStatus = 'new' | 'in_progress' | 'resolved';

// Ý kiến phản hồi gửi từ chân trang cổng quản trị và trả lời của quản trị (DT-15 phần 15g, YCTD-110)
export interface UserFeedbackTable {
  id: Generated<string>;
  user_id: string;
  user_name: string;
  org_unit_id: string | null;
  page_url: string | null;
  feedback_type: UserFeedbackType;
  title: string;
  content: string;
  contact_phone: string | null;
  contact_email: string | null;
  attachment_key: string | null;
  attachment_name: string | null;
  attachment_content_type: string | null;
  attachment_size: number | null;
  status: Generated<UserFeedbackStatus>;
  reply: string | null;
  replied_by: string | null;
  replied_by_name: string | null;
  replied_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export type AdministrativePeriod = 'old' | 'new';
export type AdministrativeLevel = 'province' | 'district' | 'ward';
export type AdministrativeSource = 'official' | 'import';

// Danh mục địa danh hành chính trước và sau sắp xếp năm 2025 (DT-15 phần 15h1): đơn vị cũ có tỉnh, quận/huyện, xã; đơn vị
// mới có tỉnh, xã; name_key là khóa so khớp tên (administrativeNameKey)
export interface AdministrativeUnitsTable {
  id: Generated<string>;
  period: AdministrativePeriod;
  level: AdministrativeLevel;
  code: string | null;
  name: string;
  name_key: string;
  parent_id: string | null;
  source: Generated<AdministrativeSource>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

// Đối chiếu xã/phường cũ sang xã/phường mới; một xã cũ chia cho nhiều xã mới thì có nhiều dòng
export interface AdministrativeUnitMappingsTable {
  id: Generated<string>;
  old_unit_id: string;
  new_unit_id: string;
  source: Generated<AdministrativeSource>;
  created_at: CreatedTimestamp;
  created_by: string | null;
}

export type ArchiveRetention = 'permanent' | 'limited';
export type ArchiveRecordStatus = 'pending' | 'completed';

// Phông lưu trữ của trường (DT-15 phần 15h2, YCTD-118)
export interface ArchiveFondsTable {
  id: Generated<string>;
  code: string;
  name: string;
  note: string | null;
  org_unit_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
  updated_by: string | null;
}

// Thông tin lưu trữ của một phông theo giai đoạn; số mét giá kiểu numeric nên đọc ra là chuỗi
export interface ArchiveHoldingsTable {
  id: Generated<string>;
  fond_id: string;
  period_from_year: number;
  period_to_year: number;
  arranged: boolean;
  expired: Generated<boolean>;
  retention: ArchiveRetention;
  retention_years: number | null;
  bundle_count: Generated<number>;
  box_count: Generated<number>;
  shelf_meters: ColumnType<string, number | string | undefined, number | string>;
  storage_location: string;
  note: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
  updated_by: string | null;
}

// Hồ sơ tài liệu hoàn thành, chưa hoàn thành
export interface ArchiveRecordsTable {
  id: Generated<string>;
  code: string;
  title: string;
  fond_id: string | null;
  handler_name: string;
  org_unit_id: string | null;
  handler_staff_id: string | null;
  due_reminded_at: Date | null;
  overdue_reminded_at: Date | null;
  opened_on: DateText;
  due_date: ColumnType<string | null, string | null | undefined, string | null>;
  status: Generated<ArchiveRecordStatus>;
  completed_on: ColumnType<string | null, string | null | undefined, string | null>;
  retention: ArchiveRetention;
  retention_years: number | null;
  sheet_count: number | null;
  note: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
  updated_by: string | null;
}

// Tệp đính kèm của hồ sơ tài liệu; nội dung ở kho tệp theo storage_key
export interface ArchiveRecordFilesTable {
  id: Generated<string>;
  record_id: string;
  storage_key: string;
  file_name: string;
  content_type: string;
  size: number;
  created_at: CreatedTimestamp;
  created_by: string | null;
}

// Tệp ở kho tệp chờ xóa lại sau lần xóa lỗi (YCTD-122)
export interface ArchiveFileDeletionsTable {
  storage_key: string;
  attempts: Generated<number>;
  last_error: string | null;
  created_at: CreatedTimestamp;
  last_attempt_at: Date | null;
}

// Gói toàn bộ dữ liệu của trường là tệp ZIP (DT-18 phần 18h)
export type ExportJobFormat = 'xlsx' | 'pdf' | 'zip';
export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'expired';

// Tác vụ xuất nền và danh sách "Tệp đã tạo" (DT-16 phần 16a): user_snapshot là vai trò, quyền của người tạo lúc tạo
export interface ExportJobsTable {
  id: Generated<string>;
  user_id: string;
  user_name: string;
  user_snapshot: ColumnType<unknown, string, string>;
  report_code: string;
  title: string;
  format: ExportJobFormat;
  parameters: ColumnType<Record<string, unknown>, string, string>;
  ip_address: string | null;
  status: Generated<ExportJobStatus>;
  attempts: Generated<number>;
  row_count: number | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  storage_key: string | null;
  error_message: string | null;
  created_at: CreatedTimestamp;
  started_at: Date | null;
  finished_at: Date | null;
  expires_at: Date | null;
}

// Nhật ký tải tệp đã tạo (DT-18 phần 18h)
export interface ExportJobDownloadsTable {
  id: Generated<string>;
  export_job_id: string;
  user_id: string;
  user_name: string;
  ip_address: string | null;
  downloaded_at: CreatedTimestamp;
}

// Thao tác trên máy chủ API trong lúc đăng nhập thay (DT-18 phần 18h)
export interface ImpersonationActionsTable {
  id: Generated<string>;
  impersonation_id: string;
  impersonator_user_id: string;
  impersonator_name: string;
  target_user_id: string;
  target_name: string;
  method: string;
  path: string;
  status_code: number;
  ip_address: string | null;
  created_at: CreatedTimestamp;
}

// Tài khoản trình diễn hiện ở trang chọn vai; mật khẩu chung của bản trình diễn ở DEMO_PASSWORD (gói dùng chung)
export interface DemoAccount {
  login: string;
  full_name: string;
  role_code: string;
  role_name: string;
  app: 'portal' | 'teacher' | 'parent';
}

// Dấu bản trình diễn (DT-18 phần 18h): chỉ lệnh tạo dữ liệu trình diễn ghi
export interface DemoEnvironmentTable {
  id: Generated<number>;
  seed_version: string;
  seeded_at: Date;
  reset_interval_hours: Generated<number>;
  next_reset_at: Date | null;
  accounts: ColumnType<DemoAccount[], string, string>;
}

export type UpperLevelSubmissionStatus = 'draft' | 'sent' | 'unlock_requested' | 'resend';
export type UpperLevelSubmissionAction =
  'export' | 'mark_sent' | 'unlock_request' | 'unlock' | 'unlock_reject' | 'resend';

// Trạng thái gửi biểu mẫu lên cấp trên theo năm học, chạy nội bộ (DT-16 phần 16a)
export interface UpperLevelSubmissionsTable {
  id: Generated<string>;
  academic_year_id: string;
  form_code: string;
  status: Generated<UpperLevelSubmissionStatus>;
  no_data: Generated<boolean>;
  data_complete: boolean | null;
  snapshot: ColumnType<unknown, string | null, string | null>;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  storage_key: string | null;
  exported_at: Date | null;
  exported_by: string | null;
  exported_by_name: string | null;
  sent_on: DateText | null;
  sent_note: string | null;
  sent_by: string | null;
  sent_by_name: string | null;
  marked_sent_at: Date | null;
  unlock_reason: string | null;
  unlock_requested_by: string | null;
  unlock_requested_by_name: string | null;
  unlock_requested_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export interface UpperLevelSubmissionEventsTable {
  id: Generated<string>;
  submission_id: string;
  action: UpperLevelSubmissionAction;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Thông báo hệ thống bật lên khi vào cổng quản trị (DT-16 phần 16c); ngày dạng YYYY-MM-DD
export interface SystemAnnouncementsTable {
  id: Generated<string>;
  title: string;
  content: string;
  valid_from: ColumnType<string, string, string>;
  valid_until: ColumnType<string | null, string | null | undefined, string | null>;
  is_active: Generated<boolean>;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

// Ứng dụng liên kết ở lưới ứng dụng trên thanh đầu trang (DT-16 phần 16c)
export interface PortalAppLinksTable {
  id: Generated<string>;
  name: string;
  url: string;
  description: string | null;
  position: number;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

// Phân hệ Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k): chứng thư số nhà trường, hồ sơ kí theo năm học, lịch sử thao tác
// Kiểu HSM bỏ ở DT-17 phần 17b (migration 0017) theo biểu mẫu của Sở
export type SigningSignatureType = 'remote' | 'usb_token';
export type SigningCertificateStatus = 'draft' | 'registered' | 'revoked';
export type SigningSyncStatus = 'not_synced' | 'synced';
export type SigningObjectType = 'school' | 'class' | 'staff' | 'child' | 'class_log';
export type SigningDossierStatus = 'created' | 'signed' | 'completed' | 'sent' | 'cancelled';
export type SigningEventAction =
  | 'certificate_save'
  | 'certificate_register'
  | 'certificate_revoke'
  | 'seal_upload'
  | 'seal_delete'
  | 'certificate_sync'
  | 'certificate_unsync'
  | 'create'
  | 'sign'
  | 'check_changes'
  | 'cancel'
  | 'complete'
  | 'uncomplete'
  | 'mark_sent';

export interface SigningCertificatesTable {
  id: Generated<string>;
  singleton: Generated<boolean>;
  signature_type: Generated<SigningSignatureType>;
  provider: string | null;
  login_name: string | null;
  holder_name: string | null;
  holder_title: string | null;
  serial_number: string | null;
  valid_from: DateText | null;
  valid_to: DateText | null;
  status: Generated<SigningCertificateStatus>;
  registered_at: Date | null;
  registered_by: string | null;
  registered_by_name: string | null;
  sync_status: Generated<SigningSyncStatus>;
  synced_on: DateText | null;
  sync_note: string | null;
  synced_by: string | null;
  synced_by_name: string | null;
  seal_file_name: string | null;
  seal_content_type: string | null;
  seal_storage_key: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export interface SigningDossiersTable {
  id: Generated<string>;
  academic_year_id: string;
  code: string;
  object_type: SigningObjectType;
  object_id: string;
  // Tháng của sổ đầu bài (YYYY-MM); đối tượng khác để trống
  period: Generated<string>;
  object_label: string;
  status: Generated<SigningDossierStatus>;
  snapshot: ColumnType<unknown, string, string>;
  content_hash: string;
  file_name: string;
  storage_key: string;
  file_sha256: string;
  size_bytes: number;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  signature_method: string | null;
  signed_file_name: string | null;
  signed_storage_key: string | null;
  signed_sha256: string | null;
  signed_size_bytes: number | null;
  signed_at: Date | null;
  signed_by: string | null;
  signed_by_name: string | null;
  changed_at: Date | null;
  change_summary: string | null;
  checked_at: Date | null;
  completed_at: Date | null;
  completed_by: string | null;
  completed_by_name: string | null;
  sent_on: DateText | null;
  sent_note: string | null;
  sent_by: string | null;
  sent_by_name: string | null;
  marked_sent_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  updated_at: UpdatedTimestamp;
  // Tệp dữ liệu XML của hồ sơ và ghi chú trên lưới (DT-17 phần 17b); hồ sơ lập trước 17b không có tệp XML
  xml_file_name: ColumnType<string | null, string | null | undefined, string | null>;
  xml_storage_key: ColumnType<string | null, string | null | undefined, string | null>;
  xml_sha256: ColumnType<string | null, string | null | undefined, string | null>;
  xml_size_bytes: ColumnType<number | null, number | null | undefined, number | null>;
  note: ColumnType<string | null, string | null | undefined, string | null>;
}

// Đối tượng tạo hồ sơ kí không được, lần lỗi gần nhất (DT-17 phần 17b): cột Ghi chú và "Tải file lỗi" của 2.2
export interface SigningCreateErrorsTable {
  id: Generated<string>;
  academic_year_id: string;
  object_type: SigningObjectType;
  object_id: string;
  period: Generated<string>;
  object_label: string;
  reason: string;
  created_by: string;
  created_by_name: string;
  // Lần lỗi gần nhất ghi đè thời điểm
  created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface SigningEventsTable {
  id: Generated<string>;
  // Trống là thao tác trên chứng thư số
  dossier_id: string | null;
  action: SigningEventAction;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138)
export type DocumentCatalogKind = 'form' | 'urgency' | 'secrecy' | 'field';
export type DocumentBookDirection = 'incoming' | 'outgoing';
export type DocumentBookMemberRole = 'follower' | 'admin';
export type IncomingDocumentStatus = 'pending_registration' | 'registered' | 'processing' | 'completed';
export type IncomingDocumentAuthority = 'normal' | 'outside';
export type IncomingDocumentKind = 'new' | 'revoke' | 'replace';
export type IncomingTransferMethod = 'hand' | 'post' | 'email' | 'interconnect';
export type IncomingCopyType = 'original' | 'certified_copy' | 'transcribed_copy' | 'extract_copy';
// internal: nhận qua liên thông nội bộ từ văn bản đi của trường (phần 18b)
export type IncomingDocumentSource = 'manual' | 'interconnect' | 'internal';
export type IncomingInterconnectStatus = 'received' | 'acknowledged';
export type IncomingFileKind = 'main' | 'related';
export type IncomingAssignmentRole = 'leader' | 'main' | 'coordinate' | 'view';
export type IncomingAssignmentStatus = 'pending' | 'forwarded' | 'done' | 'returned' | 'revoked' | 'refused' | 'closed';
export type IncomingExtensionStatus = 'requested' | 'approved' | 'rejected';

export interface DocumentCatalogItemsTable {
  id: Generated<string>;
  kind: DocumentCatalogKind;
  code: string;
  name: string;
  // 0 thường, 1 khẩn hoặc mật, 2 hỏa tốc hoặc tối mật
  level: Generated<number>;
  // Trống là dùng cho mọi cấp học
  education_level: string | null;
  sort_order: Generated<number>;
  active: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExternalUnitsTable {
  id: Generated<string>;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  // Mã định danh điện tử của cơ quan trên trục liên thông văn bản
  electronic_code: string | null;
  sort_order: Generated<number>;
  active: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExternalUnitGroupsTable {
  id: Generated<string>;
  name: string;
  note: string | null;
  sort_order: Generated<number>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExternalUnitGroupMembersTable {
  group_id: string;
  unit_id: string;
}

export interface DocumentBooksTable {
  id: Generated<string>;
  direction: DocumentBookDirection;
  name: string;
  // Đơn vị áp dụng ở cây đơn vị của năm học; trống là toàn trường
  org_unit_id: string | null;
  year: number;
  start_number: Generated<number>;
  start_date: DateText;
  end_date: DateText | null;
  sort_order: Generated<number>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DocumentBookMembersTable {
  book_id: string;
  user_id: string;
  user_name: string;
  role: DocumentBookMemberRole;
}

export interface DocumentLeadersTable {
  user_id: string;
  user_name: string;
  title: string | null;
  sort_order: Generated<number>;
  created_at: CreatedTimestamp;
}

export interface IncomingDocumentsTable {
  id: Generated<string>;
  // Trống khi văn bản nhận qua liên thông còn chờ vào sổ
  book_id: string | null;
  arrival_number: number | null;
  arrival_date: DateText | null;
  summary: string;
  symbol: string;
  issuer_unit_id: string | null;
  issuer_name: string;
  document_date: DateText;
  form_id: string | null;
  urgency_id: string | null;
  secrecy_id: string | null;
  field_id: string | null;
  deadline: DateText | null;
  authority: Generated<IncomingDocumentAuthority>;
  document_kind: Generated<IncomingDocumentKind>;
  transfer_method: Generated<IncomingTransferMethod>;
  copy_type: Generated<IncomingCopyType>;
  has_paper: Generated<boolean>;
  processing_note: string | null;
  status: Generated<IncomingDocumentStatus>;
  restricted: Generated<boolean>;
  restricted_at: Date | null;
  restricted_by: string | null;
  restricted_by_name: string | null;
  source: Generated<IncomingDocumentSource>;
  interconnect_status: IncomingInterconnectStatus | null;
  interconnect_reference: string | null;
  received_at: Date | null;
  acknowledged_at: Date | null;
  acknowledged_by_name: string | null;
  reply_symbol: string | null;
  reply_date: DateText | null;
  reply_note: string | null;
  replied_at: Date | null;
  replied_by_name: string | null;
  archive_record_id: string | null;
  archived_at: Date | null;
  archived_by_name: string | null;
  completed_at: Date | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completion_note: string | null;
  registered_at: Date | null;
  registered_by: string | null;
  registered_by_name: string | null;
  // Liên thông nội bộ (phần 18b): văn bản đi nguồn, đơn vị nhận trong trường
  outgoing_document_id: string | null;
  recipient_org_unit_id: string | null;
  recipient_org_unit_name: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface IncomingDocumentFilesTable {
  id: Generated<string>;
  document_id: string;
  kind: Generated<IncomingFileKind>;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  scanned: Generated<boolean>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface IncomingDocumentRelationsTable {
  document_id: string;
  related_id: string;
}

export interface IncomingDocumentAssignmentsTable {
  id: Generated<string>;
  document_id: string;
  // Dòng của người chuyển; trống là văn thư chuyển từ sổ
  parent_id: string | null;
  user_id: string;
  user_name: string;
  user_title: string | null;
  role: IncomingAssignmentRole;
  status: Generated<IncomingAssignmentStatus>;
  deadline: DateText | null;
  note: string | null;
  result_note: string | null;
  assigned_by: string;
  assigned_by_name: string;
  created_at: CreatedTimestamp;
  read_at: Date | null;
  finished_at: Date | null;
  extension_until: DateText | null;
  extension_reason: string | null;
  extension_status: IncomingExtensionStatus | null;
  extension_decided_at: Date | null;
  extension_decided_by_name: string | null;
}

export interface IncomingDocumentFlagsTable {
  document_id: string;
  user_id: string;
  starred: Generated<boolean>;
  followed: Generated<boolean>;
  updated_at: UpdatedTimestamp;
}

export interface IncomingDocumentEventsTable {
  id: Generated<string>;
  document_id: string;
  action: string;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140)
export type OutgoingDocumentStatus = 'draft' | 'consulting' | 'pending_signature' | 'signed' | 'issued';
export type OutgoingFileKind = 'draft' | 'submission' | 'attachment' | 'signed';
export type OutgoingLinkType = 'related' | 'original';
export type OutgoingOpinionStatus = 'pending' | 'answered' | 'finished' | 'closed';
export type OutgoingRecipientType = 'external' | 'internal';
export type OutgoingSendStatus = 'pending' | 'sent' | 'delivered';

export interface OutgoingDocumentsTable {
  id: Generated<string>;
  // Số eOffice: số thứ tự của phần mềm, cấp khi tạo dự thảo
  eoffice_number: number;
  // Số trình ký do người soạn ghi
  submission_number: string | null;
  summary: string;
  form_id: string | null;
  urgency_id: string | null;
  secrecy_id: string | null;
  field_id: string | null;
  document_kind: Generated<IncomingDocumentKind>;
  priority: Generated<boolean>;
  meeting_at: Date | null;
  meeting_place: string | null;
  insert_qr: Generated<boolean>;
  drafter_id: string;
  drafter_name: string;
  // Đơn vị soạn thảo ở cây đơn vị của năm học, tên ghi lại lúc chọn
  drafting_unit_id: string | null;
  drafting_unit_name: string | null;
  signer_id: string | null;
  signer_name: string | null;
  signer_title: string | null;
  content_note: string | null;
  status: Generated<OutgoingDocumentStatus>;
  return_note: string | null;
  returned_at: Date | null;
  returned_by_name: string | null;
  submitted_at: Date | null;
  signed_at: Date | null;
  signature_method: string | null;
  // Mã tra cứu in trong mã QR của bản đã ký
  verification_code: string | null;
  book_id: string | null;
  issue_number: number | null;
  symbol: string | null;
  issue_date: DateText | null;
  copies: number | null;
  issued_at: Date | null;
  issued_by: string | null;
  issued_by_name: string | null;
  // Công bố lên website trường; phần 18f đọc
  published: Generated<boolean>;
  published_at: Date | null;
  published_by_name: string | null;
  frozen: Generated<boolean>;
  frozen_at: Date | null;
  frozen_by_name: string | null;
  archive_record_id: string | null;
  archived_at: Date | null;
  archived_by_name: string | null;
  // Văn bản đến được trả lời
  reply_to_id: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface OutgoingDocumentFilesTable {
  id: Generated<string>;
  document_id: string;
  kind: Generated<OutgoingFileKind>;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface OutgoingDocumentLinksTable {
  id: Generated<string>;
  document_id: string;
  link_type: OutgoingLinkType;
  outgoing_id: string | null;
  incoming_id: string | null;
}

export interface OutgoingDocumentOpinionsTable {
  id: Generated<string>;
  document_id: string;
  round: number;
  user_id: string;
  user_name: string;
  user_title: string | null;
  status: Generated<OutgoingOpinionStatus>;
  deadline: DateText | null;
  request_note: string | null;
  opinion: string | null;
  answered_at: Date | null;
  requested_by: string;
  requested_by_name: string;
  created_at: CreatedTimestamp;
  finished_at: Date | null;
}

export interface OutgoingDocumentRecipientsTable {
  id: Generated<string>;
  document_id: string;
  recipient_type: OutgoingRecipientType;
  external_unit_id: string | null;
  org_unit_id: string | null;
  name: string;
  electronic_code: string | null;
  send_status: Generated<OutgoingSendStatus>;
  sent_at: Date | null;
  sent_by_name: string | null;
  reference: string | null;
  incoming_document_id: string | null;
  sort_order: Generated<number>;
}

export interface OutgoingDocumentEventsTable {
  id: Generated<string>;
  document_id: string;
  action: string;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Lịch đơn vị, phòng họp, hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141)
export type RoomBookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ScheduleSession = 'morning' | 'afternoon';
export type ScheduleEntryStatus = 'draft' | 'published';
export type WorkFileStatus = 'open' | 'closed' | 'submitted' | 'returned' | 'archived';
export type WorkFileSharePermission = 'view' | 'edit';
export type WorkFileItemType = 'incoming_document' | 'task' | 'note';

// Một dòng của mẫu lịch tuần: thứ (1 là thứ Hai đến 7 là Chủ nhật), buổi và nội dung như dòng lịch
export interface ScheduleTemplateItem {
  weekday: number;
  session: ScheduleSession;
  start_time: string | null;
  end_time: string | null;
  content: string;
  chair_name: string | null;
  participants: string | null;
  location: string | null;
  note: string | null;
}

export interface MeetingRoomsTable {
  id: Generated<string>;
  name: string;
  location: string | null;
  capacity: number | null;
  equipment: string | null;
  sort_order: Generated<number>;
  active: Generated<boolean>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface RoomBookingsTable {
  id: Generated<string>;
  room_id: string;
  title: string;
  chair_name: string | null;
  participants: string | null;
  starts_at: Date;
  ends_at: Date;
  note: string | null;
  status: Generated<RoomBookingStatus>;
  requested_by: string;
  requested_by_name: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UnitScheduleEntriesTable {
  id: Generated<string>;
  org_unit_id: string | null;
  entry_date: DateText;
  session: ScheduleSession;
  start_time: string | null;
  end_time: string | null;
  content: string;
  chair_name: string | null;
  participants: string | null;
  location: string | null;
  note: string | null;
  room_booking_id: string | null;
  status: Generated<ScheduleEntryStatus>;
  published_at: Date | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface UnitScheduleAttendeesTable {
  entry_id: string;
  user_id: string;
  user_name: string;
}

export interface UnitScheduleTemplatesTable {
  id: Generated<string>;
  name: string;
  org_unit_id: string | null;
  items: ColumnType<ScheduleTemplateItem[], string, string>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface WorkFilesTable {
  id: Generated<string>;
  code: string;
  title: string;
  year: number;
  description: string | null;
  org_unit_id: string | null;
  owner_user_id: string;
  owner_name: string;
  status: Generated<WorkFileStatus>;
  retention: Generated<ArchiveRetention>;
  retention_years: number | null;
  opened_on: DateText;
  closed_on: ColumnType<string | null, string | null | undefined, string | null>;
  transferred_from_user_id: string | null;
  transferred_from_name: string | null;
  transferred_at: Date | null;
  transfer_note: string | null;
  submitted_at: Date | null;
  return_note: string | null;
  archive_record_id: string | null;
  archived_on: ColumnType<string | null, string | null | undefined, string | null>;
  archived_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface WorkFileSharesTable {
  file_id: string;
  user_id: string;
  user_name: string;
  permission: Generated<WorkFileSharePermission>;
  created_at: CreatedTimestamp;
}

export interface WorkFileItemsTable {
  id: Generated<string>;
  file_id: string;
  item_type: WorkFileItemType;
  incoming_document_id: string | null;
  task_id: string | null;
  title: string;
  note: string | null;
  added_by: string;
  added_by_name: string;
  created_at: CreatedTimestamp;
}

export interface WorkFileEventsTable {
  id: Generated<string>;
  file_id: string;
  action: string;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Website trường trên tên miền riêng (DT-18 phần 18f, YCTD-144)
export type WebsiteContentStatus = 'draft' | 'pending' | 'published' | 'unpublished';
export type WebsitePostKind = 'news' | 'announcement' | 'page' | 'disclosure';
export type WebsiteDomainKind = 'primary' | 'alias' | 'demo';
export type WebsiteFileOwner = 'post' | 'album' | 'settings';
export type WebsiteFilePurpose = 'cover' | 'attachment' | 'photo' | 'logo' | 'banner';
export type WebsiteEventTarget = 'post' | 'album' | 'settings' | 'domain' | 'contact';

export interface WebsiteFilesTable {
  id: Generated<string>;
  owner_type: WebsiteFileOwner;
  owner_id: string | null;
  purpose: WebsiteFilePurpose;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  caption: string | null;
  order_no: Generated<number>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface WebsiteSettingsTable {
  id: Generated<number>;
  site_name: Generated<string>;
  slogan: string | null;
  introduction: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  map_url: string | null;
  office_hours: string | null;
  facebook_url: string | null;
  admission_form_url: string | null;
  footer_note: string | null;
  primary_color: Generated<string>;
  school_levels: ColumnType<string[], string[] | undefined, string[]>;
  show_timetable: Generated<boolean>;
  demo_mode: Generated<boolean>;
  logo_file_id: string | null;
  banner_file_id: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface WebsiteDomainsTable {
  id: Generated<string>;
  hostname: string;
  kind: WebsiteDomainKind;
  active: Generated<boolean>;
  dns_confirmed_at: Date | null;
  dns_confirmed_by_name: string | null;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface WebsiteDisclosureCategoriesTable {
  code: string;
  name: string;
  legal_basis: string | null;
  // MN: mầm non; PT: phổ thông; trống: mọi cấp học
  school_level: string | null;
  order_no: Generated<number>;
  active: Generated<boolean>;
}

interface WebsiteWorkflowColumns {
  status: Generated<WebsiteContentStatus>;
  return_note: string | null;
  submitted_at: Date | null;
  submitted_by_name: string | null;
  published_at: Date | null;
  first_published_at: Date | null;
  published_by_name: string | null;
  unpublished_at: Date | null;
  unpublished_by_name: string | null;
  unpublish_reason: string | null;
  is_sample: Generated<boolean>;
  created_by: string;
  created_by_name: string;
  updated_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface WebsitePostsTable extends WebsiteWorkflowColumns {
  id: Generated<string>;
  kind: WebsitePostKind;
  page_key: string | null;
  disclosure_category: string | null;
  disclosure_year: string | null;
  slug: string;
  title: string;
  summary: string | null;
  body_html: Generated<string>;
  cover_file_id: string | null;
  pinned: Generated<boolean>;
}

export interface WebsiteAlbumsTable extends WebsiteWorkflowColumns {
  id: Generated<string>;
  slug: string;
  title: string;
  description: string | null;
  event_date: ColumnType<string | null, string | null | undefined, string | null>;
  cover_file_id: string | null;
  consent_confirmed: Generated<boolean>;
  consent_confirmed_by_name: string | null;
}

export interface WebsiteContactMessagesTable {
  id: Generated<string>;
  full_name: string;
  phone: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: Generated<'new' | 'handled'>;
  handled_note: string | null;
  handled_at: Date | null;
  handled_by_name: string | null;
  created_at: CreatedTimestamp;
}

export interface WebsiteEventsTable {
  id: Generated<string>;
  target_type: WebsiteEventTarget;
  target_id: string | null;
  action: string;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Cấp học của trường (DT-19 phần 19a): bốn mã cố định, bật hay tắt, tên hiển thị, thuật ngữ gọi người học
export interface SchoolLevelsTable {
  code: string;
  is_enabled: Generated<boolean>;
  order_no: number;
  display_name: string;
  learner_term: string;
  context_label: string;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

// Danh mục hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182)
export type TrainingCatalogStatus = 'active' | 'inactive';

export interface TrainingSettingsTable {
  id: Generated<number>;
  annual_required_periods: Generated<number>;
  competency_gap_level: Generated<number>;
  certificate_issuer: string | null;
  legal_basis: string | null;
  updated_at: Generated<Date>;
  updated_by: string | null;
}

export interface DigitalCompetencyDomainsTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  order_no: Generated<number>;
  status: Generated<TrainingCatalogStatus>;
  created_at: Generated<Date>;
}

export interface DigitalCompetencyLevelsTable {
  level_no: number;
  name: string;
  description: string | null;
}

export interface TrainingTopicsTable {
  id: Generated<string>;
  code: string;
  name: string;
  program_no: number;
  default_periods: Generated<number>;
  competency_domain_code: string | null;
  order_no: Generated<number>;
  status: Generated<TrainingCatalogStatus>;
  created_at: Generated<Date>;
}

// Khung biểu báo cáo cấu hình được, EMIS Tiểu học (DT-20 phần 20f, YCTD-165)
export type ReportFormPeriod = 'start_of_year' | 'end_of_year';
export type ReportFormRowKind = 'heading' | 'formula' | 'manual';

export interface ReportFormsTable {
  id: Generated<string>;
  code: string;
  name: string;
  school_level: CalendarSchoolLevel;
  period: ReportFormPeriod;
  columns: ColumnType<Array<{ key: string; label: string }>, string, string>;
  note: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface ReportFormRowsTable {
  id: Generated<string>;
  form_id: string;
  order_no: number;
  code: string;
  label: string;
  unit: string | null;
  kind: ReportFormRowKind;
  formula: string | null;
}

export interface SystemDatabase {
  academic_years: AcademicYearsTable;
  academic_terms: AcademicTermsTable;
  school_weeks: SchoolWeeksTable;
  academic_year_databases: AcademicYearDatabasesTable;
  academic_year_level_settings: AcademicYearLevelSettingsTable;
  period_slots: PeriodSlotsTable;
  report_forms: ReportFormsTable;
  report_form_rows: ReportFormRowsTable;
  training_settings: TrainingSettingsTable;
  digital_competency_domains: DigitalCompetencyDomainsTable;
  digital_competency_levels: DigitalCompetencyLevelsTable;
  training_topics: TrainingTopicsTable;
  integration_credentials: IntegrationCredentialsTable;
  user_quick_links: UserQuickLinksTable;
  user_grid_settings: UserGridSettingsTable;
  feedback: UserFeedbackTable;
  administrative_units: AdministrativeUnitsTable;
  administrative_unit_mappings: AdministrativeUnitMappingsTable;
  archive_fonds: ArchiveFondsTable;
  archive_holdings: ArchiveHoldingsTable;
  archive_records: ArchiveRecordsTable;
  archive_record_files: ArchiveRecordFilesTable;
  archive_file_deletions: ArchiveFileDeletionsTable;
  export_jobs: ExportJobsTable;
  export_job_downloads: ExportJobDownloadsTable;
  impersonation_actions: ImpersonationActionsTable;
  demo_environment: DemoEnvironmentTable;
  upper_level_submissions: UpperLevelSubmissionsTable;
  upper_level_submission_events: UpperLevelSubmissionEventsTable;
  system_announcements: SystemAnnouncementsTable;
  portal_app_links: PortalAppLinksTable;
  signing_certificates: SigningCertificatesTable;
  signing_dossiers: SigningDossiersTable;
  signing_events: SigningEventsTable;
  signing_create_errors: SigningCreateErrorsTable;
  document_catalog_items: DocumentCatalogItemsTable;
  external_units: ExternalUnitsTable;
  external_unit_groups: ExternalUnitGroupsTable;
  external_unit_group_members: ExternalUnitGroupMembersTable;
  document_books: DocumentBooksTable;
  document_book_members: DocumentBookMembersTable;
  document_leaders: DocumentLeadersTable;
  incoming_documents: IncomingDocumentsTable;
  incoming_document_files: IncomingDocumentFilesTable;
  incoming_document_relations: IncomingDocumentRelationsTable;
  incoming_document_assignments: IncomingDocumentAssignmentsTable;
  incoming_document_flags: IncomingDocumentFlagsTable;
  incoming_document_events: IncomingDocumentEventsTable;
  outgoing_documents: OutgoingDocumentsTable;
  outgoing_document_files: OutgoingDocumentFilesTable;
  outgoing_document_links: OutgoingDocumentLinksTable;
  outgoing_document_opinions: OutgoingDocumentOpinionsTable;
  outgoing_document_recipients: OutgoingDocumentRecipientsTable;
  outgoing_document_events: OutgoingDocumentEventsTable;
  meeting_rooms: MeetingRoomsTable;
  room_bookings: RoomBookingsTable;
  unit_schedule_entries: UnitScheduleEntriesTable;
  unit_schedule_attendees: UnitScheduleAttendeesTable;
  unit_schedule_templates: UnitScheduleTemplatesTable;
  work_files: WorkFilesTable;
  work_file_shares: WorkFileSharesTable;
  work_file_items: WorkFileItemsTable;
  work_file_events: WorkFileEventsTable;
  website_files: WebsiteFilesTable;
  website_settings: WebsiteSettingsTable;
  website_domains: WebsiteDomainsTable;
  website_disclosure_categories: WebsiteDisclosureCategoriesTable;
  website_posts: WebsitePostsTable;
  website_albums: WebsiteAlbumsTable;
  website_contact_messages: WebsiteContactMessagesTable;
  website_events: WebsiteEventsTable;
  school_levels: SchoolLevelsTable;
}

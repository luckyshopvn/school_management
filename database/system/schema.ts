import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu hệ thống, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;
type DateText = ColumnType<string, string, string>;

export type AcademicYearStatus = 'draft' | 'open' | 'closed';
export type AcademicTermType = 'first_term' | 'second_term' | 'summer_term';
export type AcademicYearDatabaseStatus = 'active' | 'read_only';

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

export type ExportJobFormat = 'xlsx' | 'pdf';
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
export type IncomingDocumentSource = 'manual' | 'interconnect';
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

export interface SystemDatabase {
  academic_years: AcademicYearsTable;
  academic_terms: AcademicTermsTable;
  school_weeks: SchoolWeeksTable;
  academic_year_databases: AcademicYearDatabasesTable;
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
}

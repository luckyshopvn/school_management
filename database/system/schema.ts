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
}

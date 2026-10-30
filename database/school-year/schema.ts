import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu năm học, khớp với tệp thay đổi cấu trúc
export type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
export type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;
export type JsonValue = ColumnType<unknown, string | null, string | null>;

// Bảng của từng phần nằm ở schema-parts/<phần>.ts: mỗi tệp thêm bảng vào SchoolYearDatabase bằng declare module, không sửa tệp này
// (YCTD-294); schema-parts.generated.ts do database/sinh-chi-muc.mjs sinh khi dựng
export type * from './schema-parts.generated.js';

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
  // Tọa độ, tỉnh/thành phố, phường/xã, khu phố của trường và điểm trường, lần xác nhận ở 1.8 Tuyển sinh đầu cấp (DT-17 phần
  // 17c); numeric đọc ra chuỗi
  latitude: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  longitude: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  province: ColumnType<string | null, string | null | undefined, string | null>;
  ward: ColumnType<string | null, string | null | undefined, string | null>;
  quarter: ColumnType<string | null, string | null | undefined, string | null>;
  map_confirmed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  map_confirmed_by_name: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Xây dựng mới trong năm, cột "Xây dựng mới" của 1.2.1 Báo cáo cơ sở vật chất của TP.HCM (DT-17 phần 17a)
  built_this_year: Generated<boolean>;
}

// Bốn mã cấp học cố định (DT-19 phần 19b, YCTD-152); thêm cấp phải sửa mã, không sửa dữ liệu
export type SchoolLevelCode = 'MN' | 'TH' | 'THCS' | 'THPT';

export interface GradeLevelsTable extends CatalogRecordColumns {
  code: string;
  name: string;
  // Tháng tuổi bắt buộc ở khối Mầm non, tùy chọn ở khối của cấp khác (YCTD-152)
  age_from_months: number | null;
  age_to_months: number | null;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  school_level: ColumnType<SchoolLevelCode, SchoolLevelCode | undefined, SchoolLevelCode>;
}

// Khung chương trình theo cấp (YCTD-152): khối áp dụng trống là mọi khối của cấp; mỗi cấp một chương trình mặc định
export interface CurriculaTable extends CatalogRecordColumns {
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  grade_level_codes: ColumnType<string[], string[] | undefined, string[]>;
  is_default: Generated<boolean>;
  note: string | null;
  status: Generated<CatalogStatus>;
}

// Môn học và hoạt động giáo dục theo cấp (DT-20 phần 20a, YCTD-158)
export type SubjectKind = 'subject' | 'activity';
export type SubjectAssessment = 'comment' | 'comment_and_score' | 'score';
export type SubjectOptionGroup = 'social_science' | 'natural_science' | 'technology_arts';

export interface SubjectsTable extends CatalogRecordColumns {
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  kind: ColumnType<SubjectKind, SubjectKind | undefined, SubjectKind>;
  assessment: ColumnType<SubjectAssessment, SubjectAssessment | undefined, SubjectAssessment>;
  // Nhóm môn học lựa chọn của THPT (DT-21 phần 21a, YCTD-167)
  option_group: ColumnType<SubjectOptionGroup | null, SubjectOptionGroup | null | undefined, SubjectOptionGroup | null>;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
}

// Nền THCS, THPT (DT-21 phần 21a, YCTD-167): tổ hợp môn, tổ hợp học sinh đăng ký, tổ bộ môn
export interface SubjectCombinationsTable extends CatalogRecordColumns {
  code: string;
  name: string;
  school_level: 'THCS' | 'THPT';
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
}

export interface SubjectCombinationSubjectsTable {
  combination_id: string;
  subject_id: string;
}

export type ChildCombinationStatus = 'pending' | 'approved';

export interface ChildSubjectCombinationsTable {
  child_id: string;
  combination_id: string;
  status: Generated<ChildCombinationStatus>;
  previous_combination_id: string | null;
  requested_by: string | null;
  approved_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SubjectTeamsTable extends CatalogRecordColumns {
  code: string;
  name: string;
  school_level: 'THCS' | 'THPT';
  status: Generated<CatalogStatus>;
}

export interface SubjectTeamSubjectsTable {
  team_id: string;
  subject_id: string;
}

export type SubjectTeamRole = 'head' | 'member';

// Xét tốt nghiệp THCS, THPT và hồ sơ thi (DT-21 phần 21f, YCTD-174)
export interface GraduationConfigsTable {
  school_level: 'THCS' | 'THPT';
  config: ColumnType<unknown, string, string>;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface GraduationSessionsTable {
  id: Generated<string>;
  school_level: 'THCS' | 'THPT';
  name: string;
  academic_year_name: string;
  exam_date: ColumnType<string | null, string | null | undefined, string | null>;
  status: Generated<'open' | 'finalized'>;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface GraduationRoomsTable {
  id: Generated<string>;
  session_id: string;
  code: string;
  name: string;
  capacity: number;
  proctors: string | null;
}

export interface GraduationCandidatesTable {
  id: Generated<string>;
  session_id: string;
  child_id: string;
  class_id: string;
  exam_number: string | null;
  eligible: Generated<boolean>;
  eligibility_note: string | null;
  priority_points: ColumnType<string, string | number | undefined, string | number>;
  incentive_points: ColumnType<string, string | number | undefined, string | number>;
  grade_averages: ColumnType<unknown, string | null | undefined, string | null>;
  exam_subjects: ColumnType<unknown, string | undefined, string>;
  exempt_subjects: ColumnType<unknown, string | undefined, string>;
  room_id: string | null;
}

export interface GraduationScoresTable {
  candidate_id: string;
  subject_code: string;
  score: ColumnType<string, string | number, string | number>;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface GraduationDecisionsTable {
  candidate_id: string;
  outcome: 'graduated' | 'not_graduated';
  status: Generated<'proposed' | 'confirmed'>;
  exam_average: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  score: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  note: string | null;
  certificate_no: string | null;
  decided_by_name: string | null;
  decided_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  updated_at: UpdatedTimestamp;
}

export interface GraduationMinutesTable {
  id: Generated<string>;
  session_id: string;
  kind: 'council' | 'exam_room' | 'scoring';
  title: string;
  content: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface GraduationSubmissionsTable {
  id: Generated<string>;
  session_id: string;
  kind: 'candidates' | 'results';
  file_name: string;
  exported_by_name: string;
  exported_at: CreatedTimestamp;
  status: Generated<'exported' | 'sent'>;
  sent_by_name: string | null;
  sent_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  note: string | null;
}

export interface TransferDossiersTable {
  id: Generated<string>;
  session_id: string;
  child_id: string;
  destination: string | null;
  status: Generated<'prepared' | 'sent'>;
  prepared_by_name: string;
  prepared_at: CreatedTimestamp;
  sent_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

// Sổ điểm THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21c, YCTD-170)
export type ScoreTermTypeValue = 'first_term' | 'second_term';
export type ScoreKindValue = 'regular' | 'mid' | 'final';
export type ScoreSourceValue = 'manual' | 'import' | 'exam' | 'activity';
export type RatingTermValue = 'first_term' | 'second_term' | 'year';
export type RatingValue = 'good' | 'fair' | 'pass' | 'fail';

// Cấu hình sổ điểm của cấp (hệ số, số lần đánh giá thường xuyên, ngưỡng xếp loại) lưu dạng JSON; trống là bộ mặc định
export interface ScoreConfigsTable {
  school_level: SchoolLevelCode;
  config: ColumnType<unknown, string, string>;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

// Một điểm: điểm thường xuyên có thứ tự seq (1, 2, ...), giữa kỳ, cuối kỳ seq 1; điểm kiểm tra tập trung của 22g chuyển vào
// với source = 'exam' (DT-21 phần 22g2)
export interface ScoreEntriesTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  subject_id: string;
  term_type: ScoreTermTypeValue;
  kind: ScoreKindValue;
  seq: Generated<number>;
  score: ColumnType<string, string | number, string | number>;
  source: Generated<ScoreSourceValue>;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

// Kết quả môn đánh giá bằng nhận xét và nhận xét của giáo viên môn theo học kỳ
export interface SubjectTermResultsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  subject_id: string;
  term_type: ScoreTermTypeValue;
  result: 'pass' | 'fail' | null;
  comment: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

// Xếp loại học tập, rèn luyện theo học kỳ và cả năm; suggested là gợi ý của máy lúc ghi
export interface TermRatingsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  term_type: RatingTermValue;
  learning_suggested: RatingValue | null;
  learning: RatingValue | null;
  conduct: RatingValue | null;
  comment: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface ScoreLocksTable {
  class_id: string;
  term_type: ScoreTermTypeValue;
  locked_by: string;
  locked_by_name: string;
  locked_at: CreatedTimestamp;
}

export interface SubjectTeamMembersTable {
  team_id: string;
  staff_user_id: string;
  staff_name: string;
  role: Generated<SubjectTeamRole>;
  created_at: CreatedTimestamp;
}

// Số tiết mỗi tuần của môn theo khối trong một chương trình (YCTD-158); kiểu numeric đọc ra chuỗi
export interface CurriculumSubjectsTable {
  id: Generated<string>;
  curriculum_id: string;
  subject_id: string;
  grade_level_code: string;
  periods_per_week: ColumnType<string, string | number, string | number>;
  is_elective: Generated<boolean>;
  created_at: CreatedTimestamp;
}

// Thời khoá biểu theo môn (DT-20 phần 22c1, YCTD-160)
export type TimetableVersionStatus = 'draft' | 'published';
export type TimetableSource = 'manual' | 'import' | 'generator';

export interface TimetableVersionsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  name: string;
  effective_from: string;
  status: Generated<TimetableVersionStatus>;
  source: ColumnType<TimetableSource, TimetableSource | undefined, TimetableSource>;
  note: string | null;
  published_at: Date | null;
  published_by: string | null;
  published_by_name: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface TimetableLessonsTable {
  id: Generated<string>;
  version_id: string;
  class_id: string;
  weekday: number;
  period_no: number;
  subject_id: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  // 0 là tiết cả lớp, 1 đến 9 là nhóm học (DT-21 phần 21b, YCTD-169)
  group_no: Generated<number>;
  created_at: CreatedTimestamp;
}

// Sổ đầu bài và điểm danh theo tiết (DT-20 phần 20d, YCTD-162)
export type ClassLogStatus = 'draft' | 'signed';
export type PeriodAttendanceStatus = 'present' | 'late' | 'absent_excused' | 'absent_unexcused';

export interface ClassLogsTable {
  id: Generated<string>;
  class_id: string;
  lesson_date: string;
  period_no: number;
  subject_id: string;
  timetable_lesson_id: string | null;
  teacher_user_id: string;
  teacher_name: string;
  lesson_title: string;
  content: string | null;
  comment: string | null;
  rating: string | null;
  // Nhóm học của tiết (21b): 0 là cả lớp
  group_no: Generated<number>;
  status: Generated<ClassLogStatus>;
  signed_at: Date | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PeriodAttendanceTable {
  class_log_id: string;
  child_id: string;
  status: PeriodAttendanceStatus;
  note: string | null;
}

export interface ClassLogReviewsTable {
  id: Generated<string>;
  class_id: string;
  week_start: string;
  reviewer_user_id: string;
  reviewer_name: string;
  comment: string | null;
  signed_at: CreatedTimestamp;
}

// Máy xếp thời khoá biểu, dạy thay, đổi tiết, mã tra cứu (DT-20 phần 22c2, YCTD-164)
export type TimetableGenerationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TimetableChangeKind = 'substitute' | 'swap';
export type TimetableLookupKind = 'class' | 'teacher';

export interface TimetableGeneratorSettingsTable {
  school_level: SchoolLevelCode;
  weights: DefaultJson;
  time_limit_seconds: Generated<number>;
  variant_count: Generated<number>;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface TimetableSubjectRulesTable {
  subject_id: string;
  double_period: Generated<boolean>;
  avoid_last_period: Generated<boolean>;
  max_per_day: number | null;
  room_id: string | null;
  updated_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface TimetableTeacherBusyTable {
  id: Generated<string>;
  teacher_user_id: string;
  teacher_name: string;
  weekday: number;
  period_no: number;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export interface TimetableGenerationRunsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  status: ColumnType<TimetableGenerationStatus, TimetableGenerationStatus | undefined, TimetableGenerationStatus>;
  weights: JsonDocument;
  time_limit_seconds: number;
  variant_count: number;
  percent: Generated<number>;
  best_score: ColumnType<string | null, number | null | undefined, number | null>;
  best_hard: number | null;
  message: string | null;
  issues: DefaultJson;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  finished_at: Date | null;
}

export interface TimetableGenerationVariantsTable {
  id: Generated<string>;
  run_id: string;
  variant_no: number;
  score: ColumnType<string, number, number>;
  hard_count: number;
  soft: JsonDocument;
  violations: JsonDocument;
  placements: JsonDocument;
  version_id: string | null;
  created_at: CreatedTimestamp;
}

export interface TimetableChangesTable {
  id: Generated<string>;
  change_date: ColumnType<string, string, string>;
  class_id: string;
  period_no: number;
  kind: TimetableChangeKind;
  pair_id: string | null;
  subject_id: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  original_subject_id: string | null;
  original_teacher_user_id: string | null;
  original_teacher_name: string | null;
  reason: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
}

export interface TimetableLookupCodesTable {
  id: Generated<string>;
  kind: TimetableLookupKind;
  target_id: string;
  target_name: string;
  code: string;
  created_by: string | null;
  created_at: CreatedTimestamp;
  revoked_at: Date | null;
}
// Môn tự chọn học sinh đăng ký (YCTD-158)
export interface ChildElectiveSubjectsTable {
  child_id: string;
  subject_id: string;
  created_at: CreatedTimestamp;
  created_by: string | null;
}

// Cấp học của trường chính, phân hiệu, điểm trường (YCTD-152)
export interface OrgUnitLevelsTable {
  org_unit_id: string;
  school_level: SchoolLevelCode;
  created_at: CreatedTimestamp;
  created_by: string | null;
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
  // Cấp của lớp lấy theo khối; chương trình trống là chương trình mặc định của cấp (YCTD-152)
  school_level: ColumnType<SchoolLevelCode, SchoolLevelCode | undefined, SchoolLevelCode>;
  curriculum_id: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Môn của danh mục (DT-20 phần 20a); phân công cũ ghi tên môn tự do thì trống
  subject_id: ColumnType<string | null, string | null | undefined, string | null>;
  periods_per_week: ColumnType<string | null, string | number | null | undefined, string | number | null>;
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
  | 'candidate_cv'
  | 'final_year_document'
  | 'admission_document'
  | 'kpi_evidence'
  | 'professional_record';

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
  // Xóa hồ sơ nháp, bị từ chối không xóa cứng; xác thực số định danh chạy nội bộ, biến động cư trú ghi tay (DT-16 phần 16g)
  deleted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  deleted_by: ColumnType<string | null, string | null | undefined, string | null>;
  national_id_verified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  national_id_verified_by: ColumnType<string | null, string | null | undefined, string | null>;
  national_id_verified_by_name: ColumnType<string | null, string | null | undefined, string | null>;
  residence_change_note: ColumnType<string | null, string | null | undefined, string | null>;
  // Đối tượng chính sách theo từng nghị định, chỉ tiêu 112–116 của Biểu 01.ĐN-MN (DT-17 phần 17a)
  policy_benefits: ColumnType<ChildPolicyBenefit[], ChildPolicyBenefit[] | undefined, ChildPolicyBenefit[]>;
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
  // Số thứ tự cố định trong lớp (mục 4.1.3 của Sở, DT-16 phần 16g); null là chưa sắp xếp
  order_number: ColumnType<number | null, number | null | undefined, number | null>;
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

// Kênh thông báo: trong ứng dụng, tin nhắn, Zalo Official Account (YCTD-71, YCTD-90), thông báo đẩy (DT-26 phần 26b, YCTD-232)
export type NotificationChannel = 'in_app' | 'sms' | 'zalo' | 'push';

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
  | 'professional_ratings'
  // Điện thoại nhận tin, số định danh, địa chỉ mới của học sinh (DT-16 phần 16g)
  | 'sms_phones'
  | 'national_ids'
  | 'student_addresses';
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
  // Cấp của biểu phí (DT-19 phần 19d, YCTD-154); mỗi cấp một chuỗi phiên bản
  school_level: ColumnType<SchoolLevelCode, SchoolLevelCode | undefined, SchoolLevelCode>;
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
  item_type: 'tuition' | 'service' | 'opening' | 'extracurricular' | 'tutoring' | 'ai_tutor';
  service_id: string | null;
  service_registration_id: string | null;
  // Đăng ký ngoại khóa đã lập khoản thu (YCTD-78)
  extracurricular_registration_id: ColumnType<string | null, string | null | undefined, string | null>;
  // Đăng ký chương trình gia sư đã lập khoản thu (YCTD-253)
  tutoring_registration_id: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Kiêm nhiệm hỗ trợ giáo dục người khuyết tật, kiêm nhiệm vị trí việc làm chuyên môn dùng chung (DT-17 phần 17a)
  concurrent_disability_support: Generated<boolean>;
  concurrent_shared_position: Generated<boolean>;
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
  source: 'self' | 'manual' | 'device';
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
  // Nơi để và mã tem QR (DT-18 phần 18g)
  equipment_location_id: ColumnType<string | null, string | null | undefined, string | null>;
  qr_code: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Cấp nhận tin (DT-19 phần 19e): trống là mọi cấp
  audience_levels: Generated<string[]>;
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

// Số liệu nhập tay của các biểu báo cáo EMIS (DT-16 phần 16j): mỗi dòng một chỉ tiêu của một thẻ, số theo mã cột
export type EmisValues = Record<string, number | null>;

export interface EmisReportValuesTable {
  id: Generated<string>;
  form_code: string;
  tab_key: string;
  row_code: string;
  values: ColumnType<EmisValues, string, string>;
  note: string | null;
  updated_by: string;
  updated_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type ChildPolicyBenefit =
  'nd238_learning_cost' | 'nd66_nursery_boarding' | 'nd57_small_ethnic' | 'nd105_lunch' | 'nd105_allowance';

// Hồ sơ đã đánh dấu gửi ở 1.1.2 Gửi báo cáo đầu năm (DT-17 phần 17a): mỗi đối tượng một dòng, lần gửi theo batch_id
export type EmisRecordType = 'school' | 'staff' | 'class' | 'child' | 'health_first_term';

export interface EmisRecordSubmissionsTable {
  id: Generated<string>;
  record_type: EmisRecordType;
  entity_id: string;
  batch_id: string;
  sent_at: Generated<Date>;
  sent_by: string;
  sent_by_name: string;
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
export type MedicationRequestStatus = 'pending' | 'received' | 'administering' | 'completed' | 'rejected';
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
export type TaskType = 'assigned' | 'personal' | 'directive';
// Giao việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141)
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskAssignmentRole = 'main' | 'coordinate' | 'follow';
export type TaskAssignmentTarget = 'unit' | 'staff';
export type TaskAssignmentStatus = 'todo' | 'in_progress' | 'pending_approval' | 'done' | 'cancelled';
export type TaskApprovalResult = 'done' | 'not_done';
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
  // Việc giao theo cây đơn vị (directive) không có một người nhận; người nhận ở task_assignments
  assignee_staff_id: string | null;
  due_date: string | null;
  priority: Generated<TaskPriority>;
  status: Generated<TaskStatus>;
  progress_percent: Generated<number>;
  plan_item_id: string | null;
  completed_at: Date | null;
  cancel_reason: string | null;
  // Giao việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141)
  leader_user_id: string | null;
  leader_name: string | null;
  start_date: string | null;
  duration_days: number | null;
  remind_assigner: Generated<boolean>;
  assigner_reminded_at: Date | null;
  recurrence: Generated<TaskRecurrence>;
  next_reminder_on: string | null;
  source_document_id: string | null;
  source_document_label: string | null;
  related_documents: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Phân công thực hiện của việc giao theo cây đơn vị (DT-18 phần 18c, YCTD-141)
export interface TaskAssignmentsTable {
  id: Generated<string>;
  task_id: string;
  parent_id: string | null;
  role: TaskAssignmentRole;
  target_type: TaskAssignmentTarget;
  org_unit_id: string;
  department_id: string | null;
  staff_id: string | null;
  start_date: string;
  due_date: string;
  status: Generated<TaskAssignmentStatus>;
  progress_percent: Generated<number>;
  approval_result: TaskApprovalResult | null;
  approval_note: string | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  result_note: string | null;
  completed_at: Date | null;
  assigned_by: string;
  assigned_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface TaskFilesTable {
  id: Generated<string>;
  task_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  storage_key: string;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface TaskUpdatesTable {
  id: Generated<string>;
  task_id: string;
  assignment_id: Generated<string | null>;
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
  // Mở rộng của hồ sơ bồi dưỡng (DT-22 phần 22e, YCTD-182): loại, tệp bản sao, khoá, số tiết, mã tra cứu, thu hồi
  kind: Generated<StaffCertificateKind>;
  file_id: ColumnType<string | null, string | null | undefined, string | null>;
  course_id: ColumnType<string | null, string | null | undefined, string | null>;
  registration_id: ColumnType<string | null, string | null | undefined, string | null>;
  periods: ColumnType<number | null, number | null | undefined, number | null>;
  lookup_code: ColumnType<string | null, string | null | undefined, string | null>;
  revoked_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  revoke_reason: ColumnType<string | null, string | null | undefined, string | null>;
}

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182)
export type StaffCertificateKind = 'manual' | 'course' | 'school';
export type TrainingOrganizerKind = 'school' | 'external';
export type TrainingMode = 'in_person' | 'online' | 'self_study';
export type TrainingCourseStatus = 'open' | 'closed' | 'completed';
export type TrainingRegistrationStatus = 'pending' | 'team_approved' | 'approved' | 'rejected' | 'cancelled';
export type TrainingResult = 'passed' | 'failed';
export type CompetencyTerm = 'term_1' | 'term_2' | 'year';

export interface TrainingCoursesTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  topic_id: string | null;
  topic_name: string | null;
  program_no: number | null;
  competency_domain_code: string | null;
  organizer_kind: TrainingOrganizerKind;
  organizer_name: string | null;
  mode: Generated<TrainingMode>;
  location: string | null;
  start_date: string;
  end_date: string;
  periods: number;
  sessions: Generated<number>;
  quota: number | null;
  registration_deadline: string | null;
  issues_certificate: Generated<boolean>;
  status: Generated<TrainingCourseStatus>;
  note: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface TrainingRegistrationsTable {
  id: Generated<string>;
  course_id: string;
  staff_id: string;
  staff_name: string;
  department_id: string | null;
  status: Generated<TrainingRegistrationStatus>;
  note: string | null;
  team_reviewed_by_name: string | null;
  team_reviewed_at: Date | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  attended_sessions: number | null;
  result: TrainingResult | null;
  credited_periods: number | null;
  result_comment: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DigitalCompetencyAssessmentsTable {
  id: Generated<string>;
  staff_id: string;
  staff_name: string;
  department_id: string | null;
  term: CompetencyTerm;
  status: Generated<'submitted' | 'confirmed'>;
  confirmed_by_name: string | null;
  confirmed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DigitalCompetencyScoresTable {
  assessment_id: string;
  domain_code: string;
  domain_name: string;
  self_level: number;
  confirmed_level: number | null;
  reason: string | null;
}

// Phần theo năm học của kho học liệu số (DT-22 phần 22h1, YCTD-183)
export type LearningResourceAction =
  'submit' | 'unit_approve' | 'school_approve' | 'return' | 'publish' | 'hide' | 'restore' | 'retire';
export type LearningResourceReportKind = 'content' | 'file' | 'copyright';

export interface LearningResourceEventsTable {
  id: Generated<string>;
  resource_id: string;
  version_no: number | null;
  action: LearningResourceAction;
  note: string | null;
  actor_user_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

export interface LearningResourceReportsTable {
  id: Generated<string>;
  resource_id: string;
  resource_title: string;
  kind: LearningResourceReportKind;
  description: string;
  status: Generated<'open' | 'resolved' | 'rejected'>;
  reporter_user_id: string;
  reporter_name: string;
  response: string | null;
  handled_by_name: string | null;
  handled_at: Date | null;
  created_at: CreatedTimestamp;
}

// Câu hỏi, đề, ma trận trong bộ sưu tập; rubric; nhật ký nhập gói chia sẻ (DT-22 phần 22h2, YCTD-184)
export type ResourceQuestionItemKind = 'question' | 'exam' | 'matrix';

export interface ResourceCollectionQuestionsTable {
  collection_id: string;
  item_kind: ResourceQuestionItemKind;
  item_id: string;
  position: number;
  added_by: string;
  added_at: CreatedTimestamp;
}

export interface RubricsTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  school_level: SchoolLevelCode | null;
  subject_id: string | null;
  grade_level_code: string | null;
  question_id: string | null;
  levels: JsonDocument;
  criteria: JsonDocument;
  max_score: ColumnType<string, number, number>;
  visibility: ColumnType<'private' | 'school', 'private' | 'school' | undefined, 'private' | 'school'>;
  status: ColumnType<'active' | 'archived', 'active' | 'archived' | undefined, 'active' | 'archived'>;
  source_rubric_id: string | null;
  owner_user_id: string;
  owner_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ResourcePackageImportsTable {
  id: Generated<string>;
  package_code: string;
  source_school: string;
  package_created_at: Date | null;
  imported_count: number;
  skipped: DefaultJson;
  resource_ids: DefaultJson;
  imported_by: string;
  imported_by_name: string;
  created_at: CreatedTimestamp;
}

export interface LearningResourceUsageTable {
  id: Generated<string>;
  resource_id: string;
  kind: 'view' | 'download';
  user_id: string;
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
// Đã hủy nhập học, nguồn phân tuyến nhập từ Excel (DT-17 phần 17d)
export type AdmissionApplicationStatus = 'submitted' | 'received' | 'passed' | 'rejected' | 'converted' | 'cancelled';
export type AdmissionApplicationSource = 'online' | 'staff' | 'routing';
export type AdmissionProgramType = 'general' | 'advanced' | 'survey';
export type AdmissionDecision = 'pending' | 'accepted' | 'declined';
export type AdvancedReviewStatus = 'pending' | 'admitted' | 'not_admitted';
export type AdmissionRecordType = 'account' | 'free';
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
  // Loại hình, năm học nhận trẻ (DT-17 phần 17d)
  program_type: Generated<AdmissionProgramType>;
  target_academic_year_id: ColumnType<string | null, string | null | undefined, string | null>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

type Optional<Value> = ColumnType<Value | null, Value | null | undefined, Value | null>;

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
  // Tiếp nhận hồ sơ tuyển sinh đầu cấp (DT-17 phần 17d)
  residence_type: Optional<'permanent' | 'temporary' | 'other'>;
  current_residence: Optional<string>;
  residential_group: Optional<string>;
  quarter: Optional<string>;
  ward: Optional<string>;
  province: Optional<string>;
  place_of_birth: Optional<string>;
  final_year_ward: Optional<string>;
  final_year_school: Optional<string>;
  father_name: Optional<string>;
  mother_name: Optional<string>;
  routed: Generated<boolean>;
  submitted_documents: ColumnType<string[], string[] | undefined, string[]>;
  admission_decision: Generated<AdmissionDecision>;
  admission_decision_at: Optional<Date>;
  advanced_criteria: Optional<string>;
  advanced_achievements: Optional<string>;
  registered_at: Optional<string>;
  school_review: Generated<AdvancedReviewStatus>;
  school_reviewed_by_name: Optional<string>;
  school_reviewed_at: Optional<Date>;
  ward_review: Generated<AdvancedReviewStatus>;
  notice_content: Optional<string>;
  record_type: Generated<AdmissionRecordType>;
  target_org_unit_id: Optional<string>;
  transfer_package_code: Optional<string>;
  transfer_guid: Optional<string>;
  transferred_by_name: Optional<string>;
  cancelled_at: Optional<Date>;
  cancelled_by_name: Optional<string>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AdmissionApplicationFilesTable {
  id: Generated<string>;
  application_id: string;
  file_id: string;
  kind: 'birth_certificate' | 'residence' | 'evidence';
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: CreatedTimestamp;
}

export interface AdmissionTransferResultsTable {
  id: Generated<string>;
  kind: 'transfer' | 'cancel';
  package_code: string;
  application_id: string;
  guid: string | null;
  child_id: string | null;
  succeeded: boolean;
  note: string | null;
  actor_user_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

export interface EntryAdmissionContactsTable {
  id: Generated<string>;
  campaign_id: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  national_id_encrypted: string | null;
  national_id_last4: string | null;
  phone: string | null;
  final_year_school: string | null;
  notice_content: Optional<string>;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface EntryAdmissionNoticesTable {
  id: Generated<string>;
  campaign_id: string;
  content: string;
  sent_by: string;
  sent_by_name: string;
  sent_at: CreatedTimestamp;
}

export interface EntryAdmissionNoticeRecipientsTable {
  id: Generated<string>;
  notice_id: string;
  application_id: string | null;
  contact_id: string | null;
  phone: string | null;
  content: string;
  channels: string | null;
  delivered: boolean;
  note: string | null;
  created_at: CreatedTimestamp;
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
  // Bộ nhóm (DT-28 phần 28a, YCTD-271); nhóm của 4.1.6 để trống
  group_set_id: ColumnType<string | null, string | null | undefined, string | null>;
  class_id: ColumnType<string | null, string | null | undefined, string | null>;
  position: ColumnType<number | null, number | null | undefined, number | null>;
  leader_child_id: ColumnType<string | null, string | null | undefined, string | null>;
}

export type ChildGroupMemberRole = 'member' | 'leader';

export interface ChildGroupMembersTable {
  group_id: string;
  child_id: string;
  added_by: string;
  created_at: CreatedTimestamp;
  role: Generated<ChildGroupMemberRole>;
}

// Bộ nhóm dùng chung của lớp (DT-28 phần 28a, YCTD-271): công cụ lớp học 23b, hoạt động, bài tập, đề 23a, học nhóm
export type GroupSetPurpose = 'subject' | 'activity' | 'classroom';
export type GroupSetMethod =
  'manual' | 'random' | 'ability_mixed' | 'ability_tiered' | 'gender_balanced' | 'timetable_group';
export type GroupSetStatus = 'active' | 'archived';

export interface GroupSetsTable {
  id: Generated<string>;
  org_unit_id: string;
  class_id: string;
  subject_id: string | null;
  name: string;
  purpose: GroupSetPurpose;
  method: GroupSetMethod;
  // Tham số chia (số nhóm, hạt ngẫu nhiên, nguồn năng lực, ràng buộc); không chứa mức năng lực của học sinh (GD-140)
  params: ColumnType<unknown, string | undefined, string>;
  status: Generated<GroupSetStatus>;
  owner_user_id: string;
  owner_name: string;
  replaces_id: string | null;
  archived_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type ChildGroupMemberEvent = 'added' | 'removed' | 'moved' | 'leader_set' | 'leader_unset';

export interface ChildGroupMemberEventsTable {
  id: Generated<string>;
  group_set_id: string | null;
  group_id: string;
  child_id: string;
  event: ChildGroupMemberEvent;
  from_group_id: string | null;
  actor_user_id: string;
  actor_name: string;
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
  // Cấp học của danh mục, mã danh mục mẫu đã nạp dòng này (DT-18 phần 18g)
  school_level: Generated<'MN' | 'TH' | 'THCS' | 'THPT'>;
  template_code: ColumnType<string | null, string | null | undefined, string | null>;
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
  // Nơi để và mã tem QR của lô (DT-18 phần 18g)
  location_id: ColumnType<string | null, string | null | undefined, string | null>;
  qr_code: ColumnType<string | null, string | null | undefined, string | null>;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Nơi để, kiểm kê thiết bị (DT-18 phần 18g, YCTD-143)
type EquipmentNullable = ColumnType<string | null, string | null | undefined, string | null>;

export interface EquipmentLocationsTable {
  id: Generated<string>;
  org_unit_id: string;
  code: string;
  name: string;
  location_type: 'room' | 'store' | 'position';
  room_id: EquipmentNullable;
  parent_id: EquipmentNullable;
  status: Generated<'active' | 'inactive'>;
  note: EquipmentNullable;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EquipmentStocktakesTable {
  id: Generated<string>;
  code: string;
  name: string;
  org_unit_id: string;
  location_id: EquipmentNullable;
  started_on: string;
  members: EquipmentNullable;
  note: EquipmentNullable;
  status: Generated<'counting' | 'submitted' | 'approved' | 'closed' | 'cancelled'>;
  return_note: EquipmentNullable;
  created_by: string;
  submitted_by: EquipmentNullable;
  submitted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  approved_by: EquipmentNullable;
  approved_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  closed_by: EquipmentNullable;
  closed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EquipmentStocktakeLinesTable {
  id: Generated<string>;
  stocktake_id: string;
  target_type: 'asset' | 'holding';
  asset_id: EquipmentNullable;
  holding_id: EquipmentNullable;
  equipment_item_id: EquipmentNullable;
  code: string;
  name: string;
  unit: string;
  location_id: EquipmentNullable;
  in_scope: Generated<boolean>;
  expected_quantity: ColumnType<string, string | number, string | number>;
  counted_quantity: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  usable_quantity: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  condition: ColumnType<
    'good' | 'damaged' | 'unusable' | 'missing' | null,
    'good' | 'damaged' | 'unusable' | 'missing' | null | undefined,
    'good' | 'damaged' | 'unusable' | 'missing' | null
  >;
  found_location_id: EquipmentNullable;
  note: EquipmentNullable;
  counted_by: EquipmentNullable;
  counted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  damage_id: EquipmentNullable;
}

// Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b, YCTD-146)
type FoodNullable = ColumnType<string | null, string | null | undefined, string | null>;
type FoodNullableNumber = ColumnType<number | null, number | null | undefined, number | null>;
type FoodNullableTimestamp = ColumnType<Date | null, Date | null | undefined, Date | null>;
export type FoodCertificateType =
  'food_safety' | 'business_registration' | 'veterinary' | 'quarantine' | 'product_declaration' | 'contract' | 'other';
export type FoodLotStatus = 'pending' | 'accepted' | 'rejected' | 'used_up' | 'disposed';
export type FoodLotCategory = 'fresh' | 'dry';
export type FoodStorageCondition = 'ambient' | 'chilled' | 'frozen';
export type FoodRejectionAction = 'returned' | 'destroyed' | 'other';
export type FoodCheckResult = 'pass' | 'fail';
export type FoodInspectionStep = 1 | 2 | 3;
export type FoodSampleStatus = 'stored' | 'held' | 'destroyed';
export type FoodSampleForm = 'solid' | 'liquid';

export interface FoodSafetyFilesTable {
  id: Generated<string>;
  org_unit_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface FoodSupplierCertificatesTable {
  id: Generated<string>;
  supplier_id: string;
  certificate_type: FoodCertificateType;
  number: string;
  issued_by: FoodNullable;
  issued_on: FoodNullable;
  expires_on: FoodNullable;
  scope_note: FoodNullable;
  file_id: FoodNullable;
  status: Generated<'active' | 'revoked'>;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FoodLotsTable {
  id: Generated<string>;
  code: string;
  org_unit_id: string;
  ingredient_id: string;
  supplier_id: string;
  purchase_item_id: FoodNullable;
  food_category: Generated<FoodLotCategory>;
  received_date: string;
  received_time: FoodNullable;
  quantity: ColumnType<string, string | number, string | number>;
  deliverer_name: FoodNullable;
  manufacturer: FoodNullable;
  manufacturer_address: FoodNullable;
  lot_number: FoodNullable;
  production_date: FoodNullable;
  expiry_date: FoodNullable;
  storage_condition: ColumnType<
    FoodStorageCondition | null,
    FoodStorageCondition | null | undefined,
    FoodStorageCondition | null
  >;
  document_number: FoodNullable;
  document_file_id: FoodNullable;
  veterinary_certificate: FoodNullable;
  quarantine_certificate: FoodNullable;
  status: Generated<FoodLotStatus>;
  rejection_action: ColumnType<
    FoodRejectionAction | null,
    FoodRejectionAction | null | undefined,
    FoodRejectionAction | null
  >;
  handling_note: FoodNullable;
  closed_by: FoodNullable;
  closed_at: FoodNullableTimestamp;
  note: FoodNullable;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FoodInspectionsTable {
  id: Generated<string>;
  org_unit_id: string;
  inspection_date: string;
  step: FoodInspectionStep;
  inspector_name: string;
  inspector_title: FoodNullable;
  inspected_time: FoodNullable;
  location: FoodNullable;
  note: FoodNullable;
  status: Generated<'draft' | 'confirmed'>;
  confirmed_by: FoodNullable;
  confirmed_at: FoodNullableTimestamp;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

type FoodNullableResult = ColumnType<
  FoodCheckResult | null,
  FoodCheckResult | null | undefined,
  FoodCheckResult | null
>;

// Cột thời gian theo bước: bước 2 first_time là sơ chế xong, second_time là chế biến xong; bước 3 first_time là chia món xong,
// second_time là bắt đầu ăn
export interface FoodInspectionLinesTable {
  id: Generated<string>;
  inspection_id: string;
  line_no: number;
  lot_id: FoodNullable;
  meal_type: ColumnType<MealType | null, MealType | null | undefined, MealType | null>;
  dish_id: FoodNullable;
  dish_name: FoodNullable;
  main_ingredients: FoodNullable;
  servings: FoodNullableNumber;
  first_time: FoodNullable;
  second_time: FoodNullable;
  hygiene_people: FoodNullableResult;
  hygiene_equipment: FoodNullableResult;
  hygiene_area: FoodNullableResult;
  utensils: FoodNullable;
  sensory_result: FoodNullableResult;
  rapid_test_result: FoodNullableResult;
  rejection_action: ColumnType<
    FoodRejectionAction | null,
    FoodRejectionAction | null | undefined,
    FoodRejectionAction | null
  >;
  action: FoodNullable;
  note: FoodNullable;
}

export interface FoodInspectionLineLotsTable {
  line_id: string;
  lot_id: string;
}

export interface FoodSamplesTable {
  id: Generated<string>;
  org_unit_id: string;
  sample_date: string;
  meal_type: MealType;
  dish_id: FoodNullable;
  dish_name: string;
  servings: number;
  food_form: FoodSampleForm;
  quantity: ColumnType<string, string | number, string | number>;
  container: string;
  storage_temperature: ColumnType<string, string | number, string | number>;
  sampled_at: Date;
  sampled_by: string;
  sampled_by_name: string;
  status: Generated<FoodSampleStatus>;
  hold_reason: FoodNullable;
  held_by: FoodNullable;
  held_at: FoodNullableTimestamp;
  destroyed_at: FoodNullableTimestamp;
  destroyed_by: FoodNullable;
  destroyed_by_name: FoodNullable;
  quality_note: FoodNullable;
  note: FoodNullable;
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

// 1.7 Rà soát thông tin kiểm định CLGD (DT-16 phần 16e): một bản mỗi năm học, gắn với Trường chính
type OptionalArea = ColumnType<string | null, string | number | null | undefined, string | number | null>;
type OptionalText = ColumnType<string | null, string | null | undefined, string | null>;
type OptionalInteger = ColumnType<number | null, number | null | undefined, number | null>;

export interface AccreditationReviewsTable {
  id: Generated<string>;
  org_unit_id: string;
  class_count: number | null;
  classroom_count: number | null;
  subject_room_count: number | null;
  land_area_m2: OptionalArea;
  floor_area_m2: OptionalArea;
  child_count: number | null;
  area_per_child_m2: OptionalArea;
  // Ô như Sở thêm ở DT-17 phần 17e (khảo sát mục 10.5): mức độ chuẩn quốc gia '1', '2'; cấp độ kiểm định '1' đến '4'
  school_name: OptionalText;
  school_code: OptionalText;
  ownership_type: OptionalText;
  education_level: OptionalText;
  national_standard_year: OptionalInteger;
  national_standard_date: OptionalText;
  national_standard_level: OptionalText;
  accreditation_year: OptionalInteger;
  accreditation_date: OptionalText;
  accreditation_level: OptionalText;
  national_standard_registration: OptionalText;
  floor_area_per_child_m2: OptionalArea;
  note: string | null;
  collected_at: Date | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// 1.8 Tách trường bản chạy nội bộ (DT-16 phần 16e): chưa xác nhận, đã xác nhận đi, trường đến đã tiếp nhận
export type SchoolSplitStatus = 'draft' | 'confirmed' | 'received';

export interface SchoolSplitRequestsTable {
  id: Generated<string>;
  code: string;
  destination_school: string;
  destination_code: string | null;
  reason: string;
  status: Generated<SchoolSplitStatus>;
  confirmed_at: Date | null;
  confirmed_by: string | null;
  received_at: Date | null;
  received_by: string | null;
  received_note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolSplitItemsTable {
  id: Generated<string>;
  request_id: string;
  child_id: string | null;
  staff_id: string | null;
  created_at: CreatedTimestamp;
}

// Tài khoản học và thi của học sinh lưu nội bộ, mật khẩu chỉ lưu giá trị băm (mục 4.1.10 của Sở, DT-16 phần 16g)
export interface StudentLearningAccountsTable extends CatalogRecordColumns {
  child_id: string;
  username: string;
  password_hash: string;
  issued_at: Date;
  issued_by_name: string;
  reset_count: Generated<number>;
  // Người dùng định danh của kênh student gắn một-một với tài khoản này (DT-23 phần 23a)
  identity_user_id: string | null;
}

// Chuyển đi, tiếp nhận chuyển đến giữa các trường chạy nội bộ (mục 4.2 của Sở, DT-16 phần 16g)
export type StudentTransferDirection = 'out' | 'in';
export type StudentTransferStatus = 'pending' | 'approved' | 'rejected' | 'received';

export interface StudentTransfersTable extends CatalogRecordColumns {
  direction: StudentTransferDirection;
  status: StudentTransferStatus;
  child_id: string | null;
  org_unit_id: string;
  full_name: string;
  dob: string | null;
  school_name: string;
  province_name: string | null;
  ward_name: string | null;
  transfer_date: string;
  reason: string | null;
  requested_by_name: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  file_id: string | null;
}

// Cơ sở vật chất đủ theo hệ thống của Sở (DT-16 phần 16i): 6.1 thực trạng và nhu cầu đầu tư phòng học, nhà công vụ; mức độ
// đạt chuẩn theo khối phòng của 1.2; lần nhập phòng, danh mục thiết bị từ Excel
export type FacilityInvestmentCategory = 'classroom' | 'teacher_housing';
export type FacilityStandardLevel = 'not_met' | 'level_1' | 'level_2';
export type FacilityImportType = 'rooms' | 'equipment_items';
type OptionalMoney = ColumnType<string | null, string | number | null | undefined, string | number | null>;

export interface FacilityInvestmentsTable {
  id: Generated<string>;
  org_unit_id: string;
  category: FacilityInvestmentCategory;
  permanent: number | null;
  semi_permanent: number | null;
  degraded_level4: number | null;
  borrowed: number | null;
  need_classes: number | null;
  need_rooms: number | null;
  need_budget_million: OptionalMoney;
  note: string | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FacilityStandardLevelsTable {
  id: Generated<string>;
  org_unit_id: string;
  room_block: string;
  level: FacilityStandardLevel;
  note: string | null;
  updated_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FacilityImportJobsTable {
  id: Generated<string>;
  import_type: FacilityImportType;
  org_unit_id: string;
  file_id: string;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: ColumnType<unknown[], string | undefined, string>;
  payload: ColumnType<unknown[], string | undefined, string>;
  created_by: string;
  created_at: CreatedTimestamp;
  committed_at: Date | null;
}

// Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c): hồ sơ cuối cấp, tệp, lịch sử, xác nhận hoàn thành theo lớp, hỗ trợ tuyển sinh,
// dịch vụ tại trường
export type FinalYearRecordStatus =
  | 'parent_pending'
  | 'awaiting_school_edit'
  | 'awaiting_parent_reconfirm'
  | 'parent_confirmed'
  | 'school_edited'
  | 'parent_confirmed_after_edit';

export interface FinalYearRecordsTable {
  id: Generated<string>;
  child_id: string;
  org_unit_id: string;
  status: Generated<FinalYearRecordStatus>;
  review_status: Generated<'pending' | 'approved'>;
  identity_type: Generated<'has_id' | 'no_id' | 'temporary_id'>;
  residence_type: ColumnType<
    'permanent' | 'temporary' | 'other' | null,
    'permanent' | 'temporary' | 'other' | null | undefined,
    'permanent' | 'temporary' | 'other' | null
  >;
  current_residence: ColumnType<string | null, string | null | undefined, string | null>;
  house_number: ColumnType<string | null, string | null | undefined, string | null>;
  street: ColumnType<string | null, string | null | undefined, string | null>;
  residential_group: ColumnType<string | null, string | null | undefined, string | null>;
  quarter: ColumnType<string | null, string | null | undefined, string | null>;
  ward: ColumnType<string | null, string | null | undefined, string | null>;
  province: ColumnType<string | null, string | null | undefined, string | null>;
  contact_name: ColumnType<string | null, string | null | undefined, string | null>;
  contact_phone: ColumnType<string | null, string | null | undefined, string | null>;
  contact_email: ColumnType<string | null, string | null | undefined, string | null>;
  latitude: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  longitude: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  routed_school: ColumnType<string | null, string | null | undefined, string | null>;
  beneficiary: ColumnType<string | null, string | null | undefined, string | null>;
  priority_form: ColumnType<string | null, string | null | undefined, string | null>;
  registration_source: Generated<'parent' | 'universal' | 'none'>;
  parent_proposal: ColumnType<string | null, string | null | undefined, string | null>;
  parent_proposed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  confirmed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  confirmed_by: ColumnType<string | null, string | null | undefined, string | null>;
  confirmed_by_name: ColumnType<string | null, string | null | undefined, string | null>;
  confirmed_by_school: Generated<boolean>;
  school_edited_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  approved_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  approved_by: ColumnType<string | null, string | null | undefined, string | null>;
  approved_by_name: ColumnType<string | null, string | null | undefined, string | null>;
  admission_consent: Generated<boolean>;
  admission_consent_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_by: ColumnType<string | null, string | null | undefined, string | null>;
  updated_by: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FinalYearRecordFilesTable {
  id: Generated<string>;
  record_id: string;
  file_id: string;
  kind: 'birth_certificate' | 'residence' | 'evidence';
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_by_parent: Generated<boolean>;
  created_at: CreatedTimestamp;
}

export interface FinalYearRecordEventsTable {
  id: Generated<string>;
  record_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor_user_id: string;
  actor_name: string;
  by_parent: Generated<boolean>;
  created_at: CreatedTimestamp;
}

export interface FinalYearClassConfirmationsTable {
  id: Generated<string>;
  class_id: string;
  confirmed: Generated<boolean>;
  confirmed_by: string | null;
  confirmed_by_name: string | null;
  confirmed_at: Date | null;
  updated_at: UpdatedTimestamp;
}

export interface AdmissionSupportRequestsTable {
  id: Generated<string>;
  org_unit_id: string;
  child_id: string | null;
  requester_user_id: string;
  requester_name: string;
  email: string | null;
  phone: string | null;
  content: string;
  status: Generated<'pending' | 'answered'>;
  reply: ColumnType<string | null, string | null | undefined, string | null>;
  replied_by: ColumnType<string | null, string | null | undefined, string | null>;
  replied_by_name: ColumnType<string | null, string | null | undefined, string | null>;
  replied_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  notified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  notified_channels: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SchoolServicesTable {
  id: Generated<string>;
  code: string;
  name: string;
  sort_order: Generated<number>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Phân hệ KPI (DT-18 phần 18d, YCTD-139)
export type KpiSchoolLevel = 'MN' | 'TH' | 'THCS' | 'THPT';
export type KpiSubjectGroup = 'leader' | 'staff';
export type KpiPeriodType = 'month' | 'quarter' | 'term' | 'year' | 'custom';
export type KpiTaskOrigin = 'assigned' | 'registered' | 'arising' | 'legacy';
export type KpiTaskStatus =
  | 'pending_approval'
  | 'assigned'
  | 'returned_to_assigner'
  | 'in_progress'
  | 'self_assessed'
  | 'rework'
  | 'graded'
  | 'rejected'
  | 'cancelled';
export type KpiEvaluationStatus = 'draft' | 'submitted' | 'returned' | 'concluded';
export type KpiCatalogStatus = 'active' | 'inactive' | 'proposed' | 'rejected';
type NullableDate = ColumnType<string | null, string | null | undefined, string | null>;
type NullableTimestamp = ColumnType<Date | null, Date | null | undefined, Date | null>;
type NullableText = ColumnType<string | null, string | null | undefined, string | null>;
type NullableDecimal = ColumnType<string | null, string | number | null | undefined, string | number | null>;
type NullableLevel = ColumnType<KpiSchoolLevel | null, KpiSchoolLevel | null | undefined, KpiSchoolLevel | null>;
type DefaultDecimal = ColumnType<string, string | number | undefined, string | number>;
type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface KpiRuleSetsTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: NullableText;
  is_default: Generated<boolean>;
  status: Generated<'active' | 'inactive'>;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiRuleSetVersionsTable {
  id: Generated<string>;
  rule_set_id: string;
  version_no: number;
  config: JsonValue;
  status: Generated<'draft' | 'published'>;
  note: NullableText;
  published_at: NullableTimestamp;
  published_by: NullableText;
  published_by_name: NullableText;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiProfilesTable {
  id: Generated<string>;
  staff_id: string;
  rule_set_id: string;
  subject_group: Generated<KpiSubjectGroup>;
  school_level: NullableLevel;
  job_position: NullableText;
  is_head: Generated<boolean>;
  superior_staff_id: NullableText;
  excluded: Generated<boolean>;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiPeriodsTable {
  id: Generated<string>;
  code: string;
  name: string;
  period_type: KpiPeriodType;
  start_date: string;
  end_date: string;
  register_from: NullableDate;
  register_to: NullableDate;
  self_from: NullableDate;
  self_to: NullableDate;
  review_from: NullableDate;
  review_to: NullableDate;
  advisory_from: NullableDate;
  advisory_to: NullableDate;
  status: Generated<'open' | 'locked'>;
  locked_at: NullableTimestamp;
  locked_by: NullableText;
  locked_by_name: NullableText;
  lock_note: NullableText;
  legacy_id: NullableText;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiPeriodRuleVersionsTable {
  period_id: string;
  rule_set_id: string;
  rule_set_version_id: string;
}

export interface KpiCatalogItemsTable {
  id: Generated<string>;
  org_unit_id: NullableText;
  rule_set_id: NullableText;
  code: string;
  name: string;
  output_result: NullableText;
  axis_code: string;
  task_type: string;
  difficulty_code: string;
  expected_evidence: NullableText;
  deadline_hint: NullableText;
  school_level: NullableLevel;
  job_position: NullableText;
  is_required: Generated<boolean>;
  is_confidential: Generated<boolean>;
  status: Generated<KpiCatalogStatus>;
  proposed_by: NullableText;
  proposed_by_name: NullableText;
  decided_by: NullableText;
  decided_by_name: NullableText;
  decided_at: NullableTimestamp;
  decision_note: NullableText;
  legacy_id: NullableText;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiTasksTable {
  id: Generated<string>;
  period_id: string;
  staff_id: string;
  org_unit_id: string;
  catalog_item_id: NullableText;
  name: string;
  output_result: NullableText;
  axis_code: string;
  task_type: string;
  standard_score: Decimal;
  difficulty_code: string;
  difficulty_weight: Decimal;
  is_confidential: Generated<boolean>;
  origin: KpiTaskOrigin;
  in_plan: Generated<boolean>;
  status: KpiTaskStatus;
  deadline: string;
  original_deadline: string;
  assigned_by_staff_id: NullableText;
  assigned_by_name: NullableText;
  evaluator_staff_id: NullableText;
  delegated_by: NullableText;
  delegated_by_name: NullableText;
  delegated_at: NullableTimestamp;
  delegation_note: NullableText;
  approval_due_at: NullableTimestamp;
  approved_at: NullableTimestamp;
  approved_by_name: NullableText;
  auto_approved: Generated<boolean>;
  decision_note: NullableText;
  return_count: Generated<number>;
  return_reason: NullableText;
  requested_deadline: NullableDate;
  extension_reason: NullableText;
  extension_status: ColumnType<ExtensionStatus | null, ExtensionStatus | null | undefined, ExtensionStatus | null>;
  actual_finish_date: NullableDate;
  evidence_text: NullableText;
  document_number: NullableText;
  self_quality_code: NullableText;
  self_result_code: NullableText;
  self_assessed_at: NullableTimestamp;
  bonus_proposed: Generated<boolean>;
  bonus_reason: NullableText;
  grading_due_at: NullableTimestamp;
  late_days: ColumnType<number | null, number | null | undefined, number | null>;
  progress_percent: NullableDecimal;
  progress_adjust_reason: NullableText;
  quality_code: NullableText;
  result_code: NullableText;
  task_percent: NullableDecimal;
  exceeded: Generated<boolean>;
  bonus_approved: Generated<boolean>;
  execution_score: NullableDecimal;
  converted_score: NullableDecimal;
  bonus_score: NullableDecimal;
  grader_comment: NullableText;
  graded_at: NullableTimestamp;
  graded_by: NullableText;
  graded_by_name: NullableText;
  auto_graded: Generated<boolean>;
  rework_reason: NullableText;
  legacy_id: NullableText;
  created_by: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiTaskFilesTable {
  task_id: string;
  file_id: string;
  uploaded_by_name: string;
  created_at: CreatedTimestamp;
}

export interface KpiEvaluationsTable {
  id: Generated<string>;
  period_id: string;
  staff_id: string;
  org_unit_id: string;
  rule_set_version_id: string;
  subject_group: KpiSubjectGroup;
  is_head: Generated<boolean>;
  status: Generated<KpiEvaluationStatus>;
  general_self: DefaultDecimal;
  general_score: DefaultDecimal;
  plan_max: DefaultDecimal;
  actual_total: DefaultDecimal;
  task_score: DefaultDecimal;
  bonus_score: DefaultDecimal;
  total_score: DefaultDecimal;
  suggested_rank: NullableText;
  self_rank: NullableText;
  self_comment: NullableText;
  submitted_at: NullableTimestamp;
  return_reason: NullableText;
  exclusions: ColumnType<string[], string | undefined, string>;
  exclusion_note: NullableText;
  superior_rank: NullableText;
  superior_comment: NullableText;
  superior_by: NullableText;
  superior_by_name: NullableText;
  superior_at: NullableTimestamp;
  advisory_rank: NullableText;
  advisory_comment: NullableText;
  advisory_by_name: NullableText;
  advisory_at: NullableTimestamp;
  final_rank: NullableText;
  legacy_id: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiEvaluationCriteriaTable {
  evaluation_id: string;
  criterion_code: string;
  max_score: Decimal;
  self_satisfied: Generated<boolean>;
  superior_satisfied: ColumnType<boolean | null, boolean | null | undefined, boolean | null>;
  note: NullableText;
}

export interface KpiVotesTable {
  evaluation_id: string;
  voter_user_id: string;
  voter_name: string;
  vote_rank: string;
  comment: NullableText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface KpiManagerActionsTable {
  id: Generated<string>;
  period_id: string;
  task_id: NullableText;
  action: 'approve' | 'grade';
  manager_staff_id: NullableText;
  manager_name: NullableText;
  due_at: Date;
  done_at: Date;
  on_time: boolean;
  automatic: Generated<boolean>;
  created_at: CreatedTimestamp;
}

// Hồ sơ chuyên môn (DT-18 phần 18e, YCTD-142)
export type ProfessionalBranch = 'personal' | 'group' | 'school';
export type ProfessionalApprovalFlow = 'none' | 'leader' | 'two_level';
export type ProfessionalDocumentStatus = 'draft' | 'pending_leader' | 'pending_approval' | 'approved' | 'returned';
export type ProfessionalDocumentAction =
  'create' | 'upload' | 'submit' | 'leader_approve' | 'approve' | 'return' | 'sign' | 'withdraw';

export interface ProfessionalFoldersTable {
  id: Generated<string>;
  parent_id: string | null;
  branch: ProfessionalBranch;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevel | null;
  approval_flow: Generated<ProfessionalApprovalFlow>;
  requires_signing: Generated<boolean>;
  sort_order: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalWorkGroupsTable {
  id: Generated<string>;
  org_unit_id: string;
  name: string;
  description: string | null;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalWorkGroupMembersTable {
  group_id: string;
  staff_id: string;
  is_leader: Generated<boolean>;
}

export interface ProfessionalRoundsTable {
  id: Generated<string>;
  folder_id: string;
  title: string;
  description: string | null;
  submitter_kind: 'staff' | 'group';
  org_unit_id: string | null;
  department_ids: string[] | null;
  opens_on: string;
  due_at: Date;
  status: Generated<'open' | 'closed'>;
  reminded_at: Date | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalDocumentsTable {
  id: Generated<string>;
  folder_id: string;
  round_id: string | null;
  branch: ProfessionalBranch;
  org_unit_id: string;
  owner_user_id: string;
  owner_staff_id: string | null;
  owner_name: string;
  department_id: string | null;
  work_group_id: string | null;
  title: string;
  description: string | null;
  status: Generated<ProfessionalDocumentStatus>;
  approval_flow: ProfessionalApprovalFlow;
  requires_signing: Generated<boolean>;
  current_version: Generated<number>;
  submitted_at: Date | null;
  submitted_late: Generated<boolean>;
  leader_user_id: string | null;
  leader_name: string | null;
  leader_reviewed_at: Date | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: Date | null;
  return_note: string | null;
  signed_at: Date | null;
  signature_method: string | null;
  signed_file_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ProfessionalDocumentVersionsTable {
  id: Generated<string>;
  document_id: string;
  version_no: number;
  file_id: string;
  sha256: string;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface ProfessionalDocumentEventsTable {
  id: Generated<string>;
  document_id: string;
  action: ProfessionalDocumentAction;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

export interface ProfessionalRecordSettingsTable {
  id: number;
  locked: Generated<boolean>;
  locked_at: Date | null;
  locked_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147). Cột JSON đọc ra giá trị đã phân tích, ghi vào chuỗi JSON
export type EducationPlanScope = 'school' | 'group' | 'class' | 'personal';
export type EducationPlanPeriod = 'year' | 'semester' | 'month' | 'week' | 'none';
export type EducationPlanStep = 'leader' | 'vice_principal' | 'principal';
export type EducationPlanStatus = 'draft' | 'pending' | 'approved' | 'returned';
export type EducationPlanAction =
  'create' | 'copy' | 'submit' | 'withdraw' | 'approve' | 'return' | 'sign' | 'archive' | 'work_plan';
type JsonDocument = ColumnType<unknown, string, string>;

export interface EducationPlanTemplatesTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevel | null;
  scope: EducationPlanScope;
  period: EducationPlanPeriod;
  sections: JsonDocument;
  approval_steps: EducationPlanStep[];
  requires_signing: Generated<boolean>;
  archive_folder_id: string | null;
  revision: Generated<number>;
  sort_order: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EducationPlansTable {
  id: Generated<string>;
  template_id: string | null;
  template_name: string;
  template_revision: number;
  scope: EducationPlanScope;
  period: EducationPlanPeriod;
  school_level: KpiSchoolLevel | null;
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  org_unit_id: string;
  department_id: string | null;
  work_group_id: string | null;
  class_id: string | null;
  owner_user_id: string;
  owner_staff_id: string | null;
  owner_name: string;
  sections: JsonDocument;
  content: ColumnType<unknown, string | undefined, string>;
  approval_steps: EducationPlanStep[];
  requires_signing: Generated<boolean>;
  status: Generated<EducationPlanStatus>;
  remaining_steps: Generated<EducationPlanStep[]>;
  current_step: EducationPlanStep | null;
  version_no: Generated<number>;
  submitted_at: Date | null;
  approved_at: Date | null;
  approved_by: string | null;
  approved_by_name: string | null;
  return_note: string | null;
  signed_at: Date | null;
  signature_method: string | null;
  signed_file_id: string | null;
  source_plan_id: string | null;
  source_year_name: string | null;
  source_sections: ColumnType<unknown, string | null | undefined, string | null>;
  source_content: ColumnType<unknown, string | null | undefined, string | null>;
  archived_document_id: string | null;
  work_plan_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EducationPlanVersionsTable {
  id: Generated<string>;
  plan_id: string;
  version_no: number;
  title: string;
  sections: JsonDocument;
  content: JsonDocument;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface EducationPlanEventsTable {
  id: Generated<string>;
  plan_id: string;
  action: EducationPlanAction;
  step: EducationPlanStep | null;
  note: string | null;
  actor_id: string;
  actor_name: string;
  created_at: CreatedTimestamp;
}

// Thi đua, khen thưởng (DT-18 phần 22d, YCTD-148). Cột JSON đọc ra giá trị đã phân tích, ghi vào chuỗi JSON
export type EmulationTarget = 'individual' | 'collective';
export type EmulationTitleKind = 'title' | 'award';
export type EmulationDecisionLevel = 'school' | 'upper';
export type EmulationCampaignStatus = 'draft' | 'launched' | 'published' | 'closed';
export type EmulationRegistrationStatus = 'pending' | 'accepted' | 'returned';
export type EmulationNominationStatus =
  'draft' | 'submitted' | 'returned' | 'accepted' | 'passed' | 'failed' | 'proposed' | 'awarded' | 'not_awarded';
export type EmulationCouncilPosition = 'chair' | 'vice_chair' | 'secretary' | 'member';
export type EmulationVoteChoice = 'agree' | 'disagree' | 'abstain';
export type EmulationAppealKind = 'review' | 'complaint';
export type EmulationAppealStatus = 'pending' | 'accepted' | 'rejected';
export type EmulationDecisionKind = 'decision' | 'proposal';
type DefaultJson = ColumnType<unknown, string | undefined, string>;

export interface EmulationTitlesTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  kind: EmulationTitleKind;
  target: EmulationTarget;
  decision_level: EmulationDecisionLevel;
  school_level: KpiSchoolLevel | null;
  min_kpi_rank: string | null;
  requires_initiative: Generated<boolean>;
  prerequisite_code: string | null;
  consecutive_years: Generated<number>;
  quota_percent: NullableDecimal;
  quota_base_code: string | null;
  vote_threshold_percent: DefaultDecimal;
  criteria: DefaultJson;
  min_score: NullableDecimal;
  revision: Generated<number>;
  sort_order: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationCampaignsTable {
  id: Generated<string>;
  code: string;
  name: string;
  kind: 'regular' | 'thematic';
  description: string | null;
  title_ids: Generated<string[]>;
  kpi_period_id: string | null;
  registration_deadline: string | null;
  nomination_deadline: string | null;
  appeal_days: Generated<number>;
  status: Generated<EmulationCampaignStatus>;
  launched_at: Date | null;
  launched_by_name: string | null;
  published_at: Date | null;
  appeal_deadline: string | null;
  closed_at: Date | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationRegistrationsTable {
  id: Generated<string>;
  campaign_id: string;
  title_id: string;
  target: EmulationTarget;
  staff_id: string | null;
  department_id: string | null;
  subject_name: string;
  commitment: string | null;
  status: Generated<EmulationRegistrationStatus>;
  review_note: string | null;
  registered_by: string;
  registered_by_name: string;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationMeetingsTable {
  id: Generated<string>;
  campaign_id: string;
  held_at: Date;
  location: string | null;
  content: string | null;
  conclusion: string | null;
  member_count: number;
  attendee_count: number | null;
  status: Generated<'voting' | 'closed'>;
  closed_at: Date | null;
  closed_by_name: string | null;
  minutes_file_id: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface EmulationDecisionsTable {
  id: Generated<string>;
  campaign_id: string;
  kind: EmulationDecisionKind;
  title: string;
  basis: string | null;
  signer_name: string | null;
  signer_title: string | null;
  status: Generated<'draft' | 'issued'>;
  number: string | null;
  issue_date: string | null;
  outgoing_document_id: string | null;
  issued_at: Date | null;
  issued_by_name: string | null;
  upper_number: string | null;
  upper_date: string | null;
  upper_issuer: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationNominationsTable {
  id: Generated<string>;
  campaign_id: string;
  title_id: string;
  title_code: string;
  title_name: string;
  title_revision: number;
  criteria: JsonDocument;
  vote_threshold_percent: Decimal;
  target: EmulationTarget;
  staff_id: string | null;
  department_id: string | null;
  subject_name: string;
  org_unit_id: string;
  registration_id: string | null;
  owner_user_id: string;
  owner_name: string;
  achievements: string | null;
  initiative: string | null;
  scores: DefaultJson;
  total_score: DefaultDecimal;
  kpi_evaluation_id: string | null;
  kpi_period_name: string | null;
  kpi_rank: string | null;
  kpi_rank_label: string | null;
  kpi_score: NullableDecimal;
  eligibility: DefaultJson;
  status: Generated<EmulationNominationStatus>;
  return_note: string | null;
  submitted_at: Date | null;
  accepted_at: Date | null;
  meeting_id: string | null;
  agree_count: number | null;
  disagree_count: number | null;
  abstain_count: number | null;
  agree_percent: NullableDecimal;
  council_note: string | null;
  decision_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationNominationEvidenceTable {
  id: Generated<string>;
  nomination_id: string;
  document_id: string;
  note: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
}

export interface EmulationCouncilMembersTable {
  id: Generated<string>;
  campaign_id: string;
  user_id: string;
  name: string;
  position: EmulationCouncilPosition;
  sort_order: Generated<number>;
}

export interface EmulationVotesTable {
  meeting_id: string;
  nomination_id: string;
  member_user_id: string;
  choice: EmulationVoteChoice;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface EmulationAppealsTable {
  id: Generated<string>;
  campaign_id: string;
  nomination_id: string | null;
  kind: EmulationAppealKind;
  content: string;
  submitted_by: string;
  submitted_by_name: string;
  deadline: string;
  status: Generated<EmulationAppealStatus>;
  response: string | null;
  resolved_by_name: string | null;
  resolved_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface EmulationAwardsTable {
  id: Generated<string>;
  source: 'decision' | 'manual';
  decision_id: string | null;
  nomination_id: string | null;
  year_name: string;
  year_start: number;
  title_code: string;
  title_name: string;
  title_kind: EmulationTitleKind;
  target: EmulationTarget;
  staff_id: string | null;
  department_id: string | null;
  subject_name: string;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
  lookup_code: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
}

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149)
export type QualityAssessmentStatus = 'draft' | 'in_progress' | 'completed';
export type QualityReportStatus = 'draft' | 'submitted' | 'approved' | 'returned';
export type QualityEvidenceStatus = 'missing' | 'collecting' | 'sufficient' | 'needs_update';
export type QualityEvidenceSource =
  'upload' | 'professional_document' | 'incoming_document' | 'outgoing_document' | 'none';
export type QualityCouncilPosition = 'chair' | 'vice_chair' | 'secretary' | 'member';

export interface QualityFrameworksTable {
  id: Generated<string>;
  code: string;
  name: string;
  school_level: KpiSchoolLevel | null;
  legal_basis: string | null;
  max_level: Generated<number>;
  sort_order: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface QualityStandardsTable {
  id: Generated<string>;
  framework_id: string;
  code: string;
  title: string;
  sort_order: Generated<number>;
}

export interface QualityCriteriaTable {
  id: Generated<string>;
  framework_id: string;
  standard_id: string;
  code: string;
  title: string;
  evidence_hint: string | null;
  sort_order: Generated<number>;
}

export interface QualityIndicatorsTable {
  id: Generated<string>;
  criterion_id: string;
  level: number;
  code: string;
  content: string;
  sort_order: Generated<number>;
}

export interface QualityAssessmentsTable {
  id: Generated<string>;
  framework_id: string;
  org_unit_id: string;
  title: string;
  decision_number: string | null;
  decision_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: Generated<QualityAssessmentStatus>;
  introduction: string | null;
  conclusion: string | null;
  self_level: number | null;
  completed_at: Date | null;
  completed_by_name: string | null;
  external_level: number | null;
  recognition_decision: string | null;
  recognition_date: string | null;
  recognition_valid_until: string | null;
  work_plan_ids: Generated<string[]>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface QualityCouncilMembersTable {
  id: Generated<string>;
  assessment_id: string;
  staff_id: string;
  staff_name: string;
  position: QualityCouncilPosition;
  duty: string | null;
  sort_order: Generated<number>;
}

export interface QualityWorkGroupsTable {
  id: Generated<string>;
  assessment_id: string;
  name: string;
  leader_staff_id: string | null;
  sort_order: Generated<number>;
}

export interface QualityWorkGroupMembersTable {
  group_id: string;
  staff_id: string;
  staff_name: string;
}

export interface QualityCriterionReportsTable {
  id: Generated<string>;
  assessment_id: string;
  criterion_id: string;
  work_group_id: string | null;
  current_state: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_actions: ColumnType<unknown, string | undefined, string>;
  indicator_results: ColumnType<unknown, string | undefined, string>;
  self_level: number | null;
  status: Generated<QualityReportStatus>;
  submitted_at: Date | null;
  submitted_by_name: string | null;
  reviewed_at: Date | null;
  reviewed_by_name: string | null;
  return_note: string | null;
  updated_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface QualityEvidencesTable {
  id: Generated<string>;
  assessment_id: string;
  criterion_id: string;
  box: number;
  sequence: number;
  code: string;
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  description: string | null;
  status: Generated<QualityEvidenceStatus>;
  source_type: Generated<QualityEvidenceSource>;
  file_id: string | null;
  professional_document_id: string | null;
  system_document_id: string | null;
  source_label: string | null;
  inherited_code: string | null;
  inherited_year_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface QualityEvidenceCriteriaTable {
  evidence_id: string;
  criterion_id: string;
}

// Bán trú lớp ngoài Mầm non, nề nếp và thi đua lớp (DT-20 phần 20b, YCTD-159)
export type BoardingMealDayStatus = 'closed' | 'reopened';
export type BoardingMealCutSource = 'parent' | 'teacher' | 'school';
export type ConductCriterionKind = 'plus' | 'minus';

export interface BoardingMealDaysTable {
  id: Generated<string>;
  class_id: string;
  meal_date: string;
  status: Generated<BoardingMealDayStatus>;
  headcount: number;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface BoardingMealCutsTable {
  id: Generated<string>;
  child_id: string;
  class_id: string;
  meal_date: string;
  reason: string | null;
  source: BoardingMealCutSource;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface ConductSettingsTable {
  id: Generated<number>;
  enabled: Generated<boolean>;
  base_points: Generated<number>;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface ConductCriteriaTable {
  id: Generated<string>;
  code: string;
  name: string;
  kind: ConductCriterionKind;
  points: number;
  school_level: ColumnType<SchoolLevelCode, SchoolLevelCode | undefined, SchoolLevelCode>;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ConductEntriesTable {
  id: Generated<string>;
  class_id: string;
  criterion_id: string;
  entry_date: string;
  quantity: Generated<number>;
  points: number;
  note: string | null;
  reported_by: string | null;
  // Học sinh đội sao đỏ báo lỗi, giáo viên trực ghi thay (DT-21 phần 21d)
  reporter_child_id: string | null;
  recorded_by: string;
  recorded_by_name: string;
  created_at: CreatedTimestamp;
}

// Công cụ lớp học trên ứng dụng giáo viên (DT-23 phần 23b, YCTD-212)
export interface ClassroomCallLogsTable {
  id: Generated<string>;
  client_id: string;
  class_id: string;
  child_id: string;
  called_by: string;
  called_by_name: string;
  called_at: Date;
  created_at: CreatedTimestamp;
}

export interface ClassroomGroupingsTable {
  id: Generated<string>;
  class_id: string;
  owner_user_id: string;
  // [{ name, child_ids }]
  groups: JsonDocument;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ClassroomScoreEventsTable {
  id: Generated<string>;
  client_id: string;
  session_key: string;
  class_id: string;
  target_kind: 'group' | 'student';
  group_name: string | null;
  child_id: string | null;
  delta: number;
  note: string | null;
  recorded_by: string;
  recorded_by_name: string;
  occurred_at: Date;
  conduct_entry_id: ColumnType<string | null, string | null | undefined, string | null>;
  confirmed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: CreatedTimestamp;
}

// Sổ đầu bài, sơ đồ chỗ ngồi, sao đỏ cấp THCS, THPT (DT-21 phần 21d, YCTD-171)
export type LessonRatingMode = 'off' | 'optional' | 'required';
export type LessonRatingCode = 'A' | 'B' | 'C' | 'D';

export interface ClassLogSettingsTable {
  school_level: SchoolLevelCode;
  rating_mode: LessonRatingMode;
  rating_labels: ColumnType<Record<LessonRatingCode, string>, string, string>;
  low_rating_comment: boolean;
  conduct_points: ColumnType<Record<LessonRatingCode, number> | null, string | null, string | null>;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface SeatingChartsTable {
  id: Generated<string>;
  class_id: string;
  subject_id: string | null;
  effective_from: string;
  desk_columns: number;
  desk_rows: number;
  seats_per_desk: Generated<number>;
  note: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SeatingAssignmentsTable {
  chart_id: string;
  child_id: string;
  column_no: number;
  row_no: number;
  seat_no: number;
}

export interface RedStarMembersTable {
  child_id: string;
  status: Generated<CatalogStatus>;
  duty: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

// Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161)
export type AssessmentScale = 'subject' | 'competency';
export type CompetencyGroup = 'quality' | 'general' | 'specific';
export type AssessmentTermType = 'first_term' | 'second_term';
export type AssessmentPeriodKind = 'mid' | 'end';
export type CommentTemplateTarget = 'subject' | 'competency' | 'general';
export type YearResultCode = 'excellent' | 'good' | 'completed' | 'not_completed';

export interface AssessmentLevelsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  scale: AssessmentScale;
  code: string;
  name: string;
  rank: number;
  created_at: CreatedTimestamp;
}

export interface CompetencyItemsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  group_code: CompetencyGroup;
  code: string;
  name: string;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
}

export interface AssessmentPeriodsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  code: string;
  name: string;
  term_type: AssessmentTermType;
  kind: AssessmentPeriodKind;
  is_year_end: Generated<boolean>;
  order_no: Generated<number>;
  entry_deadline: string | null;
  created_at: CreatedTimestamp;
}

export interface AssessmentTestsTable {
  period_id: string;
  subject_id: string;
  grade_level_code: string;
}

export interface CommentTemplatesTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  target: CommentTemplateTarget;
  content: string;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
}

export interface SubjectResultsTable {
  id: Generated<string>;
  period_id: string;
  class_id: string;
  child_id: string;
  subject_id: string;
  level_code: string | null;
  score: number | null;
  comment: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface CompetencyResultsTable {
  id: Generated<string>;
  period_id: string;
  class_id: string;
  child_id: string;
  item_id: string;
  level_code: string | null;
  comment: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface RegularCommentsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  subject_id: string | null;
  item_id: string | null;
  comment_date: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: CreatedTimestamp;
}

export interface AssessmentLocksTable {
  period_id: string;
  class_id: string;
  locked_by: string;
  locked_by_name: string;
  locked_at: CreatedTimestamp;
}

export interface YearResultsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  suggested: YearResultCode | null;
  result: YearResultCode;
  note: string | null;
  confirmed_by: string;
  confirmed_by_name: string;
  confirmed_at: UpdatedTimestamp;
}

// Thư viện trường học (DT-22 phần 22a, YCTD-181)
export type LibraryReaderKind = 'staff' | 'student';
export type LibraryCopyCondition = 'good' | 'damaged' | 'lost' | 'disposed';
export type LibraryCopySource = 'purchase' | 'donation' | 'supplied';
export type LibraryLoanKind = 'regular' | 'textbook';
export type LibraryLoanStatus = 'open' | 'returned' | 'lost';
export type LibraryReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

export interface LibrarySettingsTable {
  id: Generated<number>;
  student_levels: ColumnType<SchoolLevelCode[], SchoolLevelCode[] | undefined, SchoolLevelCode[]>;
  hold_days: Generated<number>;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface LibraryLoanRulesTable {
  reader_kind: LibraryReaderKind;
  max_items: number;
  loan_days: number;
  max_renewals: number;
  fine_per_day: Generated<number>;
}

export interface LibraryCategoriesTable {
  id: Generated<string>;
  code: string;
  name: string;
  lendable: Generated<boolean>;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryTitlesTable {
  id: Generated<string>;
  category_id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  publish_year: number | null;
  isbn: string | null;
  school_level: SchoolLevelCode | null;
  grade_level: string | null;
  subject_id: string | null;
  topic: string | null;
  language: Generated<string>;
  shelf: string | null;
  description: string | null;
  status: Generated<'active' | 'retired'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryTitleFilesTable {
  id: Generated<string>;
  title_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export interface LibraryCopiesTable {
  id: Generated<string>;
  title_id: string;
  copy_no: string;
  source: Generated<LibraryCopySource>;
  price: number | null;
  acquired_on: string | null;
  shelf: string | null;
  condition: Generated<LibraryCopyCondition>;
  note: string | null;
  disposed_on: string | null;
  disposal_reason: string | null;
  disposed_by_name: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryReadersTable {
  id: Generated<string>;
  reader_kind: LibraryReaderKind;
  staff_id: string | null;
  child_id: string | null;
  card_no: string;
  status: Generated<'active' | 'locked'>;
  locked_reason: string | null;
  issued_on: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryLoansTable {
  id: Generated<string>;
  copy_id: string;
  reader_id: string;
  class_id: string | null;
  kind: Generated<LibraryLoanKind>;
  loaned_on: string;
  due_on: string;
  returned_on: string | null;
  renewals: Generated<number>;
  status: Generated<LibraryLoanStatus>;
  return_condition: 'good' | 'damaged' | 'lost' | null;
  fine_amount: Generated<number>;
  note: string | null;
  loaned_by: string | null;
  loaned_by_name: string | null;
  received_by_name: string | null;
  reminded_on: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryReservationsTable {
  id: Generated<string>;
  title_id: string;
  reader_id: string;
  status: Generated<LibraryReservationStatus>;
  copy_id: string | null;
  reserved_at: Generated<Date>;
  ready_on: string | null;
  expires_on: string | null;
  closed_at: Date | null;
  created_by: string | null;
}

export interface LibraryTextbookSetsTable {
  id: Generated<string>;
  name: string;
  grade_level: string;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface LibraryTextbookSetTitlesTable {
  set_id: string;
  title_id: string;
}

export interface LibraryStocktakesTable {
  id: Generated<string>;
  name: string;
  shelf: string | null;
  status: Generated<'open' | 'closed'>;
  started_by_name: string;
  started_at: Generated<Date>;
  closed_at: Date | null;
  closed_by_name: string | null;
}

export interface LibraryStocktakeItemsTable {
  stocktake_id: string;
  copy_id: string;
  scanned_by_name: string;
  scanned_at: Generated<Date>;
}

export interface LibraryIndicatorsTable {
  code: string;
  name: string;
  threshold: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  enabled: Generated<boolean>;
  order_no: Generated<number>;
}

export interface LibraryCountersTable {
  name: string;
  value: Generated<number>;
}

// Học bạ số, khen thưởng học sinh, hoàn thành chương trình (DT-20 phần 20e, YCTD-163)
export type StudentAwardKind = 'year_end' | 'special';
export type StudentAwardBasis = 'excellent' | 'outstanding' | 'secondary_excellent' | 'secondary_good';
export type StudentAwardStatus = 'proposed' | 'approved' | 'rejected';
export type CompletionOutcome = 'promoted' | 'level_completed' | 'pending_support' | 'retained';
export type SupportPlan = 'summer_training' | 'retest';
export type LearningRecordStatus = 'draft' | 'signed';

export interface StudentAwardTitlesTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  code: string;
  name: string;
  kind: StudentAwardKind;
  basis: StudentAwardBasis | null;
  order_no: Generated<number>;
  status: Generated<CatalogStatus>;
  created_at: CreatedTimestamp;
}

export interface StudentAwardsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  title_id: string;
  title_name: string;
  achievement: string | null;
  status: Generated<StudentAwardStatus>;
  proposed_by: string;
  proposed_by_name: string;
  proposed_at: CreatedTimestamp;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  lookup_code: string | null;
}

export interface CompletionResultsTable {
  id: Generated<string>;
  class_id: string;
  child_id: string;
  grade_level: string;
  year_result: string;
  outcome: CompletionOutcome;
  support_plan: SupportPlan | null;
  support_result: 'completed' | 'not_completed' | null;
  support_note: string | null;
  next_grade_level: string | null;
  confirmed_by: string;
  confirmed_by_name: string;
  confirmed_at: UpdatedTimestamp;
}

export interface LearningRecordsTable {
  id: Generated<string>;
  child_id: string;
  academic_year_name: string;
  class_id: string | null;
  class_name: string;
  grade_level: string;
  school_level: SchoolLevelCode;
  content: ColumnType<Record<string, unknown>, string, string>;
  homeroom_comment: string | null;
  status: Generated<LearningRecordStatus>;
  signed_storage_key: string | null;
  signed_at: Date | null;
  signer_name: string | null;
  signature_method: string | null;
  prepared_by_name: string;
  updated_at: UpdatedTimestamp;
}

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168)
export type QuestionStatus = 'draft' | 'review' | 'approved' | 'retired';
export type CognitiveLevelCode = 'recognition' | 'comprehension' | 'application' | 'high_application';
export type QuestionTypeCode = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
export type AssessmentPlanStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type ExamStatus = 'draft' | 'submitted' | 'approved' | 'locked';

export interface QuestionTopicsTable {
  id: Generated<string>;
  subject_id: string;
  grade_level_code: string | null;
  name: string;
  order_no: Generated<number>;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_at: CreatedTimestamp;
}

export interface QuestionsTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  topic_id: string | null;
  cognitive_level: CognitiveLevelCode;
  question_type: QuestionTypeCode;
  content: string;
  options: DefaultJson;
  answer: DefaultJson;
  guidance: string | null;
  score: ColumnType<string, number | undefined, number>;
  status: ColumnType<QuestionStatus, QuestionStatus | undefined, QuestionStatus>;
  review_note: string | null;
  author_user_id: string;
  author_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  last_used_at: ColumnType<string | null, string | null | undefined, string | null>;
  use_count: Generated<number>;
  // Câu do trợ lý AI soạn nháp (DT-23 phần 23d)
  ai_generated: Generated<boolean>;
  ai_request_id: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface QuestionUsagesTable {
  id: Generated<string>;
  question_id: string;
  exam_id: string | null;
  used_on: string;
  created_at: CreatedTimestamp;
  // Kết quả sử dụng ghi khi khoá bài kiểm tra (DT-21 phần 22g2)
  attempts: number | null;
  difficulty: ColumnType<string | null, number | null | undefined, number | null>;
  discrimination: ColumnType<string | null, number | null | undefined, number | null>;
  // Lượt dùng trong trò chơi ở lớp (DT-23 phần 23c): nguồn, lượt chơi, tỷ lệ đúng của lớp (phần trăm)
  source: Generated<'exam' | 'game' | 'activity'>;
  game_session_id: string | null;
  // Câu dùng trong bài tập trực tuyến (DT-28 phần 28d)
  activity_id: ColumnType<string | null, string | null | undefined, string | null>;
  correct_rate: ColumnType<string | null, number | null | undefined, number | null>;
}

// Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173)
export type ExamSessionStatus = 'grading' | 'locked' | 'transferred';

export interface ExamSessionsTable {
  id: Generated<string>;
  exam_id: string;
  class_id: string;
  subject_id: string;
  term_type: 'first_term' | 'second_term';
  score_kind: 'regular' | 'mid' | 'final';
  score_seq: Generated<number>;
  true_false_rule: ColumnType<
    'tiered' | 'proportional',
    'tiered' | 'proportional' | undefined,
    'tiered' | 'proportional'
  >;
  double_marking: Generated<boolean>;
  mark_tolerance: ColumnType<string, number | undefined, number>;
  absent_policy: ColumnType<'skip' | 'zero', 'skip' | 'zero' | undefined, 'skip' | 'zero'>;
  status: ColumnType<ExamSessionStatus, ExamSessionStatus | undefined, ExamSessionStatus>;
  locked_at: Date | null;
  locked_by_name: string | null;
  transferred_at: Date | null;
  transferred_by_name: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExamSheetsTable {
  id: Generated<string>;
  session_id: string;
  child_id: string;
  variant_code: string | null;
  absent: Generated<boolean>;
  answers: DefaultJson;
  essay: DefaultJson;
  objective_score: ColumnType<string | null, number | null | undefined, number | null>;
  essay_score: ColumnType<string | null, number | null | undefined, number | null>;
  total_score: ColumnType<string | null, number | null | undefined, number | null>;
  results: DefaultJson;
  needs_review: Generated<boolean>;
  source: ColumnType<
    'manual' | 'import' | 'online',
    'manual' | 'import' | 'online' | undefined,
    'manual' | 'import' | 'online'
  >;
  // Lượt làm trực tuyến đang được tính vào phiếu (DT-23 phần 23a)
  attempt_id: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211)
export interface OnlineExamSettingsTable {
  school_level: SchoolLevelCode;
  student_login_enabled: Generated<boolean>;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export type ExamMode = 'at-school' | 'remote';

// Cấu hình thi trực tuyến của trường (DT-23 phần 23a, Eric chốt 2026-10-26: mặc định chỉ thi tại trường); một dòng duy nhất
export interface OnlineExamSchoolSettingsTable {
  id: Generated<boolean>;
  default_exam_mode: Generated<ExamMode>;
  allow_remote: Generated<boolean>;
  allowed_networks: DefaultJson;
  room_code_minutes: Generated<number>;
  // Giám thị camera (DT-23 phần 23e): mặc định tắt
  allow_live_proctoring: Generated<boolean>;
  allow_recording: Generated<boolean>;
  recording_retention_days: Generated<number>;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface ExamRoomsTable {
  id: Generated<string>;
  assignment_id: string;
  code: string;
  opened_by: string;
  opened_by_name: string;
  opened_at: CreatedTimestamp;
  expires_at: Date;
  closed_at: Date | null;
  closed_by_name: string | null;
}

export interface ExamRoomStudentsTable {
  room_id: string;
  child_id: string;
  entered_at: Date | null;
}

export interface ExamAssignmentsTable {
  id: Generated<string>;
  exam_id: string;
  school_level: SchoolLevelCode;
  title: string;
  opens_at: Date;
  closes_at: Date;
  duration_minutes: number;
  max_attempts: Generated<number>;
  attempt_policy: Generated<'best' | 'last'>;
  shuffle_questions: Generated<boolean>;
  shuffle_options: Generated<boolean>;
  variant_mode: Generated<'random' | 'fixed'>;
  fixed_variant_code: string | null;
  result_mode: Generated<'immediate' | 'after_close' | 'teacher_release'>;
  results_released_at: Date | null;
  fullscreen_required: Generated<boolean>;
  max_violations: Generated<number>;
  violation_action: Generated<'flag' | 'auto_submit'>;
  camera_enabled: Generated<boolean>;
  camera_fallback: Generated<'block' | 'flag'>;
  single_session_mode: Generated<'reject_new' | 'close_old'>;
  exam_mode: Generated<ExamMode>;
  proctor_live: Generated<boolean>;
  proctor_record: Generated<boolean>;
  term_type: Generated<'first_term' | 'second_term'>;
  score_kind: Generated<'regular' | 'mid' | 'final'>;
  score_seq: Generated<number>;
  true_false_rule: Generated<'tiered' | 'proportional'>;
  absent_policy: Generated<'skip' | 'zero'>;
  status: Generated<'published' | 'cancelled'>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExamAssignmentTargetsTable {
  id: Generated<string>;
  assignment_id: string;
  // `group` (DT-28 phần 28a): nhóm của bộ nhóm; dòng `student` có `group_id` là thành viên của nhóm lúc giao
  kind: 'class' | 'student' | 'group';
  class_id: string | null;
  child_id: string | null;
  group_id: ColumnType<string | null, string | null | undefined, string | null>;
}

export interface ExamAttemptsTable {
  id: Generated<string>;
  assignment_id: string;
  child_id: string;
  attempt_no: number;
  variant_code: string;
  layout: JsonDocument;
  started_at: Date;
  deadline_at: Date;
  submitted_at: Date | null;
  submit_reason: 'manual' | 'timeout' | 'violation' | 'teacher' | null;
  status: Generated<'in_progress' | 'submitted'>;
  session_id: string;
  answers: DefaultJson;
  essay_marks: DefaultJson;
  last_saved_at: Date | null;
  objective_score: ColumnType<string | null, number | null | undefined, number | null>;
  essay_score: ColumnType<string | null, number | null | undefined, number | null>;
  total_score: ColumnType<string | null, number | null | undefined, number | null>;
  max_score: ColumnType<string | null, number | null | undefined, number | null>;
  results: DefaultJson;
  needs_marking: Generated<boolean>;
  flagged: Generated<boolean>;
  flag_reasons: DefaultJson;
  camera_state: Generated<'off' | 'granted' | 'denied' | 'unavailable'>;
  sheet_synced: Generated<boolean>;
  proctor_notice_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type ExamAttemptEventType =
  | 'fullscreen_exit'
  | 'page_hidden'
  | 'window_blur'
  | 'camera_denied'
  | 'camera_unavailable'
  | 'camera_lost'
  | 'no_face'
  | 'multiple_faces'
  | 'second_session';

export interface ExamAttemptEventsTable {
  id: Generated<string>;
  attempt_id: string;
  event_type: ExamAttemptEventType;
  occurred_at: Date;
  client_at: Date | null;
  detail: DefaultJson;
  created_at: CreatedTimestamp;
}

// Giám thị camera cho thi trực tuyến (DT-23 phần 23e, YCTD-215)
export type ProctorConsentScope = 'live' | 'record';

export interface ExamProctorConsentsTable {
  id: Generated<string>;
  child_id: string;
  scope: ProctorConsentScope;
  source: 'parent' | 'school';
  granted_by: string;
  granted_by_name: string;
  note: string | null;
  granted_at: CreatedTimestamp;
  revoked_at: Date | null;
  revoked_by_name: string | null;
}

export interface ExamProctorViewsTable {
  id: Generated<string>;
  attempt_id: string;
  kind: 'live' | 'recording';
  viewer_id: string;
  viewer_name: string;
  started_at: CreatedTimestamp;
  last_seen_at: ColumnType<Date, Date | undefined, Date>;
  ended_at: Date | null;
}

export interface ExamProctorSignalsTable {
  id: Generated<string>;
  view_id: string;
  direction: 'to_student' | 'to_teacher';
  kind: 'offer' | 'answer' | 'ice';
  payload: string;
  created_at: CreatedTimestamp;
}

export interface ExamRecordingChunksTable {
  attempt_id: string;
  seq: number;
  storage_key: string;
  size_bytes: number;
  created_at: CreatedTimestamp;
  expires_at: Date;
}

export interface ExamMatricesTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  name: string;
  total_score: ColumnType<string, number | undefined, number>;
  target_ratios: JsonDocument;
  tolerance: ColumnType<string, number | undefined, number>;
  rows: DefaultJson;
  status: Generated<'active' | 'inactive'>;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AssessmentPlansTable {
  id: Generated<string>;
  school_level: SchoolLevelCode;
  term: 'HK1' | 'HK2';
  grade_level_code: string;
  subject_id: string;
  kind: 'regular' | 'midterm' | 'final';
  form: 'written' | 'multiple_choice' | 'mixed' | 'practical' | 'oral';
  duration_minutes: number;
  planned_date: string | null;
  status: ColumnType<AssessmentPlanStatus, AssessmentPlanStatus | undefined, AssessmentPlanStatus>;
  note: string | null;
  review_note: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExamsTable {
  id: Generated<string>;
  plan_id: string | null;
  matrix_id: string | null;
  school_level: SchoolLevelCode;
  subject_id: string;
  grade_level_code: string;
  title: string;
  duration_minutes: Generated<number>;
  variant_count: Generated<number>;
  avoid_recent_days: Generated<number>;
  status: ColumnType<ExamStatus, ExamStatus | undefined, ExamStatus>;
  author_user_id: string;
  author_name: string;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  due_date: string | null;
  review_note: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  locked_at: Date | null;
  locked_by_name: string | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ExamQuestionsTable {
  id: Generated<string>;
  exam_id: string;
  question_id: string;
  order_no: number;
  score: ColumnType<string, number, number>;
  snapshot: JsonDocument;
}

export interface ExamVariantsTable {
  id: Generated<string>;
  exam_id: string;
  code: string;
  items: JsonDocument;
  created_at: CreatedTimestamp;
}

// Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213)
export type ClassroomGameKind = 'crossword' | 'wheel' | 'quiz_rounds' | 'answer_cards';

export interface ClassroomGameSessionsTable {
  id: Generated<string>;
  client_id: string;
  class_id: string;
  kind: ClassroomGameKind;
  title: string;
  config: ColumnType<Record<string, unknown>, string | undefined, string>;
  group_scores: ColumnType<Record<string, number>, string | undefined, string>;
  question_count: Generated<number>;
  started_at: Date;
  finished_at: Date;
  recorded_by: string;
  recorded_by_name: string;
  created_at: CreatedTimestamp;
}

export interface ClassroomGameAnswersTable {
  id: Generated<string>;
  session_id: string;
  question_id: string;
  child_id: string | null;
  group_name: string | null;
  answer: string | null;
  correct: boolean;
  created_at: CreatedTimestamp;
}

// Lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272)
export type CourseSpaceKind = 'class_subject' | 'elective';
export type CourseActivityKind =
  | 'resource'
  | 'page'
  | 'link'
  | 'exam'
  | 'live_session'
  | 'assignment'
  | 'discussion'
  | 'question_board'
  | 'group_work'
  | 'scorm';
export type CourseActivityCompletionRule = 'view' | 'submit' | 'pass' | 'teacher';
export type ActivityResultStatus = 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed' | 'excused';
export type ActivityResultLevel = 'excellent' | 'completed' | 'not_completed';
export type TeachingMode = 'support' | 'replace';
export type LearningEventVerb =
  'opened' | 'viewed' | 'progressed' | 'completed' | 'submitted' | 'scored' | 'published' | 'unlocked' | 'acknowledged';

export interface CourseSpacesTable {
  id: Generated<string>;
  kind: CourseSpaceKind;
  class_id: string | null;
  subject_id: string | null;
  school_level: 'TH' | 'THCS' | 'THPT';
  grade_level: string | null;
  title: string;
  description: string | null;
  visible_to_students: Generated<boolean>;
  status: Generated<'active' | 'archived'>;
  enrollment_mode: Generated<'teacher' | 'request'>;
  capacity: number | null;
  source_template_id: string | null;
  source_template_version: number | null;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface CourseSpaceTeachersTable {
  space_id: string;
  user_id: string;
  user_name: string;
  source: 'assignment' | 'timetable' | 'manual';
  created_at: CreatedTimestamp;
}

export interface CourseEnrollmentsTable {
  space_id: string;
  child_id: string;
  status: Generated<'requested' | 'active' | 'removed'>;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface CourseSectionsTable {
  id: Generated<string>;
  space_id: string;
  title: string;
  position: number;
  planned_week: number | null;
  template_section_key: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface CourseActivitiesTable {
  id: Generated<string>;
  space_id: string;
  section_id: string;
  kind: CourseActivityKind;
  title: string;
  lesson_label: string | null;
  instructions: string | null;
  position: number;
  status: Generated<'draft' | 'published'>;
  required: Generated<boolean>;
  teaching_mode: Generated<TeachingMode>;
  estimated_minutes: number | null;
  opens_at: Date | null;
  due_at: Date | null;
  closes_at: Date | null;
  group_set_id: string | null;
  // { mode: 'all' | 'any', rules: [...] }
  open_rules: JsonValue;
  completion_rule: Generated<CourseActivityCompletionRule>;
  graded: Generated<boolean>;
  // numeric đọc ra chuỗi
  weight: ColumnType<string, string | number | undefined, string | number>;
  pass_score: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  planned_week: number | null;
  settings: ColumnType<unknown, string | undefined, string>;
  template_item_key: string | null;
  edited_locally: Generated<boolean>;
  created_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface ActivityExceptionsTable {
  activity_id: string;
  child_id: string;
  unlocked: Generated<boolean>;
  due_at: Date | null;
  reason: string;
  granted_by: string;
  granted_by_name: string;
  created_at: CreatedTimestamp;
}

export interface ActivityResultsTable {
  id: Generated<string>;
  activity_id: string;
  child_id: string;
  status: ActivityResultStatus;
  progress: number | null;
  score: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  level: ActivityResultLevel | null;
  source: string;
  completed_at: Date | null;
  recorded_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface LearningEventsTable {
  id: Generated<string>;
  space_id: string;
  activity_id: string | null;
  child_id: string | null;
  actor_user_id: string;
  actor_kind: 'teacher' | 'student' | 'guardian' | 'staff';
  verb: LearningEventVerb;
  result: JsonValue;
  occurred_at: CreatedTimestamp;
}

export interface OnlineTeachingDecisionsTable {
  id: Generated<string>;
  decision_no: string;
  decision_date: string;
  reason: string;
  // Mã lớp áp dụng; mảng rỗng là toàn trường
  class_ids: ColumnType<unknown, string | undefined, string>;
  starts_on: string;
  ends_on: string;
  status: Generated<'active' | 'revoked'>;
  created_by: string;
  created_by_name: string;
  revoked_by: string | null;
  revoked_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface OnlineLearningRulesTable {
  id: Generated<string>;
  version: number;
  content: string;
  published_by: string;
  published_by_name: string;
  published_at: CreatedTimestamp;
}

export interface OnlineLearningRuleAcksTable {
  rule_id: string;
  child_id: string;
  acknowledged_by: string;
  acknowledged_as: 'student' | 'guardian';
  acknowledged_at: CreatedTimestamp;
}

// Gia sư trong trường (DT-27 phần 27b, YCTD-252)
export type TutoringContentType = 'curriculum' | 'enrichment';
export type TutoringAudience = 'below_standard' | 'gifted' | 'final_year_review';
export type TutoringDelivery = 'live_video' | 'course' | 'qa' | 'mixed';
export type TutoringProgramStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed';
export type TutoringRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type TutoringAttendanceStatus = 'present' | 'late' | 'left_early' | 'absent';

export interface TutoringRulesTable {
  id: Generated<string>;
  effective_from: ColumnType<string, string, string>;
  max_curriculum_periods_per_week: number;
  curriculum_blocked_levels: ColumnType<SchoolLevelCode[], string | undefined, string>;
  default_period_minutes: ColumnType<Partial<Record<SchoolLevelCode, number>>, string | undefined, string>;
  legal_basis: string;
  created_by_name: string | null;
  created_at: CreatedTimestamp;
}

export interface TutoringProgramsTable {
  id: Generated<string>;
  name: string;
  school_level: SchoolLevelCode;
  subject_id: string | null;
  topic: string | null;
  content_type: TutoringContentType;
  audience: TutoringAudience | null;
  charges_fee: Generated<boolean>;
  delivery: Generated<TutoringDelivery>;
  description: string | null;
  registration_form: string;
  max_students: number | null;
  starts_on: ColumnType<string, string, string>;
  ends_on: ColumnType<string, string, string>;
  status: Generated<TutoringProgramStatus>;
  reject_reason: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  // Thu phí và thù lao (YCTD-253)
  fee_basis: ColumnType<TutoringFeeBasis | null, TutoringFeeBasis | null | undefined, TutoringFeeBasis | null>;
  fee_amount: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  cancel_refund: Generated<TutoringCancelRefund>;
  pay_rate_per_period: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  funding_source: Generated<TutoringFundingSource>;
  // Ghi hình lớp video của chương trình, cần đồng ý của cha mẹ (YCTD-251)
  recording_enabled: Generated<boolean>;
  // Thời hạn trả lời câu hỏi bài tập (YCTD-255)
  answer_hours: Generated<number>;
}

export type TutoringFeeBasis = 'per_session' | 'per_program';
export type TutoringCancelRefund = 'deduct_next' | 'adjust_invoice';
export type TutoringFundingSource = 'school_budget' | 'tutoring_fees';

export interface TutoringProgramTeachersTable {
  program_id: string;
  teacher_user_id: string;
  teacher_name: string;
  pay_rate_per_period: ColumnType<string | null, string | number | null | undefined, string | number | null>;
}

// Buổi đã lập khoản thu ở dòng hóa đơn nào; trọn gói thì `session_id` trống (YCTD-253)
export interface TutoringChargeSessionsTable {
  id: Generated<string>;
  invoice_item_id: string;
  registration_id: string;
  session_id: string | null;
  amount: Money;
  sessions_total: number | null;
  created_at: CreatedTimestamp;
}

export interface TutoringCreditsTable {
  id: Generated<string>;
  child_id: string;
  registration_id: string;
  session_id: string;
  charged_invoice_id: string;
  amount: Money;
  reason: string;
  mode: TutoringCancelRefund;
  status: Generated<'open' | 'adjusted' | 'closed'>;
  invoice_adjustment_id: string | null;
  closed_note: string | null;
  closed_by_name: string | null;
  closed_at: Date | null;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface TutoringCreditApplicationsTable {
  credit_id: string;
  invoice_item_id: string;
  amount: Money;
}

export interface TutoringTeacherPayTable {
  id: Generated<string>;
  session_id: string;
  program_id: string;
  teacher_user_id: string;
  teacher_name: string;
  staff_id: string;
  periods: number;
  rate: Money;
  amount: Money;
  funding_source: TutoringFundingSource;
  bonus_deduction_id: string;
  target_year: number;
  target_month: number;
  pushed_by_name: string;
  pushed_at: CreatedTimestamp;
}

export interface TutoringProgramClassesTable {
  program_id: string;
  class_id: string;
}

export interface TutoringProgramCandidatesTable {
  program_id: string;
  child_id: string;
  source: Generated<'suggested' | 'manual'>;
  confirmed_by_name: string;
  confirmed_at: ColumnType<Date, Date | undefined, Date>;
}

export interface TutoringSessionsTable {
  id: Generated<string>;
  program_id: string;
  series_id: string | null;
  session_date: ColumnType<string, string, string>;
  start_time: string;
  end_time: string;
  periods: number;
  location: string | null;
  status: Generated<'scheduled' | 'cancelled'>;
  cancel_reason: string | null;
  video_room_ref: string | null;
  attendance_confirmed_at: Date | null;
  attendance_confirmed_by_name: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  // Người dạy buổi, ghi khi xác nhận điểm danh (YCTD-253)
  taught_by_user_id: ColumnType<string | null, string | null | undefined, string | null>;
  taught_by_name: ColumnType<string | null, string | null | undefined, string | null>;
}

export interface TutoringExemptionsTable {
  id: Generated<string>;
  decision_no: string;
  decision_date: ColumnType<string, string, string>;
  subject_id: string;
  max_periods_per_week: number;
  file_key: string | null;
  file_name: string | null;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface TutoringExemptionChildrenTable {
  exemption_id: string;
  child_id: string;
}

export interface TutoringRegistrationsTable {
  id: Generated<string>;
  program_id: string;
  child_id: string;
  guardian_user_id: string;
  guardian_name: string;
  form_text: string;
  form_hash: string;
  note: string | null;
  submitted_at: ColumnType<Date, Date | undefined, Date>;
  status: Generated<TutoringRegistrationStatus>;
  decided_by_name: string | null;
  decided_at: Date | null;
  reject_reason: string | null;
  withdrawn_at: Date | null;
}

export interface TutoringAttendanceTable {
  session_id: string;
  child_id: string;
  status: TutoringAttendanceStatus;
  source: 'room_log' | 'teacher';
  joined_at: Date | null;
  left_at: Date | null;
  note: string | null;
  confirmed_by_name: string | null;
  confirmed_at: Date | null;
  guardian_notified_at: Date | null;
}

export interface TutoringRoomEventsTable {
  id: Generated<string>;
  session_id: string;
  child_id: string;
  kind: 'join' | 'leave';
  at: Date;
  source: string;
}

// Bài tập trực tuyến (DT-28 phần 28c, YCTD-273)
export type AssignmentContext = 'in_class' | 'homework';
export type AssignmentWorkMode = 'individual' | 'group';
export type AssignmentGrading = 'score' | 'rubric' | 'level' | 'completion' | 'none';
export type AssignmentItemKind = 'question' | 'essay' | 'upload' | 'audio' | 'resource';
export type SubmissionStatus = 'draft' | 'submitted' | 'returned';
type Numeric = ColumnType<string, string | number | undefined, string | number>;
type NullableNumeric = ColumnType<string | null, string | number | null | undefined, string | number | null>;
type Json = ColumnType<unknown, string | undefined, string>;

export interface AssignmentsTable {
  id: Generated<string>;
  activity_id: string;
  context: Generated<AssignmentContext>;
  work_mode: Generated<AssignmentWorkMode>;
  group_set_id: string | null;
  late_policy: Generated<'allow' | 'block'>;
  max_attempts: Generated<number>;
  grading: Generated<AssignmentGrading>;
  rubric_id: string | null;
  rubric_snapshot: JsonValue;
  show_results: Generated<'after_submit' | 'after_return'>;
  estimated_minutes: number | null;
  released_at: Date | null;
  closed_at: Date | null;
  // Bài về nhà (DT-28 phần 28f): tiết của sổ đầu bài đã giao bài, nhóm của tiết; lý do Ban Giám hiệu phát hành vượt quy tắc chặn
  class_log_id: string | null;
  group_no: number | null;
  policy_override_reason: string | null;
  policy_override_by: string | null;
  created_by: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface AssignmentVariantsTable {
  id: Generated<string>;
  assignment_id: string;
  code: string;
  name: string;
}

export interface AssignmentItemsTable {
  id: Generated<string>;
  assignment_id: string;
  variant_id: string | null;
  position: number;
  kind: AssignmentItemKind;
  question_id: string | null;
  snapshot: JsonValue;
  prompt: string | null;
  score: Numeric;
  settings: Json;
}

export interface AssignmentTargetsTable {
  id: Generated<string>;
  assignment_id: string;
  target_kind: 'class' | 'group' | 'child';
  group_id: string | null;
  child_id: string | null;
  variant_id: string | null;
}

export interface AssignmentRecipientsTable {
  assignment_id: string;
  child_id: string;
  group_id: string | null;
  variant_id: string | null;
  due_at: Date | null;
  excused: Generated<boolean>;
  excuse_reason: string | null;
  created_at: CreatedTimestamp;
}

export interface AssignmentSubmissionsTable {
  id: Generated<string>;
  assignment_id: string;
  child_id: string | null;
  group_id: string | null;
  attempt_no: number;
  status: Generated<SubmissionStatus>;
  version: Generated<number>;
  answers: Json;
  late: Generated<boolean>;
  submitted_by: string | null;
  submitted_by_kind: 'student' | 'guardian' | 'teacher' | null;
  submitted_at: Date | null;
  auto_score: NullableNumeric;
  item_scores: Json;
  criteria_scores: JsonValue;
  score: NullableNumeric;
  level: 'excellent' | 'completed' | 'not_completed' | null;
  feedback: string | null;
  feedback_ai_assisted: Generated<boolean>;
  graded_by: string | null;
  graded_at: Date | null;
  returned_by: string | null;
  returned_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface SubmissionFilesTable {
  id: Generated<string>;
  submission_id: string;
  item_id: string;
  kind: 'image' | 'document' | 'audio';
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  uploaded_by: string;
  created_at: CreatedTimestamp;
}

export interface SubmissionCommentsTable {
  id: Generated<string>;
  submission_id: string;
  author_user_id: string;
  author_name: string;
  author_kind: 'teacher' | 'student' | 'guardian';
  body: string;
  created_at: CreatedTimestamp;
}

export interface SubmissionContributionsTable {
  submission_id: string;
  child_id: string;
  self_rating: number | null;
  self_note: string | null;
  peer_ratings: Json;
  adjusted_score: NullableNumeric;
  adjust_reason: string | null;
  adjusted_by: string | null;
  updated_at: UpdatedTimestamp;
}

export interface AssignmentCommentBankTable {
  id: Generated<string>;
  owner_user_id: string;
  content: string;
  created_at: CreatedTimestamp;
}

// Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274)
export interface OnlineTeachingTermReportsTable {
  id: Generated<string>;
  term_type: 'first_term' | 'second_term';
  evaluation: string | null;
  difficulties: string | null;
  causes: string | null;
  recommendations: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface ActivityScoreTransfersTable {
  id: Generated<string>;
  space_id: string;
  target: 'score_book' | 'comment_book';
  activity_ids: ColumnType<unknown, string, string>;
  method: 'single' | 'weighted';
  term_type: 'first_term' | 'second_term';
  seq: number | null;
  written: number;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251)
export type VideoRoomRole = 'host' | 'student' | 'guardian' | 'observer';

export interface VideoSettingsTable {
  id: Generated<boolean>;
  max_participants: Generated<number>;
  recording_retention_days: Generated<number>;
  lobby_enabled: Generated<boolean>;
  updated_by_name: string | null;
  updated_at: UpdatedTimestamp;
}

export interface VideoRoomsTable {
  id: Generated<string>;
  kind: 'session' | 'instant';
  tutoring_session_id: string | null;
  title: string;
  host_user_id: string;
  host_name: string;
  status: Generated<'open' | 'ended'>;
  provider: string;
  max_participants: number;
  lobby_enabled: boolean;
  recording_allowed: Generated<boolean>;
  created_at: CreatedTimestamp;
  ended_at: Date | null;
}

export interface VideoRoomAdmissionsTable {
  room_id: string;
  identity: string;
  role: VideoRoomRole;
  display_name: string;
  user_id: string;
  child_id: string | null;
  requested_at: ColumnType<Date, Date | undefined, Date>;
  admitted_at: Date | null;
  admitted_by_name: string | null;
  can_speak: Generated<boolean>;
  can_share: Generated<boolean>;
}

export interface VideoRoomEventsTable {
  id: Generated<string>;
  room_id: string;
  identity: string;
  role: VideoRoomRole;
  kind: 'join' | 'leave';
  at: Date;
  source: string;
}

export interface VideoRecordingConsentsTable {
  id: Generated<string>;
  program_id: string;
  child_id: string;
  guardian_user_id: string;
  guardian_name: string;
  consent_text: string;
  consent_hash: string;
  consented_at: ColumnType<Date, Date | undefined, Date>;
  withdrawn_at: Date | null;
}

export interface VideoRecordingsTable {
  id: Generated<string>;
  room_id: string;
  egress_id: string | null;
  storage_key: string;
  status: Generated<'recording' | 'ready' | 'failed' | 'deleted'>;
  started_by_name: string;
  started_at: ColumnType<Date, Date | undefined, Date>;
  ended_at: Date | null;
  size_bytes: ColumnType<string, string | number | undefined, string | number>;
  expires_at: Date;
  hold_reason: string | null;
  deleted_at: Date | null;
}

export interface VideoRecordingViewsTable {
  id: Generated<string>;
  recording_id: string;
  viewer_user_id: string;
  viewer_name: string;
  viewed_at: CreatedTimestamp;
}

// Giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275)
export type DiscussionKind = 'announcement' | 'forum' | 'question' | 'group_board';
export type DiscussionAuthorKind = 'teacher' | 'student' | 'staff';

export interface DiscussionThreadsTable {
  id: Generated<string>;
  scope: 'course_space' | 'group';
  space_id: string | null;
  group_id: string | null;
  kind: DiscussionKind;
  title: string;
  body: string;
  section_id: string | null;
  activity_id: string | null;
  private: Generated<boolean>;
  status: Generated<'open' | 'locked'>;
  accepted_post_id: string | null;
  author_user_id: string;
  author_name: string;
  author_kind: DiscussionAuthorKind;
  author_child_id: string | null;
  flags: ColumnType<unknown, string | undefined, string>;
  hidden_at: Date | null;
  hidden_by: string | null;
  last_post_at: Generated<Date>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface DiscussionPostsTable {
  id: Generated<string>;
  thread_id: string;
  body: string;
  author_user_id: string;
  author_name: string;
  author_kind: DiscussionAuthorKind;
  author_child_id: string | null;
  flags: ColumnType<unknown, string | undefined, string>;
  hidden_at: Date | null;
  hidden_by: string | null;
  created_at: CreatedTimestamp;
}

export interface DiscussionReportsTable {
  id: Generated<string>;
  thread_id: string;
  post_id: string | null;
  source: 'report' | 'filter';
  reason: string;
  reporter_user_id: string | null;
  reporter_kind: 'teacher' | 'student' | 'guardian' | 'staff' | null;
  status: Generated<'open' | 'resolved' | 'dismissed'>;
  due_at: Date;
  resolution: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface GroupTasksTable {
  id: Generated<string>;
  group_id: string;
  title: string;
  assignee_child_id: string | null;
  due_on: ColumnType<string | null, string | null | undefined, string | null>;
  status: Generated<'todo' | 'doing' | 'done'>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface GroupNotesTable {
  id: Generated<string>;
  group_id: string;
  version: number;
  content: string;
  edited_by: string;
  edited_by_name: string;
  created_at: CreatedTimestamp;
}

export interface GroupFilesTable {
  id: Generated<string>;
  group_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  uploaded_by: string;
  uploaded_by_name: string;
  hidden_at: Date | null;
  created_at: CreatedTimestamp;
}

export interface DiscussionSpaceSettingsTable {
  space_id: string;
  students_can_post_topics: Generated<boolean>;
  updated_by: string;
  updated_at: UpdatedTimestamp;
}

export interface DiscussionWriteBansTable {
  id: Generated<string>;
  child_id: string;
  until: Date;
  reason: string;
  report_id: string | null;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

// Khoá học ghi sẵn của chương trình gia sư (DT-27 phần 27d1, YCTD-254)
export interface TutoringProgramCoursesTable {
  program_id: string;
  course_space_id: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
}

export interface TutoringMediaViewsTable {
  id: Generated<string>;
  activity_id: string;
  viewer_user_id: string;
  viewer_name: string;
  child_id: string | null;
  viewed_at: CreatedTimestamp;
}

// Hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255)
export interface TutoringQuestionMarksTable {
  thread_id: string;
  child_id: string;
  understood: boolean;
  marked_at: Generated<Date>;
}

export interface TutoringAiAnswersTable {
  post_id: string;
  thread_id: string;
  ai_request_id: string;
  teacher_user_id: string;
  created_at: CreatedTimestamp;
}

export interface TutoringAiConsentsTable {
  child_id: string;
  allowed: boolean;
  decided_by_user_id: string;
  decided_by_name: string;
  decided_at: Generated<Date>;
}

// Bài về nhà và phụ huynh (DT-28 phần 28f, YCTD-276)
export type HomeworkPolicyAction = 'warn' | 'block';
export type HomeworkReminderKind = 'assigned' | 'due_soon' | 'missing' | 'returned';

export interface HomeworkPoliciesTable {
  id: Generated<string>;
  school_level: 'TH' | 'THCS' | 'THPT';
  // 0 là quy tắc chung của cấp
  grade: Generated<number>;
  no_homework: Generated<boolean>;
  max_items_per_day: number | null;
  max_minutes_per_day: number | null;
  blocked_weekdays: Json;
  skip_holidays: Generated<boolean>;
  action: Generated<HomeworkPolicyAction>;
  basis: string | null;
  updated_by: string;
  updated_by_name: string;
  updated_at: UpdatedTimestamp;
}

export interface HomeworkAcknowledgementsTable {
  assignment_id: string;
  child_id: string;
  guardian_user_id: string;
  guardian_name: string;
  acknowledged_at: CreatedTimestamp;
}

export interface HomeworkRemindersTable {
  id: Generated<string>;
  kind: HomeworkReminderKind;
  assignment_id: string;
  child_id: string;
  created_at: CreatedTimestamp;
}

export interface SchoolYearDatabase {
  question_topics: QuestionTopicsTable;
  questions: QuestionsTable;
  question_usages: QuestionUsagesTable;
  exam_matrices: ExamMatricesTable;
  assessment_plans: AssessmentPlansTable;
  exams: ExamsTable;
  exam_questions: ExamQuestionsTable;
  exam_variants: ExamVariantsTable;
  exam_sessions: ExamSessionsTable;
  exam_sheets: ExamSheetsTable;
  online_exam_settings: OnlineExamSettingsTable;
  online_exam_school_settings: OnlineExamSchoolSettingsTable;
  exam_rooms: ExamRoomsTable;
  exam_room_students: ExamRoomStudentsTable;
  exam_assignments: ExamAssignmentsTable;
  exam_assignment_targets: ExamAssignmentTargetsTable;
  exam_attempts: ExamAttemptsTable;
  exam_attempt_events: ExamAttemptEventsTable;
  exam_proctor_consents: ExamProctorConsentsTable;
  exam_proctor_views: ExamProctorViewsTable;
  exam_proctor_signals: ExamProctorSignalsTable;
  exam_recording_chunks: ExamRecordingChunksTable;
  org_units: OrgUnitsTable;
  audit_logs: AuditLogsTable;
  settings: SettingsTable;
  departments: DepartmentsTable;
  job_titles: JobTitlesTable;
  catalog_items: CatalogItemsTable;
  approval_thresholds: ApprovalThresholdsTable;
  rooms: RoomsTable;
  grade_levels: GradeLevelsTable;
  curricula: CurriculaTable;
  subjects: SubjectsTable;
  curriculum_subjects: CurriculumSubjectsTable;
  child_elective_subjects: ChildElectiveSubjectsTable;
  graduation_configs: GraduationConfigsTable;
  graduation_sessions: GraduationSessionsTable;
  graduation_rooms: GraduationRoomsTable;
  graduation_candidates: GraduationCandidatesTable;
  graduation_scores: GraduationScoresTable;
  graduation_decisions: GraduationDecisionsTable;
  graduation_minutes: GraduationMinutesTable;
  graduation_submissions: GraduationSubmissionsTable;
  transfer_dossiers: TransferDossiersTable;
  score_configs: ScoreConfigsTable;
  score_entries: ScoreEntriesTable;
  subject_term_results: SubjectTermResultsTable;
  term_ratings: TermRatingsTable;
  score_locks: ScoreLocksTable;
  subject_combinations: SubjectCombinationsTable;
  subject_combination_subjects: SubjectCombinationSubjectsTable;
  child_subject_combinations: ChildSubjectCombinationsTable;
  subject_teams: SubjectTeamsTable;
  subject_team_subjects: SubjectTeamSubjectsTable;
  subject_team_members: SubjectTeamMembersTable;
  timetable_versions: TimetableVersionsTable;
  timetable_lessons: TimetableLessonsTable;
  class_logs: ClassLogsTable;
  period_attendance: PeriodAttendanceTable;
  class_log_reviews: ClassLogReviewsTable;
  timetable_generator_settings: TimetableGeneratorSettingsTable;
  timetable_subject_rules: TimetableSubjectRulesTable;
  timetable_teacher_busy: TimetableTeacherBusyTable;
  timetable_generation_runs: TimetableGenerationRunsTable;
  timetable_generation_variants: TimetableGenerationVariantsTable;
  timetable_changes: TimetableChangesTable;
  timetable_lookup_codes: TimetableLookupCodesTable;
  org_unit_levels: OrgUnitLevelsTable;
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
  emis_report_values: EmisReportValuesTable;
  emis_record_submissions: EmisRecordSubmissionsTable;
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
  task_assignments: TaskAssignmentsTable;
  task_files: TaskFilesTable;
  plan_items: PlanItemsTable;
  evaluation_criteria: EvaluationCriteriaTable;
  evaluations: EvaluationsTable;
  evaluation_scores: EvaluationScoresTable;
  staff_work_history: StaffWorkHistoryTable;
  staff_certificates: StaffCertificatesTable;
  training_courses: TrainingCoursesTable;
  training_registrations: TrainingRegistrationsTable;
  digital_competency_assessments: DigitalCompetencyAssessmentsTable;
  digital_competency_scores: DigitalCompetencyScoresTable;
  learning_resource_events: LearningResourceEventsTable;
  learning_resource_reports: LearningResourceReportsTable;
  learning_resource_usage: LearningResourceUsageTable;
  resource_collection_questions: ResourceCollectionQuestionsTable;
  rubrics: RubricsTable;
  resource_package_imports: ResourcePackageImportsTable;
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
  group_sets: GroupSetsTable;
  child_group_member_events: ChildGroupMemberEventsTable;
  professional_standards: ProfessionalStandardsTable;
  professional_criteria: ProfessionalCriteriaTable;
  professional_evaluations: ProfessionalEvaluationsTable;
  professional_evaluation_items: ProfessionalEvaluationItemsTable;
  equipment_items: EquipmentItemsTable;
  equipment_holdings: EquipmentHoldingsTable;
  school_profiles: SchoolProfilesTable;
  accreditation_reviews: AccreditationReviewsTable;
  school_split_requests: SchoolSplitRequestsTable;
  school_split_items: SchoolSplitItemsTable;
  student_learning_accounts: StudentLearningAccountsTable;
  student_transfers: StudentTransfersTable;
  facility_investments: FacilityInvestmentsTable;
  facility_standard_levels: FacilityStandardLevelsTable;
  facility_import_jobs: FacilityImportJobsTable;
  final_year_records: FinalYearRecordsTable;
  final_year_record_files: FinalYearRecordFilesTable;
  final_year_record_events: FinalYearRecordEventsTable;
  final_year_class_confirmations: FinalYearClassConfirmationsTable;
  admission_support_requests: AdmissionSupportRequestsTable;
  admission_application_files: AdmissionApplicationFilesTable;
  admission_transfer_results: AdmissionTransferResultsTable;
  entry_admission_contacts: EntryAdmissionContactsTable;
  entry_admission_notices: EntryAdmissionNoticesTable;
  entry_admission_notice_recipients: EntryAdmissionNoticeRecipientsTable;
  school_services: SchoolServicesTable;
  kpi_rule_sets: KpiRuleSetsTable;
  kpi_rule_set_versions: KpiRuleSetVersionsTable;
  kpi_profiles: KpiProfilesTable;
  kpi_periods: KpiPeriodsTable;
  kpi_period_rule_versions: KpiPeriodRuleVersionsTable;
  kpi_catalog_items: KpiCatalogItemsTable;
  kpi_tasks: KpiTasksTable;
  kpi_task_files: KpiTaskFilesTable;
  kpi_evaluations: KpiEvaluationsTable;
  kpi_evaluation_criteria: KpiEvaluationCriteriaTable;
  kpi_votes: KpiVotesTable;
  kpi_manager_actions: KpiManagerActionsTable;
  professional_folders: ProfessionalFoldersTable;
  professional_work_groups: ProfessionalWorkGroupsTable;
  professional_work_group_members: ProfessionalWorkGroupMembersTable;
  professional_rounds: ProfessionalRoundsTable;
  professional_documents: ProfessionalDocumentsTable;
  professional_document_versions: ProfessionalDocumentVersionsTable;
  professional_document_events: ProfessionalDocumentEventsTable;
  professional_record_settings: ProfessionalRecordSettingsTable;
  equipment_locations: EquipmentLocationsTable;
  equipment_stocktakes: EquipmentStocktakesTable;
  equipment_stocktake_lines: EquipmentStocktakeLinesTable;
  food_safety_files: FoodSafetyFilesTable;
  food_supplier_certificates: FoodSupplierCertificatesTable;
  food_lots: FoodLotsTable;
  food_inspections: FoodInspectionsTable;
  food_inspection_lines: FoodInspectionLinesTable;
  food_inspection_line_lots: FoodInspectionLineLotsTable;
  food_samples: FoodSamplesTable;
  education_plan_templates: EducationPlanTemplatesTable;
  education_plans: EducationPlansTable;
  education_plan_versions: EducationPlanVersionsTable;
  education_plan_events: EducationPlanEventsTable;
  emulation_titles: EmulationTitlesTable;
  emulation_campaigns: EmulationCampaignsTable;
  emulation_registrations: EmulationRegistrationsTable;
  emulation_meetings: EmulationMeetingsTable;
  emulation_decisions: EmulationDecisionsTable;
  emulation_nominations: EmulationNominationsTable;
  emulation_nomination_evidence: EmulationNominationEvidenceTable;
  emulation_council_members: EmulationCouncilMembersTable;
  emulation_votes: EmulationVotesTable;
  emulation_appeals: EmulationAppealsTable;
  emulation_awards: EmulationAwardsTable;
  quality_frameworks: QualityFrameworksTable;
  quality_standards: QualityStandardsTable;
  quality_criteria: QualityCriteriaTable;
  quality_indicators: QualityIndicatorsTable;
  quality_assessments: QualityAssessmentsTable;
  quality_council_members: QualityCouncilMembersTable;
  quality_work_groups: QualityWorkGroupsTable;
  quality_work_group_members: QualityWorkGroupMembersTable;
  quality_criterion_reports: QualityCriterionReportsTable;
  quality_evidences: QualityEvidencesTable;
  quality_evidence_criteria: QualityEvidenceCriteriaTable;
  boarding_meal_days: BoardingMealDaysTable;
  boarding_meal_cuts: BoardingMealCutsTable;
  conduct_settings: ConductSettingsTable;
  conduct_criteria: ConductCriteriaTable;
  conduct_entries: ConductEntriesTable;
  class_log_settings: ClassLogSettingsTable;
  seating_charts: SeatingChartsTable;
  seating_assignments: SeatingAssignmentsTable;
  red_star_members: RedStarMembersTable;
  assessment_levels: AssessmentLevelsTable;
  competency_items: CompetencyItemsTable;
  assessment_periods: AssessmentPeriodsTable;
  assessment_tests: AssessmentTestsTable;
  comment_templates: CommentTemplatesTable;
  subject_results: SubjectResultsTable;
  competency_results: CompetencyResultsTable;
  regular_comments: RegularCommentsTable;
  assessment_locks: AssessmentLocksTable;
  year_results: YearResultsTable;
  library_settings: LibrarySettingsTable;
  library_loan_rules: LibraryLoanRulesTable;
  library_categories: LibraryCategoriesTable;
  library_titles: LibraryTitlesTable;
  library_title_files: LibraryTitleFilesTable;
  library_copies: LibraryCopiesTable;
  library_readers: LibraryReadersTable;
  library_loans: LibraryLoansTable;
  library_reservations: LibraryReservationsTable;
  library_textbook_sets: LibraryTextbookSetsTable;
  library_textbook_set_titles: LibraryTextbookSetTitlesTable;
  library_stocktakes: LibraryStocktakesTable;
  library_stocktake_items: LibraryStocktakeItemsTable;
  library_indicators: LibraryIndicatorsTable;
  library_counters: LibraryCountersTable;
  student_award_titles: StudentAwardTitlesTable;
  student_awards: StudentAwardsTable;
  completion_results: CompletionResultsTable;
  learning_records: LearningRecordsTable;
  classroom_call_logs: ClassroomCallLogsTable;
  classroom_groupings: ClassroomGroupingsTable;
  classroom_score_events: ClassroomScoreEventsTable;
  classroom_game_sessions: ClassroomGameSessionsTable;
  classroom_game_answers: ClassroomGameAnswersTable;
  course_spaces: CourseSpacesTable;
  course_space_teachers: CourseSpaceTeachersTable;
  course_enrollments: CourseEnrollmentsTable;
  course_sections: CourseSectionsTable;
  course_activities: CourseActivitiesTable;
  activity_exceptions: ActivityExceptionsTable;
  activity_results: ActivityResultsTable;
  learning_events: LearningEventsTable;
  online_teaching_decisions: OnlineTeachingDecisionsTable;
  online_learning_rules: OnlineLearningRulesTable;
  online_learning_rule_acks: OnlineLearningRuleAcksTable;
  tutoring_rules: TutoringRulesTable;
  tutoring_programs: TutoringProgramsTable;
  tutoring_program_teachers: TutoringProgramTeachersTable;
  tutoring_program_classes: TutoringProgramClassesTable;
  tutoring_program_candidates: TutoringProgramCandidatesTable;
  tutoring_sessions: TutoringSessionsTable;
  tutoring_exemptions: TutoringExemptionsTable;
  tutoring_exemption_children: TutoringExemptionChildrenTable;
  tutoring_registrations: TutoringRegistrationsTable;
  tutoring_attendance: TutoringAttendanceTable;
  tutoring_charge_sessions: TutoringChargeSessionsTable;
  tutoring_credits: TutoringCreditsTable;
  tutoring_credit_applications: TutoringCreditApplicationsTable;
  tutoring_teacher_pay: TutoringTeacherPayTable;
  video_settings: VideoSettingsTable;
  video_rooms: VideoRoomsTable;
  video_room_admissions: VideoRoomAdmissionsTable;
  video_room_events: VideoRoomEventsTable;
  video_recording_consents: VideoRecordingConsentsTable;
  video_recordings: VideoRecordingsTable;
  video_recording_views: VideoRecordingViewsTable;
  tutoring_program_courses: TutoringProgramCoursesTable;
  tutoring_media_views: TutoringMediaViewsTable;
  tutoring_question_marks: TutoringQuestionMarksTable;
  tutoring_ai_answers: TutoringAiAnswersTable;
  tutoring_ai_consents: TutoringAiConsentsTable;
  tutoring_room_events: TutoringRoomEventsTable;
  assignments: AssignmentsTable;
  assignment_variants: AssignmentVariantsTable;
  assignment_items: AssignmentItemsTable;
  assignment_targets: AssignmentTargetsTable;
  assignment_recipients: AssignmentRecipientsTable;
  assignment_submissions: AssignmentSubmissionsTable;
  submission_files: SubmissionFilesTable;
  submission_comments: SubmissionCommentsTable;
  submission_contributions: SubmissionContributionsTable;
  assignment_comment_bank: AssignmentCommentBankTable;
  online_teaching_term_reports: OnlineTeachingTermReportsTable;
  activity_score_transfers: ActivityScoreTransfersTable;
  discussion_threads: DiscussionThreadsTable;
  discussion_posts: DiscussionPostsTable;
  discussion_reports: DiscussionReportsTable;
  group_tasks: GroupTasksTable;
  group_notes: GroupNotesTable;
  group_files: GroupFilesTable;
  discussion_space_settings: DiscussionSpaceSettingsTable;
  discussion_write_bans: DiscussionWriteBansTable;
  homework_policies: HomeworkPoliciesTable;
  homework_acknowledgements: HomeworkAcknowledgementsTable;
  homework_reminders: HomeworkRemindersTable;
}

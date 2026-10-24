// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182): nhãn dùng chung cho máy chủ, cổng quản trị, ứng dụng giáo viên
export type TrainingOrganizerKind = 'school' | 'external';
export type TrainingMode = 'in_person' | 'online' | 'self_study';
export type TrainingCourseStatus = 'open' | 'closed' | 'completed';
export type TrainingRegistrationStatus = 'pending' | 'team_approved' | 'approved' | 'rejected' | 'cancelled';
export type TrainingResult = 'passed' | 'failed';
export type StaffCertificateKind = 'manual' | 'course' | 'school';
export type CompetencyTerm = 'term_1' | 'term_2' | 'year';

export const TRAINING_ORGANIZER_LABELS: Record<TrainingOrganizerKind, string> = {
  school: 'Trường tổ chức',
  external: 'Cấp trên, đơn vị ngoài tổ chức',
};

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  in_person: 'Tập trung',
  online: 'Trực tuyến (hệ thống ngoài)',
  self_study: 'Tự học có kiểm tra',
};

export const TRAINING_COURSE_STATUS_LABELS: Record<TrainingCourseStatus, string> = {
  open: 'Đang mở đăng ký',
  closed: 'Đã đóng đăng ký',
  completed: 'Đã kết thúc',
};

export const TRAINING_REGISTRATION_STATUS_LABELS: Record<TrainingRegistrationStatus, string> = {
  pending: 'Chờ duyệt',
  team_approved: 'Tổ đã duyệt',
  approved: 'Đã duyệt',
  rejected: 'Không duyệt',
  cancelled: 'Đã huỷ',
};

export const TRAINING_RESULT_LABELS: Record<TrainingResult, string> = {
  passed: 'Đạt',
  failed: 'Không đạt',
};

export const STAFF_CERTIFICATE_KIND_LABELS: Record<StaffCertificateKind, string> = {
  manual: 'Nhập tay',
  course: 'Từ khoá bồi dưỡng',
  school: 'Chứng nhận do trường cấp',
};

export const COMPETENCY_TERM_LABELS: Record<CompetencyTerm, string> = {
  term_1: 'Học kỳ I',
  term_2: 'Học kỳ II',
  year: 'Cả năm',
};

export const TRAINING_PROGRAM_LABELS: Record<number, string> = {
  1: 'Chương trình 1',
  2: 'Chương trình 2',
  3: 'Chương trình 3',
};

// Chứng chỉ còn từ hôm nay đến số ngày này thì là sắp hết hạn
export const CERTIFICATE_EXPIRY_WARNING_DAYS = 60;

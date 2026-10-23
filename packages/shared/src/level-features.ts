import { DEFAULT_SCHOOL_LEVEL, isSchoolLevelCode, type SchoolLevelCode } from './school-levels.js';

// Chức năng của ứng dụng phụ huynh và ứng dụng giáo viên theo cấp học (DT-19 phần 19e, YCTD-155; tài liệu 32 mục 10.4).
// Chức năng ghi cấp chỉ hiện ở con, lớp thuộc cấp đó; chức năng không có trong bảng là của mọi cấp. Điểm danh và báo vắng
// theo ngày, nhật ký và chăm sóc hằng ngày, báo cơm, cân đo theo tháng tuổi, hồ sơ cuối cấp hiện là nghiệp vụ Mầm non
// nên chỉ hiện ở con, lớp Mầm non; điểm danh theo tiết, sổ điểm, sổ đầu bài của cấp khác thêm ở DT-20, DT-21 bằng cùng bảng.
// Đưa đón, dặn thuốc, thực đơn, học phí, tin nhắn, hoạt động dùng cho mọi cấp. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11
export type LevelFeature =
  | 'daily_attendance'
  | 'daily_journal'
  | 'daily_care'
  | 'meal_report'
  | 'growth'
  | 'final_year_record'
  | 'boarding_meal'
  | 'student_assessment';

export const LEVEL_FEATURES: Record<LevelFeature, readonly SchoolLevelCode[]> = {
  daily_attendance: ['MN'],
  daily_journal: ['MN'],
  daily_care: ['MN'],
  meal_report: ['MN'],
  growth: ['MN'],
  final_year_record: ['MN'],
  // Bán trú theo danh sách ăn, cắt suất (DT-20 phần 20b): lớp Tiểu học thay cho báo cơm theo điểm danh của Mầm non
  boarding_meal: ['TH'],
  // Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c): nhập ở ứng dụng giáo viên, phụ huynh xem kết quả đã khoá
  student_assessment: ['TH'],
};

// Cấp của con hoặc lớp như máy chủ trả; trống (con chưa xếp lớp, máy chủ cũ) là Mầm non như mọi chỗ đọc cấp khác
export function levelOf(value: unknown): SchoolLevelCode {
  return isSchoolLevelCode(value) ? value : DEFAULT_SCHOOL_LEVEL;
}

export function hasLevelFeature(level: unknown, feature: LevelFeature): boolean {
  return LEVEL_FEATURES[feature].includes(levelOf(level));
}

// Tin tức theo cấp (19e): danh sách cấp nhận trống là mọi cấp; có cấp thì phụ huynh chỉ thấy, chỉ nhận tin khi có con học ở
// một trong các cấp đó. Nhân sự xem mọi tin trong phạm vi đơn vị như cũ
export function matchesAudienceLevels(
  audienceLevels: readonly string[] | null | undefined,
  viewerLevels: readonly SchoolLevelCode[] | null,
): boolean {
  return (
    viewerLevels === null ||
    !audienceLevels ||
    audienceLevels.length === 0 ||
    audienceLevels.some((level) => viewerLevels.includes(level as SchoolLevelCode))
  );
}

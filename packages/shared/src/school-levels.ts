// Cấp học (DT-19 phần 19a, YCTD-151; tài liệu 32 mục 10.2): bốn mã cố định theo Luật Giáo dục, dùng chung cho bảng
// school_levels, phạm vi cấp của người dùng và các danh mục đã có cột cấp (thiết bị tối thiểu, KPI, kế hoạch giáo dục,
// website). Thêm cấp phải sửa mã ở đây, không thêm dữ liệu
export const SCHOOL_LEVEL_CODES = ['MN', 'TH', 'THCS', 'THPT'] as const;
export type SchoolLevelCode = (typeof SCHOOL_LEVEL_CODES)[number];

// Mọi chỗ đọc cấp học mà không thấy cấp thì coi là Mầm non (không đổi hành vi của trường mầm non hiện có)
export const DEFAULT_SCHOOL_LEVEL: SchoolLevelCode = 'MN';

export const SCHOOL_LEVELS = [
  { value: 'MN', label: 'Mầm non' },
  { value: 'TH', label: 'Tiểu học' },
  { value: 'THCS', label: 'Trung học cơ sở' },
  { value: 'THPT', label: 'Trung học phổ thông' },
] as const;

export function isSchoolLevelCode(value: unknown): value is SchoolLevelCode {
  return typeof value === 'string' && (SCHOOL_LEVEL_CODES as readonly string[]).includes(value);
}

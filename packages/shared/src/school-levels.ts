// Cấp học (DT-19 phần 19a, YCTD-151; tài liệu 47 mục 10.2): bốn mã cố định theo Luật Giáo dục, dùng chung cho bảng
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

// Một cấp học của trường như máy chủ trả về (GET /school-levels)
export interface SchoolLevelView {
  code: SchoolLevelCode;
  is_enabled: boolean;
  order_no: number;
  display_name: string;
  learner_term: string;
  context_label: string;
  updated_by_name: string | null;
  updated_at: string | null;
}

// Cấp người dùng được xem: phạm vi cấp trống là mọi cấp đang bật; có phạm vi thì chỉ những cấp vừa bật vừa thuộc phạm vi
export function visibleSchoolLevels(
  enabledLevels: readonly SchoolLevelCode[],
  userScope: readonly string[],
): SchoolLevelCode[] {
  return userScope.length === 0 ? [...enabledLevels] : enabledLevels.filter((level) => userScope.includes(level));
}

// Nhãn ô ngữ cảnh ở thanh đầu trang: trường một cấp giữ nhãn của cấp đó ("Cấp MN" như của Sở); trường nhiều cấp ghép
// các nhãn theo thứ tự cấp
export function schoolLevelContextLabel(levels: ReadonlyArray<{ context_label: string }>): string {
  return levels.length === 0 ? 'Cấp MN' : levels.map((level) => level.context_label).join(', ');
}

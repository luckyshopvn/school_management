import type { SchoolLevelCode } from './school-levels.js';

// Nhãn thuật ngữ theo cấp học (DT-19 phần 19c, YCTD-153; tài liệu 47 mục 10.4): Mầm non gọi "Trẻ", "Nhóm lớp"; cấp khác
// gọi "Học sinh", "Lớp". Trang dùng bảng này thay cho chữ ghi cứng; trường chỉ có Mầm non giữ nguyên chữ như trước. Tên
// bảng, cột (children, classes) không đổi (mục 10.2)
export interface SchoolLevelTerms {
  // Người học, viết hoa đầu câu: "Trẻ", "Học sinh"
  learner: string;
  // Hồ sơ người học: "Hồ sơ trẻ", "Hồ sơ học sinh"
  learnerProfile: string;
  // Đơn vị lớp: "Nhóm lớp", "Lớp"
  classGroup: string;
}

export const SCHOOL_LEVEL_TERMS: Record<SchoolLevelCode, SchoolLevelTerms> = {
  MN: { learner: 'Trẻ', learnerProfile: 'Hồ sơ trẻ', classGroup: 'Nhóm lớp' },
  TH: { learner: 'Học sinh', learnerProfile: 'Hồ sơ học sinh', classGroup: 'Lớp' },
  THCS: { learner: 'Học sinh', learnerProfile: 'Hồ sơ học sinh', classGroup: 'Lớp' },
  THPT: { learner: 'Học sinh', learnerProfile: 'Hồ sơ học sinh', classGroup: 'Lớp' },
};

// Thuật ngữ của các cấp đang làm việc. Một cấp: thuật ngữ của cấp đó, người học lấy "thuật ngữ gọi người học" trường đặt ở
// 1.4 (school_levels.learner_term) nếu có. Nhiều cấp (chọn "Tất cả" ở trường liên cấp): các cấp cùng thuật ngữ thì dùng
// chung; khác nhau thì dùng thuật ngữ của cấp phổ thông ("Học sinh", "Lớp"), do Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11. Không có cấp nào thì coi là Mầm non
export function schoolLevelTerms(
  levels: ReadonlyArray<{ code: SchoolLevelCode; learner_term?: string | null }>,
): SchoolLevelTerms {
  if (levels.length === 0) {
    return SCHOOL_LEVEL_TERMS.MN;
  }
  const [first] = levels;
  if (levels.length === 1 && first) {
    const base = SCHOOL_LEVEL_TERMS[first.code];
    const learner = first.learner_term?.trim();
    return learner ? { ...base, learner, learnerProfile: `Hồ sơ ${learner.toLocaleLowerCase('vi')}` } : base;
  }
  const terms = levels.map((level) => SCHOOL_LEVEL_TERMS[level.code]);
  return terms.every((term) => term === terms[0]) && terms[0] ? terms[0] : SCHOOL_LEVEL_TERMS.TH;
}

// Cấp đang làm việc (DT-19 phần 19c): trường nhiều cấp chọn một cấp hoặc "Tất cả" ở thanh đầu trang, lưu theo người dùng.
// Tham số dùng chung khi gọi API: ?school_level=<mã>; không gửi hoặc "all" là mọi cấp người dùng được xem
export const SCHOOL_LEVEL_PARAMETER = 'school_level';
export const ALL_SCHOOL_LEVELS = 'all';

// Cấp đang làm việc từ cấp người dùng được xem và cấp đã chọn: cấp đã chọn còn được xem thì chỉ cấp đó; còn lại (chưa chọn,
// chọn "Tất cả", cấp đã tắt hoặc ra ngoài phạm vi) là mọi cấp được xem. Trường một cấp luôn là cấp đó
export function workingSchoolLevels(
  visibleLevels: readonly SchoolLevelCode[],
  preferred: string | null | undefined,
): SchoolLevelCode[] {
  const chosen = visibleLevels.find((level) => level === preferred);
  return chosen ? [chosen] : [...visibleLevels];
}

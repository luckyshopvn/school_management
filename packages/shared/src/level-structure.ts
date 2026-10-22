import { SCHOOL_LEVEL_CODES, type SchoolLevelCode } from './school-levels.js';

// Cấu trúc theo cấp học (DT-19 phần 19b, YCTD-152): khối mẫu của từng cấp và cách lên lớp theo khối. Claude tự chọn theo
// ủy quyền của Eric ngày 2026-10-11: mã khối K1 đến K12 (không trùng mã khối Mầm non đang có), thứ tự 101 đến 112 để khối
// của cấp phổ thông xếp sau khối Mầm non; Mầm non không có khối mẫu (giữ mã nhà trường đã khai báo)
export interface GradeLevelTemplate {
  code: string;
  name: string;
  order_no: number;
}

function gradesFrom(first: number, last: number): GradeLevelTemplate[] {
  const grades: GradeLevelTemplate[] = [];
  for (let grade = first; grade <= last; grade += 1) {
    grades.push({ code: `K${grade}`, name: `Khối ${grade}`, order_no: 100 + grade });
  }
  return grades;
}

export const GRADE_LEVEL_TEMPLATES: Record<SchoolLevelCode, GradeLevelTemplate[]> = {
  MN: [],
  TH: gradesFrom(1, 5),
  THCS: gradesFrom(6, 9),
  THPT: gradesFrom(10, 12),
};

// Tháng tuổi của khối chỉ bắt buộc ở Mầm non; nhóm tuổi, học 2 buổi/ngày, ghép độ tuổi, lớp ghép chỉ có ở lớp Mầm non
export function usesAgeGroups(level: SchoolLevelCode): boolean {
  return level === 'MN';
}

export interface GradeProgressionItem {
  code: string;
  school_level: SchoolLevelCode;
  order_no: number;
  status: 'active' | 'inactive';
}

// Khối kế tiếp khi lên lớp: khối đang dùng kế tiếp trong cùng cấp; khối cuối cấp sang khối đầu của cấp kế nếu trường bật
// cấp đó, không thì hoàn thành cấp học (với Mầm non là ra trường như hiện có)
export type GradeProgression =
  | { kind: 'grade'; code: string; school_level: SchoolLevelCode }
  | { kind: 'completed'; school_level: SchoolLevelCode };

export function nextGradeLevel(
  grades: readonly GradeProgressionItem[],
  enabledLevels: readonly SchoolLevelCode[],
  currentCode: string,
): GradeProgression | null {
  const current = grades.find((grade) => grade.code === currentCode);
  if (!current) {
    return null;
  }
  const activeOf = (level: SchoolLevelCode) =>
    grades
      .filter((grade) => grade.school_level === level && grade.status === 'active')
      .sort((left, right) => left.order_no - right.order_no || left.code.localeCompare(right.code));
  const sameLevel = activeOf(current.school_level);
  const index = sameLevel.findIndex((grade) => grade.code === currentCode);
  const nextInLevel = index >= 0 ? sameLevel[index + 1] : sameLevel.find((grade) => grade.order_no > current.order_no);
  if (nextInLevel) {
    return { kind: 'grade', code: nextInLevel.code, school_level: nextInLevel.school_level };
  }
  const nextLevel = SCHOOL_LEVEL_CODES[SCHOOL_LEVEL_CODES.indexOf(current.school_level) + 1];
  const firstOfNext = nextLevel && enabledLevels.includes(nextLevel) ? activeOf(nextLevel)[0] : undefined;
  return firstOfNext && nextLevel
    ? { kind: 'grade', code: firstOfNext.code, school_level: nextLevel }
    : { kind: 'completed', school_level: current.school_level };
}

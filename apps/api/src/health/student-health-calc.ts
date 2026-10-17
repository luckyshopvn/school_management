import type { StudentHealthTerm } from '@school-management/database';
import { EYE_CONDITIONS, type EyeConditionValue } from '@school-management/shared';

// Thông tin sức khỏe học sinh theo học kỳ (DT-16 phần 16h; khảo sát mục 4.6, 5.3). Hàm thuần, không đọc cơ sở dữ liệu
export const STUDENT_HEALTH_RULE = 'YCTD-124';
export const TERMS: StudentHealthTerm[] = ['first_term', 'second_term'];
export const EYE_CONDITION_VALUES = EYE_CONDITIONS.map((item) => item.value) as EyeConditionValue[];

export interface TermRange {
  term_type: string;
  start_date: string;
  end_date: string;
}

// Học kỳ chứa ngày theo lịch năm học; ngày nằm giữa hai học kỳ hoặc sau học kỳ II tính vào học kỳ đã bắt đầu gần nhất.
// Năm học chưa khai báo học kỳ thì tháng 8 đến tháng 12 là học kỳ I, tháng 1 đến tháng 7 là học kỳ II (Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11)
export function termOfDate(date: string, terms: TermRange[]): StudentHealthTerm {
  const second = terms.find((term) => term.term_type === 'second_term');
  const first = terms.find((term) => term.term_type === 'first_term');
  if (second || first) {
    if (second && date >= second.start_date) {
      return 'second_term';
    }
    return 'first_term';
  }
  const month = Number(date.slice(5, 7));
  return month >= 8 ? 'first_term' : 'second_term';
}

export function termRangeOf(terms: TermRange[], term: StudentHealthTerm): TermRange | null {
  return terms.find((item) => item.term_type === term) ?? null;
}

export interface GrowthPoint {
  child_id: string;
  growth_round_id: string;
  round_name: string;
  measured_on: string;
  weight_kg: number | null;
  height_cm: number | null;
}

// "Lấy dữ liệu từ 4.3": số đo gần nhất của từng học sinh trong các đợt cân đo thuộc học kỳ (theo lịch năm học); số đo trống
// cả hai chỉ số thì bỏ qua
export function latestGrowthByChild(
  points: GrowthPoint[],
  terms: TermRange[],
  term: StudentHealthTerm,
): Map<string, GrowthPoint> {
  const latest = new Map<string, GrowthPoint>();
  for (const point of points) {
    if (point.weight_kg === null && point.height_cm === null) {
      continue;
    }
    if (termOfDate(point.measured_on, terms) !== term) {
      continue;
    }
    const current = latest.get(point.child_id);
    if (!current || point.measured_on > current.measured_on) {
      latest.set(point.child_id, point);
    }
  }
  return latest;
}

export interface TermHealthRow {
  gender: string | null;
  can_swim: boolean | null;
  eye_conditions: string[];
  physical_education: string | null;
}

export interface CountWithFemale {
  count: number;
  female: number;
}

const countOf = <T extends { gender: string | null }>(rows: T[]): CountWithFemale => ({
  count: rows.length,
  female: rows.filter((row) => row.gender === 'female').length,
});

// Biết bơi, bệnh về mắt theo từng loại, kết quả giáo dục thể chất của một học kỳ (mục 5.3). `swimming` gồm học sinh có ghi
// biết bơi trong học kỳ; `eye_any` là học sinh có ít nhất một bệnh về mắt
export function summarizeTermHealth(rows: TermHealthRow[]) {
  return {
    recorded: countOf(rows),
    swimming: countOf(rows.filter((row) => row.can_swim === true)),
    not_swimming: countOf(rows.filter((row) => row.can_swim === false)),
    eye_any: countOf(rows.filter((row) => row.eye_conditions.length > 0)),
    eye_conditions: EYE_CONDITIONS.map((condition) => ({
      value: condition.value,
      label: condition.label,
      ...countOf(rows.filter((row) => row.eye_conditions.includes(condition.value))),
    })),
    physical_education_passed: countOf(rows.filter((row) => row.physical_education === 'passed')),
    physical_education_not_passed: countOf(rows.filter((row) => row.physical_education === 'not_passed')),
  };
}

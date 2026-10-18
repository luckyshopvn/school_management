import type { ChildGender } from '@school-management/database';
import { isNormal, type GrowthAssessment } from './growth-calc.js';

// Tổng hợp cân nặng, chiều cao theo lớp, khối, đơn vị cho một đợt cân đo (mục 4.3.2 của hệ thống Sở; YCTD-102). Hàm thuần,
// không đọc cơ sở dữ liệu. Tỷ lệ tính trên số trẻ được cân đo có chỉ số tương ứng; "trong đó nữ" là số trẻ nữ của cùng kênh
export interface GrowthChildRow {
  child_id: string;
  full_name: string;
  dob: string;
  gender: ChildGender;
  org_unit_id: string;
  org_unit_name: string;
  class_id: string;
  class_name: string;
  grade_level: string;
  grade_name: string;
  grade_order: number;
  measured_on: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  assessment: GrowthAssessment | null;
  // Đã được khám sức khỏe định kỳ trong năm học (có kết quả của một đợt khám), cột "được khám định kỳ" của Sở (16h)
  examined?: boolean;
}

export const GROWTH_COUNT_KEYS = [
  'enrolled',
  'enrolled_female',
  'examined',
  'examined_female',
  'measured',
  'measured_female',
  'weight_normal',
  'underweight',
  'underweight_female',
  'above_age',
  'above_age_female',
  'height_normal',
  'stunted',
  'stunted_female',
  'weight_height_normal',
  'wasted',
  'wasted_female',
  'overweight',
  'overweight_female',
  'obese',
  'obese_female',
  'all_normal',
] as const;
export type GrowthCountKey = (typeof GROWTH_COUNT_KEYS)[number];
export type GrowthCounts = Record<GrowthCountKey, number> & {
  underweight_percent: number | null;
  above_age_percent: number | null;
  stunted_percent: number | null;
  wasted_percent: number | null;
  overweight_percent: number | null;
  obese_percent: number | null;
  measured_percent: number | null;
  examined_percent: number | null;
};

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : null);

export function countGrowth(rows: GrowthChildRow[]): GrowthCounts {
  const counts = Object.fromEntries(GROWTH_COUNT_KEYS.map((key) => [key, 0])) as Record<GrowthCountKey, number>;
  let weighed = 0;
  let heightMeasured = 0;
  let weightHeightMeasured = 0;
  const add = (key: GrowthCountKey, female: boolean) => {
    counts[key] += 1;
    const femaleKey = `${key}_female` as GrowthCountKey;
    if (female && femaleKey in counts) {
      counts[femaleKey] += 1;
    }
  };
  for (const row of rows) {
    const female = row.gender === 'female';
    add('enrolled', female);
    if (row.examined) {
      add('examined', female);
    }
    const assessment = row.assessment;
    if (!assessment || (row.weight_kg === null && row.height_cm === null)) {
      continue;
    }
    add('measured', female);
    if (assessment.weight_status) {
      weighed += 1;
      add(
        assessment.weight_status === 'underweight'
          ? 'underweight'
          : assessment.weight_status === 'above_age'
            ? 'above_age'
            : 'weight_normal',
        female,
      );
    }
    if (assessment.height_status) {
      heightMeasured += 1;
      add(assessment.height_status === 'stunted' ? 'stunted' : 'height_normal', female);
    }
    if (assessment.weight_height_status) {
      weightHeightMeasured += 1;
      add(
        assessment.weight_height_status === 'normal' ? 'weight_height_normal' : assessment.weight_height_status,
        female,
      );
    }
    if (isNormal(assessment)) {
      counts.all_normal += 1;
    }
  }
  return {
    ...counts,
    measured_percent: percent(counts.measured, counts.enrolled),
    examined_percent: percent(counts.examined, counts.enrolled),
    underweight_percent: percent(counts.underweight, weighed),
    above_age_percent: percent(counts.above_age, weighed),
    stunted_percent: percent(counts.stunted, heightMeasured),
    wasted_percent: percent(counts.wasted, weightHeightMeasured),
    overweight_percent: percent(counts.overweight, weightHeightMeasured),
    obese_percent: percent(counts.obese, weightHeightMeasured),
  };
}

export type GrowthChannel =
  'normal' | 'underweight' | 'above_age' | 'stunted' | 'wasted' | 'overweight' | 'obese' | 'not_measured';

// Trẻ thuộc kênh nào (để lọc danh sách theo kênh như màn hình 4.3.2)
export function inChannel(row: GrowthChildRow, channel: GrowthChannel): boolean {
  const assessment = row.assessment;
  const measured = assessment !== null && (row.weight_kg !== null || row.height_cm !== null);
  switch (channel) {
    case 'not_measured':
      return !measured;
    case 'normal':
      return measured && isNormal(assessment);
    case 'underweight':
    case 'above_age':
      return assessment?.weight_status === channel;
    case 'stunted':
      return assessment?.height_status === 'stunted';
    default:
      return assessment?.weight_height_status === channel;
  }
}

// Ô "Tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân" của 1.4 Cấu hình trường (DT-16 phần 16e): bật (mặc định)
// thì trẻ nhẹ cân vẫn xếp kênh cân nặng theo chiều cao như mọi trẻ; tắt thì trẻ nhẹ cân không xếp kênh này (không tính
// gầy còm, thừa cân, béo phì), chỉ tính ở kênh cân nặng theo tuổi và chiều cao theo tuổi
export function applyUnderweightOption(rows: GrowthChildRow[], includeWeightForHeight: boolean): GrowthChildRow[] {
  if (includeWeightForHeight) {
    return rows;
  }
  return rows.map((row) =>
    row.assessment?.weight_status === 'underweight'
      ? { ...row, assessment: { ...row.assessment, weight_height_status: null } }
      : row,
  );
}

export function summarizeGrowth(rows: GrowthChildRow[], gender: ChildGender | null) {
  const filtered = gender ? rows.filter((row) => row.gender === gender) : rows;
  const group = <K extends string>(keyOf: (row: GrowthChildRow) => K) => {
    const map = new Map<K, GrowthChildRow[]>();
    for (const row of filtered) {
      const key = keyOf(row);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  };
  const classes = [...group((row) => row.class_id).values()]
    .map((members) => {
      const first = members[0] as GrowthChildRow;
      return {
        class_id: first.class_id,
        class_name: first.class_name,
        grade_level: first.grade_level,
        grade_name: first.grade_name,
        org_unit_id: first.org_unit_id,
        org_unit_name: first.org_unit_name,
        grade_order: first.grade_order,
        ...countGrowth(members),
      };
    })
    .sort(
      (a, b) =>
        a.org_unit_name.localeCompare(b.org_unit_name, 'vi') ||
        a.grade_order - b.grade_order ||
        a.class_name.localeCompare(b.class_name, 'vi'),
    );
  const grades = [...group((row) => row.grade_level).values()]
    .map((members) => {
      const first = members[0] as GrowthChildRow;
      return {
        grade_level: first.grade_level,
        grade_name: first.grade_name,
        grade_order: first.grade_order,
        class_count: new Set(members.map((row) => row.class_id)).size,
        ...countGrowth(members),
      };
    })
    .sort((a, b) => a.grade_order - b.grade_order);
  const units = [...group((row) => row.org_unit_id).values()]
    .map((members) => {
      const first = members[0] as GrowthChildRow;
      return { org_unit_id: first.org_unit_id, org_unit_name: first.org_unit_name, ...countGrowth(members) };
    })
    .sort((a, b) => a.org_unit_name.localeCompare(b.org_unit_name, 'vi'));
  return { classes, grades, units, totals: countGrowth(filtered), children: filtered };
}

// Nhãn kênh tăng trưởng như màn hình 4.3.1, 4.3.2 của hệ thống Sở
export const GROWTH_STATUS_LABELS: Record<string, string> = {
  normal: 'Bình thường',
  underweight: 'Suy dinh dưỡng thể nhẹ cân',
  above_age: 'Cân nặng cao hơn tuổi',
  stunted: 'Suy dinh dưỡng thể thấp còi',
  wasted: 'Suy dinh dưỡng thể gầy còm',
  overweight: 'Thừa cân',
  obese: 'Béo phì',
  not_measured: 'Chưa cân đo',
};

// So sánh hai lần cân đo (DT-16 phần 16h; tổng hợp theo học kỳ của mục 4.3.2): số của lần đầu và lần sau theo lớp, theo
// khối và toàn bộ; chênh lệch là số của lần sau trừ lần đầu. Lớp chỉ có ở một lần thì lần kia để số 0
export const COMPARED_KEYS = [
  'enrolled',
  'measured',
  'underweight',
  'stunted',
  'wasted',
  'overweight',
  'obese',
  'all_normal',
] as const;
type ComparedKey = (typeof COMPARED_KEYS)[number];
type Compared = Record<ComparedKey, number>;

const pick = (counts: GrowthCounts): Compared =>
  Object.fromEntries(COMPARED_KEYS.map((key) => [key, counts[key]])) as Compared;
const difference = (first: Compared, last: Compared): Compared =>
  Object.fromEntries(COMPARED_KEYS.map((key) => [key, last[key] - first[key]])) as Compared;

export function compareGrowth(firstRows: GrowthChildRow[], lastRows: GrowthChildRow[], gender: ChildGender | null) {
  const first = summarizeGrowth(firstRows, gender);
  const last = summarizeGrowth(lastRows, gender);
  const empty = pick(countGrowth([]));
  const classIds = [...new Set([...first.classes, ...last.classes].map((row) => row.class_id))];
  const classes = classIds
    .map((classId) => {
      const before = first.classes.find((row) => row.class_id === classId);
      const after = last.classes.find((row) => row.class_id === classId);
      const info = (after ?? before) as (typeof first.classes)[number];
      const firstCounts = before ? pick(before) : empty;
      const lastCounts = after ? pick(after) : empty;
      return {
        class_id: classId,
        class_name: info.class_name,
        grade_name: info.grade_name,
        grade_order: info.grade_order,
        org_unit_name: info.org_unit_name,
        first: firstCounts,
        last: lastCounts,
        change: difference(firstCounts, lastCounts),
      };
    })
    .sort(
      (a, b) =>
        a.org_unit_name.localeCompare(b.org_unit_name, 'vi') ||
        a.grade_order - b.grade_order ||
        a.class_name.localeCompare(b.class_name, 'vi'),
    );
  const totals = { first: pick(first.totals), last: pick(last.totals) };
  return { classes, totals: { ...totals, change: difference(totals.first, totals.last) } };
}

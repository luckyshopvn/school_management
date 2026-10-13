import type { ChildGender } from '@school-management/database';
import {
  BMI_FOR_AGE,
  HEIGHT_FOR_AGE,
  WEIGHT_FOR_AGE,
  WEIGHT_FOR_HEIGHT,
  WEIGHT_FOR_LENGTH,
  type AgeTable,
  type HeightTable,
  type LmsRow,
} from './who-growth-tables.js';

// Tính chỉ số Z theo chuẩn tăng trưởng WHO và xếp kênh dinh dưỡng thường dùng ở trường mầm non (DT-14 phần 14a,
// YCTD-102; mục 4.3.1, 4.3.2 của hệ thống Sở). Tháng tuổi chính xác = số ngày tuổi / 30,4375; LMS nội suy tuyến tính giữa
// hai tháng (giữa hai mốc 0,1 cm với bảng theo chiều cao). Z = ((y/M)^L − 1) / (L·S); chỉ số theo cân nặng và BMI có |Z| > 3
// tính lại theo cách WHO giới hạn đuôi phân phối (khoảng cách giữa SD2 và SD3), chiều cao không cần (L = 1)
export const DAYS_PER_MONTH = 30.4375;
export const MAXIMUM_AGE_MONTHS = 84;

export type WeightStatus = 'underweight' | 'normal' | 'above_age';
export type HeightStatus = 'stunted' | 'normal';
export type WeightHeightStatus = 'wasted' | 'normal' | 'overweight' | 'obese';

export interface GrowthAssessment {
  age_days: number;
  age_months: number;
  bmi: number | null;
  weight_for_age_z: number | null;
  height_for_age_z: number | null;
  weight_for_height_z: number | null;
  bmi_for_age_z: number | null;
  // Cân nặng theo chiều cao dưới 61 tháng; từ 61 tháng WHO không có bảng này nên dùng BMI theo tuổi (WHO 2007)
  weight_height_basis: 'weight_for_height' | 'bmi_for_age' | null;
  weight_status: WeightStatus | null;
  height_status: HeightStatus | null;
  weight_height_status: WeightHeightStatus | null;
}

export function ageInDays(dob: string, onDate: string): number {
  return Math.round((Date.parse(`${onDate}T00:00:00Z`) - Date.parse(`${dob}T00:00:00Z`)) / 86_400_000);
}

const tableFor = (table: AgeTable | HeightTable, gender: ChildGender) =>
  gender === 'male' ? table.male : table.female;

function interpolate(rows: readonly LmsRow[], position: number): LmsRow | null {
  if (position < 0 || position > rows.length - 1) {
    return null;
  }
  const low = Math.floor(position);
  const a = rows[low];
  const b = rows[Math.min(low + 1, rows.length - 1)];
  if (!a || !b) {
    return null;
  }
  const fraction = position - low;
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction, a[2] + (b[2] - a[2]) * fraction];
}

export function lmsForAge(table: AgeTable, gender: ChildGender, ageMonths: number): LmsRow | null {
  return interpolate(tableFor(table, gender), ageMonths);
}

export function lmsForHeight(table: HeightTable, gender: ChildGender, heightCm: number): LmsRow | null {
  return interpolate(tableFor(table, gender), Math.round(((heightCm - table.start) / table.step) * 1000) / 1000);
}

// Giá trị ứng với một mức Z (dùng vẽ đường chuẩn trên biểu đồ)
export function valueAtZ([l, m, s]: LmsRow, z: number): number {
  return l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l);
}

export function zScore(lms: LmsRow, value: number, restricted: boolean): number {
  const [l, m, s] = lms;
  const z = l === 0 ? Math.log(value / m) / s : ((value / m) ** l - 1) / (l * s);
  if (!restricted || Math.abs(z) <= 3) {
    return z;
  }
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3);
    return 3 + (value - sd3) / (sd3 - valueAtZ(lms, 2));
  }
  const sd3 = valueAtZ(lms, -3);
  return -3 + (value - sd3) / (valueAtZ(lms, -2) - sd3);
}

const round2 = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);

export function assessGrowth(
  child: { gender: ChildGender; dob: string },
  onDate: string,
  values: { weight_kg: number | null; height_cm: number | null },
): GrowthAssessment {
  const ageDays = ageInDays(child.dob, onDate);
  const ageMonths = ageDays / DAYS_PER_MONTH;
  const { weight_kg: weight, height_cm: height } = values;
  const bmi = weight !== null && height !== null ? weight / (height / 100) ** 2 : null;
  const inRange = ageDays >= 0 && ageMonths <= MAXIMUM_AGE_MONTHS;
  const ageLms = (table: AgeTable) => (inRange ? lmsForAge(table, child.gender, ageMonths) : null);

  const wfaLms = weight !== null ? ageLms(WEIGHT_FOR_AGE) : null;
  const hfaLms = height !== null ? ageLms(HEIGHT_FOR_AGE) : null;
  const bmiLms = bmi !== null ? ageLms(BMI_FOR_AGE) : null;
  const weightForAge = wfaLms && weight !== null ? zScore(wfaLms, weight, true) : null;
  const heightForAge = hfaLms && height !== null ? zScore(hfaLms, height, false) : null;
  const bmiForAge = bmiLms && bmi !== null ? zScore(bmiLms, bmi, true) : null;
  // Dưới 24 tháng đo chiều dài nằm, từ 24 tháng đo chiều cao đứng (cách đo mặc định của WHO)
  let weightForHeight: number | null = null;
  if (inRange && weight !== null && height !== null && ageMonths < 61) {
    const lms =
      ageDays < 731
        ? lmsForHeight(WEIGHT_FOR_LENGTH, child.gender, height)
        : lmsForHeight(WEIGHT_FOR_HEIGHT, child.gender, height);
    weightForHeight = lms ? zScore(lms, weight, true) : null;
  }

  const wfa = round2(weightForAge);
  const hfa = round2(heightForAge);
  const wfh = round2(weightForHeight);
  const bfa = round2(bmiForAge);
  const useBmi = ageMonths >= 61;
  return {
    age_days: ageDays,
    age_months: Math.floor(ageMonths),
    bmi: bmi === null ? null : Math.round(bmi * 10) / 10,
    weight_for_age_z: wfa,
    height_for_age_z: hfa,
    weight_for_height_z: wfh,
    bmi_for_age_z: bfa,
    weight_height_basis: useBmi ? (bfa === null ? null : 'bmi_for_age') : wfh === null ? null : 'weight_for_height',
    weight_status: classifyWeight(wfa),
    height_status: classifyHeight(hfa),
    weight_height_status: useBmi ? classifyBmi(bfa) : classifyWeightForHeight(wfh),
  };
}

// Kênh cân nặng theo tuổi: dưới −2SD suy dinh dưỡng thể nhẹ cân, trên +2SD cân nặng cao hơn tuổi
export function classifyWeight(z: number | null): WeightStatus | null {
  return z === null ? null : z < -2 ? 'underweight' : z > 2 ? 'above_age' : 'normal';
}

// Kênh chiều cao theo tuổi: dưới −2SD suy dinh dưỡng thể thấp còi
export function classifyHeight(z: number | null): HeightStatus | null {
  return z === null ? null : z < -2 ? 'stunted' : 'normal';
}

// Cân nặng theo chiều cao (dưới 61 tháng): dưới −2SD gầy còm, trên +2SD thừa cân, trên +3SD béo phì
export function classifyWeightForHeight(z: number | null): WeightHeightStatus | null {
  return z === null ? null : z < -2 ? 'wasted' : z > 3 ? 'obese' : z > 2 ? 'overweight' : 'normal';
}

// BMI theo tuổi từ 61 tháng (ngưỡng WHO 2007): dưới −2SD gầy còm, trên +1SD thừa cân, trên +2SD béo phì
export function classifyBmi(z: number | null): WeightHeightStatus | null {
  return z === null ? null : z < -2 ? 'wasted' : z > 2 ? 'obese' : z > 1 ? 'overweight' : 'normal';
}

// Bình thường khi đã có đủ ba kênh và không kênh nào bất thường
export function isNormal(
  assessment: Pick<GrowthAssessment, 'weight_status' | 'height_status' | 'weight_height_status'>,
) {
  return (
    assessment.weight_status === 'normal' &&
    assessment.height_status === 'normal' &&
    assessment.weight_height_status === 'normal'
  );
}

// Đường chuẩn trên biểu đồ: trung vị, ±2SD, ±3SD theo tháng tuổi
export function referenceCurve(
  indicator: 'weight_for_age' | 'height_for_age',
  gender: ChildGender,
  fromMonth: number,
  toMonth: number,
) {
  const table = indicator === 'weight_for_age' ? WEIGHT_FOR_AGE : HEIGHT_FOR_AGE;
  const points: Array<{ month: number; minus3: number; minus2: number; median: number; plus2: number; plus3: number }> =
    [];
  for (let month = Math.max(0, fromMonth); month <= Math.min(MAXIMUM_AGE_MONTHS, toMonth); month += 1) {
    const lms = lmsForAge(table, gender, month);
    if (!lms) {
      continue;
    }
    const at = (z: number) => Math.round(valueAtZ(lms, z) * 100) / 100;
    points.push({ month, minus3: at(-3), minus2: at(-2), median: at(0), plus2: at(2), plus3: at(3) });
  }
  return points;
}

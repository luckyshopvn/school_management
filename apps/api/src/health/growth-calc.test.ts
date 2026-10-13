import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ageInDays,
  assessGrowth,
  classifyBmi,
  classifyHeight,
  classifyWeight,
  classifyWeightForHeight,
  lmsForAge,
  lmsForHeight,
  valueAtZ,
  zScore,
} from './growth-calc.js';
import { countGrowth, inChannel, summarizeGrowth, type GrowthChildRow } from './growth-summary.js';
import { parseMeasure } from './growth.js';
import { HEIGHT_FOR_AGE, WEIGHT_FOR_AGE, WEIGHT_FOR_HEIGHT } from './who-growth-tables.js';
import {
  CHILD_FIELD_RULES,
  STAFF_FIELD_RULES,
  breakdown,
  childAgeGroup,
  classAgeGroup,
  countMissing,
} from '../statistics/statistics-calc.js';

// Tính chỉ số Z theo chuẩn WHO, kênh tăng trưởng, tổng hợp và thống kê (DT-14 phần 14a, YCTD-102); kịch bản CT-14a-1,
// CT-14a-2, CT-14a-3
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
// Ngày sinh để tròn đúng m tháng tuổi WHO (m × 30,4375 ngày) vào ngày cân đo
const dobForMonths = (onDate: string, months: number) => addDays(onDate, -Math.round(months * 30.4375));
const near = (actual: number | null, expected: number, tolerance = 0.02) =>
  assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${actual} gần ${expected}`);

describe('Chỉ số Z và kênh tăng trưởng theo chuẩn WHO', () => {
  it('CT-14a-1: tham số LMS khớp bảng WHO công bố và Z tính ngược đúng', () => {
    assert.deepEqual(lmsForAge(WEIGHT_FOR_AGE, 'male', 0), [0.3487, 3.3464, 0.14602]);
    assert.deepEqual(lmsForAge(WEIGHT_FOR_AGE, 'male', 12), [0.0644, 9.6479, 0.10925]);
    // Chiều cao tháng 24 lấy theo chiều cao đứng (bảng 2–5 tuổi)
    assert.deepEqual(lmsForAge(HEIGHT_FOR_AGE, 'female', 24), [1, 85.7153, 0.03764]);
    assert.deepEqual(lmsForHeight(WEIGHT_FOR_HEIGHT, 'male', 100), [-0.3521, 15.3576, 0.08229]);
    // Trung vị cho Z = 0; giá trị tại −2,5SD và +2,5SD cho lại đúng Z
    const lms = lmsForAge(WEIGHT_FOR_AGE, 'female', 30) ?? [1, 1, 1];
    near(zScore(lms, lms[1], true), 0, 0.0001);
    near(zScore(lms, valueAtZ(lms, -2.5), true), -2.5, 0.0001);
    near(zScore(lms, valueAtZ(lms, 2.5), true), 2.5, 0.0001);
    // Ngoài ±3SD tính theo khoảng cách SD2–SD3 (WHO giới hạn đuôi phân phối)
    const sd3 = valueAtZ(lms, 3);
    const sd2 = valueAtZ(lms, 2);
    near(zScore(lms, sd3 + (sd3 - sd2), true), 4, 0.0001);
    // Nội suy giữa hai tháng
    const half = lmsForAge(WEIGHT_FOR_AGE, 'male', 0.5) ?? [0, 0, 0];
    near(half[1], (3.3464 + 4.4709) / 2, 0.0001);
    assert.equal(lmsForAge(WEIGHT_FOR_AGE, 'male', 85), null);
    assert.equal(ageInDays('2024-01-01', '2024-03-01'), 60);
  });

  it('CT-14a-2: xếp kênh theo ngưỡng −2SD, +2SD, +3SD; trẻ từ 61 tháng dùng BMI theo tuổi', () => {
    assert.equal(classifyWeight(-2.01), 'underweight');
    assert.equal(classifyWeight(-2), 'normal');
    assert.equal(classifyWeight(2.01), 'above_age');
    assert.equal(classifyHeight(-2.5), 'stunted');
    assert.equal(classifyHeight(1), 'normal');
    assert.equal(classifyWeightForHeight(-2.1), 'wasted');
    assert.equal(classifyWeightForHeight(2.5), 'overweight');
    assert.equal(classifyWeightForHeight(3.1), 'obese');
    assert.equal(classifyBmi(1.5), 'overweight');
    assert.equal(classifyBmi(2.1), 'obese');
    assert.equal(classifyWeight(null), null);

    const onDate = '2026-10-01';
    // Bé trai 36 tháng đúng trung vị cân nặng, chiều cao: bình thường cả ba kênh
    const dob36 = dobForMonths(onDate, 36);
    const weightMedian = lmsForAge(WEIGHT_FOR_AGE, 'male', 36)?.[1] ?? 0;
    const heightMedian = lmsForAge(HEIGHT_FOR_AGE, 'male', 36)?.[1] ?? 0;
    const normal = assessGrowth({ gender: 'male', dob: dob36 }, onDate, {
      weight_kg: Math.round(weightMedian * 100) / 100,
      height_cm: Math.round(heightMedian * 10) / 10,
    });
    assert.equal(normal.age_months, 36);
    near(normal.weight_for_age_z, 0, 0.05);
    near(normal.height_for_age_z, 0, 0.05);
    assert.equal(normal.weight_height_basis, 'weight_for_height');
    assert.deepEqual(
      [normal.weight_status, normal.height_status, normal.weight_height_status],
      ['normal', 'normal', 'normal'],
    );
    // Bé gái 24 tháng 9 kg, 78 cm: nhẹ cân, thấp còi
    const thin = assessGrowth({ gender: 'female', dob: dobForMonths(onDate, 24) }, onDate, {
      weight_kg: 9,
      height_cm: 78,
    });
    assert.equal(thin.weight_status, 'underweight');
    assert.equal(thin.height_status, 'stunted');
    // Bé trai 48 tháng 25 kg, 103 cm: cân nặng cao hơn tuổi, béo phì theo cân nặng theo chiều cao
    const heavy = assessGrowth({ gender: 'male', dob: dobForMonths(onDate, 48) }, onDate, {
      weight_kg: 25,
      height_cm: 103,
    });
    assert.equal(heavy.weight_status, 'above_age');
    assert.equal(heavy.weight_height_status, 'obese');
    near(heavy.bmi, 23.6, 0.05);
    // Bé gái 66 tháng: không có bảng cân nặng theo chiều cao, dùng BMI theo tuổi
    const older = assessGrowth({ gender: 'female', dob: dobForMonths(onDate, 66) }, onDate, {
      weight_kg: 18,
      height_cm: 110,
    });
    assert.equal(older.weight_for_height_z, null);
    assert.equal(older.weight_height_basis, 'bmi_for_age');
    assert.equal(older.weight_height_status, 'normal');
    // Chỉ có cân nặng: chỉ xếp kênh cân nặng
    const weightOnly = assessGrowth({ gender: 'male', dob: dob36 }, onDate, { weight_kg: 14, height_cm: null });
    assert.equal(weightOnly.height_status, null);
    assert.equal(weightOnly.weight_height_status, null);
    // Trên 84 tháng: ngoài bảng
    const tooOld = assessGrowth({ gender: 'male', dob: dobForMonths(onDate, 90) }, onDate, {
      weight_kg: 22,
      height_cm: 120,
    });
    assert.equal(tooOld.weight_for_age_z, null);
    // Số đo nhập: dấu phẩy thập phân, ngoài khoảng, trống
    assert.equal(parseMeasure('12,345', { minimum: 1, maximum: 150 }, 2), 12.35);
    assert.equal(parseMeasure('0', { minimum: 1, maximum: 150 }, 2), undefined);
    assert.equal(parseMeasure('abc', { minimum: 1, maximum: 150 }, 2), undefined);
    assert.equal(parseMeasure(' ', { minimum: 1, maximum: 150 }, 2), null);
  });

  it('CT-14a-3: tổng hợp theo lớp, khối, lọc giới tính và kênh; thống kê nhóm tuổi, hồ sơ thiếu', () => {
    const onDate = '2026-10-01';
    const row = (
      id: string,
      gender: 'male' | 'female',
      classId: string,
      grade: string,
      values: { weight_kg: number | null; height_cm: number | null } | null,
    ): GrowthChildRow => {
      const dob = dobForMonths(onDate, grade === 'MAM' ? 40 : 64);
      return {
        child_id: id,
        full_name: `Học sinh ${id}`,
        dob,
        gender,
        org_unit_id: 'u',
        org_unit_name: 'Điểm trường',
        class_id: classId,
        class_name: classId,
        grade_level: grade,
        grade_name: grade,
        grade_order: grade === 'MAM' ? 1 : 2,
        measured_on: values ? onDate : null,
        weight_kg: values?.weight_kg ?? null,
        height_cm: values?.height_cm ?? null,
        assessment: values ? assessGrowth({ gender, dob }, onDate, values) : null,
      };
    };
    const rows = [
      row('1', 'female', 'Mầm 1', 'MAM', { weight_kg: 10, height_cm: 88 }),
      row('2', 'male', 'Mầm 1', 'MAM', { weight_kg: 15.5, height_cm: 100 }),
      row('3', 'female', 'Mầm 2', 'MAM', null),
      row('4', 'male', 'Lá 1', 'LA', { weight_kg: 19, height_cm: 112 }),
    ];
    const counts = countGrowth(rows);
    assert.equal(counts.enrolled, 4);
    assert.equal(counts.enrolled_female, 2);
    assert.equal(counts.measured, 3);
    assert.equal(counts.measured_percent, 75);
    assert.equal(counts.underweight, 1);
    assert.equal(counts.underweight_female, 1);
    assert.equal(counts.stunted, 1);
    assert.equal(counts.all_normal, 2);
    const summary = summarizeGrowth(rows, null);
    assert.deepEqual(
      summary.classes.map((item) => [item.class_name, item.enrolled, item.measured]),
      [
        ['Mầm 1', 2, 2],
        ['Mầm 2', 1, 0],
        ['Lá 1', 1, 1],
      ],
    );
    assert.deepEqual(
      summary.grades.map((item) => [item.grade_level, item.class_count, item.enrolled]),
      [
        ['MAM', 2, 3],
        ['LA', 1, 1],
      ],
    );
    assert.equal(summarizeGrowth(rows, 'female').totals.enrolled, 2);
    assert.deepEqual(
      rows.filter((item) => inChannel(item, 'underweight')).map((item) => item.child_id),
      ['1'],
    );
    assert.deepEqual(
      rows.filter((item) => inChannel(item, 'not_measured')).map((item) => item.child_id),
      ['3'],
    );

    // Nhóm tuổi của trẻ và của lớp
    assert.deepEqual([2, 3, 12, 13, 24, 36, 37, 48, 60, 61, 72, 73].map(childAgeGroup), [
      'under_3_months',
      'months_3_12',
      'months_3_12',
      'months_13_24',
      'months_13_24',
      'months_25_36',
      'years_3_4',
      'years_3_4',
      'years_4_5',
      'years_5_6',
      'years_5_6',
      'over_6',
    ]);
    assert.deepEqual([3, 12, 24, 36, 48, 60].map(classAgeGroup), [
      'months_3_12',
      'months_13_24',
      'months_25_36',
      'years_3_4',
      'years_4_5',
      'years_5_6',
    ]);
    const ethnic = breakdown(
      [
        { gender: 'female', value: 'Kinh' },
        { gender: 'male', value: 'Kinh' },
        { gender: 'female', value: '' },
      ],
      (item) => item.value,
    );
    assert.deepEqual(ethnic, [
      { value: 'Kinh', count: 2, female: 1, percent: 66.67 },
      { value: 'Chưa nhập', count: 1, female: 1, percent: 33.33 },
    ]);

    // Hồ sơ thiếu: thông tin cha mẹ xét trên mọi người giám hộ, địa chỉ hiện nay đủ khi có một trong hai nguồn
    const child = {
      full_name: 'Học sinh A',
      dob: '2022-01-01',
      gender: 'female',
      address: null,
      national_id_last4: '1234',
      moet_profile: { ethnicity: 'Kinh', current_province: 'Thành phố Hồ Chí Minh' },
      guardians: [
        { full_name: 'Mẹ', phone: null, occupation: null, birth_year: 1990, id_number_last4: null },
        { full_name: 'Cha', phone: '0900000000', occupation: 'Kỹ sư', birth_year: null, id_number_last4: null },
      ],
    };
    const missing = Object.fromEntries(
      countMissing(CHILD_FIELD_RULES, [child]).map((item) => [item.key, item.missing_count]),
    );
    assert.equal(missing.ethnicity, 0);
    assert.equal(missing.religion, 1);
    assert.equal(missing.current_address, 0);
    assert.equal(missing.phone, 0);
    assert.equal(missing.guardian_occupation, 0);
    assert.equal(missing.guardian_birth_year, 0);
    assert.equal(missing.guardian_id_number, 1);
    const staffMissing = Object.fromEntries(
      countMissing(STAFF_FIELD_RULES, [
        {
          full_name: 'Nhân sự A',
          dob: null,
          gender: 'female',
          phone: '0900000001',
          email: null,
          address: 'Địa chỉ',
          id_number_last4: null,
          has_active_contract: true,
          moet_profile: null,
        },
      ]).map((item) => [item.key, item.missing_count]),
    );
    assert.equal(staffMissing.dob, 1);
    assert.equal(staffMissing.email, 1);
    assert.equal(staffMissing.phone, 0);
    assert.equal(staffMissing.permanent_address, 0);
    assert.equal(staffMissing.contract, 0);
    assert.equal(staffMissing.qualification, 1);
  });
});

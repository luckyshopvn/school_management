import type { SchoolLevelCode } from './school-levels.js';

// Sổ điểm THCS, THPT theo Thông tư 22/2021/TT-BGDĐT (DT-21 phần 21c, YCTD-170). Hệ số, số lần đánh giá thường xuyên, ngưỡng
// xếp loại là cấu hình theo cấp: nhà trường lưu ở "Cấu hình sổ điểm", máy chủ đọc cấu hình đã lưu, chưa lưu thì dùng bộ mặc
// định dưới đây (theo Điều 7, 8, 9 của Thông tư, cần đối chiếu văn bản gốc trước khi dùng). Điểm là số từ 0 đến 10, lấy đến
// một chữ số thập phân. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type ScoreTermType = 'first_term' | 'second_term';
export type ScoreRatingTerm = ScoreTermType | 'year';
export type ScoreKind = 'regular' | 'mid' | 'final';
export type ScoreSource = 'manual' | 'import' | 'exam';
// Mức xếp loại học tập, rèn luyện (Điều 9, 10)
export type RatingCode = 'good' | 'fair' | 'pass' | 'fail';
export type SubjectPassCode = 'pass' | 'fail';

export const SCORE_KIND_LABELS: Record<ScoreKind, string> = {
  regular: 'Đánh giá thường xuyên',
  mid: 'Giữa kỳ',
  final: 'Cuối kỳ',
};

export const SCORE_TERM_LABELS: Record<ScoreRatingTerm, string> = {
  first_term: 'Học kỳ I',
  second_term: 'Học kỳ II',
  year: 'Cả năm',
};

export const RATING_LABELS: Record<RatingCode, string> = {
  good: 'Tốt',
  fair: 'Khá',
  pass: 'Đạt',
  fail: 'Chưa đạt',
};

export const SUBJECT_PASS_LABELS: Record<SubjectPassCode, string> = {
  pass: 'Đạt',
  fail: 'Chưa đạt',
};

export interface LearningRule {
  code: Exclude<RatingCode, 'fail'>;
  // Số môn tính điểm tối thiểu có điểm trung bình từ `min_average`
  min_subjects: number;
  min_average: number;
  // Môn chủ chốt (Toán hoặc Ngữ văn) có ít nhất một môn từ ngưỡng này
  key_min_average: number;
  // Không môn tính điểm nào dưới ngưỡng này
  floor_average: number;
}

export interface ScoreConfig {
  weights: Record<ScoreKind, number>;
  // Số lần đánh giá thường xuyên tối thiểu theo số tiết cả năm của môn: dòng đầu có `max_periods` đủ lớn
  regular_counts: Array<{ max_periods: number | null; count: number }>;
  // Số tuần học dùng để đổi số tiết mỗi tuần thành số tiết cả năm
  weeks_per_year: number;
  // Môn chủ chốt theo mã môn (Toán, Ngữ văn)
  key_subject_codes: string[];
  // Thứ tự từ mức cao xuống thấp; không đạt dòng nào là chưa đạt
  learning_rules: LearningRule[];
  // Trọng số điểm trung bình môn cả năm của học kỳ I, II
  year_weights: { first_term: number; second_term: number };
}

export const SCORE_DEFAULTS: Partial<Record<SchoolLevelCode, ScoreConfig>> = {};
const SECONDARY_DEFAULT: ScoreConfig = {
  weights: { regular: 1, mid: 2, final: 3 },
  regular_counts: [
    { max_periods: 35, count: 2 },
    { max_periods: 70, count: 3 },
    { max_periods: null, count: 4 },
  ],
  weeks_per_year: 35,
  key_subject_codes: [],
  learning_rules: [
    { code: 'good', min_subjects: 6, min_average: 8, key_min_average: 8, floor_average: 6.5 },
    { code: 'fair', min_subjects: 6, min_average: 6.5, key_min_average: 6.5, floor_average: 5 },
    { code: 'pass', min_subjects: 6, min_average: 5, key_min_average: 5, floor_average: 3.5 },
  ],
  year_weights: { first_term: 1, second_term: 2 },
};
SCORE_DEFAULTS.THCS = { ...SECONDARY_DEFAULT, key_subject_codes: ['THCS-TOAN', 'THCS-NV'] };
SCORE_DEFAULTS.THPT = { ...SECONDARY_DEFAULT, key_subject_codes: ['THPT-TOAN', 'THPT-NV'] };

// Làm tròn đến một chữ số thập phân (nửa lên); cộng một lượng nhỏ để 6.05 không thành 6.0 vì sai số nhị phân
export function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function isValidScore(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 && roundScore(value) === value
  );
}

// Số lần đánh giá thường xuyên tối thiểu của môn theo số tiết mỗi tuần (Điều 7)
export function requiredRegularCount(periodsPerWeek: number, config: ScoreConfig): number {
  const yearly = periodsPerWeek * config.weeks_per_year;
  const rule =
    config.regular_counts.find((item) => item.max_periods !== null && yearly <= item.max_periods) ??
    config.regular_counts[config.regular_counts.length - 1];
  return rule?.count ?? 2;
}

export interface TermScores {
  regular: number[];
  mid: number | null;
  final: number | null;
}

// Điểm trung bình môn học kỳ: (tổng điểm thường xuyên + hệ số giữa kỳ × điểm giữa kỳ + hệ số cuối kỳ × điểm cuối kỳ) chia
// (số điểm thường xuyên × hệ số thường xuyên + hệ số giữa kỳ + hệ số cuối kỳ). Thiếu điểm giữa kỳ, cuối kỳ hoặc chưa có điểm
// thường xuyên nào thì chưa tính được (null)
export function termAverage(scores: TermScores, config: ScoreConfig): number | null {
  if (scores.mid === null || scores.final === null || scores.regular.length === 0) {
    return null;
  }
  const { regular, mid, final } = config.weights;
  const sum =
    scores.regular.reduce((total, value) => total + value * regular, 0) + scores.mid * mid + scores.final * final;
  const weight = scores.regular.length * regular + mid + final;
  return roundScore(sum / weight);
}

// Điểm trung bình môn cả năm từ điểm trung bình hai học kỳ; thiếu một học kỳ là chưa tính được
export function yearAverage(first: number | null, second: number | null, config: ScoreConfig): number | null {
  if (first === null || second === null) {
    return null;
  }
  const { first_term, second_term } = config.year_weights;
  return roundScore((first * first_term + second * second_term) / (first_term + second_term));
}

export interface RatingSubject {
  code: string;
  // `score`: môn tính điểm; `comment`: môn đánh giá bằng nhận xét
  mode: 'score' | 'comment';
  average: number | null;
  passed: SubjectPassCode | null;
}

// Gợi ý xếp loại học tập (Điều 9): cần đủ điểm trung bình mọi môn tính điểm và kết quả mọi môn nhận xét, không thì null.
// Mức cao nhất mà đủ điều kiện được gợi ý; môn nhận xét có "Chưa đạt" thì tối đa là Chưa đạt
export function suggestLearningRating(subjects: RatingSubject[], config: ScoreConfig): RatingCode | null {
  const scored = subjects.filter((subject) => subject.mode === 'score');
  const commented = subjects.filter((subject) => subject.mode === 'comment');
  if (
    scored.length === 0 ||
    scored.some((subject) => subject.average === null) ||
    commented.some((subject) => subject.passed === null)
  ) {
    return null;
  }
  if (commented.some((subject) => subject.passed === 'fail')) {
    return 'fail';
  }
  const averages = scored.map((subject) => subject.average as number);
  const keyAverages = scored
    .filter((subject) => config.key_subject_codes.includes(subject.code))
    .map((subject) => subject.average as number);
  for (const rule of config.learning_rules) {
    const enough = averages.filter((value) => value >= rule.min_average).length >= rule.min_subjects;
    const keyOk = keyAverages.length === 0 ? true : keyAverages.some((value) => value >= rule.key_min_average);
    const noLow = averages.every((value) => value >= rule.floor_average);
    if (enough && keyOk && noLow) {
      return rule.code;
    }
  }
  return 'fail';
}

export function isRatingCode(value: unknown): value is RatingCode {
  return value === 'good' || value === 'fair' || value === 'pass' || value === 'fail';
}

// Kiểm tra cấu hình do người dùng gửi lên; trả danh sách lỗi theo trường
export function validateScoreConfig(config: unknown): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const value = config as Partial<ScoreConfig> | null;
  if (!value || typeof value !== 'object') {
    return [{ field: 'config', message: 'Cấu hình không hợp lệ' }];
  }
  for (const kind of ['regular', 'mid', 'final'] as const) {
    const weight = value.weights?.[kind];
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 9) {
      errors.push({ field: `weights.${kind}`, message: 'Hệ số là số nguyên từ 1 đến 9' });
    }
  }
  if (
    typeof value.weeks_per_year !== 'number' ||
    !Number.isInteger(value.weeks_per_year) ||
    value.weeks_per_year < 30 ||
    value.weeks_per_year > 40
  ) {
    errors.push({ field: 'weeks_per_year', message: 'Số tuần học là số nguyên từ 30 đến 40' });
  }
  if (
    !Array.isArray(value.regular_counts) ||
    value.regular_counts.length === 0 ||
    value.regular_counts.some(
      (item) =>
        !Number.isInteger(item?.count) ||
        item.count < 1 ||
        item.count > 10 ||
        (item.max_periods !== null && (!Number.isInteger(item.max_periods) || item.max_periods < 1)),
    ) ||
    value.regular_counts[value.regular_counts.length - 1]?.max_periods !== null
  ) {
    errors.push({
      field: 'regular_counts',
      message: 'Số lần đánh giá thường xuyên theo số tiết, dòng cuối không giới hạn số tiết',
    });
  }
  if (!Array.isArray(value.key_subject_codes) || value.key_subject_codes.some((code) => typeof code !== 'string')) {
    errors.push({ field: 'key_subject_codes', message: 'Danh sách mã môn chủ chốt' });
  }
  const rules = value.learning_rules;
  if (
    !Array.isArray(rules) ||
    rules.length !== 3 ||
    rules.some(
      (rule, index) =>
        rule?.code !== (['good', 'fair', 'pass'] as const)[index] ||
        !Number.isInteger(rule.min_subjects) ||
        rule.min_subjects < 1 ||
        [rule.min_average, rule.key_min_average, rule.floor_average].some(
          (number) => typeof number !== 'number' || number < 0 || number > 10,
        ),
    )
  ) {
    errors.push({ field: 'learning_rules', message: 'Ba mức Tốt, Khá, Đạt theo thứ tự, ngưỡng từ 0 đến 10' });
  }
  const yearWeights = value.year_weights;
  if (
    !yearWeights ||
    ![yearWeights.first_term, yearWeights.second_term].every(
      (weight) => Number.isInteger(weight) && weight >= 1 && weight <= 9,
    )
  ) {
    errors.push({ field: 'year_weights', message: 'Hệ số hai học kỳ là số nguyên từ 1 đến 9' });
  }
  return errors;
}

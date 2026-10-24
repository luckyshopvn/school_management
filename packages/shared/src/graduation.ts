import type { SchoolLevelCode } from './school-levels.js';

// Xét tốt nghiệp THCS, THPT và hồ sơ thi (DT-21 phần 21f, YCTD-174). Quy tắc là cấu hình theo cấp: nhà trường lưu ở "Cấu hình
// xét tốt nghiệp", máy chủ đọc cấu hình đã lưu, chưa lưu thì dùng bộ mặc định dưới đây (theo quy chế thi tốt nghiệp THPT hiện
// hành, cần đối chiếu văn bản gốc và đổi theo năm khi quy chế đổi). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type GraduationLevel = Extract<SchoolLevelCode, 'THCS' | 'THPT'>;
export type GraduationOutcome = 'graduated' | 'not_graduated';
export type GraduationDecisionStatus = 'proposed' | 'confirmed';
export type GraduationMinutesKind = 'council' | 'exam_room' | 'scoring';
export type GraduationSubmissionKind = 'candidates' | 'results';

export const GRADUATION_OUTCOME_LABELS: Record<GraduationOutcome, string> = {
  graduated: 'Được công nhận tốt nghiệp',
  not_graduated: 'Chưa được công nhận tốt nghiệp',
};

export const GRADUATION_MINUTES_LABELS: Record<GraduationMinutesKind, string> = {
  council: 'Biên bản họp hội đồng xét tốt nghiệp',
  exam_room: 'Biên bản phòng thi',
  scoring: 'Biên bản chấm thi, nhập điểm',
};

export const GRADUATION_SUBMISSION_LABELS: Record<GraduationSubmissionKind, string> = {
  candidates: 'Danh sách thí sinh, hồ sơ dự thi',
  results: 'Kết quả thi, xét công nhận tốt nghiệp',
};

export interface GraduationConfig {
  // Bài thi bắt buộc và bài thi tự chọn của kỳ thi tốt nghiệp THPT, theo mã môn của danh mục môn học
  required_subjects: string[];
  elective_count: number;
  elective_pool: string[];
  // Điểm xét tốt nghiệp = ((trung bình các bài thi + điểm khuyến khích) × hệ số bài thi + điểm trung bình các năm × hệ số
  // học bạ) chia tổng hệ số, cộng điểm ưu tiên; trung bình các năm lớp 10, 11, 12 theo hệ số `grade_weights`
  weights: { exam: number; school: number };
  grade_weights: { g10: number; g11: number; g12: number };
  // Đạt khi điểm xét từ `pass_score` và không bài thi nào từ `floor_score` trở xuống (điểm liệt)
  pass_score: number;
  floor_score: number;
  // Điểm khuyến khích, ưu tiên tối đa
  max_incentive: number;
  max_priority: number;
  // Tiền tố số báo danh, số giấy chứng nhận
  exam_number_prefix: string;
  certificate_prefix: string;
}

export const GRADUATION_DEFAULTS: Record<GraduationLevel, GraduationConfig> = {
  THCS: {
    required_subjects: [],
    elective_count: 0,
    elective_pool: [],
    weights: { exam: 0, school: 1 },
    grade_weights: { g10: 1, g11: 1, g12: 1 },
    pass_score: 0,
    floor_score: 0,
    max_incentive: 0,
    max_priority: 0,
    exam_number_prefix: 'HS',
    certificate_prefix: 'TN-THCS',
  },
  THPT: {
    required_subjects: ['THPT-TOAN', 'THPT-NV'],
    elective_count: 2,
    elective_pool: [
      'THPT-NN1',
      'THPT-LS',
      'THPT-DL',
      'THPT-GDKTPL',
      'THPT-VL',
      'THPT-HH',
      'THPT-SH',
      'THPT-CN',
      'THPT-TIN',
    ],
    weights: { exam: 7, school: 3 },
    grade_weights: { g10: 1, g11: 2, g12: 3 },
    pass_score: 5,
    floor_score: 1,
    max_incentive: 4,
    max_priority: 2,
    exam_number_prefix: 'TN',
    certificate_prefix: 'TN-THPT',
  },
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function isGraduationLevel(value: unknown): value is GraduationLevel {
  return value === 'THCS' || value === 'THPT';
}

// Khối cuối cấp của cấp (mã khối mẫu của 19b)
export const GRADUATION_LAST_GRADE: Record<GraduationLevel, string> = { THCS: 'K9', THPT: 'K12' };

// Điểm trung bình các năm lớp 10, 11, 12 theo hệ số; thiếu năm nào thì chưa tính được (null)
export function schoolAverage(
  grades: { g10: number | null; g11: number | null; g12: number | null },
  weights: GraduationConfig['grade_weights'],
): number | null {
  if (grades.g10 === null || grades.g11 === null || grades.g12 === null) {
    return null;
  }
  const total = weights.g10 + weights.g11 + weights.g12;
  return round2((grades.g10 * weights.g10 + grades.g11 * weights.g11 + grades.g12 * weights.g12) / total);
}

export interface GraduationScoreInput {
  // Điểm các bài thi (đủ mọi bài thi của thí sinh, không kể bài được miễn)
  examScores: number[];
  incentive: number;
  priority: number;
  schoolAverage: number | null;
}

export interface GraduationScoreResult {
  exam_average: number | null;
  score: number | null;
  passed: boolean;
  reason: string | null;
}

// Điểm xét tốt nghiệp THPT và kết quả: thiếu điểm học bạ hoặc bài thi thì chưa xét được; có bài thi điểm liệt thì không đạt
export function graduationScore(input: GraduationScoreInput, config: GraduationConfig): GraduationScoreResult {
  if (input.examScores.length === 0) {
    return { exam_average: null, score: null, passed: false, reason: 'Chưa có điểm bài thi' };
  }
  if (input.schoolAverage === null) {
    return { exam_average: null, score: null, passed: false, reason: 'Chưa có điểm trung bình các năm học' };
  }
  const average = round2(input.examScores.reduce((sum, value) => sum + value, 0) / input.examScores.length);
  const { exam, school } = config.weights;
  const base = ((average + input.incentive) * exam + input.schoolAverage * school) / (exam + school);
  const score = Math.min(10, round2(base + input.priority));
  if (input.examScores.some((value) => value <= config.floor_score)) {
    return { exam_average: average, score, passed: false, reason: 'Có bài thi bị điểm liệt' };
  }
  return score >= config.pass_score
    ? { exam_average: average, score, passed: true, reason: null }
    : { exam_average: average, score, passed: false, reason: 'Điểm xét tốt nghiệp chưa đạt' };
}

// Điều kiện dự thi, xét tốt nghiệp: học tập và rèn luyện cả năm của năm cuối cấp từ Đạt trở lên (kết quả của 21c)
export function graduationEligibility(
  learning: string | null,
  conduct: string | null,
): { eligible: boolean; note: string | null } {
  if (!learning || !conduct) {
    return { eligible: false, note: 'Chưa có xếp loại học tập, rèn luyện cả năm' };
  }
  if (learning === 'fail' || conduct === 'fail') {
    return { eligible: false, note: 'Học tập hoặc rèn luyện cả năm Chưa đạt' };
  }
  return { eligible: true, note: null };
}

// Số báo danh theo tiền tố và số thứ tự, 4 chữ số
export function examNumber(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// Chia thí sinh vào phòng thi theo sức chứa, theo thứ tự; trả danh sách chỉ số phòng của từng thí sinh hoặc null nếu thiếu chỗ
export function assignRoomIndexes(candidateCount: number, capacities: number[]): number[] | null {
  const result: number[] = [];
  let room = 0;
  let used = 0;
  for (let index = 0; index < candidateCount; index += 1) {
    while (room < capacities.length && used >= (capacities[room] ?? 0)) {
      room += 1;
      used = 0;
    }
    if (room >= capacities.length) {
      return null;
    }
    result.push(room);
    used += 1;
  }
  return result;
}

// Kiểm tra cấu hình do người dùng gửi lên
export function validateGraduationConfig(
  config: unknown,
  level: GraduationLevel,
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const value = config as Partial<GraduationConfig> | null;
  if (!value || typeof value !== 'object') {
    return [{ field: 'config', message: 'Cấu hình không hợp lệ' }];
  }
  const texts = (field: 'required_subjects' | 'elective_pool') => {
    const list = value[field];
    if (
      !Array.isArray(list) ||
      list.some((code) => typeof code !== 'string' || code.length === 0 || code.length > 30)
    ) {
      errors.push({ field, message: 'Danh sách mã môn' });
    }
  };
  texts('required_subjects');
  texts('elective_pool');
  if (!Number.isInteger(value.elective_count) || (value.elective_count ?? -1) < 0 || (value.elective_count ?? 0) > 6) {
    errors.push({ field: 'elective_count', message: 'Số bài thi tự chọn từ 0 đến 6' });
  }
  if (
    level === 'THPT' &&
    Array.isArray(value.elective_pool) &&
    Number.isInteger(value.elective_count) &&
    value.elective_pool.length < (value.elective_count ?? 0)
  ) {
    errors.push({ field: 'elective_pool', message: 'Danh sách môn tự chọn ít hơn số bài thi tự chọn' });
  }
  const weights = value.weights;
  if (
    !weights ||
    [weights.exam, weights.school].some((item) => !Number.isInteger(item) || item < 0 || item > 20) ||
    (weights.exam ?? 0) + (weights.school ?? 0) === 0
  ) {
    errors.push({ field: 'weights', message: 'Hệ số bài thi, học bạ là số nguyên từ 0 đến 20, tổng khác 0' });
  }
  const gradeWeights = value.grade_weights;
  if (
    !gradeWeights ||
    [gradeWeights.g10, gradeWeights.g11, gradeWeights.g12].some(
      (item) => !Number.isInteger(item) || item < 1 || item > 9,
    )
  ) {
    errors.push({ field: 'grade_weights', message: 'Hệ số các năm lớp 10, 11, 12 là số nguyên từ 1 đến 9' });
  }
  for (const field of ['pass_score', 'floor_score', 'max_incentive', 'max_priority'] as const) {
    const number = value[field];
    if (typeof number !== 'number' || number < 0 || number > 10) {
      errors.push({ field, message: 'Số từ 0 đến 10' });
    }
  }
  for (const field of ['exam_number_prefix', 'certificate_prefix'] as const) {
    const text = value[field];
    if (typeof text !== 'string' || text.length === 0 || text.length > 20) {
      errors.push({ field, message: 'Tiền tố từ 1 đến 20 ký tự' });
    }
  }
  return errors;
}

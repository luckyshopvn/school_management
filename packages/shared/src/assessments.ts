import type { SchoolLevelCode } from './school-levels.js';

// Đánh giá học sinh theo Thông tư 27/2020/TT-BGDĐT (DT-20 phần 20c, YCTD-161). Bộ mặc định chỉ là điểm bắt đầu: nhà trường
// nạp rồi sửa ở "Đánh giá học sinh", máy chủ đọc cấu hình đã lưu, không đọc bảng này. Mức đạt có hạng: hạng 1 là mức cao
// nhất, hạng lớn nhất là mức chưa đạt. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type AssessmentScale = 'subject' | 'competency';
export type CompetencyGroup = 'quality' | 'general' | 'specific';
export type YearResultCode = 'excellent' | 'good' | 'completed' | 'not_completed';

export const COMPETENCY_GROUP_LABELS: Record<CompetencyGroup, string> = {
  quality: 'Phẩm chất chủ yếu',
  general: 'Năng lực chung',
  specific: 'Năng lực đặc thù',
};

// Điều 9 khoản 2 của Thông tư: hoàn thành chương trình lớp học
export const YEAR_RESULT_LABELS: Record<YearResultCode, string> = {
  excellent: 'Hoàn thành xuất sắc',
  good: 'Hoàn thành tốt',
  completed: 'Hoàn thành',
  not_completed: 'Chưa hoàn thành',
};

export interface AssessmentDefaults {
  levels: Array<{ scale: AssessmentScale; code: string; name: string; rank: number }>;
  items: Array<{ group_code: CompetencyGroup; code: string; name: string }>;
  periods: Array<{
    code: string;
    name: string;
    term_type: 'first_term' | 'second_term';
    kind: 'mid' | 'end';
    is_year_end: boolean;
  }>;
  // Bài kiểm tra định kỳ: kỳ cuối học kỳ I, cuối năm cho mọi môn có điểm; kỳ giữa học kỳ cho các môn, khối ghi ở đây
  mid_term_tests: Array<{ subject_code: string; grade_level_codes: string[] }>;
  // Ngưỡng điểm bài kiểm tra cuối năm của hoàn thành xuất sắc, hoàn thành tốt, hoàn thành (Điều 9)
  score_thresholds: { excellent: number; good: number; completed: number };
  comments: Array<{ target: 'subject' | 'competency' | 'general'; content: string }>;
}

export const ASSESSMENT_DEFAULTS: Partial<Record<SchoolLevelCode, AssessmentDefaults>> = {
  TH: {
    levels: [
      { scale: 'subject', code: 'T', name: 'Hoàn thành tốt', rank: 1 },
      { scale: 'subject', code: 'H', name: 'Hoàn thành', rank: 2 },
      { scale: 'subject', code: 'C', name: 'Chưa hoàn thành', rank: 3 },
      { scale: 'competency', code: 'T', name: 'Tốt', rank: 1 },
      { scale: 'competency', code: 'Đ', name: 'Đạt', rank: 2 },
      { scale: 'competency', code: 'C', name: 'Cần cố gắng', rank: 3 },
    ],
    items: [
      { group_code: 'quality', code: 'PC-YN', name: 'Yêu nước' },
      { group_code: 'quality', code: 'PC-NA', name: 'Nhân ái' },
      { group_code: 'quality', code: 'PC-CC', name: 'Chăm chỉ' },
      { group_code: 'quality', code: 'PC-TT', name: 'Trung thực' },
      { group_code: 'quality', code: 'PC-TN', name: 'Trách nhiệm' },
      { group_code: 'general', code: 'NLC-TCTH', name: 'Tự chủ và tự học' },
      { group_code: 'general', code: 'NLC-GTHT', name: 'Giao tiếp và hợp tác' },
      { group_code: 'general', code: 'NLC-GQVD', name: 'Giải quyết vấn đề và sáng tạo' },
      { group_code: 'specific', code: 'NLDT-NN', name: 'Ngôn ngữ' },
      { group_code: 'specific', code: 'NLDT-TT', name: 'Tính toán' },
      { group_code: 'specific', code: 'NLDT-KH', name: 'Khoa học' },
      { group_code: 'specific', code: 'NLDT-CN', name: 'Công nghệ' },
      { group_code: 'specific', code: 'NLDT-TH', name: 'Tin học' },
      { group_code: 'specific', code: 'NLDT-TM', name: 'Thẩm mĩ' },
      { group_code: 'specific', code: 'NLDT-TC', name: 'Thể chất' },
    ],
    periods: [
      { code: 'GK1', name: 'Giữa học kỳ I', term_type: 'first_term', kind: 'mid', is_year_end: false },
      { code: 'CK1', name: 'Cuối học kỳ I', term_type: 'first_term', kind: 'end', is_year_end: false },
      { code: 'GK2', name: 'Giữa học kỳ II', term_type: 'second_term', kind: 'mid', is_year_end: false },
      { code: 'CN', name: 'Cuối năm học', term_type: 'second_term', kind: 'end', is_year_end: true },
    ],
    mid_term_tests: [
      { subject_code: 'TH-TV', grade_level_codes: ['K4', 'K5'] },
      { subject_code: 'TH-TOAN', grade_level_codes: ['K4', 'K5'] },
    ],
    score_thresholds: { excellent: 9, good: 7, completed: 5 },
    comments: [
      { target: 'subject', content: 'Nắm vững kiến thức, kĩ năng của môn học; vận dụng tốt vào bài tập.' },
      { target: 'subject', content: 'Hoàn thành các nội dung học tập; cần luyện thêm kĩ năng trình bày.' },
      { target: 'subject', content: 'Còn chậm ở một số nội dung; cần được giúp đỡ thêm.' },
      { target: 'competency', content: 'Chăm chỉ, tự giác; biết hợp tác với bạn trong nhóm.' },
      { target: 'competency', content: 'Lễ phép, trung thực; cần mạnh dạn hơn khi phát biểu.' },
      { target: 'general', content: 'Có tiến bộ rõ trong học kỳ; tiếp tục phát huy.' },
    ],
  },
};

export interface YearResultInput {
  // Hạng mức đạt cuối năm của từng môn, hoạt động; null là chưa nhập
  subjectRanks: Array<number | null>;
  subjectWorstRank: number;
  competencyRanks: Array<number | null>;
  competencyWorstRank: number;
  // Điểm bài kiểm tra cuối năm của các môn có bài kiểm tra; null là chưa nhập
  scores: Array<number | null>;
  thresholds: { excellent: number; good: number; completed: number };
}

// Gợi ý kết quả cuối năm theo Điều 9 khoản 2: thiếu dữ liệu thì không gợi ý (null)
export function suggestYearResult(input: YearResultInput): YearResultCode | null {
  const { subjectRanks, competencyRanks, scores, thresholds } = input;
  if ([...subjectRanks, ...competencyRanks, ...scores].some((value) => value === null) || subjectRanks.length === 0) {
    return null;
  }
  const subjects = subjectRanks as number[];
  const competencies = competencyRanks as number[];
  const marks = scores as number[];
  const allTop = subjects.every((rank) => rank === 1) && competencies.every((rank) => rank === 1);
  const minScore = marks.length === 0 ? 10 : Math.min(...marks);
  if (allTop && minScore >= thresholds.excellent) {
    return 'excellent';
  }
  if (allTop && minScore >= thresholds.good) {
    return 'good';
  }
  const passing =
    subjects.every((rank) => rank < input.subjectWorstRank) &&
    competencies.every((rank) => rank < input.competencyWorstRank);
  return passing && minScore >= thresholds.completed ? 'completed' : 'not_completed';
}

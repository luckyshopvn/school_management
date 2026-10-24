import type { SchoolLevelCode } from './school-levels.js';

// Học bạ số, khen thưởng học sinh, hoàn thành chương trình (DT-20 phần 20e, YCTD-163). Danh hiệu mặc định theo Điều 15
// Thông tư 27/2020/TT-BGDĐT (Hiệu trưởng tặng giấy khen cuối năm cho học sinh Xuất sắc, học sinh Tiêu biểu hoàn thành tốt
// trong học tập và rèn luyện; khen thưởng đột xuất); trường nạp rồi sửa. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type StudentAwardKind = 'year_end' | 'special';
// `secondary_excellent`, `secondary_good`: danh hiệu học sinh Xuất sắc, Giỏi của THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21e)
export type StudentAwardBasis = 'excellent' | 'outstanding' | 'secondary_excellent' | 'secondary_good';
export type CompletionOutcome = 'promoted' | 'level_completed' | 'pending_support' | 'retained';
export type SupportPlan = 'summer_training' | 'retest';

export const STUDENT_AWARD_DEFAULTS: Partial<
  Record<
    SchoolLevelCode,
    Array<{ code: string; name: string; kind: StudentAwardKind; basis: StudentAwardBasis | null }>
  >
> = {
  TH: [
    { code: 'HS-XS', name: 'Học sinh Xuất sắc', kind: 'year_end', basis: 'excellent' },
    {
      code: 'HS-TB',
      name: 'Học sinh Tiêu biểu hoàn thành tốt trong học tập và rèn luyện',
      kind: 'year_end',
      basis: 'outstanding',
    },
    { code: 'KT-DX', name: 'Khen thưởng đột xuất', kind: 'special', basis: null },
  ],
  THCS: [
    { code: 'HS-XS', name: 'Học sinh Xuất sắc', kind: 'year_end', basis: 'secondary_excellent' },
    { code: 'HS-G', name: 'Học sinh Giỏi', kind: 'year_end', basis: 'secondary_good' },
    { code: 'KT-DX', name: 'Khen thưởng đột xuất', kind: 'special', basis: null },
  ],
  THPT: [
    { code: 'HS-XS', name: 'Học sinh Xuất sắc', kind: 'year_end', basis: 'secondary_excellent' },
    { code: 'HS-G', name: 'Học sinh Giỏi', kind: 'year_end', basis: 'secondary_good' },
    { code: 'KT-DX', name: 'Khen thưởng đột xuất', kind: 'special', basis: null },
  ],
};

// Danh hiệu cuối năm của THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21e), mặc định đối chiếu văn bản gốc trước khi dùng:
// học sinh Giỏi khi học tập và rèn luyện cả năm đều Tốt; học sinh Xuất sắc khi thêm điều kiện có ít nhất 6 môn tính điểm
// điểm trung bình cả năm từ 9,0
export const SECONDARY_AWARD_RULE = { excellent_min_subjects: 6, excellent_min_average: 9 } as const;

export function secondaryAwardBases(input: {
  learning: string | null;
  conduct: string | null;
  highSubjects: number;
}): Array<'secondary_excellent' | 'secondary_good'> {
  if (input.learning !== 'good' || input.conduct !== 'good') {
    return [];
  }
  return input.highSubjects >= SECONDARY_AWARD_RULE.excellent_min_subjects
    ? ['secondary_excellent', 'secondary_good']
    : ['secondary_good'];
}

// Học tập và rèn luyện cả năm đều từ Đạt trở lên thì đủ điều kiện lên lớp (Điều 10); cần cả hai kết quả mới xét được
export function secondaryPassed(learning: string | null, conduct: string | null): boolean | null {
  if (!learning || !conduct) {
    return null;
  }
  return learning !== 'fail' && conduct !== 'fail';
}

export const COMPLETION_OUTCOME_LABELS: Record<CompletionOutcome, string> = {
  promoted: 'Hoàn thành chương trình lớp học, lên lớp',
  level_completed: 'Hoàn thành chương trình cấp học',
  pending_support: 'Chưa hoàn thành, đang rèn luyện hoặc kiểm tra lại',
  retained: 'Ở lại lớp',
};

export const SUPPORT_PLAN_LABELS: Record<SupportPlan, string> = {
  summer_training: 'Rèn luyện trong hè',
  retest: 'Kiểm tra lại',
};

// Kết quả hoàn thành chương trình theo Điều 11 Thông tư 27/2020: kết quả cuối năm từ "Hoàn thành" trở lên là hoàn thành
// chương trình lớp học; ở khối cuối cấp là hoàn thành chương trình cấp học (tiểu học). Chưa hoàn thành thì giáo viên lập kế
// hoạch giúp đỡ (rèn luyện trong hè, kiểm tra lại) rồi đánh giá bổ sung: đạt thì lên lớp, chưa đạt thì ở lại lớp
export function completionOutcome(input: {
  yearResult: 'excellent' | 'good' | 'completed' | 'not_completed';
  lastGrade: boolean;
  supportResult: 'completed' | 'not_completed' | null;
}): CompletionOutcome {
  const passed = input.yearResult !== 'not_completed' || input.supportResult === 'completed';
  if (passed) {
    return input.lastGrade ? 'level_completed' : 'promoted';
  }
  return input.supportResult === 'not_completed' ? 'retained' : 'pending_support';
}

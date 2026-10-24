import type { CognitiveLevel, QuestionType, VariantItem } from '../exams/exam-rules.js';

// Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173): hàm thuần chấm phiếu theo đáp án của mã đề (22g1), tổng hợp điểm tự luận,
// thống kê theo câu, chủ đề, mức nhận thức. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - nhiều lựa chọn: đủ điểm khi chọn đúng tập đáp án đúng, sai hoặc thiếu là 0;
// - đúng sai: chấm theo số ý đúng; cách bậc thang (mặc định, cách tính phổ biến của đề 4 ý: 1 ý 0,1; 2 ý 0,25; 3 ý 0,5; 4 ý
//   đủ điểm, nhân với điểm của câu) hoặc cách tỉ lệ (số ý đúng chia số ý), chọn ở bài kiểm tra; câu khác 4 ý luôn tính tỉ lệ;
// - trả lời ngắn: đúng khi trùng một đáp số chấp nhận sau khi bỏ khoảng trắng, không phân biệt hoa thường, dấu phẩy và dấu
//   chấm thập phân như nhau;
// - tự luận: điểm do giáo viên nhập, không quá điểm của câu; chấm hai người thì lấy trung bình, lệch quá ngưỡng thì đánh dấu
//   cần xem lại;
// - điểm bài làm tròn đến một chữ số thập phân (như sổ điểm 21c), nửa lên;
// - độ khó của câu là tỉ lệ điểm đạt trung bình (0 đến 1); độ phân biệt là hiệu tỉ lệ điểm đạt của nhóm 27% điểm bài cao
//   nhất và nhóm 27% thấp nhất; câu nên xem lại khi độ khó dưới 0,2 hoặc trên 0,95, hoặc độ phân biệt dưới 0,2 (từ 10 bài).
export type TrueFalseRule = 'tiered' | 'proportional';
export const TIERED_TRUE_FALSE = [0, 0.1, 0.25, 0.5, 1];

export interface GradedQuestion {
  question_id: string;
  question_type: QuestionType;
  cognitive_level: CognitiveLevel;
  topic_name: string | null;
  score: number;
}

export interface QuestionResult {
  question_id: string;
  number: number;
  earned: number;
  correct: boolean | null;
}

export const roundScore = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

export function normalizeShortAnswer(value: string): string {
  return value.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
}

// Điểm một câu trắc nghiệm; câu tự luận trả null (chấm tay)
export function gradeObjective(
  type: QuestionType,
  answer: string[],
  given: string[] | null | undefined,
  score: number,
  rule: TrueFalseRule,
): number | null {
  if (type === 'essay') return null;
  const response = (given ?? []).map((value) => value.trim()).filter(Boolean);
  if (response.length === 0) return 0;
  if (type === 'multiple_choice') {
    const chosen = [...new Set(response.map((value) => value.toUpperCase()))].sort();
    return chosen.length === answer.length && chosen.every((value, index) => value === answer[index]) ? score : 0;
  }
  if (type === 'true_false') {
    const correct = answer.filter((value, index) => normalizeTrueFalse(response[index]) === value).length;
    if (rule === 'tiered' && answer.length === 4) {
      return Math.round((TIERED_TRUE_FALSE[correct] as number) * score * 100) / 100;
    }
    return Math.round((correct / answer.length) * score * 100) / 100;
  }
  const accepted = answer.map(normalizeShortAnswer);
  return accepted.includes(normalizeShortAnswer(response[0] as string)) ? score : 0;
}

// Đ, S, D, T (đúng), F (sai) đều đọc được
export function normalizeTrueFalse(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim().toUpperCase();
  if (['Đ', 'D', 'T', 'ĐÚNG', 'DUNG', 'TRUE'].includes(text)) return 'Đ';
  if (['S', 'F', 'SAI', 'FALSE'].includes(text)) return 'S';
  return null;
}

export interface SheetInput {
  answers: Record<number, string[]>;
  essay: Record<string, { first: number | null; second: number | null }>;
}

export interface SheetGrade {
  objective: number;
  essay: number;
  total: number;
  needs_review: boolean;
  missing_essay: number;
  results: QuestionResult[];
}

// Chấm một bài theo các câu của mã đề (thứ tự, đáp án của mã) và điểm, dạng của câu
export function gradeSheet(
  items: VariantItem[],
  questions: GradedQuestion[],
  sheet: SheetInput,
  options: { rule: TrueFalseRule; doubleMarking: boolean; tolerance: number },
): SheetGrade {
  let objective = 0;
  let essay = 0;
  let needsReview = false;
  let missingEssay = 0;
  const results: QuestionResult[] = [];
  for (const item of items) {
    const question = questions.find((row) => row.question_id === item.question_id);
    if (!question) continue;
    if (question.question_type === 'essay') {
      const marks = sheet.essay[item.question_id];
      const first = marks?.first ?? null;
      const second = options.doubleMarking ? (marks?.second ?? null) : null;
      let earned: number | null = null;
      if (first !== null && (!options.doubleMarking || second !== null)) {
        earned = second === null ? first : (first + second) / 2;
        if (second !== null && Math.abs(first - second) > options.tolerance) needsReview = true;
      } else {
        missingEssay += 1;
      }
      essay += earned ?? 0;
      results.push({ question_id: item.question_id, number: item.number, earned: earned ?? 0, correct: null });
      continue;
    }
    const earned =
      gradeObjective(question.question_type, item.answer, sheet.answers[item.number], question.score, options.rule) ??
      0;
    objective += earned;
    results.push({ question_id: item.question_id, number: item.number, earned, correct: earned >= question.score });
  }
  return {
    objective: Math.round(objective * 100) / 100,
    essay: Math.round(essay * 100) / 100,
    total: roundScore(objective + essay),
    needs_review: needsReview,
    missing_essay: missingEssay,
    results,
  };
}

export interface GradedPaper {
  total: number;
  results: QuestionResult[];
}

export interface QuestionStat {
  question_id: string;
  attempts: number;
  difficulty: number;
  discrimination: number | null;
  review: boolean;
}

// Độ khó, độ phân biệt của từng câu trên các bài đã chấm (bài vắng không tính)
export function questionStats(papers: GradedPaper[], questions: GradedQuestion[]): QuestionStat[] {
  const ranked = [...papers].sort((left, right) => right.total - left.total);
  const groupSize = ranked.length >= 10 ? Math.max(1, Math.round(ranked.length * 0.27)) : 0;
  const upper = ranked.slice(0, groupSize);
  const lower = groupSize > 0 ? ranked.slice(-groupSize) : [];
  const rate = (group: GradedPaper[], question: GradedQuestion) => {
    if (group.length === 0) return 0;
    const sum = group.reduce(
      (total, paper) => total + (paper.results.find((row) => row.question_id === question.question_id)?.earned ?? 0),
      0,
    );
    return sum / (group.length * question.score);
  };
  return questions.map((question) => {
    const attempts = papers.filter((paper) => paper.results.some((row) => row.question_id === question.question_id));
    const difficulty = Math.round(rate(attempts, question) * 100) / 100;
    const discrimination =
      groupSize > 0 ? Math.round((rate(upper, question) - rate(lower, question)) * 100) / 100 : null;
    return {
      question_id: question.question_id,
      attempts: attempts.length,
      difficulty,
      discrimination,
      review:
        attempts.length > 0 &&
        (difficulty < 0.2 || difficulty > 0.95 || (discrimination !== null && discrimination < 0.2)),
    };
  });
}

// Tỉ lệ điểm đạt theo nhóm (chủ đề hoặc mức nhận thức)
export function groupRates(
  papers: GradedPaper[],
  questions: GradedQuestion[],
  key: (question: GradedQuestion) => string,
): Array<{ key: string; questions: number; max: number; rate: number }> {
  const groups = new Map<string, GradedQuestion[]>();
  for (const question of questions) {
    groups.set(key(question), [...(groups.get(key(question)) ?? []), question]);
  }
  return [...groups.entries()].map(([name, members]) => {
    const max = members.reduce((sum, question) => sum + question.score, 0);
    const earned = papers.reduce(
      (sum, paper) =>
        sum +
        paper.results
          .filter((row) => members.some((member) => member.question_id === row.question_id))
          .reduce((total, row) => total + row.earned, 0),
      0,
    );
    return {
      key: name,
      questions: members.length,
      max,
      rate: papers.length > 0 && max > 0 ? Math.round((earned / (papers.length * max)) * 100) / 100 : 0,
    };
  });
}

// Phân bố điểm bài theo khoảng 0 đến dưới 1, ..., 9 đến 10
export function scoreDistribution(totals: number[]): number[] {
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const total of totals) {
    buckets[Math.min(9, Math.max(0, Math.floor(total)))]! += 1;
  }
  return buckets;
}

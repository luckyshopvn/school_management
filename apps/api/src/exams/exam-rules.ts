// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168): hàm thuần của ma trận đề, bốc câu theo ma trận, trộn đề nhiều mã.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - mức nhận thức cố định bốn mã (nhận biết, thông hiểu, vận dụng, vận dụng cao); dạng câu hỏi cố định bốn mã (nhiều lựa
//   chọn, đúng sai, trả lời ngắn, tự luận). Tỉ lệ điểm theo mức cấu hình ở từng ma trận (mặc định 40, 30, 20, 10 phần trăm;
//   mẫu ba mức thì để vận dụng cao 0) vì mẫu theo môn, theo năm có thể đổi;
// - ma trận hợp lệ khi tổng điểm bằng tổng điểm của đề và tỉ lệ điểm từng mức lệch mẫu không quá sai số (mặc định 5 điểm
//   phần trăm); mỗi dòng là chủ đề × mức × dạng, số câu và điểm mỗi câu, yêu cầu cần đạt (bảng đặc tả);
// - bốc câu: mỗi dòng lấy ngẫu nhiên đủ số câu đã duyệt đúng chủ đề, mức, dạng (môn, khối lọc trước), không lấy câu đã dùng
//   từ mốc ngày của đề, không lấy một câu hai lần; thiếu câu thì báo từng dòng thiếu, không bốc nửa chừng;
// - trộn đề: mã thứ nhất giữ thứ tự soạn; các mã sau trộn thứ tự câu trong từng phần (phần theo dạng câu, giữ thứ tự phần)
//   và thứ tự lựa chọn của câu nhiều lựa chọn; câu đúng sai giữ thứ tự ý; đáp án của mã đề tính lại theo thứ tự mới.
export const COGNITIVE_LEVELS = ['recognition', 'comprehension', 'application', 'high_application'] as const;
export type CognitiveLevel = (typeof COGNITIVE_LEVELS)[number];
export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'short_answer', 'essay'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const COGNITIVE_LABELS: Record<CognitiveLevel, string> = {
  recognition: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
  high_application: 'Vận dụng cao',
};
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Nhiều lựa chọn',
  true_false: 'Đúng sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
};
export const DEFAULT_RATIOS: Record<CognitiveLevel, number> = {
  recognition: 40,
  comprehension: 30,
  application: 20,
  high_application: 10,
};
export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface MatrixRow {
  topic_id: string | null;
  topic_name: string;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  count: number;
  score_each: number;
  requirement?: string | null;
}

export interface MatrixInput {
  total_score: number;
  target_ratios: Record<CognitiveLevel, number>;
  tolerance: number;
  rows: MatrixRow[];
}

export interface MatrixIssue {
  code: 'total_score' | 'ratio' | 'empty';
  message: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

// Tổng hợp ma trận: số câu, điểm theo mức, theo dạng, tỉ lệ điểm theo mức
export function summarizeMatrix(rows: MatrixRow[]) {
  const byLevel = Object.fromEntries(COGNITIVE_LEVELS.map((level) => [level, { count: 0, score: 0 }])) as Record<
    CognitiveLevel,
    { count: number; score: number }
  >;
  const byType = Object.fromEntries(QUESTION_TYPES.map((type) => [type, { count: 0, score: 0 }])) as Record<
    QuestionType,
    { count: number; score: number }
  >;
  let count = 0;
  let score = 0;
  for (const row of rows) {
    const rowScore = row.count * row.score_each;
    count += row.count;
    score += rowScore;
    byLevel[row.cognitive_level].count += row.count;
    byLevel[row.cognitive_level].score = round(byLevel[row.cognitive_level].score + rowScore);
    byType[row.question_type].count += row.count;
    byType[row.question_type].score = round(byType[row.question_type].score + rowScore);
  }
  const ratios = Object.fromEntries(
    COGNITIVE_LEVELS.map((level) => [level, score > 0 ? round((byLevel[level].score / score) * 100) : 0]),
  ) as Record<CognitiveLevel, number>;
  return { count, score: round(score), by_level: byLevel, by_type: byType, ratios };
}

export function checkMatrix(matrix: MatrixInput): MatrixIssue[] {
  if (matrix.rows.length === 0 || matrix.rows.every((row) => row.count === 0)) {
    return [{ code: 'empty', message: 'Ma trận chưa có câu nào' }];
  }
  const issues: MatrixIssue[] = [];
  const summary = summarizeMatrix(matrix.rows);
  if (Math.abs(summary.score - matrix.total_score) > 0.001) {
    issues.push({
      code: 'total_score',
      message: `Tổng điểm của ma trận là ${summary.score}, đề cần ${matrix.total_score} điểm`,
    });
  }
  for (const level of COGNITIVE_LEVELS) {
    const target = matrix.target_ratios[level] ?? 0;
    const actual = summary.ratios[level];
    if (Math.abs(actual - target) > matrix.tolerance + 0.001) {
      issues.push({
        code: 'ratio',
        message: `Mức ${COGNITIVE_LABELS[level]} chiếm ${actual}% điểm, mẫu ${target}% (sai số cho phép ${matrix.tolerance}%)`,
      });
    }
  }
  return issues;
}

export interface PoolQuestion {
  id: string;
  topic_id: string | null;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  last_used_at: string | null;
}

export interface PickResult {
  picked: Array<{ question_id: string; row: number; score: number }>;
  shortages: Array<{ row: number; needed: number; available: number; message: string }>;
}

// Số giả ngẫu nhiên có hạt giống (mulberry32) để bốc câu, trộn đề lặp lại được khi kiểm thử
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

// Bốc câu theo ma trận; `usedSince` là mốc ngày (YYYY-MM-DD), câu dùng từ mốc đó trở đi không lấy
export function pickQuestions(
  rows: MatrixRow[],
  pool: PoolQuestion[],
  options: { usedSince: string | null; random: () => number },
): PickResult {
  const taken = new Set<string>();
  const picked: PickResult['picked'] = [];
  const shortages: PickResult['shortages'] = [];
  rows.forEach((row, index) => {
    if (row.count <= 0) return;
    const candidates = pool.filter(
      (question) =>
        !taken.has(question.id) &&
        question.cognitive_level === row.cognitive_level &&
        question.question_type === row.question_type &&
        (row.topic_id === null || question.topic_id === row.topic_id) &&
        !(options.usedSince && question.last_used_at && question.last_used_at >= options.usedSince),
    );
    if (candidates.length < row.count) {
      shortages.push({
        row: index + 1,
        needed: row.count,
        available: candidates.length,
        message: `Dòng ${index + 1} (${row.topic_name}, ${COGNITIVE_LABELS[row.cognitive_level]}, ${QUESTION_TYPE_LABELS[row.question_type]}) cần ${row.count} câu, ngân hàng có ${candidates.length} câu dùng được`,
      });
      return;
    }
    for (const question of shuffle(candidates, options.random).slice(0, row.count)) {
      taken.add(question.id);
      picked.push({ question_id: question.id, row: index + 1, score: row.score_each });
    }
  });
  return shortages.length > 0 ? { picked: [], shortages } : { picked, shortages };
}

export interface ExamQuestionInput {
  question_id: string;
  question_type: QuestionType;
  // Số lựa chọn (câu nhiều lựa chọn); đáp án theo thứ tự gốc: khoá lựa chọn đúng, hoặc Đ/S từng ý, hoặc đáp số
  option_count: number;
  answer: string[];
}

export interface VariantItem {
  question_id: string;
  number: number;
  // Lựa chọn ở vị trí i của mã đề là lựa chọn gốc option_order[i] (chỉ câu nhiều lựa chọn)
  option_order: string[];
  answer: string[];
}

export interface Variant {
  code: string;
  items: VariantItem[];
}

// Mã đề: 101, 102, ...
export function variantCodes(count: number): string[] {
  return Array.from({ length: count }, (_value, index) => String(101 + index));
}

export function buildVariants(questions: ExamQuestionInput[], count: number, seed: number): Variant[] {
  const random = createRandom(seed);
  return variantCodes(count).map((code, variantIndex) => {
    const sections = QUESTION_TYPES.map((type) => questions.filter((question) => question.question_type === type));
    const ordered = sections.flatMap((section) => (variantIndex === 0 ? section : shuffle(section, random)));
    return {
      code,
      items: ordered.map((question, index) => {
        const original = OPTION_KEYS.slice(0, question.option_count);
        const isChoice = question.question_type === 'multiple_choice';
        const order = isChoice && variantIndex > 0 ? shuffle(original, random) : original;
        return {
          question_id: question.question_id,
          number: index + 1,
          option_order: isChoice ? order : [],
          answer: isChoice
            ? question.answer.map((key) => OPTION_KEYS[order.indexOf(key)] as string).sort()
            : question.answer,
        };
      }),
    };
  });
}

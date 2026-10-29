// Trò chơi kiến thức ở màn hình lớp (DT-23 phần 23c, YCTD-213; tài liệu 47 mục 15.4): phần thuần, chạy được trong kiểm thử với
// nguồn ngẫu nhiên cố định. Bộ tạo ô chữ, vòng quay và điểm theo vòng do dự án tự viết, không chép giao diện hay luật của sản phẩm
// khác
export type Random = () => number;

export type GameQuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface GameQuestion {
  id: string;
  question_type: GameQuestionType;
  content: string;
  options: Array<{ key: string; content: string }>;
  answer: string[];
  cognitive_level: string;
  topic_name: string | null;
}

// ----- Ô chữ -----

// Từ của ô chữ: bỏ dấu tiếng Việt, đổi Đ thành D, chỉ giữ chữ cái và chữ số, viết hoa (ô chữ trên bảng lớp quen dùng không dấu)
export function crosswordWord(answer: string): string {
  return answer
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export interface CrosswordEntry {
  question_id: string;
  clue: string;
  word: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
  number: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  entries: CrosswordEntry[];
  // Câu không xếp được vào lưới (từ quá dài, không có chữ chung)
  skipped: string[];
}

export const MIN_WORD = 2;
export const MAX_WORD = 15;

type Grid = Map<string, string>;

const cellKey = (row: number, col: number) => `${row},${col}`;

function fits(grid: Grid, word: string, row: number, col: number, direction: 'across' | 'down'): number {
  // Trả số chữ giao với từ đã có; -1 nếu không đặt được
  let crossings = 0;
  const dr = direction === 'down' ? 1 : 0;
  const dc = direction === 'across' ? 1 : 0;
  // Ô trước và sau từ phải trống
  if (grid.has(cellKey(row - dr, col - dc)) || grid.has(cellKey(row + dr * word.length, col + dc * word.length))) {
    return -1;
  }
  for (let index = 0; index < word.length; index += 1) {
    const r = row + dr * index;
    const c = col + dc * index;
    const existing = grid.get(cellKey(r, c));
    if (existing) {
      if (existing !== word[index]) {
        return -1;
      }
      crossings += 1;
    } else {
      // Ô mới không được chạm cạnh chữ khác theo chiều vuông góc (tránh tạo từ ghép vô nghĩa)
      const sideA = direction === 'across' ? cellKey(r - 1, c) : cellKey(r, c - 1);
      const sideB = direction === 'across' ? cellKey(r + 1, c) : cellKey(r, c + 1);
      if (grid.has(sideA) || grid.has(sideB)) {
        return -1;
      }
    }
  }
  return crossings;
}

function place(grid: Grid, word: string, row: number, col: number, direction: 'across' | 'down'): void {
  for (let index = 0; index < word.length; index += 1) {
    grid.set(
      cellKey(row + (direction === 'down' ? index : 0), col + (direction === 'across' ? index : 0)),
      word.charAt(index),
    );
  }
}

// Xếp lưới: từ dài nhất đặt ngang ở giữa, từ sau đặt giao với chữ đã có (ưu tiên nhiều giao điểm, lưới gọn); không giao được thì
// bỏ qua và báo để giáo viên sửa tay. Số thứ tự đánh theo vị trí trên lưới
export function buildCrossword(
  items: Array<{ question_id: string; clue: string; answer: string }>,
  random: Random = Math.random,
): Crossword {
  const words = items
    .map((item) => ({ ...item, word: crosswordWord(item.answer) }))
    .filter((item) => item.word.length >= MIN_WORD && item.word.length <= MAX_WORD);
  const skipped = items
    .filter((item) => !words.some((word) => word.question_id === item.question_id))
    .map((item) => item.question_id);
  words.sort((left, right) => right.word.length - left.word.length || (random() < 0.5 ? -1 : 1));
  const grid: Grid = new Map();
  const placed: Array<Omit<CrosswordEntry, 'number'>> = [];
  for (const item of words) {
    if (placed.length === 0) {
      place(grid, item.word, 0, 0, 'across');
      placed.push({
        question_id: item.question_id,
        clue: item.clue,
        word: item.word,
        row: 0,
        col: 0,
        direction: 'across',
      });
      continue;
    }
    let best: { row: number; col: number; direction: 'across' | 'down'; score: number } | null = null;
    for (const entry of placed) {
      for (let i = 0; i < entry.word.length; i += 1) {
        for (let j = 0; j < item.word.length; j += 1) {
          if (entry.word[i] !== item.word[j]) continue;
          const direction = entry.direction === 'across' ? 'down' : 'across';
          const crossRow = entry.row + (entry.direction === 'down' ? i : 0);
          const crossCol = entry.col + (entry.direction === 'across' ? i : 0);
          const row = direction === 'down' ? crossRow - j : crossRow;
          const col = direction === 'across' ? crossCol - j : crossCol;
          const crossings = fits(grid, item.word, row, col, direction);
          if (crossings < 1) continue;
          const score = crossings * 10 + random();
          if (!best || score > best.score) best = { row, col, direction, score };
        }
      }
    }
    if (!best) {
      skipped.push(item.question_id);
      continue;
    }
    place(grid, item.word, best.row, best.col, best.direction);
    placed.push({
      question_id: item.question_id,
      clue: item.clue,
      word: item.word,
      row: best.row,
      col: best.col,
      direction: best.direction,
    });
  }
  return normalizeCrossword(placed, skipped);
}

// Dời lưới về gốc (0, 0), tính kích thước và đánh số theo hàng rồi cột (ô bắt đầu của nhiều từ dùng chung một số)
export function normalizeCrossword(entries: Array<Omit<CrosswordEntry, 'number'>>, skipped: string[] = []): Crossword {
  if (entries.length === 0) {
    return { rows: 0, cols: 0, entries: [], skipped };
  }
  const minRow = Math.min(...entries.map((entry) => entry.row));
  const minCol = Math.min(...entries.map((entry) => entry.col));
  const shifted = entries.map((entry) => ({ ...entry, row: entry.row - minRow, col: entry.col - minCol }));
  const rows = Math.max(...shifted.map((entry) => entry.row + (entry.direction === 'down' ? entry.word.length : 1)));
  const cols = Math.max(...shifted.map((entry) => entry.col + (entry.direction === 'across' ? entry.word.length : 1)));
  const starts = [...new Set(shifted.map((entry) => cellKey(entry.row, entry.col)))].sort((left, right) => {
    const [lr, lc] = left.split(',').map(Number) as [number, number];
    const [rr, rc] = right.split(',').map(Number) as [number, number];
    return lr - rr || lc - rc;
  });
  return {
    rows,
    cols,
    skipped,
    entries: shifted
      .map((entry) => ({ ...entry, number: starts.indexOf(cellKey(entry.row, entry.col)) + 1 }))
      .sort((left, right) => left.number - right.number || (left.direction === 'across' ? -1 : 1)),
  };
}

// Kiểm tra lưới sau khi giáo viên chỉnh tay: chữ ở ô giao nhau phải trùng
export function crosswordConflicts(crossword: Crossword): string[] {
  const grid = new Map<string, { letter: string; question_id: string }>();
  const conflicts = new Set<string>();
  for (const entry of crossword.entries) {
    for (let index = 0; index < entry.word.length; index += 1) {
      const key = cellKey(
        entry.row + (entry.direction === 'down' ? index : 0),
        entry.col + (entry.direction === 'across' ? index : 0),
      );
      const existing = grid.get(key);
      if (existing && existing.letter !== entry.word[index]) {
        conflicts.add(existing.question_id);
        conflicts.add(entry.question_id);
      } else {
        grid.set(key, { letter: entry.word.charAt(index), question_id: entry.question_id });
      }
    }
  }
  return [...conflicts];
}

// Lưới chữ để vẽ: null là ô trống
export function crosswordCells(crossword: Crossword): Array<Array<{ letter: string; number: number | null } | null>> {
  const cells: Array<Array<{ letter: string; number: number | null } | null>> = Array.from(
    { length: crossword.rows },
    () => Array.from({ length: crossword.cols }, () => null),
  );
  for (const entry of crossword.entries) {
    for (let index = 0; index < entry.word.length; index += 1) {
      const row = entry.row + (entry.direction === 'down' ? index : 0);
      const col = entry.col + (entry.direction === 'across' ? index : 0);
      const current = cells[row]?.[col];
      const number = index === 0 ? entry.number : (current?.number ?? null);
      (cells[row] as Array<{ letter: string; number: number | null } | null>)[col] = {
        letter: entry.word.charAt(index),
        number,
      };
    }
  }
  return cells;
}

// ----- Vòng quay -----

// Ô của vòng quay dừng ở góc quay cuối (độ, kim chỉ ở đỉnh, quay theo chiều kim đồng hồ)
export function wheelIndexAt(angle: number, size: number): number {
  if (size <= 0) return -1;
  const normalized = (((360 - (angle % 360)) % 360) + 360) % 360;
  return Math.floor(normalized / (360 / size)) % size;
}

// Góc quay cho lần quay: ít nhất ba vòng, dừng ngẫu nhiên trong một ô (tránh dừng đúng vạch chia)
export function spinTarget(currentAngle: number, size: number, random: Random): { angle: number; index: number } {
  const index = Math.floor(random() * size) % size;
  const slice = 360 / size;
  const within = slice * (0.15 + random() * 0.7);
  const stopAt = 360 - (index * slice + within);
  const base = currentAngle - (currentAngle % 360);
  // Cộng thêm một vòng so với góc đã quay dở để luôn quay ít nhất ba vòng
  const angle = base + 360 * (4 + Math.floor(random() * 3)) + stopAt;
  return { angle, index: wheelIndexAt(angle, size) };
}

// ----- Hỏi đáp theo vòng -----

export interface RoundPlan {
  round: number;
  question_ids: string[];
}

// Chia câu thành các vòng đều nhau theo thứ tự đã trộn
export function planRounds(questionIds: string[], rounds: number): RoundPlan[] {
  const count = Math.max(1, Math.min(rounds, questionIds.length));
  const plan: RoundPlan[] = Array.from({ length: count }, (_, index) => ({ round: index + 1, question_ids: [] }));
  questionIds.forEach((id, index) => (plan[index % count] as RoundPlan).question_ids.push(id));
  return plan;
}

// Điểm của một vòng: vòng sau nhân hệ số (vòng 1 x1, vòng 2 x2...) khi bật, mặc định mỗi câu đúng 1 điểm
export function roundPoints(round: number, base: number, escalate: boolean): number {
  return base * (escalate ? round : 1);
}

export function addScore(scores: Record<string, number>, group: string, points: number): Record<string, number> {
  return { ...scores, [group]: (scores[group] ?? 0) + points };
}

// Xếp hạng nhóm theo điểm (cùng điểm cùng hạng)
export function ranking(scores: Record<string, number>): Array<{ group: string; score: number; rank: number }> {
  const sorted = Object.entries(scores).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'vi'),
  );
  return sorted.map(([group, score]) => ({
    group,
    score,
    rank: sorted.findIndex(([, other]) => other === score) + 1,
  }));
}

export function shuffle<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
}

// Đáp án đúng hiển thị khi giáo viên mở đáp án
export function answerText(question: GameQuestion): string {
  if (question.question_type === 'multiple_choice') {
    return question.answer
      .map((key) => `${key}. ${question.options.find((option) => option.key === key)?.content ?? ''}`.trim())
      .join('; ');
  }
  if (question.question_type === 'true_false') {
    return question.options.map((option, index) => `${option.key}) ${question.answer[index] ?? ''}`).join('; ');
  }
  return question.answer.join(' / ');
}

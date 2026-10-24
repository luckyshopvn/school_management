// Sổ đầu bài cấp THCS, THPT, sơ đồ chỗ ngồi (DT-21 phần 21d, YCTD-171). Hàm thuần dùng chung cho máy chủ, cổng quản trị và
// ứng dụng giáo viên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - xếp loại tiết A đến D, nhãn theo cấp do trường sửa; quy tắc theo cấp: không dùng, tuỳ chọn, hoặc bắt buộc khi ký tiết;
//   tiết C, D phải có nhận xét nếu cấp bật quy tắc này;
// - chỗ ngồi đánh số dãy (từ trái sang, nhìn từ bàn giáo viên), bàn (từ trên xuống), chỗ trong bàn (từ trái sang); xếp tự
//   động theo thứ tự danh sách lấp đầy từng bàn từ bàn đầu; xoay vòng theo dãy (dãy 1 sang dãy 2, dãy cuối về dãy 1) hoặc
//   theo bàn (bàn đầu xuống bàn 2, bàn cuối lên bàn đầu)
export type LessonRating = 'A' | 'B' | 'C' | 'D';
export type LessonRatingRule = 'off' | 'optional' | 'required';

export const LESSON_RATINGS: readonly LessonRating[] = ['A', 'B', 'C', 'D'];
export const LESSON_RATING_RULE_LABELS: Record<LessonRatingRule, string> = {
  off: 'Không xếp loại tiết',
  optional: 'Xếp loại tiết tuỳ giáo viên',
  required: 'Bắt buộc xếp loại khi ký tiết',
};

export interface LessonRatingSettings {
  rating_mode: LessonRatingRule;
  rating_labels: Record<LessonRating, string>;
  low_rating_comment: boolean;
  conduct_points: Record<LessonRating, number> | null;
}

// Lỗi xếp loại tiết theo quy tắc của cấp; trống là hợp lệ. `signing` là lúc ký tiết (bắt buộc xếp loại chỉ kiểm khi ký để
// giáo viên lưu nháp được)
export function lessonRatingIssue(
  settings: LessonRatingSettings,
  input: { rating: string | null; comment: string | null },
  signing: boolean,
): string | null {
  if (settings.rating_mode === 'off') {
    return input.rating ? 'Cấp học này không xếp loại tiết' : null;
  }
  if (!input.rating) {
    return signing && settings.rating_mode === 'required' ? 'Cần xếp loại tiết trước khi ký sổ' : null;
  }
  if (settings.low_rating_comment && (input.rating === 'C' || input.rating === 'D') && !input.comment?.trim()) {
    return `Tiết xếp loại ${input.rating} cần ghi nhận xét tiết`;
  }
  return null;
}

export interface SeatingLayout {
  desk_columns: number;
  desk_rows: number;
  seats_per_desk: number;
}

export interface SeatPosition {
  column_no: number;
  row_no: number;
  seat_no: number;
}

export interface SeatAssignment extends SeatPosition {
  child_id: string;
}

export const seatKey = (seat: SeatPosition) => `${seat.column_no}:${seat.row_no}:${seat.seat_no}`;

export function seatCapacity(layout: SeatingLayout): number {
  return layout.desk_columns * layout.desk_rows * layout.seats_per_desk;
}

// Mọi chỗ theo thứ tự xếp: bàn đầu của từng dãy trước, rồi bàn sau
export function seatPositions(layout: SeatingLayout): SeatPosition[] {
  const positions: SeatPosition[] = [];
  for (let row = 1; row <= layout.desk_rows; row += 1) {
    for (let column = 1; column <= layout.desk_columns; column += 1) {
      for (let seat = 1; seat <= layout.seats_per_desk; seat += 1) {
        positions.push({ column_no: column, row_no: row, seat_no: seat });
      }
    }
  }
  return positions;
}

export function arrangeSeats(childIds: readonly string[], layout: SeatingLayout): SeatAssignment[] {
  const positions = seatPositions(layout);
  if (childIds.length > positions.length) {
    throw new Error(`Sơ đồ có ${positions.length} chỗ, lớp có ${childIds.length} học sinh`);
  }
  return childIds.map((childId, index) => ({ child_id: childId, ...(positions[index] as SeatPosition) }));
}

export function rotateSeats(
  assignments: readonly SeatAssignment[],
  layout: SeatingLayout,
  direction: 'columns' | 'rows',
): SeatAssignment[] {
  return assignments.map((assignment) =>
    direction === 'columns'
      ? { ...assignment, column_no: (assignment.column_no % layout.desk_columns) + 1 }
      : { ...assignment, row_no: (assignment.row_no % layout.desk_rows) + 1 },
  );
}

// Lỗi của sơ đồ: chỗ ngoài lưới, hai học sinh một chỗ, một học sinh hai chỗ
export function seatingIssues(assignments: readonly SeatAssignment[], layout: SeatingLayout): string[] {
  const issues: string[] = [];
  const seats = new Set<string>();
  const children = new Set<string>();
  for (const assignment of assignments) {
    if (
      assignment.column_no < 1 ||
      assignment.column_no > layout.desk_columns ||
      assignment.row_no < 1 ||
      assignment.row_no > layout.desk_rows ||
      assignment.seat_no < 1 ||
      assignment.seat_no > layout.seats_per_desk
    ) {
      issues.push(
        `Chỗ dãy ${assignment.column_no}, bàn ${assignment.row_no}, chỗ ${assignment.seat_no} nằm ngoài sơ đồ`,
      );
    }
    const key = seatKey(assignment);
    if (seats.has(key)) {
      issues.push(`Dãy ${assignment.column_no}, bàn ${assignment.row_no}, chỗ ${assignment.seat_no} có hai học sinh`);
    }
    if (children.has(assignment.child_id)) {
      issues.push('Một học sinh được xếp hai chỗ');
    }
    seats.add(key);
    children.add(assignment.child_id);
  }
  return issues;
}

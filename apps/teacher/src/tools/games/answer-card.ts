// Thẻ đáp án giấy (DT-23 phần 23c, YCTD-213; tài liệu 32 mục 15.4, GD-107): mẫu thẻ do dự án tự thiết kế, mã đọc tự viết (không
// dùng thư viện ngoài nên không phát sinh giấy phép). Thẻ là hình vuông 6 x 6 ô:
// - viền ngoài một ô toàn đen để tìm thẻ trong ảnh;
// - 4 x 4 ô bên trong: ba góc trong đen, góc trong dưới phải trắng để biết thẻ đang xoay thế nào; 12 ô còn lại là 7 bit số thứ tự
//   của học sinh trong lớp (1 đến 99) và 5 bit kiểm tra;
// - học sinh giơ thẻ với cạnh có chữ đáp án mình chọn ở phía trên (A, B, C, D in ở bốn cạnh, quay 90 độ mỗi chữ).
// Ảnh chỉ xử lý trên máy giáo viên, không gửi lên máy chủ; chỉ lưu kết quả (số thứ tự nào chọn đáp án nào)
export const CARD_CELLS = 6;
export const MAX_CARD_NUMBER = 99;
export const CARD_ANSWERS = ['A', 'B', 'C', 'D'] as const;
export type CardAnswer = (typeof CARD_ANSWERS)[number];

// Vị trí 12 ô dữ liệu trong lưới 4 x 4 bên trong (bỏ bốn góc dùng để định hướng)
const DATA_CELLS: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 1],
  [3, 2],
];

function checksum(number: number): number {
  // 5 bit kiểm tra: trộn số để hai số gần nhau khác nhiều bit
  return ((number * 37 + 11) ^ (number >> 2)) & 0b11111;
}

// Lưới 6 x 6 (true là ô đen) của thẻ ở hướng chuẩn (chữ A ở trên)
export function cardPattern(number: number): boolean[][] {
  if (!Number.isInteger(number) || number < 1 || number > MAX_CARD_NUMBER) {
    throw new Error(`Số thẻ từ 1 đến ${MAX_CARD_NUMBER}`);
  }
  const grid = Array.from({ length: CARD_CELLS }, (_, row) =>
    Array.from(
      { length: CARD_CELLS },
      (_, col) => row === 0 || col === 0 || row === CARD_CELLS - 1 || col === CARD_CELLS - 1,
    ),
  );
  const inner = (row: number, col: number, value: boolean) => {
    (grid[row + 1] as boolean[])[col + 1] = value;
  };
  inner(0, 0, true);
  inner(0, 3, true);
  inner(3, 0, true);
  inner(3, 3, false);
  const bits = (number << 5) | checksum(number);
  DATA_CELLS.forEach(([row, col], index) => inner(row, col, ((bits >> (11 - index)) & 1) === 1));
  return grid;
}

// Xoay lưới 90 độ theo chiều kim đồng hồ
export function rotateClockwise(grid: boolean[][]): boolean[][] {
  const size = grid.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => grid[size - 1 - col]?.[row] === true),
  );
}

// Đọc lưới 6 x 6 đã lấy mẫu từ ảnh (hướng bất kỳ trong bốn hướng): trả số thẻ và đáp án theo cạnh đang ở phía trên. Thẻ in chữ
// A ở cạnh trên, B ở cạnh phải, C ở cạnh dưới, D ở cạnh trái: giơ chữ B lên trên là xoay thẻ ngược chiều kim đồng hồ một lần
export function decodeCard(grid: boolean[][]): { number: number; answer: CardAnswer } | null {
  if (grid.length !== CARD_CELLS || grid.some((row) => row.length !== CARD_CELLS)) {
    return null;
  }
  // Viền phải gần như toàn đen (cho phép một ô sai do bóng tay, nếp gấp)
  let borderMisses = 0;
  for (let index = 0; index < CARD_CELLS; index += 1) {
    for (const [row, col] of [
      [0, index],
      [CARD_CELLS - 1, index],
      [index, 0],
      [index, CARD_CELLS - 1],
    ] as Array<[number, number]>) {
      if (!grid[row]?.[col]) borderMisses += 1;
    }
  }
  if (borderMisses > 2) {
    return null;
  }
  let current = grid;
  for (let turns = 0; turns < 4; turns += 1) {
    const at = (row: number, col: number) => current[row + 1]?.[col + 1] === true;
    if (at(0, 0) && at(0, 3) && at(3, 0) && !at(3, 3)) {
      let bits = 0;
      for (const [row, col] of DATA_CELLS) {
        bits = (bits << 1) | (at(row, col) ? 1 : 0);
      }
      const number = bits >> 5;
      if (number >= 1 && number <= MAX_CARD_NUMBER && (bits & 0b11111) === checksum(number)) {
        // `turns` lần xoay theo chiều kim đồng hồ đưa ảnh về hướng chuẩn: thẻ đang bị xoay ngược chiều `turns` lần
        return { number, answer: CARD_ANSWERS[turns] as CardAnswer };
      }
      return null;
    }
    current = rotateClockwise(current);
  }
  return null;
}

// Hướng của thẻ trên giấy khi giơ đáp án: dùng để vẽ minh họa và để kiểm thử
export function cardHeldAs(number: number, answer: CardAnswer): boolean[][] {
  let grid = cardPattern(number);
  const turns = CARD_ANSWERS.indexOf(answer);
  // Giơ đáp án thứ k lên trên = xoay ngược chiều kim đồng hồ k lần = xoay theo chiều kim đồng hồ (4 - k) % 4 lần
  for (let index = 0; index < (4 - turns) % 4; index += 1) {
    grid = rotateClockwise(grid);
  }
  return grid;
}

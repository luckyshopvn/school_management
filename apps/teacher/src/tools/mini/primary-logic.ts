// Phần thuần của mini app Tiểu học trong Hộp công cụ giảng dạy (DT-29 phần 29c, YCTD-327): bảng cửu chương, học xem đồng hồ,
// phân số trực quan, khung ô li. Không import gì để kiểm thử bằng node --test

export type RandomSource = () => number;

export interface MultiplicationQuestion {
  left: number;
  right: number;
}

// Câu hỏi nhân: trong một bảng (thừa số thứ nhất cố định) hoặc trộn bảng 2 đến 9; thừa số thứ hai 1 đến 10
export function multiplicationQuestion(
  table: number | null,
  random: RandomSource = Math.random,
): MultiplicationQuestion {
  const left = table ?? 2 + Math.floor(random() * 8);
  const right = 1 + Math.floor(random() * 10);
  return { left, right };
}

export function multiplicationRows(table: number): Array<{ right: number; product: number }> {
  return Array.from({ length: 10 }, (_, index) => ({ right: index + 1, product: table * (index + 1) }));
}

// Đồng hồ kim: góc (độ, tính từ 12 giờ theo chiều kim đồng hồ) của kim giờ và kim phút
export function clockHandAngles(hours: number, minutes: number): { hour: number; minute: number } {
  return { hour: ((hours % 12) + minutes / 60) * 30, minute: minutes * 6 };
}

// Phút gần nhất theo bước (1, 5, 15, 30) từ góc kim phút khi kéo
export function minutesFromAngle(angle: number, step: number): number {
  const normalized = ((angle % 360) + 360) % 360;
  const minutes = Math.round(normalized / 6 / step) * step;
  return minutes % 60;
}

// Đọc giờ theo cách nói ở lớp: "7 giờ", "7 giờ 15 phút", "7 giờ rưỡi" (30 phút), "kém 15 phút 8 giờ" tuỳ chọn
export function readTime(hours: number, minutes: number, style: 'plain' | 'before' = 'plain'): string {
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) {
    return `${hour} giờ`;
  }
  if (minutes === 30 && style === 'plain') {
    return `${hour} giờ rưỡi`;
  }
  if (style === 'before' && minutes > 30) {
    const next = hour === 12 ? 1 : hour + 1;
    return `${next} giờ kém ${60 - minutes} phút`;
  }
  return `${hour} giờ ${minutes} phút`;
}

// Phân số: mẫu 1 đến 12, tử 0 đến mẫu
export function fractionProblem(numerator: number, denominator: number): string | null {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    return 'Nhập số nguyên';
  }
  if (denominator < 1 || denominator > 12) {
    return 'Mẫu số từ 1 đến 12';
  }
  if (numerator < 0 || numerator > denominator) {
    return 'Tử số từ 0 đến mẫu số';
  }
  return null;
}

// Phần thứ `index` (0 đến parts − 1) của hình tròn tâm (50, 50) bán kính 45 chia `parts` phần bằng nhau, bắt đầu từ 12 giờ
export function circleSlice(index: number, parts: number): string {
  if (parts <= 1) {
    return 'M 50 5 A 45 45 0 1 1 49.99 5 Z';
  }
  const point = (fraction: number) => {
    const angle = fraction * 2 * Math.PI;
    return `${(50 + 45 * Math.sin(angle)).toFixed(2)} ${(50 - 45 * Math.cos(angle)).toFixed(2)}`;
  };
  const large = 1 / parts > 0.5 ? 1 : 0;
  return `M 50 50 L ${point(index / parts)} A 45 45 0 ${large} 1 ${point((index + 1) / parts)} Z`;
}

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? Math.abs(left) : greatestCommonDivisor(right, left % right);
}

// Phân số tối giản (tử, mẫu); tử 0 là 0/1
export function simplifyFraction(numerator: number, denominator: number): [number, number] {
  if (numerator === 0) {
    return [0, 1];
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

// Khung ô li (vở ô li của học sinh Tiểu học): kẻ ngang mảnh cách `unit` px, cứ bốn dòng một dòng kẻ đậm; kẻ dọc mảnh cách bốn
// ô li. Trả danh sách đoạn kẻ cho khổ `width` × `height`
export interface RuledLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bold: boolean;
}

export function ruledLines(width: number, height: number, unit: number): RuledLine[] {
  const lines: RuledLine[] = [];
  if (unit <= 0) {
    return lines;
  }
  for (let row = 1; row * unit < height; row += 1) {
    lines.push({ x1: 0, y1: row * unit, x2: width, y2: row * unit, bold: row % 4 === 0 });
  }
  for (let column = 1; column * unit * 4 < width; column += 1) {
    lines.push({ x1: column * unit * 4, y1: 0, x2: column * unit * 4, y2: height, bold: false });
  }
  return lines;
}

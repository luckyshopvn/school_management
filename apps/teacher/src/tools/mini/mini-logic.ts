// Phần thuần của mini app trong Hộp công cụ giảng dạy (DT-29 phần 29b, YCTD-326): xúc xắc, bốc số, đồng hồ hình ảnh, đèn giữ
// trật tự, bảng thưởng sao, đếm và số, chữ cái. Không import gì để kiểm thử bằng node --test (Node 24 bỏ kiểu TypeScript)

export type RandomSource = () => number;

export function randomInteger(min: number, max: number, random: RandomSource = Math.random): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Tung `count` con xúc xắc sáu mặt
export function rollDice(count: number, random: RandomSource = Math.random): number[] {
  return Array.from({ length: Math.max(1, Math.min(3, count)) }, () => randomInteger(1, 6, random));
}

// Chấm của mặt xúc xắc trên lưới 3×3 (chỉ số ô 0 đến 8, đọc từ trái sang phải, trên xuống dưới)
export const DICE_PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface NumberDraw {
  min: number;
  max: number;
  drawn: number[];
}

export function numberRangeProblem(min: number, max: number): string | null {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return 'Nhập số nguyên';
  }
  if (min > max) {
    return 'Số nhỏ nhất phải không lớn hơn số lớn nhất';
  }
  if (max - min > 9_999) {
    return 'Khoảng số tối đa 10 000 số';
  }
  return null;
}

// Bốc một số trong khoảng; không lặp thì bỏ các số đã bốc, hết số thì trả null
export function drawNumber(state: NumberDraw, noRepeat: boolean, random: RandomSource = Math.random): number | null {
  if (!noRepeat) {
    return randomInteger(state.min, state.max, random);
  }
  const taken = new Set(state.drawn);
  const left: number[] = [];
  for (let value = state.min; value <= state.max; value += 1) {
    if (!taken.has(value)) {
      left.push(value);
    }
  }
  return left.length === 0 ? null : (left[Math.floor(random() * left.length)] ?? null);
}

// Đồng hồ hình ảnh: phần còn lại từ 1 về 0 theo thời điểm kết thúc tuyệt đối
export function remainingFraction(endsAt: number, durationMs: number, now: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (endsAt - now) / durationMs));
}

// Đường cung của phần còn lại trên vòng tròn tâm (50, 50) bán kính 45, bắt đầu từ 12 giờ, theo chiều kim đồng hồ
export function remainingArc(fraction: number): string {
  if (fraction <= 0) {
    return '';
  }
  if (fraction >= 0.9999) {
    return 'M 50 5 A 45 45 0 1 1 49.99 5 Z';
  }
  const angle = fraction * 2 * Math.PI;
  const x = 50 + 45 * Math.sin(angle);
  const y = 50 - 45 * Math.cos(angle);
  const large = fraction > 0.5 ? 1 : 0;
  return `M 50 50 L 50 5 A 45 45 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

// Đèn giữ trật tự: độ ồn (căn bậc hai trung bình bình phương của mẫu âm thanh, 0 đến 1) so với ngưỡng theo độ nhạy 1 đến 10.
// Ngưỡng vàng là ngưỡng đỏ nhân 0,6. Độ nhạy cao thì ngưỡng thấp (đèn đỏ sớm hơn)
export type NoiseLight = 'green' | 'yellow' | 'red';

export function rootMeanSquare(samples: ArrayLike<number>): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export function noiseThreshold(sensitivity: number): number {
  const level = Math.max(1, Math.min(10, Math.round(sensitivity)));
  return 0.32 - (level - 1) * 0.03;
}

export function noiseLight(rms: number, sensitivity: number): NoiseLight {
  const red = noiseThreshold(sensitivity);
  if (rms >= red) {
    return 'red';
  }
  return rms >= red * 0.6 ? 'yellow' : 'green';
}

// Bảng thưởng sao: số sao mỗi nhóm trong khoảng 0 đến mục tiêu
export const STAR_TARGETS: readonly number[] = [5, 10, 15, 20];

export function changeStars(counts: readonly number[], index: number, delta: number, target: number): number[] {
  return counts.map((count, position) => (position === index ? Math.max(0, Math.min(target, count + delta)) : count));
}

// Chữ cái tiếng Việt (29 chữ) theo bảng chữ cái của chương trình Tiếng Việt
export const VIETNAMESE_LETTERS: readonly string[] = [
  'A',
  'Ă',
  'Â',
  'B',
  'C',
  'D',
  'Đ',
  'E',
  'Ê',
  'G',
  'H',
  'I',
  'K',
  'L',
  'M',
  'N',
  'O',
  'Ô',
  'Ơ',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'Ư',
  'V',
  'X',
  'Y',
];

export function lowerLetter(letter: string): string {
  return letter.toLocaleLowerCase('vi');
}

import { CARD_CELLS, decodeCard, type CardAnswer } from './answer-card.ts';

// Đọc thẻ đáp án giấy từ một khung hình camera (DT-23 phần 23c, YCTD-213): chạy hoàn toàn trên máy giáo viên, không gửi ảnh đi.
// Các bước: ảnh xám thu nhỏ, ngưỡng sáng tối tự động (Otsu), tìm các vùng tối liền nhau có khung gần vuông, lấy mẫu 6 x 6 ô ở tâm
// từng ô rồi giải mã. Học sinh giơ thẻ gần thẳng (xoay 90 độ theo đáp án); thẻ nghiêng ít vẫn đọc được nhờ lấy mẫu ở tâm ô
export interface GrayImage {
  width: number;
  height: number;
  // Độ sáng 0 đến 255, theo hàng
  data: Uint8Array | Uint8ClampedArray;
}

export interface ScannedCard {
  number: number;
  answer: CardAnswer;
  // Khung của thẻ trên ảnh (để vẽ khung xác nhận)
  box: { x: number; y: number; width: number; height: number };
}

const MIN_SIDE = 18;

// Ảnh xám từ dữ liệu RGBA của canvas
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[index] =
      ((rgba[offset] as number) * 77 + (rgba[offset + 1] as number) * 150 + (rgba[offset + 2] as number) * 29) >> 8;
  }
  return { width, height, data };
}

// Ngưỡng Otsu: chia điểm ảnh thành tối, sáng sao cho phương sai giữa hai nhóm lớn nhất
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Array<number>(256).fill(0);
  for (const value of image.data) {
    histogram[value] = (histogram[value] as number) + 1;
  }
  const total = image.data.length;
  let sum = 0;
  for (let value = 0; value < 256; value += 1) sum += value * (histogram[value] as number);
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 127;
  for (let value = 0; value < 256; value += 1) {
    weightBackground += histogram[value] as number;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += value * (histogram[value] as number);
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = value;
    }
  }
  return threshold;
}

// Tìm thẻ trong ảnh: mỗi vùng tối liền nhau (bốn hướng) có khung gần vuông, đủ lớn và đủ đặc là một thẻ ứng viên
export function scanCards(image: GrayImage): ScannedCard[] {
  const { width, height, data } = image;
  const threshold = otsuThreshold(image);
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    dark[index] = (data[index] as number) <= threshold ? 1 : 0;
  }
  const seen = new Uint8Array(width * height);
  const found = new Map<number, ScannedCard>();
  const stack: number[] = [];
  for (let start = 0; start < dark.length; start += 1) {
    if (!dark[start] || seen[start]) continue;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const next of [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ]) {
        if (next >= 0 && dark[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (boxWidth < MIN_SIDE || boxHeight < MIN_SIDE) continue;
    const ratio = boxWidth / boxHeight;
    // Viền đen chiếm ít nhất khoảng 5/9 diện tích của thẻ 6 x 6
    if (ratio < 0.7 || ratio > 1.4 || count < boxWidth * boxHeight * 0.4) continue;
    const grid = Array.from({ length: CARD_CELLS }, (_, row) =>
      Array.from({ length: CARD_CELLS }, (_, col) => {
        // Lấy mẫu 3 x 3 điểm quanh tâm ô, đa số tối là ô đen
        let darkSamples = 0;
        for (const dy of [-0.2, 0, 0.2]) {
          for (const dx of [-0.2, 0, 0.2]) {
            const x = Math.round(minX + ((col + 0.5 + dx) * boxWidth) / CARD_CELLS);
            const y = Math.round(minY + ((row + 0.5 + dy) * boxHeight) / CARD_CELLS);
            if (dark[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))])
              darkSamples += 1;
          }
        }
        return darkSamples >= 5;
      }),
    );
    const decoded = decodeCard(grid);
    if (decoded && !found.has(decoded.number)) {
      found.set(decoded.number, { ...decoded, box: { x: minX, y: minY, width: boxWidth, height: boxHeight } });
    }
  }
  return [...found.values()].sort((left, right) => left.number - right.number);
}

// Gộp kết quả nhiều khung hình: mỗi số thẻ giữ đáp án đọc gần nhất (học sinh đổi ý thì lấy lần giơ sau)
export function mergeScans(previous: Record<number, CardAnswer>, scanned: ScannedCard[]): Record<number, CardAnswer> {
  const next = { ...previous };
  for (const card of scanned) {
    next[card.number] = card.answer;
  }
  return next;
}

import { evaluateExpression, ExpressionError } from './expression.ts';

// Vẽ đồ thị hàm số (DT-29 phần 29d, YCTD-328): lấy mẫu y = f(x) trên khung nhìn, ngắt nét khi hàm không xác định hoặc vọt ra ngoài
// khung (tiệm cận), đổi sang toạ độ SVG. Hàm thuần để kiểm thử bằng node --test
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
}

export function toScreen(viewport: Viewport, x: number, y: number): { left: number; top: number } {
  return {
    left: ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * viewport.width,
    top: ((viewport.yMax - y) / (viewport.yMax - viewport.yMin)) * viewport.height,
  };
}

// Đường nét của đồ thị dạng "M ... L ..."; điểm không xác định hoặc xa ngoài khung thì ngắt nét
export function plotPath(expression: string, viewport: Viewport, samples = 400): string {
  const span = viewport.yMax - viewport.yMin;
  let path = '';
  let drawing = false;
  for (let index = 0; index <= samples; index += 1) {
    const x = viewport.xMin + ((viewport.xMax - viewport.xMin) * index) / samples;
    let y: number;
    try {
      y = evaluateExpression(expression, { x, unit: 'rad' });
    } catch (error) {
      if (error instanceof ExpressionError) {
        drawing = false;
        continue;
      }
      throw error;
    }
    if (y > viewport.yMax + span || y < viewport.yMin - span) {
      drawing = false;
      continue;
    }
    const point = toScreen(viewport, x, y);
    path += `${drawing ? ' L' : ' M'} ${point.left.toFixed(1)} ${point.top.toFixed(1)}`;
    drawing = true;
  }
  return path.trim();
}

// Kiểm biểu thức trước khi vẽ: thử ở vài điểm; lỗi cú pháp thì trả thông báo, hàm chỉ không xác định ở vài điểm vẫn vẽ được
export function expressionProblem(expression: string): string | null {
  let lastError: string | null = null;
  for (const x of [0.5, 1.5, -1.5, 3, -3]) {
    try {
      evaluateExpression(expression, { x, unit: 'rad' });
      return null;
    } catch (error) {
      if (!(error instanceof ExpressionError)) {
        throw error;
      }
      lastError = error.message;
    }
  }
  return lastError;
}

// Bước của lưới và số trên trục: 1, 2, 5 × 10^n sao cho khoảng 5 đến 12 vạch
export function gridStep(span: number): number {
  const rough = span / 10;
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 5, 10]) {
    if (rough <= factor * power) {
      return factor * power;
    }
  }
  return 10 * power;
}

export function gridValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) {
    values.push(Number(value.toFixed(10)));
  }
  return values;
}

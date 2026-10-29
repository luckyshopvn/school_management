// Hình học động (DT-29 phần 29d, YCTD-328): tam giác ABC kéo được đỉnh, đo cạnh, góc, chu vi, diện tích; trọng tâm, trực tâm, tâm
// đường tròn ngoại tiếp, chân đường cao, trung điểm. Toạ độ theo đơn vị lưới. Không import gì
export interface Point {
  x: number;
  y: number;
}

export function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

// Góc tại đỉnh `vertex` (độ)
export function angleAt(vertex: Point, first: Point, second: Point): number {
  const a = { x: first.x - vertex.x, y: first.y - vertex.y };
  const b = { x: second.x - vertex.x, y: second.y - vertex.y };
  const lengths = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (lengths === 0) {
    return 0;
  }
  const cosine = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / lengths));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

export function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

export function centroid(a: Point, b: Point, c: Point): Point {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

// Chân đường vuông góc hạ từ `point` xuống đường thẳng qua `start`, `end`
export function foot(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return start;
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length;
  return { x: start.x + t * dx, y: start.y + t * dy };
}

// Tâm đường tròn ngoại tiếp; tam giác suy biến (ba điểm thẳng hàng) trả null
export function circumcenter(a: Point, b: Point, c: Point): Point | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) {
    return null;
  }
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

// Trực tâm H = A + B + C − 2O (O là tâm ngoại tiếp)
export function orthocenter(a: Point, b: Point, c: Point): Point | null {
  const o = circumcenter(a, b, c);
  return o ? { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y } : null;
}

// Phân loại tam giác theo góc và cạnh (sai số nhỏ để kéo bằng tay vẫn nhận ra tam giác vuông, cân)
export function classifyTriangle(a: Point, b: Point, c: Point): string[] {
  if (triangleArea(a, b, c) < 1e-6) {
    return ['Ba điểm thẳng hàng'];
  }
  const sides = [distance(b, c), distance(a, c), distance(a, b)].sort((left, right) => left - right);
  const angles = [angleAt(a, b, c), angleAt(b, a, c), angleAt(c, a, b)];
  const largest = Math.max(...angles);
  const labels: string[] = [];
  labels.push(Math.abs(largest - 90) < 0.5 ? 'vuông' : largest > 90 ? 'tù' : 'nhọn');
  const [shortest = 0, middle = 0, longest = 0] = sides;
  const near = (left: number, right: number) => Math.abs(left - right) < 0.02 * Math.max(left, right);
  if (near(shortest, longest)) {
    return ['Tam giác đều'];
  }
  if (near(shortest, middle) || near(middle, longest)) {
    labels.push('cân');
  }
  return [`Tam giác ${labels.join(', ')}`];
}

// Làm tròn về lưới khi kéo (bước 0,5 đơn vị)
export function snap(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

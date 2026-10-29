import { useState } from 'react';
import { Button } from '@school-management/ui';
import { randomInteger } from './mini-logic.ts';

// Hình và màu (DT-29 phần 29b, YCTD-326; Mầm non): giáo viên chọn hình, màu, chiếu hình to cho trẻ gọi tên; ẩn tên để hỏi "Đây là
// hình gì, màu gì?", chọn ngẫu nhiên. Hình tự vẽ bằng SVG, chạy trên máy
const SHAPES = [
  { name: 'Hình tròn', path: 'M50 8 A42 42 0 1 1 49.99 8 Z' },
  { name: 'Hình vuông', path: 'M12 12 H88 V88 H12 Z' },
  { name: 'Hình tam giác', path: 'M50 8 L92 88 H8 Z' },
  { name: 'Hình chữ nhật', path: 'M4 26 H96 V74 H4 Z' },
  {
    name: 'Ngôi sao',
    path: 'M50 8 L60.58 37.44 L91.85 38.4 L67.12 57.56 L75.86 87.6 L50 70 L24.14 87.6 L32.88 57.56 L8.15 38.4 L39.42 37.44 Z',
  },
  {
    name: 'Trái tim',
    path: 'M50 88 C20 66 6 50 6 32 C6 18 17 9 29 9 C38 9 46 14 50 22 C54 14 62 9 71 9 C83 9 94 18 94 32 C94 50 80 66 50 88 Z',
  },
];
const COLORS = [
  { name: 'đỏ', value: '#dc2626' },
  { name: 'vàng', value: '#facc15' },
  { name: 'xanh lá', value: '#16a34a' },
  { name: 'xanh dương', value: '#2563eb' },
  { name: 'cam', value: '#f97316' },
  { name: 'tím', value: '#7c3aed' },
];
type Mode = 'shape' | 'color' | 'both';
const MODES: Array<{ key: Mode; label: string; question: string }> = [
  { key: 'shape', label: 'Gọi tên hình', question: 'Đây là hình gì?' },
  { key: 'color', label: 'Gọi tên màu', question: 'Đây là màu gì?' },
  { key: 'both', label: 'Cả hai', question: 'Hình gì, màu gì?' },
];

export function ShapesColorsTool() {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(3);
  const [mode, setMode] = useState<Mode>('both');
  const [showName, setShowName] = useState(true);
  const shape = SHAPES[shapeIndex] ?? SHAPES[0];
  const color = COLORS[colorIndex] ?? COLORS[0];
  if (!shape || !color) {
    return null;
  }
  const name =
    mode === 'shape' ? shape.name : mode === 'color' ? `Màu ${color.name}` : `${shape.name} màu ${color.name}`;
  const question = MODES.find((item) => item.key === mode)?.question ?? '';
  const tile = (selected: boolean) =>
    `flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg p-2 text-label ${
      selected ? 'border-2 border-brand bg-selected' : 'border border-border bg-card'
    }`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section
        aria-label="Hình chiếu cho trẻ"
        className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-6"
      >
        <svg role="img" aria-label={showName ? name : question} width="260" height="260" viewBox="0 0 100 100">
          <path d={shape.path} fill={color.value} stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <p className={`text-center text-4xl font-bold ${showName ? 'text-text' : 'text-text-secondary'}`}>
          {showName ? name : question}
        </p>
      </section>
      <aside className="flex flex-col gap-4 lg:w-96">
        <div role="group" aria-label="Chế độ" className="grid grid-cols-3 gap-1">
          {MODES.map((item) => (
            <Button
              key={item.key}
              aria-pressed={mode === item.key}
              className={mode === item.key ? 'border-brand bg-selected' : ''}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Chọn hình" className="grid grid-cols-3 gap-2">
          {SHAPES.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === shapeIndex}
              onClick={() => {
                setShapeIndex(index);
                setShowName(true);
              }}
              className={tile(index === shapeIndex)}
            >
              <svg aria-hidden="true" width="36" height="36" viewBox="0 0 100 100">
                <path d={item.path} fill="#cbd5e1" stroke="#334155" strokeWidth="4" strokeLinejoin="round" />
              </svg>
              {item.name}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Chọn màu" className="grid grid-cols-3 gap-2">
          {COLORS.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === colorIndex}
              onClick={() => {
                setColorIndex(index);
                setShowName(true);
              }}
              className={tile(index === colorIndex)}
            >
              <span
                aria-hidden="true"
                className="h-7 w-7 rounded-full border border-text-secondary"
                style={{ backgroundColor: item.value }}
              />
              Màu {item.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              setShapeIndex(randomInteger(0, SHAPES.length - 1));
              setColorIndex(randomInteger(0, COLORS.length - 1));
              setShowName(false);
            }}
          >
            Chọn ngẫu nhiên
          </Button>
          <Button className="flex-1" onClick={() => setShowName(!showName)}>
            {showName ? 'Ẩn tên để hỏi' : 'Hiện tên'}
          </Button>
        </div>
      </aside>
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@school-management/ui';
import { ruledLines } from './primary-logic.ts';

// Bảng trắng (DT-29 phần 29b, YCTD-326): viết, vẽ bằng ngón tay, bút cảm ứng hoặc chuột; chọn màu, nét, tẩy, xóa bảng. Nét vẽ chỉ
// nằm trên máy trong lúc mở công cụ, không lưu, không gửi đi. Khung ô li (DT-29 phần 29c, YCTD-327; Tiểu học) là bảng trắng có kẻ
// dòng như vở ô li nằm dưới lớp vẽ để giáo viên viết mẫu
const COLORS = [
  { name: 'Đen', value: '#0f172a' },
  { name: 'Xanh dương', value: '#1d4ed8' },
  { name: 'Đỏ', value: '#dc2626' },
  { name: 'Xanh lá', value: '#15803d' },
  { name: 'Cam', value: '#ea580c' },
];
const WIDTHS = [
  { name: 'Nét mảnh', value: 3 },
  { name: 'Nét vừa', value: 6 },
  { name: 'Nét đậm', value: 12 },
];

// Kẻ ô li trên khổ 160 × 100 (đúng tỉ lệ 16:10 của bảng), mỗi ô li 2,5 đơn vị
const RULED = ruledLines(160, 100, 2.5);

export function WhiteboardTool({ ruled = false }: { ruled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]?.value ?? '#0f172a');
  const [width, setWidth] = useState(6);
  const [erasing, setErasing] = useState(false);

  // Bảng theo bề rộng khung, giữ tỉ lệ 16:10; vẽ ở độ phân giải của màn hình để nét không mờ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const { width: cssWidth } = canvas.getBoundingClientRect();
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssWidth * 0.625 * ratio);
    const context = canvas.getContext('2d');
    context?.scale(ratio, ratio);
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }
    context.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    context.strokeStyle = color;
    context.lineWidth = erasing ? width * 3 : width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Màu bút" className="flex gap-1">
          {COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-label={item.name}
              aria-pressed={!erasing && color === item.value}
              onClick={() => {
                setColor(item.value);
                setErasing(false);
              }}
              className={`h-11 w-11 rounded-full border-4 ${!erasing && color === item.value ? 'border-brand' : 'border-card'}`}
              style={{ backgroundColor: item.value }}
            />
          ))}
        </div>
        <div role="group" aria-label="Độ dày nét" className="flex gap-1">
          {WIDTHS.map((item) => (
            <Button
              key={item.value}
              aria-pressed={width === item.value}
              className={width === item.value ? 'border-brand bg-selected' : ''}
              onClick={() => setWidth(item.value)}
            >
              {item.name}
            </Button>
          ))}
        </div>
        <Button
          aria-pressed={erasing}
          className={erasing ? 'border-brand bg-selected' : ''}
          onClick={() => setErasing(!erasing)}
        >
          Tẩy
        </Button>
        <Button onClick={clear}>Xóa bảng</Button>
      </div>
      <div className="relative">
        {ruled ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 160 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full rounded-xl bg-white"
          >
            {RULED.map((line, index) => (
              <line
                key={index}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.bold ? '#7c3aed' : '#c4b5fd'}
                strokeWidth={line.bold ? 0.35 : 0.15}
              />
            ))}
          </svg>
        ) : null}
        <canvas
          ref={canvasRef}
          aria-label={ruled ? 'Khung ô li' : 'Bảng trắng'}
          className={`relative aspect-[16/10] w-full touch-none rounded-xl border border-border ${ruled ? 'bg-transparent' : 'bg-white'}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            last.current = point(event);
            stroke(last.current, last.current);
          }}
          onPointerMove={(event) => {
            if (!last.current) {
              return;
            }
            const next = point(event);
            stroke(last.current, next);
            last.current = next;
          }}
          onPointerUp={() => {
            last.current = null;
          }}
          onPointerCancel={() => {
            last.current = null;
          }}
        />
      </div>
    </div>
  );
}

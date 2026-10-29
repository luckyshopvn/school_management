import { useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { expressionProblem, gridStep, gridValues, plotPath, toScreen, type Viewport } from './graph-logic.ts';

// Vẽ đồ thị hàm số (DT-29 phần 29d, YCTD-328; THCS, THPT): nhập tối đa ba hàm y = f(x) (biến x, hàm lượng giác theo radian), phóng
// to, thu nhỏ, đặt lại khung nhìn. Bộ tính tự viết, chạy trên máy
const COLORS = ['#1d4ed8', '#c2410c', '#15803d'];
const SIZE = 480;
const EXAMPLES = ['2x + 1', 'x^2 - 2x - 3', 'sin(x)', '1/x', 'sqrt(x)'];

export function GraphTool() {
  const [functions, setFunctions] = useState(['x^2 - 2x - 3', '', '']);
  const [half, setHalf] = useState(10);
  const viewport: Viewport = { xMin: -half, xMax: half, yMin: -half, yMax: half, width: SIZE, height: SIZE };
  const step = gridStep(2 * half);
  const ticks = gridValues(-half, half, step).filter((value) => value !== 0);
  const origin = toScreen(viewport, 0, 0);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section aria-label="Hàm số" className="flex flex-col gap-3 lg:w-80">
        {functions.map((value, index) => {
          const problem = value.trim() ? expressionProblem(value) : null;
          return (
            <div key={index} className="flex flex-col gap-1">
              <TextField
                label={`Hàm ${index + 1}: y =`}
                value={value}
                autoComplete="off"
                onChange={(event) =>
                  setFunctions((previous) =>
                    previous.map((item, position) => (position === index ? event.target.value : item)),
                  )
                }
                style={{ borderColor: COLORS[index] }}
              />
              {problem ? <Alert tone="warning">{problem}</Alert> : null}
            </div>
          );
        })}
        <p className="text-label text-text-secondary">Ví dụ: {EXAMPLES.join('; ')}. Lượng giác tính theo radian.</p>
        <div className="flex gap-2">
          <Button aria-label="Phóng to" onClick={() => setHalf((value) => Math.max(1, value / 2))}>
            Phóng to
          </Button>
          <Button aria-label="Thu nhỏ" onClick={() => setHalf((value) => Math.min(1000, value * 2))}>
            Thu nhỏ
          </Button>
          <Button onClick={() => setHalf(10)}>Đặt lại</Button>
        </div>
        <p className="text-label text-text-secondary">
          Khung nhìn: x và y từ −{half} đến {half}
        </p>
      </section>
      <section aria-label="Đồ thị" className="flex flex-1 justify-center rounded-xl border border-border bg-card p-3">
        <svg
          role="img"
          aria-label={`Đồ thị ${functions
            .filter((item) => item.trim())
            .map((item) => `y = ${item}`)
            .join(', ')}`}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full max-w-[480px]"
        >
          {ticks.map((value) => {
            const point = toScreen(viewport, value, value);
            return (
              <g key={value}>
                <line x1={point.left} y1="0" x2={point.left} y2={SIZE} stroke="#e2e8f0" />
                <line x1="0" y1={point.top} x2={SIZE} y2={point.top} stroke="#e2e8f0" />
                <text x={point.left} y={origin.top + 14} fontSize="11" textAnchor="middle" fill="#475569">
                  {value}
                </text>
                <text x={origin.left - 6} y={point.top + 4} fontSize="11" textAnchor="end" fill="#475569">
                  {value}
                </text>
              </g>
            );
          })}
          <line x1="0" y1={origin.top} x2={SIZE} y2={origin.top} stroke="#334155" strokeWidth="1.5" />
          <line x1={origin.left} y1="0" x2={origin.left} y2={SIZE} stroke="#334155" strokeWidth="1.5" />
          <text x={SIZE - 8} y={origin.top - 6} fontSize="13" textAnchor="end" fontStyle="italic" fill="#0f172a">
            x
          </text>
          <text x={origin.left + 8} y="14" fontSize="13" fontStyle="italic" fill="#0f172a">
            y
          </text>
          {functions.map((value, index) =>
            value.trim() && !expressionProblem(value) ? (
              <path
                key={index}
                d={plotPath(value, viewport)}
                stroke={COLORS[index]}
                strokeWidth="2.5"
                fill="none"
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </svg>
      </section>
    </div>
  );
}

import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@school-management/ui';
import {
  angleAt,
  centroid,
  circumcenter,
  classifyTriangle,
  distance,
  foot,
  midpoint,
  orthocenter,
  snap,
  triangleArea,
  type Point,
} from './geometry.ts';

// Hình học động (DT-29 phần 29d, YCTD-328; THCS, THPT): tam giác ABC kéo được đỉnh trên lưới, hiện độ dài cạnh, số đo góc, chu
// vi, diện tích, loại tam giác; bật tắt đường trung tuyến và trọng tâm, đường cao và trực tâm, đường tròn ngoại tiếp. Chạy trên máy
const SIZE = 480;
const UNITS = 12;
const SCALE = SIZE / UNITS;
const START: Record<'A' | 'B' | 'C', Point> = { A: { x: 3, y: 9 }, B: { x: 2, y: 2 }, C: { x: 10, y: 3 } };
type Vertex = keyof typeof START;
const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const screen = (point: Point) => ({ x: point.x * SCALE, y: SIZE - point.y * SCALE });

export function GeometryTool() {
  const [points, setPoints] = useState(START);
  const [medians, setMedians] = useState(true);
  const [altitudes, setAltitudes] = useState(false);
  const [circle, setCircle] = useState(false);
  const dragging = useRef<Vertex | null>(null);
  const { A, B, C } = points;

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const vertex = dragging.current;
    if (!vertex) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = snap(((event.clientX - box.left) / box.width) * UNITS);
    const y = snap(UNITS - ((event.clientY - box.top) / box.height) * UNITS);
    setPoints((previous) => ({
      ...previous,
      [vertex]: { x: Math.max(0, Math.min(UNITS, x)), y: Math.max(0, Math.min(UNITS, y)) },
    }));
  };
  const nudge = (vertex: Vertex, dx: number, dy: number) =>
    setPoints((previous) => ({
      ...previous,
      [vertex]: {
        x: Math.max(0, Math.min(UNITS, previous[vertex].x + dx)),
        y: Math.max(0, Math.min(UNITS, previous[vertex].y + dy)),
      },
    }));

  const g = centroid(A, B, C);
  const h = orthocenter(A, B, C);
  const o = circumcenter(A, B, C);
  const sides = { a: distance(B, C), b: distance(A, C), c: distance(A, B) };
  const line = (from: Point, to: Point, color: string, dashed = false) => {
    const start = screen(from);
    const end = screen(to);
    return (
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashed ? '6 4' : undefined}
      />
    );
  };
  const dot = (point: Point | null, label: string, color: string) => {
    if (!point) {
      return null;
    }
    const at = screen(point);
    return (
      <g>
        <circle cx={at.x} cy={at.y} r="4" fill={color} />
        <text x={at.x + 6} y={at.y - 6} fontSize="14" fill={color} fontWeight="700">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section aria-label="Hình vẽ" className="flex flex-1 justify-center rounded-xl border border-border bg-card p-3">
        <svg
          role="img"
          aria-label={`Tam giác ABC: AB = ${number(sides.c)}, BC = ${number(sides.a)}, CA = ${number(sides.b)}`}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full max-w-[480px] touch-none"
          onPointerMove={move}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onPointerLeave={() => {
            dragging.current = null;
          }}
        >
          {Array.from({ length: UNITS + 1 }, (_, index) => (
            <g key={index}>
              <line x1={index * SCALE} y1="0" x2={index * SCALE} y2={SIZE} stroke="#e2e8f0" />
              <line x1="0" y1={index * SCALE} x2={SIZE} y2={index * SCALE} stroke="#e2e8f0" />
            </g>
          ))}
          <polygon
            points={[A, B, C].map((point) => `${screen(point).x},${screen(point).y}`).join(' ')}
            fill="#dbeafe"
            stroke="#1d4ed8"
            strokeWidth="2.5"
          />
          {medians ? (
            <>
              {line(A, midpoint(B, C), '#15803d', true)}
              {line(B, midpoint(A, C), '#15803d', true)}
              {line(C, midpoint(A, B), '#15803d', true)}
              {dot(g, 'G', '#15803d')}
            </>
          ) : null}
          {altitudes ? (
            <>
              {line(A, foot(A, B, C), '#c2410c', true)}
              {line(B, foot(B, A, C), '#c2410c', true)}
              {line(C, foot(C, A, B), '#c2410c', true)}
              {dot(h, 'H', '#c2410c')}
            </>
          ) : null}
          {circle && o ? (
            <>
              <circle
                cx={screen(o).x}
                cy={screen(o).y}
                r={distance(o, A) * SCALE}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
              />
              {dot(o, 'O', '#7c3aed')}
            </>
          ) : null}
          {(Object.keys(points) as Vertex[]).map((vertex) => {
            const at = screen(points[vertex]);
            return (
              <g
                key={vertex}
                onPointerDown={(event) => {
                  dragging.current = vertex;
                  (event.currentTarget.ownerSVGElement ?? event.currentTarget).setPointerCapture?.(event.pointerId);
                }}
                className="cursor-grab"
              >
                <circle cx={at.x} cy={at.y} r="14" fill="transparent" />
                <circle cx={at.x} cy={at.y} r="7" fill="#0f172a" />
                <text x={at.x + 10} y={at.y + 18} fontSize="18" fontWeight="700" fill="#0f172a">
                  {vertex}
                </text>
              </g>
            );
          })}
        </svg>
      </section>
      <aside className="flex flex-col gap-3 lg:w-80">
        <p className="text-content font-semibold text-text">{classifyTriangle(A, B, C).join('; ')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-border bg-card p-3 text-content">
          <dt className="text-text-secondary">AB, BC, CA</dt>
          <dd className="font-semibold tabular-nums">
            {number(sides.c)}; {number(sides.a)}; {number(sides.b)}
          </dd>
          <dt className="text-text-secondary">Góc A, B, C</dt>
          <dd className="font-semibold tabular-nums">
            {number(angleAt(A, B, C))}°; {number(angleAt(B, A, C))}°; {number(angleAt(C, A, B))}°
          </dd>
          <dt className="text-text-secondary">Chu vi</dt>
          <dd className="font-semibold tabular-nums">{number(sides.a + sides.b + sides.c)}</dd>
          <dt className="text-text-secondary">Diện tích</dt>
          <dd className="font-semibold tabular-nums">{number(triangleArea(A, B, C))}</dd>
        </dl>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={medians} onChange={(event) => setMedians(event.target.checked)} />
          Đường trung tuyến, trọng tâm G
        </label>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={altitudes} onChange={(event) => setAltitudes(event.target.checked)} />
          Đường cao, trực tâm H
        </label>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={circle} onChange={(event) => setCircle(event.target.checked)} />
          Đường tròn ngoại tiếp, tâm O
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-label font-medium text-text">Dời đỉnh bằng nút (0,5 đơn vị)</legend>
          {(Object.keys(points) as Vertex[]).map((vertex) => (
            <div key={vertex} className="flex items-center gap-1">
              <span className="w-6 font-bold">{vertex}</span>
              <Button aria-label={`Dời ${vertex} sang trái`} onClick={() => nudge(vertex, -0.5, 0)}>
                ←
              </Button>
              <Button aria-label={`Dời ${vertex} sang phải`} onClick={() => nudge(vertex, 0.5, 0)}>
                →
              </Button>
              <Button aria-label={`Dời ${vertex} lên`} onClick={() => nudge(vertex, 0, 0.5)}>
                ↑
              </Button>
              <Button aria-label={`Dời ${vertex} xuống`} onClick={() => nudge(vertex, 0, -0.5)}>
                ↓
              </Button>
            </div>
          ))}
        </fieldset>
        <Button onClick={() => setPoints(START)}>Đặt lại hình</Button>
      </aside>
    </div>
  );
}

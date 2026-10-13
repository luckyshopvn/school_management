import type { ChildGrowth, CurvePoint } from './growth-api.js';

// Biểu đồ tăng trưởng của một học sinh (4.3.1): đường chuẩn WHO trung vị, ±2SD, ±3SD theo tháng tuổi và các lần đo. Vẽ
// bằng SVG, không dùng thư viện biểu đồ
const WIDTH = 520;
const HEIGHT = 260;
const PADDING = { left: 44, right: 12, top: 12, bottom: 32 };

function Chart({
  title,
  unit,
  curve,
  points,
}: {
  title: string;
  unit: string;
  curve: CurvePoint[];
  points: Array<{ month: number; value: number }>;
}) {
  if (curve.length === 0) {
    return null;
  }
  const months = curve.map((point) => point.month);
  const minMonth = Math.min(...months);
  const maxMonth = Math.max(...months);
  const values = [...curve.flatMap((point) => [point.minus3, point.plus3]), ...points.map((point) => point.value)];
  const minValue = Math.floor(Math.min(...values));
  const maxValue = Math.ceil(Math.max(...values));
  const x = (month: number) =>
    PADDING.left + ((month - minMonth) / Math.max(1, maxMonth - minMonth)) * (WIDTH - PADDING.left - PADDING.right);
  const y = (value: number) =>
    HEIGHT -
    PADDING.bottom -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * (HEIGHT - PADDING.top - PADDING.bottom);
  const line = (key: keyof Omit<CurvePoint, 'month'>) =>
    curve.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.month)},${y(point[key])}`).join(' ');
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-label font-medium text-text">{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-[520px]" role="img" aria-label={title}>
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={HEIGHT - PADDING.bottom}
          y2={HEIGHT - PADDING.bottom}
          stroke="currentColor"
          opacity={0.3}
        />
        <line
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={HEIGHT - PADDING.bottom}
          stroke="currentColor"
          opacity={0.3}
        />
        <path d={line('minus3')} fill="none" stroke="#b91c1c" strokeWidth={1} />
        <path d={line('minus2')} fill="none" stroke="#d97706" strokeWidth={1} />
        <path d={line('median')} fill="none" stroke="#15803d" strokeWidth={1.5} />
        <path d={line('plus2')} fill="none" stroke="#d97706" strokeWidth={1} />
        <path d={line('plus3')} fill="none" stroke="#b91c1c" strokeWidth={1} />
        {points.map((point, index) => (
          <circle key={index} cx={x(point.month)} cy={y(point.value)} r={4} fill="#1d4ed8" />
        ))}
        <text x={PADDING.left} y={HEIGHT - 8} fontSize={11} fill="currentColor">
          {minMonth} tháng
        </text>
        <text x={WIDTH - PADDING.right} y={HEIGHT - 8} fontSize={11} fill="currentColor" textAnchor="end">
          {maxMonth} tháng
        </text>
        <text x={4} y={PADDING.top + 8} fontSize={11} fill="currentColor">
          {maxValue} {unit}
        </text>
        <text x={4} y={HEIGHT - PADDING.bottom} fontSize={11} fill="currentColor">
          {minValue}
        </text>
      </svg>
    </figure>
  );
}

export function GrowthChart({ data }: { data: ChildGrowth }) {
  const months = (date: string) => {
    const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${data.child.dob}T00:00:00Z`)) / 86_400_000;
    return days / 30.4375;
  };
  const weights = data.points
    .filter((point) => point.weight_kg !== null)
    .map((point) => ({ month: months(point.measured_on), value: point.weight_kg ?? 0 }));
  const heights = data.points
    .filter((point) => point.height_cm !== null)
    .map((point) => ({ month: months(point.measured_on), value: point.height_cm ?? 0 }));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-text-secondary">
        Đường xanh lá là trung vị, cam là ±2SD, đỏ là ±3SD theo chuẩn WHO; chấm xanh là các lần đo.
      </p>
      <div className="flex flex-wrap gap-6">
        <Chart title="Cân nặng theo tuổi" unit="kg" curve={data.curves.weight_for_age} points={weights} />
        <Chart title="Chiều cao theo tuổi" unit="cm" curve={data.curves.height_for_age} points={heights} />
      </div>
    </div>
  );
}

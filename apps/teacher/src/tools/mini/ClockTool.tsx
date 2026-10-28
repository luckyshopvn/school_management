import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@school-management/ui';
import { clockHandAngles, minutesFromAngle, readTime } from './primary-logic.ts';

// Học xem đồng hồ (DT-29 phần 29c, YCTD-327; Tiểu học): đồng hồ kim tự vẽ, kéo kim phút (kim giờ chạy theo) hoặc bấm nút đổi giờ,
// phút; ẩn giờ để hỏi "Đồng hồ chỉ mấy giờ?". Chạy trên máy
const STEPS = [
  { label: 'Từng giờ', minutes: 60 },
  { label: '30 phút', minutes: 30 },
  { label: '15 phút', minutes: 15 },
  { label: '5 phút', minutes: 5 },
];

export function ClockTool() {
  const [hours, setHours] = useState(7);
  const [minutes, setMinutes] = useState(0);
  const [step, setStep] = useState(15);
  const [showTime, setShowTime] = useState(true);
  const [style, setStyle] = useState<'plain' | 'before'>('plain');
  const dragging = useRef(false);
  const angles = clockHandAngles(hours, minutes);

  const shift = (delta: number) => {
    const total = (((hours * 60 + minutes + delta) % 720) + 720) % 720;
    setHours(Math.floor(total / 60));
    setMinutes(total % 60);
  };
  const dragTo = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    const angle = (Math.atan2(x, -y) * 180) / Math.PI;
    const next = minutesFromAngle(angle, Math.min(step, 30));
    // Kim phút qua số 12 thì kim giờ sang giờ kế tiếp hoặc lùi giờ trước
    if (minutes >= 45 && next <= 15) {
      setHours((hours + 1) % 12);
    } else if (minutes <= 15 && next >= 45) {
      setHours((hours + 11) % 12);
    }
    setMinutes(next);
  };
  const random = () => {
    const unit = Math.min(step, 60);
    const slots = (12 * 60) / unit;
    const total = Math.floor(Math.random() * slots) * unit;
    setHours(Math.floor(total / 60));
    setMinutes(total % 60);
    setShowTime(false);
  };
  const time = readTime(hours, minutes, style);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section
        aria-label="Đồng hồ"
        className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-border bg-card p-4"
      >
        <svg
          role="img"
          aria-label={showTime ? `Đồng hồ chỉ ${time}` : 'Đồng hồ chỉ mấy giờ?'}
          width="300"
          height="300"
          viewBox="0 0 200 200"
          className="touch-none"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragTo(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) {
              dragTo(event);
            }
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
        >
          <circle cx="100" cy="100" r="94" fill="#ffffff" stroke="#334155" strokeWidth="4" />
          {Array.from({ length: 60 }, (_, tick) => (
            <line
              key={tick}
              x1="100"
              y1={tick % 5 === 0 ? 12 : 10}
              x2="100"
              y2={tick % 5 === 0 ? 22 : 16}
              stroke="#334155"
              strokeWidth={tick % 5 === 0 ? 3 : 1}
              transform={`rotate(${tick * 6} 100 100)`}
            />
          ))}
          {Array.from({ length: 12 }, (_, index) => {
            const number = index + 1;
            const angle = (number * 30 * Math.PI) / 180;
            return (
              <text
                key={number}
                x={100 + 64 * Math.sin(angle)}
                y={100 - 64 * Math.cos(angle) + 7}
                textAnchor="middle"
                fontSize="20"
                fontWeight="700"
                fill="#0f172a"
              >
                {number}
              </text>
            );
          })}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="52"
            stroke="#0f172a"
            strokeWidth="7"
            strokeLinecap="round"
            transform={`rotate(${angles.hour} 100 100)`}
          />
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="26"
            stroke="#1d4ed8"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(${angles.minute} 100 100)`}
          />
          <circle cx="100" cy="100" r="6" fill="#0f172a" />
        </svg>
        <p aria-live="polite" className="text-4xl font-bold text-text">
          {showTime ? time : 'Đồng hồ chỉ mấy giờ?'}
        </p>
      </section>
      <aside className="flex flex-col gap-3 lg:w-96">
        <div role="group" aria-label="Bước đổi phút" className="grid grid-cols-2 gap-2">
          {STEPS.map((item) => (
            <Button
              key={item.minutes}
              aria-pressed={step === item.minutes}
              className={step === item.minutes ? 'border-brand bg-selected' : ''}
              onClick={() => setStep(item.minutes)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => shift(-Math.min(step, 60))}>Lùi</Button>
          <Button onClick={() => shift(Math.min(step, 60))}>Tiến</Button>
        </div>
        <label className="flex items-center gap-2 text-content text-text">
          <input
            type="checkbox"
            checked={style === 'before'}
            onChange={(event) => setStyle(event.target.checked ? 'before' : 'plain')}
          />
          Đọc kiểu "kém" khi quá 30 phút
        </label>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={random}>
            Giờ ngẫu nhiên
          </Button>
          <Button className="flex-1" onClick={() => setShowTime(!showTime)}>
            {showTime ? 'Ẩn giờ để hỏi' : 'Hiện giờ'}
          </Button>
        </div>
        <p className="text-label text-text-secondary">Kéo kim phút trên mặt đồng hồ để đổi giờ.</p>
      </aside>
    </div>
  );
}

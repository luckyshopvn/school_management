import { useEffect, useState } from 'react';
import { Button } from '@school-management/ui';
import { formatClock } from '../classroom-logic.ts';
import { remainingArc, remainingFraction } from './mini-logic.ts';

// Đồng hồ hình ảnh (DT-29 phần 29b, YCTD-326): đĩa màu vơi dần theo thời gian còn lại để trẻ nhỏ nhìn là hiểu; giữ thời điểm kết
// thúc tuyệt đối như đồng hồ của 23b nên vẫn đúng khi màn hình tắt; hết giờ thì kêu ba tiếng ngắn. Chỉ trên máy, không lưu
const PRESETS = [1, 2, 3, 5, 10];

function chime() {
  try {
    const context = new AudioContext();
    [523, 659, 784].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(context.destination);
      const start = context.currentTime + index * 0.35;
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });
  } catch {
    // Trình duyệt chặn âm thanh: chỉ hiện chữ "Hết giờ"
  }
}

export function VisualTimerTool() {
  const [durationMs, setDurationMs] = useState(3 * 60_000);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endsAt]);

  useEffect(() => {
    if (endsAt !== null && now >= endsAt) {
      setEndsAt(null);
      setPausedMs(null);
      setDone(true);
      chime();
    }
  }, [endsAt, now]);

  const remainingMs = endsAt !== null ? Math.max(0, endsAt - now) : (pausedMs ?? (done ? 0 : durationMs));
  const fraction = endsAt !== null ? remainingFraction(endsAt, durationMs, now) : remainingMs / durationMs;
  const start = () => {
    const current = Date.now();
    setNow(current);
    setDone(false);
    setEndsAt(current + (pausedMs ?? durationMs));
    setPausedMs(null);
  };
  const pause = () => {
    if (endsAt !== null) {
      setPausedMs(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
    }
  };
  const reset = (minutes?: number) => {
    setEndsAt(null);
    setPausedMs(null);
    setDone(false);
    if (minutes) {
      setDurationMs(minutes * 60_000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Thời lượng">
        {PRESETS.map((minutes) => (
          <Button
            key={minutes}
            aria-pressed={durationMs === minutes * 60_000}
            className={durationMs === minutes * 60_000 ? 'border-brand bg-selected' : ''}
            onClick={() => reset(minutes)}
          >
            {minutes} phút
          </Button>
        ))}
      </div>
      <svg
        role="timer"
        aria-label={done ? 'Hết giờ' : `Còn ${formatClock(remainingMs, true)}`}
        width="280"
        height="280"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="45" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d={remainingArc(fraction)} fill={fraction > 0.25 ? '#16a34a' : '#ea580c'} />
        <circle cx="50" cy="50" r="2.5" fill="#334155" />
      </svg>
      <p className="text-4xl font-bold tabular-nums text-text" aria-hidden="true">
        {done ? 'Hết giờ' : formatClock(remainingMs, true)}
      </p>
      <div className="flex gap-2">
        {endsAt === null ? (
          <Button variant="primary" onClick={start}>
            {pausedMs !== null ? 'Chạy tiếp' : 'Bắt đầu'}
          </Button>
        ) : (
          <Button onClick={pause}>Tạm dừng</Button>
        )}
        <Button onClick={() => reset()}>Đặt lại</Button>
      </div>
    </div>
  );
}

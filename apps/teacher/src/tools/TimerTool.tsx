import { useEffect, useState } from 'react';
import { Button, TextField } from '@school-management/ui';
import { formatClock, remainingMilliseconds } from './classroom-logic.ts';

// Đếm ngược và bấm giờ (DT-23 phần 23b, YCTD-212): nhiều đồng hồ cùng chạy, tiếng báo hết giờ. Đồng hồ giữ thời điểm kết thúc
// (hoặc bắt đầu) tuyệt đối thay vì đếm từng nhịp nên vẫn đúng khi màn hình tắt, trang bị tạm dừng hoặc tải lại; giáo viên có
// thể giữ màn hình sáng để tiếng báo vang đúng lúc. Đồng hồ chỉ nằm trên máy, không gửi lên máy chủ
interface Clock {
  id: string;
  label: string;
  kind: 'countdown' | 'stopwatch';
  // Đếm ngược: thời lượng; bấm giờ: không dùng
  durationMs: number;
  // Đang chạy: thời điểm kết thúc (đếm ngược) hoặc bắt đầu (bấm giờ), tính theo Date.now()
  anchor: number | null;
  // Đang dừng: số mili giây còn lại (đếm ngược) hoặc đã chạy (bấm giờ)
  frozenMs: number;
  // Đã báo hết giờ
  alarmed: boolean;
}

const STORAGE_KEY = 'cong-cu-lop-hoc:dong-ho';
const PRESET_MINUTES = [1, 2, 5, 10];

function load(): Clock[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Clock[];
  } catch {
    return [];
  }
}

function elapsedOrRemaining(clock: Clock, now: number): number {
  if (clock.anchor === null) {
    return clock.frozenMs;
  }
  return clock.kind === 'countdown' ? remainingMilliseconds(clock.anchor, now) : Math.max(0, now - clock.anchor);
}

function beep() {
  try {
    const context = new AudioContext();
    for (let index = 0; index < 3; index += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(context.destination);
      const start = context.currentTime + index * 0.4;
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    }
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Trình duyệt chặn âm thanh: chỉ hiện chữ "Hết giờ"
  }
}

export function TimerTool() {
  const [clocks, setClocks] = useState<Clock[]>(load);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState('3');
  const [keepAwake, setKeepAwake] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clocks));
    } catch {
      // bỏ qua
    }
  }, [clocks]);

  // Nhịp cập nhật chỉ để vẽ lại; giá trị đúng luôn tính từ thời điểm tuyệt đối. Trang quay lại thì cập nhật ngay
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Đồng hồ đếm ngược chạm 0: báo một lần
  useEffect(() => {
    const due = clocks.filter(
      (clock) => clock.kind === 'countdown' && clock.anchor !== null && !clock.alarmed && clock.anchor <= now,
    );
    if (due.length === 0) {
      return;
    }
    beep();
    setClocks((previous) =>
      previous.map((clock) =>
        due.some((item) => item.id === clock.id) ? { ...clock, anchor: null, frozenMs: 0, alarmed: true } : clock,
      ),
    );
  }, [clocks, now]);

  useEffect(() => {
    if (!keepAwake || !('wakeLock' in navigator)) {
      return;
    }
    let sentinel: WakeLockSentinel | undefined;
    navigator.wakeLock
      .request('screen')
      .then((lock) => {
        sentinel = lock;
      })
      .catch(() => undefined);
    return () => {
      void sentinel?.release();
    };
  }, [keepAwake]);

  const update = (id: string, change: (clock: Clock) => Clock) =>
    setClocks((previous) => previous.map((clock) => (clock.id === id ? change(clock) : clock)));

  const addCountdown = (count: number) => {
    const durationMs = Math.round(count * 60_000);
    if (!(durationMs > 0) || durationMs > 12 * 3_600_000) {
      return;
    }
    setClocks((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        label: `Đếm ngược ${previous.filter((clock) => clock.kind === 'countdown').length + 1}`,
        kind: 'countdown',
        durationMs,
        anchor: null,
        frozenMs: durationMs,
        alarmed: false,
      },
    ]);
  };

  const addStopwatch = () =>
    setClocks((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        label: `Bấm giờ ${previous.filter((clock) => clock.kind === 'stopwatch').length + 1}`,
        kind: 'stopwatch',
        durationMs: 0,
        anchor: null,
        frozenMs: 0,
        alarmed: false,
      },
    ]);

  const start = (clock: Clock) =>
    update(clock.id, (item) => {
      const at = Date.now();
      const value = item.frozenMs;
      return {
        ...item,
        alarmed: false,
        anchor: item.kind === 'countdown' ? at + (value > 0 ? value : item.durationMs) : at - value,
      };
    });

  const pause = (clock: Clock) =>
    update(clock.id, (item) => ({ ...item, frozenMs: elapsedOrRemaining(item, Date.now()), anchor: null }));

  const reset = (clock: Clock) =>
    update(clock.id, (item) => ({
      ...item,
      anchor: null,
      frozenMs: item.kind === 'countdown' ? item.durationMs : 0,
      alarmed: false,
    }));

  const parsed = Number(minutes.replace(',', '.'));
  const validMinutes = parsed > 0 && parsed <= 720;

  return (
    <section aria-label="Đếm ngược và bấm giờ" className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESET_MINUTES.map((count) => (
          <Button key={count} onClick={() => addCountdown(count)}>
            Đếm ngược {count} phút
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label="Số phút tự chọn"
          inputMode="decimal"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          error={validMinutes ? undefined : 'Nhập số phút lớn hơn 0'}
        />
        <Button disabled={!validMinutes} onClick={() => addCountdown(parsed)}>
          Thêm đếm ngược
        </Button>
      </div>
      <Button onClick={addStopwatch}>Thêm đồng hồ bấm giờ</Button>
      {'wakeLock' in navigator ? (
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={keepAwake} onChange={(event) => setKeepAwake(event.target.checked)} />
          Giữ màn hình sáng để nghe tiếng báo hết giờ
        </label>
      ) : null}
      <ul aria-label="Các đồng hồ" className="flex flex-col gap-2">
        {clocks.map((clock) => {
          const value = elapsedOrRemaining(clock, now);
          const running = clock.anchor !== null;
          return (
            <li key={clock.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-label text-text-secondary">{clock.label}</span>
                {clock.alarmed ? <span className="text-label font-semibold text-danger">Hết giờ</span> : null}
              </div>
              <span
                role="timer"
                aria-label={`${clock.label}: ${formatClock(value, clock.kind === 'countdown')}`}
                className="text-page-title font-bold text-text"
              >
                {formatClock(value, clock.kind === 'countdown')}
              </span>
              <div className="flex gap-2">
                {running ? (
                  <Button aria-label={`Dừng ${clock.label}`} onClick={() => pause(clock)}>
                    Dừng
                  </Button>
                ) : (
                  <Button variant="primary" aria-label={`Chạy ${clock.label}`} onClick={() => start(clock)}>
                    Chạy
                  </Button>
                )}
                <Button aria-label={`Đặt lại ${clock.label}`} onClick={() => reset(clock)}>
                  Đặt lại
                </Button>
                <Button
                  variant="text"
                  aria-label={`Xóa ${clock.label}`}
                  onClick={() => setClocks((previous) => previous.filter((item) => item.id !== clock.id))}
                >
                  Xóa
                </Button>
              </div>
            </li>
          );
        })}
        {clocks.length === 0 ? <li className="text-label text-text-secondary">Chưa có đồng hồ nào</li> : null}
      </ul>
    </section>
  );
}

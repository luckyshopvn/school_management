import { useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { DICE_PIPS, drawNumber, numberRangeProblem, rollDice } from './mini-logic.ts';

// Xúc xắc và bốc số (DT-29 phần 29b, YCTD-326): tung một đến ba con xúc xắc; bốc số ngẫu nhiên trong khoảng tự đặt, tuỳ chọn
// không lặp. Chạy trên máy, không lưu
function Die({ value }: { value: number }) {
  const pips = DICE_PIPS[value] ?? [];
  return (
    <svg role="img" aria-label={`Mặt ${value}`} width="96" height="96" viewBox="0 0 90 90">
      <rect x="3" y="3" width="84" height="84" rx="14" fill="#ffffff" stroke="#334155" strokeWidth="4" />
      {pips.map((cell) => (
        <circle key={cell} cx={20 + (cell % 3) * 25} cy={20 + Math.floor(cell / 3) * 25} r="8" fill="#0f172a" />
      ))}
    </svg>
  );
}

export function DiceTool() {
  const [count, setCount] = useState(1);
  const [dice, setDice] = useState<number[]>([]);
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('30');
  const [noRepeat, setNoRepeat] = useState(true);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [message, setMessage] = useState<string>();

  const low = Number(min);
  const high = Number(max);
  const problem = numberRangeProblem(low, high);
  const draw = () => {
    if (problem) {
      return;
    }
    const value = drawNumber({ min: low, max: high, drawn }, noRepeat);
    if (value === null) {
      setMessage('Đã bốc hết các số trong khoảng');
      return;
    }
    setMessage(undefined);
    setDrawn((previous) => [...previous, value]);
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Xúc xắc" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Số con xúc xắc">
          {[1, 2, 3].map((value) => (
            <Button
              key={value}
              aria-pressed={value === count}
              className={value === count ? 'border-brand bg-selected' : ''}
              onClick={() => setCount(value)}
            >
              {value} con
            </Button>
          ))}
          <Button variant="primary" onClick={() => setDice(rollDice(count))}>
            Tung xúc xắc
          </Button>
        </div>
        <div aria-live="polite" className="flex min-h-24 flex-wrap items-center gap-4">
          {dice.map((value, index) => (
            <Die key={index} value={value} />
          ))}
          {dice.length > 1 ? (
            <p className="text-section-title font-semibold text-text">
              Tổng {dice.reduce((sum, value) => sum + value, 0)}
            </p>
          ) : null}
        </div>
      </section>
      <section aria-label="Bốc số" className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Từ số" inputMode="numeric" value={min} onChange={(event) => setMin(event.target.value)} />
          <TextField label="Đến số" inputMode="numeric" value={max} onChange={(event) => setMax(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={noRepeat} onChange={(event) => setNoRepeat(event.target.checked)} />
          Không bốc lặp lại
        </label>
        {problem ? <Alert tone="warning">{problem}</Alert> : null}
        {message ? <Alert tone="info">{message}</Alert> : null}
        <div className="flex gap-2">
          <Button onClick={draw} disabled={problem !== null}>
            Bốc số
          </Button>
          <Button
            onClick={() => {
              setDrawn([]);
              setMessage(undefined);
            }}
          >
            Bốc lại từ đầu
          </Button>
        </div>
        <p aria-live="polite" aria-label="Số vừa bốc" className="text-center text-6xl font-bold text-text">
          {drawn.length > 0 ? drawn[drawn.length - 1] : '–'}
        </p>
        {drawn.length > 1 ? <p className="text-label text-text-secondary">Đã bốc: {drawn.join(', ')}</p> : null}
      </section>
    </div>
  );
}

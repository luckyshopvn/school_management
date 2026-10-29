import { useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { circleSlice, fractionProblem, simplifyFraction } from './primary-logic.ts';

// Phân số trực quan (DT-29 phần 29c, YCTD-327; Tiểu học): chia hình tròn hoặc hình chữ nhật thành phần bằng nhau, tô số phần theo
// tử số; chạm một phần để tô hoặc bỏ tô; hiện phân số và phân số tối giản. Chạy trên máy
export function FractionTool() {
  const [numeratorText, setNumeratorText] = useState('3');
  const [denominatorText, setDenominatorText] = useState('4');
  const [shape, setShape] = useState<'circle' | 'bar'>('circle');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  const problem = fractionProblem(numerator, denominator);
  const parts = problem ? 1 : denominator;
  const filled = problem ? 0 : numerator;
  const [simpleNumerator, simpleDenominator] = problem ? [0, 1] : simplifyFraction(numerator, denominator);
  const toggle = (index: number) => {
    if (problem) {
      return;
    }
    setNumeratorText(String(index < filled ? index : index + 1));
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section
        aria-label="Hình phân số"
        className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-border bg-card p-4"
      >
        {shape === 'circle' ? (
          <svg
            role="img"
            aria-label={`Hình tròn chia ${parts} phần, tô ${filled} phần`}
            width="280"
            height="280"
            viewBox="0 0 100 100"
          >
            {Array.from({ length: parts }, (_, index) => (
              <path
                key={index}
                d={circleSlice(index, parts)}
                fill={index < filled ? '#f97316' : '#ffffff'}
                stroke="#334155"
                strokeWidth="1"
                onClick={() => toggle(index)}
              />
            ))}
          </svg>
        ) : (
          <svg
            role="img"
            aria-label={`Hình chữ nhật chia ${parts} phần, tô ${filled} phần`}
            width="100%"
            height="120"
            viewBox="0 0 240 60"
          >
            {Array.from({ length: parts }, (_, index) => (
              <rect
                key={index}
                x={2 + (index * 236) / parts}
                y="2"
                width={236 / parts}
                height="56"
                fill={index < filled ? '#f97316' : '#ffffff'}
                stroke="#334155"
                strokeWidth="1"
                onClick={() => toggle(index)}
              />
            ))}
          </svg>
        )}
        {problem ? null : (
          <p aria-live="polite" className="flex items-center gap-6 text-text">
            <span className="flex flex-col items-center text-5xl font-bold leading-tight">
              <span>{numerator}</span>
              <span aria-hidden="true" className="h-1 w-16 bg-text" />
              <span>{denominator}</span>
            </span>
            {simpleDenominator !== denominator ? (
              <span className="text-section-title">
                = {simpleNumerator}/{simpleDenominator} (tối giản)
              </span>
            ) : null}
          </p>
        )}
      </section>
      <aside className="flex flex-col gap-3 lg:w-80">
        <div role="group" aria-label="Hình" className="grid grid-cols-2 gap-2">
          <Button
            aria-pressed={shape === 'circle'}
            className={shape === 'circle' ? 'border-brand bg-selected' : ''}
            onClick={() => setShape('circle')}
          >
            Hình tròn
          </Button>
          <Button
            aria-pressed={shape === 'bar'}
            className={shape === 'bar' ? 'border-brand bg-selected' : ''}
            onClick={() => setShape('bar')}
          >
            Hình chữ nhật
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Tử số"
            inputMode="numeric"
            value={numeratorText}
            onChange={(event) => setNumeratorText(event.target.value)}
          />
          <TextField
            label="Mẫu số"
            inputMode="numeric"
            value={denominatorText}
            onChange={(event) => setDenominatorText(event.target.value)}
          />
        </div>
        {problem ? <Alert tone="warning">{problem}</Alert> : null}
        <p className="text-label text-text-secondary">Chạm vào một phần để tô hoặc bỏ tô.</p>
      </aside>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@school-management/ui';
import { randomInteger } from './mini-logic.ts';

// Đếm và số (DT-29 phần 29b, YCTD-326; Mầm non): hiện từ 1 đến 10 đồ vật tự vẽ, trẻ đếm, giáo viên chạm từng đồ vật để đánh dấu
// đã đếm; đếm đủ thì hiện chữ số và tên số. Chạy trên máy
const NUMBER_NAMES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
const OBJECTS = [
  { name: 'quả táo', color: '#dc2626' },
  { name: 'quả cam', color: '#f97316' },
  { name: 'bông hoa', color: '#db2777' },
  { name: 'chiếc lá', color: '#16a34a' },
];

function ObjectIcon({ kind, counted }: { kind: number; counted: boolean }) {
  const color = OBJECTS[kind]?.color ?? '#334155';
  return (
    <svg aria-hidden="true" width="72" height="72" viewBox="0 0 100 100" opacity={counted ? 0.35 : 1}>
      {kind === 2 ? (
        <>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx="50" cy="28" rx="14" ry="22" fill={color} transform={`rotate(${angle} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="12" fill="#facc15" />
        </>
      ) : kind === 3 ? (
        <path
          d="M50 8 C82 22 88 62 50 92 C12 62 18 22 50 8 Z M50 20 V86"
          fill={color}
          stroke="#14532d"
          strokeWidth="3"
        />
      ) : (
        <>
          <circle cx="50" cy="56" r="34" fill={color} />
          <path d="M50 22 C50 14 54 8 60 6" stroke="#78350f" strokeWidth="5" fill="none" />
          <ellipse cx="64" cy="16" rx="10" ry="5" fill="#16a34a" />
        </>
      )}
    </svg>
  );
}

export function CountingTool() {
  const [total, setTotal] = useState(5);
  const [kind, setKind] = useState(0);
  const [counted, setCounted] = useState<number[]>([]);
  const done = counted.length === total;
  const next = (value: number) => {
    setTotal(value);
    setCounted([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Số đồ vật">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <Button
            key={value}
            aria-pressed={value === total}
            className={value === total ? 'border-brand bg-selected' : ''}
            onClick={() => next(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Đồ vật">
        {OBJECTS.map((item, index) => (
          <Button
            key={item.name}
            aria-pressed={index === kind}
            className={index === kind ? 'border-brand bg-selected' : ''}
            onClick={() => {
              setKind(index);
              setCounted([]);
            }}
          >
            {item.name}
          </Button>
        ))}
        <Button
          variant="primary"
          onClick={() => {
            setKind(randomInteger(0, OBJECTS.length - 1));
            next(randomInteger(1, 10));
          }}
        >
          Câu khác
        </Button>
      </div>
      <ul
        aria-label="Đồ vật để đếm"
        className="flex flex-wrap justify-center gap-3 rounded-xl border border-border bg-card p-4"
      >
        {Array.from({ length: total }, (_, index) => (
          <li key={index}>
            <button
              type="button"
              aria-label={`${OBJECTS[kind]?.name ?? ''} thứ ${index + 1}${counted.includes(index) ? ', đã đếm' : ''}`}
              aria-pressed={counted.includes(index)}
              onClick={() =>
                setCounted((previous) =>
                  previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index],
                )
              }
              className="relative rounded-lg p-1"
            >
              <ObjectIcon kind={kind} counted={counted.includes(index)} />
              {counted.includes(index) ? (
                <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-text">
                  {counted.indexOf(index) + 1}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-center text-4xl font-bold text-text">
        {done ? `${total}: ${NUMBER_NAMES[total] ?? ''}` : `Đã đếm ${counted.length}`}
      </p>
    </div>
  );
}

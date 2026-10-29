import { useState } from 'react';
import { Button } from '@school-management/ui';
import { lowerLetter, randomInteger, VIETNAMESE_LETTERS } from './mini-logic.ts';

// Làm quen chữ cái (DT-29 phần 29b, YCTD-326; Mầm non): 29 chữ cái tiếng Việt, chạm một chữ để chiếu chữ in hoa và in thường cỡ
// lớn; chọn ngẫu nhiên để hỏi trẻ. Chữ hiển thị bằng phông của máy, không kèm âm thanh hay phông chữ có bản quyền
export function AlphabetTool() {
  const [index, setIndex] = useState(0);
  const letter = VIETNAMESE_LETTERS[index] ?? 'A';
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Chữ đang chiếu"
        className="flex items-center justify-center gap-10 rounded-xl border border-border bg-card p-6"
      >
        <span className="text-[9rem] font-bold leading-none text-text">{letter}</span>
        <span className="text-[9rem] font-bold leading-none text-brand">{lowerLetter(letter)}</span>
      </section>
      <div className="flex gap-2">
        <Button onClick={() => setIndex((index + VIETNAMESE_LETTERS.length - 1) % VIETNAMESE_LETTERS.length)}>
          Chữ trước
        </Button>
        <Button onClick={() => setIndex((index + 1) % VIETNAMESE_LETTERS.length)}>Chữ sau</Button>
        <Button variant="primary" onClick={() => setIndex(randomInteger(0, VIETNAMESE_LETTERS.length - 1))}>
          Chọn ngẫu nhiên
        </Button>
      </div>
      <div role="group" aria-label="Bảng chữ cái" className="grid grid-cols-6 gap-2 md:grid-cols-10">
        {VIETNAMESE_LETTERS.map((item, position) => (
          <button
            key={item}
            type="button"
            aria-pressed={position === index}
            onClick={() => setIndex(position)}
            className={`min-h-12 rounded-lg text-section-title font-bold ${
              position === index ? 'bg-brand text-white' : 'border border-border-strong bg-card text-text'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

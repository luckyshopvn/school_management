import { useState } from 'react';
import { TextField } from '@school-management/ui';
import {
  ELEMENT_CATEGORY_LABELS,
  ELEMENTS,
  findElements,
  type ChemicalElement,
  type ElementCategory,
} from './periodic-table.ts';

// Bảng tuần hoàn (DT-29 phần 29d, YCTD-328; THCS, THPT): 118 nguyên tố theo chu kì và nhóm, tô màu theo loại, chạm một ô để xem
// số hiệu, kí hiệu, tên, khối lượng nguyên tử, nhóm, chu kì; tìm theo kí hiệu, tên hoặc số hiệu. Dữ liệu nằm trong ứng dụng
const COLORS: Record<ElementCategory, string> = {
  alkali: '#fecaca',
  'alkaline-earth': '#fed7aa',
  transition: '#fef08a',
  'post-transition': '#d9f99d',
  metalloid: '#a7f3d0',
  nonmetal: '#bae6fd',
  halogen: '#c7d2fe',
  'noble-gas': '#e9d5ff',
  lanthanide: '#fbcfe8',
  actinide: '#f5d0fe',
};

function Cell({
  element,
  selected,
  dimmed,
  onSelect,
}: {
  element: ChemicalElement;
  selected: boolean;
  dimmed: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      aria-label={`${element.number} ${element.symbol} ${element.name}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded border text-text ${
        selected ? 'border-2 border-text' : 'border-border'
      } ${dimmed ? 'opacity-30' : ''}`}
      style={{ backgroundColor: COLORS[element.category] }}
    >
      <span className="text-[0.55rem] leading-none">{element.number}</span>
      <span className="text-xs font-bold leading-tight md:text-sm">{element.symbol}</span>
    </button>
  );
}

export function PeriodicTableTool() {
  const [selected, setSelected] = useState(26);
  const [query, setQuery] = useState('');
  const matches = new Set(findElements(query).map((element) => element.number));
  const element = ELEMENTS[selected - 1];
  const fBlock = (period: number) => ELEMENTS.filter((item) => item.group === null && item.period === period);
  const cell = (item: ChemicalElement) => (
    <Cell
      key={item.number}
      element={item}
      selected={item.number === selected}
      dimmed={query.trim() !== '' && !matches.has(item.number)}
      onSelect={() => setSelected(item.number)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <TextField
          label="Tìm nguyên tố (kí hiệu, tên, số hiệu)"
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            const first = findElements(event.target.value)[0];
            if (first && event.target.value.trim()) {
              setSelected(first.number);
            }
          }}
          className="md:w-80"
        />
        {element ? (
          <section
            aria-label="Nguyên tố đang chọn"
            aria-live="polite"
            className="flex flex-1 items-center gap-4 rounded-xl border border-border bg-card p-3"
          >
            <span
              className="flex h-20 w-20 flex-col items-center justify-center rounded-lg text-text"
              style={{ backgroundColor: COLORS[element.category] }}
            >
              <span className="text-label">{element.number}</span>
              <span className="text-3xl font-bold">{element.symbol}</span>
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-content">
              <dt className="text-text-secondary">Tên</dt>
              <dd className="font-semibold">{element.name}</dd>
              <dt className="text-text-secondary">Khối lượng nguyên tử</dt>
              <dd className="font-semibold">{element.mass}</dd>
              <dt className="text-text-secondary">Chu kì, nhóm</dt>
              <dd className="font-semibold">
                {element.period}, {element.group ?? (element.period === 6 ? 'họ lanthan' : 'họ actini')}
              </dd>
              <dt className="text-text-secondary">Loại</dt>
              <dd className="font-semibold">{ELEMENT_CATEGORY_LABELS[element.category]}</dd>
            </dl>
          </section>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <div
          role="group"
          aria-label="Bảng tuần hoàn"
          className="grid min-w-[640px] gap-0.5"
          style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 7 }, (_, row) =>
            Array.from({ length: 18 }, (_, column) => {
              const item = ELEMENTS.find((candidate) => candidate.period === row + 1 && candidate.group === column + 1);
              return item ? cell(item) : <span key={`${row}-${column}`} aria-hidden="true" />;
            }),
          )}
        </div>
        <div className="mt-2 grid min-w-[640px] gap-0.5" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
          {[6, 7].map((period) => [
            <span
              key={`label-${period}`}
              aria-hidden="true"
              className="col-span-3 self-center text-right text-label text-text-secondary"
            >
              {period === 6 ? 'Họ lanthan' : 'Họ actini'}
            </span>,
            ...fBlock(period).map(cell),
            <span key={`end-${period}`} aria-hidden="true" />,
          ])}
        </div>
      </div>
      <ul aria-label="Chú thích màu" className="flex flex-wrap gap-3 text-label text-text">
        {(Object.keys(ELEMENT_CATEGORY_LABELS) as ElementCategory[]).map((category) => (
          <li key={category} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded border border-border"
              style={{ backgroundColor: COLORS[category] }}
            />
            {ELEMENT_CATEGORY_LABELS[category]}
          </li>
        ))}
      </ul>
      <p className="text-label text-text-secondary">
        Khối lượng nguyên tử theo IUPAC; số trong ngoặc vuông là số khối của đồng vị bền nhất.
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Button } from '@school-management/ui';
import { readGrouping } from '../classroom-store.js';
import { changeStars, STAR_TARGETS } from './mini-logic.ts';

// Bảng thưởng sao (DT-29 phần 29b, YCTD-326): gắn sao cho từng nhóm, nhóm xếp theo thứ tự chia, không xếp hạng, không vào sổ điểm
// hay nề nếp. Nhóm lấy từ bản chia nhóm gần nhất của lớp (Chia nhóm), chưa chia thì bốn nhóm đánh số. Sao lưu trên máy theo lớp
// trong ngày, sang ngày mới bắt đầu lại
const PREFIX = 'cong-cu-lop-hoc:sao:';
const STAR =
  'M50 8 L60.58 37.44 L91.85 38.4 L67.12 57.56 L75.86 87.6 L50 70 L24.14 87.6 L32.88 57.56 L8.15 38.4 L39.42 37.44 Z';

interface StoredStars {
  day: string;
  target: number;
  counts: number[];
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function load(classId: string, size: number): StoredStars {
  try {
    const stored = JSON.parse(localStorage.getItem(`${PREFIX}${classId}`) ?? 'null') as StoredStars | null;
    if (stored && stored.day === today() && stored.counts.length === size) {
      return stored;
    }
  } catch {
    // bỏ qua
  }
  return { day: today(), target: 10, counts: Array.from({ length: size }, () => 0) };
}

export function StarBoardTool({ classId }: { classId: string }) {
  const groups = readGrouping(classId);
  const names = groups.length > 0 ? groups.map((group) => group.name) : ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4'];
  const [stars, setStars] = useState(() => load(classId, names.length));

  useEffect(() => {
    try {
      localStorage.setItem(`${PREFIX}${classId}`, JSON.stringify(stars));
    } catch {
      // bỏ qua
    }
  }, [classId, stars]);

  const change = (index: number, delta: number) =>
    setStars((previous) => ({ ...previous, counts: changeStars(previous.counts, index, delta, previous.target) }));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-label font-medium text-text">
        Mục tiêu
        <select
          aria-label="Mục tiêu số sao"
          value={stars.target}
          onChange={(event) => {
            const target = Number(event.target.value);
            setStars((previous) => ({
              ...previous,
              target,
              counts: previous.counts.map((count) => Math.min(count, target)),
            }));
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
        >
          {STAR_TARGETS.map((target) => (
            <option key={target} value={target}>
              {target} sao
            </option>
          ))}
        </select>
      </label>
      <ul aria-label="Các nhóm" className="grid gap-3 md:grid-cols-2">
        {names.map((name, index) => {
          const count = stars.counts[index] ?? 0;
          return (
            <li key={`${name}-${index}`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-section-title font-bold text-text">{name}</span>
                <span className="text-label text-text-secondary">
                  {count} trên {stars.target} sao
                </span>
                {count >= stars.target ? (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-label font-semibold text-success">
                    Đủ mục tiêu
                  </span>
                ) : null}
              </div>
              <div
                role="img"
                aria-label={`${name}: ${count} trên ${stars.target} sao`}
                className="flex flex-wrap gap-1"
              >
                {Array.from({ length: stars.target }, (_, position) => (
                  <svg key={position} aria-hidden="true" width="30" height="30" viewBox="0 0 100 100">
                    <path
                      d={STAR}
                      fill={position < count ? '#facc15' : '#ffffff'}
                      stroke={position < count ? '#a16207' : '#cbd5e1'}
                      strokeWidth="5"
                      strokeLinejoin="round"
                    />
                  </svg>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  aria-label={`Thêm một sao cho ${name}`}
                  onClick={() => change(index, 1)}
                >
                  Thêm sao
                </Button>
                <Button aria-label={`Bớt một sao của ${name}`} onClick={() => change(index, -1)}>
                  Bớt
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div>
        <Button onClick={() => setStars((previous) => ({ ...previous, counts: previous.counts.map(() => 0) }))}>
          Xóa bảng sao
        </Button>
      </div>
      <p className="text-label text-text-secondary">
        Sao chỉ lưu trên máy này trong ngày, không vào sổ điểm hay nề nếp.
      </p>
    </div>
  );
}

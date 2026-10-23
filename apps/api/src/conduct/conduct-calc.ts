// Tổng hợp nề nếp, xếp hạng thi đua lớp (DT-20 phần 20b, YCTD-159). Hàm thuần, không đọc cơ sở dữ liệu. Tuần tính từ thứ hai
// đến chủ nhật; điểm tuần của lớp là điểm nền cộng tổng điểm đã ghi trong tuần; tháng, học kỳ lấy trung bình điểm các tuần có
// thứ hai nằm trong kỳ (lớp chưa ghi gì trong tuần vẫn được điểm nền). Hạng xếp theo điểm giảm dần, bằng điểm cùng hạng.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const DAY_MILLISECONDS = 86_400_000;

export interface ConductPeriod {
  from: string;
  to: string;
  // Thứ hai của các tuần trong kỳ
  weeks: string[];
}

export interface ConductClassRow {
  class_id: string;
  class_name: string;
  grade_level: string;
}

export interface ConductEntryRow {
  class_id: string;
  entry_date: string;
  points: number;
}

export interface ConductRanking {
  class_id: string;
  class_name: string;
  grade_level: string;
  plus_points: number;
  minus_points: number;
  score: number;
  rank: number;
}

function parse(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function format(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const time = parse(date);
  const offset = (new Date(time).getUTCDay() + 6) % 7;
  return format(time - offset * DAY_MILLISECONDS);
}

// Kỳ tổng hợp: tuần chứa ngày, tháng chứa ngày, hoặc khoảng ngày cho trước (học kỳ)
export function conductPeriod(kind: 'week' | 'month' | 'range', date: string, range?: { from: string; to: string }) {
  let from: string;
  let to: string;
  if (kind === 'week') {
    from = mondayOf(date);
    to = format(parse(from) + 6 * DAY_MILLISECONDS);
  } else if (kind === 'month') {
    from = `${date.slice(0, 7)}-01`;
    const next = new Date(parse(from));
    next.setUTCMonth(next.getUTCMonth() + 1);
    to = format(next.getTime() - DAY_MILLISECONDS);
  } else {
    from = range?.from ?? date;
    to = range?.to ?? date;
  }
  const weeks: string[] = [];
  for (let monday = parse(mondayOf(from)); monday <= parse(to); monday += 7 * DAY_MILLISECONDS) {
    const text = format(monday);
    if (kind === 'week' || text >= from) {
      weeks.push(text);
    }
  }
  return { from, to, weeks } satisfies ConductPeriod;
}

export function rankClasses(
  classes: ConductClassRow[],
  entries: ConductEntryRow[],
  period: ConductPeriod,
  basePoints: number,
): ConductRanking[] {
  const weekCount = Math.max(period.weeks.length, 1);
  const rows = classes.map((classRow) => {
    const own = entries.filter(
      (entry) =>
        entry.class_id === classRow.class_id && entry.entry_date >= period.from && entry.entry_date <= period.to,
    );
    const plus = own.filter((entry) => entry.points > 0).reduce((sum, entry) => sum + entry.points, 0);
    const minus = own.filter((entry) => entry.points < 0).reduce((sum, entry) => sum - entry.points, 0);
    // Trung bình điểm tuần, làm tròn một chữ số thập phân
    const score = Math.round(((basePoints * weekCount + plus - minus) / weekCount) * 10) / 10;
    return { ...classRow, plus_points: plus, minus_points: minus, score, rank: 0 };
  });
  rows.sort((left, right) => right.score - left.score || left.class_name.localeCompare(right.class_name, 'vi'));
  let rank = 0;
  rows.forEach((row, index) => {
    rank = index > 0 && rows[index - 1]?.score === row.score ? rank : index + 1;
    row.rank = rank;
  });
  return rows;
}

// Bộ tiêu chí mặc định của Tiểu học, trường sửa được sau khi nạp
export const DEFAULT_CONDUCT_CRITERIA: Array<{ code: string; name: string; kind: 'plus' | 'minus'; points: number }> = [
  { code: 'GIO_HOC_TOT', name: 'Giờ học tốt', kind: 'plus', points: 2 },
  { code: 'VIEC_TOT', name: 'Việc tốt, việc làm hay', kind: 'plus', points: 3 },
  { code: 'VE_SINH_TOT', name: 'Vệ sinh lớp sạch đẹp', kind: 'plus', points: 2 },
  { code: 'DI_MUON', name: 'Đi học muộn', kind: 'minus', points: 1 },
  { code: 'DONG_PHUC', name: 'Không mặc đồng phục, khăn quàng', kind: 'minus', points: 1 },
  { code: 'TRAT_TU', name: 'Mất trật tự trong giờ học', kind: 'minus', points: 2 },
  { code: 'VE_SINH_KEM', name: 'Vệ sinh lớp chưa sạch', kind: 'minus', points: 2 },
  { code: 'XEP_HANG', name: 'Xếp hàng ra vào lớp chậm', kind: 'minus', points: 1 },
];

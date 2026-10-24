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
  // Điểm theo xếp loại tiết ở sổ đầu bài (DT-21 phần 21d), đã tính vào điểm
  lesson_points: number;
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
  lessonEntries: ConductEntryRow[] = [],
): ConductRanking[] {
  const weekCount = Math.max(period.weeks.length, 1);
  const rows = classes.map((classRow) => {
    const own = entries.filter(
      (entry) =>
        entry.class_id === classRow.class_id && entry.entry_date >= period.from && entry.entry_date <= period.to,
    );
    const plus = own.filter((entry) => entry.points > 0).reduce((sum, entry) => sum + entry.points, 0);
    const minus = own.filter((entry) => entry.points < 0).reduce((sum, entry) => sum - entry.points, 0);
    const lesson = lessonEntries
      .filter(
        (entry) =>
          entry.class_id === classRow.class_id && entry.entry_date >= period.from && entry.entry_date <= period.to,
      )
      .reduce((sum, entry) => sum + entry.points, 0);
    // Trung bình điểm tuần, làm tròn một chữ số thập phân
    const score = Math.round(((basePoints * weekCount + plus - minus + lesson) / weekCount) * 10) / 10;
    return { ...classRow, plus_points: plus, minus_points: minus, lesson_points: lesson, score, rank: 0 };
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

// Bộ tiêu chí mặc định của THCS, THPT (DT-21 phần 21d, YCTD-171), trường sửa được sau khi nạp. Mã tiêu chí là duy nhất toàn
// trường nên khi nạp thêm tiền tố cấp (ví dụ THCS-DI_MUON). Đội sao đỏ báo lỗi, giáo viên trực ghi thay
export const DEFAULT_SECONDARY_CONDUCT_CRITERIA: Array<{
  code: string;
  name: string;
  kind: 'plus' | 'minus';
  points: number;
}> = [
  { code: 'VIEC_TOT', name: 'Việc tốt, gương người tốt việc tốt', kind: 'plus', points: 3 },
  { code: 'PHONG_TRAO', name: 'Tham gia phong trào, đạt giải', kind: 'plus', points: 5 },
  { code: 'VE_SINH_TOT', name: 'Vệ sinh lớp, khu vực được giao sạch đẹp', kind: 'plus', points: 2 },
  { code: 'DI_MUON', name: 'Đi học muộn', kind: 'minus', points: 1 },
  { code: 'VANG_KP', name: 'Nghỉ học không phép, bỏ tiết', kind: 'minus', points: 2 },
  { code: 'DONG_PHUC', name: 'Không mặc đồng phục, không đeo phù hiệu', kind: 'minus', points: 1 },
  { code: 'TRAT_TU', name: 'Mất trật tự, vi phạm nội quy giờ học', kind: 'minus', points: 2 },
  { code: 'DIEN_THOAI', name: 'Dùng điện thoại sai quy định', kind: 'minus', points: 2 },
  { code: 'CHAO_CO', name: 'Vi phạm giờ chào cờ, sinh hoạt đầu giờ', kind: 'minus', points: 2 },
  { code: 'XE_SAI_CHO', name: 'Để xe sai nơi quy định', kind: 'minus', points: 1 },
  { code: 'VE_SINH_KEM', name: 'Vệ sinh lớp, khu vực được giao chưa sạch', kind: 'minus', points: 2 },
];

export function defaultConductCriteria(level: string) {
  return level === 'THCS' || level === 'THPT'
    ? DEFAULT_SECONDARY_CONDUCT_CRITERIA.map((item) => ({ ...item, code: `${level}-${item.code}` }))
    : DEFAULT_CONDUCT_CRITERIA;
}

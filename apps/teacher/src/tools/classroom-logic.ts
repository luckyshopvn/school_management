// Phần thuần của công cụ lớp học (DT-23 phần 23b, YCTD-212): bốc ngẫu nhiên, chia nhóm, tổng điểm, hạn của bản chụp danh sách
// lớp. Không dùng trình duyệt, không gọi máy chủ; nguồn ngẫu nhiên truyền vào để kiểm thử cố định được. Tệp này không nhập
// tệp nào khác để chạy thẳng bằng `node --test`

export interface RosterStudent {
  id: string;
  order_no: number;
  full_name: string;
  code: string | null;
}

export type Random = () => number;

// Bốc một chỉ số trong [0, size) từ nguồn [0, 1)
function randomIndex(size: number, random: Random): number {
  return Math.min(size - 1, Math.floor(random() * size));
}

// Xáo trộn Fisher-Yates trên bản sao
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, random);
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

export interface CallOptions {
  // Không gọi lại học sinh đã được gọi trong lượt này
  noRepeat: boolean;
  excludeAbsent: boolean;
}

export interface CallResult {
  student: RosterStudent | null;
  // Hết học sinh để gọi (không lặp và đã gọi hết, hoặc lớp không còn ai)
  exhausted: boolean;
}

// Gọi một học sinh ngẫu nhiên. `calledIds` là những em đã gọi trong lượt hiện tại; `absentIds` là những em vắng hôm nay
export function pickStudent(
  students: readonly RosterStudent[],
  calledIds: ReadonlySet<string>,
  absentIds: ReadonlySet<string>,
  options: CallOptions,
  random: Random,
): CallResult {
  const present = options.excludeAbsent ? students.filter((student) => !absentIds.has(student.id)) : [...students];
  const pool = options.noRepeat ? present.filter((student) => !calledIds.has(student.id)) : present;
  if (pool.length === 0) {
    return { student: null, exhausted: true };
  }
  const student = pool[randomIndex(pool.length, random)] as RosterStudent;
  return { student, exhausted: options.noRepeat && pool.length === 1 };
}

export type GroupMode = { by: 'count'; value: number } | { by: 'size'; value: number };

export interface Group {
  name: string;
  child_ids: string[];
}

// Số nhóm theo yêu cầu: theo số nhóm hoặc theo số người mỗi nhóm; không vượt số học sinh, ít nhất một nhóm
export function groupCount(studentCount: number, mode: GroupMode): number {
  if (studentCount <= 0) {
    return 0;
  }
  const value = Math.max(1, Math.floor(mode.value));
  const count = mode.by === 'count' ? value : Math.ceil(studentCount / value);
  return Math.min(Math.max(count, 1), studentCount);
}

// Chia ngẫu nhiên thành các nhóm chênh nhau tối đa một người; tên nhóm "Nhóm 1", "Nhóm 2"...
export function splitIntoGroups(students: readonly RosterStudent[], mode: GroupMode, random: Random): Group[] {
  const count = groupCount(students.length, mode);
  const groups: Group[] = Array.from({ length: count }, (_, index) => ({ name: `Nhóm ${index + 1}`, child_ids: [] }));
  shuffle(students, random).forEach((student, index) => {
    (groups[index % count] as Group).child_ids.push(student.id);
  });
  return groups;
}

export interface ScoreEvent {
  client_id: string;
  target_kind: 'group' | 'student';
  // Tên nhóm với đối tượng nhóm, mã học sinh với đối tượng học sinh
  key: string;
  delta: number;
  occurred_at: string;
  // Đã chuyển vào nề nếp, thi đua
  confirmed: boolean;
}

export interface ScoreTotal {
  target_kind: 'group' | 'student';
  key: string;
  total: number;
  pending: number;
}

export function tallyScores(events: readonly ScoreEvent[]): ScoreTotal[] {
  const totals = new Map<string, ScoreTotal>();
  for (const event of events) {
    const id = `${event.target_kind}:${event.key}`;
    const current = totals.get(id) ?? { target_kind: event.target_kind, key: event.key, total: 0, pending: 0 };
    current.total += event.delta;
    if (!event.confirmed) {
      current.pending += event.delta;
    }
    totals.set(id, current);
  }
  return [...totals.values()];
}

// Bản chụp danh sách lớp hết hạn sau `ttlHours` giờ kể từ lúc lưu (GD-108: mặc định 24 giờ); thời điểm lưu hỏng coi là hết hạn
export function isSnapshotExpired(savedAt: string, ttlHours: number, now: Date): boolean {
  const saved = Date.parse(savedAt);
  if (Number.isNaN(saved)) {
    return true;
  }
  return now.getTime() - saved >= ttlHours * 60 * 60 * 1000;
}

// Đồng hồ đếm ngược chạy theo thời điểm kết thúc tuyệt đối nên vẫn đúng khi màn hình tắt hoặc trang bị tạm dừng
export function remainingMilliseconds(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

export function formatClock(milliseconds: number, roundUp: boolean): string {
  const totalSeconds = Math.max(0, roundUp ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

import {
  discardSession,
  isNetworkError,
  sendCalls,
  sendScores,
  type QueuedCall,
  type QueuedScore,
  type RosterResponse,
  type ToolsConfig,
} from './classroom-api.js';
import { isSnapshotExpired, type Group, type RosterStudent, type ScoreEvent } from './classroom-logic.ts';

// Dữ liệu công cụ lớp học trên máy giáo viên (DT-23 phần 23b, YCTD-212, GD-108). Chỉ có: cấu hình của trường, bản chụp danh sách
// lớp gọn (số thứ tự, họ tên, mã; không điểm, nhận xét, thông tin phụ huynh), bản chia nhóm gần nhất, bảng điểm của buổi và hàng
// đợi chờ gửi. Bản chụp hết hạn theo giờ cấu hình của trường (mặc định 24 giờ); mọi thứ xóa khi đăng xuất hoặc phiên hết hạn;
// trường tắt ngoại tuyến thì không lưu gì ngoài cấu hình
const PREFIX = 'cong-cu-lop-hoc:';
const CONFIG_KEY = `${PREFIX}cau-hinh`;
const ROSTERS_KEY = `${PREFIX}danh-sach`;
const QUEUE_KEY = `${PREFIX}hang-doi`;
const BOARDS_KEY = `${PREFIX}bang-diem`;
const GROUPINGS_KEY = `${PREFIX}nhom`;
const DEFAULT_TTL_HOURS = 24;

export interface StoredConfig extends ToolsConfig {
  saved_at: string;
}

export interface RosterSnapshot {
  class_id: string;
  class_name: string;
  saved_at: string;
  // Ngày (giờ Việt Nam) của lần lưu: đánh dấu vắng chỉ đúng trong ngày đó
  day: string;
  students: Array<RosterStudent & { absent: boolean }>;
}

export interface QueueState {
  calls: QueuedCall[];
  discards: Array<{ class_id: string; session_key: string }>;
}

export interface LocalScore extends ScoreEvent {
  synced: boolean;
}

export interface ScoreBoard {
  session_key: string;
  events: LocalScore[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Trình duyệt chặn bộ nhớ cục bộ thì không lưu được; ứng dụng vẫn chạy khi có mạng
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // bỏ qua
  }
}

export function readConfig(): StoredConfig | null {
  return readJson<StoredConfig | null>(CONFIG_KEY, null);
}

export function saveConfig(config: ToolsConfig, now: Date): StoredConfig {
  const stored = { ...config, saved_at: now.toISOString() };
  writeJson(CONFIG_KEY, stored);
  return stored;
}

// Chưa biết cấu hình (chưa từng tải) thì coi như tắt: không lưu danh sách lớp lên máy
export function offlineAllowed(): boolean {
  return readConfig()?.offline_enabled === true;
}

function ttlHours(): number {
  return readConfig()?.roster_ttl_hours ?? DEFAULT_TTL_HOURS;
}

export function vietnamDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export function snapshotFrom(roster: RosterResponse, now: Date): RosterSnapshot {
  return {
    class_id: roster.class_id,
    class_name: roster.class_name,
    saved_at: now.toISOString(),
    day: vietnamDay(now),
    students: roster.students.map((student) => ({
      id: student.id,
      order_no: student.order_no,
      full_name: student.full_name,
      code: student.code,
      absent: student.absent_today,
    })),
  };
}

export function saveRoster(roster: RosterResponse, now: Date): RosterSnapshot {
  const snapshot = snapshotFrom(roster, now);
  if (offlineAllowed()) {
    const all = readRosters(now);
    all[snapshot.class_id] = snapshot;
    writeJson(ROSTERS_KEY, all);
  }
  return snapshot;
}

// Các bản chụp còn hạn; bản hết hạn bị xóa ngay khi đọc
export function readRosters(now: Date): Record<string, RosterSnapshot> {
  const stored = readJson<Record<string, RosterSnapshot>>(ROSTERS_KEY, {});
  const kept: Record<string, RosterSnapshot> = {};
  for (const [classId, snapshot] of Object.entries(stored)) {
    if (!isSnapshotExpired(snapshot.saved_at, ttlHours(), now)) {
      kept[classId] = snapshot;
    }
  }
  if (Object.keys(kept).length !== Object.keys(stored).length) {
    writeJson(ROSTERS_KEY, kept);
  }
  return kept;
}

export function readQueue(): QueueState {
  const queue = readJson<Partial<QueueState>>(QUEUE_KEY, {});
  return { calls: queue.calls ?? [], discards: queue.discards ?? [] };
}

function writeQueue(queue: QueueState): void {
  writeJson(QUEUE_KEY, queue);
}

export function enqueueCall(call: QueuedCall): void {
  const queue = readQueue();
  writeQueue({ ...queue, calls: [...queue.calls, call] });
}

export function readBoards(): Record<string, ScoreBoard> {
  return readJson<Record<string, ScoreBoard>>(BOARDS_KEY, {});
}

export function writeBoard(classId: string, board: ScoreBoard | null): void {
  const boards = readBoards();
  if (board) {
    boards[classId] = board;
  } else {
    delete boards[classId];
  }
  writeJson(BOARDS_KEY, boards);
}

export function readGrouping(classId: string): Group[] {
  return readJson<Record<string, Group[]>>(GROUPINGS_KEY, {})[classId] ?? [];
}

export function writeGrouping(classId: string, groups: Group[]): void {
  writeJson(GROUPINGS_KEY, { ...readJson<Record<string, Group[]>>(GROUPINGS_KEY, {}), [classId]: groups });
}

export function queuedCount(): number {
  const queue = readQueue();
  return (
    queue.calls.length +
    queue.discards.length +
    Object.values(readBoards()).reduce(
      (total, board) => total + board.events.filter((event) => !event.synced).length,
      0,
    )
  );
}

export function queueBoardDiscard(classId: string, sessionKey: string): void {
  const queue = readQueue();
  writeQueue({ ...queue, discards: [...queue.discards, { class_id: classId, session_key: sessionKey }] });
}

// Xóa mọi dữ liệu công cụ lớp học trên máy: đăng xuất, phiên hết hạn, trường tắt ngoại tuyến, giáo viên chọn xóa
export function clearClassroomData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // bỏ qua
  }
}

// Xóa dữ liệu của phiên khi trường tắt ngoại tuyến nhưng giữ cấu hình vừa nhận
export function clearAllButConfig(): void {
  const config = readConfig();
  clearClassroomData();
  if (config) {
    writeJson(CONFIG_KEY, config);
  }
}

export interface FlushResult {
  sent: number;
  remaining: number;
  // Máy chủ từ chối (lỗi nghiệp vụ) nên giữ lại ít nhất một dòng
  rejected: string | null;
}

let flushing: Promise<FlushResult> | undefined;
let flushAgain = false;

// Gửi hàng đợi lên máy chủ khi có mạng: lượt gọi, dòng điểm, lệnh bỏ buổi. Máy chủ chống trùng theo `client_id` nên gửi lại
// không tạo dòng thừa; lỗi mạng thì dừng giữ nguyên, lỗi nghiệp vụ thì bỏ riêng nhóm lỗi để không chặn các nhóm khác. Yêu cầu
// đến khi một lượt gửi đang chạy thì lượt đó chạy lại một lần nữa sau khi xong (dòng mới thêm không bị bỏ sót)
export function flushQueue(): Promise<FlushResult> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    let result: FlushResult;
    do {
      flushAgain = false;
      result = await doFlush();
    } while (flushAgain);
    return result;
  })().finally(() => {
    flushing = undefined;
  });
  return flushing;
}

async function doFlush(): Promise<FlushResult> {
  let sent = 0;
  let rejected: string | null = null;
  const queue = readQueue();
  const byClass = new Map<string, QueuedCall[]>();
  for (const call of queue.calls) {
    byClass.set(call.class_id, [...(byClass.get(call.class_id) ?? []), call]);
  }
  try {
    for (const [classId, calls] of byClass) {
      try {
        await sendCalls(
          classId,
          calls.map(({ client_id, child_id, called_at }) => ({ client_id, child_id, called_at })),
        );
        sent += calls.length;
        const current = readQueue();
        writeQueue({
          ...current,
          calls: current.calls.filter((call) => !calls.some((done) => done.client_id === call.client_id)),
        });
      } catch (error) {
        if (isNetworkError(error)) {
          throw error;
        }
        rejected = error instanceof Error ? error.message : 'Máy chủ từ chối';
        // Lượt gọi bị từ chối (ví dụ học sinh đã chuyển lớp) không gửi lại được: bỏ để hàng đợi không kẹt
        const current = readQueue();
        writeQueue({
          ...current,
          calls: current.calls.filter((call) => !calls.some((done) => done.client_id === call.client_id)),
        });
      }
    }
    const boards = readBoards();
    for (const [classId, board] of Object.entries(boards)) {
      const unsynced = board.events.filter((event) => !event.synced);
      if (unsynced.length === 0) {
        continue;
      }
      const payload = unsynced.map((event): Omit<QueuedScore, 'class_id' | 'session_key'> => ({
        client_id: event.client_id,
        target_kind: event.target_kind,
        group_name: event.target_kind === 'group' ? event.key : null,
        child_id: event.target_kind === 'student' ? event.key : null,
        delta: event.delta,
        occurred_at: event.occurred_at,
      }));
      try {
        await sendScores(classId, board.session_key, payload);
        sent += unsynced.length;
      } catch (error) {
        if (isNetworkError(error)) {
          throw error;
        }
        // Dòng điểm bị từ chối (ví dụ học sinh đã chuyển lớp) không gửi lại được: coi như đã xử lý để hàng đợi không kẹt
        rejected = error instanceof Error ? error.message : 'Máy chủ từ chối';
      }
      const fresh = readBoards()[classId];
      if (fresh) {
        const done = new Set(unsynced.map((event) => event.client_id));
        writeBoard(classId, {
          ...fresh,
          events: fresh.events.map((event) => (done.has(event.client_id) ? { ...event, synced: true } : event)),
        });
      }
    }
    for (const discard of readQueue().discards) {
      try {
        await discardSession(discard.class_id, discard.session_key);
      } catch (error) {
        if (isNetworkError(error)) {
          throw error;
        }
      }
      const current = readQueue();
      writeQueue({
        ...current,
        discards: current.discards.filter((item) => item.session_key !== discard.session_key),
      });
    }
  } catch {
    // Mất mạng giữa chừng: phần chưa gửi nằm nguyên trong hàng đợi
  }
  return { sent, remaining: queuedCount(), rejected };
}

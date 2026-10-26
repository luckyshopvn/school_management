import { isNetworkError } from '../classroom-api.js';
import { offlineAllowed, readBoards, writeBoard, type ScoreBoard } from '../classroom-store.js';
import type { GameQuestion } from './game-logic.ts';
import { saveGameSession, type GameSessionPayload } from './games-api.js';

// Dữ liệu trò chơi trên máy giáo viên (DT-23 phần 23c, YCTD-213, GD-108): bộ câu hỏi đã tải gần nhất của mỗi lớp (để chơi khi mất
// mạng) và hàng đợi lượt chơi chờ gửi. Cùng tiền tố với công cụ lớp học 23b nên xóa cùng khi đăng xuất, khi trường tắt ngoại tuyến
// thì không lưu; bộ câu hỏi hết hạn sau 24 giờ như danh sách lớp
const PREFIX = 'cong-cu-lop-hoc:tro-choi:';
const SETS_KEY = `${PREFIX}bo-cau-hoi`;
const QUEUE_KEY = `${PREFIX}hang-doi`;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface QuestionSet {
  class_id: string;
  subject_name: string;
  saved_at: string;
  questions: GameQuestion[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Trình duyệt chặn bộ nhớ cục bộ: chơi được khi có mạng
  }
}

export function saveQuestionSet(set: QuestionSet): void {
  if (!offlineAllowed()) return;
  writeJson(SETS_KEY, { ...readJson<Record<string, QuestionSet>>(SETS_KEY, {}), [set.class_id]: set });
}

export function readQuestionSet(classId: string, now: Date): QuestionSet | null {
  const set = readJson<Record<string, QuestionSet>>(SETS_KEY, {})[classId];
  if (!set || now.getTime() - new Date(set.saved_at).getTime() > TTL_MS) {
    return null;
  }
  return set;
}

export function queuedGames(): GameSessionPayload[] {
  return readJson<GameSessionPayload[]>(QUEUE_KEY, []);
}

// Lưu lượt chơi: có mạng thì gửi ngay; mất mạng thì để hàng đợi (trường cho ngoại tuyến), gửi sau bằng flushGames
export async function recordGame(payload: GameSessionPayload): Promise<'saved' | 'queued'> {
  try {
    await saveGameSession(payload);
    return 'saved';
  } catch (error) {
    if (isNetworkError(error) && offlineAllowed()) {
      writeJson(QUEUE_KEY, [...queuedGames().filter((item) => item.client_id !== payload.client_id), payload]);
      return 'queued';
    }
    throw error;
  }
}

export async function flushGames(): Promise<number> {
  let sent = 0;
  for (const payload of queuedGames()) {
    try {
      await saveGameSession(payload);
    } catch (error) {
      if (isNetworkError(error)) {
        break;
      }
      // Máy chủ từ chối (câu đã bị gỡ khỏi ngân hàng...): bỏ lượt đó để không chặn hàng đợi
    }
    sent += 1;
    writeJson(
      QUEUE_KEY,
      queuedGames().filter((item) => item.client_id !== payload.client_id),
    );
  }
  return sent;
}

// Chuyển điểm nhóm của trò chơi sang bảng điểm nhanh của 23b (dòng chưa gửi); điểm chỉ vào nề nếp, thi đua khi giáo viên chọn
// tiêu chí và xác nhận ở bảng điểm
export function addToScoreboard(classId: string, scores: Record<string, number>, now: Date): number {
  const board: ScoreBoard = readBoards()[classId] ?? { session_key: crypto.randomUUID(), events: [] };
  const added = Object.entries(scores)
    .filter(([, value]) => value !== 0)
    .map(([group, value]) => ({
      client_id: crypto.randomUUID(),
      target_kind: 'group' as const,
      key: group,
      delta: Math.max(-50, Math.min(50, value)),
      occurred_at: now.toISOString(),
      confirmed: false,
      synced: false,
    }));
  writeBoard(classId, { ...board, events: [...board.events, ...added] });
  return added.length;
}

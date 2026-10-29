// Quy tắc thuần của học khi mạng yếu (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27). Không nhập mô-đun
// nào để chạy được bằng `node --test`. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-280:
// - Khóa bản ghi trên máy chỉ gồm loại và mã (hoạt động, câu, mã chống trùng), không có tên hay thông tin khác của học sinh.
// - Bản ghi quá số ngày giữ của trường (tối đa 7) thì xoá khi mở ứng dụng; hàng đợi gửi lần lượt theo lúc tạo, lỗi mạng thì dừng để
//   lần sau gửi tiếp, máy chủ từ chối (4xx) thì bỏ thao tác đó và báo cho em.
export const MAXIMUM_RETENTION_DAYS = 7;
const DAY_MS = 86_400_000;

export type RecordScope = 'draft' | 'content' | 'queue';

export function recordKey(scope: RecordScope, id: string): string {
  return `${scope}:${id}`;
}

// Chủ của dữ liệu trên máy (YCTD-379): mã người dùng trong mã phiên (`sub`). Bản ghi và khóa mã hoá gắn với chủ, nên em khác đăng nhập
// trên cùng máy không đọc, không gửi được bài của em trước
export function ownerOfAccessToken(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub !== '' ? claims.sub : null;
  } catch {
    return null;
  }
}

export function ownedKey(owner: string, key: string): string {
  return `${owner}/${key}`;
}

export function isExpired(savedAt: number, now: number, retentionDays: number): boolean {
  const days = Math.min(Math.max(1, Math.floor(retentionDays)), MAXIMUM_RETENTION_DAYS);
  return now - savedAt > days * DAY_MS || savedAt > now + DAY_MS;
}

export interface QueuedOperation {
  id: string;
  kind: 'upload' | 'submit';
  activity_id: string;
  item_id: string | null;
  client_key: string;
  client_submitted_at: string | null;
  created_at: number;
}

export function orderedQueue<T extends Pick<QueuedOperation, 'created_at' | 'kind'>>(operations: T[]): T[] {
  // Tệp của một bài gửi trước lần nộp tạo cùng lúc (cùng thời điểm thì tệp trước)
  return [...operations].sort(
    (left, right) =>
      left.created_at - right.created_at || (left.kind === right.kind ? 0 : left.kind === 'upload' ? -1 : 1),
  );
}

// Lỗi mạng (không tới được máy chủ, máy chủ chuyển tiếp chưa sẵn sàng) thì giữ để gửi lại; lỗi khác là máy chủ đã trả lời
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const status = (error as { status?: unknown } | null)?.status;
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export type FlushOutcome = { sent: number; dropped: Array<{ id: string; reason: string }>; stopped: boolean };

// Gửi hàng đợi lần lượt: thành công thì xoá; lỗi mạng thì dừng (giữ phần còn lại); máy chủ từ chối thì bỏ thao tác, ghi lý do
export async function flushQueue<T extends QueuedOperation>(
  operations: T[],
  send: (operation: T) => Promise<void>,
  remove: (operation: T) => Promise<void>,
): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { sent: 0, dropped: [], stopped: false };
  for (const operation of orderedQueue(operations)) {
    try {
      await send(operation);
      await remove(operation);
      outcome.sent += 1;
    } catch (error) {
      if (isNetworkFailure(error)) {
        outcome.stopped = true;
        break;
      }
      await remove(operation);
      outcome.dropped.push({ id: operation.id, reason: error instanceof Error ? error.message : 'Máy chủ không nhận' });
    }
  }
  return outcome;
}

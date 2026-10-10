import { ApiError, requestJson } from '../session/api-client.js';

// Lưu tạm điểm danh trên thiết bị khi mất mạng và tự gửi lại khi có mạng (Q-09, QT-02 E9).
// Máy chủ chống trùng theo trẻ và ngày nên gửi lại nhiều lần không tạo bản ghi trùng
const STORAGE_KEY = 'diem-danh-cho-gui';

export interface PendingAttendance {
  classId: string;
  date: string;
  entries: Array<{ child_id: string; status: string; note: string | null }>;
  recordedAt: string;
}

function readQueue(): PendingAttendance[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PendingAttendance[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingAttendance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Trình duyệt chặn bộ nhớ cục bộ thì không lưu tạm được; giáo viên được báo lỗi khi gửi
  }
}

export function pendingCount(): number {
  return readQueue().length;
}

export function pendingFor(classId: string, date: string): PendingAttendance | undefined {
  return readQueue().find((item) => item.classId === classId && item.date === date);
}

export function enqueue(item: PendingAttendance): void {
  writeQueue([
    ...readQueue().filter((queued) => !(queued.classId === item.classId && queued.date === item.date)),
    item,
  ]);
}

// Lỗi mạng là lỗi không có phản hồi từ máy chủ; lỗi nghiệp vụ không lưu tạm
export function isNetworkError(error: unknown): boolean {
  return !(error instanceof ApiError);
}

export function sendAttendance(item: PendingAttendance, offline: boolean) {
  return requestJson(`/api/v1/classes/${item.classId}/attendance`, {
    method: 'PUT',
    body: JSON.stringify({
      date: item.date,
      entries: item.entries,
      ...(offline ? { offline_recorded_at: item.recordedAt } : {}),
    }),
  });
}

// Gửi lần lượt các bản lưu tạm; bản bị máy chủ từ chối vì nghiệp vụ thì bỏ khỏi hàng đợi và trả về để báo giáo viên
export async function flushQueue(): Promise<{
  sent: number;
  rejected: Array<{ item: PendingAttendance; message: string }>;
}> {
  let sent = 0;
  const rejected: Array<{ item: PendingAttendance; message: string }> = [];
  for (const item of readQueue()) {
    try {
      await sendAttendance(item, true);
      sent += 1;
      writeQueue(readQueue().filter((queued) => !(queued.classId === item.classId && queued.date === item.date)));
    } catch (error) {
      if (isNetworkError(error)) {
        break;
      }
      rejected.push({ item, message: (error as ApiError).message });
      writeQueue(readQueue().filter((queued) => !(queued.classId === item.classId && queued.date === item.date)));
    }
  }
  return { sent, rejected };
}

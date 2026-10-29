import {
  flushQueue,
  isNetworkFailure,
  ownerOfAccessToken,
  recordKey,
  type FlushOutcome,
  type QueuedOperation,
} from './offline-rules.ts';
import {
  clearAll,
  getRecord,
  listRecords,
  offlineStorageAvailable,
  purgeExpired,
  putRecord,
  removePrefix,
  removeRecord,
} from './offline-store.ts';

// Cửa duy nhất của học khi mạng yếu cho các màn hình học sinh (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27). Mọi hàm không làm gì
// khi trường chưa bật hoặc trình duyệt không có IndexedDB, nên gỡ mô-đun chỉ cần bỏ thư mục `offline` và các dòng gọi tới đây.
// Giữ: bản nháp câu trả lời, nội dung hoạt động đã mở (không giữ video, gói SCORM), thao tác chờ gửi (tệp, lần nộp) của chính em.
// Dữ liệu gắn với em đang đăng nhập (YCTD-376): chưa biết em là ai thì không giữ gì
export interface OfflineConfig {
  enabled: boolean;
  retention_days: number;
}

let config: OfflineConfig = { enabled: false, retention_days: 7 };
let owner: string | null = null;

// Phiên đăng nhập đổi: gắn dữ liệu trên máy với người dùng của mã phiên; đăng xuất thì bỏ
export function setOfflineOwner(accessToken: string | null): void {
  owner = accessToken ? ownerOfAccessToken(accessToken) : null;
}

export function offlineEnabled(): boolean {
  return config.enabled && owner !== null && offlineStorageAvailable();
}

// Đọc cấu hình của trường khi vào màn hình học tập, xoá bản ghi quá hạn
export async function loadOfflineConfig(read: () => Promise<OfflineConfig>): Promise<OfflineConfig> {
  try {
    config = await read();
  } catch {
    // Không đọc được (mất mạng): giữ cấu hình đã đọc lần trước trong phiên này
  }
  if (offlineEnabled()) {
    await purgeExpired(config.retention_days).catch(() => undefined);
  }
  return config;
}

export { isNetworkFailure };

export interface LocalDraft {
  answers: Record<string, { choices?: string[]; text?: string }>;
  // Mã chống trùng của lần nộp đang soạn: gửi lại bao nhiêu lần máy chủ cũng chỉ ghi một lần nộp
  submit_key: string;
}

export async function saveDraft(activityId: string, draft: LocalDraft): Promise<void> {
  if (!offlineEnabled() || !owner) return;
  await putRecord(owner, recordKey('draft', activityId), draft).catch(() => undefined);
}

export async function readDraft(activityId: string): Promise<{ value: LocalDraft; saved_at: number } | null> {
  if (!offlineEnabled() || !owner) return null;
  return getRecord<LocalDraft>(owner, recordKey('draft', activityId)).catch(() => null);
}

// Nộp xong: xoá bản nháp và thao tác chờ gửi của hoạt động
export async function forgetActivity(activityId: string): Promise<void> {
  if (!offlineStorageAvailable() || !owner) return;
  await removeRecord(owner, recordKey('draft', activityId)).catch(() => undefined);
  await removePrefix(owner, recordKey('queue', `${activityId}:`)).catch(() => undefined);
}

export async function saveContent(activityId: string, content: unknown): Promise<void> {
  if (!offlineEnabled() || !owner) return;
  await putRecord(owner, recordKey('content', activityId), content).catch(() => undefined);
}

export async function readContent<T>(activityId: string): Promise<T | null> {
  if (!offlineEnabled() || !owner) return null;
  return ((await getRecord<T>(owner, recordKey('content', activityId)).catch(() => null))?.value ?? null) as T | null;
}

interface StoredOperation extends QueuedOperation {
  answers?: LocalDraft['answers'];
  version?: number;
  file_name?: string;
  file?: Blob;
}

export async function queueUpload(activityId: string, itemId: string, file: Blob, fileName: string): Promise<boolean> {
  if (!offlineEnabled() || !owner) return false;
  const key = crypto.randomUUID();
  const operation: StoredOperation = {
    id: key,
    kind: 'upload',
    activity_id: activityId,
    item_id: itemId,
    client_key: key,
    client_submitted_at: null,
    created_at: Date.now(),
    file_name: fileName,
  };
  await putRecord(owner, recordKey('queue', `${activityId}:${key}`), operation);
  await putRecord(owner, recordKey('queue', `${activityId}:${key}:file`), file);
  return true;
}

export async function queueSubmit(
  activityId: string,
  draft: LocalDraft,
  version: number | undefined,
): Promise<boolean> {
  if (!offlineEnabled() || !owner) return false;
  const operation: StoredOperation = {
    id: draft.submit_key,
    kind: 'submit',
    activity_id: activityId,
    item_id: null,
    client_key: draft.submit_key,
    // Thời điểm em bấm nộp trên máy, để giáo viên xét khi muộn do mạng
    client_submitted_at: new Date().toISOString(),
    created_at: Date.now(),
    answers: draft.answers,
    ...(version !== undefined ? { version } : {}),
  };
  await putRecord(owner, recordKey('queue', `${activityId}:${draft.submit_key}`), operation);
  return true;
}

export async function pendingCount(): Promise<number> {
  if (!offlineEnabled() || !owner) return 0;
  const rows = await listRecords<StoredOperation>(owner, recordKey('queue', '')).catch(() => []);
  return rows.filter((row) => !row.key.endsWith(':file')).length;
}

// Gửi hàng đợi của em đang đăng nhập theo thứ tự khi có mạng; nộp thành công thì xoá bản nháp của hoạt động
export async function flushPending(
  sendUpload: (activityId: string, itemId: string, file: Blob, fileName: string, clientKey: string) => Promise<void>,
  sendSubmit: (activityId: string, body: Record<string, unknown>) => Promise<void>,
): Promise<FlushOutcome | null> {
  const current = owner;
  if (!offlineEnabled() || !current) return null;
  const rows = await listRecords<StoredOperation>(current, recordKey('queue', ''));
  const operations = rows.filter((row) => !row.key.endsWith(':file')).map((row) => row.value);
  if (operations.length === 0) return null;
  return flushQueue(
    operations,
    async (operation) => {
      if (operation.kind === 'upload') {
        const file = await getRecord<Blob>(
          current,
          recordKey('queue', `${operation.activity_id}:${operation.id}:file`),
        );
        if (!file) return;
        await sendUpload(
          operation.activity_id,
          operation.item_id ?? '',
          file.value,
          operation.file_name ?? 'tep',
          operation.client_key,
        );
        return;
      }
      await sendSubmit(operation.activity_id, {
        answers: operation.answers ?? {},
        ...(operation.version !== undefined ? { version: operation.version } : {}),
        client_submit_key: operation.client_key,
        client_submitted_at: operation.client_submitted_at,
      });
      await forgetActivity(operation.activity_id);
    },
    async (operation) => {
      await removeRecord(current, recordKey('queue', `${operation.activity_id}:${operation.id}`));
      await removeRecord(current, recordKey('queue', `${operation.activity_id}:${operation.id}:file`));
    },
  );
}

// Đăng xuất: xoá hết dữ liệu trên máy (kể cả thao tác chưa gửi), dù trường đang bật hay tắt
export async function forgetEverything(): Promise<void> {
  owner = null;
  await clearAll().catch(() => undefined);
}

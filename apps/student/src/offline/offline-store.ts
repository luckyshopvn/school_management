import { isExpired, ownedKey } from './offline-rules.ts';

// Kho trên máy của học khi mạng yếu (DT-28 phần 28j, YCTD-280): IndexedDB theo nguồn gốc của trường (mỗi trường một nguồn gốc nên
// dữ liệu tự tách). Mỗi bản ghi mã hoá AES-GCM bằng khóa sinh trên máy, không xuất được (CryptoKey lưu trong chính IndexedDB);
// trình duyệt không có WebCrypto thì lưu không mã hoá. Khóa bản ghi chỉ có loại và mã, không có tên học sinh. Xoá hết khi đăng xuất.
// Từ YCTD-376 mỗi bản ghi và khóa mã hoá gắn với một người dùng (chủ): đọc, ghi, liệt kê chỉ trong phần của chủ
const DATABASE = 'hoc-khi-mang-yeu';
const RECORDS = 'records';
const KEYS = 'keys';

interface StoredRecord {
  key: string;
  owner?: string;
  saved_at: number;
  encrypted: boolean;
  iv?: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
  type: string | null;
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

let opened: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (!opened) {
    opened = new Promise((resolve, reject) => {
      const open = indexedDB.open(DATABASE, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(RECORDS, { keyPath: 'key' });
        open.result.createObjectStore(KEYS);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }
  return opened;
}

export function offlineStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function cryptoKey(owner: string): Promise<CryptoKey | null> {
  if (!globalThis.crypto?.subtle) return null;
  const db = await database();
  const name = `owner:${owner}`;
  const existing = await request(db.transaction(KEYS).objectStore(KEYS).get(name));
  if (existing) return existing as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await request(db.transaction(KEYS, 'readwrite').objectStore(KEYS).put(key, name));
  return key;
}

async function encode(value: unknown): Promise<{ data: ArrayBuffer; type: string | null }> {
  if (value instanceof Blob) {
    return { data: await value.arrayBuffer(), type: value.type || 'application/octet-stream' };
  }
  return { data: new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer, type: null };
}

export async function putRecord(owner: string, key: string, value: unknown): Promise<void> {
  const { data, type } = await encode(value);
  const secret = await cryptoKey(owner);
  const record: StoredRecord = { key: ownedKey(owner, key), owner, saved_at: Date.now(), encrypted: false, data, type };
  if (secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    record.data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, data);
    record.iv = iv;
    record.encrypted = true;
  }
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).put(record));
}

async function decode(owner: string, record: StoredRecord): Promise<unknown> {
  if (record.owner !== owner) throw new Error('Bản ghi của người dùng khác');
  let data = record.data;
  if (record.encrypted) {
    const secret = await cryptoKey(owner);
    if (!secret || !record.iv) return null;
    data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, secret, data);
  }
  return record.type ? new Blob([data], { type: record.type }) : JSON.parse(new TextDecoder().decode(data));
}

export async function getRecord<T>(owner: string, key: string): Promise<{ value: T; saved_at: number } | null> {
  const db = await database();
  const fullKey = ownedKey(owner, key);
  const record = (await request(db.transaction(RECORDS).objectStore(RECORDS).get(fullKey))) as StoredRecord | undefined;
  if (!record) return null;
  try {
    return { value: (await decode(owner, record)) as T, saved_at: record.saved_at };
  } catch {
    await removeFullKey(fullKey);
    return null;
  }
}

export async function listRecords<T>(
  owner: string,
  prefix: string,
): Promise<Array<{ key: string; value: T; saved_at: number }>> {
  const db = await database();
  const records = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAll())) as StoredRecord[];
  const ownedPrefix = ownedKey(owner, prefix);
  const result: Array<{ key: string; value: T; saved_at: number }> = [];
  for (const record of records.filter((item) => item.key.startsWith(ownedPrefix))) {
    try {
      result.push({
        key: record.key.slice(ownedKey(owner, '').length),
        value: (await decode(owner, record)) as T,
        saved_at: record.saved_at,
      });
    } catch {
      await removeFullKey(record.key);
    }
  }
  return result;
}

async function removeFullKey(fullKey: string): Promise<void> {
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).delete(fullKey));
}

export async function removeRecord(owner: string, key: string): Promise<void> {
  await removeFullKey(ownedKey(owner, key));
}

export async function removePrefix(owner: string, prefix: string): Promise<void> {
  const db = await database();
  const keys = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAllKeys())) as string[];
  const ownedPrefix = ownedKey(owner, prefix);
  for (const key of keys.filter((item) => item.startsWith(ownedPrefix))) {
    await removeFullKey(key);
  }
}

// Xoá bản ghi quá hạn của mọi người dùng và bản ghi cũ chưa gắn người dùng (trước YCTD-376)
export async function purgeExpired(retentionDays: number): Promise<void> {
  const db = await database();
  const records = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAll())) as StoredRecord[];
  const now = Date.now();
  for (const record of records.filter((item) => !item.owner || isExpired(item.saved_at, now, retentionDays))) {
    await removeFullKey(record.key);
  }
}

// Đăng xuất: xoá mọi bản ghi và khóa mã hoá
export async function clearAll(): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).clear());
  await request(db.transaction(KEYS, 'readwrite').objectStore(KEYS).clear());
}

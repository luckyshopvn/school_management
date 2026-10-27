import { isExpired } from './offline-rules.ts';

// Kho trên máy của học khi mạng yếu (DT-28 phần 28j, YCTD-280): IndexedDB theo nguồn gốc của trường (mỗi trường một nguồn gốc nên
// dữ liệu tự tách). Mỗi bản ghi mã hoá AES-GCM bằng khóa sinh trên máy, không xuất được (CryptoKey lưu trong chính IndexedDB);
// trình duyệt không có WebCrypto thì lưu không mã hoá. Khóa bản ghi chỉ có loại và mã, không có tên học sinh. Xoá hết khi đăng xuất
const DATABASE = 'hoc-khi-mang-yeu';
const RECORDS = 'records';
const KEYS = 'keys';

interface StoredRecord {
  key: string;
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

async function cryptoKey(): Promise<CryptoKey | null> {
  if (!globalThis.crypto?.subtle) return null;
  const db = await database();
  const existing = await request(db.transaction(KEYS).objectStore(KEYS).get('main'));
  if (existing) return existing as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await request(db.transaction(KEYS, 'readwrite').objectStore(KEYS).put(key, 'main'));
  return key;
}

async function encode(value: unknown): Promise<{ data: ArrayBuffer; type: string | null }> {
  if (value instanceof Blob) {
    return { data: await value.arrayBuffer(), type: value.type || 'application/octet-stream' };
  }
  return { data: new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer, type: null };
}

export async function putRecord(key: string, value: unknown): Promise<void> {
  const { data, type } = await encode(value);
  const secret = await cryptoKey();
  const record: StoredRecord = { key, saved_at: Date.now(), encrypted: false, data, type };
  if (secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    record.data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, data);
    record.iv = iv;
    record.encrypted = true;
  }
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).put(record));
}

async function decode(record: StoredRecord): Promise<unknown> {
  let data = record.data;
  if (record.encrypted) {
    const secret = await cryptoKey();
    if (!secret || !record.iv) return null;
    data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, secret, data);
  }
  return record.type ? new Blob([data], { type: record.type }) : JSON.parse(new TextDecoder().decode(data));
}

export async function getRecord<T>(key: string): Promise<{ value: T; saved_at: number } | null> {
  const db = await database();
  const record = (await request(db.transaction(RECORDS).objectStore(RECORDS).get(key))) as StoredRecord | undefined;
  if (!record) return null;
  try {
    return { value: (await decode(record)) as T, saved_at: record.saved_at };
  } catch {
    await removeRecord(key);
    return null;
  }
}

export async function listRecords<T>(prefix: string): Promise<Array<{ key: string; value: T; saved_at: number }>> {
  const db = await database();
  const records = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAll())) as StoredRecord[];
  const result: Array<{ key: string; value: T; saved_at: number }> = [];
  for (const record of records.filter((item) => item.key.startsWith(prefix))) {
    try {
      result.push({ key: record.key, value: (await decode(record)) as T, saved_at: record.saved_at });
    } catch {
      await removeRecord(record.key);
    }
  }
  return result;
}

export async function removeRecord(key: string): Promise<void> {
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).delete(key));
}

export async function removePrefix(prefix: string): Promise<void> {
  const db = await database();
  const keys = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAllKeys())) as string[];
  for (const key of keys.filter((item) => item.startsWith(prefix))) {
    await removeRecord(key);
  }
}

export async function purgeExpired(retentionDays: number): Promise<void> {
  const db = await database();
  const records = (await request(db.transaction(RECORDS).objectStore(RECORDS).getAll())) as StoredRecord[];
  const now = Date.now();
  for (const record of records.filter((item) => isExpired(item.saved_at, now, retentionDays))) {
    await removeRecord(record.key);
  }
}

// Đăng xuất: xoá mọi bản ghi và khóa mã hoá
export async function clearAll(): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = await database();
  await request(db.transaction(RECORDS, 'readwrite').objectStore(RECORDS).clear());
  await request(db.transaction(KEYS, 'readwrite').objectStore(KEYS).clear());
}

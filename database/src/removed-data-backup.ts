import { createCipheriv, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { IV_BYTES, MAGIC, SALT_BYTES, deriveKey, readBackup, sha256File, stampOf } from './school-backup.js';
import { readSnapshot, type TableColumns, type TableTotals } from './school-data-copy.js';
import type { RemovedDataBackup } from './removed-data-log.js';
import type { DatabaseDescriptor } from './school-database-layout.js';

export {
  assertRemovedDataBackedUp,
  ensureRemovedDataBackupsTable,
  NOTHING_TO_BACK_UP,
  recordRemovedDataBackup,
} from './removed-data-log.js';

// Sao lưu dữ liệu của chức năng đã bỏ trước khi xóa (YCTD-393; quyết định của Eric ngày 2026-10-30: lệnh riêng xuất từng bảng ra tệp
// nén, mã hóa, ngoài kho mã; ghi số dòng vào bảng sao lưu; database migration xóa bảng từ chối chạy khi chưa có bản ghi sao lưu tương
// ứng). Tệp cùng định dạng mã hóa với bản sao lưu trường (school-backup.ts: gzip, AES-256-GCM, khóa dẫn từ
// BACKUP_ENCRYPTION_PASSPHRASE): dòng đầu là thông tin tệp, mỗi bảng một dòng cột, các dòng dữ liệu dạng văn bản, dòng tổng kiểm.
// Bảng `removed_data_backups` ghi tệp và số dòng, tổng kiểm từng bảng; nằm ở chính cơ sở dữ liệu có bảng bị xóa (cơ sở dữ liệu năm học),
// hoặc ở cơ sở dữ liệu nền tảng khi cả cơ sở dữ liệu bị xóa (cơ sở dữ liệu chợ gia sư)
export const REMOVED_DATA_FORMAT = 'removed-data-backup';
export const REMOVED_DATA_FORMAT_VERSION = 1;

export interface RemovedDataHeader {
  format: typeof REMOVED_DATA_FORMAT;
  version: number;
  created_at: string;
  feature: string;
  database: string;
  tables: string[];
  // Dữ liệu ngoài bảng cần giữ kèm (ví dụ giá trị cấu hình bị xóa)
  extra: Record<string, unknown>;
}

type RemovedDataLine =
  | RemovedDataHeader
  | { table: TableColumns }
  | { r: Array<string | null> }
  | { end: TableTotals }
  | { done: { tables: number; rows: number } };

export type { RemovedDataBackup };

// Mô tả kết nối từ chuỗi kết nối để dùng lại readSnapshot (chỉ cần máy chủ, cơ sở dữ liệu, tài khoản)
export function descriptorFromUrl(connectionString: string): DatabaseDescriptor {
  const url = new URL(connectionString);
  return {
    kind: 'system',
    name: decodeURIComponent(url.pathname.slice(1)),
    layout: 'database',
    host: url.hostname,
    port: Number(url.port || 5432),
    databaseName: decodeURIComponent(url.pathname.slice(1)),
    schemaName: null,
    roleName: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

// Sao lưu các bảng còn có trong cơ sở dữ liệu vào <thư mục>/<chức năng>/<tên cơ sở dữ liệu>-<thời điểm>.sbak, đọc lại kiểm tra số dòng.
// Không bảng nào còn thì trả null (không tạo tệp)
export async function backupTablesBeforeRemoval(options: {
  connectionString: string;
  feature: string;
  tables: readonly string[] | 'all';
  directory: string;
  passphrase: string;
  extra?: Record<string, unknown>;
  now?: Date;
}): Promise<RemovedDataBackup | null> {
  const descriptor = descriptorFromUrl(options.connectionString);
  const now = options.now ?? new Date();
  const folder = join(options.directory, options.feature);
  const finalPath = join(folder, `${descriptor.databaseName}-${stampOf(now)}.sbak`);
  const partialPath = `${finalPath}.dang-ghi`;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(options.passphrase, salt), iv);
  const gzip = createGzip();
  const output = createWriteStream(partialPath, { mode: 0o600 });
  output.write(Buffer.concat([MAGIC, salt, iv]));
  const written = pipeline(gzip, cipher, output, { end: false });
  const writeLine = async (value: RemovedDataLine) => {
    if (!gzip.write(`${JSON.stringify(value)}\n`)) {
      await once(gzip, 'drain');
    }
  };
  try {
    const header: RemovedDataHeader = {
      format: REMOVED_DATA_FORMAT,
      version: REMOVED_DATA_FORMAT_VERSION,
      created_at: now.toISOString(),
      feature: options.feature,
      database: descriptor.databaseName,
      tables: options.tables === 'all' ? [] : [...options.tables],
      extra: options.extra ?? {},
    };
    await writeLine(header);
    let rows = 0;
    const totals = await readSnapshot(
      descriptor,
      {
        table: (info) => writeLine({ table: info }),
        rows: async (_table, page) => {
          for (const values of page) {
            await writeLine({ r: values });
          }
        },
        tableEnd: async (sum) => {
          rows += sum.rows;
          await writeLine({ end: sum });
        },
      },
      options.tables === 'all' ? {} : { tables: options.tables },
    );
    await writeLine({ done: { tables: totals.length, rows } });
    gzip.end();
    await written;
    await new Promise<void>((resolve, reject) => {
      output.end(cipher.getAuthTag(), () => resolve());
      output.once('error', reject);
    });
    if (totals.length === 0 && Object.keys(options.extra ?? {}).length === 0) {
      await rm(partialPath, { force: true });
      return null;
    }
    await rename(partialPath, finalPath);
    const verified = await verifyRemovedDataBackup(finalPath, options.passphrase);
    if (verified.totals.length !== totals.length || verified.rows !== rows) {
      throw new Error('Đọc lại tệp sao lưu không khớp số bảng, số dòng');
    }
    return { file: finalPath, sha256: await sha256File(finalPath), totals };
  } catch (error) {
    gzip.destroy();
    output.destroy();
    await rm(partialPath, { force: true });
    throw error;
  }
}

// Kiểm tra mã xác thực, cấu trúc, số dòng từng bảng của tệp mà không ghi gì
export async function verifyRemovedDataBackup(
  path: string,
  passphrase: string,
): Promise<{ header: RemovedDataHeader; totals: TableTotals[]; rows: number }> {
  let header: RemovedDataHeader | null = null;
  let counted = 0;
  let rows = 0;
  let done = false;
  const totals: TableTotals[] = [];
  await readBackup<RemovedDataLine>(path, passphrase, async (line) => {
    if ('format' in line) {
      header = line;
    } else if ('table' in line) {
      counted = 0;
    } else if ('r' in line) {
      counted += 1;
    } else if ('end' in line) {
      if (line.end.rows !== counted) {
        throw new Error(`Bảng ${line.end.table} có ${counted} dòng trong tệp, ghi ${line.end.rows}`);
      }
      rows += counted;
      totals.push(line.end);
    } else if ('done' in line) {
      done = true;
    }
  });
  const found = header as RemovedDataHeader | null;
  if (!found || found.format !== REMOVED_DATA_FORMAT || !done) {
    throw new Error('Tệp sao lưu thiếu phần đầu hoặc phần cuối');
  }
  return { header: found, totals, rows };
}

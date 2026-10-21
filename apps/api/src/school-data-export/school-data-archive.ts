import { sql, type Kysely } from 'kysely';
import type { Databases } from '../common/databases.js';
import type { FileStorage } from '../files/file-storage.js';
import { ZipWriter } from './zip-writer.js';

// Dựng gói ZIP toàn bộ dữ liệu của trường (DT-18 phần 18h, YCTD-145). Hàm không phụ thuộc người dùng hay màn hình để phần
// DT-SaaS S2 (xuất dữ liệu khi trường rời nền tảng) gọi lại. Gói gồm:
// - du-lieu/<cơ sở dữ liệu>/<bảng>.csv: mọi bảng của cơ sở dữ liệu hệ thống, các cơ sở dữ liệu năm học và phần dữ liệu của
//   dịch vụ định danh; CSV UTF-8 có BOM, ô JSON ghi dạng chuỗi JSON, thời điểm theo ISO 8601;
// - tep/<cơ sở dữ liệu>/<bảng>/<mã>-<tên tệp>: tệp đính kèm lấy từ kho tệp, trong giới hạn dung lượng;
// - manifest.json: thời điểm tạo, người tạo, danh sách bảng, cột, kiểu, số dòng, tệp đã kèm và tệp bỏ qua, cột không xuất;
// - DOC_TRUOC.txt: hướng dẫn đọc gói.
// Không xuất mật khẩu, mã bí mật, khóa kết nối và số định danh đã mã hóa (chỉ còn 4 số cuối đã có ở cột riêng). Lựa chọn do
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11; khi DT-SaaS S2 cần bàn giao số định danh đầy đủ thì thêm tùy chọn
// giải mã với quyền riêng.
export const SCHOOL_DATA_ARCHIVE_VERSION = '1';
export const DEFAULT_ATTACHMENT_LIMIT_BYTES = 512 * 1024 * 1024;
const SKIPPED_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);
const SECRET_COLUMN_NAMES = new Set([
  'password_hash',
  'refresh_token_hash',
  'code_hash',
  'key_hash',
  'key_prefix',
  'national_id_hash',
  'child_national_id_hash',
]);
// Cột chứa khóa tệp ở kho tệp; bảng nhật ký xóa tệp và tệp đã tạo không kèm tệp
const STORAGE_KEY_COLUMNS = [
  'storage_key',
  'signed_storage_key',
  'xml_storage_key',
  'seal_storage_key',
  'attachment_key',
];
const FILE_SKIPPED_TABLES = new Set(['export_jobs', 'archive_file_deletions']);
const FILE_NAME_COLUMNS = ['file_name', 'original_name', 'name'];

export interface ArchiveSource {
  // Nhãn thư mục trong gói, ví dụ he-thong, nam-hoc-2026-2027
  label: string;
  description: string;
  database: Kysely<unknown>;
}

export interface ArchiveTableInfo {
  source: string;
  table: string;
  row_count: number;
  columns: Array<{ name: string; type: string }>;
  omitted_columns: string[];
}

export interface ArchiveManifest {
  format_version: string;
  generated_at: string;
  generated_by: { user_id: string | null; full_name: string };
  sources: Array<{ label: string; description: string }>;
  tables: ArchiveTableInfo[];
  files: { included: number; included_bytes: number; skipped: Array<{ path: string; reason: string }> };
}

export interface ArchiveResult {
  buffer: Buffer;
  manifest: ArchiveManifest;
  rowCount: number;
}

export interface BuildArchiveOptions {
  sources: ArchiveSource[];
  // Bảng của dịch vụ định danh đã lấy sẵn (không có cột bí mật)
  identityTables?: Record<string, Array<Record<string, unknown>>>;
  fileStorage: FileStorage;
  generatedAt: Date;
  generatedBy: { user_id: string | null; full_name: string };
  attachmentLimitBytes?: number;
}

// Nguồn dữ liệu của trường: cơ sở dữ liệu hệ thống và mọi cơ sở dữ liệu năm học đã mở
export async function schoolArchiveSources(databases: Databases): Promise<ArchiveSource[]> {
  const years = await databases.system
    .selectFrom('academic_year_databases')
    .innerJoin('academic_years', 'academic_years.id', 'academic_year_databases.academic_year_id')
    .select(['academic_years.name', 'academic_year_databases.database_name'])
    .orderBy('academic_year_databases.opened_at')
    .execute();
  return [
    { label: 'he-thong', description: 'Cơ sở dữ liệu hệ thống', database: databases.system as Kysely<unknown> },
    ...years.map((year) => ({
      label: `nam-hoc-${slug(year.name)}`,
      description: `Cơ sở dữ liệu năm học ${year.name}`,
      database: databases.schoolYear<unknown>(year.database_name),
    })),
  ];
}

export async function buildSchoolDataArchive(options: BuildArchiveOptions): Promise<ArchiveResult> {
  const zip = new ZipWriter(options.generatedAt);
  const limit = options.attachmentLimitBytes ?? DEFAULT_ATTACHMENT_LIMIT_BYTES;
  const manifest: ArchiveManifest = {
    format_version: SCHOOL_DATA_ARCHIVE_VERSION,
    generated_at: options.generatedAt.toISOString(),
    generated_by: options.generatedBy,
    sources: [],
    tables: [],
    files: { included: 0, included_bytes: 0, skipped: [] },
  };
  let rowCount = 0;
  const usedLabels = new Set<string>();

  for (const source of options.sources) {
    const label = uniqueLabel(source.label, usedLabels);
    manifest.sources.push({ label, description: source.description });
    for (const table of await listTables(source.database)) {
      const columns = await listColumns(source.database, table);
      const result = await sql<Record<string, unknown>>`select * from ${sql.table(table)}`.execute(source.database);
      const exported = columns.filter((column) => !isSecretColumn(column.name));
      zip.add(
        `du-lieu/${label}/${table}.csv`,
        toCsv(
          exported.map((column) => column.name),
          result.rows,
        ),
      );
      rowCount += result.rows.length;
      manifest.tables.push({
        source: label,
        table,
        row_count: result.rows.length,
        columns: exported,
        omitted_columns: columns.filter((column) => isSecretColumn(column.name)).map((column) => column.name),
      });
      if (!FILE_SKIPPED_TABLES.has(table)) {
        await addAttachments(zip, options.fileStorage, label, table, columns, result.rows, manifest, limit);
      }
    }
  }

  if (options.identityTables) {
    const label = uniqueLabel('dinh-danh', usedLabels);
    manifest.sources.push({ label, description: 'Dữ liệu tài khoản, vai trò, quyền của dịch vụ định danh' });
    for (const [table, rows] of Object.entries(options.identityTables)) {
      const names = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((name) => !isSecretColumn(name));
      zip.add(`du-lieu/${label}/${table}.csv`, toCsv(names, rows));
      rowCount += rows.length;
      manifest.tables.push({
        source: label,
        table,
        row_count: rows.length,
        columns: names.map((name) => ({ name, type: 'json' })),
        omitted_columns: [],
      });
    }
  }

  zip.add('manifest.json', JSON.stringify(manifest, null, 2));
  zip.add('DOC_TRUOC.txt', readme(manifest));
  return { buffer: zip.finish(), manifest, rowCount };
}

async function addAttachments(
  zip: ZipWriter,
  fileStorage: FileStorage,
  label: string,
  table: string,
  columns: Array<{ name: string }>,
  rows: Array<Record<string, unknown>>,
  manifest: ArchiveManifest,
  limit: number,
): Promise<void> {
  const keyColumns = STORAGE_KEY_COLUMNS.filter((name) => columns.some((column) => column.name === name));
  if (keyColumns.length === 0) {
    return;
  }
  const nameColumn = FILE_NAME_COLUMNS.find((name) => columns.some((column) => column.name === name));
  for (const row of rows) {
    for (const keyColumn of keyColumns) {
      const key = row[keyColumn];
      if (typeof key !== 'string' || key === '') {
        continue;
      }
      const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : slug(key);
      const fileName = safeFileName(
        nameColumn && typeof row[nameColumn] === 'string' ? (row[nameColumn] as string) : key,
      );
      const suffix = keyColumn === 'storage_key' ? '' : `-${keyColumn}`;
      const path = `tep/${label}/${table}/${id}${suffix}-${fileName}`;
      if (manifest.files.included_bytes >= limit) {
        manifest.files.skipped.push({ path, reason: 'Vượt dung lượng tệp đính kèm tối đa của gói' });
        continue;
      }
      let content: Buffer;
      try {
        content = await fileStorage.get(key);
      } catch {
        manifest.files.skipped.push({ path, reason: 'Không đọc được tệp ở kho tệp' });
        continue;
      }
      if (manifest.files.included_bytes + content.length > limit) {
        manifest.files.skipped.push({ path, reason: 'Vượt dung lượng tệp đính kèm tối đa của gói' });
        continue;
      }
      zip.add(path, content);
      manifest.files.included += 1;
      manifest.files.included_bytes += content.length;
    }
  }
}

async function listTables(database: Kysely<unknown>): Promise<string[]> {
  const result = await sql<{ table_name: string }>`select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`.execute(database);
  return result.rows.map((row) => row.table_name).filter((name) => !SKIPPED_TABLES.has(name));
}

async function listColumns(database: Kysely<unknown>, table: string): Promise<Array<{ name: string; type: string }>> {
  const result = await sql<{ column_name: string; data_type: string }>`select column_name, data_type
    from information_schema.columns where table_schema = 'public' and table_name = ${table}
    order by ordinal_position`.execute(database);
  return result.rows.map((row) => ({ name: row.column_name, type: row.data_type }));
}

export function isSecretColumn(name: string): boolean {
  return SECRET_COLUMN_NAMES.has(name) || name.endsWith('_encrypted');
}

// CSV theo RFC 4180, có BOM để Excel đọc đúng tiếng Việt
export function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(cellText(row[column]))).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function csvCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'khong-ten'
  );
}

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).at(-1) ?? name;
  // Bỏ ký tự điều khiển và ký tự không dùng được trong tên tệp
  const cleaned = [...base].map((character) => (character < ' ' || '<>:"|?*'.includes(character) ? '_' : character));
  return cleaned.join('').slice(0, 120) || 'tep';
}

function uniqueLabel(label: string, used: Set<string>): string {
  let candidate = label;
  for (let index = 2; used.has(candidate); index += 1) {
    candidate = `${label}-${index}`;
  }
  used.add(candidate);
  return candidate;
}

function readme(manifest: ArchiveManifest): string {
  return [
    'GÓI TOÀN BỘ DỮ LIỆU CỦA TRƯỜNG',
    '',
    `Tạo lúc: ${manifest.generated_at} (giờ UTC), người tạo: ${manifest.generated_by.full_name}.`,
    '',
    '- Thư mục du-lieu: mỗi cơ sở dữ liệu một thư mục, mỗi bảng một tệp CSV (UTF-8, dấu phẩy, dòng đầu là tên cột).',
    '  Ô có cấu trúc ghi dạng JSON; thời điểm theo ISO 8601 giờ UTC.',
    '- Thư mục tep: tệp đính kèm theo bảng và mã dòng.',
    '- manifest.json: danh sách bảng, cột, kiểu dữ liệu, số dòng, tệp đã kèm và tệp bỏ qua.',
    '',
    'Gói không có mật khẩu, mã bí mật, khóa kết nối và số định danh đã mã hóa.',
    'Gói có dữ liệu cá nhân của trẻ, phụ huynh và nhân sự: lưu ở nơi an toàn, xóa khi không còn dùng (Nghị định 13/2023/NĐ-CP).',
    '',
  ].join('\r\n');
}

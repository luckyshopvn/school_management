import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { decryptSecret, validateSchoolCode } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { BackupRunKind, PlatformDatabase, SchoolDatabaseKind, SchoolDataClassValue } from '../platform/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { migrateToLatest } from './migrate.js';
import { dropSchool, registerDescriptor, storeSchoolKeys, writeAudit } from './provision-school.js';
import {
  assertTotalsMatch,
  loadDatabase,
  readSnapshot,
  type TableColumns,
  type TableTotals,
} from './school-data-copy.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  schoolSlug,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import type { Actor } from './school-lifecycle.js';

// Sao lưu và khôi phục theo từng trường (DT-SaaS phần S7b, YCTD-199; tài liệu 47 mục 14.5 "S7b"). Sao lưu logic viết bằng Node,
// không phụ thuộc phiên bản pg_dump, chạy được ở cả bố cục database và schema, qua bộ gom kết nối của Neon, Supabase:
// - một tệp `<thư mục>/<mã trường>/<thời điểm>-<phạm vi>.sbak` cho mỗi lần sao lưu một trường: các dòng JSON (thông tin trường,
//   khóa dữ liệu trẻ, tên miền, rồi từng cơ sở dữ liệu, từng bảng, các dòng dạng văn bản và tổng kiểm) nén gzip, mã hóa
//   AES-256-GCM bằng khóa dẫn từ BACKUP_ENCRYPTION_PASSPHRASE (scrypt, muối ngẫu nhiên); mỗi cơ sở dữ liệu đọc trong một ảnh chụp
//   REPEATABLE READ;
// - phạm vi `all` (mọi năm học, chạy hằng ngày) hoặc `active` (định danh, hệ thống, năm học còn ghi được, chạy hằng giờ);
// - khôi phục kiểm tra mã xác thực của cả tệp trước khi ghi; vào chính trường đó (trường phải đang tạm dừng) hoặc vào một trường
//   mới (mã khác, để xem lại) mà không đụng trường khác; so số dòng, tổng kiểm từng bảng với bản sao lưu;
// - diễn tập: khôi phục vào trường tạm, kiểm tra, đo thời gian (bằng chứng RTO), gỡ trường tạm, ghi `backup_runs`.
// Tệp ở kho tệp của trường (tenants/<tiền tố>/) sao lưu bằng rclone ở backup.sh, không nằm trong tệp này.
export const BACKUP_FORMAT = 'school-backup';
export const BACKUP_FORMAT_VERSION = 1;
const MAGIC = Buffer.from('SMBK1\n');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type BackupScope = 'all' | 'active';

export interface BackupHeader {
  format: typeof BACKUP_FORMAT;
  version: number;
  created_at: string;
  scope: BackupScope;
  school: {
    code: string;
    name: string;
    status: string;
    data_class: SchoolDataClassValue;
    key_prefix: string;
    year_database_prefix: string;
    address: string | null;
    school_levels: unknown;
    first_academic_year: string | null;
  };
  // Khóa dữ liệu trẻ của trường (base64), chỉ nằm trong tệp đã mã hóa
  keys: { encryption: string; hash: string } | null;
  domains: Array<{ host: string; kind: string; status: string }>;
  databases: Array<{ kind: SchoolDatabaseKind; name: string; status: string }>;
}

export interface BackupSummary {
  file: string;
  bytes: number;
  sha256: string;
  databases: number;
  tables: number;
  rows: number;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (passphrase.length < 16) {
    throw new Error('BACKUP_ENCRYPTION_PASSPHRASE phải có ít nhất 16 ký tự');
  }
  return scryptSync(passphrase, salt, 32);
}

function stampOf(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export async function startBackupRun(
  platform: Kysely<PlatformDatabase>,
  values: { schoolId: string | null; code: string; kind: BackupRunKind; actor: Actor },
): Promise<string> {
  const row = await platform
    .insertInto('backup_runs')
    .values({
      school_id: values.schoolId,
      school_code: values.code,
      kind: values.kind,
      actor_type: values.actor.type,
      actor_id: values.actor.id ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function finishBackupRun(
  platform: Kysely<PlatformDatabase>,
  id: string,
  values: {
    status: 'done' | 'failed';
    schoolId?: string | null;
    file?: string | null;
    bytes?: number | null;
    sha256?: string | null;
    databases?: number | null;
    tables?: number | null;
    rows?: number | null;
    details?: Record<string, unknown>;
    error?: string | null;
  },
): Promise<void> {
  await platform
    .updateTable('backup_runs')
    .set({
      status: values.status,
      ...(values.schoolId !== undefined ? { school_id: values.schoolId } : {}),
      file_name: values.file ?? null,
      file_bytes: values.bytes ?? null,
      file_sha256: values.sha256 ?? null,
      databases: values.databases ?? null,
      tables: values.tables ?? null,
      rows: values.rows ?? null,
      details: JSON.stringify(values.details ?? {}),
      error: values.error ? values.error.slice(0, 2000) : null,
      finished_at: new Date(),
    })
    .where('id', '=', id)
    .execute();
}

// ---------------------------------------------------------------------------------------------------------------------
// Sao lưu
// ---------------------------------------------------------------------------------------------------------------------

export async function backupSchool(options: {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  code: string;
  passphrase: string;
  directory: string;
  scope?: BackupScope;
  actor: Actor;
  now?: Date;
  // Đọc dữ liệu ở máy chủ khác địa chỉ ghi trong mô tả kết nối: bản khôi phục tạm của cả cụm khi lấy riêng một trường về một
  // thời điểm (PITR.md); cùng tên cơ sở dữ liệu, vai trò, mật khẩu
  sourceHost?: { host: string; port: number } | null;
}): Promise<BackupSummary> {
  const { platform, code } = options;
  const scope = options.scope ?? 'all';
  const school = await platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
  if (!school || school.status === 'deleted' || school.status === 'provisioning') {
    throw new Error(`Không có trường ${code} đang có dữ liệu để sao lưu`);
  }
  const runId = await startBackupRun(platform, { schoolId: school.id, code, kind: 'backup', actor: options.actor });
  const now = options.now ?? new Date();
  const relative = join(code, `${stampOf(now)}-${scope}.sbak`);
  const finalPath = join(options.directory, relative);
  const partialPath = `${finalPath}.dang-ghi`;
  try {
    await mkdir(join(options.directory, code), { recursive: true, mode: 0o700 });
    const keys = await platform
      .selectFrom('school_keys')
      .selectAll()
      .where('school_id', '=', school.id)
      .executeTakeFirst();
    const rows = await platform
      .selectFrom('school_databases')
      .selectAll()
      .where('school_id', '=', school.id)
      .where('status', '!=', 'dropped')
      .execute();
    const order: SchoolDatabaseKind[] = ['identity', 'system', 'school-year'];
    const selected = rows
      .filter((row) => scope === 'all' || row.status !== 'read_only')
      .sort(
        (left, right) => order.indexOf(left.kind) - order.indexOf(right.kind) || left.name.localeCompare(right.name),
      );
    const domains = await platform
      .selectFrom('school_domains')
      .select(['host', 'kind', 'status'])
      .where('school_id', '=', school.id)
      .execute();
    const header: BackupHeader = {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      created_at: now.toISOString(),
      scope,
      school: {
        code: school.code,
        name: school.name,
        status: school.status,
        data_class: school.data_class,
        key_prefix: school.key_prefix,
        year_database_prefix: school.year_database_prefix,
        address: school.address,
        school_levels: school.school_levels,
        first_academic_year: school.first_academic_year,
      },
      keys: keys
        ? {
            encryption: decryptSecret(options.masterKey, keys.child_encryption_key_encrypted),
            hash: decryptSecret(options.masterKey, keys.child_hash_key_encrypted),
          }
        : null,
      domains,
      databases: selected.map((row) => ({ kind: row.kind, name: row.name, status: row.status })),
    };

    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', deriveKey(options.passphrase, salt), iv);
    const gzip = createGzip();
    const output = createWriteStream(partialPath, { mode: 0o600 });
    output.write(Buffer.concat([MAGIC, salt, iv]));
    const written = pipeline(gzip, cipher, output, { end: false });
    const writeLine = async (value: unknown) => {
      if (!gzip.write(`${JSON.stringify(value)}\n`)) {
        await once(gzip, 'drain');
      }
    };
    await writeLine(header);
    let tables = 0;
    let totalRows = 0;
    for (const row of selected) {
      await writeLine({ database: { kind: row.kind, name: row.name } });
      const descriptor = descriptorFromRow(row, options.masterKey);
      await readSnapshot(options.sourceHost ? { ...descriptor, ...options.sourceHost } : descriptor, {
        table: (info) => writeLine({ table: info }),
        rows: async (_table, page) => {
          for (const values of page) {
            await writeLine({ r: values });
          }
        },
        tableEnd: async (totals) => {
          tables += 1;
          totalRows += totals.rows;
          await writeLine({ end: totals });
        },
      });
    }
    await writeLine({ done: { tables, rows: totalRows } });
    gzip.end();
    await written;
    await new Promise<void>((resolve, reject) => {
      output.end(cipher.getAuthTag(), () => resolve());
      output.once('error', reject);
    });
    await rename(partialPath, finalPath);
    const bytes = (await stat(finalPath)).size;
    const sha256 = await sha256File(finalPath);
    // Đọc lại cả tệp, kiểm tra mã xác thực và số bảng, dòng trước khi báo xong
    const verified = await verifyBackup(finalPath, options.passphrase);
    if (verified.tables !== tables || verified.rows !== totalRows) {
      throw new Error('Đọc lại tệp sao lưu không khớp số bảng, số dòng');
    }
    await finishBackupRun(platform, runId, {
      status: 'done',
      file: relative.replaceAll('\\', '/'),
      bytes,
      sha256,
      databases: selected.length,
      tables,
      rows: totalRows,
      details: { scope },
    });
    return { file: finalPath, bytes, sha256, databases: selected.length, tables, rows: totalRows };
  } catch (error) {
    await rm(partialPath, { force: true });
    await finishBackupRun(platform, runId, { status: 'failed', error: messageOf(error), details: { scope } });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Đọc tệp sao lưu
// ---------------------------------------------------------------------------------------------------------------------

type BackupLine =
  | BackupHeader
  | { database: { kind: SchoolDatabaseKind; name: string } }
  | { table: TableColumns }
  | { r: Array<string | null> }
  | { end: TableTotals }
  | { done: { tables: number; rows: number } };

// Giải mã, giải nén, gọi onLine cho từng dòng. Mã xác thực GCM chỉ được kiểm ở cuối tệp: khôi phục luôn gọi verifyBackup trước
// khi ghi vào đâu
async function readBackup(
  path: string,
  passphrase: string,
  onLine: (line: BackupLine) => Promise<void>,
): Promise<void> {
  const size = (await stat(path)).size;
  const handle = await open(path, 'r');
  const prefix = Buffer.alloc(MAGIC.length + SALT_BYTES + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(prefix, 0, prefix.length, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!prefix.subarray(0, MAGIC.length).equals(MAGIC) || size < prefix.length + TAG_BYTES) {
    throw new Error('Tệp không phải bản sao lưu trường (sai đầu tệp)');
  }
  const salt = prefix.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = prefix.subarray(MAGIC.length + SALT_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  const text = new PassThrough();
  const reading = pipeline(
    createReadStream(path, { start: prefix.length, end: size - TAG_BYTES - 1 }),
    decipher,
    createGunzip(),
    text,
  );
  const lines = createInterface({ input: text, crlfDelay: Infinity });
  const consuming = (async () => {
    for await (const line of lines) {
      if (line) {
        await onLine(JSON.parse(line) as BackupLine);
      }
    }
  })();
  const results = await Promise.allSettled([reading, consuming]);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) {
    throw new Error(`Không đọc được tệp sao lưu (sai khóa hoặc tệp hỏng): ${messageOf(failure.reason)}`);
  }
}

export interface BackupContents {
  header: BackupHeader;
  tables: number;
  rows: number;
  totals: Map<string, TableTotals[]>;
}

// Kiểm tra toàn bộ tệp (mã xác thực, cấu trúc, số dòng từng bảng) mà không ghi gì
export async function verifyBackup(path: string, passphrase: string): Promise<BackupContents> {
  let header: BackupHeader | null = null;
  let database = '';
  let counted = 0;
  let done: { tables: number; rows: number } | null = null;
  const totals = new Map<string, TableTotals[]>();
  await readBackup(path, passphrase, async (line) => {
    if ('format' in line) {
      header = line;
    } else if ('database' in line) {
      database = `${line.database.kind}:${line.database.name}`;
      totals.set(database, []);
    } else if ('table' in line) {
      counted = 0;
    } else if ('r' in line) {
      counted += 1;
    } else if ('end' in line) {
      if (line.end.rows !== counted) {
        throw new Error(`Bảng ${line.end.table} có ${counted} dòng trong tệp, ghi ${line.end.rows}`);
      }
      totals.get(database)?.push(line.end);
    } else if ('done' in line) {
      done = line.done;
    }
  });
  const found = header as BackupHeader | null;
  const finished = done as { tables: number; rows: number } | null;
  if (!found || found.format !== BACKUP_FORMAT || !finished) {
    throw new Error('Tệp sao lưu thiếu phần đầu hoặc phần cuối');
  }
  return { header: found, tables: finished.tables, rows: finished.rows, totals };
}

// ---------------------------------------------------------------------------------------------------------------------
// Khôi phục
// ---------------------------------------------------------------------------------------------------------------------

export interface RestoreEnvironment {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  layout: SchoolDatabaseLayout;
  // Tên miền hệ thống: trường khôi phục thành trường mới có tên miền <mã mới>.<tên miền hệ thống>
  systemDomain: string | null;
}

export type RestoreTarget = { mode: 'in-place' } | { mode: 'new'; code: string; name?: string };

export interface RestoreResult {
  code: string;
  schoolId: string;
  databases: number;
  tables: number;
  rows: number;
  durationMilliseconds: number;
}

// Nạp từng cơ sở dữ liệu trong tệp vào đích (đã migrate): mỗi cơ sở dữ liệu một giao dịch, một lần đọc tệp chỉ lấy phần của
// cơ sở dữ liệu đó, rồi so tổng kiểm với bản sao lưu
async function loadFromBackup(
  path: string,
  passphrase: string,
  contents: BackupContents,
  resolveTarget: (kind: SchoolDatabaseKind, name: string) => Promise<DatabaseDescriptor>,
): Promise<void> {
  for (const database of contents.header.databases) {
    const key = `${database.kind}:${database.name}`;
    const descriptor = await resolveTarget(database.kind, database.name);
    const actual = await loadDatabase(descriptor, async (loader) => {
      let inside = false;
      let table = '';
      let pending: Array<Array<string | null>> = [];
      const flush = async () => {
        if (pending.length > 0) {
          await loader.rows(table, pending);
          pending = [];
        }
      };
      await readBackup(path, passphrase, async (line) => {
        if ('database' in line) {
          await flush();
          inside = `${line.database.kind}:${line.database.name}` === key;
        } else if (!inside) {
          return;
        } else if ('table' in line) {
          await flush();
          table = line.table.table;
          await loader.table(line.table);
        } else if ('r' in line) {
          pending.push(line.r);
          if (pending.length >= 200) {
            await flush();
          }
        } else {
          await flush();
        }
      });
    });
    assertTotalsMatch(key, contents.totals.get(key) ?? [], actual);
  }
}

async function createTargetDatabase(
  environment: RestoreEnvironment,
  schoolId: string,
  schoolCode: string,
  kind: SchoolDatabaseKind,
  logicalName: string,
  physicalName: string,
  schoolRolePassword: string,
): Promise<DatabaseDescriptor> {
  const descriptor = await environment.layout.create({
    schoolCode,
    kind,
    logicalName,
    physicalName,
    schoolRolePassword,
  });
  await registerDescriptor(environment.platform, environment.masterKey, schoolId, descriptor);
  const migration = await migrateToLatest(kind, connectionStringOf(descriptor));
  if (migration.error) {
    throw migration.error;
  }
  return descriptor;
}

export async function restoreSchool(options: {
  environment: RestoreEnvironment;
  file: string;
  passphrase: string;
  target: RestoreTarget;
  actor: Actor;
  kind?: 'restore' | 'drill';
}): Promise<RestoreResult> {
  const { environment, actor } = options;
  const { platform } = environment;
  const started = Date.now();
  const contents = await verifyBackup(options.file, options.passphrase);
  const header = contents.header;
  const code = options.target.mode === 'new' ? options.target.code : header.school.code;
  const runId = await startBackupRun(platform, { schoolId: null, code, kind: options.kind ?? 'restore', actor });
  try {
    let schoolId: string;
    let resolveTarget: (kind: SchoolDatabaseKind, name: string) => Promise<DatabaseDescriptor>;
    const rolePassword = generatePassword();
    if (options.target.mode === 'in-place') {
      const school = await platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
      if (!school) {
        throw new Error(`Không có trường ${code} để khôi phục vào chính nó; khôi phục thành trường mới`);
      }
      if (school.status !== 'suspended') {
        throw new Error('Tạm dừng trường trước khi khôi phục vào chính nó (dữ liệu hiện có sẽ bị thay)');
      }
      schoolId = school.id;
      if (header.keys) {
        await platform.deleteFrom('school_keys').where('school_id', '=', school.id).execute();
        await storeSchoolKeys(platform, environment.masterKey, school.id, {
          encryption: Buffer.from(header.keys.encryption, 'base64'),
          hash: Buffer.from(header.keys.hash, 'base64'),
        });
      }
      resolveTarget = async (kind, name) => {
        const row = await platform
          .selectFrom('school_databases')
          .selectAll()
          .where('school_id', '=', school.id)
          .where('kind', '=', kind)
          .where('name', '=', name)
          .where('status', '!=', 'dropped')
          .executeTakeFirst();
        return row
          ? descriptorFromRow(row, environment.masterKey)
          : createTargetDatabase(environment, school.id, school.code, kind, name, name, rolePassword);
      };
    } else {
      const problem = validateSchoolCode(code);
      if (problem) {
        throw new Error(problem);
      }
      if (await platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst()) {
        throw new Error(`Mã trường ${code} đã có`);
      }
      const slug = schoolSlug(code);
      const yearPrefix = `s_${slug}_year_`;
      const oldPrefix = header.school.year_database_prefix;
      const created = await platform
        .insertInto('schools')
        .values({
          code,
          name: options.target.name ?? `${header.school.name} (bản khôi phục ${header.created_at.slice(0, 10)})`,
          status: 'provisioning',
          data_class: header.school.data_class,
          key_prefix: code,
          year_database_prefix: yearPrefix,
          address: header.school.address,
          school_levels: JSON.stringify(header.school.school_levels ?? []),
          first_academic_year: header.school.first_academic_year,
          notes: `Khôi phục từ bản sao lưu của trường ${header.school.code} lúc ${header.created_at}`,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      schoolId = created.id;
      if (header.keys) {
        await storeSchoolKeys(platform, environment.masterKey, created.id, {
          encryption: Buffer.from(header.keys.encryption, 'base64'),
          hash: Buffer.from(header.keys.hash, 'base64'),
        });
      }
      resolveTarget = async (kind, name) => {
        const logical =
          kind === 'school-year' && name.startsWith(oldPrefix) ? `${yearPrefix}${name.slice(oldPrefix.length)}` : name;
        const physical = kind === 'identity' ? `s_${slug}_identity` : kind === 'system' ? `s_${slug}_system` : logical;
        return createTargetDatabase(environment, created.id, code, kind, logical, physical, rolePassword);
      };
      await loadFromBackup(options.file, options.passphrase, contents, resolveTarget);
      // Tên cơ sở dữ liệu năm học ghi trong cơ sở dữ liệu hệ thống đổi theo tiền tố của trường mới
      const system = await platform
        .selectFrom('school_databases')
        .selectAll()
        .where('school_id', '=', created.id)
        .where('kind', '=', 'system')
        .executeTakeFirst();
      if (system) {
        const database = createDatabase<SystemDatabase>(
          connectionStringOf(descriptorFromRow(system, environment.masterKey)),
          { max: 1 },
        );
        try {
          await sql`update academic_year_databases
            set database_name = ${yearPrefix} || substr(database_name, ${oldPrefix.length + 1})
            where starts_with(database_name, ${oldPrefix})`.execute(database);
        } finally {
          await database.destroy();
        }
      }
      if (environment.systemDomain) {
        await platform
          .insertInto('school_domains')
          .values({
            school_id: created.id,
            host: `${code}.${environment.systemDomain}`,
            status: 'active',
            verified_at: new Date(),
          })
          .execute();
      }
      await platform
        .updateTable('schools')
        .set({ status: 'suspended', suspended_at: new Date() })
        .where('id', '=', created.id)
        .execute();
    }
    if (options.target.mode === 'in-place') {
      await loadFromBackup(options.file, options.passphrase, contents, resolveTarget);
    }

    const result: RestoreResult = {
      code,
      schoolId,
      databases: contents.header.databases.length,
      tables: contents.tables,
      rows: contents.rows,
      durationMilliseconds: Date.now() - started,
    };
    await finishBackupRun(platform, runId, {
      status: 'done',
      schoolId,
      file: options.file.split(/[\\/]/).slice(-2).join('/'),
      databases: result.databases,
      tables: result.tables,
      rows: result.rows,
      details: {
        source_code: header.school.code,
        backup_created_at: header.created_at,
        mode: options.target.mode,
        duration_ms: result.durationMilliseconds,
      },
    });
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: options.kind === 'drill' ? 'school.restore-drill' : 'school.restore',
      schoolId,
      details: { source: header.school.code, backup_created_at: header.created_at, mode: options.target.mode },
    });
    return result;
  } catch (error) {
    await finishBackupRun(platform, runId, {
      status: 'failed',
      error: messageOf(error),
      details: { mode: options.target.mode },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Diễn tập, danh sách tệp
// ---------------------------------------------------------------------------------------------------------------------

// Khôi phục thử vào một trường tạm (không phục vụ, không tên miền), kiểm số dòng và tổng kiểm, đo thời gian, gỡ trường tạm
export async function drillRestore(options: {
  environment: RestoreEnvironment;
  file: string;
  passphrase: string;
  actor: Actor;
}): Promise<RestoreResult> {
  const code = `drill-${randomBytes(4).toString('hex')}`;
  const environment = { ...options.environment, systemDomain: null };
  try {
    const result = await restoreSchool({
      environment,
      file: options.file,
      passphrase: options.passphrase,
      target: { mode: 'new', code, name: `Diễn tập khôi phục ${new Date().toISOString().slice(0, 10)}` },
      actor: options.actor,
      kind: 'drill',
    });
    return result;
  } finally {
    const leftover = await environment.platform
      .selectFrom('schools')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirst();
    if (leftover) {
      await dropSchool({ ...environment, schoolId: leftover.id });
    }
  }
}

// Tệp sao lưu mới nhất của một trường trong thư mục (tên tệp bắt đầu bằng thời điểm UTC nên sắp theo tên)
export async function latestBackupFile(directory: string, code: string): Promise<string | null> {
  try {
    const files = (await readdir(join(directory, code))).filter((name) => name.endsWith('.sbak')).sort();
    const last = files.at(-1);
    return last ? join(directory, code, last) : null;
  } catch {
    return null;
  }
}

// Xóa tệp sao lưu cùng phạm vi cũ hơn số ngày giữ, luôn giữ bản mới nhất của phạm vi đó
export async function pruneBackups(
  directory: string,
  code: string,
  keepDays: number,
  scope: BackupScope,
  now = new Date(),
): Promise<number> {
  let files: string[];
  try {
    files = (await readdir(join(directory, code))).filter((name) => name.endsWith(`-${scope}.sbak`)).sort();
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of files.slice(0, -1)) {
    const path = join(directory, code, name);
    if ((await stat(path)).mtime.getTime() < now.getTime() - keepDays * 86_400_000) {
      await rm(path);
      removed += 1;
    }
  }
  return removed;
}

import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from './connection.js';
import { dropDatabaseIfExists } from './database-administration.js';
import { replaceDatabaseName } from './environment.js';
import { migrateToLatest, type DatabaseKind } from './migrate.js';

// Cơ sở dữ liệu mẫu đã chạy mọi tệp thay đổi cấu trúc, chỉ dùng cho kiểm thử: chạy 92 tệp của cơ sở dữ liệu năm học mất 25 đến 40
// giây, sao bằng CREATE DATABASE ... TEMPLATE dưới một giây. Tên mẫu mang dấu vân tay của mã tệp thay đổi cấu trúc đã dịch nên đổi
// tệp là dựng mẫu mới; mẫu cũ để lại không ảnh hưởng (gỡ bằng lệnh ở tài liệu quy trình kiểm thử). Cơ sở dữ liệu sao xong vẫn qua
// migrateToLatest như thường, khi đó không còn tệp nào chưa chạy
const TEMPLATE_PREFIX = 'school_tpl_';
const DUPLICATE_DATABASE = '42P04';
const SOURCE_IN_USE = '55006';
const UNIQUE_VIOLATION = '23505';

const templateNames = new Map<string, Promise<string>>();

// Kết nối vừa đóng có thể còn được máy chủ tính thêm ít lâu (mã 55006 khi đổi tên hoặc sao cơ sở dữ liệu); thử lại
async function retryWhileInUse(work: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await work();
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== SOURCE_IN_USE || attempt >= 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

// Dấu vân tay của thư mục tệp thay đổi cấu trúc đã dịch (kèm dữ liệu khởi tạo), tệp đặt múi giờ dùng chung và vai trò sở hữu (mọi
// đối tượng trong bản sao giữ chủ của mẫu)
async function templateFingerprint(kind: DatabaseKind, owner: string): Promise<string> {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = [
    ...(await listFiles(join(root, kind))),
    fileURLToPath(new URL('./timezone.js', import.meta.url)),
    fileURLToPath(new URL('./migrate.js', import.meta.url)),
  ];
  const hash = createHash('sha256');
  hash.update(owner);
  for (const file of files) {
    hash.update(relative(root, file).replaceAll('\\', '/'));
    hash.update(await readFile(file));
  }
  return hash.digest('hex').slice(0, 12);
}

export interface MigratedTestDatabaseOptions {
  // Tài khoản quản trị tạo cơ sở dữ liệu thay cho vai trò sở hữu khi vai trò đó không có quyền tạo (identity_service)
  adminUrl?: string;
}

interface TemplateTarget {
  // Chuỗi kết nối của vai trò sở hữu, dùng để chạy tệp thay đổi cấu trúc
  connectionString: string;
  owner: string;
  // Kết nối dùng để tạo, đổi tên, sao cơ sở dữ liệu
  creatorUrl: string;
  viaAdmin: boolean;
}

function targetOf(connectionString: string, options: MigratedTestDatabaseOptions): TemplateTarget {
  return {
    connectionString,
    owner: decodeURIComponent(new URL(connectionString).username),
    creatorUrl: options.adminUrl ?? connectionString,
    viaAdmin: options.adminUrl !== undefined,
  };
}

async function withConnection<T>(url: string, work: (database: Kysely<unknown>) => Promise<T>): Promise<T> {
  const database = createDatabase<unknown>(url, { max: 1 });
  try {
    return await work(database);
  } finally {
    await database.destroy();
  }
}

async function createOwnedDatabase(
  target: TemplateTarget,
  databaseName: string,
  templateName: string | null,
): Promise<void> {
  await withConnection(target.creatorUrl, async (database) => {
    const owner = target.viaAdmin ? sql` owner ${sql.id(target.owner)}` : sql``;
    const template = templateName ? sql` template ${sql.id(templateName)}` : sql``;
    await retryWhileInUse(() => sql`create database ${sql.id(databaseName)}${owner}${template}`.execute(database));
    if (templateName) {
      const settings = await sql<{ setting: string }>`
        select unnest(s.setconfig) as setting
        from pg_db_role_setting s
        join pg_database d on d.oid = s.setdatabase
        where d.datname = ${templateName} and s.setrole = 0`.execute(database);
      for (const { setting } of settings.rows) {
        const separator = setting.indexOf('=');
        await sql`alter database ${sql.id(databaseName)} set ${sql.id(setting.slice(0, separator))} to ${sql.lit(setting.slice(separator + 1))}`.execute(
          database,
        );
      }
    }
    // Chỉ vai trò sở hữu kết nối được, giống createEmptyDatabase
    await sql`revoke connect on database ${sql.id(databaseName)} from public`.execute(database);
  });
}

// Dựng mẫu dưới tên tạm rồi đổi tên: nhiều tiến trình kiểm thử cùng dựng thì một bản thắng, bản còn lại tự gỡ
async function buildTemplate(target: TemplateTarget, kind: DatabaseKind, templateName: string): Promise<void> {
  const buildingName = `${templateName}_b${randomUUID().replaceAll('-', '').slice(0, 6)}`;
  await createOwnedDatabase(target, buildingName, null);
  try {
    const migration = await migrateToLatest(kind, replaceDatabaseName(target.connectionString, buildingName));
    if (migration.error) {
      throw migration.error;
    }
    await withConnection(target.creatorUrl, (database) =>
      retryWhileInUse(() =>
        sql`alter database ${sql.id(buildingName)} rename to ${sql.id(templateName)}`.execute(database),
      ),
    );
  } catch (error) {
    await dropDatabaseIfExists(target.creatorUrl, buildingName);
    if (!isDuplicateDatabase(error)) {
      throw error;
    }
  }
}

// Hai tiến trình cùng đổi tên về một tên: bên thua nhận 42P04, hoặc 23505 (vi phạm chỉ mục duy nhất pg_database_datname_index)
// khi hai lệnh chạy chồng lên nhau qua bước kiểm tra trùng của máy chủ
function isDuplicateDatabase(error: unknown): boolean {
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === DUPLICATE_DATABASE || (code === UNIQUE_VIOLATION && constraint === 'pg_database_datname_index');
}

async function templateExists(database: Kysely<unknown>, templateName: string): Promise<boolean> {
  const result = await sql<{ found: boolean }>`
    select exists(select 1 from pg_database where datname = ${templateName}) as found`.execute(database);
  return result.rows[0]?.found === true;
}

async function templateFor(target: TemplateTarget, kind: DatabaseKind): Promise<string> {
  const key = `${kind}|${target.connectionString}|${target.creatorUrl}`;
  let pending = templateNames.get(key);
  if (!pending) {
    pending = (async () => {
      const templateName = `${TEMPLATE_PREFIX}${kind.replace('-', '_')}_${await templateFingerprint(kind, target.owner)}`;
      // Các tệp kiểm thử chạy song song (--test-concurrency) là các tiến trình riêng: giữ khóa tư vấn theo tên mẫu trên một kết
      // nối trong lúc kiểm tra và dựng, để chỉ một tiến trình dựng, các tiến trình khác chờ rồi dùng mẫu đã có (lỗi chập chờn cũ:
      // hai tiến trình cùng dựng, bên thua nhận 23505 và cả bộ kiểm thử năm học hỏng)
      await withConnection(target.creatorUrl, async (database) => {
        await sql`select pg_advisory_lock(hashtext(${templateName}))`.execute(database);
        try {
          if (!(await templateExists(database, templateName))) {
            await buildTemplate(target, kind, templateName);
          }
        } finally {
          await sql`select pg_advisory_unlock(hashtext(${templateName}))`.execute(database);
        }
      });
      return templateName;
    })();
    templateNames.set(key, pending);
    pending.catch(() => templateNames.delete(key));
  }
  return pending;
}

// Tạo cơ sở dữ liệu đã chạy mọi tệp thay đổi cấu trúc của loại cho trước, thuộc vai trò của chuỗi kết nối, giống createEmptyDatabase
// rồi migrateToLatest. Thiết lập mức cơ sở dữ liệu (múi giờ do tệp thay đổi cấu trúc đặt) không đi theo bản sao nên chép lại
export async function createMigratedTestDatabase(
  connectionString: string,
  databaseName: string,
  kind: DatabaseKind,
  options: MigratedTestDatabaseOptions = {},
): Promise<void> {
  const target = targetOf(connectionString, options);
  await createOwnedDatabase(target, databaseName, await templateFor(target, kind));
}

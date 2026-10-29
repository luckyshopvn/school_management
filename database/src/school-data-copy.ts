import { sql, type Kysely, type Transaction } from 'kysely';
import { createDatabase } from './connection.js';
import { connectionStringOf, type DatabaseDescriptor } from './school-database-layout.js';

// Đọc và nạp dữ liệu một cơ sở dữ liệu (hoặc lược đồ) của trường theo từng bảng, dùng chung cho chuyển bố cục (S9), sao lưu,
// khôi phục, diễn tập và chuyển cụm (DT-SaaS phần S7b, YCTD-199). Nguyên tắc:
// - đọc trong một giao dịch REPEATABLE READ chỉ đọc nên mọi bảng cùng một ảnh chụp; mọi cột lấy ở dạng văn bản của PostgreSQL
//   (giữ đủ micro giây, số thập phân, JSON, mảng), múi giờ cố định UTC;
// - nạp bằng chính vai trò của trường (chủ các bảng), không cần quyền siêu người dùng nên chạy được ở Neon, Supabase: gỡ khóa
//   ngoại; mỗi bảng một giao dịch (tắt trigger người dùng nếu bảng có, xóa dữ liệu cũ, chèn, đặt lại bộ đếm tự tăng) để không
//   vượt giới hạn khóa của máy chủ (max_locks_per_transaction mặc định 64); cuối cùng gắn lại khóa ngoại, PostgreSQL kiểm lại
//   toàn bộ quan hệ. Lỗi giữa chừng thì gắn lại khóa ngoại không kiểm (NOT VALID) để giữ cấu trúc; đích luôn ở trạng thái không
//   phục vụ (trường tạm dừng, trường tạm, cụm chưa đổi) nên chạy lại là nạp lại từ đầu;
// - tổng kiểm từng bảng: số dòng và md5 của các dòng dạng văn bản đã sắp, hai nơi cùng cấu trúc thì cùng kết quả.
export const SKIPPED_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);
export const PAGE_ROWS = 500;

export interface TableColumns {
  table: string;
  // Cột chép được (bỏ cột sinh tự động)
  columns: string[];
  // Mọi cột, dùng cho tổng kiểm
  checksumColumns: string[];
}

export interface TableTotals {
  table: string;
  rows: number;
  checksum: string;
}

export interface SnapshotHandler {
  table(info: TableColumns): Promise<void>;
  rows(table: string, rows: Array<Array<string | null>>): Promise<void>;
  tableEnd(totals: TableTotals): Promise<void>;
}

type Executor = Kysely<unknown> | Transaction<unknown>;

export async function listTables(database: Executor, schema: string): Promise<string[]> {
  const result = await sql<{ table_name: string }>`
    select table_name from information_schema.tables
    where table_schema = ${schema} and table_type = 'BASE TABLE' order by table_name`.execute(database);
  return result.rows.map((row) => row.table_name).filter((name) => !SKIPPED_TABLES.has(name));
}

async function listColumns(
  database: Executor,
  schema: string,
  table: string,
): Promise<Array<{ name: string; generated: boolean }>> {
  const result = await sql<{ column_name: string; is_generated: string }>`
    select column_name, is_generated from information_schema.columns
    where table_schema = ${schema} and table_name = ${table} order by ordinal_position`.execute(database);
  return result.rows.map((row) => ({ name: row.column_name, generated: row.is_generated === 'ALWAYS' }));
}

async function currentSchema(database: Executor): Promise<string> {
  const result = await sql<{ schema: string }>`select current_schema() as schema`.execute(database);
  return result.rows[0]?.schema ?? 'public';
}

async function tableChecksum(
  database: Executor,
  schema: string,
  table: string,
  columns: string[],
): Promise<TableTotals> {
  const list = sql.join(
    columns.map((column) => sql`${sql.ref(`t.${column}`)}::text`),
    sql`, `,
  );
  const result = await sql<{ rows: string; checksum: string | null }>`
    select count(*)::text as rows, md5(coalesce(string_agg(r.h, '' order by r.h), '')) as checksum
    from (select md5(concat_ws('|', ${list})) as h from ${sql.table(`${schema}.${table}`)} as t) as r`.execute(
    database,
  );
  return { table, rows: Number(result.rows[0]?.rows ?? 0), checksum: result.rows[0]?.checksum ?? '' };
}

async function fixedTextSettings(transaction: Transaction<unknown>): Promise<void> {
  await sql`set local timezone = 'UTC'`.execute(transaction);
  await sql`set local datestyle = 'ISO, YMD'`.execute(transaction);
  await sql`set local intervalstyle = 'postgres'`.execute(transaction);
  await sql`set local extra_float_digits = 3`.execute(transaction);
}

// Đọc mọi bảng của một cơ sở dữ liệu của trường trong một ảnh chụp, gọi handler theo từng bảng, từng trang dòng
// options.tables: chỉ đọc các bảng này (sao lưu trước khi xóa, YCTD-384); không truyền là mọi bảng
export async function readSnapshot(
  descriptor: DatabaseDescriptor,
  handler: SnapshotHandler,
  options: { tables?: readonly string[] } = {},
): Promise<TableTotals[]> {
  const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
  try {
    return await database
      .transaction()
      .setIsolationLevel('repeatable read')
      .setAccessMode('read only')
      .execute(async (transaction) => {
        await fixedTextSettings(transaction);
        const schema = descriptor.schemaName ?? (await currentSchema(transaction));
        const totals: TableTotals[] = [];
        const tables = (await listTables(transaction, schema)).filter(
          (table) => !options.tables || options.tables.includes(table),
        );
        for (const table of tables) {
          const all = await listColumns(transaction, schema, table);
          const columns = all.filter((column) => !column.generated).map((column) => column.name);
          await handler.table({ table, columns, checksumColumns: all.map((column) => column.name) });
          const pageRows = Math.max(1, Math.min(PAGE_ROWS, Math.floor(30_000 / Math.max(1, columns.length))));
          for (let offset = 0; ; offset += pageRows) {
            const page = await sql<Record<string, string | null>>`
              select ${sql.join(
                columns.map((name) => sql`${sql.ref(name)}::text as ${sql.ref(name)}`),
                sql`, `,
              )} from ${sql.table(`${schema}.${table}`)}
              order by ctid limit ${pageRows} offset ${offset}`.execute(transaction);
            if (page.rows.length > 0) {
              await handler.rows(
                table,
                page.rows.map((row) => columns.map((name) => row[name] ?? null)),
              );
            }
            if (page.rows.length < pageRows) {
              break;
            }
          }
          const sum = await tableChecksum(
            transaction,
            schema,
            table,
            all.map((column) => column.name),
          );
          totals.push(sum);
          await handler.tableEnd(sum);
        }
        return totals;
      });
  } finally {
    await database.destroy();
  }
}

export interface DatabaseLoader {
  // Bắt đầu một bảng: xóa dữ liệu cũ (dữ liệu mặc định do migrate nạp)
  table(info: TableColumns): Promise<void>;
  rows(table: string, rows: Array<Array<string | null>>): Promise<void>;
}

// Nạp dữ liệu vào một cơ sở dữ liệu của trường bằng vai trò của trường; feed gọi loader cho từng bảng. Trả tổng kiểm của các
// bảng đã nạp, tính trong cùng giao dịch sau khi gắn lại khóa ngoại
export async function loadDatabase(
  descriptor: DatabaseDescriptor,
  feed: (loader: DatabaseLoader) => Promise<void>,
): Promise<TableTotals[]> {
  const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
  try {
    return await database.connection().execute(async (connection) => {
      const schema = descriptor.schemaName ?? (await currentSchema(connection));
      const existing = new Set(await listTables(connection, schema));
      const foreignKeys = (
        await sql<{ table_name: string; name: string; definition: string }>`
          select c.conrelid::regclass::text as table_name, c.conname as name, pg_get_constraintdef(c.oid) as definition
          from pg_constraint c join pg_namespace n on n.oid = c.connamespace
          where c.contype = 'f' and n.nspname = ${schema}`.execute(connection)
      ).rows;
      const triggered = new Set(
        (
          await sql<{ table_name: string }>`
            select distinct c.relname as table_name from pg_trigger t
            join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
            where not t.tgisinternal and n.nspname = ${schema}`.execute(connection)
        ).rows.map((row) => row.table_name),
      );
      const reattach = async (valid: boolean) => {
        for (const key of foreignKeys) {
          await sql`alter table ${sql.raw(key.table_name)} add constraint ${sql.ref(key.name)} ${sql.raw(key.definition)}${
            valid ? sql`` : sql` not valid`
          }`.execute(connection);
        }
      };
      await connection.transaction().execute(async (transaction) => {
        for (const key of foreignKeys) {
          await sql`alter table ${sql.raw(key.table_name)} drop constraint ${sql.ref(key.name)}`.execute(transaction);
        }
      });
      const loaded = new Map<string, TableColumns>();
      let open: string | null = null;
      const finishTable = async () => {
        if (!open) {
          return;
        }
        const table = open;
        open = null;
        const sequences = await sql<{ column_name: string }>`
          select column_name from information_schema.columns
          where table_schema = ${schema} and table_name = ${table}
            and (identity_generation is not null or column_default like 'nextval(%')`.execute(connection);
        for (const sequence of sequences.rows) {
          await sql`select setval(pg_get_serial_sequence(${`${schema}.${table}`}, ${sequence.column_name}),
            coalesce((select max(${sql.ref(sequence.column_name)}) from ${sql.table(`${schema}.${table}`)}), 0) + 1,
            false)`.execute(connection);
        }
        if (triggered.has(table)) {
          await sql`alter table ${sql.table(`${schema}.${table}`)} enable trigger user`.execute(connection);
        }
        await sql`commit`.execute(connection);
      };
      try {
        await feed({
          table: async (info) => {
            await finishTable();
            if (!existing.has(info.table)) {
              throw new Error(
                `Đích thiếu bảng ${info.table} (${descriptor.name}); chạy cùng hoặc mới hơn phiên bản mã của bản nguồn`,
              );
            }
            await sql`begin`.execute(connection);
            open = info.table;
            loaded.set(info.table, info);
            if (triggered.has(info.table)) {
              await sql`alter table ${sql.table(`${schema}.${info.table}`)} disable trigger user`.execute(connection);
            }
            await sql`truncate table ${sql.table(`${schema}.${info.table}`)} restart identity`.execute(connection);
          },
          rows: async (table, rows) => {
            const info = loaded.get(table);
            if (!info || rows.length === 0 || open !== table) {
              return;
            }
            const values = rows.map((row) => sql`(${sql.join(row)})`);
            await sql`insert into ${sql.table(`${schema}.${table}`)}
              (${sql.join(
                info.columns.map((name) => sql.ref(name)),
                sql`, `,
              )}) overriding system value values ${sql.join(values, sql`, `)}`.execute(connection);
          },
        });
        await finishTable();
        // Gắn lại khóa ngoại: PostgreSQL kiểm lại mọi dòng, dữ liệu nạp sai quan hệ thì báo lỗi ở đây
        await connection.transaction().execute(async (transaction) => {
          for (const key of foreignKeys) {
            await sql`alter table ${sql.raw(key.table_name)} add constraint ${sql.ref(key.name)} ${sql.raw(
              key.definition,
            )}`.execute(transaction);
          }
        });
      } catch (error) {
        if (open) {
          await sql`rollback`.execute(connection).catch(() => undefined);
          open = null;
        }
        // Giữ cấu trúc: gắn lại khóa ngoại không kiểm dữ liệu cũ; trường vẫn tạm dừng, chạy lại khôi phục để nạp lại
        await reattach(false).catch(() => undefined);
        throw error;
      }
      return connection.transaction().execute(async (transaction) => {
        await fixedTextSettings(transaction);
        const totals: TableTotals[] = [];
        for (const info of loaded.values()) {
          totals.push(await tableChecksum(transaction, schema, info.table, info.checksumColumns));
        }
        return totals;
      });
    });
  } finally {
    await database.destroy();
  }
}

// Chép một cơ sở dữ liệu của trường sang đích (đích đã tạo và chạy migrate), so số dòng và tổng kiểm từng bảng
export async function copyDatabase(source: DatabaseDescriptor, target: DatabaseDescriptor): Promise<TableTotals[]> {
  let expected: TableTotals[] = [];
  const actual = await loadDatabase(target, async (loader) => {
    expected = await readSnapshot(source, {
      table: (info) => loader.table(info),
      rows: (table, rows) => loader.rows(table, rows),
      tableEnd: async () => undefined,
    });
  });
  assertTotalsMatch(target.name, expected, actual);
  return actual;
}

export function assertTotalsMatch(database: string, expected: TableTotals[], actual: TableTotals[]): void {
  const byTable = new Map(actual.map((item) => [item.table, item]));
  for (const item of expected) {
    const found = byTable.get(item.table);
    if (!found || found.rows !== item.rows || found.checksum !== item.checksum) {
      throw new Error(
        `Lệch dữ liệu ở ${database}.${item.table}: nguồn ${item.rows} dòng, đích ${found?.rows ?? 0} dòng${
          found && found.rows === item.rows ? ' (khác tổng kiểm)' : ''
        }`,
      );
    }
  }
}

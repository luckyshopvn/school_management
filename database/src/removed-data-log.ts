import { sql, type Kysely } from 'kysely';

// Bảng ghi nhận sao lưu dữ liệu của chức năng đã bỏ (YCTD-393). Tách khỏi removed-data-backup.ts để database migration nhập được mà
// không kéo theo phần ghi tệp (school-backup.ts nhập migrate.ts)
// Dòng ghi nhận chức năng đã xử lý khi không có bảng nào để sao lưu (ví dụ bản triển khai chưa từng bật chợ gia sư)
export const NOTHING_TO_BACK_UP = '*';

export interface RemovedDataBackup {
  file: string;
  sha256: string;
  totals: Array<{ table: string; rows: number; checksum: string }>;
}

export async function ensureRemovedDataBackupsTable(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists removed_data_backups (
      id uuid primary key default gen_random_uuid(),
      feature text not null,
      database_name text not null,
      table_name text not null,
      row_count bigint not null,
      checksum text not null,
      file_name text not null,
      file_sha256 text not null,
      created_at timestamptz not null default now()
    )`.execute(database);
}

// Ghi kết quả sao lưu vào removed_data_backups; không có tệp (không còn bảng) thì ghi một dòng NOTHING_TO_BACK_UP để database migration
// biết chức năng đã được xử lý
export async function recordRemovedDataBackup(
  database: Kysely<unknown>,
  entry: { feature: string; databaseName: string; backup: RemovedDataBackup | null },
): Promise<void> {
  await ensureRemovedDataBackupsTable(database);
  const rows = entry.backup?.totals.length
    ? entry.backup.totals.map((total) => ({ table: total.table, rows: total.rows, checksum: total.checksum }))
    : [{ table: NOTHING_TO_BACK_UP, rows: 0, checksum: '' }];
  for (const row of rows) {
    await sql`
      insert into removed_data_backups (feature, database_name, table_name, row_count, checksum, file_name, file_sha256)
      values (${entry.feature}, ${entry.databaseName}, ${row.table}, ${row.rows}, ${row.checksum},
        ${entry.backup?.file ?? ''}, ${entry.backup?.sha256 ?? ''})`.execute(database);
  }
}

// Dùng trong database migration xóa bảng: mỗi bảng còn dữ liệu phải có bản ghi sao lưu mới nhất cùng số dòng hiện tại. Bảng không còn
// hoặc không có dòng nào thì không cần sao lưu. Thiếu thì ném lỗi chỉ cách chạy lệnh sao lưu
export async function assertRemovedDataBackedUp(
  database: Kysely<unknown>,
  feature: string,
  tables: readonly string[],
  command: string,
): Promise<void> {
  const missing: string[] = [];
  const hasLog = await sql<{ found: boolean }>`
    select to_regclass('removed_data_backups') is not null as found`.execute(database);
  for (const table of tables) {
    const exists = await sql<{ found: boolean }>`select to_regclass(${table}) is not null as found`.execute(database);
    if (!exists.rows[0]?.found) {
      continue;
    }
    const count = await sql<{ rows: string }>`select count(*) as rows from ${sql.table(table)}`.execute(database);
    const current = Number(count.rows[0]?.rows ?? 0);
    if (current === 0) {
      continue;
    }
    const recorded = hasLog.rows[0]?.found
      ? await sql<{ row_count: string }>`
          select row_count from removed_data_backups where feature = ${feature} and table_name = ${table}
          order by created_at desc limit 1`.execute(database)
      : { rows: [] };
    if (Number(recorded.rows[0]?.row_count ?? -1) !== current) {
      missing.push(`${table} (${current} dòng)`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Chưa sao lưu dữ liệu của chức năng đã bỏ "${feature}" trước khi xóa: ${missing.join(', ')}. Chạy ${command} rồi chạy lại database migration`,
    );
  }
}

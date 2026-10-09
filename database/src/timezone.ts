import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

async function readDatabaseName(database: Kysely<unknown>): Promise<string> {
  const result = await sql<{ name: string }>`select current_database() as name`.execute(database);
  const databaseName = result.rows[0]?.name;
  if (!databaseName) {
    throw new Error('Không đọc được tên cơ sở dữ liệu');
  }
  return databaseName;
}

// Mốc thời gian lưu theo giờ Việt Nam (16_CO_SO_DU_LIEU.md mục 1, quy ước 6)
export const setVietnamTimezone: Migration = {
  async up(database) {
    const databaseName = await readDatabaseName(database);
    await sql`alter database ${sql.id(databaseName)} set timezone to ${sql.lit(VIETNAM_TIMEZONE)}`.execute(database);
  },
  async down(database) {
    const databaseName = await readDatabaseName(database);
    await sql`alter database ${sql.id(databaseName)} reset timezone`.execute(database);
  },
};

export { VIETNAM_TIMEZONE };

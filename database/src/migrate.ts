import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import { identityMigrations } from '../identity/index.js';
import { platformMigrations } from '../platform/index.js';
import { schoolYearMigrations } from '../school-year/index.js';
import { systemMigrations } from '../system/index.js';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';

export type DatabaseKind = 'identity' | 'system' | 'school-year' | 'platform';

// Số tệp tối đa chạy chung một giao dịch (xem migrateToLatest)
export const MIGRATIONS_PER_TRANSACTION = 10;

const migrationsByKind: Record<DatabaseKind, Record<string, Migration>> = {
  identity: identityMigrations,
  system: systemMigrations,
  'school-year': schoolYearMigrations,
  platform: platformMigrations,
};

// Chạy các tệp thay đổi cấu trúc chưa chạy; chạy lại nhiều lần không gây lỗi (QU-01)
export async function migrateToLatest(
  kind: DatabaseKind,
  connectionString: string,
  batchSize = MIGRATIONS_PER_TRANSACTION,
): Promise<MigrationResultSet> {
  const database = createDatabase<unknown>(connectionString);
  try {
    const migrations = migrationsByKind[kind];
    const migrator = new Migrator({
      db: database,
      provider: { getMigrations: async () => migrations },
      // Mỗi phần làm song song được dành trước số tệp riêng nên các tệp có thể gộp vào không theo thứ tự số; tệp số nhỏ
      // gộp sau vẫn chạy được trên cơ sở dữ liệu đã chạy tệp số lớn hơn
      allowUnorderedMigrations: true,
    });
    // Chạy theo lô, mỗi lô tối đa MIGRATIONS_PER_TRANSACTION tệp trong một giao dịch. Không chạy mọi tệp trong một giao dịch:
    // cơ sở dữ liệu năm học mới có hàng trăm bảng, một giao dịch giữ khóa của mọi bảng cùng lúc và vượt bảng khóa dùng chung
    // của máy chủ (lỗi "out of shared memory", max_locks_per_transaction mặc định 64, gói miễn phí của Neon, Supabase không
    // đổi được) khi nhiều trường tạo cùng lúc. Cũng không chạy mỗi tệp một giao dịch: mỗi lần migrateUp() Kysely kiểm lại
    // bảng ghi tệp đã chạy, khóa, đọc trạng thái, nên 100 tệp năm học mất khoảng 41 giây (đo 2026-10-27, YCTD-292), vượt thời
    // gian chờ của bước mở năm học; theo lô 10 tệp còn khoảng 6 giây
    const results: NonNullable<MigrationResultSet['results']>[number][] = [];
    const pending = (await migrator.getMigrations()).filter((migration) => migration.executedAt === undefined);
    for (let end = batchSize; end < pending.length + batchSize; end += batchSize) {
      // migrateTo chạy các tệp đang chờ theo thứ tự tên đến hết tệp đích, trong một giao dịch
      const target = pending[Math.min(end, pending.length) - 1] as (typeof pending)[number];
      const step = await migrator.migrateTo(target.name);
      results.push(...(step.results ?? []));
      if (step.error) {
        return { error: step.error, results };
      }
    }
    return { results };
  } finally {
    await database.destroy();
  }
}

// Cơ sở dữ liệu năm học cần chạy tệp thay đổi cấu trúc: chỉ năm đang dùng; năm đã đóng giữ nguyên cấu trúc (QU-11)
export async function schoolYearDatabasesToMigrate(system: Kysely<SystemDatabase>): Promise<string[]> {
  const rows = await system
    .selectFrom('academic_year_databases')
    .select('database_name')
    .where('status', '=', 'active')
    .execute();
  return rows.map((row) => row.database_name);
}

import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import { identityMigrations } from '../identity/index.js';
import { schoolYearMigrations } from '../school-year/index.js';
import { systemMigrations } from '../system/index.js';
import { createDatabase } from './connection.js';

export type DatabaseKind = 'identity' | 'system' | 'school-year';

const migrationsByKind: Record<DatabaseKind, Record<string, Migration>> = {
  identity: identityMigrations,
  system: systemMigrations,
  'school-year': schoolYearMigrations,
};

// Chạy các tệp thay đổi cấu trúc chưa chạy; chạy lại nhiều lần không gây lỗi (QU-01)
export async function migrateToLatest(kind: DatabaseKind, connectionString: string): Promise<MigrationResultSet> {
  const database = createDatabase<unknown>(connectionString);
  try {
    const migrations = migrationsByKind[kind];
    const migrator = new Migrator({
      db: database,
      provider: { getMigrations: async () => migrations },
    });
    return await migrator.migrateToLatest();
  } finally {
    await database.destroy();
  }
}

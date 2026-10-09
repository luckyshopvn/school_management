import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { migrateToLatest, type DatabaseKind } from './migrate.js';
import { VIETNAM_TIMEZONE } from './timezone.js';

async function assertMigratesTwiceWithVietnamTimezone(kind: DatabaseKind, connectionString: string) {
  const firstRun = await migrateToLatest(kind, connectionString);
  assert.equal(firstRun.error, undefined);
  const secondRun = await migrateToLatest(kind, connectionString);
  assert.equal(secondRun.error, undefined);
  assert.deepEqual(secondRun.results, []);

  const database = createDatabase<unknown>(connectionString);
  try {
    const result = await sql<{ timezone: string }>`select current_setting('TimeZone') as timezone`.execute(database);
    assert.equal(result.rows[0]?.timezone, VIETNAM_TIMEZONE);
  } finally {
    await database.destroy();
  }
}

describe('Tệp thay đổi cấu trúc trên ba loại cơ sở dữ liệu', () => {
  it('identity: chạy hai lần không lỗi và đặt giờ Việt Nam', async () => {
    await assertMigratesTwiceWithVietnamTimezone('identity', readConnectionString('identity'));
  });

  it('system: chạy hai lần không lỗi và đặt giờ Việt Nam', async () => {
    await assertMigratesTwiceWithVietnamTimezone('system', readConnectionString('system'));
  });

  it('school-year: cơ sở dữ liệu năm học tạo mới chạy hai lần không lỗi và đặt giờ Việt Nam', async () => {
    const systemConnectionString = readConnectionString('system');
    const databaseName = `school_year_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    await createEmptyDatabase(systemConnectionString, databaseName);
    try {
      await assertMigratesTwiceWithVietnamTimezone(
        'school-year',
        replaceDatabaseName(systemConnectionString, databaseName),
      );
    } finally {
      await dropDatabaseIfExists(systemConnectionString, databaseName);
    }
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { readConnectionString } from './environment.js';
import { migrateToLatest, type DatabaseKind } from './migrate.js';
import { VIETNAM_TIMEZONE } from './timezone.js';

const databaseKinds: DatabaseKind[] = ['identity', 'system', 'school-year'];

describe('Tệp thay đổi cấu trúc trên ba loại cơ sở dữ liệu', () => {
  for (const kind of databaseKinds) {
    it(`${kind}: chạy hai lần không lỗi và đặt giờ Việt Nam`, async () => {
      const connectionString = readConnectionString(kind);
      const firstRun = await migrateToLatest(kind, connectionString);
      assert.equal(firstRun.error, undefined);
      const secondRun = await migrateToLatest(kind, connectionString);
      assert.equal(secondRun.error, undefined);
      assert.deepEqual(secondRun.results, []);

      const database = createDatabase<unknown>(connectionString);
      try {
        const result = await sql<{ timezone: string }>`select current_setting('TimeZone') as timezone`.execute(
          database,
        );
        assert.equal(result.rows[0]?.timezone, VIETNAM_TIMEZONE);
      } finally {
        await database.destroy();
      }
    });
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { sql } from 'kysely';
import { identityMigrations } from '../identity/index.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';

// Mô tả quyền ghi người học theo cấp (YCTD-394 lát L2), kịch bản CT-1973: sau database migration mô tả có chữ "trẻ" thành chỗ
// giữ, chỉ còn hai quyền riêng của Mầm non giữ chữ "trẻ"; điền chỗ giữ cho trường Mầm non ra đúng chữ cũ; quay lui trả chữ cũ
const MIGRATION = '0199_learner_term_in_permission_descriptions';

// Cùng cách điền với fillLearnerTerm của gói dùng chung (gói database không phụ thuộc gói đó)
const fill = (text: string, learner: string) =>
  text.replaceAll('{Người học}', learner).replaceAll('{người học}', learner.toLocaleLowerCase('vi'));

describe('Mô tả quyền ghi người học theo cấp (YCTD-394)', () => {
  it('CT-1973: migration đổi "trẻ" thành chỗ giữ, điền lại cho Mầm non ra chữ cũ, quay lui trả chữ cũ', async () => {
    const systemConnectionString = readConnectionString('system');
    const databaseName = `school_identity_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    await createEmptyDatabase(systemConnectionString, databaseName);
    const connectionString = replaceDatabaseName(systemConnectionString, databaseName);
    const database = createDatabase<unknown>(connectionString);
    const descriptions = async () =>
      new Map(
        (
          await sql<{ code: string; description: string }>`select code, description from permissions`.execute(database)
        ).rows.map((row) => [row.code, row.description]),
      );
    try {
      const run = await migrateToLatest('identity', connectionString);
      assert.equal(run.error, undefined);
      const after = await descriptions();
      const withChild = [...after].filter(([, text]) => /trẻ/i.test(text)).map(([code]) => code);
      assert.deepEqual(withChild.sort(), ['P02.program-completion.manage', 'P17.report.growth']);
      assert.equal(after.get('P02.view'), 'Xem: {Người học}, phụ huynh, lớp học');
      assert.equal(
        fill(after.get('P17.birthday.view') ?? '', 'Học sinh'),
        'Xem sinh nhật học sinh trong tháng của đơn vị',
      );

      const migration = identityMigrations[MIGRATION];
      assert.ok(migration?.down);
      await migration.down(database as never);
      const before = await descriptions();
      for (const [code, text] of after) {
        assert.equal(fill(text, 'Trẻ'), before.get(code), code);
      }
      assert.ok(![...before.values()].some((text) => text.includes('{')));
    } finally {
      await database.destroy();
      await dropDatabaseIfExists(systemConnectionString, databaseName);
    }
  });
});

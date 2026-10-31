import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { schoolYearMigrations } from '../school-year/index.js';
import { seedCriteria } from '../school-year/migrations/0047_create_standards_and_groups.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { migrateToLatest } from './migrate.js';

// Danh mục chuẩn nghề nghiệp gieo sẵn khớp văn bản gốc (YCTD-397, lỗi L-41): Thông tư 26/2018/TT-BGDĐT (giáo viên mầm non)
// và Thông tư 25/2018/TT-BGDĐT (hiệu trưởng mầm non), Điều 4 đến 8 (tiêu chí) và Điều 10 khoản 2 (tiêu chí xét ở mức Khá,
// Tốt); database migration 0246 sửa danh mục đã gieo theo bản cũ. Kịch bản CT-2180 đến CT-2182
const keyNumbers = (standardType: 'teacher' | 'principal') =>
  seedCriteria(standardType)
    .filter((criterion) => criterion.isKey)
    .map((criterion) => criterion.number);

const numbersOf = (standardType: 'teacher' | 'principal', standardCode: string) =>
  seedCriteria(standardType)
    .filter((criterion) => criterion.standardCode === standardCode)
    .map((criterion) => criterion.number);

const fixCatalog = schoolYearMigrations['0246_fix_professional_standards_catalog']!;

async function withFreshDatabase(run: (database: Kysely<unknown>) => Promise<void>): Promise<void> {
  const systemConnectionString = readConnectionString('system');
  const databaseName = `standards_seed_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await createEmptyDatabase(systemConnectionString, databaseName);
  const connectionString = replaceDatabaseName(systemConnectionString, databaseName);
  try {
    const migrated = await migrateToLatest('school-year', connectionString);
    assert.equal(migrated.error, undefined);
    const database = createDatabase<unknown>(connectionString);
    try {
      await run(database);
    } finally {
      await database.destroy();
    }
  } finally {
    await dropDatabaseIfExists(systemConnectionString, databaseName);
  }
}

async function catalogOf(database: Kysely<unknown>, standardType: 'teacher' | 'principal') {
  const rows = await sql<{ id: string; code: string; name: string; is_key: boolean; standard_code: string }>`
    select criteria.id, criteria.code, criteria.name, criteria.is_key, standards.code as standard_code
    from professional_criteria criteria
    join professional_standards standards on standards.id = criteria.standard_id
    where criteria.standard_type = ${standardType} order by criteria.order_no`.execute(database);
  return rows.rows;
}

describe('Danh mục chuẩn nghề nghiệp mầm non gieo sẵn', () => {
  it('CT-2180: giáo viên mầm non 15 tiêu chí; tiêu chí xét ở mức Khá, Tốt là 1, 3, 4, 5, 6, 7, 8, 9', () => {
    assert.equal(seedCriteria('teacher').length, 15);
    assert.deepEqual(numbersOf('teacher', 'TC2'), [3, 4, 5, 6, 7, 8]);
    assert.deepEqual(numbersOf('teacher', 'TC3'), [9, 10]);
    assert.deepEqual(keyNumbers('teacher'), [1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('CT-2181: hiệu trưởng mầm non 18 tiêu chí theo đúng tiêu chuẩn; tiêu chí xét ở mức Khá, Tốt là 1, 4, 5, 6, 7, 9, 11, 13, 14, 15', () => {
    assert.equal(seedCriteria('principal').length, 18);
    assert.deepEqual(numbersOf('principal', 'TC1'), [1, 2, 3]);
    assert.deepEqual(numbersOf('principal', 'TC2'), [4, 5, 6, 7, 8, 9, 10, 11]);
    assert.deepEqual(numbersOf('principal', 'TC3'), [12, 13, 14]);
    assert.deepEqual(numbersOf('principal', 'TC4'), [15, 16]);
    assert.deepEqual(numbersOf('principal', 'TC5'), [17, 18]);
    const byNumber = new Map(seedCriteria('principal').map((criterion) => [criterion.number, criterion.name]));
    assert.equal(byNumber.get(5), 'Quản trị hoạt động nuôi dưỡng, chăm sóc sức khỏe của trẻ em');
    assert.equal(byNumber.get(6), 'Quản trị hoạt động giáo dục trẻ em');
    assert.equal(byNumber.get(18), 'Ứng dụng công nghệ thông tin');
    assert.deepEqual(keyNumbers('principal'), [1, 4, 5, 6, 7, 9, 11, 13, 14, 15]);
  });

  it('CT-2182: tệp 0246 sửa danh mục còn nguyên bản gieo cũ, giữ dòng và mã tiêu chí; danh mục Hiệu trưởng đã sửa thì giữ nguyên', async () => {
    await withFreshDatabase(async (database) => {
      const seeded = await catalogOf(database, 'principal');
      // Đưa danh mục về bản gieo cũ như cơ sở dữ liệu năm học đã chạy tệp 0047 trước khi sửa
      await fixCatalog.down!(database);
      const oldPrincipal = await catalogOf(database, 'principal');
      assert.deepEqual(
        oldPrincipal.filter((row) => row.is_key).map((row) => Number(row.code)),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      );
      assert.equal(oldPrincipal[17]!.name, 'Thể hiện khả năng nghệ thuật');
      assert.equal(oldPrincipal[9]!.standard_code, 'TC2');

      await sql`update professional_criteria set name = 'Đạo đức nhà giáo (sửa)'
        where standard_type = 'teacher' and code = '1'`.execute(database);
      const editedTeacher = await catalogOf(database, 'teacher');

      await fixCatalog.up(database);
      const fixed = await catalogOf(database, 'principal');
      assert.deepEqual(fixed, seeded, 'cùng dòng, cùng mã, tên, tiêu chuẩn và cờ như bản gieo mới');
      assert.deepEqual(
        fixed.map((row) => row.id),
        oldPrincipal.map((row) => row.id),
      );
      assert.deepEqual(await catalogOf(database, 'teacher'), editedTeacher, 'danh mục đã sửa tay không bị ghi đè');
      const standardName = await sql<{ name: string }>`select name from professional_standards
        where standard_type = 'principal' and code = 'TC5'`.execute(database);
      assert.equal(standardName.rows[0]!.name, 'Sử dụng ngoại ngữ (hoặc tiếng dân tộc) và công nghệ thông tin');

      await fixCatalog.up(database);
      assert.deepEqual(await catalogOf(database, 'principal'), seeded, 'chạy lại không đổi gì');
    });
  });
});

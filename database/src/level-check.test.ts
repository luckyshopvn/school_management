import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { checkSchoolYearDatabase, compareLevelReports, type LevelReport } from './level-check.js';
import { migrateToLatest } from './migrate.js';
import { schoolYearMigrations } from '../school-year/index.js';
import { systemMigrations } from '../system/index.js';

// Chuyển và kiểm dữ liệu đa cấp học (DT-19 phần 19f, YCTD-156): tệp vá năm học 0075 và hệ thống 0025 chạy lặp được, lệnh kiểm
// đối chiếu đếm đúng và báo lỗi toàn vẹn. Kịch bản CT-19f-1 đến CT-19f-3, trên cơ sở dữ liệu tạo mới rồi xóa
async function withFreshDatabase(
  kind: 'system' | 'school-year',
  run: (database: Kysely<unknown>) => Promise<void>,
): Promise<void> {
  const systemConnectionString = readConnectionString('system');
  const databaseName = `level_check_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await createEmptyDatabase(systemConnectionString, databaseName);
  const connectionString = replaceDatabaseName(systemConnectionString, databaseName);
  try {
    const migrated = await migrateToLatest(kind, connectionString);
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

const backfillYear = schoolYearMigrations['0075_backfill_school_levels'];
const backfillSystem = systemMigrations['0025_backfill_school_levels'];

describe('Chuyển và kiểm dữ liệu đa cấp học (YCTD-156)', () => {
  it('CT-19f-1: năm học: lệnh kiểm báo đơn vị thiếu cấp, lớp lệch khối; tệp vá chạy hai lần cho cùng kết quả', async () => {
    await withFreshDatabase('school-year', async (database) => {
      const unit = await sql<{ id: string }>`insert into org_units (code, name, unit_type)
        values ('TC', 'Trường chính thử', 'truong_chinh') returning id`.execute(database);
      const unitId = unit.rows[0]?.id ?? '';
      await sql`insert into grade_levels (code, name, age_from_months, age_to_months) values ('LA', 'Lá', 60, 71)`.execute(
        database,
      );
      await sql`insert into grade_levels (code, name, school_level) values ('K1', 'Khối 1', 'TH')`.execute(database);
      // Lớp ghi thẳng lệch cấp với khối, đơn vị chưa có dòng cấp (dữ liệu trước khi có cấp học)
      await sql`insert into classes (org_unit_id, academic_year_id, code, name, grade_level, max_size, school_level)
        values (${unitId}, ${randomUUID()}, '1A', 'Lớp 1A', 'K1', 30, 'MN')`.execute(database);
      await sql`delete from curricula`.execute(database);

      const before = await checkSchoolYearDatabase(database);
      assert.equal(before.has_level_columns, true);
      assert.deepEqual(before.issues.sort(), [
        'cấp Mầm non có lớp nhưng chưa có chương trình mặc định: 1',
        'lớp lệch cấp với khối: 1',
        'đơn vị chưa có cấp: 1',
      ]);
      assert.equal(before.counts.classes, 1);
      assert.equal(before.counts.grade_levels, 2);

      for (let run = 0; run < 2; run += 1) {
        await backfillYear?.up(database);
      }
      const after = await checkSchoolYearDatabase(database);
      // Đơn vị nhận MN nên lớp Tiểu học thành "lớp thuộc cấp mà đơn vị không có": nhà trường thêm cấp cho đơn vị (lỗi còn lại đúng)
      assert.deepEqual(after.issues, ['lớp đang dùng thuộc cấp mà đơn vị không có: 1']);
      assert.deepEqual(after.counts, before.counts);
      const levels = await sql<{ school_level: string }>`select school_level from org_unit_levels`.execute(database);
      assert.deepEqual(
        levels.rows.map((row) => row.school_level),
        ['MN'],
      );
      const curricula = await sql<{ code: string }>`select code from curricula where is_default`.execute(database);
      assert.deepEqual(
        curricula.rows.map((row) => row.code),
        ['CT-GDMN'],
      );
    });
  });

  it('CT-19f-2: hệ thống: cấp khai báo ở website bật ở school_levels; chạy lại không đổi, không tắt cấp', async () => {
    await withFreshDatabase('system', async (database) => {
      await backfillSystem?.up(database);
      const untouched = await sql<{ code: string }>`select code from school_levels where is_enabled`.execute(database);
      assert.deepEqual(
        untouched.rows.map((row) => row.code),
        ['MN'],
      );
      await sql`insert into website_settings (school_levels) values ('{MN,TH}')
        on conflict (id) do update set school_levels = excluded.school_levels`.execute(database);
      for (let run = 0; run < 2; run += 1) {
        await backfillSystem?.up(database);
      }
      const enabled = await sql<{
        code: string;
      }>`select code from school_levels where is_enabled order by order_no`.execute(database);
      assert.deepEqual(
        enabled.rows.map((row) => row.code),
        ['MN', 'TH'],
      );
      await sql`update website_settings set school_levels = '{MN}'`.execute(database);
      await backfillSystem?.up(database);
      const still = await sql<{
        code: string;
      }>`select code from school_levels where is_enabled order by order_no`.execute(database);
      assert.equal(still.rows.length, 2);
    });
  });

  it('CT-19f-3: so khớp hai lần kiểm báo số đếm lệch và năm học không còn', () => {
    const report = (counts: Record<string, number | null>, names = ['nam_1']): LevelReport => ({
      generated_at: '2026-10-23T00:00:00.000Z',
      enabled_levels: ['MN'],
      system_issues: [],
      years: names.map((name) => ({
        database_name: name,
        academic_year: name,
        status: 'active',
        has_level_columns: true,
        counts,
        issues: [],
      })),
    });
    assert.deepEqual(compareLevelReports(report({ classes: 2, children: 5 }), report({ classes: 2, children: 5 })), []);
    assert.deepEqual(compareLevelReports(report({ classes: 2, children: 5 }), report({ classes: 2, children: 4 })), [
      'nam_1.children: 5 thành 4',
    ]);
    assert.deepEqual(compareLevelReports(report({ classes: 2 }), report({ classes: 2 }, ['nam_2'])), [
      'nam_1: không còn trong lần kiểm sau',
    ]);
  });
});

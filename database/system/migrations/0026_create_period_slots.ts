import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 22c1 (YCTD-160): khung giờ tiết học theo năm học và cấp, cạnh lịch theo cấp của 19b. Mỗi tiết một dòng: số tiết
// trong ngày (1 đến 15), buổi (sáng, chiều), giờ bắt đầu, kết thúc dạng HH:MM. Thời khoá biểu (năm học) và máy xếp (22c2)
// chỉ dùng tiết có trong khung. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;
const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('period_slots')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('period_no', 'smallint', (column) => column.notNull().check(sql`period_no between 1 and 15`))
      .addColumn('session', 'text', (column) => column.notNull().check(sql`session in ('morning', 'afternoon')`))
      .addColumn('start_time', 'text', (column) => column.notNull())
      .addColumn('end_time', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint(
        'period_slots_time_check',
        sql`start_time ~ ${sql.lit(TIME_PATTERN)} and end_time ~ ${sql.lit(TIME_PATTERN)} and end_time > start_time`,
      )
      .addUniqueConstraint('period_slots_unique', ['academic_year_id', 'school_level', 'period_no'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('period_slots').execute();
  },
};

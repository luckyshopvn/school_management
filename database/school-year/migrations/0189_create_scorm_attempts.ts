import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28h (YCTD-278): trạng thái chạy gói SCORM của từng học sinh, từng SCO của một hoạt động loại `scorm`. Bộ chuyển API
// ở trang của học sinh ghi lại các giá trị mô hình dữ liệu đã chuẩn hóa (trạng thái, điểm, thời gian, vị trí, dữ liệu tạm có giới
// hạn cỡ); kết quả hoạt động của lõi 28b tính từ các SCO của hoạt động
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('scorm_attempts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('activity_id', 'uuid', (column) =>
        column.notNull().references('course_activities.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('package_id', 'uuid', (column) => column.notNull())
      .addColumn('sco_identifier', 'text', (column) =>
        column.notNull().check(sql`char_length(sco_identifier) between 1 and 200`),
      )
      .addColumn('completion', 'text', (column) =>
        column
          .notNull()
          .defaultTo('unknown')
          .check(sql`completion in ('unknown', 'not_attempted', 'incomplete', 'completed')`),
      )
      .addColumn('success', 'text', (column) =>
        column
          .notNull()
          .defaultTo('unknown')
          .check(sql`success in ('unknown', 'passed', 'failed')`),
      )
      // Điểm quy về thang 10
      .addColumn('score', 'numeric(4, 2)', (column) => column.check(sql`score is null or score between 0 and 10`))
      .addColumn('total_seconds', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('session_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('location', 'text', (column) => column.check(sql`location is null or char_length(location) <= 1000`))
      .addColumn('suspend_data', 'text', (column) =>
        column.check(sql`suspend_data is null or char_length(suspend_data) <= 64000`),
      )
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('scorm_attempts_unique', ['activity_id', 'child_id', 'sco_identifier'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('scorm_attempts').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): kết quả hoạt động chung và nhật ký học tập. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `activity_results` một dòng mỗi học sinh, hoạt động; mọi loại hoạt động (28b và các phần sau) ghi bảng này, nên tiến độ,
//   điều kiện mở, bảng điểm, báo cáo chỉ đọc một bảng. Điểm thang 10 hoặc mức (Tiểu học, không phải điểm số đưa vào sổ).
// - `learning_events` là dữ liệu quá trình dạy học trực tuyến phải lưu theo Thông tư 09/2021/TT-BGDĐT Điều 8 khoản 1 điểm b,
//   dạng gần xAPI (người, động từ, đối tượng, kết quả, thời điểm); không ghi vị trí, chuỗi nhận dạng thiết bị
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('activity_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('activity_id', 'uuid', (column) =>
        column.notNull().references('course_activities.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .check(sql`status in ('not_started', 'in_progress', 'completed', 'passed', 'failed', 'excused')`),
      )
      .addColumn('progress', 'smallint', (column) => column.check(sql`progress is null or progress between 0 and 100`))
      .addColumn('score', 'numeric(4, 2)', (column) => column.check(sql`score is null or score between 0 and 10`))
      .addColumn('level', 'text', (column) =>
        column.check(sql`level is null or level in ('excellent', 'completed', 'not_completed')`),
      )
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('completed_at', 'timestamptz')
      .addColumn('recorded_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('activity_results_unique', ['activity_id', 'child_id'])
      .execute();
    await database.schema
      .createIndex('activity_results_child_index')
      .on('activity_results')
      .column('child_id')
      .execute();

    await database.schema
      .createTable('learning_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('activity_id', 'uuid', (column) => column.references('course_activities.id').onDelete('set null'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_kind', 'text', (column) =>
        column.notNull().check(sql`actor_kind in ('teacher', 'student', 'guardian', 'staff')`),
      )
      .addColumn('verb', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`verb in ('opened', 'viewed', 'progressed', 'completed', 'submitted', 'scored', 'published', 'unlocked', 'acknowledged')`,
          ),
      )
      .addColumn('result', 'jsonb')
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('learning_events_space_index')
      .on('learning_events')
      .columns(['space_id', 'occurred_at'])
      .execute();
    await database.schema
      .createIndex('learning_events_child_index')
      .on('learning_events')
      .columns(['child_id', 'occurred_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('learning_events').execute();
    await database.schema.dropTable('activity_results').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28e (YCTD-275): cài đặt thảo luận theo lớp học trực tuyến (học sinh được mở chủ đề diễn đàn hay không) và tạm khóa
// quyền viết của một học sinh (người xử lý hàng chờ báo cáo đặt, có hạn và lý do)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('discussion_space_settings')
      .addColumn('space_id', 'uuid', (column) => column.primaryKey().references('course_spaces.id').onDelete('cascade'))
      .addColumn('students_can_post_topics', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('discussion_write_bans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('until', 'timestamptz', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('report_id', 'uuid', (column) => column.references('discussion_reports.id').onDelete('set null'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('discussion_write_bans_child_index')
      .on('discussion_write_bans')
      .columns(['child_id', 'until'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('discussion_write_bans').execute();
    await database.schema.dropTable('discussion_space_settings').execute();
  },
};

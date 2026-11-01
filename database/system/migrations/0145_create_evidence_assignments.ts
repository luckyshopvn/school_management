import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phân công phụ trách tiêu chí của kho minh chứng (YCTD-396 lát L4, MH-683). Mỗi tiêu chí của một bộ trong một năm học có một
// người phụ trách và hạn hoàn thành. Bộ, tiêu chí ở cơ sở dữ liệu năm học nên tham chiếu bằng mã định danh, không có khóa ngoại
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('evidence_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('framework_id', 'uuid', (column) => column.notNull())
      .addColumn('node_id', 'uuid', (column) => column.notNull())
      .addColumn('school_year_name', 'text', (column) =>
        column.notNull().check(sql`char_length(school_year_name) between 1 and 50`),
      )
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull().check(sql`char_length(user_name) between 1 and 200`))
      .addColumn('due_date', 'date')
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('assigned_by', 'uuid')
      .addColumn('assigned_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('evidence_assignments_node_unique', ['framework_id', 'node_id', 'school_year_name'])
      .execute();
    await database.schema
      .createIndex('evidence_assignments_user_index')
      .on('evidence_assignments')
      .columns(['user_id', 'school_year_name'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('evidence_assignments').execute();
  },
};

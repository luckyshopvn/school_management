import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giao bộ tiêu chí cho đoàn đánh giá ngoài (YCTD-396 lát L8, Q-396-9 B): tài khoản vai trò VT-23 chỉ xem, tải minh chứng của
// các bộ được giao trong năm học, đến hết ngày giao. Tài khoản ở dịch vụ định danh nên lưu mã và tên tài khoản, không có khóa
// ngoại; bộ tiêu chí ở cơ sở dữ liệu năm học
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('evidence_review_grants')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull().check(sql`char_length(user_name) between 1 and 200`))
      .addColumn('framework_id', 'uuid', (column) => column.notNull())
      .addColumn('school_year_name', 'text', (column) =>
        column.notNull().check(sql`char_length(school_year_name) between 1 and 50`),
      )
      .addColumn('valid_until', 'date', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('granted_by', 'uuid')
      .addColumn('granted_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('evidence_review_grants_unique', ['user_id', 'framework_id', 'school_year_name'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('evidence_review_grants').execute();
  },
};

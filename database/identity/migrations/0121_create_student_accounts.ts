import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): người dùng định danh của kênh `student` nối một-một với tài khoản học và thi của học sinh (22g2).
// Dịch vụ định danh không đọc cơ sở dữ liệu năm học nên chỉ lưu tên đăng nhập học và thi (khoá nối, không trùng); cột
// `identity_user_id` ở tài khoản học và thi của cơ sở dữ liệu năm học là đầu nối còn lại. Xóa người dùng thì xóa dòng này
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('student_accounts')
      .addColumn('user_id', 'uuid', (column) => column.primaryKey().references('users.id').onDelete('cascade'))
      .addColumn('learning_username', 'text', (column) => column.notNull().unique())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('student_accounts').execute();
  },
};

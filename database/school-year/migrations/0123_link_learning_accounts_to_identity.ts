import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23a (YCTD-211): tài khoản học và thi của học sinh (22g2, 16g) nối một-một với người dùng định danh của kênh
// `student`: `identity_user_id` ghi khi "Khởi tạo" hoặc "Cấp lại mật khẩu"; học sinh nghỉ học, chuyển trường thì máy chủ API
// không nhận tài khoản đó nữa (kiểm tra trạng thái học sinh ở mỗi yêu cầu của tuyến /student/*)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('student_learning_accounts').addColumn('identity_user_id', 'uuid').execute();
    await sql`create unique index student_learning_accounts_identity_index
      on student_learning_accounts (identity_user_id) where identity_user_id is not null`.execute(database);
  },
  async down(database) {
    await sql`drop index if exists student_learning_accounts_identity_index`.execute(database);
    await database.schema.alterTable('student_learning_accounts').dropColumn('identity_user_id').execute();
  },
};

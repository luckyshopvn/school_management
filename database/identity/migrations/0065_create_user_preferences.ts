import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19c (YCTD-153). Ưu tiên của người dùng, giữ qua các lần đăng nhập và các máy: cấp học đang làm việc ở trường
// nhiều cấp (bộ chọn cấp ở thanh đầu trang). Trống là "Tất cả" (mọi cấp người dùng được xem); mọi tài khoản hiện có không có
// dòng nào nên giữ nguyên hành vi. Bảng một dòng mỗi người dùng để thêm ưu tiên khác về sau mà không tạo bảng mới
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_preferences')
      .addColumn('user_id', 'uuid', (column) => column.primaryKey().references('users.id').onDelete('cascade'))
      .addColumn('working_school_level', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'user_preferences_working_school_level_check',
        sql`working_school_level is null or working_school_level in ('MN', 'TH', 'THCS', 'THPT')`,
      )
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_preferences').execute();
  },
};

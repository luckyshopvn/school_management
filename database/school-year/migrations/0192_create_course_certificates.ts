import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28i (YCTD-279): chứng nhận hoàn thành khoá tự chọn (tắt mặc định, GD-155). Mỗi học sinh, mỗi khoá một chứng nhận còn
// hiệu lực; mã kiểm tra ngẫu nhiên để tra ở trang công khai của trường, trang chỉ hiện tên khoá, ngày cấp, tên trường, họ tên viết
// tắt (lưu sẵn lúc cấp để đổi tên sau không làm đổi chứng nhận đã cấp). Thu hồi thì giữ dòng, trang kiểm tra báo đã thu hồi
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('course_certificates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`code ~ '^CN-[A-Z0-9]{10}$'`),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id'))
      .addColumn('course_title', 'text', (column) => column.notNull())
      .addColumn('school_name', 'text', (column) => column.notNull())
      .addColumn('holder_name', 'text', (column) => column.notNull())
      .addColumn('holder_short_name', 'text', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('issued_by', 'uuid', (column) => column.notNull())
      .addColumn('issued_by_name', 'text', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by', 'uuid')
      .addColumn('revoke_reason', 'text', (column) =>
        column.check(sql`revoke_reason is null or char_length(revoke_reason) <= 500`),
      )
      .execute();
    await sql`create unique index course_certificates_active_unique
      on course_certificates (child_id, space_id) where revoked_at is null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('course_certificates').execute();
  },
};

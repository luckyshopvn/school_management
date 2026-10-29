import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Chuyển phiên sau khi đăng nhập theo đơn vị ở tên miền chung của nền tảng (DT-24, YCTD-220; tài liệu 47 mục 16): đăng nhập đúng
// thì phiên mở ở cơ sở dữ liệu định danh của đúng trường, trình duyệt nhận mã một lần (chỉ lưu mã băm, hạn 2 phút) rồi sang tên
// miền của trường đổi mã lấy cookie phiên; dùng rồi thì không dùng lại được
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('login_handoffs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('token_hash', 'text', (column) => column.notNull().unique())
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('sessions.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id').onDelete('cascade'))
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('used_at', 'timestamptz')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('login_handoffs').execute();
  },
};

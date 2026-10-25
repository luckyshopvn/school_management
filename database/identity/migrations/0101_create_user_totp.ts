import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Xác thực hai lớp tuỳ chọn của người dùng trường (DT-SaaS phần S8b, YCTD-201, tài liệu 32 mục 14.5): khóa TOTP mã hóa bằng khóa mã hóa
// của trường (được mã hóa lại cùng khi đổi khóa dữ liệu trẻ), chỉ có hiệu lực ở đăng nhập sau khi người dùng xác nhận mã đầu tiên
// (`confirmed_at`); `last_step` để mỗi mã chỉ dùng một lần
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_totp')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().unique().references('users.id').onDelete('cascade'))
      .addColumn('secret_encrypted', 'text', (column) => column.notNull())
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('last_step', 'bigint')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_totp').execute();
  },
};

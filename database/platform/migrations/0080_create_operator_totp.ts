import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Xác thực hai lớp bắt buộc của tài khoản vận hành nền tảng (DT-SaaS phần S8b, YCTD-201, tài liệu 32 mục 14.5): khóa TOTP mã hóa bằng khóa
// gốc của nền tảng (được bọc lại cùng khi đổi khóa gốc), bước thời gian dùng gần nhất để mỗi mã chỉ dùng một lần
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_operator_totp')
      .addColumn('operator_id', 'uuid', (column) =>
        column.primaryKey().references('platform_operators.id').onDelete('cascade'),
      )
      .addColumn('secret_encrypted', 'text', (column) => column.notNull())
      .addColumn('last_step', 'bigint')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_operator_totp').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhận diện thương hiệu của trường (DT-SaaS phần S3, YCTD-195): màu chủ đạo của giao diện và tên hiển thị riêng (trống thì dùng tên
// trường đã có ở Cấu hình trường). Biểu trưng dùng lại ảnh biểu trưng của website trường (`website_settings.logo_file_id`). Một dòng
// duy nhất cho cả trường
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_branding')
      .addColumn('id', 'integer', (column) => column.primaryKey().check(sql`id = 1`))
      .addColumn('display_name', 'text', (column) => column.check(sql`char_length(display_name) between 1 and 200`))
      .addColumn('primary_color', 'text', (column) => column.check(sql`primary_color ~ '^#[0-9a-fA-F]{6}$'`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by_name', 'text')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('school_branding').execute();
  },
};

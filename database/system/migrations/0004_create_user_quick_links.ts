import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lối tắt "Truy cập nhanh" trên trang chủ cổng quản trị, riêng từng tài khoản và giữ qua các năm học nên đặt ở cơ sở dữ
// liệu hệ thống (YCTD-102). user_id là mã tài khoản ở dịch vụ định danh (khác cơ sở dữ liệu nên không có khóa ngoại);
// path chỉ nhận đường dẫn trong danh sách cho phép của cổng quản trị, kiểm tra ở máy chủ API
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_quick_links')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('path', 'text', (column) => column.notNull())
      .addColumn('label', 'text', (column) => column.notNull())
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('user_quick_links_user_path_unique', ['user_id', 'path'])
      .addCheckConstraint('user_quick_links_position_check', sql`position >= 0`)
      .addCheckConstraint('user_quick_links_label_check', sql`length(label) between 1 and 100`)
      .execute();
    await database.schema
      .createIndex('user_quick_links_user_position_index')
      .on('user_quick_links')
      .columns(['user_id', 'position'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_quick_links').execute();
  },
};

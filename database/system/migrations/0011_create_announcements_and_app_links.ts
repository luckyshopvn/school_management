import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16c. Thông báo hệ thống do quản trị soạn, bật lên khi người dùng vào cổng quản trị trong khoảng hiệu lực
// từ ngày đến ngày (ngày theo giờ Việt Nam, đến ngày để trống là không hết hạn); ứng dụng liên kết hiện ở lưới ứng dụng
// trên thanh đầu trang. Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học; created_by, updated_by là mã tài khoản ở
// dịch vụ định danh (khác cơ sở dữ liệu nên không có khóa ngoại)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('system_announcements')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('valid_from', 'date', (column) => column.notNull())
      .addColumn('valid_until', 'date')
      .addColumn('is_active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('created_by', 'uuid')
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('system_announcements_title_check', sql`length(title) between 1 and 200`)
      .addCheckConstraint('system_announcements_content_check', sql`length(content) between 1 and 5000`)
      .addCheckConstraint(
        'system_announcements_period_check',
        sql`valid_until is null or valid_until >= valid_from`,
      )
      .execute();
    await database.schema
      .createIndex('system_announcements_period_index')
      .on('system_announcements')
      .columns(['valid_from', 'valid_until'])
      .execute();

    await database.schema
      .createTable('portal_app_links')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('url', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('portal_app_links_name_check', sql`length(name) between 1 and 100`)
      .addCheckConstraint('portal_app_links_url_check', sql`url ~ '^https?://'`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('portal_app_links').execute();
    await database.schema.dropTable('system_announcements').execute();
  },
};

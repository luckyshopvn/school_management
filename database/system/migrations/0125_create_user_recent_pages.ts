import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trang mở gần đây của từng tài khoản cho nhóm "Hay dùng" của cổng quản trị (YCTD-337, GD-180): lưu ở máy chủ theo người
// dùng, không lưu ở trình duyệt; giữ qua các năm học nên đặt ở cơ sở dữ liệu hệ thống. user_id là mã tài khoản ở dịch vụ
// định danh (khác cơ sở dữ liệu nên không có khóa ngoại); path chỉ nhận đường dẫn trang của cổng quản trị, kiểm tra ở máy
// chủ API. Mỗi tài khoản giữ tối đa 20 dòng mới nhất (máy chủ xóa dòng cũ khi ghi)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_recent_pages')
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('path', 'text', (column) => column.notNull())
      .addColumn('visited_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('user_recent_pages_pkey', ['user_id', 'path'])
      .execute();
    await database.schema
      .createIndex('user_recent_pages_user_visited_index')
      .on('user_recent_pages')
      .columns(['user_id', 'visited_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_recent_pages').execute();
  },
};

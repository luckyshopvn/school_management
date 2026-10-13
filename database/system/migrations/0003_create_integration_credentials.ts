import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khóa truy cập của kết nối ngoài dùng chung toàn trường, giữ qua các năm học nên đặt ở cơ sở dữ liệu hệ thống (YCTD-92).
// Zalo Official Account cấp khóa truy cập sống khoảng 25 giờ và khóa làm mới chỉ dùng được một lần (mỗi lần làm mới nhận
// khóa làm mới mới, hạn 3 tháng) nên máy chủ phải lưu khóa mới nhất. Khóa được mã hóa AES-256-GCM trước khi lưu; không
// trả qua API
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('integration_credentials')
      .addColumn('connector', 'text', (column) => column.primaryKey())
      // Mã dòng để nhật ký thay đổi ở cơ sở dữ liệu năm học tham chiếu (cột entity_id kiểu uuid)
      .addColumn('id', 'uuid', (column) =>
        column
          .notNull()
          .unique()
          .defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn('access_token_encrypted', 'text')
      .addColumn('access_token_expires_at', 'timestamptz')
      .addColumn('refresh_token_encrypted', 'text')
      .addColumn('refreshed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('integration_credentials_connector_check', sql`connector in ('zalo')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('integration_credentials').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấu hình lưới dữ liệu theo từng tài khoản (DT-15 phần 15a): cột hiển thị theo thứ tự và số dòng mỗi trang của từng
// lưới; grid_key "default" giữ số dòng mặc định cho mọi lưới. Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học;
// user_id là mã tài khoản ở dịch vụ định danh (khác cơ sở dữ liệu nên không có khóa ngoại); grid_key và nội dung
// settings kiểm tra ở máy chủ API
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_grid_settings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('grid_key', 'text', (column) => column.notNull())
      .addColumn('settings', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('user_grid_settings_user_grid_unique', ['user_id', 'grid_key'])
      .addCheckConstraint('user_grid_settings_grid_key_check', sql`length(grid_key) between 1 and 64`)
      .addCheckConstraint('user_grid_settings_settings_check', sql`jsonb_typeof(settings) = 'object'`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_grid_settings').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khóa VAPID của nền tảng cho thông báo đẩy Web Push (DT-26 phần 26b, YCTD-232): một cặp khóa dùng chung mọi trường; khóa riêng mã hóa
// bằng khóa gốc của nền tảng, không xuống cơ sở dữ liệu trường; sinh bằng lệnh `platform generate-vapid-keys`, không ghi vào kho mã.
// Đổi khóa thì thêm dòng mới, dòng cũ ghi `retired_at`; đăng ký cũ phải đăng ký lại (hướng dẫn vận hành)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_push_keys')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('public_key', 'text', (column) => column.notNull())
      .addColumn('private_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('subject', 'text', (column) => column.notNull().check(sql`subject ~ '^(mailto:|https://)'`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('retired_at', 'timestamptz')
      .execute();
    await sql`create unique index platform_push_keys_active on platform_push_keys ((true)) where retired_at is null`.execute(
      database,
    );
  },
  async down(database) {
    await database.schema.dropTable('platform_push_keys').execute();
  },
};

import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khóa đẩy gốc của nền tảng (DT-26 phần 26g, YCTD-237): tệp tài khoản dịch vụ Firebase cho FCM (Android) và khóa APNs `.p8` (iOS)
// thuộc một ứng dụng chung cho mọi trường; lưu mã hóa bằng khóa gốc của nền tảng, không xuống cơ sở dữ liệu trường; nạp bằng lệnh
// `platform set-native-push-key`, không ghi vào kho mã. Mỗi nhà cung cấp một khóa đang dùng; đổi khóa thì dòng cũ ghi `retired_at`.
// `summary` là phần không bí mật để hiển thị và đối chiếu (mã dự án Firebase, thư điện tử của tài khoản dịch vụ; mã khóa, mã đội,
// mã gói, môi trường của APNs)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_native_push_keys')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('provider', 'text', (column) => column.notNull().check(sql`provider in ('fcm', 'apns')`))
      .addColumn('credentials_encrypted', 'text', (column) => column.notNull())
      .addColumn('summary', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('retired_at', 'timestamptz')
      .execute();
    await sql`create unique index platform_native_push_keys_active on platform_native_push_keys (provider)
      where retired_at is null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('platform_native_push_keys').execute();
  },
};

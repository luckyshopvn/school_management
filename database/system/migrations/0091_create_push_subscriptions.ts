import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đăng ký thông báo đẩy theo người dùng và thiết bị (DT-26 phần 26b, YCTD-232; tài liệu 32 mục 18), ở cơ sở dữ liệu hệ thống của
// trường nên tự tách theo trường:
// - `endpoint_encrypted`, `keys_encrypted`: địa chỉ đăng ký và khóa nhận (p256dh, auth) mã hóa bằng khóa của trường; `endpoint_hash`
//   là mã băm có khóa của địa chỉ để chống trùng mà không giải mã;
// - `app` (`teacher`, `parent`, `student`), `kind` (`web_push`, chừa `fcm`, `apns` cho 26g), `origin` lúc đăng ký;
// - `device_label`: nhãn ngắn (loại máy, trình duyệt), không lưu toàn chuỗi nhận dạng trình duyệt;
// - `last_seen_at`, `failure_count`, `revoked_at`, `revoked_reason`: thu hồi khi đăng xuất, khi dịch vụ đẩy báo hết hạn (404, 410),
//   hoặc dọn sau 90 ngày không thấy.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('push_subscriptions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('app', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('web_push'))
      .addColumn('endpoint_hash', 'text', (column) => column.notNull())
      .addColumn('endpoint_encrypted', 'text', (column) => column.notNull())
      .addColumn('keys_encrypted', 'text', (column) => column.notNull())
      .addColumn('origin', 'text')
      .addColumn('device_label', 'text', (column) => column.check(sql`char_length(device_label) <= 80`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_seen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_success_at', 'timestamptz')
      .addColumn('failure_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_reason', 'text')
      .addCheckConstraint('push_subscriptions_app_check', sql`app in ('teacher', 'parent', 'student')`)
      .addCheckConstraint('push_subscriptions_kind_check', sql`kind in ('web_push', 'fcm', 'apns')`)
      .execute();
    // Một địa chỉ đăng ký còn hiệu lực chỉ thuộc một người dùng (máy dùng chung đổi người thì đăng ký cũ bị thu hồi)
    await sql`create unique index push_subscriptions_active_endpoint on push_subscriptions (endpoint_hash)
      where revoked_at is null`.execute(database);
    await database.schema
      .createIndex('push_subscriptions_user_idx')
      .on('push_subscriptions')
      .columns(['user_id', 'revoked_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('push_subscriptions').execute();
  },
};

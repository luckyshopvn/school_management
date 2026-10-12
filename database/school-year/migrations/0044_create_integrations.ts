import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kết nối ngoài giai đoạn 3 (P14-08, G3-03, G3-08; BR-64, BR-65; YCTD-90):
// - `integration_settings`: cấu hình toàn trường của từng kết nối (bật hay tắt, mã trang, mã Official Account); khóa bí mật
//   chỉ đọc từ biến môi trường, không lưu ở đây;
// - `zalo_followers`: số điện thoại phụ huynh đã quan tâm Official Account kèm mã người dùng Zalo, do người quản trị liên kết;
// - `facebook_posts`: mỗi hoạt động hoặc tin tức đăng lên Fanpage một bài, ghi trạng thái, lỗi, số lần thử;
// - kênh thông báo `zalo`: gửi qua Zalo khi bật và người nhận đã liên kết, không được thì gửi tin nhắn; `delivered_via`
//   ghi kênh thực tế đã gửi
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('integration_settings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('connector', 'text', (column) => column.notNull().unique())
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('config_data', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('integration_settings_connector_check', sql`connector in ('facebook', 'zalo')`)
      .execute();

    await database.schema
      .createTable('zalo_followers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('phone', 'text', (column) => column.notNull().unique())
      .addColumn('zalo_user_id', 'text', (column) => column.notNull().unique())
      .addColumn('display_name', 'text')
      .addColumn('linked_by', 'uuid', (column) => column.notNull())
      .addColumn('linked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('facebook_posts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('source_type', 'text', (column) => column.notNull())
      .addColumn('source_id', 'uuid', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('message', 'text', (column) => column.notNull())
      .addColumn('photo_file_ids', sql`uuid[]`, (column) => column.notNull().defaultTo(sql`'{}'::uuid[]`))
      .addColumn('excluded_photo_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('page_id', 'text', (column) => column.notNull())
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('external_post_id', 'text')
      .addColumn('last_error', 'text')
      .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('posted_by', 'uuid', (column) => column.notNull())
      .addColumn('posted_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('facebook_posts_source_type_check', sql`source_type in ('activity', 'news')`)
      .addCheckConstraint('facebook_posts_status_check', sql`status in ('posted', 'failed')`)
      .addUniqueConstraint('facebook_posts_source_unique', ['source_type', 'source_id'])
      .execute();
    await database.schema
      .createIndex('facebook_posts_org_unit_index')
      .on('facebook_posts')
      .columns(['org_unit_id', 'created_at'])
      .execute();

    await database.schema.alterTable('notification_recipients').addColumn('delivered_via', 'text').execute();
    await sql`alter table notification_recipients drop constraint notification_recipients_channel_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_channel_check
      check (channel in ('in_app', 'sms', 'zalo'))`.execute(database);
    await sql`alter table notification_recipients add constraint notification_recipients_delivered_via_check
      check (delivered_via is null or delivered_via in ('in_app', 'sms', 'zalo'))`.execute(database);
  },
  async down(database) {
    await sql`alter table notification_recipients drop constraint notification_recipients_delivered_via_check`.execute(
      database,
    );
    await sql`update notification_recipients set channel = 'sms' where channel = 'zalo'`.execute(database);
    await sql`alter table notification_recipients drop constraint notification_recipients_channel_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_channel_check
      check (channel in ('in_app', 'sms'))`.execute(database);
    await database.schema.alterTable('notification_recipients').dropColumn('delivered_via').execute();
    await database.schema.dropTable('facebook_posts').execute();
    await database.schema.dropTable('zalo_followers').execute();
    await database.schema.dropTable('integration_settings').execute();
  },
};

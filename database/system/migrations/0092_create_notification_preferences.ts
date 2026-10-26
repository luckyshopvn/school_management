import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tuỳ chọn tắt thông báo đẩy theo nhóm loại (DT-26 phần 26b, YCTD-232):
// - notification_preferences: mỗi người dùng, mỗi nhóm một dòng khi đã đổi khỏi mặc định (mặc định bật); chỉ áp cho kênh đẩy;
// - notification_urgent_templates: loại thông báo quản trị trường đánh dấu là khẩn, không tắt được ở kênh đẩy.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('notification_preferences')
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('group_code', 'text', (column) => column.notNull())
      .addColumn('push_enabled', 'boolean', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('notification_preferences_pk', ['user_id', 'group_code'])
      .addCheckConstraint('notification_preferences_group_check', sql`group_code ~ '^[a-z_]{2,40}$'`)
      .execute();
    await database.schema
      .createTable('notification_urgent_templates')
      .addColumn('template_code', 'text', (column) =>
        column.primaryKey().check(sql`template_code ~ '^[a-z0-9_]{2,80}$'`),
      )
      .addColumn('marked_by', 'uuid', (column) => column.notNull())
      .addColumn('marked_by_name', 'text', (column) => column.notNull())
      .addColumn('marked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('notification_urgent_templates').execute();
    await database.schema.dropTable('notification_preferences').execute();
  },
};

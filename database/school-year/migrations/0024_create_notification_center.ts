import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trung tâm thông báo (P19-04, P19-05; BR-70; YCTD-64): ghi nhận từng người đã đọc, kể cả thông báo gửi theo vai trò;
// mẫu thông báo chung toàn trường thay tiêu đề và nội dung khi hiển thị
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('notification_reads')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('notification_id', 'uuid', (column) => column.notNull().references('notifications.id'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('read_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('notification_reads_notification_user_unique', ['notification_id', 'user_id'])
      .execute();

    await database.schema
      .createTable('notification_templates')
      .addColumn('template_code', 'text', (column) => column.primaryKey())
      .addColumn('title_template', 'text', (column) => column.notNull())
      .addColumn('body_template', 'text', (column) => column.notNull())
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('notification_recipients_user_index')
      .on('notification_recipients')
      .column('user_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropIndex('notification_recipients_user_index').execute();
    await database.schema.dropTable('notification_templates').execute();
    await database.schema.dropTable('notification_reads').execute();
  },
};

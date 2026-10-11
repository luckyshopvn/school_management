import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tiến trình gửi thông báo (CB-07, YCTD-71): số lần thử, thời điểm thử lại, lỗi gần nhất; tin nhắn vượt giới hạn 5 tin
// mỗi ngày của một người nhận ghi trạng thái `limited` (KT-09)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('notification_recipients')
      .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('next_attempt_at', 'timestamptz')
      .addColumn('last_error', 'text')
      .execute();
    await sql`alter table notification_recipients drop constraint notification_recipients_status_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_status_check
      check (channel_status in ('pending', 'sent', 'failed', 'limited'))`.execute(database);
    await database.schema
      .createIndex('notification_recipients_pending_index')
      .on('notification_recipients')
      .column('next_attempt_at')
      .where(sql.ref('channel_status'), '=', 'pending')
      .execute();
  },
  async down(database) {
    await database.schema.dropIndex('notification_recipients_pending_index').execute();
    await sql`update notification_recipients set channel_status = 'failed' where channel_status = 'limited'`.execute(
      database,
    );
    await sql`alter table notification_recipients drop constraint notification_recipients_status_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_status_check
      check (channel_status in ('pending', 'sent', 'failed'))`.execute(database);
    await database.schema
      .alterTable('notification_recipients')
      .dropColumn('attempt_count')
      .dropColumn('next_attempt_at')
      .dropColumn('last_error')
      .execute();
  },
};

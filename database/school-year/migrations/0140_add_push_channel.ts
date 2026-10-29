import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kênh thông báo đẩy `push` của hàng đợi thông báo chung (DT-26 phần 26b, YCTD-232; tài liệu 47 mục 18): tiến trình gửi thêm người
// nhận kênh `push` cho người nhận trong ứng dụng có đăng ký đẩy còn hiệu lực, gửi qua bộ nối `PushSender`; `delivered_via` ghi `push`
export const migration: Migration = {
  async up(database) {
    await sql`alter table notification_recipients drop constraint notification_recipients_channel_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_channel_check
      check (channel in ('in_app', 'sms', 'zalo', 'push'))`.execute(database);
    await sql`alter table notification_recipients drop constraint notification_recipients_delivered_via_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_delivered_via_check
      check (delivered_via is null or delivered_via in ('in_app', 'sms', 'zalo', 'push'))`.execute(database);
    // Gộp thông báo cùng nhóm trong vài phút: tìm lần đẩy gần nhất của người nhận theo kênh và thời điểm gửi
    await database.schema
      .createIndex('notification_recipients_push_recent_idx')
      .on('notification_recipients')
      .columns(['user_id', 'sent_at'])
      .where(sql.ref('channel'), '=', 'push')
      .execute();
  },
  async down(database) {
    await database.schema.dropIndex('notification_recipients_push_recent_idx').execute();
    await sql`delete from notification_recipients where channel = 'push'`.execute(database);
    await sql`alter table notification_recipients drop constraint notification_recipients_delivered_via_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_delivered_via_check
      check (delivered_via is null or delivered_via in ('in_app', 'sms', 'zalo'))`.execute(database);
    await sql`alter table notification_recipients drop constraint notification_recipients_channel_check`.execute(
      database,
    );
    await sql`alter table notification_recipients add constraint notification_recipients_channel_check
      check (channel in ('in_app', 'sms', 'zalo'))`.execute(database);
  },
};

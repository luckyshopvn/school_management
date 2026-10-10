import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';

// Ghi thông báo vào hàng đợi; gửi thật trong ứng dụng và qua tin nhắn làm ở phân hệ thông báo (YCTD-44)
export interface QueuedNotification {
  orgUnitId: string | null;
  templateCode: string;
  title: string;
  body: string;
  targetType: string;
  targetId: string;
  recipients: Array<{ userId: string; channel: 'in_app' | 'sms' }>;
}

export async function queueNotification(
  executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  notification: QueuedNotification,
): Promise<void> {
  const unique = new Map(
    notification.recipients.map((recipient) => [`${recipient.userId}:${recipient.channel}`, recipient]),
  );
  if (unique.size === 0) {
    return;
  }
  const created = await executor
    .insertInto('notifications')
    .values({
      org_unit_id: notification.orgUnitId,
      template_code: notification.templateCode,
      title: notification.title,
      body: notification.body,
      target_type: notification.targetType,
      target_id: notification.targetId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await executor
    .insertInto('notification_recipients')
    .values(
      [...unique.values()].map((recipient) => ({
        notification_id: created.id,
        user_id: recipient.userId,
        channel: recipient.channel,
      })),
    )
    .execute();
}

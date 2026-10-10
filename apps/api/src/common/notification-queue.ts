import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';

// Ghi thông báo vào hàng đợi; gửi thật trong ứng dụng và qua tin nhắn làm ở phân hệ thông báo (YCTD-44).
// Người nhận là một tài khoản, hoặc mọi tài khoản có vai trò ở đơn vị, xác định khi gửi (YCTD-47)
export type NotificationRecipient =
  { userId: string; channel: 'in_app' | 'sms' } | { roleCode: string; orgUnitId: string; channel: 'in_app' | 'sms' };

export interface QueuedNotification {
  orgUnitId: string | null;
  templateCode: string;
  title: string;
  body: string;
  targetType: string;
  targetId: string;
  recipients: NotificationRecipient[];
}

function recipientKey(recipient: NotificationRecipient): string {
  return 'userId' in recipient
    ? `${recipient.userId}:${recipient.channel}`
    : `${recipient.roleCode}:${recipient.orgUnitId}:${recipient.channel}`;
}

export async function queueNotification(
  executor: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  notification: QueuedNotification,
): Promise<void> {
  const unique = new Map(notification.recipients.map((recipient) => [recipientKey(recipient), recipient]));
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
        user_id: 'userId' in recipient ? recipient.userId : null,
        role_code: 'roleCode' in recipient ? recipient.roleCode : null,
        org_unit_id: 'orgUnitId' in recipient ? recipient.orgUnitId : null,
        channel: recipient.channel,
      })),
    )
    .execute();
}

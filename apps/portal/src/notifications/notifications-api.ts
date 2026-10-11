import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối thông báo của người đăng nhập (P19-04, YCTD-64)
export interface NotificationItem {
  id: string;
  template_code: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

export const readNotifications = (unreadOnly = false) =>
  requestJson<{ unread_count: number; notifications: NotificationItem[] }>(
    `/api/v1/notifications${unreadOnly ? '?unread_only=true' : ''}`,
  );

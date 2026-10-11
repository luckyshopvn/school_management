import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Thông báo của tôi trên ứng dụng (P19-04, BR-70, YCTD-64): mười thông báo gần nhất, bấm để đánh dấu đã đọc
interface NotificationItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );

export function NotificationsPanel() {
  const [data, setData] = useState<{ unread_count: number; notifications: NotificationItem[] }>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [expanded, setExpanded] = useState(false);

  const load = () =>
    requestJson<{ unread_count: number; notifications: NotificationItem[] }>('/api/v1/notifications')
      .then(setData)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không tải được thông báo'),
      );

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (id: string) => {
    await requestJson(`/api/v1/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
    await load();
  };

  if (!data) {
    return errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null;
  }
  const shown = expanded ? data.notifications : data.notifications.slice(0, 3);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Thông báo">
      <h2 className="text-section-title font-semibold text-text">Thông báo ({data.unread_count} chưa đọc)</h2>
      {data.notifications.length === 0 ? <p className="text-content text-text-secondary">Chưa có thông báo.</p> : null}
      <ul className="flex flex-col gap-2">
        {shown.map((item) => (
          <li key={item.id} className={`rounded-lg border border-border p-3 ${item.is_read ? '' : 'bg-selected'}`}>
            <p className="text-content font-semibold">{item.title}</p>
            <p className="text-content">{item.body}</p>
            <p className="text-label text-text-secondary">{formatTime(item.created_at)}</p>
            {!item.is_read ? (
              <Button variant="text" onClick={() => void markRead(item.id)}>
                Đã đọc
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {data.notifications.length > 3 ? (
        <Button variant="text" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Thu gọn' : 'Xem tất cả'}
        </Button>
      ) : null}
    </section>
  );
}

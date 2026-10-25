import { useEffect, useState } from 'react';

// Biểu ngữ thông báo bảo trì của nhà vận hành nền tảng ở ứng dụng giáo viên, phụ huynh (DT-SaaS phần S4, YCTD-197): ứng dụng truyền
// hàm đọc GET /api/v1/platform-notices bằng phiên của mình; lỗi đọc thì không hiện gì
export interface MaintenanceNoticeItem {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  starts_at: string;
  ends_at: string;
}

const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function MaintenanceBanner({ load }: { load: () => Promise<{ maintenance: MaintenanceNoticeItem[] }> }) {
  const [items, setItems] = useState<MaintenanceNoticeItem[]>([]);
  useEffect(() => {
    let active = true;
    load()
      .then((reply) => {
        if (active) {
          setItems(reply.maintenance);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <>
      {items.map((notice) => (
        <div
          key={notice.id}
          role={notice.severity === 'critical' ? 'alert' : 'note'}
          aria-label="Thông báo bảo trì"
          className={`px-4 py-1.5 text-center text-label font-medium ${
            notice.severity === 'critical' ? 'bg-danger text-white' : 'bg-header-accent text-text'
          }`}
        >
          <strong>{notice.title}</strong> ({TIME.format(new Date(notice.starts_at))} đến{' '}
          {TIME.format(new Date(notice.ends_at))}): {notice.body}
        </div>
      ))}
    </>
  );
}

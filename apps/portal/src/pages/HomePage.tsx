import { useQuery } from '@tanstack/react-query';
import { Alert } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { AppShell } from './AppShell.js';
import { QuickAccess } from './QuickAccess.js';
import { WorkspaceDashboard } from './WorkspaceDashboard.js';

// Dòng ngày trên tiêu đề trang chủ theo giờ Việt Nam, ví dụ "Thứ Tư, 28/10/2026"
const todayText = () => {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date}`;
};

// Trang chủ: lời chào, bảng điều khiển theo phân hệ đang chọn (MH-01 theo quyền YCTD-62, YCTD-307), truy cập nhanh
// (YCTD-102). Khối "Vai trò của bạn" đã bỏ theo yêu cầu của Eric ngày 2026-10-28
export function HomePage() {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });

  return (
    <AppShell>
      {currentUser.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-7 w-64 animate-pulse rounded bg-border" />
          <div className="h-4 w-48 animate-pulse rounded bg-border" />
        </div>
      ) : currentUser.isError ? (
        <Alert tone="danger">{currentUser.error.message}</Alert>
      ) : (
        <section className="flex flex-col gap-5">
          <div>
            <p className="mb-1 text-label text-text-secondary">{todayText()}</p>
            <h1 className="text-page-title font-bold text-text">Xin chào, {currentUser.data.full_name}</h1>
          </div>
          <WorkspaceDashboard />
          <QuickAccess />
        </section>
      )}
    </AppShell>
  );
}

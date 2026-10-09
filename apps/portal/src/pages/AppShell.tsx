import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// Khung trang của cổng quản trị: điều hướng dọc bên trái rộng 240 điểm ảnh (BC-01, KC-08)
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Điều hướng chính"
        className="flex w-60 shrink-0 flex-col gap-4 border-r border-border bg-card p-4"
      >
        <span className="text-section-title font-semibold text-brand-strong">School Management</span>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              to="/"
              className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
              activeProps={{ className: 'bg-selected' }}
            >
              Trang chủ
            </Link>
          </li>
        </ul>
        <span className="px-3 text-label font-semibold text-text-muted">THIẾT LẬP</span>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              to="/academic-years"
              className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
              activeProps={{ className: 'bg-selected' }}
            >
              Năm học
            </Link>
          </li>
          <li>
            <Link
              to="/org-units"
              className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
              activeProps={{ className: 'bg-selected' }}
            >
              Cây đơn vị
            </Link>
          </li>
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
          {currentUser.data ? (
            <span className="text-label font-medium text-text" data-testid="current-user-name">
              {currentUser.data.full_name}
            </span>
          ) : (
            <span className="h-4 w-32 animate-pulse rounded bg-border" aria-hidden="true" />
          )}
          <Link to="/change-password" className="text-label text-link hover:underline">
            Đổi mật khẩu
          </Link>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

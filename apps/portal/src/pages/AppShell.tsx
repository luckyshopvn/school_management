import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { PERMISSION_CODES } from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';
import { useSession } from '../session/session.js';

type NavigationPath =
  | '/'
  | '/academic-years'
  | '/org-units'
  | '/accounts'
  | '/roles'
  | '/settings'
  | '/audit-logs'
  | '/departments'
  | '/catalogs'
  | '/approval-thresholds'
  | '/rooms';

function NavItem({ to, label }: { to: NavigationPath; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
        activeProps={{ className: 'bg-selected' }}
      >
        {label}
      </Link>
    </li>
  );
}

// Khung trang của cổng quản trị: điều hướng dọc bên trái rộng 240 điểm ảnh (BC-01, KC-08)
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  // Chỉ hiện mục người dùng có quyền; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
  const canManageAllAccounts = useHasPermission(PERMISSION_CODES.accountManage);
  const canManageAccountsInUnit = useHasPermission(PERMISSION_CODES.accountManageInUnit);
  const canSeeAccounts = canManageAllAccounts || canManageAccountsInUnit;
  const canViewPlatform = useHasPermission('P01.view');
  const canManageSettings = useHasPermission(PERMISSION_CODES.settingManage);
  const canManageDepartments = useHasPermission(PERMISSION_CODES.departmentManage);
  const canManageCatalogs = useHasPermission(PERMISSION_CODES.catalogManage);
  const canManageRooms = useHasPermission(PERMISSION_CODES.roomManage);

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Điều hướng chính"
        className="flex w-60 shrink-0 flex-col gap-4 border-r border-border bg-card p-4"
      >
        <span className="text-section-title font-semibold text-brand-strong">School Management</span>
        <ul className="flex flex-col gap-1">
          <NavItem to="/" label="Trang chủ" />
        </ul>
        <span className="px-3 text-label font-semibold text-text-muted">THIẾT LẬP</span>
        <ul className="flex flex-col gap-1">
          <NavItem to="/academic-years" label="Năm học" />
          <NavItem to="/org-units" label="Cây đơn vị" />
          {canSeeAccounts ? (
            <>
              <NavItem to="/accounts" label="Tài khoản" />
              <NavItem to="/roles" label="Vai trò và quyền" />
            </>
          ) : null}
          {canViewPlatform || canManageDepartments ? (
            <NavItem to="/departments" label="Phòng ban và chức danh" />
          ) : null}
          {canViewPlatform || canManageCatalogs ? <NavItem to="/catalogs" label="Danh mục dùng chung" /> : null}
          {canViewPlatform ? <NavItem to="/approval-thresholds" label="Hạn mức phê duyệt" /> : null}
          {canViewPlatform || canManageRooms || canManageCatalogs ? (
            <NavItem to="/rooms" label="Phòng học và bậc học" />
          ) : null}
          {canViewPlatform || canManageSettings ? <NavItem to="/settings" label="Cấu hình" /> : null}
          {canViewPlatform ? <NavItem to="/audit-logs" label="Nhật ký thao tác" /> : null}
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

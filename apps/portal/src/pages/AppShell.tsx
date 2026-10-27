import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { listPortalMenuEntries } from '@school-management/shared';
import { Link, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { WorkspaceContext, WorkspaceSwitcher, useWorkspaceState } from './workspaces.js';
import { MyWorkHeaderLink } from '../my-work/MyWorkBadge.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { AcademicYearSwitcher } from './AcademicYearSwitcher.js';
import { SchoolLevelSwitcher } from '../school-levels/working-level.js';
import { NavigationRegistryContext, useNavigationRegistryState } from './navigation-registry.js';
import { fetchCurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { MainMenu, MobileMenu } from './MainMenu.js';
import { usePortalMenu } from './menu-permissions.js';
import { UserMenu } from './UserMenu.js';
import { Alert, Toast } from '@school-management/ui';
import { FeedbackDialog } from '../feedback/FeedbackDialog.js';
import { AppLauncher } from '../portal-shell/AppLauncher.js';
import { StartupNotices } from '../portal-shell/StartupNotices.js';
import { readPortalContext } from '../portal-shell/portal-shell-api.js';
import { DemoBanner, ImpersonationBanner } from '../administration/AdministrationBanners.js';
import { SchoolPlanBanner } from '../school-plan/school-plan.js';
import { PlatformNoticeBanner } from '../support/support.js';

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

// Khung trang của cổng quản trị theo hệ thống của Sở (DT-15 phần 15a, thay thanh điều hướng bên trái của YCTD-99): thanh
// đầu trang màu xanh (tên phần mềm, ô chọn phân hệ, năm học, chuông thông báo, menu người dùng), dưới là menu ngang đánh
// số của phân hệ đang chọn; màn hình hẹp dùng nút "☰" mở cây menu gập. Chân trang có nút "Gửi phản hồi"; mật khẩu sắp
// hết hạn thì báo ở đầu trang (DT-15 phần 15g, YCTD-110). DT-16 phần 16c: tên trường màu vàng thay tên phần mềm, lưới
// ứng dụng liên kết, hộp thông báo bật lên khi vào trang
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const portalContext = useQuery({ queryKey: ['portal-context'], queryFn: readPortalContext });
  const schoolName = portalContext.data?.school_name ?? 'School Management';
  // Chỉ hiện mục người dùng có quyền; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
  const menu = usePortalMenu();
  const workspaces = useWorkspaceState(menu);
  const navigationRegistry = useNavigationRegistryState(menu);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const { pathname } = useLocation();
  const { ensure } = workspaces;

  // Mở trang thuộc phân hệ khác (đường dẫn, chuông thông báo, truy cập nhanh) thì menu chuyển sang phân hệ của trang
  const pageWorkspace = listPortalMenuEntries(menu).find(
    (entry) => pathname === entry.node.path || pathname.startsWith(`${entry.node.path}/`),
  )?.workspace.key;
  useEffect(() => {
    if (pageWorkspace) {
      ensure(pageWorkspace);
    }
  }, [pathname, pageWorkspace, ensure]);

  return (
    <WorkspaceContext.Provider value={workspaces}>
      <NavigationRegistryContext.Provider value={navigationRegistry}>
        <div className="flex min-h-screen flex-col">
          {/* Thanh đăng nhập thay, dải bản trình diễn ở mọi trang (DT-18 phần 18h) */}
          <ImpersonationBanner />
          <DemoBanner />
          {/* Nhắc hạn gói dịch vụ, chế độ chỉ đọc (DT-SaaS phần S5a) */}
          <SchoolPlanBanner />
          {/* Thông báo bảo trì, phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4) */}
          <PlatformNoticeBanner />
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-header px-4 text-white shadow-sm">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-header-strong xl:hidden"
              aria-label="Menu chức năng"
              aria-expanded={mobileOpen}
              aria-controls="menu-gon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <MenuIcon />
            </button>
            <Link
              to="/"
              className="hidden max-w-80 truncate whitespace-nowrap text-section-title font-bold text-header-accent lg:inline max-xl:lg:block max-xl:lg:py-2.5"
              title={schoolName}
              data-testid="school-name"
            >
              {schoolName}
            </Link>
            <WorkspaceSwitcher state={workspaces} />
            <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
              <SchoolLevelSwitcher />
              <AcademicYearSwitcher />
              <MyWorkHeaderLink />
              <NotificationBell />
              <AppLauncher />
              {currentUser.isPending ? (
                <span className="h-4 w-32 animate-pulse rounded bg-header-strong" aria-hidden="true" />
              ) : (
                <UserMenu fullName={currentUser.data?.full_name} onLogout={() => void session.logout()} />
              )}
            </div>
          </header>
          <MainMenu workspaces={menu} current={workspaces.current} />
          {mobileOpen ? (
            <MobileMenu
              workspace={menu.find((workspace) => workspace.key === workspaces.current)}
              onClose={closeMobile}
            />
          ) : null}
          <main className="w-full min-w-0 flex-1 p-4 md:p-6">
            {session.passwordExpiresInDays !== null ? (
              <div className="mb-4">
                <Alert tone="warning">
                  Mật khẩu sẽ hết hạn sau {session.passwordExpiresInDays} ngày.{' '}
                  <Link to="/change-password" className="underline">
                    Đổi mật khẩu
                  </Link>
                </Alert>
              </div>
            ) : null}
            {children}
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 text-label text-text-secondary">
            <span>School Management</span>
            <button
              type="button"
              className="font-medium text-link hover:underline"
              onClick={() => setFeedbackOpen(true)}
            >
              Gửi phản hồi
            </button>
          </footer>
          {feedbackOpen ? (
            <FeedbackDialog
              pageUrl={pathname}
              onClose={() => setFeedbackOpen(false)}
              onSent={(message) => {
                setFeedbackOpen(false);
                setToastMessage(message);
              }}
            />
          ) : null}
          <Toast message={toastMessage} onClose={closeToast} />
          <StartupNotices />
        </div>
      </NavigationRegistryContext.Provider>
    </WorkspaceContext.Provider>
  );
}

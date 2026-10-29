import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { listPortalMenuEntries } from '@school-management/shared';
import { Link, useLocation } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkspaceContext, WorkspaceSwitcher, useWorkspaceState } from './workspaces.js';
import { MyWorkHeaderLink } from '../my-work/MyWorkBadge.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { AcademicYearSwitcher } from './AcademicYearSwitcher.js';
import { NavigationRegistryContext, useNavigationRegistryState } from './navigation-registry.js';
import { fetchCurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { SideMenu } from './MainMenu.js';
import { FunctionSearch } from './FunctionSearch.js';
import { recordRecentPage } from './recent-pages-api.js';
import { usePortalMenu } from './menu-permissions.js';
import { UserMenu } from './UserMenu.js';
import { Alert, Toast } from '@school-management/ui';
import { FeedbackDialog } from '../feedback/FeedbackDialog.js';
import { AppLauncher } from '../portal-shell/AppLauncher.js';
import { StartupNotices } from '../portal-shell/StartupNotices.js';
import { readPortalContext } from '../portal-shell/portal-shell-api.js';
import { DemoBanner, ImpersonationBanner } from '../administration/AdministrationBanners.js';
import { PaidFeatureNotice, SchoolPlanBanner, usePaidFeatureFor } from '../school-plan/school-plan.js';
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

// Khung trang của cổng quản trị (YCTD-330, thay khung menu ngang của DT-15 phần 15a theo GD-170): thanh bên trái xanh đậm có
// tên trường màu vàng (DT-16 phần 16c), ô chọn phân hệ và cây menu đánh số của phân hệ đang chọn (GD-171 giữ số thứ bậc);
// thanh đầu trang có cấp học, năm học, Việc của tôi, chuông thông báo, lưới ứng dụng liên kết, menu người dùng. Dưới 1280 px
// thanh bên thành ngăn kéo mở bằng nút "☰". Bỏ chân trang: "Gửi phản hồi" (DT-15 phần 15g) chuyển vào menu người dùng. Mật
// khẩu sắp hết hạn vẫn báo ở đầu trang (YCTD-110)
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
  const closeMenuButton = useRef<HTMLButtonElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const { pathname } = useLocation();
  const { ensure } = workspaces;
  const paidModule = usePaidFeatureFor(pathname);

  // Mở trang thuộc phân hệ khác (đường dẫn, chuông thông báo, truy cập nhanh) thì menu chuyển sang phân hệ của trang. Trang
  // có ở cả phân hệ đang chọn thì giữ phân hệ đang chọn, để vừa chuyển phân hệ xong menu không bị kéo về phân hệ cũ
  const pageEntries = listPortalMenuEntries(menu).filter(
    (entry) => pathname === entry.node.path || pathname.startsWith(`${entry.node.path}/`),
  );
  const pageWorkspace = pageEntries.some((entry) => entry.workspace.key === workspaces.current)
    ? workspaces.current
    : pageEntries[0]?.workspace.key;
  useEffect(() => {
    if (pageWorkspace) {
      ensure(pageWorkspace);
    }
  }, [pathname, pageWorkspace, ensure]);

  // Ghi trang vừa mở cho nhóm "Hay dùng" (YCTD-337): chỉ trang là mục menu người dùng thấy; lỗi ghi không ảnh hưởng trang
  const queryClient = useQueryClient();
  const menuPagePath = pageEntries.find((entry) => entry.node.path === pathname)?.node.path;
  useEffect(() => {
    if (!menuPagePath) {
      return;
    }
    recordRecentPage(menuPagePath)
      .then(() => queryClient.invalidateQueries({ queryKey: ['recent-pages'] }))
      .catch(() => undefined);
  }, [menuPagePath, queryClient]);

  // Ngăn kéo menu dưới 1280 px: đóng khi chọn trang khác hoặc bấm Esc
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);
  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }
    // Mở ngăn kéo thì đưa con trỏ bàn phím vào nút Đóng menu
    closeMenuButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobile();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

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
          <div className="flex min-h-0 flex-1">
            {/* Thanh bên: luôn hiện từ 1280 px; dưới 1280 px là ngăn kéo phủ lên trang */}
            <aside
              aria-label="Thanh bên"
              className={`w-64 shrink-0 flex-col gap-2 overflow-y-auto bg-nav px-3 py-4 text-nav-text xl:sticky xl:top-0 xl:flex xl:h-screen ${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex shadow-lg max-xl:w-80 max-xl:max-w-[85vw]' : 'hidden'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/"
                  className="flex min-h-11 min-w-0 items-center px-3 text-section-title font-bold leading-snug text-header-accent"
                  title={schoolName}
                  data-testid="school-name"
                >
                  {schoolName}
                </Link>
                {mobileOpen ? (
                  <button
                    ref={closeMenuButton}
                    type="button"
                    aria-label="Đóng menu"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-section-title text-white hover:bg-nav-hover"
                    onClick={closeMobile}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
              </div>
              <WorkspaceSwitcher state={workspaces} />
              <SideMenu workspaces={menu} current={workspaces.current} />
              {/* Đường vào mọi mục của mọi phân hệ (YCTD-332) */}
              <Link
                to="/all-functions"
                aria-current={pathname === '/all-functions' ? 'page' : undefined}
                className={`mt-2 flex min-h-10 items-center rounded-md border-t border-white/15 px-3 pt-2 text-label hover:bg-nav-hover max-xl:min-h-11 ${pathname === '/all-functions' ? 'bg-nav-active text-white' : 'text-nav-text'}`}
              >
                Tất cả chức năng
              </Link>
            </aside>
            {mobileOpen ? (
              // Nền mờ: chạm ra ngoài ngăn kéo thì đóng; người dùng bàn phím đóng bằng nút Đóng menu hoặc Esc
              <div className="fixed inset-0 z-40 bg-text/40 xl:hidden" aria-hidden="true" onClick={closeMobile} />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-header px-4 text-white shadow-sm">
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
                <FunctionSearch workspaces={menu} />
                <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
                  <AcademicYearSwitcher />
                  <MyWorkHeaderLink />
                  <NotificationBell />
                  <AppLauncher />
                  {currentUser.isPending ? (
                    <span className="h-4 w-32 animate-pulse rounded bg-header-strong" aria-hidden="true" />
                  ) : (
                    <UserMenu
                      fullName={currentUser.data?.full_name}
                      onFeedback={() => setFeedbackOpen(true)}
                      onLogout={() => void session.logout()}
                    />
                  )}
                </div>
              </header>
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
                {/* Dải thông báo khi vào trang (YCTD-331, thay hộp bật lên của DT-16 phần 16c) */}
                <StartupNotices />
                {paidModule ? <PaidFeatureNotice module={paidModule} /> : children}
              </main>
            </div>
          </div>
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
        </div>
      </NavigationRegistryContext.Provider>
    </WorkspaceContext.Provider>
  );
}

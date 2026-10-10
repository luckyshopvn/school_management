import { createRootRoute, createRoute, createRouter, Navigate, Outlet, useLocation } from '@tanstack/react-router';
import { AcademicYearsPage } from './academic-years/AcademicYearsPage.js';
import { AccountsPage } from './accounts/AccountsPage.js';
import { RolesPage } from './accounts/RolesPage.js';
import { ApprovalThresholdsPage } from './catalogs/ApprovalThresholdsPage.js';
import { CommonCatalogPage } from './catalogs/CommonCatalogPage.js';
import { DepartmentsPage } from './catalogs/DepartmentsPage.js';
import { RoomsAndGradeLevelsPage } from './catalogs/RoomsAndGradeLevelsPage.js';
import { ChildrenPage } from './children/ChildrenPage.js';
import { ClassesPage } from './classes/ClassesPage.js';
import { OrgUnitsPage } from './org-units/OrgUnitsPage.js';
import { AuditLogsPage } from './settings/AuditLogsPage.js';
import { SettingsPage } from './settings/SettingsPage.js';
import { ChangePasswordPage } from './pages/ChangePasswordPage.js';
import { HomePage } from './pages/HomePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { useSession } from './session/session.js';

// Chuyển hướng theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function SessionGate() {
  const session = useSession();
  const { pathname } = useLocation();

  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return pathname === '/login' ? <Outlet /> : <Navigate to="/login" replace />;
  }
  if (session.passwordChangeRequired && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (pathname === '/login') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: SessionGate });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/change-password', component: ChangePasswordPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/academic-years', component: AcademicYearsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/org-units', component: OrgUnitsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/accounts', component: AccountsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/roles', component: RolesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/audit-logs', component: AuditLogsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/departments', component: DepartmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/catalogs', component: CommonCatalogPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/approval-thresholds', component: ApprovalThresholdsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/rooms', component: RoomsAndGradeLevelsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/classes', component: ClassesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/children', component: ChildrenPage }),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

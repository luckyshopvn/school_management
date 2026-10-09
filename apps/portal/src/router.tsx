import { createRootRoute, createRoute, createRouter, Navigate, Outlet, useLocation } from '@tanstack/react-router';
import { AcademicYearsPage } from './academic-years/AcademicYearsPage.js';
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
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

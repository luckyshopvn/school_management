import { useCallback, useEffect, useState } from 'react';
import { OPERATOR_MENU_CAPABILITIES, operatorCan } from '@school-management/shared';
import { PLATFORM_MENU } from './platform-menu.js';
import { PlatformMenuIcon } from './platform-icons.js';
import { SchoolsPage } from './SchoolsPage.js';
import { PlansPage } from './PlansPage.js';
import { BillingPage } from './BillingPage.js';
import { AiPage } from './AiPage.js';
import { DashboardPage } from './DashboardPage.js';
import { MaintenancePage } from './MaintenancePage.js';
import { OperatorsPage } from './OperatorsPage.js';
import { AdminUnitsPage } from './AdminUnitsPage.js';
import { CatalogPage } from './CatalogPage.js';
import { MarketPage } from './MarketPage.js';
import { ParentOrgApp } from './ParentOrgApp.js';
import { fetchProfile, PlatformApiError, type OperatorProfile } from './platform-api.js';
import { LoginPage } from './LoginPage.js';
import { OperatorPasswordPage } from './OperatorPasswordPage.js';

// Khung cổng vận hành nền tảng (DT-SaaS phần S1a): đăng nhập (LoginPage), menu theo dữ liệu, trang tổng quan; các trang sau do S2,
// S4, S5 thêm. Mã phiên chỉ giữ trong bộ nhớ của trang; tải lại trang thì đăng nhập lại

function Shell({ accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [active, setActive] = useState(PLATFORM_MENU[0]?.key ?? 'overview');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Mục đang hiện tên sau khi chạm giữ (thanh biểu tượng ở khổ máy tính bảng)
  const [hint, setHint] = useState<string>();

  useEffect(() => {
    if (!hint) {
      return undefined;
    }
    const timer = window.setTimeout(() => setHint(undefined), 2000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  // Esc đóng ngăn kéo menu
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const loadProfile = useCallback(() => {
    fetchProfile(accessToken)
      .then(setProfile)
      .catch((caught: unknown) => {
        if (caught instanceof PlatformApiError && caught.status === 401) {
          onLogout();
          return;
        }
        setError('Không đọc được thông tin tài khoản');
      });
  }, [accessToken, onLogout]);

  useEffect(loadProfile, [loadProfile]);

  // Còn mật khẩu tạm: chỉ hiện màn đổi mật khẩu (YCTD-323). Menu chỉ có trang vai trò được làm (bảng OPERATOR_PERMISSIONS)
  const mustChange = profile?.must_change_password === true;
  const menu = profile
    ? PLATFORM_MENU.filter((item) => {
        const capability = OPERATOR_MENU_CAPABILITIES[item.key];
        return capability ? operatorCan(profile.role, capability) : profile.role === 'quan_tri';
      })
    : [];

  return (
    <div className="shell shell-platform" data-menu-open={menuOpen}>
      <header>
        {/* Dưới 768 px menu là ngăn kéo mở bằng nút này (DT-26 phần 26e) */}
        <button
          type="button"
          className="menu-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="menu-nen-tang"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
        <strong>Cổng vận hành nền tảng</strong>
        <span>
          {profile?.full_name ?? ''}
          {profile && !mustChange ? (
            <button type="button" aria-current={active === 'password'} onClick={() => setActive('password')}>
              Đổi mật khẩu
            </button>
          ) : null}
          <button type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </span>
      </header>
      {/* Từ 1280 px thanh bên đầy đủ; 768 đến 1279 px chỉ còn biểu tượng, tên mục hiện khi rê chuột, đưa bàn phím tới hoặc chạm giữ; dưới
          768 px ngăn kéo (DT-26 phần 26e). Thứ tự mục giữ theo PLATFORM_MENU */}
      <nav id="menu-nen-tang" aria-label="Menu">
        {(mustChange ? [] : menu).map((item) => (
          <button
            key={item.key}
            type="button"
            aria-current={item.key === active}
            // Tên đọc vẫn đủ khi thanh chỉ còn biểu tượng (chữ của mục bị ẩn)
            aria-label={item.label}
            data-hint={hint === item.key ? 'true' : undefined}
            onClick={() => {
              setActive(item.key);
              setMenuOpen(false);
            }}
            onContextMenu={(event) => {
              // Chạm giữ trên máy tính bảng: hiện tên mục một lúc thay cho menu ngữ cảnh
              event.preventDefault();
              setHint(item.key);
            }}
          >
            <PlatformMenuIcon menuKey={item.key} label={item.label} />
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
      </nav>
      {menuOpen ? <div className="menu-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} /> : null}
      <main>
        {error ? <p role="alert">{error}</p> : null}
        {profile && (mustChange || active === 'password') ? (
          <OperatorPasswordPage token={accessToken} forced={mustChange} onChanged={loadProfile} />
        ) : null}
        {mustChange || !profile || !menu.some((item) => item.key === active) ? null : (
          <>
            {active === 'overview' && profile ? (
              <section>
                <h2>Tổng quan</h2>
                <p>
                  Số trường đang quản lý: <strong>{profile.school_count}</strong>
                </p>
              </section>
            ) : null}
            {active === 'schools' ? <SchoolsPage token={accessToken} /> : null}
            {active === 'plans' ? <PlansPage accessToken={accessToken} /> : null}
            {active === 'billing' ? <BillingPage accessToken={accessToken} /> : null}
            {active === 'dashboard' ? <DashboardPage token={accessToken} /> : null}
            {active === 'maintenance' ? <MaintenancePage token={accessToken} /> : null}
            {active === 'parent-orgs' ? <AdminUnitsPage token={accessToken} /> : null}
            {active === 'ai' ? <AiPage accessToken={accessToken} /> : null}
            {active === 'catalog' ? <CatalogPage token={accessToken} /> : null}
            {active === 'market' ? <MarketPage accessToken={accessToken} role={profile.role} /> : null}
            {active === 'operators' ? <OperatorsPage token={accessToken} currentOperatorId={profile.id} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

export function Application() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Trang của tài khoản cấp trên (DT-SaaS phần S6) ở cùng tên miền cổng nền tảng, đường dẫn /cap-tren
  if (window.location.pathname.startsWith('/cap-tren')) {
    return <ParentOrgApp />;
  }
  return accessToken ? (
    <Shell accessToken={accessToken} onLogout={() => setAccessToken(null)} />
  ) : (
    <LoginPage onLoggedIn={setAccessToken} />
  );
}

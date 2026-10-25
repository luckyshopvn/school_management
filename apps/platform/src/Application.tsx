import { useEffect, useState, type FormEvent } from 'react';
import { PLATFORM_MENU } from './platform-menu.js';
import { SchoolsPage } from './SchoolsPage.js';
import { PlansPage } from './PlansPage.js';
import { fetchProfile, loginOperator, PlatformApiError, type OperatorProfile } from './platform-api.js';

// Khung cổng vận hành nền tảng (DT-SaaS phần S1a): đăng nhập, menu theo dữ liệu, trang tổng quan; các trang sau do S2, S4, S5 thêm.
// Mã phiên chỉ giữ trong bộ nhớ của trang; tải lại trang thì đăng nhập lại
function LoginForm({ onLoggedIn }: { onLoggedIn: (accessToken: string) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginOperator(login, password, otpCode);
      onLoggedIn(result.accessToken);
    } catch (caught) {
      setError(caught instanceof PlatformApiError ? caught.message : 'Không đăng nhập được, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <h1>Cổng vận hành nền tảng</h1>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Tên đăng nhập
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          Mã xác thực hai lớp
          <input
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="Mã 6 số hoặc mã khôi phục"
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={busy}>
          Đăng nhập
        </button>
      </form>
    </main>
  );
}

function Shell({ accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [active, setActive] = useState(PLATFORM_MENU[0]?.key ?? 'overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="shell">
      <header>
        <strong>Cổng vận hành nền tảng</strong>
        <span>
          {profile?.full_name ?? ''}
          <button type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </span>
      </header>
      <nav aria-label="Menu">
        {PLATFORM_MENU.map((item) => (
          <button key={item.key} type="button" aria-current={item.key === active} onClick={() => setActive(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>
      <main>
        {error ? <p role="alert">{error}</p> : null}
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
      </main>
    </div>
  );
}

export function Application() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  return accessToken ? (
    <Shell accessToken={accessToken} onLogout={() => setAccessToken(null)} />
  ) : (
    <LoginForm onLoggedIn={setAccessToken} />
  );
}

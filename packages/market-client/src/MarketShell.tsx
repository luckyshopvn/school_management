import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button } from '@school-management/ui';
import { LoginForm, RegisterForm, VerifyForm } from './AccountForms.js';
import { ForgotPasswordForm } from './AccountSecurity.js';
import { errorText, marketRequest, readSession, writeSession, type Me, type Site } from './market-api.js';
import { SAFETY_HOTLINE } from './SafetyWidgets.js';

// Khung dùng chung của ứng dụng Chợ gia sư (phụ huynh) và ứng dụng Gia sư (DT-27 phần 27f, YCTD-256; tách ứng dụng ở YCTD-262): trang
// công khai (giới thiệu, văn bản pháp lý), đăng ký, xác nhận mã, đăng nhập, văn bản mới cần đồng ý; phần riêng của vai (khu phụ huynh,
// khu gia sư) do ứng dụng truyền vào. Mỗi ứng dụng một vai: máy chủ chỉ nhận tài khoản phụ huynh ở tên miền của chợ, tài khoản gia sư
// ở tên miền của ứng dụng Gia sư. Bố cục theo bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" Eric duyệt ngày 2026-10-28 (YCTD-360): thanh
// đầu trang trắng có thanh điều hướng của vai, nhãn "Thanh toán giả lập", nội dung rộng, chân trang có văn bản pháp lý và đường dây nóng
type View = 'home' | 'register' | 'login' | 'forgot' | 'document';

export interface MarketShellProperties {
  kind: 'parent' | 'tutor';
  title: string;
  // Phần giới thiệu khi chưa đăng nhập; nhận cấu hình công khai để dẫn sang ứng dụng còn lại
  intro: (site: Site | null) => ReactNode;
  // Khu riêng của vai khi tài khoản đã xác nhận và đồng ý đủ văn bản
  children: ReactNode;
  // Thanh điều hướng của vai khi đã vào khu riêng: ở đầu trang (Chợ gia sư, YCTD-360) hoặc cột bên trái (ứng dụng Gia sư, YCTD-361)
  navigation?: ReactNode;
  navigationPlacement?: 'top' | 'side';
  // Cách đăng nhập thêm dưới biểu mẫu mật khẩu (ứng dụng Gia sư: đăng nhập bằng định danh đã xác minh, DT-27 phần 27g)
  loginExtras?: ReactNode;
}

function BrandMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19V8l8-4 8 4v11" />
      <path d="M9 19v-6h6v6" />
      <path d="M12 4v4" />
    </svg>
  );
}

export function MarketShell({
  kind,
  title,
  intro,
  children,
  navigation,
  navigationPlacement = 'top',
  loginExtras,
}: MarketShellProperties) {
  const [site, setSite] = useState<Site | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>('home');
  const [document, setDocument] = useState<{ title: string; body: string; version: number } | null>(null);
  const [error, setError] = useState<string>();

  const loadMe = useCallback(async () => {
    if (!readSession()) {
      setMe(null);
      return;
    }
    try {
      setMe(await marketRequest<Me>('GET', '/me'));
    } catch {
      writeSession(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    marketRequest<Site>('GET', '/public/site')
      .then(setSite)
      .catch((caught: unknown) => setError(errorText(caught)));
    void loadMe();
  }, [loadMe]);

  const openDocument = (documentKind: string) => {
    marketRequest<{ title: string; body: string; version: number }>('GET', `/public/documents/${documentKind}`)
      .then((row) => {
        setDocument(row);
        setView('document');
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  };

  const logout = async () => {
    await marketRequest('POST', '/auth/logout').catch(() => undefined);
    writeSession(null);
    setMe(null);
    setView('home');
  };

  const signedIn = (token: string) => {
    writeSession(token);
    setView('home');
    void loadMe();
  };

  const ready = view === 'home' && me?.status === 'active' && me.consents_needed.length === 0;
  const side = navigationPlacement === 'side' && Boolean(navigation);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 text-brand-strong"
            onClick={() => setView('home')}
          >
            <BrandMark />
            <span className="text-section-title font-bold">{title}</span>
          </button>
          <div className="min-w-0 flex-1">{ready && !side ? navigation : null}</div>
          {site && !site.real_payments ? (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-label font-medium text-warning">
              Thanh toán giả lập
            </span>
          ) : null}
          {me ? (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-flex size-8 items-center justify-center rounded-full bg-warning/10 text-label font-semibold text-warning"
              >
                {me.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-48 truncate">{me.display_name}</span>
              <Button onClick={() => void logout()}>Đăng xuất</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setView('login')}>Đăng nhập</Button>
              <Button variant="primary" onClick={() => setView('register')}>
                Đăng ký
              </Button>
            </div>
          )}
        </div>
      </header>
      {site && !site.real_payments ? (
        <p className="border-b border-warning/20 bg-warning/10 px-4 py-2 text-center text-label text-warning">
          Chợ đang chạy thử: thanh toán là giả lập, không có tiền thật.
        </p>
      ) : null}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {view === 'document' && document ? (
          <article
            aria-label={document.title}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6"
          >
            <h2 className="text-section-title font-semibold">
              {document.title} (phiên bản {document.version})
            </h2>
            <p className="whitespace-pre-wrap">{document.body}</p>
          </article>
        ) : null}
        {view === 'register' && site ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <RegisterForm kind={kind} site={site} onRegistered={signedIn} onOpenDocument={openDocument} />
          </div>
        ) : null}
        {view === 'login' ? (
          <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <LoginForm onSignedIn={signedIn} />
            <button type="button" className="min-h-11 self-start text-link underline" onClick={() => setView('forgot')}>
              Quên mật khẩu?
            </button>
            {loginExtras}
          </div>
        ) : null}

        {view === 'forgot' ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <ForgotPasswordForm onDone={() => setView('login')} />
          </div>
        ) : null}
        {view === 'home' && me?.status === 'pending' ? (
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <VerifyForm onVerified={() => void loadMe()} />
          </div>
        ) : null}
        {view === 'home' && me?.status === 'active' && me.consents_needed.length > 0 ? (
          <section
            aria-label="Văn bản cần đồng ý"
            className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-border bg-card p-6"
          >
            <h2 className="text-section-title font-semibold">Văn bản mới cần đồng ý</h2>
            {me.consents_needed.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                <button type="button" className="text-link underline" onClick={() => openDocument(row.kind)}>
                  {row.title} (phiên bản {row.version})
                </button>
                <Button
                  onClick={() =>
                    void marketRequest('POST', `/me/consents/${row.id}`)
                      .then(loadMe)
                      .catch((caught: unknown) => setError(errorText(caught)))
                  }
                >
                  Đồng ý {row.title}
                </Button>
              </div>
            ))}
          </section>
        ) : null}
        {ready && side ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-full max-w-64 flex-[1_1_200px] rounded-2xl border border-border bg-card p-3">
              {navigation}
            </div>
            <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">{children}</div>
          </div>
        ) : null}
        {ready && !side ? children : null}

        {view === 'home' && !me ? intro(site) : null}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-label text-text-secondary">
          <span>{SAFETY_HOTLINE}</span>
          <div className="flex flex-wrap gap-4">
            {(site?.documents ?? []).map((row) => (
              <button
                key={row.id}
                type="button"
                className="min-h-11 text-link underline"
                onClick={() => openDocument(row.kind)}
              >
                {row.title}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

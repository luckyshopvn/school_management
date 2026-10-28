import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button } from '@school-management/ui';
import { LoginForm, RegisterForm, VerifyForm } from './AccountForms.js';
import { errorText, marketRequest, readSession, writeSession, type Me, type Site } from './market-api.js';

// Khung dùng chung của ứng dụng Chợ gia sư (phụ huynh) và ứng dụng Gia sư (DT-27 phần 27f, YCTD-256; tách ứng dụng ở YCTD-262): trang
// công khai (giới thiệu, văn bản pháp lý), đăng ký, xác nhận mã, đăng nhập, văn bản mới cần đồng ý; phần riêng của vai (khu phụ huynh,
// khu gia sư) do ứng dụng truyền vào. Mỗi ứng dụng một vai: máy chủ chỉ nhận tài khoản phụ huynh ở tên miền của chợ, tài khoản gia sư
// ở tên miền của ứng dụng Gia sư
type View = 'home' | 'register' | 'login' | 'document';

export interface MarketShellProperties {
  kind: 'parent' | 'tutor';
  title: string;
  // Phần giới thiệu khi chưa đăng nhập; nhận cấu hình công khai để dẫn sang ứng dụng còn lại
  intro: (site: Site | null) => ReactNode;
  // Khu riêng của vai khi tài khoản đã xác nhận và đồng ý đủ văn bản
  children: ReactNode;
  // Cách đăng nhập thêm dưới biểu mẫu mật khẩu (ứng dụng Gia sư: đăng nhập bằng định danh đã xác minh, DT-27 phần 27g)
  loginExtras?: ReactNode;
}

export function MarketShell({ kind, title, intro, children, loginExtras }: MarketShellProperties) {
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-page-title font-semibold">
          <button type="button" onClick={() => setView('home')}>
            {title}
          </button>
        </h1>
        {me ? (
          <div className="flex items-center gap-2">
            <span>{me.display_name}</span>
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
      </header>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {site && !site.real_payments ? (
        <Alert tone="info">Chợ đang chạy thử: thanh toán là giả lập, không có tiền thật.</Alert>
      ) : null}

      {view === 'document' && document ? (
        <article aria-label={document.title} className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">
            {document.title} (phiên bản {document.version})
          </h2>
          <p className="whitespace-pre-wrap">{document.body}</p>
        </article>
      ) : null}
      {view === 'register' && site ? (
        <RegisterForm kind={kind} site={site} onRegistered={signedIn} onOpenDocument={openDocument} />
      ) : null}
      {view === 'login' ? <LoginForm onSignedIn={signedIn} /> : null}
      {view === 'login' ? loginExtras : null}

      {view === 'home' && me?.status === 'pending' ? <VerifyForm onVerified={() => void loadMe()} /> : null}
      {view === 'home' && me?.status === 'active' && me.consents_needed.length > 0 ? (
        <section aria-label="Văn bản cần đồng ý" className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">Văn bản mới cần đồng ý</h2>
          {me.consents_needed.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              <button type="button" className="underline" onClick={() => openDocument(row.kind)}>
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
      {view === 'home' && me?.status === 'active' && me.consents_needed.length === 0 ? children : null}

      {view === 'home' && !me ? intro(site) : null}

      <footer className="flex flex-wrap gap-3 border-t pt-2 text-label">
        {(site?.documents ?? []).map((row) => (
          <button key={row.id} type="button" className="underline" onClick={() => openDocument(row.kind)}>
            {row.title}
          </button>
        ))}
      </footer>
    </div>
  );
}

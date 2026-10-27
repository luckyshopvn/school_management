import { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { errorText, marketRequest, readSession, writeSession, type Me, type Site } from './market-api.js';
import { ParentArea } from './ParentArea.js';
import { LoginForm, RegisterForm, VerifyForm } from './AccountForms.js';
import { TutorArea } from './TutorArea.js';

// Chợ gia sư (DT-27 phần 27f, YCTD-256; tài liệu 32 mục 19.5): trang công khai (giới thiệu, văn bản pháp lý), đăng ký, đăng nhập, khu
// phụ huynh (hồ sơ con, đồng ý, liên kết với trường), khu gia sư (hồ sơ tối thiểu). Tìm gia sư, trang gia sư theo Mẫu 02 là của 27g;
// đặt buổi, thanh toán giả lập là của 27h
type View = 'home' | 'register' | 'login' | 'document';

export function MarketApplication() {
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

  const openDocument = (kind: string) => {
    marketRequest<{ title: string; body: string; version: number }>('GET', `/public/documents/${kind}`)
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
            Chợ gia sư
          </button>
        </h1>
        {me ? (
          <div className="flex items-center gap-2">
            <span>
              {me.display_name} ({me.kind === 'parent' ? 'phụ huynh' : 'gia sư'})
            </span>
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
        <RegisterForm site={site} onRegistered={signedIn} onOpenDocument={openDocument} />
      ) : null}
      {view === 'login' ? <LoginForm onSignedIn={signedIn} /> : null}

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
      {view === 'home' && me?.status === 'active' && me.consents_needed.length === 0 ? (
        me.kind === 'parent' ? (
          <ParentArea />
        ) : (
          <TutorArea />
        )
      ) : null}

      {view === 'home' && !me ? (
        <section aria-label="Giới thiệu" className="flex flex-col gap-2">
          <p>
            Phụ huynh tìm gia sư trực tuyến cho con; gia sư mở hồ sơ, được xác minh trước khi nhận học sinh. Mọi tin
            nhắn giữa gia sư và học sinh luôn có phụ huynh.
          </p>
          <p className="text-text-secondary">Tìm gia sư sẽ mở khi có gia sư đã xác minh.</p>
        </section>
      ) : null}

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

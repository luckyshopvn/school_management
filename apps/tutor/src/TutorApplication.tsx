import { useCallback, useEffect, useState } from 'react';
import {
  ChildSafetyPolicy,
  errorText,
  marketRequest,
  MarketShell,
  MessageInbox,
  writeSession,
} from '@school-management/market-client';
import { UpdateBanner } from '@school-management/pwa';
import { Alert, Button } from '@school-management/ui';
import { TutorArea } from './TutorArea.js';
import { TutorBookings, TutorEarnings } from './TutorBookings.js';
import { TutorListing } from './TutorListing.js';
import { TutorAccount, TutorReviews } from './TutorReviews.js';
import { TutorSafety } from './TutorSafety.js';
import { TutorSchedule } from './TutorSchedule.js';
import { TutorSchoolRole } from './TutorSchoolRole.js';
import { TutorVerification } from './TutorVerification.js';
import type { Listing } from './tutor-api.js';

// Ứng dụng Gia sư của chợ gia sư (DT-27, YCTD-262; quyết định của Eric ngày 2026-10-28 "làm thêm ứng dụng cho gia sư"; giáo viên dạy kèm
// ngoài trường cũng dùng ứng dụng này bằng tài khoản chợ riêng): đăng ký, đăng nhập (mật khẩu hoặc định danh đã xác minh), giới thiệu và
// cơ sở dạy thêm (27f), xác minh từng bậc, hồ sơ dạy, khai giáo viên đang dạy ở trường, Mẫu 03 (27g). Lịch dạy, buổi, thu nhập (27h); báo
// cáo an toàn (27i). Phụ huynh dùng ứng dụng Chợ gia sư (apps/market). Từ YCTD-361 (thiết kế duyệt ngày 2026-10-28) khu gia sư chia trang
// theo cột điều hướng bên trái thay cho một trang dài; trang đang mở ghi ở phần # của địa chỉ
const RETURN_PATH = '/xac-minh';
const PAGES = [
  { key: 'buoi-day', label: 'Buổi dạy' },
  { key: 'lich', label: 'Lịch' },
  { key: 'ho-so', label: 'Hồ sơ và môn dạy' },
  { key: 'thu-nhap', label: 'Thu nhập' },
  { key: 'tin-nhan', label: 'Tin nhắn' },
  { key: 'danh-gia', label: 'Đánh giá' },
  { key: 'xac-minh', label: 'Xác minh' },
  { key: 'an-toan', label: 'An toàn, kiểm duyệt' },
] as const;
type Page = (typeof PAGES)[number]['key'];

function pageFromHash(): Page | null {
  const key = window.location.hash.replace(/^#/, '');
  return PAGES.find((row) => row.key === key)?.key ?? null;
}

// Quay về từ nhà cung cấp định danh: gửi mã và state cho máy chủ rồi về trang chính
function useIdentityReturn(): { pending: boolean; message: string | undefined; error: string | undefined } {
  const [pending, setPending] = useState(window.location.pathname === RETURN_PATH);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (window.location.pathname !== RETURN_PATH) return;
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    const state = query.get('state');
    window.history.replaceState(null, '', '/');
    if (!code || !state) {
      setError(query.get('error_description') ?? 'Nhà cung cấp định danh không trả kết quả');
      setPending(false);
      return;
    }
    marketRequest<{ session_token?: string; status: string; note?: string | null }>('POST', '/identity/complete', {
      code,
      state,
    })
      .then((result) => {
        if (result.session_token) {
          writeSession(result.session_token);
        } else if (result.status === 'approved') {
          setMessage('Đã xác minh danh tính');
        } else {
          setError(result.note ?? 'Chưa xác minh được danh tính');
        }
      })
      .catch((caught: unknown) => setError(errorText(caught)))
      .finally(() => setPending(false));
  }, []);
  return { pending, message, error };
}

// Mở khu gia sư: hồ sơ đã duyệt thì vào Buổi dạy, chưa duyệt thì vào Xác minh
function TutorHome({ page, onPage }: { page: Page | null; onPage: (next: Page) => void }) {
  const [listing, setListing] = useState<Listing>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<Listing>('GET', '/tutor/listing')
      .then(setListing)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!page && listing) onPage(listing.status === 'approved' ? 'buoi-day' : 'xac-minh');
  }, [page, listing, onPage]);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!listing) return <p>Đang tải hồ sơ…</p>;
  if (page === 'buoi-day') {
    return (
      <>
        <TutorSafety />
        <TutorBookings />
      </>
    );
  }
  if (page === 'lich') return <TutorSchedule listing={listing} onEditAvailability={() => onPage('ho-so')} />;
  if (page === 'ho-so') {
    return (
      <>
        <h2 className="text-page-title font-bold">Hồ sơ và môn dạy</h2>
        <TutorArea />
        <TutorListing key={listing.status} listing={listing} onChange={setListing} />
        <TutorSchoolRole listing={listing} onChange={setListing} />
        <TutorAccount />
      </>
    );
  }
  if (page === 'thu-nhap') return <TutorEarnings />;
  if (page === 'tin-nhan') return <MessageInbox role="tutor" />;
  if (page === 'danh-gia') return <TutorReviews />;
  if (page === 'xac-minh') return <TutorVerification listing={listing} onChange={setListing} />;
  if (page === 'an-toan') {
    return (
      <>
        <TutorSafety alwaysShow />
        <ChildSafetyPolicy />
      </>
    );
  }
  return null;
}

function IdentityLogin() {
  const [providers, setProviders] = useState<Array<{ code: string; display_name: string }>>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    marketRequest<Array<{ code: string; display_name: string }>>('GET', '/identity/providers')
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {providers.map((provider) => (
        <Button
          key={provider.code}
          onClick={() =>
            void marketRequest<{ authorization_url: string }>('POST', '/identity/start', {
              provider: provider.code,
              purpose: 'login',
              return_url: `${window.location.origin}${RETURN_PATH}`,
            })
              .then((result) => window.location.assign(result.authorization_url))
              .catch((caught: unknown) => setError(errorText(caught)))
          }
        >
          Đăng nhập bằng {provider.display_name}
        </Button>
      ))}
    </div>
  );
}

export function TutorApplication() {
  const identityReturn = useIdentityReturn();
  const [page, setPage] = useState<Page | null>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const open = useCallback((next: Page) => {
    setPage(next);
    window.history.replaceState(null, '', `#${next}`);
  }, []);
  if (identityReturn.pending) {
    return <p className="p-4">Đang hoàn tất xác minh danh tính…</p>;
  }
  return (
    <>
      <UpdateBanner />
      {identityReturn.message ? <Alert tone="success">{identityReturn.message}</Alert> : null}
      {identityReturn.error ? <Alert tone="danger">{identityReturn.error}</Alert> : null}
      <MarketShell
        kind="tutor"
        title="Gia sư"
        loginExtras={<IdentityLogin />}
        navigationPlacement="side"
        navigation={
          <nav aria-label="Điều hướng ứng dụng Gia sư" className="flex flex-col gap-1">
            {PAGES.map((row) => (
              <button
                key={row.key}
                type="button"
                aria-current={page === row.key ? 'page' : undefined}
                className={`min-h-11 rounded-lg px-3 text-left font-medium ${
                  page === row.key ? 'bg-selected text-brand-strong' : 'text-text hover:bg-page'
                }`}
                onClick={() => open(row.key)}
              >
                {row.label}
              </button>
            ))}
          </nav>
        }
        intro={(site) => (
          <section aria-label="Giới thiệu" className="flex max-w-3xl flex-col gap-3 rounded-2xl bg-warning/5 p-6">
            <h2 className="text-page-title font-bold text-brand-strong">Dạy kèm trực tuyến qua Chợ gia sư</h2>
            <p className="text-text-secondary">
              Mở hồ sơ gia sư trực tuyến. Gia sư được xác minh danh tính và lý lịch trước khi nhận học sinh; mọi tin
              nhắn với học sinh luôn có phụ huynh. Giáo viên đang dạy ở trường dạy kèm bên ngoài cũng dùng ứng dụng này.
            </p>
            {site?.market_url ? (
              <p>
                Bạn là phụ huynh? <a href={site.market_url}>Mở Chợ gia sư</a>
              </p>
            ) : null}
          </section>
        )}
      >
        <TutorHome page={page} onPage={open} />
      </MarketShell>
    </>
  );
}

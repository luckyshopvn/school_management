import { useCallback, useEffect, useState } from 'react';
import { errorText, marketRequest, MarketShell, writeSession } from '@school-management/market-client';
import { UpdateBanner } from '@school-management/pwa';
import { Alert, Button } from '@school-management/ui';
import { TutorArea } from './TutorArea.js';
import { TutorBookings } from './TutorBookings.js';
import { TutorListing } from './TutorListing.js';
import { TutorSchoolRole } from './TutorSchoolRole.js';
import { TutorVerification } from './TutorVerification.js';
import type { Listing } from './tutor-api.js';

// Ứng dụng Gia sư của chợ gia sư (DT-27, YCTD-262; quyết định của Eric ngày 2026-10-28 "làm thêm ứng dụng cho gia sư"; giáo viên dạy kèm
// ngoài trường cũng dùng ứng dụng này bằng tài khoản chợ riêng): đăng ký, đăng nhập (mật khẩu hoặc định danh đã xác minh), giới thiệu và
// cơ sở dạy thêm (27f), xác minh từng bậc, hồ sơ dạy, khai giáo viên đang dạy ở trường, Mẫu 03 (27g). Lịch dạy, buổi, thu nhập (27h); báo
// cáo an toàn (27i). Phụ huynh dùng ứng dụng Chợ gia sư (apps/market)
const RETURN_PATH = '/xac-minh';

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

function TutorHome() {
  const [listing, setListing] = useState<Listing>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<Listing>('GET', '/tutor/listing')
      .then(setListing)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);
  useEffect(load, [load]);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!listing) return <p>Đang tải hồ sơ…</p>;
  return (
    <div className="flex flex-col gap-6">
      <TutorBookings />
      <TutorVerification listing={listing} onChange={setListing} />
      <TutorListing key={listing.status} listing={listing} onChange={setListing} />
      <TutorArea />
      <TutorSchoolRole listing={listing} onChange={setListing} />
    </div>
  );
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
        intro={(site) => (
          <section aria-label="Giới thiệu" className="flex flex-col gap-2">
            <p>
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
        <TutorHome />
      </MarketShell>
    </>
  );
}

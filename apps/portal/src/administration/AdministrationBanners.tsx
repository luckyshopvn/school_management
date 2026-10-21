import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchCurrentUser, ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { readDemoStatus } from './administration-api.js';

const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// Dải "Bản trình diễn" ở đầu mọi trang khi máy chủ là bản trình diễn (DT-18 phần 18h)
export function DemoBanner() {
  const demo = useQuery({ queryKey: ['demo-status'], queryFn: readDemoStatus, staleTime: 5 * 60_000 });
  if (!demo.data?.enabled) {
    return null;
  }
  return (
    <div role="note" className="bg-header-accent px-4 py-1.5 text-center text-label font-medium text-text">
      Bản trình diễn: dữ liệu giả, không gửi tin nhắn, Zalo hay thu tiền thật
      {demo.data.next_reset_at ? `; dữ liệu tự đặt lại lúc ${TIME.format(new Date(demo.data.next_reset_at))}` : ''}.
    </div>
  );
}

// Thanh "Đang đăng nhập thay" ở đầu mọi trang khi phiên là phiên đăng nhập thay, có nút thoát (DT-18 phần 18h)
export function ImpersonationBanner() {
  const session = useSession();
  const navigate = useNavigate();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const impersonation = currentUser.data?.impersonation;
  if (!impersonation) {
    return null;
  }
  return (
    <div
      role="status"
      aria-label="Đang đăng nhập thay"
      className="flex flex-wrap items-center justify-center gap-3 bg-danger px-4 py-2 text-label font-medium text-white"
    >
      <span>
        Đang đăng nhập thay tài khoản {currentUser.data?.full_name} (bởi {impersonation.impersonator_name}, đến{' '}
        {TIME.format(new Date(impersonation.expires_at))}). Mọi thao tác đều được ghi nhật ký.
      </span>
      {error ? <span>{error}</span> : null}
      <button
        type="button"
        className="rounded-md bg-white px-3 py-1 font-semibold text-danger hover:bg-page disabled:opacity-60"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(undefined);
          session
            .exitImpersonation()
            .then(() => navigate({ to: '/impersonations' }))
            .catch((caught: unknown) => {
              setError(caught instanceof ApiError ? caught.message : 'Không thoát được, vui lòng thử lại');
              setBusy(false);
            });
        }}
      >
        Thoát đăng nhập thay
      </button>
    </div>
  );
}

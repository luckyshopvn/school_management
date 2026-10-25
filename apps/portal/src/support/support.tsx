import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, publicJson, requestJson } from '../session/api-client.js';

// Phiên hỗ trợ của nhân viên nền tảng và thông báo bảo trì ở cổng quản trị (DT-SaaS phần S4, YCTD-197):
// - quản trị tài khoản của trường bật cho phép hỗ trợ có hạn (chỉ đọc hoặc toàn quyền, ghi lý do), rút được bất kỳ lúc nào, xem
//   từng phiên hỗ trợ và thao tác đã làm;
// - nhân viên nền tảng mở đường liên kết một lần (/support-login) để vào phiên hỗ trợ; biểu ngữ báo đang trong phiên hỗ trợ;
// - mọi người dùng thấy biểu ngữ thông báo bảo trì của nhà vận hành nền tảng.
const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function time(value: string | null | undefined): string {
  return value ? TIME.format(new Date(value)) : '';
}

function scopeLabel(scope: 'read' | 'full'): string {
  return scope === 'read' ? 'chỉ đọc' : 'toàn quyền';
}

interface MaintenanceNotice {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  starts_at: string;
  ends_at: string;
}

interface PlatformNotices {
  maintenance: MaintenanceNotice[];
  support: { operator_name: string; scope: 'read' | 'full'; expires_at: string; started_at: string } | null;
}

interface SupportGrant {
  id: string;
  granted_by_name: string;
  scope: 'read' | 'full';
  reason: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by_name: string | null;
  created_at: string;
}

interface SupportOverview {
  available: boolean;
  active_grant: SupportGrant | null;
  grants: SupportGrant[];
  sessions: Array<{
    id: string;
    operator_name: string;
    scope: 'read' | 'full';
    reason: string;
    started_at: string | null;
    expires_at: string;
    ended_at: string | null;
    end_reason: string | null;
    actions: Array<{ service: string; method: string; route: string; status: number; at: string }>;
  }>;
}

export const readPlatformNotices = (): Promise<PlatformNotices> => requestJson('/api/v1/platform-notices');

// Biểu ngữ thông báo bảo trì và phiên hỗ trợ đang mở ở đầu mọi trang
export function PlatformNoticeBanner() {
  const notices = useQuery({ queryKey: ['platform-notices'], queryFn: readPlatformNotices, staleTime: 5 * 60_000 });
  const data = notices.data;
  if (!data || (data.maintenance.length === 0 && !data.support)) {
    return null;
  }
  return (
    <>
      {data.support ? (
        <div
          role="status"
          aria-label="Phiên hỗ trợ"
          className="bg-warning px-4 py-1.5 text-center text-label font-medium text-text"
        >
          Đang trong phiên hỗ trợ của nhân viên nền tảng {data.support.operator_name} ({scopeLabel(data.support.scope)},
          đến {time(data.support.expires_at)}). Mọi thao tác đều được ghi nhật ký; quản trị của trường rút cho phép ở
          trang Cho phép hỗ trợ.
        </div>
      ) : null}
      {data.maintenance.map((notice) => (
        <div
          key={notice.id}
          role={notice.severity === 'critical' ? 'alert' : 'note'}
          aria-label="Thông báo bảo trì"
          className={`px-4 py-1.5 text-center text-label font-medium ${
            notice.severity === 'critical' ? 'bg-danger text-white' : 'bg-header-accent text-text'
          }`}
        >
          <strong>{notice.title}</strong> ({time(notice.starts_at)} đến {time(notice.ends_at)}): {notice.body}
        </div>
      ))}
    </>
  );
}

// Đường liên kết một lần của nhân viên nền tảng: đổi lấy phiên đăng nhập của tài khoản hỗ trợ rồi vào trang chủ
function codeFromLocation(): string {
  return new URLSearchParams(window.location.search).get('code') ?? '';
}

export function SupportLoginPage() {
  const [code] = useState(codeFromLocation);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    if (!code) {
      setErrorMessage('Thiếu mã trong đường liên kết hỗ trợ');
      return;
    }
    publicJson('/api/v1/auth/support/exchange', { method: 'POST', body: JSON.stringify({ code }) })
      .then(() => window.location.replace('/'))
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [code]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-page-title font-bold text-text">Phiên hỗ trợ</h1>
        {errorMessage ? (
          <Alert tone="danger">{errorMessage}</Alert>
        ) : (
          <p className="text-label text-text-secondary">Đang mở phiên hỗ trợ...</p>
        )}
      </div>
    </main>
  );
}

// Trang Cho phép hỗ trợ (quyền quản trị tài khoản)
export function SupportAccessPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['support-access'],
    queryFn: () => requestJson<SupportOverview>('/api/v1/support-access'),
  });
  const [scope, setScope] = useState<'read' | 'full'>('read');
  const [hours, setHours] = useState('24');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['support-access'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-notices'] }),
    ]);
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.details.length > 0) {
      setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      return;
    }
    setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
  };
  const grant = useMutation({
    mutationFn: () =>
      requestJson('/api/v1/support-access', {
        method: 'POST',
        body: JSON.stringify({ scope, hours: Number(hours), reason }),
      }),
    onSuccess: async () => {
      setMessage('Đã cho phép hỗ trợ');
      setReason('');
      await refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => requestJson(`/api/v1/support-access/${id}/revoke`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setMessage('Đã rút cho phép hỗ trợ; phiên hỗ trợ đang mở đã kết thúc');
      await refresh();
    },
    onError,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage(undefined);
    setMessage(undefined);
    grant.mutate();
  }

  const data = overview.data;
  const active = data?.active_grant ?? null;
  return (
    <AppShell>
      <section className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/support-access')}</h1>
        <p className="text-label text-text-secondary">
          Nhân viên hỗ trợ của nhà cung cấp chỉ vào được dữ liệu của trường khi trường cho phép, trong thời hạn trường
          chọn. Mọi phiên hỗ trợ và thao tác đều được ghi nhật ký; rút cho phép thì phiên đang mở kết thúc ngay.
        </p>
        {message ? <Alert tone="success">{message}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {data && !data.available ? (
          <Alert tone="info">Chế độ một trường không có hỗ trợ từ nhà cung cấp nền tảng.</Alert>
        ) : null}
        {active ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
            aria-label="Cho phép đang hiệu lực"
          >
            <span>
              Đang cho phép hỗ trợ <strong>{scopeLabel(active.scope)}</strong> đến {time(active.expires_at)} (bật bởi{' '}
              {active.granted_by_name}: {active.reason}).
            </span>
            <Button type="button" variant="danger" disabled={revoke.isPending} onClick={() => revoke.mutate(active.id)}>
              Rút cho phép
            </Button>
          </div>
        ) : null}
        {data?.available ? (
          <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-3" aria-label="Bật cho phép hỗ trợ">
            <label className="flex flex-col gap-1 text-label">
              Phạm vi
              <select
                className="rounded-md border border-border px-2 py-1.5"
                value={scope}
                onChange={(event) => setScope(event.target.value as 'read' | 'full')}
              >
                <option value="read">Chỉ đọc (xem dữ liệu, không thay đổi)</option>
                <option value="full">Toàn quyền (xem và sửa như Hiệu trưởng)</option>
              </select>
            </label>
            <TextField
              label="Thời hạn (giờ, 1 đến 168)"
              type="number"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              error={fieldErrors.hours}
            />
            <TextField
              label="Lý do"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={fieldErrors.reason}
            />
            <Button type="submit" variant="primary" disabled={grant.isPending}>
              {active ? 'Cho phép lại (thay cho phép hiện tại)' : 'Cho phép hỗ trợ'}
            </Button>
          </form>
        ) : null}
        <h2 className="text-section-title font-semibold">Phiên hỗ trợ</h2>
        {data && data.sessions.length === 0 ? (
          <p className="text-label text-text-secondary">Chưa có phiên hỗ trợ nào.</p>
        ) : null}
        {data?.sessions.map((session) => (
          <details key={session.id} className="rounded-lg border border-border bg-card p-3">
            <summary>
              {session.operator_name} ({scopeLabel(session.scope)}), {time(session.started_at)}
              {session.ended_at ? ` đến ${time(session.ended_at)}` : ', đang mở'}: {session.reason}
            </summary>
            <table className="mt-2 w-full text-label">
              <thead>
                <tr>
                  <th className="text-left">Lúc</th>
                  <th className="text-left">Thao tác</th>
                  <th className="text-left">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {session.actions.map((action, index) => (
                  <tr key={`${action.at}-${index}`}>
                    <td>{time(action.at)}</td>
                    <td>
                      {action.method} {action.route}
                    </td>
                    <td>{action.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
        <h2 className="text-section-title font-semibold">Lịch sử cho phép</h2>
        <ul className="text-label">
          {data?.grants.map((item) => (
            <li key={item.id}>
              {time(item.created_at)}: {item.granted_by_name} cho phép {scopeLabel(item.scope)} đến{' '}
              {time(item.expires_at)} ({item.reason})
              {item.revoked_at ? `; rút lúc ${time(item.revoked_at)} bởi ${item.revoked_by_name ?? ''}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

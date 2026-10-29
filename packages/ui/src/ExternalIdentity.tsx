import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from './Alert.js';
import { Button } from './Button.js';
import { TextField } from './TextField.js';

// Đăng nhập và liên kết tài khoản bằng nhà cung cấp định danh bên ngoài (DT-25 bước 25b, YCTD-225; tài liệu 47 mục 17), dùng chung cho
// cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh. Mỗi ứng dụng truyền hàm gọi giao diện lập trình của mình (kèm mã phiên nếu có)
// và đường dẫn gốc của ứng dụng. Máy chủ giữ mọi quy tắc (bật tắt theo trường, nhóm vai trò, tuổi, xác thực hai lớp); giao diện chỉ hiển
// thị. Nhà cung cấp chuyển trình duyệt về `<gốc ứng dụng>/dang-nhap/ben-ngoai` của đúng tên miền

export const EXTERNAL_CALLBACK_PATH = 'dang-nhap/ben-ngoai';

export interface ExternalRequestError {
  message: string;
  details?: Array<{ field: string; message: string }>;
}

export type ExternalRequest = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export interface ExternalProvider {
  code: string;
  display_name: string;
}

type CallbackReply =
  | { status: 'signed_in' }
  | { status: 'otp_required'; ticket: string; provider: string }
  | { status: 'linked'; provider: string };

function messageOf(error: unknown): string {
  return (error as ExternalRequestError | undefined)?.message ?? 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return Object.fromEntries(
    ((error as ExternalRequestError | undefined)?.details ?? []).map((item) => [item.field, item.message]),
  );
}

// Địa chỉ quay về của ứng dụng, cùng tên miền với trang đang mở
export function externalRedirectUri(basePath: string): string {
  return new URL(`${basePath.replace(/\/?$/, '/')}${EXTERNAL_CALLBACK_PATH}`, window.location.origin).toString();
}

// Trang đang mở có phải trang quay về từ nhà cung cấp không (ứng dụng giáo viên, phụ huynh không dùng bộ định tuyến)
export function isExternalCallbackLocation(basePath: string): boolean {
  return window.location.pathname.replace(/\/$/, '') === `${basePath.replace(/\/?$/, '/')}${EXTERNAL_CALLBACK_PATH}`;
}

const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(value: string | null): string {
  return value ? TIME.format(new Date(value)) : '';
}

// Nút "Đăng nhập bằng ..." dưới nút Đăng nhập: chỉ nhà cung cấp trường đã bật; không có thì không hiện gì
export function ExternalProviderButtons({
  request,
  channel,
  basePath,
}: {
  request: ExternalRequest;
  channel: 'portal' | 'teacher' | 'parent';
  basePath: string;
}) {
  const [providers, setProviders] = useState<ExternalProvider[]>([]);
  const [busy, setBusy] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    request<{ providers: ExternalProvider[] }>('/api/v1/auth/external/providers')
      .then((reply) => {
        if (active) {
          setProviders(reply.providers);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [request]);

  if (providers.length === 0) {
    return null;
  }

  async function start(provider: ExternalProvider) {
    setBusy(provider.code);
    setErrorMessage(undefined);
    try {
      const reply = await request<{ authorization_url: string }>(
        `/api/v1/auth/external/${encodeURIComponent(provider.code)}/start`,
        { method: 'POST', body: { channel, redirect_uri: externalRedirectUri(basePath) } },
      );
      window.location.assign(reply.authorization_url);
    } catch (error) {
      setErrorMessage(messageOf(error));
      setBusy(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-2" aria-label="Đăng nhập bằng nhà cung cấp định danh" role="group">
      <p className="text-center text-label text-text-secondary">hoặc</p>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {providers.map((provider) => (
        <Button key={provider.code} onClick={() => void start(provider)} disabled={busy !== undefined}>
          {busy === provider.code ? 'Đang chuyển…' : `Đăng nhập bằng ${provider.display_name}`}
        </Button>
      ))}
      <p className="text-center text-label text-text-secondary">
        Dùng được khi tài khoản đã liên kết ở mục Tài khoản của tôi
      </p>
    </div>
  );
}

// Trang quay về từ nhà cung cấp: gửi state và code lên máy chủ. `ready` là khi ứng dụng đã thử khôi phục phiên (lượt liên kết cần mã
// phiên của đúng phiên đã bắt đầu). Đăng nhập xong thì tải lại trang gốc để ứng dụng mở phiên từ cookie; liên kết xong thì về `afterLink`
export function ExternalSignInCallback({
  request,
  basePath,
  ready,
  afterLink,
}: {
  request: ExternalRequest;
  basePath: string;
  ready: boolean;
  afterLink: string;
}) {
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const [errorMessage, setErrorMessage] = useState<string>();
  const [ticket, setTicket] = useState<string>();
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const home = basePath.replace(/\/?$/, '/');

  function finish(reply: CallbackReply) {
    if (reply.status === 'otp_required') {
      setTicket(reply.ticket);
      return;
    }
    window.location.replace(reply.status === 'linked' ? afterLink : home);
  }

  useEffect(() => {
    // Mã ủy quyền chỉ dùng một lần: xóa khỏi thanh địa chỉ và lịch sử ngay
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!ready || sent) {
      return;
    }
    setSent(true);
    const state = query.get('state') ?? '';
    const code = query.get('code') ?? '';
    if (query.get('error') || !state || !code) {
      setErrorMessage('Nhà cung cấp định danh không xác nhận lượt đăng nhập, vui lòng thử lại');
      return;
    }
    request<CallbackReply>('/api/v1/auth/external/callback', { method: 'POST', body: { state, code } })
      .then(finish)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [ready, sent, query, request]);

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setOtpError(undefined);
    try {
      finish(
        await request<CallbackReply>('/api/v1/auth/external/complete', {
          method: 'POST',
          body: { ticket, otp_code: otpCode.trim() },
        }),
      );
    } catch (error) {
      setOtpError(messageOf(error));
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-page-title font-bold text-text">Đăng nhập bằng nhà cung cấp định danh</h1>
        {errorMessage ? (
          <>
            <Alert tone="danger">{errorMessage}</Alert>
            <a href={home} className="text-label font-medium text-link hover:underline">
              Về trang đăng nhập
            </a>
          </>
        ) : ticket ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => void submitOtp(event)}>
            <p className="text-label text-text-secondary">
              Tài khoản đã bật xác thực hai lớp. Nhập mã trong ứng dụng xác thực hoặc mã khôi phục.
            </p>
            <TextField
              label="Mã xác thực hai lớp"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              error={otpError}
            />
            <Button type="submit" variant="primary" disabled={submitting || otpCode.trim() === ''}>
              {submitting ? 'Đang kiểm tra…' : 'Xác nhận'}
            </Button>
          </form>
        ) : (
          <p className="text-label text-text-secondary">Đang xác nhận với nhà cung cấp định danh...</p>
        )}
      </div>
    </main>
  );
}

interface LinksReply {
  links: Array<{ provider_code: string; display_name: string; linked_at: string; last_login_at: string | null }>;
  available: ExternalProvider[];
}

interface EventRow {
  provider_code: string;
  event_type: string;
  reason: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  linked: 'Liên kết',
  unlinked: 'Gỡ liên kết',
  login: 'Đăng nhập',
  login_rejected: 'Đăng nhập bị từ chối',
  link_rejected: 'Liên kết bị từ chối',
  settings_updated: 'Đổi cấu hình',
};

// Mục "Liên kết tài khoản" ở Tài khoản của tôi: liên kết, gỡ liên kết (nhập lại mật khẩu và mã hai lớp nếu đã bật), nhật ký gần đây.
// Trường chưa bật nhà cung cấp nào và tài khoản chưa có liên kết thì không hiện gì
export function ExternalLinksPanel({ request, basePath }: { request: ExternalRequest; basePath: string }) {
  const [links, setLinks] = useState<LinksReply>();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [action, setAction] = useState<{ kind: 'link' | 'unlink'; code: string; name: string }>();
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string }>();
  const [submitting, setSubmitting] = useState(false);
  // Tăng sau khi gỡ liên kết để đọc lại danh sách và nhật ký
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      request<LinksReply>('/api/v1/auth/external/links'),
      request<{ events: EventRow[] }>('/api/v1/auth/external/events'),
    ])
      .then(([linkReply, eventReply]) => {
        if (active) {
          setLinks(linkReply);
          setEvents(eventReply.events);
        }
      })
      .catch(() => {
        if (active) {
          setLinks(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [request, version]);

  if (!links || (links.links.length === 0 && links.available.length === 0)) {
    return null;
  }
  const linkedCodes = new Set(links.links.map((item) => item.provider_code));
  const linkable = links.available.filter((provider) => !linkedCodes.has(provider.code));

  function open(kind: 'link' | 'unlink', code: string, name: string) {
    setAction({ kind, code, name });
    setPassword('');
    setOtpCode('');
    setErrors({});
    setNotice(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) {
      return;
    }
    setSubmitting(true);
    setErrors({});
    setNotice(undefined);
    const body = { password, ...(otpCode.trim() ? { otp_code: otpCode.trim() } : {}) };
    try {
      if (action.kind === 'link') {
        const reply = await request<{ authorization_url: string }>(
          `/api/v1/auth/external/${encodeURIComponent(action.code)}/link`,
          { method: 'POST', body: { ...body, redirect_uri: externalRedirectUri(basePath) } },
        );
        window.location.assign(reply.authorization_url);
        return;
      }
      await request(`/api/v1/auth/external/${encodeURIComponent(action.code)}/unlink`, { method: 'POST', body });
      setAction(undefined);
      setNotice({ tone: 'success', text: `Đã gỡ liên kết ${action.name}` });
      setVersion((current) => current + 1);
    } catch (error) {
      const fields = fieldErrorsOf(error);
      setErrors(fields);
      setNotice(Object.keys(fields).length === 0 ? { tone: 'danger', text: messageOf(error) } : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Liên kết tài khoản"
    >
      <h2 className="text-section-title font-semibold text-text">Liên kết tài khoản</h2>
      <p className="text-label text-text-secondary">
        Liên kết để đăng nhập bằng nhà cung cấp định danh (ví dụ VNeID). Hệ thống chỉ lưu mã liên kết do nhà cung cấp
        trả, không lưu số định danh hay căn cước. Đăng nhập bằng mật khẩu vẫn dùng được.
      </p>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <ul className="flex flex-col gap-2">
        {links.links.map((item) => (
          <li key={item.provider_code} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-content text-text">
              {item.display_name}: đã liên kết lúc {formatTime(item.linked_at)}
              {item.last_login_at ? `, đăng nhập gần nhất ${formatTime(item.last_login_at)}` : ''}
            </span>
            <Button variant="danger" onClick={() => open('unlink', item.provider_code, item.display_name)}>
              Gỡ liên kết {item.display_name}
            </Button>
          </li>
        ))}
        {linkable.map((provider) => (
          <li key={provider.code} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-content text-text">{provider.display_name}: chưa liên kết</span>
            <Button onClick={() => open('link', provider.code, provider.display_name)}>
              Liên kết {provider.display_name}
            </Button>
          </li>
        ))}
      </ul>
      {action ? (
        <form
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
          aria-label={`${action.kind === 'link' ? 'Liên kết' : 'Gỡ liên kết'} ${action.name}`}
          onSubmit={(event) => void submit(event)}
        >
          <p className="text-label text-text-secondary">Nhập lại mật khẩu để xác nhận.</p>
          <TextField
            label="Mật khẩu hiện tại"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <TextField
            label="Mã xác thực hai lớp (nếu đã bật)"
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            error={errors.otp_code}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={submitting || password === ''}>
              {action.kind === 'link' ? 'Tiếp tục tới nhà cung cấp' : 'Gỡ liên kết'}
            </Button>
            <Button onClick={() => setAction(undefined)}>Hủy</Button>
          </div>
        </form>
      ) : null}
      {events.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-label font-medium text-text">Nhật ký liên kết gần đây</summary>
          <table className="mt-2 w-full text-label" aria-label="Nhật ký liên kết">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1">Thời điểm</th>
                <th className="py-1">Việc</th>
                <th className="py-1">Nhà cung cấp</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={`${row.created_at}-${row.event_type}`} className="border-t border-border">
                  <td className="py-1">{formatTime(row.created_at)}</td>
                  <td className="py-1">{EVENT_LABELS[row.event_type] ?? row.event_type}</td>
                  <td className="py-1">{row.provider_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}

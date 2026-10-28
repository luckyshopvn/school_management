import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  dashboardApi,
  PlatformValidationError,
  type SupportAccessPolicy,
  type SupportGrant,
  type SupportSessionRow,
  type SupportStartReply,
} from './platform-api.js';

// Phiên hỗ trợ ở trang chi tiết trường (DT-SaaS phần S4, YCTD-197): mở khi quản trị của trường đang cho phép; mở phiên nhận đường
// liên kết một lần (5 phút) tới cổng quản trị của trường; mọi phiên ghi lý do và ghi nhật ký hai phía.
// Quyền quản trị nền tảng (DT-24, YCTD-220): khi chính sách nền tảng là "vào mọi trường", trường chưa cho phép vẫn mở được phiên,
// bắt buộc nhập lại mã xác thực hai lớp, ghi lý do, chọn phạm vi và số giờ
function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

function scopeLabel(scope: 'read' | 'full'): string {
  return scope === 'read' ? 'chỉ đọc' : 'toàn quyền';
}

export function SupportPanel({ token, code }: { token: string; code: string }) {
  const [grant, setGrant] = useState<SupportGrant | null>(null);
  const [sessions, setSessions] = useState<SupportSessionRow[]>([]);
  const [policy, setPolicy] = useState<SupportAccessPolicy | null>(null);
  const [reason, setReason] = useState('');
  const [accessScope, setAccessScope] = useState<'read' | 'full'>('read');
  const [hours, setHours] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [started, setStarted] = useState<SupportStartReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    dashboardApi
      .support(token, code)
      .then((reply) => {
        setGrant(reply.active_grant);
        setSessions(reply.sessions);
        setPolicy(reply.policy ?? null);
      })
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token, code]);
  useEffect(load, [load]);

  async function start(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setStarted(await dashboardApi.startSupport(token, code, reason));
      setReason('');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function startPlatformAccess(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setStarted(
        await dashboardApi.startSupport(token, code, reason, {
          otp_code: otpCode.trim(),
          scope: accessScope,
          ...(hours ? { hours: Number(hours) } : {}),
        }),
      );
      setReason('');
      setOtpCode('');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function end(id: string) {
    setError(null);
    try {
      await dashboardApi.endSupport(token, id);
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  // Máy phát triển (YCTD-310): cổng quản trị của trường chạy http ở cổng riêng, đặt bằng VITE_SCHOOL_PORTAL_PORT; bản chạy thật dùng https
  const portalPort = import.meta.env.VITE_SCHOOL_PORTAL_PORT as string | undefined;
  const schoolOrigin = (host: string) =>
    portalPort ? `${window.location.protocol}//${host}:${portalPort}` : `https://${host}`;
  const link = started
    ? started.handoff.host
      ? `${schoolOrigin(started.handoff.host)}${started.handoff.path}`
      : started.handoff.path
    : null;
  return (
    <section aria-label="Phiên hỗ trợ">
      <h3>Phiên hỗ trợ</h3>
      {error ? <p role="alert">{error}</p> : null}
      {grant ? (
        <p>
          Trường đang cho phép hỗ trợ ({scopeLabel(grant.scope)}) đến{' '}
          {new Date(grant.expires_at).toLocaleString('vi-VN')}, do {grant.granted_by_name} bật: {grant.reason}
        </p>
      ) : (
        <p>
          Trường chưa cho phép hỗ trợ. Đề nghị quản trị của trường bật ở cổng quản trị (Tài khoản, Cho phép hỗ trợ).
        </p>
      )}
      {grant ? (
        <form className="inline-form" onSubmit={(event) => void start(event)}>
          <label>
            Lý do hỗ trợ
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={500}
              required
            />
          </label>
          <button type="submit">Mở phiên hỗ trợ</button>
        </form>
      ) : policy?.mode === 'any_school' ? (
        <form
          className="inline-form"
          aria-label="Truy cập với quyền quản trị nền tảng"
          onSubmit={(event) => void startPlatformAccess(event)}
        >
          <p>
            Chính sách nền tảng cho quản trị nền tảng vào mọi trường đã khởi tạo, không cần trường cho phép: bắt buộc
            nhập lại mã xác thực hai lớp và ghi lý do; phiên có hạn (tối đa {policy.max_hours} giờ), cổng quản trị của
            trường hiện biểu ngữ và trường xem được nhật ký.
          </p>
          <label>
            Mục đích truy cập (ghi rõ việc cần làm)
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={500}
              required
            />
          </label>
          <label>
            Phạm vi
            <select value={accessScope} onChange={(event) => setAccessScope(event.target.value as 'read' | 'full')}>
              <option value="read">Chỉ đọc</option>
              <option value="full">Toàn quyền</option>
            </select>
          </label>
          <label>
            Số giờ
            <input
              type="number"
              min={1}
              max={policy.max_hours}
              placeholder={String(policy.default_hours)}
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </label>
          <label>
            Mã xác thực hai lớp
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </label>
          <button type="submit">Truy cập với quyền quản trị nền tảng</button>
        </form>
      ) : null}
      {started && link ? (
        <p className="notice">
          Đường liên kết một lần (hết hạn sau {Math.round(started.handoff.expires_in_seconds / 60)} phút):{' '}
          <a href={link} target="_blank" rel="noreferrer" data-testid="support-handoff">
            {link}
          </a>
        </p>
      ) : null}
      <table aria-label="Lịch sử phiên hỗ trợ">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Phạm vi</th>
            <th>Lý do</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.operator_name}</td>
              <td>
                {scopeLabel(session.scope)}
                {session.access_basis === 'platform_policy' ? ', quyền quản trị nền tảng' : ''}
              </td>
              <td>{session.reason}</td>
              <td>
                {session.started_at ? new Date(session.started_at).toLocaleString('vi-VN') : 'Chưa dùng liên kết'}
              </td>
              <td>
                {session.ended_at
                  ? `${new Date(session.ended_at).toLocaleString('vi-VN')} (${session.end_reason ?? ''})`
                  : `Hạn ${new Date(session.expires_at).toLocaleString('vi-VN')}`}
              </td>
              <td>
                {!session.ended_at ? (
                  <button type="button" onClick={() => void end(session.id)}>
                    Kết thúc
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

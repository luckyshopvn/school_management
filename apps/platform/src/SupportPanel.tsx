import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  dashboardApi,
  PlatformValidationError,
  type SupportGrant,
  type SupportSessionRow,
  type SupportStartReply,
} from './platform-api.js';

// Phiên hỗ trợ ở trang chi tiết trường (DT-SaaS phần S4, YCTD-197): chỉ mở được khi quản trị của trường đang cho phép; mở phiên
// nhận đường liên kết một lần (5 phút) tới cổng quản trị của trường; mọi phiên ghi lý do và ghi nhật ký hai phía
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
  const [reason, setReason] = useState('');
  const [started, setStarted] = useState<SupportStartReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    dashboardApi
      .support(token, code)
      .then((reply) => {
        setGrant(reply.active_grant);
        setSessions(reply.sessions);
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

  async function end(id: string) {
    setError(null);
    try {
      await dashboardApi.endSupport(token, id);
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  const link = started
    ? started.handoff.host
      ? `https://${started.handoff.host}${started.handoff.path}`
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
              <td>{scopeLabel(session.scope)}</td>
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

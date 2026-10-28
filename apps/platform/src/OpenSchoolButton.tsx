import { useEffect, useRef, useState } from 'react';
import { catalogApi } from './catalog-api.js';
import { PlatformValidationError, type SupportStartReply } from './platform-api.js';

// Vào trường bằng một lần bấm của quản trị nền tảng (YCTD-314): đơn vị chưa có trường thì máy chủ khởi tạo ở nền, nút hiện "Đang
// khởi tạo" và hỏi lại mỗi 2 giây; trường sẵn sàng thì máy chủ mở phiên quản trị nền tảng (ghi nhật ký hai phía) và trả đường liên
// kết một lần tới cổng quản trị của trường. Trình duyệt có thể chặn cửa sổ mở sau khi chờ nên luôn hiện đường liên kết để bấm.
const POLL_MILLISECONDS = 2000;
const MAX_POLLS = 150;

// Máy phát triển (YCTD-310): cổng quản trị của trường chạy http ở cổng riêng, đặt bằng VITE_SCHOOL_PORTAL_PORT; bản chạy thật dùng https
export function supportLink(started: SupportStartReply): string {
  const portalPort = import.meta.env.VITE_SCHOOL_PORTAL_PORT as string | undefined;
  if (!started.handoff.host) {
    return started.handoff.path;
  }
  const origin = portalPort
    ? `${window.location.protocol}//${started.handoff.host}:${portalPort}`
    : `https://${started.handoff.host}`;
  return `${origin}${started.handoff.path}`;
}

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

export function OpenSchoolButton({ token, moetCode, label }: { token: string; moetCode: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'provisioning' | 'ready'>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  async function attempt(poll: number) {
    try {
      const reply = await catalogApi.open(token, moetCode);
      if (reply.session) {
        const target = supportLink(reply.session);
        setLink(target);
        setState('ready');
        window.open(target, '_blank', 'noopener');
        return;
      }
      if (reply.state === 'provisioning' && poll < MAX_POLLS) {
        setState('provisioning');
        timer.current = setTimeout(() => void attempt(poll + 1), POLL_MILLISECONDS);
        return;
      }
      setState('idle');
      setError(reply.state === 'unavailable' ? 'Trường đang tạm ngưng hoặc chờ xóa' : 'Chưa khởi tạo xong, bấm lại');
    } catch (caught) {
      setState('idle');
      setError(messageOf(caught));
    }
  }

  return (
    <span className="open-school">
      <button
        type="button"
        disabled={state === 'provisioning'}
        onClick={() => {
          setError(null);
          setLink(null);
          void attempt(0);
        }}
      >
        {state === 'provisioning' ? 'Đang khởi tạo…' : (label ?? 'Vào trường')}
      </button>
      {state === 'provisioning' ? (
        <span role="status"> Đang khởi tạo trường (cơ sở dữ liệu, tên miền), vui lòng chờ</span>
      ) : null}
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" data-testid="open-school-link">
          {' '}
          Mở cổng quản trị của trường
        </a>
      ) : null}
      {error ? <span role="alert"> {error}</span> : null}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';
import { catalogApi } from './catalog-api.js';
import { PlatformValidationError, type SupportStartReply } from './platform-api.js';

// Vào trường bằng một lần bấm của quản trị nền tảng (YCTD-314): đơn vị chưa có trường thì máy chủ khởi tạo ở nền, nút hiện "Đang
// khởi tạo" và hỏi lại mỗi 2 giây; trường sẵn sàng thì máy chủ mở phiên quản trị nền tảng (ghi nhật ký hai phía) và trả đường liên
// kết một lần tới cổng quản trị của trường. Trình duyệt có thể chặn cửa sổ mở sau khi chờ nên luôn hiện đường liên kết để bấm.
const POLL_MILLISECONDS = 2000;
const MAX_POLLS = 150;

// Máy phát triển (YCTD-310): cổng quản trị của trường chạy http ở cổng riêng, đặt bằng VITE_SCHOOL_PORTAL_PORT; bản chạy thật dùng https
// Ứng dụng của trường (YCTD-315): máy phát triển chạy mỗi ứng dụng ở một cổng (VITE_SCHOOL_*_PORT do tập lệnh chạy đặt); bản chạy thật
// đặt ứng dụng giáo viên, phụ huynh dưới đường dẫn riêng của tên miền trường (VITE_SCHOOL_*_PATH, mặc định /giao-vien, /phu-huynh)
export type SchoolApp = 'portal' | 'teacher' | 'parent' | 'student';

export const SCHOOL_APPS: ReadonlyArray<{ app: SchoolApp; label: string }> = [
  { app: 'portal', label: 'Cổng quản trị' },
  { app: 'teacher', label: 'Ứng dụng giáo viên' },
  { app: 'parent', label: 'Ứng dụng phụ huynh' },
  { app: 'student', label: 'Ứng dụng học sinh' },
];

function appLocation(app: SchoolApp): { port: string | undefined; path: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  if (app === 'teacher') {
    return { port: env.VITE_SCHOOL_TEACHER_PORT, path: env.VITE_SCHOOL_TEACHER_PATH ?? '/giao-vien' };
  }
  if (app === 'parent') {
    return { port: env.VITE_SCHOOL_PARENT_PORT, path: env.VITE_SCHOOL_PARENT_PATH ?? '/phu-huynh' };
  }
  if (app === 'student') {
    return { port: env.VITE_SCHOOL_STUDENT_PORT, path: env.VITE_SCHOOL_STUDENT_PATH ?? '/hoc-sinh' };
  }
  return { port: env.VITE_SCHOOL_PORTAL_PORT, path: '' };
}

export function supportLink(started: SupportStartReply, app: SchoolApp = 'portal'): string {
  const { port, path } = appLocation(app);
  if (!started.handoff.host) {
    return started.handoff.path;
  }
  // Có cổng riêng (máy phát triển): ứng dụng chạy ở gốc của cổng đó
  const origin = port
    ? `${window.location.protocol}//${started.handoff.host}:${port}`
    : `https://${started.handoff.host}${path}`;
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

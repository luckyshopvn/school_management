import { useCallback, useEffect, useRef, useState } from 'react';
import { TextField } from '@school-management/ui';
import type { CaptchaAnswer } from '../session/api-client.js';
import { issueCaptcha, type CaptchaChallenge } from './portal-shell-api.js';

// Ô mã xác nhận dạng ảnh có nút làm mới (DT-16 phần 16c); ảnh do máy chủ tự sinh. Mỗi mã chỉ dùng một lần nên trang gọi
// làm mới sau mỗi lần gửi. Đăng nhập theo đơn vị (DT-24) lấy ảnh của trường đang chọn: truyền hàm lấy ảnh và khóa là mã đơn vị,
// đổi đơn vị thì lấy ảnh mới
export function useCaptcha(enabled: boolean, issue: () => Promise<CaptchaChallenge> = issueCaptcha, key = '') {
  const [challenge, setChallenge] = useState<CaptchaChallenge>();
  const [text, setText] = useState('');
  const [loadError, setLoadError] = useState(false);
  // Chỉ nhận ảnh của lần lấy mới nhất, để ảnh đang hiện luôn khớp mã gửi đi
  const latest = useRef(0);
  const issueRef = useRef(issue);
  issueRef.current = issue;

  const refresh = useCallback(() => {
    const request = ++latest.current;
    setText('');
    setLoadError(false);
    issueRef
      .current()
      .then((issued) => {
        if (request === latest.current) {
          setChallenge(issued);
        }
      })
      .catch(() => {
        if (request === latest.current) {
          setLoadError(true);
        }
      });
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    } else {
      setChallenge(undefined);
    }
  }, [enabled, refresh, key]);

  const answer: CaptchaAnswer | undefined =
    enabled && challenge ? { captcha_id: challenge.captcha_id, captcha_text: text } : undefined;
  return { challenge, text, setText, refresh, answer, loadError };
}

const LOAD_ERROR = 'Không tải được ảnh mã xác nhận, bấm Làm mới mã';

function RefreshIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2" strokeLinecap="round" />
      <path d="M21 4v5h-5M3 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// compact: một hàng ô nhập, ảnh, nút làm mới dạng biểu tượng như mẫu trang đăng nhập (YCTD-310); nhãn "Mã xác nhận" và tên nút "Làm mới
// mã" vẫn có cho trình đọc màn hình
export function CaptchaField({
  captcha,
  error,
  compact = false,
}: {
  captcha: ReturnType<typeof useCaptcha>;
  error?: string;
  compact?: boolean;
}) {
  const image = captcha.challenge ? (
    <img
      src={captcha.challenge.image}
      alt="Ảnh mã xác nhận"
      width={compact ? 132 : 170}
      height={compact ? 44 : 56}
      className={`rounded-md border border-border ${compact ? 'h-11 w-[104px] shrink-0 bg-card object-cover sm:w-[132px]' : ''}`}
    />
  ) : (
    <span
      className={`animate-pulse rounded-md bg-page ${compact ? 'h-11 w-[104px] shrink-0 sm:w-[132px]' : 'h-14 w-[170px]'}`}
      aria-hidden="true"
    />
  );
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <TextField
            label="Mã xác nhận"
            hideLabel
            name="captcha"
            placeholder="nhập mã xác nhận"
            autoComplete="off"
            autoCapitalize="characters"
            className="min-w-0 flex-1"
            inputClassName="bg-page placeholder:text-text-secondary"
            value={captcha.text}
            onChange={(event) => captcha.setText(event.target.value)}
            error={error ?? (captcha.loadError ? LOAD_ERROR : undefined)}
          />
          {image}
          <button
            type="button"
            aria-label="Làm mới mã"
            title="Làm mới mã"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-link hover:bg-selected focus:outline-none focus:ring-2 focus:ring-selected"
            onClick={captcha.refresh}
          >
            <RefreshIcon />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {image}
        <button
          type="button"
          className="rounded-md px-2 py-1 text-label font-medium text-link hover:underline"
          onClick={captcha.refresh}
        >
          Làm mới mã
        </button>
      </div>
      <TextField
        label="Mã xác nhận"
        name="captcha"
        autoComplete="off"
        autoCapitalize="characters"
        value={captcha.text}
        onChange={(event) => captcha.setText(event.target.value)}
        error={error ?? (captcha.loadError ? LOAD_ERROR : undefined)}
      />
    </div>
  );
}

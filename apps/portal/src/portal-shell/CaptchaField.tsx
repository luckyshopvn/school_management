import { useCallback, useEffect, useState } from 'react';
import { TextField } from '@school-management/ui';
import type { CaptchaAnswer } from '../session/api-client.js';
import { issueCaptcha, type CaptchaChallenge } from './portal-shell-api.js';

// Ô mã xác nhận dạng ảnh có nút làm mới (DT-16 phần 16c); ảnh do máy chủ tự sinh. Mỗi mã chỉ dùng một lần nên trang gọi
// làm mới sau mỗi lần gửi
export function useCaptcha(enabled: boolean) {
  const [challenge, setChallenge] = useState<CaptchaChallenge>();
  const [text, setText] = useState('');
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(() => {
    setText('');
    setLoadError(false);
    issueCaptcha()
      .then(setChallenge)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    } else {
      setChallenge(undefined);
    }
  }, [enabled, refresh]);

  const answer: CaptchaAnswer | undefined =
    enabled && challenge ? { captcha_id: challenge.captcha_id, captcha_text: text } : undefined;
  return { challenge, text, setText, refresh, answer, loadError };
}

export function CaptchaField({ captcha, error }: { captcha: ReturnType<typeof useCaptcha>; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {captcha.challenge ? (
          <img
            src={captcha.challenge.image}
            alt="Ảnh mã xác nhận"
            width={170}
            height={56}
            className="rounded-md border border-border"
          />
        ) : (
          <span className="h-14 w-[170px] animate-pulse rounded-md bg-page" aria-hidden="true" />
        )}
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
        error={error ?? (captcha.loadError ? 'Không tải được ảnh mã xác nhận, bấm Làm mới mã' : undefined)}
      />
    </div>
  );
}

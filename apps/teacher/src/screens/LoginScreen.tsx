import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, DemoAccountPicker, ExternalProviderButtons, TextField } from '@school-management/ui';
import { externalRequest } from '../session/external-request.js';
import { ApiError, issueCaptcha, type CaptchaChallenge } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// Ô mã xác nhận dạng ảnh, cùng cơ chế với cổng quản trị (DT-16 phần 16c) và ứng dụng học sinh: hiện từ lần nhập sai đầu tiên; mỗi mã
// dùng một lần. Máy chủ đòi mã ở kênh giáo viên khi tài khoản đã nhập sai đủ số lần (YCTD-353)
function useCaptcha(enabled: boolean) {
  const [challenge, setChallenge] = useState<CaptchaChallenge>();
  const [text, setText] = useState('');
  const latest = useRef(0);
  const refresh = useCallback(() => {
    const request = ++latest.current;
    setText('');
    issueCaptcha()
      .then((issued) => {
        if (request === latest.current) {
          setChallenge(issued);
        }
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (enabled) {
      refresh();
    } else {
      setChallenge(undefined);
    }
  }, [enabled, refresh]);
  return {
    challenge,
    text,
    setText,
    refresh,
    answer: enabled && challenge ? { captcha_id: challenge.captcha_id, captcha_text: text } : undefined,
  };
}

// MH-47 Đăng nhập của ứng dụng giáo viên; thông báo lỗi lấy nguyên từ máy chủ
export function LoginScreen() {
  const session = useSession();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  // Xác thực hai lớp tuỳ chọn theo trường (DT-SaaS phần S8b): máy chủ đòi mã sau khi mật khẩu đúng
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [failedOnce, setFailedOnce] = useState(false);
  const [captchaError, setCaptchaError] = useState<string>();
  const captcha = useCaptcha(failedOnce);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setCaptchaError(undefined);
    setSubmitting(true);
    try {
      await session.login(loginIdentifier.trim(), password, otpRequired ? otpCode.trim() : undefined, captcha.answer);
    } catch (error) {
      if (error instanceof ApiError && !otpRequired && error.details.some((detail) => detail.field === 'otp_code')) {
        setOtpRequired(true);
        return;
      }
      const captchaDetail =
        error instanceof ApiError ? error.details.find((detail) => detail.field === 'captcha') : undefined;
      if (captchaDetail) {
        setCaptchaError(captchaDetail.message);
      } else {
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
      }
      if (failedOnce) {
        captcha.refresh();
      }
      setFailedOnce(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-4 px-4 pt-12">
      <form
        onSubmit={submit}
        noValidate
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Đăng nhập</h1>
          <p className="text-label text-text-secondary">Ứng dụng giáo viên</p>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <TextField
          label="Số điện thoại hoặc tên đăng nhập"
          autoComplete="username"
          value={loginIdentifier}
          onChange={(event) => setLoginIdentifier(event.target.value)}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {captcha.challenge ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <img
                src={captcha.challenge.image}
                alt="Ảnh mã xác nhận"
                width={170}
                height={56}
                className="rounded-md border border-border"
              />
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
              error={captchaError}
            />
          </div>
        ) : null}
        {otpRequired ? (
          <TextField
            label="Mã xác thực hai lớp (hoặc mã khôi phục)"
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
          />
        ) : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
      <ExternalProviderButtons request={externalRequest} channel="teacher" basePath={import.meta.env.BASE_URL} />
      <DemoAccountPicker
        app="teacher"
        onPick={(login, demoPassword) => {
          setErrorMessage(undefined);
          session.login(login, demoPassword).catch((error: unknown) => {
            setErrorMessage(
              error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại',
            );
          });
        }}
      />
    </main>
  );
}

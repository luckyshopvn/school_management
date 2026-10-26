import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { issueCaptcha, StudentApiError, type CaptchaChallenge } from './student-api.js';
import { useStudentSession } from './student-session.js';

// Ô mã xác nhận dạng ảnh, cùng cơ chế với cổng quản trị (DT-16 phần 16c): hiện từ lần nhập sai đầu tiên; mỗi mã dùng một lần
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

// Đăng nhập của học sinh (DT-23 phần 23a, GD-105): tên đăng nhập và mật khẩu do nhà trường cấp ở "Tài khoản học và thi";
// học sinh không tự đăng ký
export function StudentLoginScreen() {
  const session = useStudentSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const captcha = useCaptcha(failedOnce);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await session.login(login.trim(), password, captcha.answer);
    } catch (error) {
      if (error instanceof StudentApiError) {
        const details = Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
        setErrorMessage(details.captcha ? undefined : error.message);
        setFieldErrors(details);
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
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
        aria-label="Đăng nhập của học sinh"
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Đăng nhập học sinh</h1>
          <p className="text-label text-text-secondary">Làm bài thi trực tuyến</p>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <TextField
          label="Tên đăng nhập"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          error={fieldErrors.login}
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
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
              error={fieldErrors.captcha}
            />
          </div>
        ) : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang xử lý…' : 'Đăng nhập'}
        </Button>
        <p className="text-label text-text-secondary">
          Tên đăng nhập và mật khẩu do nhà trường cấp. Lần đầu đăng nhập, em đặt mật khẩu mới cho riêng mình.
        </p>
        <a href="#" className="text-label font-medium text-text underline">
          Ứng dụng phụ huynh
        </a>
      </form>
    </main>
  );
}

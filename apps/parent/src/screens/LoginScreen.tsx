import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, DemoAccountPicker, ExternalProviderButtons, TextField } from '@school-management/ui';
import { externalRequest } from '../session/external-request.js';
import { ApiError, issueCaptcha, requestOneTimeCode, type CaptchaChallenge } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { RECRUITMENT_HASH } from './RecruitmentScreen.js';

// MH-47 Đăng nhập của ứng dụng phụ huynh: bằng mật khẩu hoặc bằng mã một lần gửi qua tin nhắn (XT-01, Q-24)
type Method = 'password' | 'code';

function describe(error: unknown): { message: string; fields: Record<string, string> } {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      fields: Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])),
    };
  }
  return { message: 'Không kết nối được tới máy chủ, vui lòng thử lại', fields: {} };
}

// Ô mã xác nhận dạng ảnh ở đăng nhập bằng mật khẩu, cùng cơ chế với cổng quản trị và ứng dụng giáo viên (YCTD-354): hiện từ lần nhập
// sai đầu tiên; mỗi mã dùng một lần
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

export function LoginScreen({ onAdmissions }: { onAdmissions?: () => void }) {
  const session = useSession();
  const [method, setMethod] = useState<Method>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const captcha = useCaptcha(failedOnce);

  async function run(action: () => Promise<void>) {
    setErrorMessage(undefined);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await action();
    } catch (error) {
      const described = describe(error);
      setErrorMessage(described.message);
      setFieldErrors(described.fields);
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === 'code') {
      void run(() => session.loginWithOneTimeCode(phone.trim(), code));
      return;
    }
    void run(async () => {
      try {
        await session.loginWithPassword(phone.trim(), password, captcha.answer);
      } catch (error) {
        if (failedOnce) {
          captcha.refresh();
        }
        setFailedOnce(true);
        throw error;
      }
    });
  }

  function sendCode() {
    setNotice(undefined);
    void run(async () => {
      const result = await requestOneTimeCode(phone.trim());
      setNotice(`${result.message}. Mã có hiệu lực ${Math.round(result.expires_in_seconds / 60)} phút.`);
    });
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
          <p className="text-label text-text-secondary">Ứng dụng phụ huynh</p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Cách đăng nhập">
          <Button
            role="tab"
            aria-selected={method === 'password'}
            variant={method === 'password' ? 'secondary' : 'text'}
            onClick={() => setMethod('password')}
          >
            Mật khẩu
          </Button>
          <Button
            role="tab"
            aria-selected={method === 'code'}
            variant={method === 'code' ? 'secondary' : 'text'}
            onClick={() => setMethod('code')}
          >
            Mã qua tin nhắn
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {notice && method === 'code' ? <Alert tone="info">{notice}</Alert> : null}
        <TextField
          label="Số điện thoại"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone ?? fieldErrors.login}
        />
        {method === 'password' ? (
          <TextField
            label="Mật khẩu"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
          />
        ) : (
          <div className="flex items-end gap-2">
            <TextField
              label="Mã đăng nhập"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={fieldErrors.code}
              className="flex-1"
            />
            <Button onClick={sendCode} disabled={submitting || phone.trim() === ''}>
              Gửi mã
            </Button>
          </div>
        )}
        {method === 'password' && captcha.challenge ? (
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
        {method === 'password' ? (
          <p className="text-label text-text-secondary">
            Lần đầu đăng nhập, dùng mật khẩu mặc định do nhà trường cung cấp; ứng dụng sẽ yêu cầu đặt mật khẩu mới.
          </p>
        ) : null}
        {onAdmissions ? (
          <Button variant="text" onClick={onAdmissions}>
            Tuyển sinh trực tuyến
          </Button>
        ) : null}
      </form>
      <ExternalProviderButtons request={externalRequest} channel="parent" basePath={import.meta.env.BASE_URL} />
      {/* Bản trình diễn: chọn tài khoản phụ huynh giả để vào thử (DT-18 phần 18h) */}
      <DemoAccountPicker
        app="parent"
        onPick={(login, demoPassword) => {
          setErrorMessage(undefined);
          session.loginWithPassword(login, demoPassword).catch((error: unknown) => {
            setErrorMessage(
              error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại',
            );
          });
        }}
      />
      <nav aria-label="Trang công khai" className="fixed bottom-6 left-0 right-0 flex justify-center gap-6">
        <a
          href={import.meta.env.VITE_STUDENT_APP_URL}
          className="inline-flex min-h-11 items-center px-2 text-label font-medium text-text underline"
        >
          Học sinh làm bài thi trực tuyến
        </a>
        <a
          href={RECRUITMENT_HASH}
          className="inline-flex min-h-11 items-center px-2 text-label font-medium text-text underline"
        >
          Tuyển dụng giáo viên và nhân viên
        </a>
      </nav>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestOneTimeCode } from '../session/api-client.js';
import { useSession } from '../session/session.js';

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

export function LoginScreen() {
  const session = useSession();
  const [method, setMethod] = useState<Method>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    void run(() =>
      method === 'password'
        ? session.loginWithPassword(phone.trim(), password)
        : session.loginWithOneTimeCode(phone.trim(), code),
    );
  }

  function sendCode() {
    setNotice(undefined);
    void run(async () => {
      const result = await requestOneTimeCode(phone.trim());
      setNotice(`${result.message}. Mã có hiệu lực ${Math.round(result.expires_in_seconds / 60)} phút.`);
    });
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-12">
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
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang xử lý…' : 'Đăng nhập'}
        </Button>
        {method === 'password' ? (
          <p className="text-label text-text-secondary">
            Lần đầu đăng nhập, dùng mật khẩu mặc định do nhà trường cung cấp; ứng dụng sẽ yêu cầu đặt mật khẩu mới.
          </p>
        ) : null}
      </form>
    </main>
  );
}

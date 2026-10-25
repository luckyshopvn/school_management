import { useState, type FormEvent } from 'react';
import { Alert, Button, DemoAccountPicker, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await session.login(loginIdentifier.trim(), password, otpRequired ? otpCode.trim() : undefined);
    } catch (error) {
      if (error instanceof ApiError && !otpRequired && error.details.some((detail) => detail.field === 'otp_code')) {
        setOtpRequired(true);
        return;
      }
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
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

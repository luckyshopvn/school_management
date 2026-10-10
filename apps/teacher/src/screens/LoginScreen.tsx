import { useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// MH-47 Đăng nhập của ứng dụng giáo viên; thông báo lỗi lấy nguyên từ máy chủ
export function LoginScreen() {
  const session = useSession();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await session.login(loginIdentifier.trim(), password);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
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
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { activateAdministrator, readActivation } from '../portal-shell/portal-shell-api.js';

// Kích hoạt quản trị viên đầu tiên của trường mới (DT-SaaS phần S2, YCTD-193). Nhà vận hành nền tảng khởi tạo trường và gửi
// đường liên kết một lần (hạn 72 giờ) cho quản trị viên; quản trị viên tự đặt mật khẩu theo chính sách (BM-03) rồi đăng nhập.
// Đường liên kết đã dùng hoặc hết hạn thì báo liên hệ nhà vận hành để cấp lại
function tokenFromLocation(): string {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

export function ActivatePage() {
  const [token] = useState(tokenFromLocation);
  const [account, setAccount] = useState<{ login: string; full_name: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage('Thiếu mã kích hoạt trong đường liên kết');
      return;
    }
    readActivation(token)
      .then(setAccount)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [token]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirm_password: 'Mật khẩu nhập lại không khớp' });
      return;
    }
    setSubmitting(true);
    activateAdministrator({ token, new_password: newPassword })
      .then((response) => setDone(response.message))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.details.length > 0) {
          setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
          return;
        }
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Kích hoạt tài khoản quản trị</h1>
          {account && !done ? (
            <p className="text-label text-text-secondary">
              {account.full_name}, tên đăng nhập <strong>{account.login}</strong>. Đặt mật khẩu để bắt đầu dùng hệ thống
            </p>
          ) : null}
        </div>
        {done ? <Alert tone="success">{done}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {account && !done ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <TextField
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={fieldErrors.new_password}
            />
            <TextField
              label="Nhập lại mật khẩu mới"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={fieldErrors.confirm_password}
            />
            <Button type="submit" variant="primary" disabled={submitting}>
              Kích hoạt
            </Button>
          </form>
        ) : null}
        <Link to="/login" className="text-label font-medium text-link hover:underline">
          Đến trang đăng nhập
        </Link>
      </div>
    </main>
  );
}

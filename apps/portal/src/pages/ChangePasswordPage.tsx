import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// MH-48 Đổi mật khẩu; quy tắc mật khẩu do máy chủ kiểm tra (BM-03)
export function ChangePasswordPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    if (newPassword !== confirmation) {
      setFieldErrors({ confirmation: 'Hai lần nhập mật khẩu mới không khớp' });
      return;
    }
    setSubmitting(true);
    try {
      await session.changePassword(currentPassword, newPassword);
      await navigate({ to: '/' });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        const messages: Record<string, string> = {};
        for (const detail of error.details) {
          messages[detail.field] = messages[detail.field]
            ? `${messages[detail.field]}; ${detail.message}`
            : detail.message;
        }
        setFieldErrors(messages);
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        noValidate
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Đổi mật khẩu</h1>
          {session.passwordChangeRequired ? (
            <p className="text-label text-text-secondary">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.</p>
          ) : null}
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <TextField
          label="Mật khẩu hiện tại"
          name="current_password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          error={fieldErrors.current_password}
        />
        <TextField
          label="Mật khẩu mới"
          name="new_password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={fieldErrors.new_password}
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={fieldErrors.confirmation}
        />
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </Button>
        {session.passwordChangeRequired ? null : (
          <Button variant="text" onClick={() => void navigate({ to: '/' })}>
            Quay lại
          </Button>
        )}
      </form>
    </main>
  );
}

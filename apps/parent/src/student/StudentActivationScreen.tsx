import { useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { StudentApiError } from './student-api.js';
import { useStudentSession } from './student-session.js';

// Đặt mật khẩu mới ở lần đăng nhập đầu (DT-23 phần 23a): học sinh không đổi thông tin hồ sơ, chỉ đổi mật khẩu của mình
export function StudentActivationScreen() {
  const session = useStudentSession();
  const [currentPassword, setCurrentPassword] = useState(session.lastPassword ?? '');
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
      setFieldErrors({ confirmation: 'Hai lần nhập mật khẩu mới không giống nhau' });
      return;
    }
    setSubmitting(true);
    try {
      await session.changePassword(currentPassword, newPassword);
    } catch (error) {
      if (error instanceof StudentApiError) {
        setErrorMessage(error.message);
        setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-12">
      <form
        onSubmit={submit}
        noValidate
        aria-label="Đặt mật khẩu mới của học sinh"
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Đặt mật khẩu mới</h1>
          <p className="text-label text-text-secondary">
            Mật khẩu do nhà trường cấp chỉ dùng một lần. Em đặt mật khẩu riêng, ít nhất 8 ký tự, có cả chữ và số, và không
            cho bạn khác biết.
          </p>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {session.lastPassword ? null : (
          <TextField
            label="Mật khẩu hiện tại"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            error={fieldErrors.current_password}
          />
        )}
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
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={fieldErrors.confirmation}
        />
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
        <Button variant="text" onClick={() => void session.logout()}>
          Đăng xuất
        </Button>
      </form>
    </main>
  );
}

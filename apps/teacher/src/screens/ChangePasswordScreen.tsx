import { useState, type FormEvent } from 'react';
import { Alert, Button, PhoneCodeField, TextField } from '@school-management/ui';
import { ApiError, sendChangePasswordCode } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// MH-48 Đổi mật khẩu khi bắt buộc đổi ở lần đăng nhập đầu hoặc sau khi được đặt lại (BM-07). Còn mật khẩu mặc định thì máy chủ đòi
// mã gửi tới số điện thoại: hiện ô mã khi máy chủ báo lỗi ở ô otp_code (YCTD-323)
export function ChangePasswordScreen() {
  const session = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [codeNeeded, setCodeNeeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await session.changePassword(currentPassword, newPassword, otpCode.trim() || undefined);
    } catch (error) {
      if (error instanceof ApiError && error.details.some((detail) => detail.field === 'otp_code')) {
        setCodeNeeded(true);
      }
      setErrorMessage(
        error instanceof ApiError
          ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
          : 'Không kết nối được tới máy chủ, vui lòng thử lại',
      );
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
        <h1 className="text-page-title font-bold text-text">Đổi mật khẩu</h1>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <TextField
          label="Mật khẩu hiện tại"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <TextField
          label="Mật khẩu mới"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        {codeNeeded ? <PhoneCodeField value={otpCode} onChange={setOtpCode} onSend={sendChangePasswordCode} /> : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          Lưu mật khẩu
        </Button>
        <Button variant="text" onClick={() => void session.logout()}>
          Đăng xuất
        </Button>
      </form>
    </main>
  );
}

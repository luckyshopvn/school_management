import { useState, type FormEvent } from 'react';
import { changeOperatorPassword, PlatformApiError } from './platform-api.js';

// Nhân viên vận hành tự đổi mật khẩu (YCTD-323, T-P1): mật khẩu hiện tại, mã xác thực hai lớp, mật khẩu mới từ 12 ký tự nhập hai lần.
// Còn mật khẩu tạm thì đây là màn duy nhất của cổng cho tới khi đổi xong (máy chủ chặn mọi trang khác)
const MINIMUM_LENGTH = 12;

export function OperatorPasswordPage({
  token,
  forced,
  onChanged,
}: {
  token: string;
  forced: boolean;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setDone(false);
    if (newPassword.length < MINIMUM_LENGTH) {
      setError(`Mật khẩu mới phải có ít nhất ${MINIMUM_LENGTH} ký tự`);
      return;
    }
    if (newPassword !== confirmation) {
      setError('Hai lần nhập mật khẩu mới không khớp');
      return;
    }
    setBusy(true);
    try {
      await changeOperatorPassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
        otp_code: otpCode.trim(),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setOtpCode('');
      setDone(true);
      onChanged();
    } catch (caught) {
      setError(caught instanceof PlatformApiError ? caught.message : 'Không đổi được mật khẩu, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Đổi mật khẩu" className="card">
      <h2>Đổi mật khẩu</h2>
      {forced ? (
        <p role="note">
          Bạn đang dùng mật khẩu tạm do quản trị cấp. Hãy đặt mật khẩu mới trước khi dùng cổng vận hành.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {done ? <p role="status">Đã đổi mật khẩu.</p> : null}
      <form onSubmit={submit} aria-label="Đổi mật khẩu vận hành">
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Mật khẩu mới (từ {MINIMUM_LENGTH} ký tự)
          <input
            type="password"
            autoComplete="new-password"
            minLength={MINIMUM_LENGTH}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Nhập lại mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        <label>
          Mã xác thực hai lớp
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          Đổi mật khẩu
        </button>
      </form>
    </section>
  );
}

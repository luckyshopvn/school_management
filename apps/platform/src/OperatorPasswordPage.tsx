import { useState, type FormEvent } from 'react';
import { changeOperatorPassword, PlatformApiError } from './platform-api.js';
import { useBusy } from './platform-ui.js';

// Nhân viên vận hành tự đổi mật khẩu (YCTD-323, T-P1): mật khẩu hiện tại, mã xác thực hai lớp, mật khẩu mới từ 12 ký tự nhập hai lần.
// Còn mật khẩu tạm thì đây là màn duy nhất của cổng cho tới khi đổi xong (máy chủ chặn mọi trang khác). Giao diện YCTD-370: thẻ hẹp, quy
// tắc mật khẩu đổi nhãn Đạt khi gõ, lỗi hiện tại đúng ô
const MINIMUM_LENGTH = 12;

function Rule({ passed, label, failedLabel }: { passed: boolean; label: string; failedLabel: string }) {
  return (
    <li>
      {label}{' '}
      <span className="status" data-tone={passed ? 'ok' : 'warn'}>
        {passed ? 'Đạt' : failedLabel}
      </span>
    </li>
  );
}

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
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<{ message: string; fields: string[] }>();
  const [done, setDone] = useState(false);
  const [busy, run] = useBusy();

  const longEnough = newPassword.length >= MINIMUM_LENGTH;
  const matching = newPassword !== '' && newPassword === confirmation;
  const fieldMessage = (field: string) => (error?.fields.includes(field) ? error.message : undefined);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setDone(false);
    if (!longEnough) {
      setError({ message: `Mật khẩu mới phải có ít nhất ${MINIMUM_LENGTH} ký tự`, fields: ['new_password'] });
      return;
    }
    if (!matching) {
      setError({ message: 'Hai lần nhập mật khẩu mới không khớp', fields: ['confirmation'] });
      return;
    }
    void run(async () => {
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
        setError(
          caught instanceof PlatformApiError
            ? { message: caught.message, fields: caught.fields }
            : { message: 'Không đổi được mật khẩu, vui lòng thử lại', fields: [] },
        );
      }
    });
  }

  const currentError = fieldMessage('current_password');
  const newError = fieldMessage('new_password');
  const confirmationError = fieldMessage('confirmation');
  const otpError = fieldMessage('otp_code');
  // Lỗi không gắn với ô nào thì hiện ở dải đầu trang
  const generalError = error && error.fields.length === 0 ? error.message : undefined;

  return (
    <section aria-label="Đổi mật khẩu">
      <h1>Đổi mật khẩu</h1>
      <p className="lead">Mật khẩu từ {MINIMUM_LENGTH} ký tự. Cần mã xác thực hai lớp để đổi.</p>
      <div style={{ maxWidth: 480 }}>
        {forced ? (
          <div className="banner" data-tone="warn" role="note">
            Bạn đang dùng mật khẩu tạm do quản trị cấp. Hãy đặt mật khẩu mới trước khi dùng cổng vận hành.
          </div>
        ) : null}
        {done ? (
          <div className="banner" data-tone="ok" role="status">
            Đã đổi mật khẩu.
          </div>
        ) : null}
        {generalError ? (
          <div className="banner" data-tone="danger" role="alert">
            Không đổi được mật khẩu: {generalError}
          </div>
        ) : null}
        <section className="card">
          <form className="stack" onSubmit={submit} aria-label="Đổi mật khẩu vận hành">
            <label className="field">
              Mật khẩu hiện tại
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                aria-invalid={currentError ? true : undefined}
              />
              {currentError ? <span className="field-error">{currentError}</span> : null}
            </label>
            <label className="field">
              Mật khẩu mới
              <span style={{ display: 'flex', gap: 6 }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={MINIMUM_LENGTH}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  style={{ flex: 1 }}
                  aria-invalid={newError ? true : undefined}
                />
                <button
                  type="button"
                  className="button-link"
                  aria-label={showNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                  aria-pressed={showNew}
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
              {newError ? <span className="field-error">{newError}</span> : null}
            </label>
            <ul className="muted" style={{ margin: '-0.25rem 0 0', paddingLeft: '1.1rem' }} aria-live="polite">
              <Rule passed={longEnough} label={`Từ ${MINIMUM_LENGTH} ký tự trở lên`} failedLabel="Chưa đủ" />
              <Rule passed={matching} label="Hai lần nhập khớp nhau" failedLabel="Chưa khớp" />
            </ul>
            <label className="field">
              Nhập lại mật khẩu mới
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                aria-invalid={confirmationError ? true : undefined}
              />
              {confirmationError ? <span className="field-error">{confirmationError}</span> : null}
            </label>
            <label className="field">
              <span>
                Mã xác thực hai lớp <span className="hint">mã trong ứng dụng xác thực</span>
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                required
                aria-invalid={otpError ? true : undefined}
              />
              {otpError ? <span className="field-error">{otpError}</span> : null}
            </label>
            <div className="button-row">
              <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
                {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}

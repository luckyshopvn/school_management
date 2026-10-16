import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { CaptchaField, useCaptcha } from '../portal-shell/CaptchaField.js';
import { confirmPasswordReset, requestPasswordReset } from '../portal-shell/portal-shell-api.js';

// Quên mật khẩu tự phục vụ của cổng quản trị (DT-16 phần 16c). Bước 1: nhập số điện thoại hoặc tên đăng nhập và mã xác
// nhận; máy chủ gửi mã 6 chữ số qua tin nhắn tới số điện thoại đã đăng ký, phản hồi như nhau dù tài khoản có hay không.
// Bước 2: nhập mã và mật khẩu mới (không trùng mật khẩu gần đây). Đặt xong thì mọi phiên cũ bị thu hồi
type Step = 'request' | 'confirm' | 'done';

function errorsOf(error: unknown): { message?: string; fields: Record<string, string> } {
  if (error instanceof ApiError) {
    const fields = Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
    return { message: error.details.length > 0 ? undefined : error.message, fields };
  }
  return { message: 'Không kết nối được tới máy chủ, vui lòng thử lại', fields: {} };
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const captcha = useCaptcha(step === 'request');

  async function run(action: () => Promise<void>) {
    setErrorMessage(undefined);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await action();
    } catch (error) {
      const { message, fields } = errorsOf(error);
      setErrorMessage(message);
      setFieldErrors(fields);
    } finally {
      setSubmitting(false);
    }
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      try {
        const response = await requestPasswordReset({
          login: loginIdentifier.trim(),
          captcha_id: captcha.answer?.captcha_id ?? '',
          captcha_text: captcha.answer?.captcha_text ?? '',
        });
        setNotice(response.message);
        setStep('confirm');
      } finally {
        captcha.refresh();
      }
    });
  }

  function submitConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirm_password: 'Mật khẩu nhập lại không khớp' });
      return;
    }
    void run(async () => {
      const response = await confirmPasswordReset({ login: loginIdentifier.trim(), code: code.trim(), new_password: newPassword });
      setNotice(response.message);
      setStep('done');
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Quên mật khẩu</h1>
          <p className="text-label text-text-secondary">
            {step === 'request'
              ? 'Nhập số điện thoại hoặc tên đăng nhập để nhận mã đặt lại mật khẩu qua tin nhắn'
              : step === 'confirm'
                ? 'Nhập mã trong tin nhắn và mật khẩu mới'
                : 'Hoàn tất'}
          </p>
        </div>
        {notice ? <Alert tone={step === 'done' ? 'success' : 'info'}>{notice}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {step === 'request' ? (
          <form onSubmit={submitRequest} noValidate className="flex flex-col gap-4">
            <TextField
              label="Số điện thoại hoặc tên đăng nhập"
              name="login"
              autoComplete="username"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              error={fieldErrors.login}
            />
            <CaptchaField captcha={captcha} error={fieldErrors.captcha} />
            <Button type="submit" variant="primary" disabled={submitting}>
              Gửi mã
            </Button>
          </form>
        ) : null}
        {step === 'confirm' ? (
          <form onSubmit={submitConfirm} noValidate className="flex flex-col gap-4">
            <TextField
              label="Mã trong tin nhắn"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={fieldErrors.code}
            />
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
              Đặt lại mật khẩu
            </Button>
            <button
              type="button"
              className="text-label font-medium text-link hover:underline"
              onClick={() => {
                setStep('request');
                setNotice(undefined);
              }}
            >
              Gửi lại mã
            </button>
          </form>
        ) : null}
        <Link to="/login" className="text-label font-medium text-link hover:underline">
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}

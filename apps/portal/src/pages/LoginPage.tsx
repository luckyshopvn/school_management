import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { CaptchaField, useCaptcha } from '../portal-shell/CaptchaField.js';
import { readLoginInfo, readLoginOptions } from '../portal-shell/portal-shell-api.js';
import { DemoRolePicker } from '../administration/DemoRolePicker.js';

// MH-47 Đăng nhập; thông báo lỗi lấy nguyên từ máy chủ. Theo trang đăng nhập của Sở (DT-16 phần 16c): tên và mã trường,
// năm học đang dùng (bản chạy nội bộ thay cho bước chọn Năm học → Cấp học → Phường/Xã → Trường, vì phần mềm phục vụ một
// trường), ghi nhớ tài khoản, mã xác nhận dạng ảnh có nút làm mới (hiện khi cấu hình luôn hiện hoặc sau lần nhập sai đầu
// tiên; máy chủ bắt buộc sau số lần sai cấu hình), quên mật khẩu, đường dây nóng
export const REMEMBERED_LOGIN_KEY = 'portal.remembered-login';

function readRememberedLogin(): string {
  try {
    return localStorage.getItem(REMEMBERED_LOGIN_KEY) ?? '';
  } catch {
    return '';
  }
}

// Chỉ ghi nhớ số điện thoại hoặc tên đăng nhập, không bao giờ ghi mật khẩu
function storeRememberedLogin(value: string | null): void {
  try {
    if (value) {
      localStorage.setItem(REMEMBERED_LOGIN_KEY, value);
    } else {
      localStorage.removeItem(REMEMBERED_LOGIN_KEY);
    }
  } catch {
    // Trình duyệt chặn bộ nhớ thì bỏ qua ghi nhớ
  }
}

export function LoginPage() {
  const session = useSession();
  const remembered = readRememberedLogin();
  const [loginIdentifier, setLoginIdentifier] = useState(remembered);
  const [rememberLogin, setRememberLogin] = useState(remembered !== '');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const info = useQuery({ queryKey: ['login-info'], queryFn: readLoginInfo, retry: false });
  const options = useQuery({ queryKey: ['login-options'], queryFn: readLoginOptions, retry: false });
  const captchaShown = Boolean(options.data?.captcha_always) || failedOnce;
  const captcha = useCaptcha(captchaShown);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await session.login(loginIdentifier.trim(), password, captcha.answer);
      storeRememberedLogin(rememberLogin ? loginIdentifier.trim() : null);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
        setErrorMessage(details.captcha ? undefined : error.message);
        setFieldErrors(details);
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
      // Mã xác nhận chỉ dùng một lần; lần sai đầu tiên thì bắt đầu hiện mã
      if (captchaShown) {
        captcha.refresh();
      }
      setFailedOnce(true);
    } finally {
      setSubmitting(false);
    }
  }

  const schoolName = info.data?.school_name;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8">
      <form
        onSubmit={submit}
        noValidate
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">Đăng nhập</h1>
          <p className="text-label text-text-secondary">Cổng quản trị School Management</p>
          {schoolName ? (
            <div className="mt-2 rounded-lg bg-selected px-3 py-2" data-testid="login-school">
              <p className="text-content font-semibold text-text">{schoolName}</p>
              <p className="text-label text-text-secondary">
                {info.data?.school_code ? `Mã trường: ${info.data.school_code}` : null}
                {info.data?.school_code && info.data.academic_year ? ' · ' : null}
                {info.data?.academic_year ? `Năm học ${info.data.academic_year}` : null}
              </p>
            </div>
          ) : null}
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        <TextField
          label="Số điện thoại hoặc tên đăng nhập"
          name="login"
          autoComplete="username"
          value={loginIdentifier}
          onChange={(event) => setLoginIdentifier(event.target.value)}
          error={fieldErrors.login}
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        {captchaShown ? <CaptchaField captcha={captcha} error={fieldErrors.captcha} /> : null}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-label text-text">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(event) => setRememberLogin(event.target.checked)}
            />
            Ghi nhớ tài khoản
          </label>
          <Link to="/forgot-password" className="text-label font-medium text-link hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
      <DemoRolePicker />
      {options.data?.hotline ? (
        <p className="text-label text-text-secondary" data-testid="login-hotline">
          Đường dây nóng hỗ trợ: <span className="font-semibold text-text">{options.data.hotline}</span>
        </p>
      ) : null}
    </main>
  );
}

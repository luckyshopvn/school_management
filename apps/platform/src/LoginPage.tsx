import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { issueCaptcha, loginOperator, PlatformApiError, type CaptchaChallenge } from './platform-api.js';

// Trang đăng nhập cổng vận hành nền tảng theo mẫu đăng nhập Eric duyệt ngày 2026-10-28 (YCTD-312): thẻ trắng giữa nền xanh nhạt,
// mục "Thông tin tài khoản", nút xanh toàn chiều rộng, hàng Ghi nhớ và Quên mật khẩu. Không có mục thông tin đơn vị (cổng vận
// hành không thuộc Sở, trường). Hai bước: tên đăng nhập, mật khẩu; máy chủ đòi mã xác thực hai lớp thì sang bước nhập mã TOTP
// hoặc mã khôi phục. Ghi nhớ chỉ lưu tên đăng nhập trên trình duyệt; mật khẩu để trình duyệt tự lưu qua autocomplete.
// Mã xác nhận dạng ảnh (YCTD-313) ở bước 1, có nút làm mới; mỗi ảnh dùng một lần nên gửi lỗi thì lấy ảnh mới. Bước mã hai lớp
// gửi lại mã ảnh của bước 1, máy chủ nhận vì bước 1 đã đúng mã ảnh và mật khẩu
const REMEMBER_KEY = 'platform.login.remembered';

// Chỉ nhận ảnh của lần lấy mới nhất để ảnh đang hiện luôn khớp mã gửi đi
function useCaptcha() {
  const [challenge, setChallenge] = useState<CaptchaChallenge>();
  const [text, setText] = useState('');
  const [loadError, setLoadError] = useState(false);
  const latest = useRef(0);
  const refresh = useCallback(() => {
    const request = ++latest.current;
    setText('');
    setLoadError(false);
    issueCaptcha()
      .then((issued) => {
        if (request === latest.current) {
          setChallenge(issued);
        }
      })
      .catch(() => {
        if (request === latest.current) {
          setLoadError(true);
        }
      });
  }, []);
  useEffect(() => refresh(), [refresh]);
  return { challenge, text, setText, refresh, loadError };
}

function readRemembered(): string {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeRemembered(login: string | null) {
  try {
    if (login) {
      window.localStorage.setItem(REMEMBER_KEY, login);
    } else {
      window.localStorage.removeItem(REMEMBER_KEY);
    }
  } catch {
    // Trình duyệt chặn lưu trữ: bỏ qua, lần sau nhập lại tên đăng nhập
  }
}

export function LoginPage({ onLoggedIn }: { onLoggedIn: (accessToken: string) => void }) {
  const [login, setLogin] = useState(readRemembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => readRemembered() !== '');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'account' | 'otp'>('account');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const captcha = useCaptcha();
  // Mã ảnh đã dùng đúng ở bước 1, gửi lại ở bước mã hai lớp
  const [passedCaptchaId, setPassedCaptchaId] = useState<string>();

  function backToAccount(message: string | null) {
    setStep('account');
    setOtpCode('');
    setPassedCaptchaId(undefined);
    setError(message);
    captcha.refresh();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const captchaId = step === 'otp' ? passedCaptchaId : captcha.challenge?.captcha_id;
    try {
      const result = await loginOperator(
        login,
        password,
        step === 'otp' ? otpCode : '',
        captchaId ? { captcha_id: captchaId, ...(step === 'account' ? { captcha_text: captcha.text } : {}) } : null,
      );
      writeRemembered(remember ? login.trim() : null);
      onLoggedIn(result.accessToken);
    } catch (caught) {
      const message = caught instanceof PlatformApiError ? caught.message : 'Không đăng nhập được, vui lòng thử lại';
      if (caught instanceof PlatformApiError && step === 'account' && caught.fields.includes('otp_code')) {
        // Mã ảnh và mật khẩu đúng, tài khoản bật xác thực hai lớp: sang bước nhập mã
        setStep('otp');
        setOtpCode('');
        setPassedCaptchaId(captchaId);
      } else if (step === 'otp') {
        // Sai mã hai lớp: lượt mã ảnh đã dùng, quay lại bước 1 với ảnh mới
        backToAccount(message);
      } else {
        setError(message);
        captcha.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" aria-labelledby="login-title" onSubmit={(event) => void submit(event)}>
        <div className="login-heading">
          <h1 id="login-title">Đăng nhập hệ thống</h1>
          <p>Cổng vận hành nền tảng</p>
        </div>

        {step === 'account' ? (
          <fieldset className="login-section">
            <legend>Thông tin tài khoản</legend>
            <label className="login-field">
              <span className="visually-hidden">Tên đăng nhập</span>
              <input
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Tên đăng nhập"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <label className="login-field">
              <span className="visually-hidden">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mật khẩu"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="login-captcha">
              <label className="login-field">
                <span className="visually-hidden">Mã xác nhận</span>
                <input
                  value={captcha.text}
                  onChange={(event) => captcha.setText(event.target.value)}
                  placeholder="nhập mã xác nhận"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </label>
              {captcha.challenge ? (
                <img src={captcha.challenge.image} alt="Ảnh mã xác nhận" width={150} height={46} />
              ) : (
                <span className="login-captcha-empty">{captcha.loadError ? 'Không tải được ảnh' : 'Đang tải ảnh'}</span>
              )}
              <button type="button" className="login-refresh" aria-label="Làm mới mã" onClick={captcha.refresh}>
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="login-row">
              <label className="login-check">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                Ghi nhớ
              </label>
              <button
                type="button"
                className="login-link"
                aria-expanded={forgotOpen}
                aria-controls="quen-mat-khau"
                onClick={() => setForgotOpen(!forgotOpen)}
              >
                Quên Mật Khẩu?
              </button>
            </div>
            {forgotOpen ? (
              <p id="quen-mat-khau" className="login-note">
                Mật khẩu tài khoản vận hành do quản trị viên nền tảng đặt lại trên máy chủ. Liên hệ quản trị viên nền
                tảng để được cấp lại mật khẩu hoặc khóa xác thực hai lớp.
              </p>
            ) : null}
          </fieldset>
        ) : (
          <fieldset className="login-section">
            <legend>Xác thực hai lớp</legend>
            <p className="login-note">
              Tài khoản <strong>{login.trim()}</strong>: nhập mã 6 số trên ứng dụng xác thực, hoặc một mã khôi phục.
            </p>
            <label className="login-field">
              <span className="visually-hidden">Mã xác thực hai lớp</span>
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="Mã 6 số hoặc mã khôi phục"
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
              />
            </label>
          </fieldset>
        )}

        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="login-submit" disabled={busy}>
          {step === 'account' ? 'Đăng nhập' : 'Xác nhận'}
        </button>
        {step === 'otp' ? (
          <button type="button" className="login-link login-back" onClick={() => backToAccount(null)}>
            Quay lại
          </button>
        ) : null}
      </form>
    </main>
  );
}

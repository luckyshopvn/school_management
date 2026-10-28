import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, publicJson } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { CaptchaField, useCaptcha } from '../portal-shell/CaptchaField.js';
import { readLoginInfo, readLoginOptions } from '../portal-shell/portal-shell-api.js';
import { SearchSelect, type SearchSelectOption } from '../portal-shell/SearchSelect.js';
import {
  directoryLogin,
  handoffUrl,
  issueDirectoryCaptcha,
  listCommunes,
  listDepartments,
  listLevels,
  listUnits,
  readLoginContext,
  readUnit,
  schoolPageUrl,
  type LoginContext,
} from '../portal-shell/unit-directory-api.js';
import { DemoRolePicker } from '../administration/DemoRolePicker.js';
import { ExternalLoginProviders } from '../portal-shell/ExternalLoginProviders.js';
import { LoginHero } from './LoginHero.js';

// MH-47 Đăng nhập; thông báo lỗi lấy nguyên từ máy chủ. Theo trang đăng nhập của Sở (DT-16 phần 16c): tên và mã trường,
// năm học đang dùng, ghi nhớ tài khoản, mã xác nhận dạng ảnh có nút làm mới (hiện khi cấu hình luôn hiện hoặc sau lần nhập sai đầu
// tiên; máy chủ bắt buộc sau số lần sai cấu hình), quên mật khẩu, đường dây nóng.
// Bố cục "Đăng nhập hệ thống" với hai phần Thông tin đơn vị và Thông tin tài khoản (DT-24, YCTD-220), học bố cục và luồng chọn đơn vị
// của trang đăng nhập hệ thống ngành nhưng không dùng tên, biểu trưng của cơ quan nhà nước: tiêu đề, biểu trưng lấy từ cấu hình
// thương hiệu của trường (S3) hoặc của nền tảng.
// - Tên miền chung của nền tảng: chọn Sở GD&ĐT → Phường/Xã → Cấp học → Trường như trang đăng nhập hệ thống ngành (YCTD-310; ô chọn
//   có tìm kiếm, danh sách lấy theo trang, cấp học chỉ hiện cấp có trường ở phường, xã đã chọn); đăng
//   nhập đúng thì sang tên miền của trường bằng mã chuyển phiên một lần; đơn vị chưa dùng nền tảng thì báo, không cho gửi.
// - Tên miền của trường và chế độ một trường: ẩn ô chọn, khóa vào trường của tên miền; hành vi đăng nhập giữ như cũ.
// Bố cục hai cột theo mẫu thiết kế Login.dc.html: phần thương hiệu nền xanh bên trái (LoginHero), khung đăng nhập nền trắng bên phải;
// trên điện thoại hai phần xếp chồng.
export const REMEMBERED_LOGIN_KEY = 'portal.remembered-login';
const REMEMBERED_UNIT_KEY = 'portal.remembered-unit';
const LEVEL_NAMES: Record<string, string> = {
  MN: 'Mầm non',
  TH: 'Tiểu học',
  THCS: 'THCS',
  THPT: 'THPT',
  GDTX: 'GDTX',
};

interface RememberedUnit {
  department: SearchSelectOption | null;
  level: SearchSelectOption | null;
  commune: SearchSelectOption | null;
  unit: SearchSelectOption | null;
}

const EMPTY_UNIT: RememberedUnit = { department: null, level: null, commune: null, unit: null };
// Lựa chọn đầu của ô Phường/Xã: trường thiếu phường, xã ở nguồn danh mục vẫn tìm được (YCTD-310)
const ALL_COMMUNES: SearchSelectOption = { code: '*', label: 'Tất cả phường, xã' };

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

// Chỉ ghi nhớ số điện thoại hoặc tên đăng nhập và đơn vị đã chọn, không bao giờ ghi mật khẩu
function store(key: string, value: string | null): void {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Trình duyệt chặn bộ nhớ thì bỏ qua ghi nhớ
  }
}

function readRememberedUnit(): RememberedUnit {
  try {
    const value = JSON.parse(readStored(REMEMBERED_UNIT_KEY) || 'null') as RememberedUnit | null;
    if (!value || typeof value !== 'object') {
      return EMPTY_UNIT;
    }
    // Ghi nhớ từ bố cục cũ (cấp học chọn trước phường, xã, phường để trống): coi là tất cả phường, xã
    const remembered = { ...EMPTY_UNIT, ...value };
    return remembered.department && remembered.level && !remembered.commune
      ? { ...remembered, commune: ALL_COMMUNES }
      : remembered;
  } catch {
    return EMPTY_UNIT;
  }
}

function plain(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

function filterLocal(items: SearchSelectOption[], query: string) {
  const text = plain(query.trim());
  return { items: text ? items.filter((item) => plain(item.label).includes(text)) : items, has_more: false };
}

interface PublicBranding {
  display_name: string | null;
  logo_url: string | null;
}

const readBranding = (): Promise<PublicBranding> => publicJson('/api/v1/public/branding');

export function LoginPage() {
  const context = useQuery({
    queryKey: ['login-context'],
    queryFn: readLoginContext,
    retry: false,
    staleTime: Infinity,
  });
  const mode = context.data?.mode;
  if (context.isPending) {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  return <LoginForm context={context.data ?? { mode: 'single' }} directory={mode === 'directory'} />;
}

function LoginForm({ context, directory }: { context: LoginContext; directory: boolean }) {
  const session = useSession();
  const remembered = readStored(REMEMBERED_LOGIN_KEY);
  const [loginIdentifier, setLoginIdentifier] = useState(remembered);
  const [rememberLogin, setRememberLogin] = useState(remembered !== '');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  // Xác thực hai lớp tuỳ chọn theo trường (DT-SaaS phần S8b): máy chủ đòi mã sau khi mật khẩu đúng
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [selection, setSelection] = useState<RememberedUnit>(() => (directory ? readRememberedUnit() : EMPTY_UNIT));
  const info = useQuery({ queryKey: ['login-info'], queryFn: readLoginInfo, retry: false, enabled: !directory });
  const options = useQuery({
    queryKey: ['login-options'],
    queryFn: readLoginOptions,
    retry: false,
    enabled: !directory,
  });
  const branding = useQuery({
    queryKey: ['public-branding'],
    queryFn: readBranding,
    retry: false,
    enabled: !directory,
  });
  const departments = useQuery({
    queryKey: ['directory-departments'],
    queryFn: listDepartments,
    enabled: directory,
    staleTime: Infinity,
  });
  const departmentCode = selection.department?.code ?? '';
  const communeCode = selection.commune && selection.commune.code !== ALL_COMMUNES.code ? selection.commune.code : null;
  const unitCode = selection.unit?.code ?? '';
  const unitDetail = useQuery({
    queryKey: ['directory-unit', unitCode],
    queryFn: () => readUnit(unitCode),
    enabled: directory && unitCode !== '',
    retry: false,
  });
  const unitReady = directory && unitDetail.data?.available === true;
  const captchaShown = directory ? unitReady : Boolean(options.data?.captcha_always) || failedOnce;
  const captcha = useCaptcha(
    captchaShown,
    directory ? () => issueDirectoryCaptcha(unitCode) : undefined,
    directory ? unitCode : '',
  );

  function select(next: Partial<RememberedUnit>) {
    setSelection((current) => ({ ...current, ...next }));
    setFieldErrors((current) => ({ ...current, unit: '' }));
    setOtpRequired(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    if (directory && !unitReady) {
      setFieldErrors({ unit: selection.unit ? 'Đơn vị chưa dùng hệ thống trên nền tảng' : 'Chọn trường' });
      return;
    }
    setSubmitting(true);
    try {
      if (directory) {
        const reply = await directoryLogin({
          unit: unitCode,
          login: loginIdentifier.trim(),
          password,
          ...(captcha.answer ?? {}),
          ...(otpRequired ? { otp_code: otpCode.trim() } : {}),
        });
        store(REMEMBERED_LOGIN_KEY, rememberLogin ? loginIdentifier.trim() : null);
        store(REMEMBERED_UNIT_KEY, rememberLogin ? JSON.stringify(selection) : null);
        window.location.assign(handoffUrl(reply));
        return;
      }
      await session.login(loginIdentifier.trim(), password, captcha.answer, otpRequired ? otpCode.trim() : undefined);
      store(REMEMBERED_LOGIN_KEY, rememberLogin ? loginIdentifier.trim() : null);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
        // Đúng mật khẩu, chưa nhập mã: hiện ô mã, chưa tính là lần nhập sai (không bật mã xác nhận ảnh)
        if (details.otp_code && !otpRequired) {
          setOtpRequired(true);
          setErrorMessage(undefined);
          setSubmitting(false);
          if (directory) {
            captcha.refresh();
          }
          return;
        }
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

  const page = context.mode === 'directory' ? context.page : null;
  const schoolUnit = context.mode === 'school' ? context.unit : null;
  const schoolName = schoolUnit?.name ?? info.data?.school_name ?? null;
  const title = page?.title ?? branding.data?.display_name ?? schoolName ?? 'School Management';
  const forgotHost = unitDetail.data?.login_host ?? null;
  return (
    <main className="touch-layout flex min-h-screen flex-col bg-page md:flex-row">
      <LoginHero
        title={title}
        parentUnit={schoolUnit?.department_name ? `Sở GD&ĐT ${schoolUnit.department_name}` : null}
        logoUrl={directory ? null : (branding.data?.logo_url ?? null)}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 md:px-6 md:py-12">
        <form
          onSubmit={submit}
          noValidate
          className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-page-title font-bold text-text">Đăng nhập hệ thống</h1>
            <p className="text-label text-text-secondary">{page?.subtitle ?? 'Cổng quản trị School Management'}</p>
          </div>
          {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
          {directory || schoolName ? (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-label font-semibold text-text">Thông tin đơn vị</legend>
              {directory ? (
                <>
                  <SearchSelect
                    label="Sở GD&ĐT"
                    required
                    value={selection.department}
                    onChange={(department) => select({ department, commune: null, level: null, unit: null })}
                    load={(query) =>
                      Promise.resolve(
                        filterLocal(
                          (departments.data?.items ?? []).map((item) => ({
                            code: item.code,
                            label: `Sở GD&ĐT ${item.name}`,
                          })),
                          query,
                        ),
                      )
                    }
                    reloadKey={String(departments.data?.items.length ?? 0)}
                    placeholder="Gõ để tìm tỉnh, thành phố"
                  />
                  {/* Thứ tự Sở → Phường/Xã → Cấp học → Trường (YCTD-310): mỗi ô mở khi đã chọn ô trước, đổi ô trước thì xóa ô sau */}
                  <SearchSelect
                    label="Phường/Xã"
                    required
                    disabled={!selection.department}
                    value={selection.commune}
                    onChange={(commune) => select({ commune, level: null, unit: null })}
                    load={async (query, offset) => {
                      const result = await listCommunes(departmentCode, query, offset);
                      const items = result.items.map((item) => ({ code: item.code, label: item.name }));
                      const showAll = offset === 0 && filterLocal([ALL_COMMUNES], query).items.length > 0;
                      return { items: showAll ? [ALL_COMMUNES, ...items] : items, has_more: result.has_more };
                    }}
                    reloadKey={departmentCode}
                    placeholder="Gõ để tìm phường, xã"
                  />
                  <SearchSelect
                    label="Cấp học"
                    required
                    disabled={!selection.commune}
                    value={selection.level}
                    onChange={(level) => select({ level, unit: null })}
                    load={async (query) => {
                      const result = await listLevels({ department: departmentCode, commune: communeCode });
                      return filterLocal(
                        result.items.map((item) => ({ code: item.code, label: item.name })),
                        query,
                      );
                    }}
                    reloadKey={`${departmentCode}|${selection.commune?.code ?? ''}`}
                  />
                  <SearchSelect
                    label="Trường"
                    required
                    disabled={!selection.department || !selection.commune || !selection.level}
                    value={selection.unit}
                    onChange={(unit) => select({ unit })}
                    load={async (query, offset) => {
                      const result = await listUnits(
                        { department: departmentCode, level: selection.level?.code ?? null, commune: communeCode },
                        query,
                        offset,
                      );
                      return {
                        items: result.items.map((item) => ({
                          code: item.moet_code,
                          label: item.name,
                          hint: [`Mã ${item.moet_code}`, item.commune_name].filter(Boolean).join(' · '),
                        })),
                        has_more: result.has_more,
                      };
                    }}
                    reloadKey={`${departmentCode}|${selection.commune?.code ?? ''}|${selection.level?.code ?? ''}`}
                    placeholder="Gõ tên hoặc mã trường"
                    error={fieldErrors.unit || undefined}
                  />
                  {unitDetail.data && !unitDetail.data.available ? (
                    <Alert tone="warning">{unitDetail.data.message}</Alert>
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg bg-selected px-3 py-2" data-testid="login-school">
                  {schoolUnit?.department_name ? (
                    <p className="text-label text-text-secondary">Sở GD&ĐT {schoolUnit.department_name}</p>
                  ) : null}
                  <p className="text-content font-semibold text-text">{schoolName}</p>
                  <p className="text-label text-text-secondary">
                    {schoolUnit?.levels.length
                      ? `Cấp ${schoolUnit.levels.map((level) => LEVEL_NAMES[level] ?? level).join(', ')} · `
                      : null}
                    {schoolUnit?.moet_code ? `Mã Bộ: ${schoolUnit.moet_code}` : null}
                    {!schoolUnit?.moet_code && info.data?.school_code ? `Mã trường: ${info.data.school_code}` : null}
                    {info.data?.academic_year ? ` · Năm học ${info.data.academic_year}` : null}
                  </p>
                </div>
              )}
            </fieldset>
          ) : null}
          <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-3">
            <legend className="px-1 text-label font-semibold text-text">Thông tin tài khoản</legend>
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
            {otpRequired ? (
              <TextField
                label="Mã xác thực hai lớp (hoặc mã khôi phục)"
                name="otp_code"
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                error={fieldErrors.otp_code}
              />
            ) : null}
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
              {directory ? (
                forgotHost ? (
                  <a
                    href={schoolPageUrl(forgotHost, '/forgot-password')}
                    className="text-label font-medium text-link hover:underline inline-flex min-h-11 items-center"
                  >
                    Quên mật khẩu?
                  </a>
                ) : (
                  <span className="text-label text-text-secondary">Quên mật khẩu? Chọn trường trước</span>
                )
              ) : (
                <Link
                  to="/forgot-password"
                  className="text-label font-medium text-link hover:underline inline-flex min-h-11 items-center"
                >
                  Quên mật khẩu?
                </Link>
              )}
            </div>
          </fieldset>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <ExternalLoginProviders
            mode={directory ? 'directory' : context.mode === 'school' ? 'school' : 'single'}
            unitCode={unitReady ? unitCode : null}
          />
        </form>
        {directory ? null : <DemoRolePicker />}
        {/* Hỗ trợ (đường dây nóng, dòng hỗ trợ của tên miền chung) đặt dưới khung đăng nhập như dòng "Cần hỗ trợ?" của mẫu */}
        <footer className="flex w-full max-w-md flex-col items-center gap-1 text-center">
          {page?.support_lines.map((line) => (
            <p key={line} className="text-label text-text-secondary" data-testid="login-support-line">
              {line}
            </p>
          ))}
          {options.data?.hotline ? (
            <p className="text-label text-text-secondary" data-testid="login-hotline">
              Đường dây nóng hỗ trợ: <span className="font-semibold text-text">{options.data.hotline}</span>
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

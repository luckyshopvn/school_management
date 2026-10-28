import { useEffect, useState, type FormEvent } from 'react';
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
  prepareUnit,
  readLoginContext,
  readUnit,
  schoolPageUrl,
  type LoginContext,
} from '../portal-shell/unit-directory-api.js';
import { DemoRolePicker } from '../administration/DemoRolePicker.js';
import { ExternalLoginProviders } from '../portal-shell/ExternalLoginProviders.js';

// MH-47 Đăng nhập; thông báo lỗi lấy nguyên từ máy chủ. Theo trang đăng nhập của Sở (DT-16 phần 16c): tên và mã trường,
// năm học đang dùng, ghi nhớ tài khoản, mã xác nhận dạng ảnh có nút làm mới (hiện khi cấu hình luôn hiện hoặc sau lần nhập sai đầu
// tiên; máy chủ bắt buộc sau số lần sai cấu hình), quên mật khẩu, đường dây nóng.
// Bố cục theo ảnh mẫu của Eric (YCTD-310): một thẻ trắng giữa nền xanh nhạt có chấm, tiêu đề "Đăng nhập hệ thống", hai mục THÔNG TIN
// ĐƠN VỊ và THÔNG TIN TÀI KHOẢN; ô tài khoản dùng chữ gợi ý, nhãn vẫn có cho trình đọc màn hình (ngoại lệ TD-02 của trang này); dưới cùng
// Ghi nhớ, Quên Mật Khẩu?, nút Đăng nhập toàn chiều rộng. Không dùng tên, biểu trưng của cơ quan nhà nước: tiêu đề, biểu trưng lấy từ
// cấu hình thương hiệu của trường (S3) hoặc của nền tảng.
// - Tên miền chung của nền tảng (DT-24): Sở Giáo dục và Đào tạo → Cấp và Phường / Xã (lọc, không bắt buộc) → Trường; cấp học chỉ hiện
//   cấp có trường trong sở (và phường nếu chọn); đăng nhập đúng thì sang tên miền của trường bằng mã chuyển phiên một lần. Mọi đơn vị
//   trong danh mục đều mở (YCTD-314): đơn vị chưa có trường thì khởi tạo ở lần chọn đầu tiên, trang hiện "Đang khởi tạo đơn vị" và hỏi
//   lại tới khi sẵn sàng; chỉ trường đang tạm ngưng mới báo không đăng nhập được. Mã xác nhận luôn hiện.
// - Tên miền của trường và chế độ một trường: mục THÔNG TIN ĐƠN VỊ chỉ đọc, khóa vào trường của tên miền; mã xác nhận hiện theo cấu hình
//   hoặc sau lần nhập sai đầu tiên như cũ.
// - Ghi nhớ: nhớ đơn vị đã chọn và tên đăng nhập ở máy (localStorage), máy chủ giữ phiên lâu (PORTAL_REMEMBER_DAYS) với cookie bền; không
//   tích thì phiên hết khi đóng trình duyệt. Mật khẩu không bao giờ lưu ở trang: trình quản lý mật khẩu của trình duyệt đề nghị lưu nhờ
//   biểu mẫu thật có autocomplete username, current-password.
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
// Lựa chọn đầu của ô Phường / Xã (không bắt buộc): bỏ lọc theo phường sau khi đã chọn một phường
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
    return value && typeof value === 'object' ? { ...EMPTY_UNIT, ...value } : EMPTY_UNIT;
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
    // Đang khởi tạo: hỏi lại mỗi 2 giây tới khi trường sẵn sàng
    refetchInterval: (query) =>
      query.state.data?.state === 'provisioning' || query.state.data?.state === 'not_provisioned' ? 2000 : false,
  });
  const unitState = unitDetail.data?.state;
  const [prepareError, setPrepareError] = useState<string>();
  // Lần chọn đầu tiên một đơn vị chưa có trường: nhờ máy chủ khởi tạo (chạy nền), trang chờ ở trạng thái "đang khởi tạo"
  useEffect(() => {
    if (!directory || unitState !== 'not_provisioned' || !unitCode) {
      return;
    }
    setPrepareError(undefined);
    prepareUnit(unitCode)
      .then(() => unitDetail.refetch())
      .catch((error: unknown) =>
        setPrepareError(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'),
      );
  }, [directory, unitCode, unitState]);
  const unitPreparing = directory && (unitState === 'not_provisioned' || unitState === 'provisioning') && !prepareError;
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
      setFieldErrors({
        unit: !selection.unit
          ? 'Chọn trường'
          : unitPreparing
            ? 'Đơn vị đang được khởi tạo, vui lòng chờ trong giây lát'
            : (unitDetail.data?.message ?? prepareError ?? 'Đơn vị chưa sẵn sàng'),
      });
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
          ...(rememberLogin ? { remember: true } : {}),
        });
        store(REMEMBERED_LOGIN_KEY, rememberLogin ? loginIdentifier.trim() : null);
        store(REMEMBERED_UNIT_KEY, rememberLogin ? JSON.stringify(selection) : null);
        window.location.assign(handoffUrl(reply));
        return;
      }
      await session.login(
        loginIdentifier.trim(),
        password,
        captcha.answer,
        otpRequired ? otpCode.trim() : undefined,
        rememberLogin,
      );
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
  const logoUrl = directory ? null : (branding.data?.logo_url ?? null);
  const forgotHost = unitDetail.data?.login_host ?? null;
  const forgotClass = 'inline-flex min-h-11 items-center text-label font-semibold text-link hover:underline';
  return (
    <main
      className="touch-layout flex min-h-screen flex-col items-center justify-center gap-4 bg-selected px-4 py-8"
      style={DOTTED_BACKGROUND}
    >
      {/* Tên hệ thống, trường từ cấu hình (giữ mã kiểm thử login-title); không dùng biểu trưng cơ quan nhà nước */}
      <header className="flex items-center gap-3">
        {logoUrl ? <img src={logoUrl} alt="Biểu trưng" className="h-10 w-10 rounded object-contain" /> : null}
        <div className="flex flex-col text-center">
          {schoolUnit?.department_name ? (
            <span className="text-label text-text-secondary">Sở GD&ĐT {schoolUnit.department_name}</span>
          ) : null}
          <p className="text-content font-semibold text-brand-strong" data-testid="login-title">
            {title}
          </p>
        </div>
      </header>
      <form
        onSubmit={submit}
        noValidate
        method="post"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl bg-card p-5 shadow-lg ring-1 ring-border sm:p-6"
      >
        <h1 className="text-center text-page-title font-bold text-text">Đăng nhập hệ thống</h1>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {directory || schoolName ? (
          <fieldset className="flex min-w-0 flex-col gap-3">
            <SectionLegend>Thông tin đơn vị</SectionLegend>
            {directory ? (
              <>
                <SearchSelect
                  label="Sở Giáo dục và Đào tạo"
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
                  placeholder="Chọn sở"
                />
                {/* Cấp và Phường / Xã cùng hàng (điện thoại xếp dọc); phường chỉ để lọc danh sách trường */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <SearchSelect
                    label="Cấp"
                    required
                    disabled={!selection.department}
                    value={selection.level}
                    onChange={(level) => select({ level, unit: null })}
                    load={async (query) => {
                      const result = await listLevels({ department: departmentCode, commune: communeCode });
                      return filterLocal(
                        result.items.map((item) => ({ code: item.code, label: item.name })),
                        query,
                      );
                    }}
                    reloadKey={`${departmentCode}|${communeCode ?? ''}`}
                    placeholder="Chọn cấp"
                  />
                  <SearchSelect
                    label="Phường / Xã"
                    disabled={!selection.department}
                    value={selection.commune}
                    onChange={(commune) => select({ commune, unit: null })}
                    load={async (query, offset) => {
                      const result = await listCommunes(departmentCode, query, offset);
                      const items = result.items.map((item) => ({ code: item.code, label: item.name }));
                      const showAll = offset === 0 && filterLocal([ALL_COMMUNES], query).items.length > 0;
                      return { items: showAll ? [ALL_COMMUNES, ...items] : items, has_more: result.has_more };
                    }}
                    reloadKey={departmentCode}
                    placeholder="Chọn Phường/Xã"
                  />
                </div>
                <SearchSelect
                  label="Trường"
                  required
                  disabled={!selection.department || !selection.level}
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
                  reloadKey={`${departmentCode}|${communeCode ?? ''}|${selection.level?.code ?? ''}`}
                  placeholder="Chọn trường"
                  error={fieldErrors.unit || undefined}
                />
                {unitPreparing ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-label text-text-muted"
                    data-testid="unit-preparing"
                  >
                    Đang khởi tạo đơn vị trên hệ thống, vui lòng chờ trong giây lát…
                  </p>
                ) : null}
                {prepareError ? <Alert tone="warning">{prepareError}</Alert> : null}
                {unitDetail.data?.message ? <Alert tone="warning">{unitDetail.data.message}</Alert> : null}
              </>
            ) : (
              <div className="rounded-lg border border-border bg-page px-3 py-2" data-testid="login-school">
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
        {directory || schoolName ? <hr className="border-border" /> : null}
        <fieldset className="flex min-w-0 flex-col gap-3">
          <SectionLegend>Thông tin tài khoản</SectionLegend>
          <TextField
            label="Số điện thoại hoặc tên đăng nhập"
            hideLabel
            placeholder="Tên đăng nhập"
            name="username"
            autoComplete="username"
            inputClassName={FILLED_INPUT}
            value={loginIdentifier}
            onChange={(event) => setLoginIdentifier(event.target.value)}
            error={fieldErrors.login}
          />
          <TextField
            label="Mật khẩu"
            hideLabel
            placeholder="Mật khẩu"
            name="password"
            type="password"
            autoComplete="current-password"
            inputClassName={FILLED_INPUT}
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
              inputClassName={FILLED_INPUT}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              error={fieldErrors.otp_code}
            />
          ) : null}
          {/* Tên miền chung: hàng mã xác nhận luôn có như mẫu, ảnh của đúng trường hiện khi đã chọn trường */}
          {captchaShown || directory ? <CaptchaField captcha={captcha} error={fieldErrors.captcha} compact /> : null}
        </fieldset>
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap text-label text-text">
            <input
              type="checkbox"
              aria-label="Ghi nhớ tài khoản"
              className="h-4 w-4 accent-brand"
              checked={rememberLogin}
              onChange={(event) => setRememberLogin(event.target.checked)}
            />
            Ghi nhớ
          </label>
          {directory ? (
            forgotHost ? (
              <a href={schoolPageUrl(forgotHost, '/forgot-password')} className={forgotClass}>
                Quên Mật Khẩu?
              </a>
            ) : (
              <span className="text-right text-label text-text-secondary">Quên Mật Khẩu? Chọn trường trước</span>
            )
          ) : (
            <Link to="/forgot-password" className={forgotClass}>
              Quên Mật Khẩu?
            </Link>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
        <ExternalLoginProviders
          mode={directory ? 'directory' : context.mode === 'school' ? 'school' : 'single'}
          unitCode={unitReady ? unitCode : null}
        />
      </form>
      {directory ? null : <DemoRolePicker />}
      {/* Hỗ trợ (đường dây nóng, dòng hỗ trợ của tên miền chung) dưới khung đăng nhập */}
      <footer className="flex w-full max-w-[440px] flex-col items-center gap-1 text-center">
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
    </main>
  );
}

// Nền xanh nhạt có chấm của mẫu; màu chấm lấy từ token viền
const DOTTED_BACKGROUND = {
  backgroundImage: 'radial-gradient(var(--color-border-strong) 1.5px, transparent 1.5px)',
  backgroundSize: '18px 18px',
};

// Ô nhập nền xám như mẫu; chữ gợi ý màu chữ phụ (tương phản trên 4.5:1 với nền xám)
const FILLED_INPUT = 'bg-page placeholder:text-text-secondary focus:bg-card';

// Tiêu đề mục: chữ hoa xanh, vạch dọc bên trái
function SectionLegend({ children }: { children: string }) {
  return (
    <legend className="mb-1 flex items-center gap-2 text-label font-bold uppercase tracking-wide text-link">
      <span className="h-3.5 w-1 rounded-sm bg-brand" aria-hidden="true" />
      {children}
    </legend>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  PlatformValidationError,
  schoolsApi,
  type FieldProblem,
  type PlatformSettings,
  type ProvisionReply,
  type SchoolDetail,
  type SchoolSummary,
} from './platform-api.js';

// Trang Trường của cổng vận hành nền tảng (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.5): danh sách, bước setup năm bước,
// chi tiết và thao tác vòng đời. Hồ sơ đồng ý dùng dữ liệu thật (PL-00 của S8a) nhập ở bước 3 khi chọn loại dữ liệu `consented`
const STATUS_LABELS: Record<string, string> = {
  provisioning: 'Đang khởi tạo',
  trial: 'Dùng thử',
  active: 'Hoạt động',
  read_only: 'Chỉ đọc',
  suspended: 'Tạm dừng',
  pending_deletion: 'Chờ xóa',
  deleted: 'Đã xóa',
};
const DATA_CLASS_LABELS: Record<string, string> = {
  synthetic: 'Dữ liệu giả',
  consented: 'Dữ liệu thật có đồng ý',
  production: 'Vận hành chính thức',
};
const LEVELS = [
  { code: 'MN', label: 'Mầm non' },
  { code: 'TH', label: 'Tiểu học' },
  { code: 'THCS', label: 'Trung học cơ sở' },
  { code: 'THPT', label: 'Trung học phổ thông' },
];
const CONSENT_KINDS = [
  { kind: 'dpa', label: 'Thỏa thuận xử lý dữ liệu (PL-01)', template: 'PL-01' },
  { kind: 'consent', label: 'Văn bản đồng ý (PL-02)', template: 'PL-02' },
  { kind: 'impact-assessment', label: 'Đánh giá tác động (PL-03)', template: 'PL-03' },
  { kind: 'risk-acceptance', label: 'Chấp nhận rủi ro (PL-06)', template: 'PL-06' },
];
const STEPS = ['Thông tin trường', 'Tên miền', 'Loại dữ liệu', 'Quản trị viên', 'Điều khoản và xác nhận'];

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Không thực hiện được, vui lòng thử lại';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ConsentDraft {
  enabled: boolean;
  signer_name: string;
  signer_title: string;
  signed_on: string;
  valid_until: string;
  file_sha256: string;
}

function SetupWizard({
  token,
  settings,
  onDone,
  onCancel,
}: {
  token: string;
  settings: PlatformSettings | null;
  onDone: (reply: ProvisionReply) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [levels, setLevels] = useState<string[]>([]);
  const [firstYear, setFirstYear] = useState(String(new Date().getFullYear()));
  const [domainMode, setDomainMode] = useState<'system' | 'custom'>(settings?.system_domain ? 'system' : 'custom');
  const [customHost, setCustomHost] = useState('');
  const [dataClass, setDataClass] = useState('synthetic');
  const [consents, setConsents] = useState<Record<string, ConsentDraft>>(() =>
    Object.fromEntries(
      CONSENT_KINDS.map((item) => [
        item.kind,
        { enabled: true, signer_name: '', signer_title: '', signed_on: today(), valid_until: '', file_sha256: '' },
      ]),
    ),
  );
  const [dataScope, setDataScope] = useState('');
  const [hosting, setHosting] = useState({ provider: '', service: '', region: '' });
  const [adminName, setAdminName] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [termsVersion, setTermsVersion] = useState('PL-04 v1');
  const [termsBy, setTermsBy] = useState('');
  const [termsTitle, setTermsTitle] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function input() {
    return {
      code: code.trim(),
      name: name.trim(),
      address: address.trim() || null,
      levels,
      first_year_start: firstYear ? Number(firstYear) : null,
      domain: domainMode === 'system' ? { mode: 'system' } : { mode: 'custom', host: customHost.trim() },
      data_class: dataClass,
      ...(dataClass === 'consented'
        ? {
            consents: CONSENT_KINDS.map((item) => {
              const draft = consents[item.kind] as ConsentDraft;
              return {
                kind: item.kind,
                template_code: item.template,
                template_version: '1.0',
                signer_name: draft.signer_name.trim(),
                signer_title: draft.signer_title.trim(),
                signed_on: draft.signed_on,
                valid_from: draft.signed_on,
                valid_until: draft.valid_until || null,
                data_scope: dataScope.trim(),
                file_sha256: draft.file_sha256.trim().toLowerCase(),
              };
            }),
            hosting: [{ ...hosting, started_on: today() }],
          }
        : {}),
      admin: { full_name: adminName.trim(), login: adminLogin.trim(), phone: adminPhone.trim() || null },
      terms: {
        version: termsVersion.trim(),
        accepted,
        accepted_by_name: termsBy.trim(),
        accepted_by_title: termsTitle.trim() || null,
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      onDone(await schoolsApi.provision(token, input()));
    } catch (caught) {
      setError(messageOf(caught));
      if (caught instanceof PlatformValidationError) {
        setProblems(caught.problems);
      }
    } finally {
      setBusy(false);
    }
  }

  const updateConsent = (kind: string, patch: Partial<ConsentDraft>) =>
    setConsents((current) => ({ ...current, [kind]: { ...(current[kind] as ConsentDraft), ...patch } }));

  return (
    <form className="wizard" onSubmit={(event) => void submit(event)} aria-label="Khởi tạo trường">
      <h2>Khởi tạo trường mới</h2>
      <ol className="steps">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined}>
            <button type="button" onClick={() => setStep(index)}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <fieldset>
          <legend>Thông tin trường</legend>
          <label>
            Mã trường
            <input value={code} onChange={(event) => setCode(event.target.value.toLowerCase())} required />
            <small>3 đến 32 ký tự chữ thường, số, gạch ngang; dùng làm tên miền con và tên cơ sở dữ liệu</small>
          </label>
          <label>
            Tên trường
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Địa chỉ
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <div role="group" aria-label="Cấp học">
            {LEVELS.map((level) => (
              <label key={level.code} className="inline">
                <input
                  type="checkbox"
                  checked={levels.includes(level.code)}
                  onChange={(event) =>
                    setLevels(
                      event.target.checked ? [...levels, level.code] : levels.filter((item) => item !== level.code),
                    )
                  }
                />
                {level.label}
              </label>
            ))}
          </div>
          <label>
            Năm học đầu (năm bắt đầu)
            <input
              type="number"
              value={firstYear}
              onChange={(event) => setFirstYear(event.target.value)}
              min={2020}
              max={2100}
            />
          </label>
        </fieldset>
      ) : null}
      {step === 1 ? (
        <fieldset>
          <legend>Tên miền</legend>
          <label className="inline">
            <input
              type="radio"
              name="domain"
              checked={domainMode === 'system'}
              disabled={!settings?.system_domain}
              onChange={() => setDomainMode('system')}
            />
            Tên miền hệ thống: {code || '<mã>'}.{settings?.system_domain ?? '(chưa cấu hình)'}
          </label>
          <label className="inline">
            <input
              type="radio"
              name="domain"
              checked={domainMode === 'custom'}
              onChange={() => setDomainMode('custom')}
            />
            Tên miền riêng của trường
          </label>
          {domainMode === 'custom' ? (
            <label>
              Tên miền riêng
              <input value={customHost} onChange={(event) => setCustomHost(event.target.value)} />
              <small>
                Sau khi khởi tạo, trỏ CNAME về {settings?.ingress_host ?? 'địa chỉ vào của nền tảng'} và thêm bản ghi
                TXT xác nhận rồi bấm Kiểm tra ở trang chi tiết
              </small>
            </label>
          ) : null}
        </fieldset>
      ) : null}
      {step === 2 ? (
        <fieldset>
          <legend>Loại dữ liệu</legend>
          {Object.entries(DATA_CLASS_LABELS).map(([value, label]) => (
            <label key={value} className="inline">
              <input
                type="radio"
                name="data_class"
                checked={dataClass === value}
                onChange={() => setDataClass(value)}
              />
              {label}
            </label>
          ))}
          {dataClass === 'consented' ? (
            <div className="consents">
              <p>Dữ liệu thật cần đủ bốn hồ sơ còn hiệu lực và bản ghi vùng máy chủ (tài liệu 33, PL-00).</p>
              <label>
                Phạm vi dữ liệu
                <input value={dataScope} onChange={(event) => setDataScope(event.target.value)} />
              </label>
              {CONSENT_KINDS.map((item) => {
                const draft = consents[item.kind] as ConsentDraft;
                return (
                  <fieldset key={item.kind}>
                    <legend>{item.label}</legend>
                    <label>
                      Người ký
                      <input
                        value={draft.signer_name}
                        onChange={(event) => updateConsent(item.kind, { signer_name: event.target.value })}
                      />
                    </label>
                    <label>
                      Chức vụ
                      <input
                        value={draft.signer_title}
                        onChange={(event) => updateConsent(item.kind, { signer_title: event.target.value })}
                      />
                    </label>
                    <label>
                      Ngày ký
                      <input
                        type="date"
                        value={draft.signed_on}
                        onChange={(event) => updateConsent(item.kind, { signed_on: event.target.value })}
                      />
                    </label>
                    <label>
                      Hiệu lực đến
                      <input
                        type="date"
                        value={draft.valid_until}
                        onChange={(event) => updateConsent(item.kind, { valid_until: event.target.value })}
                      />
                    </label>
                    <label>
                      Mã băm SHA-256 của bản quét
                      <input
                        value={draft.file_sha256}
                        onChange={(event) => updateConsent(item.kind, { file_sha256: event.target.value })}
                      />
                    </label>
                  </fieldset>
                );
              })}
              <fieldset>
                <legend>Vùng máy chủ, bên xử lý phụ (PL-08)</legend>
                {(['provider', 'service', 'region'] as const).map((field) => (
                  <label key={field}>
                    {field === 'provider' ? 'Nhà cung cấp' : field === 'service' ? 'Dịch vụ' : 'Vùng'}
                    <input
                      value={hosting[field]}
                      onChange={(event) => setHosting({ ...hosting, [field]: event.target.value })}
                    />
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {step === 3 ? (
        <fieldset>
          <legend>Quản trị viên đầu tiên (Hiệu trưởng)</legend>
          <label>
            Họ tên
            <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
          </label>
          <label>
            Tên đăng nhập
            <input value={adminLogin} onChange={(event) => setAdminLogin(event.target.value.toLowerCase())} required />
          </label>
          <label>
            Số điện thoại
            <input value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} />
          </label>
          <small>
            Quản trị viên nhận đường liên kết kích hoạt một lần (hạn 72 giờ) và tự đặt mật khẩu; không gửi mật khẩu
          </small>
        </fieldset>
      ) : null}
      {step === 4 ? (
        <fieldset>
          <legend>Điều khoản và xác nhận</legend>
          <label>
            Phiên bản điều khoản
            <input value={termsVersion} onChange={(event) => setTermsVersion(event.target.value)} />
          </label>
          <label>
            Người đồng ý thay mặt trường
            <input value={termsBy} onChange={(event) => setTermsBy(event.target.value)} />
          </label>
          <label>
            Chức vụ
            <input value={termsTitle} onChange={(event) => setTermsTitle(event.target.value)} />
          </label>
          <label className="inline">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            Trường đã đồng ý điều khoản sử dụng
          </label>
          <p>
            Trường {code || '<mã>'}: {name || '<tên>'}; cấp học {levels.join(', ') || '(chưa chọn)'};{' '}
            {DATA_CLASS_LABELS[dataClass]}
          </p>
        </fieldset>
      ) : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          {problems.length > 0 ? (
            <ul>
              {problems.map((problem) => (
                <li key={`${problem.field}-${problem.message}`}>
                  {problem.field}: {problem.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="actions">
        <button type="button" onClick={onCancel}>
          Hủy
        </button>
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)}>
            Quay lại
          </button>
        ) : null}
        <button type="submit" disabled={busy}>
          {step < STEPS.length - 1 ? 'Tiếp' : busy ? 'Đang khởi tạo...' : 'Khởi tạo trường'}
        </button>
      </div>
    </form>
  );
}

function ActivationNotice({ reply }: { reply: ProvisionReply }) {
  const link = reply.activation
    ? reply.activation.host
      ? `${window.location.protocol}//${reply.activation.host}${window.location.port ? `:${window.location.port}` : ''}${reply.activation.path}`
      : reply.activation.path
    : null;
  return (
    <section className="notice" aria-label="Kết quả khởi tạo">
      <p>
        Việc khởi tạo: <strong>{reply.status === 'done' ? 'Hoàn tất' : 'Lỗi'}</strong>
        {reply.error ? ` (${reply.error})` : ''}
      </p>
      {link ? (
        <p>
          Đường kích hoạt quản trị viên (chỉ hiện một lần): <code data-testid="activation-link">{link}</code>
        </p>
      ) : null}
    </section>
  );
}

function SchoolDetailView({ token, code, onBack }: { token: string; code: string; onBack: () => void }) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [host, setHost] = useState('');

  const load = useCallback(() => {
    schoolsApi
      .detail(token, code)
      .then(setDetail)
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token, code]);

  useEffect(load, [load]);

  async function act(work: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await work();
      setNotice(done);
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  if (!detail) {
    return error ? <p role="alert">{error}</p> : <p>Đang tải...</p>;
  }
  const status = detail.status;
  const failedJob = detail.jobs.find((job) => job.status === 'failed');
  const pendingInvitation = detail.invitations[0] && !detail.invitations[0].used_at;

  return (
    <section aria-label={`Trường ${detail.code}`}>
      <button type="button" onClick={onBack}>
        ← Danh sách trường
      </button>
      <h2>
        {detail.name} ({detail.code})
      </h2>
      <dl className="facts">
        <dt>Trạng thái</dt>
        <dd data-testid="school-status">{STATUS_LABELS[status] ?? status}</dd>
        <dt>Loại dữ liệu</dt>
        <dd>{DATA_CLASS_LABELS[detail.data_class] ?? detail.data_class}</dd>
        <dt>Cấp học</dt>
        <dd>{detail.school_levels.join(', ')}</dd>
        <dt>Năm học đầu</dt>
        <dd>{detail.first_academic_year ?? '—'}</dd>
        {detail.delete_after ? (
          <>
            <dt>Xóa vĩnh viễn sau</dt>
            <dd>{new Date(detail.delete_after).toLocaleString('vi-VN')}</dd>
          </>
        ) : null}
      </dl>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!detail.legacy && status !== 'deleted' ? (
        <div className="actions">
          <label>
            Lý do
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {['trial', 'active', 'read_only'].includes(status) ? (
            <button
              type="button"
              onClick={() =>
                void act(() => schoolsApi.changeStatus(token, code, 'suspend', reason), 'Đã tạm dừng trường')
              }
            >
              Tạm dừng
            </button>
          ) : null}
          {status === 'suspended' ? (
            <button
              type="button"
              onClick={() => void act(() => schoolsApi.changeStatus(token, code, 'resume', reason), 'Đã mở lại trường')}
            >
              Mở lại
            </button>
          ) : null}
          {['trial', 'active', 'read_only', 'suspended'].includes(status) ? (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm('Yêu cầu xóa trường? Trường ngừng phục vụ ngay và bị xóa vĩnh viễn sau thời gian chờ.')
                ) {
                  void act(
                    () => schoolsApi.changeStatus(token, code, 'request-deletion', reason),
                    'Đã yêu cầu xóa trường',
                  );
                }
              }}
            >
              Yêu cầu xóa
            </button>
          ) : null}
          {status === 'pending_deletion' ? (
            <button
              type="button"
              onClick={() =>
                void act(() => schoolsApi.changeStatus(token, code, 'cancel-deletion', reason), 'Đã hủy yêu cầu xóa')
              }
            >
              Hủy yêu cầu xóa
            </button>
          ) : null}
          {pendingInvitation ? (
            <button
              type="button"
              onClick={() =>
                void act(async () => {
                  const reply = await schoolsApi.reissue(token, code);
                  window.prompt('Đường kích hoạt mới (chỉ hiện một lần)', reply.activation.path);
                }, 'Đã cấp lại đường kích hoạt')
              }
            >
              Cấp lại đường kích hoạt
            </button>
          ) : null}
          {failedJob ? (
            <>
              <button
                type="button"
                onClick={() => void act(() => schoolsApi.resumeJob(token, failedJob.id), 'Đã chạy tiếp việc khởi tạo')}
              >
                Chạy tiếp khởi tạo
              </button>
              <button
                type="button"
                onClick={() =>
                  void act(() => schoolsApi.rollbackJob(token, failedJob.id).then(onBack), 'Đã hoàn tác khởi tạo')
                }
              >
                Hoàn tác khởi tạo
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <h3>Tên miền</h3>
      <table>
        <thead>
          <tr>
            <th>Tên miền</th>
            <th>Loại</th>
            <th>Trạng thái</th>
            <th>Cấu hình DNS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {detail.domains.map((domain) => (
            <tr key={domain.host}>
              <td>{domain.host}</td>
              <td>{domain.kind === 'custom' ? 'Riêng' : 'Hệ thống'}</td>
              <td>{domain.status}</td>
              <td>
                {domain.kind === 'custom' ? (
                  <small>
                    CNAME → {domain.cname_target ?? '—'}; TXT _school-verify.{domain.host} = {domain.verification_token}
                    {domain.check_error ? ` (${domain.check_error})` : ''}
                  </small>
                ) : null}
              </td>
              <td>
                {domain.kind === 'custom' && domain.status !== 'active' ? (
                  <button
                    type="button"
                    onClick={() =>
                      void act(() => schoolsApi.verifyDomain(token, code, domain.host), 'Đã kiểm tra tên miền')
                    }
                  >
                    Kiểm tra
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {status !== 'deleted' ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() => schoolsApi.addDomain(token, code, host), 'Đã thêm tên miền riêng, chờ kiểm tra DNS');
          }}
        >
          <label>
            Thêm tên miền riêng
            <input value={host} onChange={(event) => setHost(event.target.value)} />
          </label>
          <button type="submit">Thêm</button>
        </form>
      ) : null}
      <h3>Hồ sơ đồng ý và vùng máy chủ</h3>
      <ul>
        {detail.consents.map((consent) => (
          <li key={consent.id}>
            {consent.kind} ({consent.template_code}), {consent.signer_name}, hiệu lực từ{' '}
            {consent.valid_from.slice(0, 10)}
            {consent.valid_until ? ` đến ${consent.valid_until.slice(0, 10)}` : ''}
          </li>
        ))}
        {detail.hosting.map((item) => (
          <li key={item.id}>
            {item.provider}, {item.service}, {item.region} ({item.role})
          </li>
        ))}
        {detail.consents.length + detail.hosting.length === 0 ? <li>Chưa có</li> : null}
      </ul>
      <h3>Nhật ký vòng đời</h3>
      <ul>
        {detail.events.map((event) => (
          <li key={event.id}>
            {new Date(event.at).toLocaleString('vi-VN')}: {event.event}
            {event.reason ? ` (${event.reason})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SchoolsPage({ token }: { token: string }) {
  const [view, setView] = useState<'list' | 'setup' | { code: string }>('list');
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProvision, setLastProvision] = useState<ProvisionReply | null>(null);

  const load = useCallback(() => {
    schoolsApi
      .list(token)
      .then((result) => setSchools(result.items))
      .catch((caught: unknown) => setError(messageOf(caught)));
    schoolsApi
      .settings(token)
      .then(setSettings)
      .catch(() => setSettings(null));
  }, [token]);

  useEffect(load, [load]);

  if (view === 'setup') {
    return (
      <SetupWizard
        token={token}
        settings={settings}
        onCancel={() => setView('list')}
        onDone={(reply) => {
          setLastProvision(reply);
          setView('list');
          load();
        }}
      />
    );
  }
  if (typeof view === 'object') {
    return (
      <SchoolDetailView
        token={token}
        code={view.code}
        onBack={() => {
          setView('list');
          load();
        }}
      />
    );
  }
  return (
    <section aria-label="Danh sách trường">
      <h2>Trường</h2>
      {lastProvision ? <ActivationNotice reply={lastProvision} /> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => setView('setup')}>
        Khởi tạo trường mới
      </button>
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên trường</th>
            <th>Trạng thái</th>
            <th>Loại dữ liệu</th>
            <th>Tên miền</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => (
            <tr key={school.id}>
              <td>
                <button type="button" className="link" onClick={() => setView({ code: school.code })}>
                  {school.code}
                </button>
              </td>
              <td>{school.name}</td>
              <td>{STATUS_LABELS[school.status] ?? school.status}</td>
              <td>{DATA_CLASS_LABELS[school.data_class] ?? school.data_class}</td>
              <td>{school.domains.map((domain) => domain.host).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

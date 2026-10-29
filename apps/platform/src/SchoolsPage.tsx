import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  dashboardApi,
  PlatformValidationError,
  schoolsApi,
  type FieldProblem,
  type Operator,
  type PlatformSettings,
  type ProvisionReply,
  type SchoolDetail,
  type SchoolSummary,
} from './platform-api.js';
import { SupportPanel } from './SupportPanel.js';
import { CatalogUnitPicker } from './CatalogPage.js';
import { catalogApi } from './catalog-api.js';
import { SchoolDataGovernance } from './SchoolDataGovernance.js';
import { operatorCan } from '@school-management/shared';
import { AuditLogTable } from './AuditLogPage.js';
import { schoolStatusLabel } from './audit-api.js';
import { OpenSchoolButton, supportLink } from './OpenSchoolButton.js';

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
const BACKUP_KIND_LABELS: Record<string, string> = {
  backup: 'Sao lưu',
  restore: 'Khôi phục',
  drill: 'Diễn tập khôi phục',
  'cluster-move': 'Chuyển cụm',
};
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
  // Đơn vị chọn từ danh mục toàn quốc (DT-24): mã trường gợi ý theo mã Bộ
  const [moetCode, setMoetCode] = useState<string | null>(null);
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
      moet_code: moetCode,
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
          {moetCode ? (
            <p className="notice" data-testid="setup-moet-code">
              Đơn vị trong danh mục: mã Bộ {moetCode}{' '}
              <button type="button" className="link" onClick={() => setMoetCode(null)}>
                Bỏ chọn
              </button>
            </p>
          ) : (
            <CatalogUnitPicker
              token={token}
              onPick={(unit) => {
                setMoetCode(unit.moet_code);
                setName(unit.name);
                setLevels(LEVELS.filter((level) => unit.levels.includes(level.code)).map((level) => level.code));
                const suggested = unit.moet_code.toLowerCase();
                if (/^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/.test(suggested)) {
                  setCode(suggested);
                }
              }}
            />
          )}
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
          {settings && settings.data_policy !== 'any' ? (
            <p role="note">
              {settings.data_policy === 'synthetic-only'
                ? 'Môi trường thử nghiệm, máy chủ ngoài Việt Nam: chỉ nhận dữ liệu giả.'
                : 'Môi trường thử nghiệm, máy chủ ngoài Việt Nam: dữ liệu thật chỉ khi đủ hồ sơ đồng ý (PL-00, tài liệu 33); không nhận loại vận hành chính thức.'}
            </p>
          ) : null}
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

function SchoolDetailView({
  token,
  code,
  role,
  settings,
  onBack,
}: {
  token: string;
  code: string;
  role: Operator['role'] | undefined;
  settings: PlatformSettings | null;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [host, setHost] = useState('');
  // Thẻ của trang chi tiết trường theo thiết kế cổng vận hành (YCTD-324)
  const [tab, setTab] = useState<'overview' | 'features' | 'admins' | 'audit'>('overview');

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
        <dt>Mã Bộ (danh mục đơn vị)</dt>
        <dd data-testid="school-moet-code">
          {detail.moet_code ?? 'Chưa gắn'}
          {detail.moet_code ? (
            <>
              {' '}
              <button
                type="button"
                className="link"
                onClick={() => void act(() => catalogApi.linkSchool(token, code, null), 'Đã gỡ mã Bộ')}
              >
                Gỡ
              </button>
            </>
          ) : null}
        </dd>
        {detail.delete_after ? (
          <>
            <dt>Xóa vĩnh viễn sau</dt>
            <dd>{new Date(detail.delete_after).toLocaleString('vi-VN')}</dd>
          </>
        ) : null}
      </dl>
      {!detail.moet_code && status !== 'deleted' ? (
        <CatalogUnitPicker
          token={token}
          label="Gắn trường với đơn vị trong danh mục"
          onPick={(unit) =>
            void act(() => catalogApi.linkSchool(token, code, unit.moet_code), `Đã gắn mã Bộ ${unit.moet_code}`)
          }
        />
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div role="tablist" aria-label="Thông tin trường">
        {(
          [
            ['overview', 'Tổng quan'],
            ['features', 'Gói và tính năng'],
            ['admins', 'Tài khoản quản trị trường'],
            ...(role && operatorCan(role, 'audit.view') ? [['audit', 'Nhật ký truy cập']] : []),
          ] as Array<[typeof tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={'the-' + key}
            aria-selected={tab === key}
            aria-controls={'noi-dung-' + key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'features' ? (
        <div role="tabpanel" id="noi-dung-features" aria-labelledby="the-features">
          <SchoolFeatures token={token} code={code} detail={detail} role={role} act={act} />
        </div>
      ) : null}
      {tab === 'admins' ? (
        <div role="tabpanel" id="noi-dung-admins" aria-labelledby="the-admins">
          <SchoolAdmins token={token} code={code} role={role} />
        </div>
      ) : null}
      {tab === 'audit' ? (
        <div role="tabpanel" id="noi-dung-audit" aria-labelledby="the-audit">
          <AuditLogTable token={token} school={code} />
        </div>
      ) : null}
      {tab !== 'overview' ? null : (
        <div role="tabpanel" id="noi-dung-overview" aria-labelledby="the-overview">
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
                  onClick={() =>
                    void act(() => schoolsApi.changeStatus(token, code, 'resume', reason), 'Đã mở lại trường')
                  }
                >
                  Mở lại
                </button>
              ) : null}
              {['trial', 'active', 'read_only', 'suspended'].includes(status) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Yêu cầu xóa trường? Trường ngừng phục vụ ngay và bị xóa vĩnh viễn sau thời gian chờ.',
                      )
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
                    void act(
                      () => schoolsApi.changeStatus(token, code, 'cancel-deletion', reason),
                      'Đã hủy yêu cầu xóa',
                    )
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
                    onClick={() =>
                      void act(() => schoolsApi.resumeJob(token, failedJob.id), 'Đã chạy tiếp việc khởi tạo')
                    }
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
                        CNAME → {domain.cname_target ?? '—'};{' '}
                        {domain.provider === 'dns-check'
                          ? `TXT _school-verify.${domain.host} = ${domain.verification_token ?? ''}`
                          : `Xác nhận (${domain.provider}): ${domain.verification_token ?? '—'}`}
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
          <SchoolDataGovernance token={token} detail={detail} role={role} settings={settings} onChanged={setDetail} />
          <SupportPanel token={token} code={code} />
          <h3>Sao lưu và khôi phục</h3>
          {detail.backups.length === 0 ? (
            <p>Chưa có lần sao lưu nào (chạy theo lịch bằng lệnh platform backup-school)</p>
          ) : (
            <table aria-label="Sao lưu và khôi phục">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Việc</th>
                  <th>Kết quả</th>
                  <th>Số bảng, số dòng</th>
                  <th>Tệp, ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {detail.backups.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.started_at).toLocaleString('vi-VN')}</td>
                    <td>{BACKUP_KIND_LABELS[run.kind] ?? run.kind}</td>
                    <td>{run.status === 'done' ? 'Đạt' : run.status === 'failed' ? 'Lỗi' : 'Đang chạy'}</td>
                    <td>{run.tables !== null ? `${run.tables} bảng, ${run.rows ?? 0} dòng` : '—'}</td>
                    <td>
                      <small>
                        {run.error ??
                          [
                            run.file_name,
                            typeof run.details.duration_ms === 'number'
                              ? `${Math.round(run.details.duration_ms / 1000)} giây`
                              : null,
                          ]
                            .filter(Boolean)
                            .join('; ')}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3>Nhật ký vòng đời</h3>
          <ul>
            {detail.events.map((event) => (
              <li key={event.id}>
                {new Date(event.at).toLocaleString('vi-VN')}: {event.event}
                {event.reason ? ` (${event.reason})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Thẻ "Gói và tính năng" (YCTD-324): gói hiện hành, các phân hệ miễn phí, công tắc từng tính năng trả phí bật riêng cho trường
// (YCTD-314). Vai trò không được đổi tính năng chỉ xem
const FREE_FEATURES = [
  'Hồ sơ trường',
  'Cán bộ, giáo viên',
  'Lớp học',
  'Học sinh',
  'Điểm danh',
  'Sổ liên lạc điện tử (qua ứng dụng)',
  'Thông báo',
  'Văn bản, công văn',
];

function SchoolFeatures({
  token,
  code,
  detail,
  role,
  act,
}: {
  token: string;
  code: string;
  detail: SchoolDetail;
  role: Operator['role'] | undefined;
  act: (work: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const canChange = role ? operatorCan(role, 'schools.addons') : false;
  const addons = detail.addon_modules ?? [];
  const unlimited = !detail.plan || detail.plan.modules === null;
  const paid = detail.paid_modules ?? [];
  return (
    <div className="columns">
      <div className="wide" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section className="card" aria-labelledby="goi-hien-hanh">
          <h2 id="goi-hien-hanh">Gói hiện hành</h2>
          <p>
            {detail.plan ? `${detail.plan.name} (${detail.plan.code})` : 'Chưa gán gói (không giới hạn)'}.
            {unlimited ? ' Gói không giới hạn phân hệ nên mọi tính năng đều bật.' : ''}
          </p>
          <ul className="free-list" aria-label="Phân hệ miễn phí">
            {FREE_FEATURES.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
        </section>
        <section className="card" aria-label="Tính năng trả phí">
          <h2>Tính năng trả phí</h2>
          <p className="muted">
            Trường tự khởi tạo tắt sẵn. Khi tắt, trường thấy lời báo tính năng trả phí, liên hệ hỗ trợ, và máy chủ từ
            chối mọi yêu cầu tới tính năng đó. Mỗi lần bật, tắt đều ghi nhật ký.
          </p>
          {paid.map((module) => {
            const inPlan = unlimited || (detail.plan?.modules?.includes(module.key) ?? false);
            const on = addons.includes(module.key);
            return (
              <div key={module.key} className="feature-row">
                <div>
                  <span>{module.label}</span>
                  <span className="muted">{on ? 'Bật riêng cho trường' : inPlan ? 'Đã có trong gói' : 'Chưa bật'}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on || inPlan}
                  aria-label={`${on ? 'Tắt' : 'Bật'} ${module.label}`}
                  disabled={!canChange || unlimited || (inPlan && !on)}
                  onClick={() =>
                    void act(
                      () =>
                        catalogApi.setAddonModules(
                          token,
                          code,
                          on ? addons.filter((key) => key !== module.key) : [...addons, module.key],
                        ),
                      on ? `Đã tắt ${module.label}` : `Đã bật ${module.label}`,
                    )
                  }
                />
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

// Thẻ "Tài khoản quản trị trường" (YCTD-324): tạo tài khoản quản trị ở cổng quản trị của trường trong phiên Admin vào thẳng, để dùng
// đúng quy tắc tài khoản của trường (số CCCD, họ tên, số điện thoại bắt buộc, mật khẩu mặc định, bắt đổi lần đầu; GD-163) và ghi nhật
// ký hai phía. Nút mở thẳng trang Tài khoản của trường
function SchoolAdmins({ token, code, role }: { token: string; code: string; role: Operator['role'] | undefined }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEnter = role === 'quan_tri';
  async function open() {
    setError(null);
    try {
      const started = await dashboardApi.startSupport(token, code, '');
      const target = `${supportLink(started)}&next=${encodeURIComponent('/accounts')}`;
      setLink(target);
      window.open(target, '_blank', 'noopener');
    } catch (caught) {
      setError(messageOf(caught));
    }
  }
  return (
    <section className="card" aria-label="Tài khoản quản trị trường">
      <h2>Quản trị trường</h2>
      <p>
        Tài khoản quản trị của trường cần đủ ba thông tin: số CCCD (làm tên đăng nhập), họ và tên, số điện thoại. Tài
        khoản nhận mật khẩu mặc định và phải đổi ở lần đăng nhập đầu.
      </p>
      {canEnter ? (
        <p>
          <button type="button" className="button-primary" onClick={() => void open()}>
            Vào trường để tạo tài khoản quản trị
          </button>
        </p>
      ) : (
        <p className="muted">Chỉ quản trị nền tảng mở được trang tài khoản của trường.</p>
      )}
      {link ? (
        <p>
          <a href={link} target="_blank" rel="noreferrer" data-testid="admin-account-link">
            Mở trang Tài khoản của trường
          </a>
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

const PAGE_SIZE = 50;

// role: vai trò nhân viên vận hành đang đăng nhập, để ẩn nút máy chủ không cho phép (YCTD-343)
export function SchoolsPage({ token, role }: { token: string; role?: Operator['role'] | undefined }) {
  const [view, setView] = useState<'list' | 'setup' | { code: string }>('list');
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProvision, setLastProvision] = useState<ProvisionReply | null>(null);
  // Bộ lọc, phân trang của danh sách trường (YCTD-324); lọc ở trang vì danh sách là các trường đã khởi tạo
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

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
        role={role}
        settings={settings}
        onBack={() => {
          setView('list');
          load();
        }}
      />
    );
  }
  const text = query.trim().toLowerCase();
  const filtered = schools.filter(
    (school) =>
      (!statusFilter || school.status === statusFilter) &&
      (!text ||
        school.code.toLowerCase().includes(text) ||
        school.name.toLowerCase().includes(text) ||
        (school.moet_code ?? '').toLowerCase().includes(text)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return (
    <section aria-label="Danh sách trường">
      <h1>Trường học</h1>
      <p className="lead">
        Trường đã khởi tạo trên nền tảng. Trường chưa khởi tạo mở ở Danh mục đơn vị: lần đầu bấm Vào trường, hệ thống
        tạo dữ liệu cho trường, bật gói cơ bản miễn phí rồi đưa vào để tạo tài khoản quản trị đầu tiên.
      </p>
      {lastProvision ? <ActivationNotice reply={lastProvision} /> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="card">
        <div className="filters">
          <label>
            Tìm trường
            <input
              type="search"
              value={query}
              placeholder="Tên, mã trường hoặc mã Bộ"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Trạng thái
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Mọi trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" className="button-secondary" onClick={() => setView('setup')}>
              Khởi tạo trường mới
            </button>
          </div>
        </div>
        <h2>{filtered.length} trường</h2>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên trường</th>
              <th>Trạng thái</th>
              <th>Loại dữ liệu</th>
              <th>Tên miền</th>
              <th>
                <span className="visually-hidden">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((school) => {
              const badge = schoolStatusLabel(school.status, school.created_at);
              return (
                <tr key={school.id}>
                  <td>
                    <button type="button" className="link" onClick={() => setView({ code: school.code })}>
                      {school.code}
                    </button>
                  </td>
                  <td>
                    {school.name}
                    {school.moet_code ? <div className="muted">Mã Bộ {school.moet_code}</div> : null}
                  </td>
                  <td>
                    <span className="status" data-tone={badge.tone}>
                      {STATUS_LABELS[school.status] ?? school.status}
                    </span>
                  </td>
                  <td>{DATA_CLASS_LABELS[school.data_class] ?? school.data_class}</td>
                  <td>{school.domains.map((domain) => domain.host).join(', ')}</td>
                  <td>
                    {role === 'quan_tri' && school.moet_code ? (
                      <OpenSchoolButton token={token} moetCode={school.moet_code} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <nav className="pager" aria-label="Phân trang danh sách trường">
          <span className="muted">
            {filtered.length === 0
              ? 'Không có trường khớp bộ lọc'
              : `${(current - 1) * PAGE_SIZE + 1} đến ${Math.min(current * PAGE_SIZE, filtered.length)} trong ${filtered.length}`}
          </span>
          <span className="actions">
            <button
              type="button"
              className="button-secondary"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Trang trước
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Trang sau
            </button>
          </span>
        </nav>
      </div>
    </section>
  );
}

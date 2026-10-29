import { useState, type FormEvent } from 'react';
import { operatorRolesFor } from '@school-management/shared';
import {
  PlatformValidationError,
  schoolsApi,
  type ConsentRecordInput,
  type FieldProblem,
  type HostingRecordInput,
  type Operator,
  type PlatformSettings,
  type SchoolDetail,
} from './platform-api.js';

// Loại dữ liệu, hồ sơ đồng ý, vùng máy chủ của trường đã tạo (YCTD-343; tài liệu 32 mục S2, S9): chuyển `synthetic` sang
// `consented` đi qua cùng cổng hồ sơ đồng ý như bước setup, `production` chỉ sau khi đã chuyển về máy chủ trong nước. Máy chủ
// quyết định (đủ hồ sơ, chính sách môi trường); trang chỉ hỏi xác nhận rồi hiện lỗi nghiệp vụ máy chủ trả về. Nút chỉ hiện cho vai
// trò máy chủ cho phép (DATA_GOVERNANCE_ROLES ở apps/identity/src/platform/platform-schools.ts)
export const DATA_GOVERNANCE_ROLES: ReadonlyArray<Operator['role']> = operatorRolesFor('schools.data-governance');

export const DATA_CLASS_LABELS: Record<string, string> = {
  synthetic: 'Dữ liệu giả',
  consented: 'Dữ liệu thật có đồng ý',
  production: 'Vận hành chính thức',
};

const CONSENT_KIND_OPTIONS = [
  { kind: 'dpa', label: 'Thỏa thuận xử lý dữ liệu (PL-01)', template: 'PL-01' },
  { kind: 'consent', label: 'Văn bản đồng ý (PL-02)', template: 'PL-02' },
  { kind: 'impact-assessment', label: 'Đánh giá tác động (PL-03)', template: 'PL-03' },
  { kind: 'risk-acceptance', label: 'Chấp nhận rủi ro (PL-06)', template: 'PL-06' },
];

const CONFIRM_TEXT: Record<string, string> = {
  synthetic:
    'Chuyển trường về dữ liệu giả? Trường dữ liệu giả có thể bị tự xóa theo hạn; chỉ làm khi trường không còn dữ liệu thật.',
  consented:
    'Chuyển trường sang dữ liệu thật có đồng ý? Máy chủ chỉ nhận khi đủ bốn hồ sơ còn hiệu lực và có vùng máy chủ đang dùng.',
  production:
    'Chuyển trường sang vận hành chính thức? Chỉ làm sau khi dữ liệu đã chuyển về máy chủ trong nước và đã ghi vùng máy chủ mới.',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function day(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function consentState(consent: SchoolDetail['consents'][number]): string {
  const now = today();
  if (consent.withdrawn_on) {
    return 'Đã rút';
  }
  if (day(consent.valid_from) > now) {
    return 'Chưa hiệu lực';
  }
  if (consent.valid_until && day(consent.valid_until) < now) {
    return 'Hết hạn';
  }
  return 'Còn hiệu lực';
}

interface Failure {
  message: string;
  problems: FieldProblem[];
}

function failureOf(caught: unknown): Failure {
  if (caught instanceof PlatformValidationError) {
    return { message: caught.message, problems: caught.problems };
  }
  return { message: caught instanceof Error ? caught.message : 'Không thực hiện được, vui lòng thử lại', problems: [] };
}

const EMPTY_CONSENT = (): ConsentRecordInput => ({
  kind: 'dpa',
  template_code: 'PL-01',
  template_version: 'v1',
  signer_name: '',
  signer_title: '',
  signed_on: today(),
  valid_from: today(),
  valid_until: '',
  data_scope: '',
  file_sha256: '',
});

const EMPTY_HOSTING = (): HostingRecordInput => ({
  provider: '',
  service: '',
  region: '',
  role: 'subprocessor',
  stores_personal_data: true,
  started_on: today(),
});

export function SchoolDataGovernance({
  token,
  detail,
  role,
  settings,
  onChanged,
}: {
  token: string;
  detail: SchoolDetail;
  role: Operator['role'] | undefined;
  settings: PlatformSettings | null;
  onChanged: (detail: SchoolDetail) => void;
}) {
  const canManage = role !== undefined && DATA_GOVERNANCE_ROLES.includes(role) && detail.status !== 'deleted';
  const [target, setTarget] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consentForm, setConsentForm] = useState<ConsentRecordInput | null>(null);
  const [hostingForm, setHostingForm] = useState<HostingRecordInput | null>(null);
  const [busy, setBusy] = useState(false);
  const gaps = detail.consent_gaps ?? [];
  const otherClasses = Object.keys(DATA_CLASS_LABELS).filter((value) => value !== detail.data_class);

  async function run(work: () => Promise<SchoolDetail>, done: string): Promise<boolean> {
    setFailure(null);
    setNotice(null);
    setBusy(true);
    try {
      onChanged(await work());
      setNotice(done);
      return true;
    } catch (caught) {
      setFailure(failureOf(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function changeClass() {
    if (!target || !window.confirm(CONFIRM_TEXT[target] ?? 'Chuyển loại dữ liệu?')) {
      return;
    }
    void run(
      () => schoolsApi.changeDataClass(token, detail.code, target),
      `Đã chuyển loại dữ liệu sang "${DATA_CLASS_LABELS[target] ?? target}"`,
    ).then((ok) => {
      if (ok) {
        setTarget('');
      }
    });
  }

  function submitConsent(event: FormEvent) {
    event.preventDefault();
    if (!consentForm) {
      return;
    }
    const input: ConsentRecordInput = {
      ...consentForm,
      file_sha256: consentForm.file_sha256.trim().toLowerCase(),
      valid_until: consentForm.valid_until ? consentForm.valid_until : null,
    };
    void run(() => schoolsApi.addConsent(token, detail.code, input), 'Đã ghi hồ sơ đồng ý').then((ok) => {
      if (ok) {
        setConsentForm(null);
      }
    });
  }

  function submitHosting(event: FormEvent) {
    event.preventDefault();
    if (!hostingForm) {
      return;
    }
    void run(() => schoolsApi.addHosting(token, detail.code, hostingForm), 'Đã ghi vùng máy chủ').then((ok) => {
      if (ok) {
        setHostingForm(null);
      }
    });
  }

  return (
    <section aria-label="Loại dữ liệu và hồ sơ đồng ý">
      <h3>Loại dữ liệu, hồ sơ đồng ý và vùng máy chủ</h3>
      <p>
        Loại dữ liệu hiện tại:{' '}
        <strong data-testid="school-data-class">{DATA_CLASS_LABELS[detail.data_class] ?? detail.data_class}</strong>
      </p>
      {settings && settings.data_policy !== 'any' ? (
        <p role="note">
          {settings.data_policy === 'synthetic-only'
            ? 'Môi trường này chỉ nhận dữ liệu giả.'
            : 'Môi trường thử nghiệm, máy chủ ngoài Việt Nam: dữ liệu thật chỉ khi đủ hồ sơ đồng ý; không nhận loại vận hành chính thức.'}
        </p>
      ) : null}
      {gaps.length > 0 ? (
        <div data-testid="consent-gaps">
          Còn thiếu để dùng dữ liệu thật có đồng ý:
          <ul>
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p data-testid="consent-gaps">Đủ hồ sơ đồng ý và vùng máy chủ để dùng dữ liệu thật.</p>
      )}
      {notice ? <p role="status">{notice}</p> : null}
      {failure ? (
        <div role="alert">
          {failure.message}
          {failure.problems.length > 0 ? (
            <ul>
              {failure.problems.map((problem) => (
                <li key={`${problem.field}:${problem.message}`}>{problem.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {canManage ? (
        <div className="actions">
          <label>
            Chuyển sang loại
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Chọn loại dữ liệu</option>
              {otherClasses.map((value) => (
                <option key={value} value={value}>
                  {DATA_CLASS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!target || busy} onClick={changeClass}>
            Chuyển loại dữ liệu
          </button>
        </div>
      ) : (
        <p>
          <small>
            Chỉ nhân viên vận hành vai trò quản trị hoặc kỹ thuật được đổi loại dữ liệu, ghi hồ sơ đồng ý và vùng máy
            chủ.
          </small>
        </p>
      )}
      <h4>Hồ sơ đồng ý</h4>
      {detail.consents.length === 0 ? (
        <p>Chưa có hồ sơ đồng ý</p>
      ) : (
        <table aria-label="Hồ sơ đồng ý">
          <thead>
            <tr>
              <th>Loại</th>
              <th>Mẫu</th>
              <th>Người ký</th>
              <th>Ngày ký</th>
              <th>Hiệu lực</th>
              <th>Trạng thái</th>
              <th>Mã băm bản quét</th>
            </tr>
          </thead>
          <tbody>
            {detail.consents.map((consent) => (
              <tr key={consent.id}>
                <td>{CONSENT_KIND_OPTIONS.find((item) => item.kind === consent.kind)?.label ?? consent.kind}</td>
                <td>
                  {consent.template_code}
                  {consent.template_version ? ` ${consent.template_version}` : ''}
                </td>
                <td>
                  {consent.signer_name}
                  {consent.signer_title ? `, ${consent.signer_title}` : ''}
                </td>
                <td>{day(consent.signed_on)}</td>
                <td>
                  {day(consent.valid_from)}
                  {consent.valid_until ? ` đến ${day(consent.valid_until)}` : ''}
                </td>
                <td>{consentState(consent)}</td>
                <td>
                  <small title={consent.file_sha256}>
                    {consent.file_sha256 ? `${consent.file_sha256.slice(0, 12)}…` : ''}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canManage && !consentForm ? (
        <button type="button" onClick={() => setConsentForm(EMPTY_CONSENT())}>
          Thêm hồ sơ đồng ý
        </button>
      ) : null}
      {canManage && consentForm ? (
        <form aria-label="Thêm hồ sơ đồng ý" onSubmit={submitConsent}>
          <label>
            Loại hồ sơ
            <select
              value={consentForm.kind}
              onChange={(event) => {
                const option = CONSENT_KIND_OPTIONS.find((item) => item.kind === event.target.value);
                setConsentForm({
                  ...consentForm,
                  kind: event.target.value,
                  template_code: option?.template ?? consentForm.template_code,
                });
              }}
            >
              {CONSENT_KIND_OPTIONS.map((item) => (
                <option key={item.kind} value={item.kind}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã mẫu
            <input
              value={consentForm.template_code}
              onChange={(event) => setConsentForm({ ...consentForm, template_code: event.target.value })}
            />
          </label>
          <label>
            Phiên bản mẫu
            <input
              value={consentForm.template_version}
              onChange={(event) => setConsentForm({ ...consentForm, template_version: event.target.value })}
            />
          </label>
          <label>
            Người ký
            <input
              value={consentForm.signer_name}
              onChange={(event) => setConsentForm({ ...consentForm, signer_name: event.target.value })}
            />
          </label>
          <label>
            Chức vụ người ký
            <input
              value={consentForm.signer_title}
              onChange={(event) => setConsentForm({ ...consentForm, signer_title: event.target.value })}
            />
          </label>
          <label>
            Ngày ký
            <input
              type="date"
              value={consentForm.signed_on}
              onChange={(event) => setConsentForm({ ...consentForm, signed_on: event.target.value })}
            />
          </label>
          <label>
            Hiệu lực từ
            <input
              type="date"
              value={consentForm.valid_from}
              onChange={(event) => setConsentForm({ ...consentForm, valid_from: event.target.value })}
            />
          </label>
          <label>
            Hiệu lực đến
            <input
              type="date"
              value={consentForm.valid_until ?? ''}
              onChange={(event) => setConsentForm({ ...consentForm, valid_until: event.target.value })}
            />
          </label>
          <label>
            Phạm vi dữ liệu
            <input
              value={consentForm.data_scope}
              onChange={(event) => setConsentForm({ ...consentForm, data_scope: event.target.value })}
            />
          </label>
          <label>
            Mã băm SHA-256 của bản quét
            <input
              value={consentForm.file_sha256}
              onChange={(event) => setConsentForm({ ...consentForm, file_sha256: event.target.value })}
            />
          </label>
          <button type="submit" disabled={busy}>
            Ghi hồ sơ đồng ý
          </button>
          <button type="button" onClick={() => setConsentForm(null)}>
            Hủy
          </button>
        </form>
      ) : null}
      <h4>Vùng máy chủ, bên xử lý phụ (PL-08)</h4>
      {detail.hosting.length === 0 ? (
        <p>Chưa có bản ghi vùng máy chủ</p>
      ) : (
        <table aria-label="Vùng máy chủ">
          <thead>
            <tr>
              <th>Nhà cung cấp</th>
              <th>Dịch vụ</th>
              <th>Vùng</th>
              <th>Vai trò</th>
              <th>Lưu dữ liệu cá nhân</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {detail.hosting.map((item) => (
              <tr key={item.id}>
                <td>{item.provider}</td>
                <td>{item.service}</td>
                <td>{item.region}</td>
                <td>{item.role === 'transit' ? 'Chỉ truyền qua' : 'Bên xử lý phụ'}</td>
                <td>{item.stores_personal_data === false ? 'Không' : 'Có'}</td>
                <td>
                  {day(item.started_on)}
                  {item.ended_on ? ` đến ${day(item.ended_on)}` : ' đến nay'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canManage && !hostingForm ? (
        <button type="button" onClick={() => setHostingForm(EMPTY_HOSTING())}>
          Thêm vùng máy chủ
        </button>
      ) : null}
      {canManage && hostingForm ? (
        <form aria-label="Thêm vùng máy chủ" onSubmit={submitHosting}>
          <label>
            Nhà cung cấp
            <input
              value={hostingForm.provider}
              onChange={(event) => setHostingForm({ ...hostingForm, provider: event.target.value })}
            />
          </label>
          <label>
            Dịch vụ
            <input
              value={hostingForm.service}
              onChange={(event) => setHostingForm({ ...hostingForm, service: event.target.value })}
            />
          </label>
          <label>
            Vùng
            <input
              value={hostingForm.region}
              onChange={(event) => setHostingForm({ ...hostingForm, region: event.target.value })}
            />
          </label>
          <label>
            Vai trò của dịch vụ
            <select
              value={hostingForm.role}
              onChange={(event) =>
                setHostingForm({ ...hostingForm, role: event.target.value === 'transit' ? 'transit' : 'subprocessor' })
              }
            >
              <option value="subprocessor">Bên xử lý phụ</option>
              <option value="transit">Chỉ truyền qua</option>
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={hostingForm.stores_personal_data}
              onChange={(event) => setHostingForm({ ...hostingForm, stores_personal_data: event.target.checked })}
            />
            Lưu dữ liệu cá nhân
          </label>
          <label>
            Bắt đầu dùng từ
            <input
              type="date"
              value={hostingForm.started_on}
              onChange={(event) => setHostingForm({ ...hostingForm, started_on: event.target.value })}
            />
          </label>
          <button type="submit" disabled={busy}>
            Ghi vùng máy chủ
          </button>
          <button type="button" onClick={() => setHostingForm(null)}>
            Hủy
          </button>
        </form>
      ) : null}
    </section>
  );
}

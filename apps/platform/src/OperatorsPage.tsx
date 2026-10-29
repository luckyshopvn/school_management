import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  OPERATOR_ROLE_LABELS,
  operatorsApi,
  type OperatorCredentials,
  type OperatorRole,
  type OperatorRow,
} from './operators-api.js';
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  errorMessage,
  LoadError,
  OutcomeBanner,
  Skeleton,
  useBusy,
  type Outcome,
} from './platform-ui.js';

// Nhân viên vận hành của công ty (YCTD-311): chỉ quản trị nền tảng thấy trang này. Nhân viên chỉ vào dữ liệu trường qua phiên hỗ trợ
// trường đã cấp (mục Trường, Hỗ trợ). Tạo tài khoản là đăng ký luôn xác thực hai lớp; mật khẩu tạm, khóa, mã khôi phục hiện một lần.
// Giao diện theo phần tài khoản vận hành của bảng vẽ Nhật ký (YCTD-370): thêm nhân viên trong hộp thoại; khóa, đổi vai trò hỏi xác nhận;
// thông tin hiện một lần chỉ đóng bằng nút "Đã lưu, đóng"
const ROLES = Object.keys(OPERATOR_ROLE_LABELS) as OperatorRole[];

function shortTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function OperatorStatus({ row }: { row: OperatorRow }) {
  if (row.status !== 'active') {
    return (
      <span className="status" data-tone="idle">
        Đã khóa
      </span>
    );
  }
  // Tạm khóa sau nhiều lần đăng nhập sai: máy chủ trả giờ mở lại
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return (
      <span className="status" data-tone="warn">
        Tạm khóa đến {shortTime(row.locked_until)}
      </span>
    );
  }
  return (
    <span className="status" data-tone="ok">
      Đang hoạt động
    </span>
  );
}

function CopyableValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="field">
      {label}
      <code className="secret">{value}</code>
      <button
        type="button"
        className="button-link"
        style={{ alignSelf: 'flex-start' }}
        aria-label={`Chép ${label.toLowerCase()}`}
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? 'Đã chép' : 'Chép'}
      </button>
    </div>
  );
}

// Thông tin hiện một lần: không đóng bằng Esc hay nút ×, không ghi vào bộ nhớ trình duyệt
function CredentialsDialog({
  title,
  credentials,
  onClose,
}: {
  title: string;
  credentials: OperatorCredentials;
  onClose(): void;
}) {
  return (
    <Dialog title={title} onClose={onClose} dismissible={false}>
      <div className="dialog-body">
        <div className="banner" data-tone="warn" style={{ margin: 0 }}>
          Chỉ hiện một lần. Trao tận tay nhân viên, không gửi qua tin nhắn hoặc thư điện tử.
        </div>
        {credentials.temporary_password ? (
          <CopyableValue label="Mật khẩu tạm" value={credentials.temporary_password} />
        ) : null}
        <CopyableValue label="Khóa xác thực hai lớp" value={credentials.totp_secret} />
        <CopyableValue label="Địa chỉ thêm vào ứng dụng xác thực" value={credentials.otpauth_uri} />
        <CopyableValue label="Mã khôi phục" value={credentials.recovery_codes.join(' ')} />
      </div>
      <div className="dialog-foot">
        <button type="button" className="button-primary" onClick={onClose}>
          Đã lưu, đóng
        </button>
      </div>
    </Dialog>
  );
}

function CreateOperatorDialog({
  token,
  loginRule,
  onCreated,
  onClose,
}: {
  token: string;
  loginRule: 'cccd' | 'email';
  onCreated: (title: string, credentials: OperatorCredentials) => void;
  onClose: () => void;
}) {
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<OperatorRole>('ho_tro');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setError(null);
      try {
        const created = await operatorsApi.create(token, { login, full_name: fullName, role, otp_code: otpCode });
        onCreated(`Tài khoản của ${fullName}`, created);
      } catch (caught) {
        setError(`Không tạo được tài khoản: ${errorMessage(caught)}`);
      }
    });
  }

  return (
    <Dialog title="Thêm nhân viên vận hành" onClose={onClose}>
      <form onSubmit={submit} aria-label="Tạo nhân viên vận hành">
        <div className="dialog-body">
          <label className="field">
            <span>
              Tên đăng nhập{' '}
              <span className="hint">{loginRule === 'cccd' ? 'số CCCD 12 chữ số' : 'thư điện tử công ty'}</span>
            </span>
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              inputMode={loginRule === 'cccd' ? 'numeric' : 'email'}
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            Họ tên
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="field">
            Vai trò
            <select value={role} onChange={(event) => setRole(event.target.value as OperatorRole)}>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {OPERATOR_ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Mã xác thực hai lớp của bạn <span className="hint">xác nhận bạn là người tạo</span>
            </span>
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Tạo xong, hệ thống hiện một lần mật khẩu tạm, khóa xác thực hai lớp và mã khôi phục của nhân viên.
          </p>
          {error ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ResetTotpDialog({
  token,
  row,
  onReset,
  onClose,
}: {
  token: string;
  row: OperatorRow;
  onReset: (credentials: OperatorCredentials) => void;
  onClose: () => void;
}) {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setError(null);
      try {
        onReset(await operatorsApi.resetTotp(token, row.id, otpCode.trim()));
      } catch (caught) {
        setError(`Không cấp lại được: ${errorMessage(caught)}`);
      }
    });
  }

  return (
    <Dialog title={`Cấp lại khóa hai lớp cho ${row.full_name}?`} onClose={onClose}>
      <form onSubmit={submit} aria-label="Cấp lại khóa hai lớp">
        <div className="dialog-body">
          <p style={{ margin: 0 }}>
            Hệ thống tạo khóa hai lớp và mã khôi phục mới, hiện một lần để trao cho nhân viên.
          </p>
          <label className="field">
            Mã xác thực hai lớp của bạn
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <span className="field-error" role="alert">
                {error}
              </span>
            ) : null}
          </label>
        </div>
        <div className="dialog-foot">
          <button type="button" className="button-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Đang cấp…' : 'Cấp lại khóa'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

type PendingChange =
  | { kind: 'role'; row: OperatorRow; role: OperatorRole }
  | { kind: 'lock'; row: OperatorRow };

export function OperatorsPage({ token, currentOperatorId }: { token: string; currentOperatorId: string }) {
  const [items, setItems] = useState<OperatorRow[] | null>(null);
  const [loginRule, setLoginRule] = useState<'cccd' | 'email'>('cccd');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; value: OperatorCredentials } | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<OperatorRow | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    setLoadError(null);
    operatorsApi
      .list(token)
      .then((reply) => {
        setItems(reply.items);
        setLoginRule(reply.login_rule);
      })
      .catch((caught: unknown) =>
        setLoadError(`Không đọc được danh sách nhân viên: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`),
      );
  }, [token]);
  useEffect(load, [load]);

  async function update(row: OperatorRow, change: { role?: OperatorRole; status?: 'active' | 'locked' }, done: string) {
    try {
      await operatorsApi.update(token, row.id, change);
      setOutcome({ tone: 'ok', text: done });
      setPending(null);
      load();
    } catch (caught) {
      if (pending) {
        setPendingError(`Không thực hiện được: ${errorMessage(caught)}`);
      } else {
        setOutcome({ tone: 'danger', text: `Không thực hiện được: ${errorMessage(caught)}` });
      }
    }
  }

  function confirmPending() {
    const change = pending;
    if (!change) {
      return;
    }
    void run(async () => {
      setPendingError(null);
      if (change.kind === 'role') {
        await update(change.row, { role: change.role }, `Đã đổi vai trò của ${change.row.full_name}.`);
      } else {
        await update(change.row, { status: 'locked' }, `Đã khóa ${change.row.full_name}.`);
      }
    });
  }

  const others = (items ?? []).filter((row) => row.id !== currentOperatorId);

  return (
    <section aria-label="Nhân viên vận hành">
      <div className="page-head">
        <div>
          <h1>Nhân viên vận hành</h1>
          <p className="lead">
            Nhân viên của công ty vận hành, hỗ trợ các trường. Nhân viên không có tài khoản ở trường; vào dữ liệu trường chỉ
            qua phiên hỗ trợ có thời hạn và ghi nhật ký. Xác thực hai lớp là bắt buộc.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="button-primary button-large" onClick={() => setCreating(true)}>
            Thêm nhân viên
          </button>
        </div>
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      <section className="card" aria-labelledby="tai-khoan-van-hanh">
        <h2 id="tai-khoan-van-hanh">Tài khoản vận hành</h2>
        {items === null && !loadError ? <Skeleton lines={3} /> : null}
        {items && others.length === 0 ? (
          <EmptyState title="Chỉ có tài khoản của bạn">Thêm nhân viên hỗ trợ, kỹ thuật, kế toán để chia việc.</EmptyState>
        ) : null}
        {items && items.length > 0 ? (
          <div className="table-scroll">
            <table className="sticky-first" aria-label="Nhân viên vận hành" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th scope="col">Nhân viên</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Xác thực hai lớp</th>
                  <th scope="col">Đăng nhập gần nhất</th>
                  <th scope="col">
                    <span className="visually-hidden">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const self = row.id === currentOperatorId;
                  return (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {row.full_name} {self ? <span className="muted">(bạn)</span> : null}
                        </div>
                        <div className="muted">{row.login}</div>
                      </td>
                      <td>
                        <select
                          className="inline-select"
                          aria-label={`Vai trò của ${row.full_name}`}
                          value={row.role}
                          disabled={self}
                          onChange={(event) => {
                            setPendingError(null);
                            setPending({ kind: 'role', row, role: event.target.value as OperatorRole });
                          }}
                        >
                          {ROLES.map((item) => (
                            <option key={item} value={item}>
                              {OPERATOR_ROLE_LABELS[item]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <OperatorStatus row={row} />
                      </td>
                      <td>
                        <span className="status" data-tone={row.totp_enrolled ? 'ok' : 'warn'}>
                          {row.totp_enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}
                        </span>
                      </td>
                      <td className="nowrap">{row.last_login_at ? shortTime(row.last_login_at) : 'Chưa đăng nhập'}</td>
                      <td>
                        <div className="button-row">
                          {self ? null : row.status === 'active' ? (
                            <button
                              type="button"
                              className="button-link danger"
                              onClick={() => {
                                setPendingError(null);
                                setPending({ kind: 'lock', row });
                              }}
                            >
                              Khóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button-link"
                              onClick={() =>
                                void run(() => update(row, { status: 'active' }, `Đã mở khóa ${row.full_name}.`))
                              }
                            >
                              Mở khóa
                            </button>
                          )}
                          <button type="button" className="button-link" onClick={() => setResetting(row)}>
                            Cấp lại khóa hai lớp
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      {creating ? (
        <CreateOperatorDialog
          token={token}
          loginRule={loginRule}
          onClose={() => setCreating(false)}
          onCreated={(title, value) => {
            setCreating(false);
            setCredentials({ title, value });
            load();
          }}
        />
      ) : null}
      {resetting ? (
        <ResetTotpDialog
          token={token}
          row={resetting}
          onClose={() => setResetting(null)}
          onReset={(value) => {
            setCredentials({ title: `Khóa xác thực hai lớp mới của ${resetting.full_name}`, value });
            setResetting(null);
            load();
          }}
        />
      ) : null}
      {pending?.kind === 'role' ? (
        <ConfirmDialog
          title={`Đổi vai trò của ${pending.row.full_name}?`}
          confirmLabel="Đổi vai trò"
          busy={busy}
          error={pendingError}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        >
          <p style={{ margin: 0 }}>
            Từ <b>{OPERATOR_ROLE_LABELS[pending.row.role]}</b> sang <b>{OPERATOR_ROLE_LABELS[pending.role]}</b>. Trang và
            thao tác nhân viên được làm đổi theo vai trò mới.
          </p>
        </ConfirmDialog>
      ) : null}
      {pending?.kind === 'lock' ? (
        <ConfirmDialog
          title={`Khóa tài khoản ${pending.row.full_name}?`}
          confirmLabel="Khóa tài khoản"
          danger
          busy={busy}
          error={pendingError}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        >
          <p style={{ margin: 0 }}>Nhân viên không đăng nhập được cổng vận hành cho tới khi mở khóa.</p>
        </ConfirmDialog>
      ) : null}
      {credentials ? (
        <CredentialsDialog
          title={credentials.title}
          credentials={credentials.value}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </section>
  );
}

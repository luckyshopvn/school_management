import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PlatformValidationError } from './platform-api.js';
import {
  OPERATOR_ROLE_LABELS,
  operatorsApi,
  type OperatorCredentials,
  type OperatorRole,
  type OperatorRow,
} from './operators-api.js';

// Nhân viên vận hành của công ty (YCTD-311): chỉ quản trị nền tảng thấy trang này. Nhân viên chỉ vào dữ liệu trường qua phiên hỗ trợ
// trường đã cấp (mục Trường, Hỗ trợ). Tạo tài khoản là đăng ký luôn xác thực hai lớp; mật khẩu tạm, khóa, mã khôi phục hiện một lần
const ROLES = Object.keys(OPERATOR_ROLE_LABELS) as OperatorRole[];

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

function CredentialsPanel({
  title,
  credentials,
  onClose,
}: {
  title: string;
  credentials: OperatorCredentials;
  onClose(): void;
}) {
  return (
    <section aria-label={title} className="card">
      <h3>{title}</h3>
      <p>Chỉ hiện một lần. Trao tận tay nhân viên, không gửi qua tin nhắn hoặc thư điện tử.</p>
      <dl>
        {credentials.temporary_password ? (
          <>
            <dt>Mật khẩu tạm</dt>
            <dd>
              <code>{credentials.temporary_password}</code>
            </dd>
          </>
        ) : null}
        <dt>Khóa xác thực hai lớp</dt>
        <dd>
          <code>{credentials.totp_secret}</code>
        </dd>
        <dt>Địa chỉ thêm vào ứng dụng xác thực</dt>
        <dd>
          <code>{credentials.otpauth_uri}</code>
        </dd>
        <dt>Mã khôi phục</dt>
        <dd>
          <code>{credentials.recovery_codes.join(' ')}</code>
        </dd>
      </dl>
      <button type="button" onClick={onClose}>
        Đã lưu, đóng
      </button>
    </section>
  );
}

export function OperatorsPage({ token, currentOperatorId }: { token: string; currentOperatorId: string }) {
  const [items, setItems] = useState<OperatorRow[]>([]);
  const [loginRule, setLoginRule] = useState<'cccd' | 'email'>('cccd');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ title: string; value: OperatorCredentials } | null>(null);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<OperatorRole>('ho_tro');
  const [otpCode, setOtpCode] = useState('');

  const load = useCallback(() => {
    operatorsApi
      .list(token)
      .then((reply) => {
        setItems(reply.items);
        setLoginRule(reply.login_rule);
      })
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  useEffect(load, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = await operatorsApi.create(token, { login, full_name: fullName, role, otp_code: otpCode });
      setCredentials({ title: `Tài khoản của ${fullName}`, value: created });
      setLogin('');
      setFullName('');
      setOtpCode('');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function update(row: OperatorRow, change: { role?: OperatorRole; status?: 'active' | 'locked' }, done: string) {
    setError(null);
    setNotice(null);
    try {
      await operatorsApi.update(token, row.id, change);
      setNotice(done);
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function resetTotp(row: OperatorRow) {
    setError(null);
    setNotice(null);
    const code = window.prompt(`Nhập mã xác thực hai lớp của bạn để cấp lại khóa cho ${row.full_name}`);
    if (!code) {
      return;
    }
    try {
      const reply = await operatorsApi.resetTotp(token, row.id, code);
      setCredentials({ title: `Khóa xác thực hai lớp mới của ${row.full_name}`, value: reply });
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <section>
      <h2>Nhân viên vận hành</h2>
      <p>
        Nhân viên của công ty vận hành, hỗ trợ các trường. Nhân viên không có tài khoản ở trường; vào dữ liệu trường chỉ
        qua phiên hỗ trợ do trường cấp, có thời hạn và ghi nhật ký. Xác thực hai lớp là bắt buộc.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {credentials ? (
        <CredentialsPanel
          title={credentials.title}
          credentials={credentials.value}
          onClose={() => setCredentials(null)}
        />
      ) : null}
      <form onSubmit={create} aria-label="Tạo nhân viên vận hành">
        <label>
          {loginRule === 'cccd' ? 'Tên đăng nhập (số CCCD 12 chữ số)' : 'Tên đăng nhập (thư điện tử công ty)'}
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            inputMode={loginRule === 'cccd' ? 'numeric' : 'email'}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Họ tên
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label>
          Vai trò
          <select value={role} onChange={(event) => setRole(event.target.value as OperatorRole)}>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {OPERATOR_ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mã xác thực hai lớp của bạn
          <input
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </label>
        <button type="submit">Tạo tài khoản</button>
      </form>
      <table>
        <thead>
          <tr>
            <th scope="col">Họ tên</th>
            <th scope="col">Tên đăng nhập</th>
            <th scope="col">Vai trò</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Xác thực hai lớp</th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const self = row.id === currentOperatorId;
            return (
              <tr key={row.id}>
                <td>{row.full_name}</td>
                <td>{row.login}</td>
                <td>
                  <select
                    aria-label={`Vai trò của ${row.full_name}`}
                    value={row.role}
                    disabled={self}
                    onChange={(event) =>
                      void update(
                        row,
                        { role: event.target.value as OperatorRole },
                        `Đã đổi vai trò của ${row.full_name}`,
                      )
                    }
                  >
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {OPERATOR_ROLE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{row.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}</td>
                <td>{row.totp_enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}</td>
                <td>
                  {self ? null : (
                    <button
                      type="button"
                      onClick={() =>
                        void update(
                          row,
                          { status: row.status === 'active' ? 'locked' : 'active' },
                          row.status === 'active' ? `Đã khóa ${row.full_name}` : `Đã mở khóa ${row.full_name}`,
                        )
                      }
                    >
                      {row.status === 'active' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  )}
                  <button type="button" onClick={() => void resetTotp(row)}>
                    Cấp lại khóa hai lớp
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

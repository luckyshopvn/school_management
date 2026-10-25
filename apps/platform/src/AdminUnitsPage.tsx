import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { PlatformValidationError } from './platform-api.js';
import {
  adminUnitsApi,
  LEVEL_LABELS,
  type AdminUnit,
  type AdminUnitLevel,
  type AdminUnitsOverview,
  type TotpEnrollment,
} from './parent-org-api.js';

// Đơn vị cấp trên ở cổng nền tảng (DT-SaaS phần S6, YCTD-202): cây đơn vị hành chính (Bộ, Sở, Phòng Văn hóa – Xã hội) thêm, sửa,
// ngừng, gộp; nạp bộ nút mặc định; gắn trường vào nút quản lý; tài khoản cấp trên (xác thực hai lớp bắt buộc: khóa và mã khôi phục
// chỉ hiện một lần khi tạo, cấp lại)
const PARENT_LEVEL: Record<AdminUnitLevel, AdminUnitLevel | null> = {
  ministry: null,
  department: 'ministry',
  commune: 'department',
};

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

function EnrollmentNotice({ title, enrollment }: { title: string; enrollment: TotpEnrollment }) {
  return (
    <div className="notice" role="status" aria-label="Khóa xác thực hai lớp">
      <strong>{title}</strong>
      <p>Lưu ngay, chỉ hiện một lần. Khóa TOTP (nhập vào ứng dụng xác thực):</p>
      <code data-testid="totp-secret">{enrollment.secret}</code>
      <p>Mã khôi phục dùng một lần:</p>
      <code data-testid="recovery-codes">{enrollment.recovery_codes.join(' ')}</code>
    </div>
  );
}

export function AdminUnitsPage({ token }: { token: string }) {
  const [data, setData] = useState<AdminUnitsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{ title: string; value: TotpEnrollment } | null>(null);
  const [level, setLevel] = useState<AdminUnitLevel>('ministry');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [user, setUser] = useState({ login: '', full_name: '', password: '', admin_unit_id: '' });

  const load = useCallback(() => {
    adminUnitsApi
      .overview(token)
      .then(setData)
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  useEffect(load, [load]);

  const active = useMemo(() => data?.units.filter((unit) => unit.status === 'active') ?? [], [data]);
  const byId = useMemo(() => new Map((data?.units ?? []).map((unit) => [unit.id, unit])), [data]);
  const ordered = useMemo(() => {
    // Duyệt cây: Bộ, rồi Sở của Bộ, rồi Phòng của Sở
    const out: Array<{ unit: AdminUnit; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      for (const unit of (data?.units ?? []).filter((item) => item.parent_id === parent)) {
        out.push({ unit, depth });
        walk(unit.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [data]);

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

  function createUnit(event: FormEvent) {
    event.preventDefault();
    void act(
      () =>
        adminUnitsApi.create(token, { level, code, name, parent_id: PARENT_LEVEL[level] ? parentId || null : null }),
      'Đã thêm đơn vị',
    ).then(() => {
      setCode('');
      setName('');
    });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await adminUnitsApi.createUser(token, user);
      setEnrollment({ title: `Tài khoản ${created.user.login}`, value: created.totp });
      setUser({ login: '', full_name: '', password: '', admin_unit_id: '' });
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  const parentChoices = active.filter((unit) => unit.level === PARENT_LEVEL[level]);
  return (
    <section>
      <h2>Đơn vị cấp trên</h2>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      {enrollment ? <EnrollmentNotice title={enrollment.title} enrollment={enrollment.value} /> : null}

      <h3>Cây đơn vị hành chính</h3>
      <div className="actions">
        <button
          type="button"
          onClick={() =>
            void act(async () => {
              const result = await adminUnitsApi.importDefault(token);
              setNotice(`Đã nạp ${result.created} nút, bỏ qua ${result.skipped} nút đã có`);
            }, 'Đã nạp bộ nút mặc định')
          }
        >
          Nạp bộ nút mặc định
        </button>
      </div>
      <form className="inline-form" aria-label="Thêm đơn vị" onSubmit={createUnit}>
        <label>
          Cấp
          <select value={level} onChange={(event) => setLevel(event.target.value as AdminUnitLevel)}>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {PARENT_LEVEL[level] ? (
          <label>
            Thuộc
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} required>
              <option value="">Chọn</option>
              {parentChoices.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Mã đơn vị
          <input value={code} onChange={(event) => setCode(event.target.value)} required />
        </label>
        <label>
          Tên đơn vị
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button type="submit">Thêm đơn vị</button>
      </form>
      <table aria-label="Cây đơn vị">
        <thead>
          <tr>
            <th>Đơn vị</th>
            <th>Cấp</th>
            <th>Mã</th>
            <th>Trạng thái</th>
            <th>Trường</th>
            <th>Tài khoản</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordered.map(({ unit, depth }) => (
            <tr key={unit.id}>
              <td style={{ paddingLeft: `${0.5 + depth * 1.5}rem` }}>{unit.name}</td>
              <td>{LEVEL_LABELS[unit.level]}</td>
              <td>{unit.code}</td>
              <td>
                {unit.status === 'merged'
                  ? `Đã gộp vào ${byId.get(unit.merged_into_id ?? '')?.name ?? ''}`
                  : unit.status === 'active'
                    ? 'Đang dùng'
                    : 'Ngừng'}
              </td>
              <td>{unit.school_count}</td>
              <td>{unit.user_count}</td>
              <td>
                {unit.status !== 'merged' ? (
                  <>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        const next = window.prompt('Tên mới', unit.name);
                        if (next) void act(() => adminUnitsApi.update(token, unit.id, { name: next }), 'Đã đổi tên');
                      }}
                    >
                      Đổi tên
                    </button>{' '}
                    <select
                      aria-label={`Gộp ${unit.name} vào`}
                      value=""
                      onChange={(event) => {
                        if (event.target.value) {
                          void act(() => adminUnitsApi.merge(token, unit.id, event.target.value), 'Đã gộp đơn vị');
                        }
                      }}
                    >
                      <option value="">Gộp vào…</option>
                      {active
                        .filter((other) => other.level === unit.level && other.id !== unit.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.name}
                          </option>
                        ))}
                    </select>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Trường và đơn vị quản lý</h3>
      <table aria-label="Trường và đơn vị quản lý">
        <thead>
          <tr>
            <th>Mã trường</th>
            <th>Tên trường</th>
            <th>Đơn vị quản lý</th>
          </tr>
        </thead>
        <tbody>
          {data?.schools.map((school) => (
            <tr key={school.id}>
              <td>{school.code}</td>
              <td>{school.name}</td>
              <td>
                <select
                  aria-label={`Đơn vị quản lý của ${school.code}`}
                  value={school.admin_unit_id ?? ''}
                  onChange={(event) =>
                    void act(
                      () => adminUnitsApi.assignSchool(token, school.code, event.target.value || null),
                      'Đã gắn trường vào đơn vị',
                    )
                  }
                >
                  <option value="">Chưa gắn</option>
                  {active
                    .filter((unit) => unit.level !== 'ministry')
                    .map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Tài khoản cấp trên</h3>
      <form className="inline-form" aria-label="Thêm tài khoản cấp trên" onSubmit={(event) => void createUser(event)}>
        <label>
          Tên đăng nhập
          <input value={user.login} onChange={(event) => setUser({ ...user, login: event.target.value })} required />
        </label>
        <label>
          Họ tên
          <input
            value={user.full_name}
            onChange={(event) => setUser({ ...user, full_name: event.target.value })}
            required
          />
        </label>
        <label>
          Mật khẩu ban đầu
          <input
            type="password"
            value={user.password}
            onChange={(event) => setUser({ ...user, password: event.target.value })}
            minLength={12}
            required
          />
        </label>
        <label>
          Đơn vị
          <select
            value={user.admin_unit_id}
            onChange={(event) => setUser({ ...user, admin_unit_id: event.target.value })}
            required
          >
            <option value="">Chọn</option>
            {active.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Tạo tài khoản</button>
      </form>
      <table aria-label="Tài khoản cấp trên">
        <thead>
          <tr>
            <th>Tên đăng nhập</th>
            <th>Họ tên</th>
            <th>Đơn vị</th>
            <th>Trạng thái</th>
            <th>Đăng nhập gần nhất</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.users.map((item) => (
            <tr key={item.id}>
              <td>{item.login}</td>
              <td>{item.full_name}</td>
              <td>{byId.get(item.admin_unit_id)?.name ?? ''}</td>
              <td>{item.status === 'active' ? 'Đang dùng' : 'Đã khóa'}</td>
              <td>{item.last_login_at ? new Date(item.last_login_at).toLocaleString('vi-VN') : ''}</td>
              <td>
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    void adminUnitsApi
                      .resetTotp(token, item.id)
                      .then((value) => setEnrollment({ title: `Cấp lại cho ${item.login}`, value }))
                      .catch((caught: unknown) => setError(messageOf(caught)))
                  }
                >
                  Cấp lại xác thực hai lớp
                </button>{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    void act(
                      () => adminUnitsApi.setStatus(token, item.id, item.status === 'active' ? 'locked' : 'active'),
                      item.status === 'active' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
                    )
                  }
                >
                  {item.status === 'active' ? 'Khóa' : 'Mở khóa'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

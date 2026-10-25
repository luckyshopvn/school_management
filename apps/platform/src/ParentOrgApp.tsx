import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PlatformValidationError } from './platform-api.js';
import {
  LEVEL_LABELS,
  parentOrgApi,
  type AccessRequest,
  type AggregateCategory,
  type AggregateView,
  type ParentOrgProfile,
} from './parent-org-api.js';

// Trang của tài khoản cấp trên (Bộ, Sở, Phòng Văn hóa – Xã hội; DT-SaaS phần S6, YCTD-202) ở `/cap-tren` của cổng nền tảng: đăng
// nhập có xác thực hai lớp, chọn nút trong phạm vi, nhóm số liệu; tổng hợp theo nút và nút con; so sánh các trường đã đồng ý; xuất
// Excel, PDF; đề nghị xem chi tiết một trường (trường duyệt), mở phiên chỉ đọc khi đã duyệt. Mã phiên chỉ giữ trong bộ nhớ
const METRIC_LABELS: Record<string, string> = {
  classes: 'Số lớp',
  students: 'Học sinh đang học',
  students_male: 'Học sinh nam',
  students_female: 'Học sinh nữ',
  days: 'Số ngày điểm danh',
  records: 'Lượt điểm danh',
  present: 'Lượt có mặt',
  absent: 'Lượt vắng',
  rate: 'Tỉ lệ chuyên cần (%)',
  subject_results_pass: 'Kết quả môn đạt',
  subject_results_fail: 'Kết quả môn chưa đạt',
  rooms: 'Số phòng',
  area_m2: 'Diện tích (m²)',
  staff: 'Nhân sự',
  staff_male: 'Nhân sự nam',
  staff_female: 'Nhân sự nữ',
  rows: 'Số dòng EMIS đã nhập',
};

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

function flatten(metrics: Record<string, unknown> | null, prefix = ''): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(metrics ?? {})) {
    if (value && typeof value === 'object') {
      out.push(...flatten(value as Record<string, unknown>, `${prefix}${key}.`));
    } else {
      out.push([`${prefix}${key}`, value]);
    }
  }
  return out;
}

function label(key: string): string {
  const [group, item] = key.split('.');
  return item ? `${group}: ${item}` : (METRIC_LABELS[key] ?? key);
}

function value(raw: unknown): string {
  if (raw === null) return 'ẩn';
  if (typeof raw === 'number') return raw.toLocaleString('vi-VN');
  return raw === undefined ? '' : String(raw);
}

function Login({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      onLoggedIn((await parentOrgApi.login(login, password, otp)).access_token);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <main className="login">
      <h1>Đơn vị cấp trên</h1>
      <form onSubmit={(event) => void submit(event)} aria-label="Đăng nhập cấp trên">
        <label>
          Tên đăng nhập
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <label>
          Mã xác thực hai lớp
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Đăng nhập</button>
      </form>
    </main>
  );
}

function Requests({ token, profile }: { token: string; profile: ParentOrgProfile }) {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [school, setSchool] = useState('');
  const [categories, setCategories] = useState<AggregateCategory[]>([]);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    parentOrgApi
      .requests(token)
      .then((reply) => setItems(reply.items))
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await parentOrgApi.createRequest(token, { school_code: school, categories, reason, hours: Number(hours) });
      setReason('');
      load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function open(id: string) {
    setError(null);
    try {
      const reply = await parentOrgApi.openRequest(token, id);
      setLink(reply.handoff.host ? `https://${reply.handoff.host}${reply.handoff.path}` : reply.handoff.path);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <section aria-label="Đề nghị xem chi tiết">
      <h3>Đề nghị xem chi tiết</h3>
      <p>
        Mặc định chỉ xem số liệu tổng hợp. Xem chi tiết một trường cần trường duyệt; phiên chỉ đọc, có hạn, ghi nhật ký
        hai phía.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <form className="inline-form" onSubmit={(event) => void submit(event)}>
        <label>
          Trường
          <select value={school} onChange={(event) => setSchool(event.target.value)} required>
            <option value="">Chọn</option>
            {profile.schools.map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Nhóm dữ liệu</legend>
          {profile.categories.map((category) => (
            <label key={category.key} className="inline">
              <input
                type="checkbox"
                checked={categories.includes(category.key)}
                onChange={(event) =>
                  setCategories(
                    event.target.checked
                      ? [...categories, category.key]
                      : categories.filter((item) => item !== category.key),
                  )
                }
              />
              {category.label}
            </label>
          ))}
        </fieldset>
        <label>
          Lý do
          <input value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} />
        </label>
        <label>
          Thời hạn (giờ)
          <input type="number" value={hours} onChange={(event) => setHours(event.target.value)} min={1} max={168} />
        </label>
        <button type="submit">Gửi đề nghị</button>
      </form>
      {link ? (
        <p className="notice">
          Đường liên kết một lần:{' '}
          <a href={link} target="_blank" rel="noreferrer" data-testid="detail-handoff">
            {link}
          </a>
        </p>
      ) : null}
      <table aria-label="Đề nghị đã gửi">
        <thead>
          <tr>
            <th>Trường</th>
            <th>Nhóm dữ liệu</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.school_name}</td>
              <td>
                {item.categories.map((key) => profile.categories.find((c) => c.key === key)?.label ?? key).join(', ')}
              </td>
              <td>{item.reason}</td>
              <td>
                {item.status === 'pending'
                  ? 'Chờ trường duyệt'
                  : item.status === 'approved'
                    ? `Đã duyệt đến ${item.expires_at ? new Date(item.expires_at).toLocaleString('vi-VN') : ''}`
                    : item.status === 'rejected'
                      ? 'Trường từ chối'
                      : 'Trường đã rút'}
              </td>
              <td>
                {item.status === 'approved' ? (
                  <button type="button" onClick={() => void open(item.id)}>
                    Mở xem chi tiết
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<ParentOrgProfile | null>(null);
  const [unitId, setUnitId] = useState('');
  const [category, setCategory] = useState<AggregateCategory>('scale');
  const [view, setView] = useState<AggregateView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    parentOrgApi
      .me(token)
      .then((me) => {
        setProfile(me);
        setUnitId(me.unit.id);
      })
      .catch(() => onLogout());
  }, [token, onLogout]);

  useEffect(() => {
    if (!unitId) return;
    setError(null);
    parentOrgApi
      .aggregate(token, unitId, category)
      .then(setView)
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token, unitId, category]);

  if (!profile) {
    return <main aria-busy="true" />;
  }
  const keys = [...new Set(view?.schools.flatMap((school) => flatten(school.metrics).map(([key]) => key)) ?? [])];
  return (
    <div className="shell">
      <header>
        <strong>
          {profile.unit.name} ({profile.level_label})
        </strong>
        <span>
          {profile.full_name}
          <button type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </span>
      </header>
      <nav aria-label="Nhóm số liệu">
        {profile.categories.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-current={item.key === category}
            onClick={() => setCategory(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main>
        <h2>Số liệu tổng hợp</h2>
        <div className="actions">
          <label>
            Đơn vị
            <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              {profile.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {LEVEL_LABELS[unit.level]}: {unit.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              void parentOrgApi.download(token, unitId, category, 'xlsx').catch((e: unknown) => setError(messageOf(e)))
            }
          >
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() =>
              void parentOrgApi.download(token, unitId, category, 'pdf').catch((e: unknown) => setError(messageOf(e)))
            }
          >
            Xuất PDF
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {view ? (
          <>
            <p>
              {view.schools_count} trường đã đồng ý cho {profile.level_label} ở nhóm này. Ô có ít hơn {view.min_group}{' '}
              người ghi "ẩn".
            </p>
            {view.total_hidden_reason ? <p className="notice">{view.total_hidden_reason}</p> : null}
            <table aria-label="Tổng hợp theo đơn vị">
              <thead>
                <tr>
                  <th>Đơn vị</th>
                  <th>Số trường</th>
                  {keys.map((key) => (
                    <th key={key}>{label(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[{ ...view.unit, schools_count: view.schools_count, total: view.total }, ...view.children].map(
                  (row) => {
                    const cells = new Map(flatten(row.total));
                    return (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.schools_count}</td>
                        {keys.map((key) => (
                          <td key={key}>{row.total ? value(cells.get(key)) : '—'}</td>
                        ))}
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
            <h3>So sánh các trường đã đồng ý</h3>
            <table aria-label="So sánh trường">
              <thead>
                <tr>
                  <th>Trường</th>
                  {keys.map((key) => (
                    <th key={key}>{label(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.schools.map((school) => {
                  const cells = new Map(flatten(school.metrics));
                  return (
                    <tr key={school.id}>
                      <td>{school.name}</td>
                      {keys.map((key) => (
                        <td key={key}>{school.metrics ? value(cells.get(key)) : 'Chưa có số liệu'}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : null}
        <Requests token={token} profile={profile} />
      </main>
    </div>
  );
}

export function ParentOrgApp() {
  const [token, setToken] = useState<string | null>(null);
  const logout = useCallback(() => setToken(null), []);
  return token ? <Dashboard token={token} onLogout={logout} /> : <Login onLoggedIn={setToken} />;
}

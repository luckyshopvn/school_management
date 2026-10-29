import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { PlatformValidationError } from './platform-api.js';
import {
  LEVEL_LABELS,
  parentOrgApi,
  type AccessRequest,
  type AggregateCategory,
  type AggregateView,
  type ParentOrgProfile,
} from './parent-org-api.js';
import './parent-org.css';

// Trang của tài khoản cấp trên (Bộ, Sở, Phòng Văn hóa – Xã hội; DT-SaaS phần S6, YCTD-202) ở `/cap-tren` của cổng nền tảng. Giao diện
// theo bản vẽ Eric duyệt ngày 2026-10-28 (YCTD-363): đăng nhập hai bước (mật khẩu rồi mã xác thực hoặc mã khôi phục); bốn trang Tổng
// hợp (cây phạm vi, chỉ số chính, nhóm số liệu, trường chưa có số liệu), So sánh trường (bảng sắp được), Xuất báo cáo, Đề nghị xem chi
// tiết (trường duyệt; phiên chỉ đọc mở ở tab mới). Mã phiên chỉ giữ trong bộ nhớ
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

type Page = 'tong-hop' | 'so-sanh' | 'xuat' | 'de-nghi';
const PAGES: Array<[Page, string]> = [
  ['tong-hop', 'Tổng hợp'],
  ['so-sanh', 'So sánh trường'],
  ['xuat', 'Xuất báo cáo'],
  ['de-nghi', 'Đề nghị xem chi tiết'],
];

function pageFromHash(): Page {
  const hash = window.location.hash.replace('#', '');
  return PAGES.some(([key]) => key === hash) ? (hash as Page) : 'tong-hop';
}

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

// Ô bị ẩn (ít hơn ngưỡng người hoặc ít trường) máy chủ trả null: hiện nhãn "ẩn", không hiện số 0
function Cell({ raw }: { raw: unknown }) {
  if (raw === null) return <span className="po-hidden">ẩn</span>;
  if (typeof raw === 'number') return <>{raw.toLocaleString('vi-VN')}</>;
  return <>{raw === undefined ? '' : String(raw)}</>;
}

const when = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
const day = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '');

function Login({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [recovery, setRecovery] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Máy chủ kiểm mật khẩu và mã cùng lúc; bước 1 chỉ giữ tên đăng nhập, mật khẩu trong bộ nhớ. Mã khôi phục đi qua cùng ô otp_code
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    try {
      onLoggedIn((await parentOrgApi.login(login, password, otp)).access_token);
    } catch (caught) {
      setError(messageOf(caught));
      setStep(1);
      setOtp('');
    }
  }

  return (
    <main className="po po-login">
      <div className="po-card">
        <div>
          <h1>Trang đơn vị cấp trên</h1>
          <p className="po-small">Sở GD&amp;ĐT, Phòng Văn hóa – Xã hội · số liệu tổng hợp của các trường đã đồng ý</p>
        </div>
        <form onSubmit={(event) => void submit(event)} aria-label="Đăng nhập cấp trên">
          {error ? (
            <p role="alert" className="po-alert">
              {error}
            </p>
          ) : null}
          {step === 1 ? (
            <>
              <h2>Đăng nhập</h2>
              <label className="po-field">
                Tên đăng nhập
                <input
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="po-field">
                Mật khẩu
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="po-btn">
                Tiếp tục
              </button>
              <p className="po-small">Quên mật khẩu: liên hệ quản trị nền tảng để cấp lại.</p>
            </>
          ) : (
            <>
              <h2>Xác thực hai lớp</h2>
              <p className="po-small">
                {recovery
                  ? 'Nhập một mã khôi phục chưa dùng. Mỗi mã chỉ dùng được một lần.'
                  : 'Nhập mã 6 số trong ứng dụng xác thực trên điện thoại của bạn.'}
              </p>
              <label className={`po-field${recovery ? '' : ' po-otp'}`}>
                {recovery ? 'Mã khôi phục' : 'Mã xác thực hai lớp'}
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  inputMode={recovery ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </label>
              <button type="submit" className="po-btn">
                Đăng nhập
              </button>
              <button
                type="button"
                className="po-linkbtn"
                onClick={() => {
                  setRecovery(!recovery);
                  setOtp('');
                }}
              >
                {recovery ? 'Dùng mã trong ứng dụng xác thực' : 'Mất điện thoại? Dùng mã khôi phục'}
              </button>
              <button type="button" className="po-linkbtn" onClick={() => setStep(1)}>
                Quay lại bước 1
              </button>
            </>
          )}
          <p className="po-small">Mỗi lần đăng nhập và mỗi lần xem số liệu được ghi nhật ký.</p>
        </form>
      </div>
    </main>
  );
}

// Cây phạm vi: đơn vị của tài khoản và các đơn vị con; số trường gồm cả trường của đơn vị con
function useScope(profile: ParentOrgProfile) {
  return useMemo(() => {
    const children = new Map<string | null, ParentOrgProfile['units']>();
    for (const unit of profile.units) {
      children.set(unit.parent_id, [...(children.get(unit.parent_id) ?? []), unit]);
    }
    const descendants = (id: string): string[] => [
      id,
      ...(children.get(id) ?? []).flatMap((child) => descendants(child.id)),
    ];
    const schoolsUnder = (id: string) => {
      const ids = new Set(descendants(id));
      return profile.schools.filter((school) => ids.has(school.admin_unit_id)).length;
    };
    return { children, schoolsUnder };
  }, [profile]);
}

function ScopeTree({
  profile,
  unitId,
  onSelect,
}: {
  profile: ParentOrgProfile;
  unitId: string;
  onSelect: (id: string) => void;
}) {
  const { children, schoolsUnder } = useScope(profile);
  const render = (unit: ParentOrgProfile['units'][number], depth: number): ReactNode => (
    <li key={unit.id}>
      <button
        type="button"
        aria-current={unit.id === unitId}
        style={{ paddingLeft: 10 + depth * 16 }}
        onClick={() => onSelect(unit.id)}
      >
        <span>
          {LEVEL_LABELS[unit.level]}: {unit.name}
        </span>
        <small>{schoolsUnder(unit.id)} trường</small>
      </button>
      {(children.get(unit.id) ?? []).length ? (
        <ul className="po-tree">{(children.get(unit.id) ?? []).map((child) => render(child, depth + 1))}</ul>
      ) : null}
    </li>
  );
  const root = profile.units.find((unit) => unit.id === profile.unit.id);
  return (
    <aside className="po-card" aria-label="Phạm vi của bạn">
      <h3>Phạm vi của bạn</h3>
      <ul className="po-tree">{root ? render(root, 0) : null}</ul>
      <p className="po-small">Bấm một đơn vị để xem số liệu của đơn vị đó và các đơn vị con.</p>
    </aside>
  );
}

function UnitSelect({
  profile,
  unitId,
  onChange,
}: {
  profile: ParentOrgProfile;
  unitId: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="po-field">
      Đơn vị
      <select value={unitId} onChange={(event) => onChange(event.target.value)}>
        {profile.units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {LEVEL_LABELS[unit.level]}: {unit.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategoryChips({
  profile,
  category,
  onChange,
}: {
  profile: ParentOrgProfile;
  category: AggregateCategory;
  onChange: (key: AggregateCategory) => void;
}) {
  return (
    <div className="po-chips" role="group" aria-label="Nhóm số liệu">
      {profile.categories.map((item) => (
        <button key={item.key} type="button" aria-pressed={item.key === category} onClick={() => onChange(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function useAggregate(token: string, unitId: string, category: AggregateCategory) {
  const [view, setView] = useState<AggregateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!unitId) return;
    let active = true;
    setError(null);
    parentOrgApi
      .aggregate(token, unitId, category)
      .then((next) => {
        if (active) setView(next);
      })
      .catch((caught: unknown) => {
        if (active) setError(messageOf(caught));
      });
    return () => {
      active = false;
    };
  }, [token, unitId, category]);
  return { view, error, setError };
}

// Bốn chỉ số chính đọc tổng của đơn vị ở nhóm Quy mô, Chuyên cần, Nhân sự (nhóm nào tài khoản không được xem thì bỏ qua)
function Kpis({ token, profile, unitId }: { token: string; profile: ParentOrgProfile; unitId: string }) {
  const [views, setViews] = useState<Partial<Record<AggregateCategory, AggregateView>>>({});
  useEffect(() => {
    let active = true;
    const wanted = (['scale', 'attendance', 'staff'] as const).filter((key) =>
      profile.categories.some((item) => item.key === key),
    );
    void Promise.all(
      wanted.map((key) =>
        parentOrgApi
          .aggregate(token, unitId, key)
          .then((view) => [key, view] as const)
          .catch(() => null),
      ),
    ).then((rows) => {
      if (active) setViews(Object.fromEntries(rows.filter((row) => row !== null)));
    });
    return () => {
      active = false;
    };
  }, [token, profile, unitId]);
  const total = (key: AggregateCategory) => views[key]?.total ?? null;
  const pick = (key: AggregateCategory, field: string): unknown =>
    views[key] ? (views[key]?.total ? (total(key)?.[field] ?? null) : null) : undefined;
  const scope = useScope(profile).schoolsUnder(unitId);
  const withData = Math.max(
    0,
    ...Object.values(views).map((view) => view?.schools.filter((school) => school.metrics).length ?? 0),
  );
  return (
    <div className="po-kpis">
      <div className="po-card po-kpi">
        <span>Trường có số liệu</span>
        <strong>
          {withData} / {scope}
        </strong>
        <span>Trường chưa đồng ý không có mặt</span>
      </div>
      <div className="po-card po-kpi">
        <span>Học sinh đang học</span>
        <strong>
          <Cell raw={pick('scale', 'students')} />
        </strong>
        <span>
          Nam <Cell raw={pick('scale', 'students_male')} /> · nữ <Cell raw={pick('scale', 'students_female')} />
        </span>
      </div>
      <div className="po-card po-kpi">
        <span>Tỉ lệ chuyên cần</span>
        <strong>
          <Cell raw={pick('attendance', 'rate')} /> %
        </strong>
        <span>
          <Cell raw={pick('attendance', 'days')} /> ngày điểm danh
        </span>
      </div>
      <div className="po-card po-kpi">
        <span>Nhân sự</span>
        <strong>
          <Cell raw={pick('staff', 'staff')} />
        </strong>
        <span>
          Nam <Cell raw={pick('staff', 'staff_male')} /> · nữ <Cell raw={pick('staff', 'staff_female')} />
        </span>
      </div>
    </div>
  );
}

function download(token: string, unitId: string, category: AggregateCategory, format: 'xlsx' | 'pdf') {
  return parentOrgApi.download(token, unitId, category, format);
}

function Summary({
  token,
  profile,
  unitId,
  onUnit,
}: {
  token: string;
  profile: ParentOrgProfile;
  unitId: string;
  onUnit: (id: string) => void;
}) {
  const [category, setCategory] = useState<AggregateCategory>(profile.categories[0]?.key ?? 'scale');
  const { view, error, setError } = useAggregate(token, unitId, category);
  const scope = useScope(profile).schoolsUnder(unitId);
  const unit = profile.units.find((item) => item.id === unitId) ?? profile.unit;
  const keys = [...new Set(view?.schools.flatMap((school) => flatten(school.metrics).map(([key]) => key)) ?? [])];
  const captured = view?.schools
    .map((school) => school.captured_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const noSnapshot = view?.schools.filter((school) => !school.metrics).length ?? 0;
  const notConsented = view ? Math.max(0, scope - view.schools.length) : 0;
  return (
    <div className="po-split">
      <ScopeTree profile={profile} unitId={unitId} onSelect={onUnit} />
      <div className="po-main" style={{ padding: 0 }}>
        <div className="po-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>Số liệu tổng hợp: {unit.name}</h2>
            <p className="po-lead">
              {captured ? `Số liệu chụp lúc ${when(captured)}, ` : 'Chưa có bản chụp số liệu, '}cập nhật mỗi 6 giờ
            </p>
          </div>
          <div className="po-row">
            <button
              type="button"
              className="po-btn2"
              onClick={() =>
                void download(token, unitId, category, 'xlsx').catch((e: unknown) => setError(messageOf(e)))
              }
            >
              Xuất Excel
            </button>
            <button
              type="button"
              className="po-btn2"
              onClick={() =>
                void download(token, unitId, category, 'pdf').catch((e: unknown) => setError(messageOf(e)))
              }
            >
              Xuất PDF
            </button>
          </div>
        </div>
        <Kpis token={token} profile={profile} unitId={unitId} />
        <section className="po-card" aria-label="Theo nhóm số liệu">
          <h3>Theo nhóm số liệu</h3>
          <CategoryChips profile={profile} category={category} onChange={setCategory} />
          {error ? (
            <p role="alert" className="po-alert">
              {error}
            </p>
          ) : null}
          {view?.total_hidden_reason ? <p className="po-note">{view.total_hidden_reason}</p> : null}
          {view ? (
            <div className="po-scroll">
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
                  {view.children.map((row) => {
                    const cells = new Map(flatten(row.total));
                    return (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.schools_count}</td>
                        {keys.map((key) => (
                          <td key={key}>{row.total ? <Cell raw={cells.get(key)} /> : '—'}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Cộng {view.unit.name}</td>
                    <td>{view.schools_count}</td>
                    {keys.map((key) => (
                      <td key={key}>{view.total ? <Cell raw={new Map(flatten(view.total)).get(key)} /> : '—'}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
          <p className="po-small">
            "ẩn": ô có ít hơn {view?.min_group ?? '…'} người, hoặc nhóm quá ít trường, không hiện để không suy ra được
            từng trường hay từng em.
          </p>
        </section>
        {view && (noSnapshot > 0 || notConsented > 0) ? (
          <section className="po-card" aria-label="Trường chưa có số liệu">
            <h3>Trường chưa có số liệu ở đơn vị này</h3>
            <p className="po-lead">
              {notConsented} trường chưa đồng ý chia sẻ nhóm này, {noSnapshot} trường chưa gửi bản chụp. Cấp trên không
              xem được tên trường chưa đồng ý.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// Trường đang được xem chi tiết: đề nghị đã duyệt còn hạn
function activeDetail(requests: AccessRequest[], schoolCode: string, now: number) {
  return requests.find(
    (item) =>
      item.school_code === schoolCode &&
      item.status === 'approved' &&
      item.expires_at !== null &&
      new Date(item.expires_at).getTime() > now,
  );
}

function Compare({
  token,
  profile,
  unitId,
  onUnit,
  requests,
  onRequest,
}: {
  token: string;
  profile: ParentOrgProfile;
  unitId: string;
  onUnit: (id: string) => void;
  requests: AccessRequest[];
  onRequest: (schoolCode: string) => void;
}) {
  const [category, setCategory] = useState<AggregateCategory>(profile.categories[0]?.key ?? 'scale');
  const [sort, setSort] = useState<{ key: string; descending: boolean }>({ key: 'name', descending: false });
  const { view, error, setError } = useAggregate(token, unitId, category);
  const keys = [...new Set(view?.schools.flatMap((school) => flatten(school.metrics).map(([key]) => key)) ?? [])];
  const now = Date.now();
  const rows = (view?.schools ?? []).map((school) => ({ school, cells: new Map(flatten(school.metrics)) }));
  rows.sort((left, right) => {
    const direction = sort.descending ? -1 : 1;
    if (sort.key === 'name') return direction * left.school.name.localeCompare(right.school.name, 'vi');
    const a = left.cells.get(sort.key);
    const b = right.cells.get(sort.key);
    // Trường chưa có số liệu và ô ẩn luôn ở cuối bảng
    if (typeof a !== 'number') return typeof b === 'number' ? 1 : 0;
    if (typeof b !== 'number') return -1;
    return direction * (a - b);
  });
  const header = (key: string, text: string) => (
    <th key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'} scope="col">
      <button
        type="button"
        className="po-sort"
        onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : key !== 'name' })}
      >
        {text}
        <span aria-hidden="true">{sort.key === key ? (sort.descending ? '↓' : '↑') : '↕'}</span>
      </button>
    </th>
  );
  const categoryLabel = profile.categories.find((item) => item.key === category)?.label ?? category;
  return (
    <>
      <div>
        <h2>So sánh các trường đã đồng ý</h2>
        <p className="po-lead">
          Chỉ trường bật đồng ý cho cấp của bạn và cho nhóm số liệu đang chọn mới có mặt trong bảng.
        </p>
      </div>
      <div className="po-card">
        <div className="po-row">
          <UnitSelect profile={profile} unitId={unitId} onChange={onUnit} />
          <label className="po-field">
            Nhóm số liệu
            <select value={category} onChange={(event) => setCategory(event.target.value as AggregateCategory)}>
              {profile.categories.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <section className="po-card" aria-label="Bảng so sánh">
        <div className="po-row" style={{ justifyContent: 'space-between' }}>
          <h3>
            {view?.schools.length ?? 0} trường · {categoryLabel}
          </h3>
          <button
            type="button"
            className="po-btn2"
            onClick={() => void download(token, unitId, category, 'xlsx').catch((e: unknown) => setError(messageOf(e)))}
          >
            Xuất bảng này
          </button>
        </div>
        {error ? (
          <p role="alert" className="po-alert">
            {error}
          </p>
        ) : null}
        {view?.total_hidden_reason ? <p className="po-note">{view.total_hidden_reason}</p> : null}
        <div className="po-scroll">
          <table aria-label="So sánh trường">
            <thead>
              <tr>
                {header('name', 'Trường')}
                {keys.map((key) => header(key, label(key)))}
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ school, cells }) => {
                const detail = activeDetail(requests, school.code, now);
                return (
                  <tr key={school.id}>
                    <td>{school.name}</td>
                    {school.metrics ? (
                      keys.map((key) => (
                        <td key={key}>
                          <Cell raw={cells.get(key)} />
                        </td>
                      ))
                    ) : (
                      <td colSpan={Math.max(1, keys.length)} style={{ textAlign: 'left' }}>
                        Chưa có số liệu: trường chưa gửi bản chụp kỳ này
                      </td>
                    )}
                    <td>
                      {detail ? (
                        `Đang được xem chi tiết đến ${day(detail.expires_at)}`
                      ) : (
                        <button type="button" className="po-linkbtn" onClick={() => onRequest(school.code)}>
                          Đề nghị xem chi tiết
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="po-small">Ô "ẩn" và trường chưa có số liệu luôn xếp cuối khi sắp theo một cột số.</p>
      </section>
    </>
  );
}

function Export({
  token,
  profile,
  unitId,
  onUnit,
}: {
  token: string;
  profile: ParentOrgProfile;
  unitId: string;
  onUnit: (id: string) => void;
}) {
  const [categories, setCategories] = useState<AggregateCategory[]>(profile.categories.slice(0, 1).map((c) => c.key));
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Máy chủ xuất mỗi nhóm một tệp, tải trực tiếp (chưa có danh sách tệp đã xuất ở máy chủ)
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      for (const category of categories) await download(token, unitId, category, format);
      setMessage(`Đã tạo ${categories.length} tệp.`);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <h2>Xuất báo cáo</h2>
        <p className="po-lead">Tệp chỉ chứa số liệu tổng hợp, cùng quy tắc ẩn ô nhỏ như trên màn hình.</p>
      </div>
      <form className="po-card" aria-label="Xuất báo cáo" onSubmit={(event) => void submit(event)}>
        <UnitSelect profile={profile} unitId={unitId} onChange={onUnit} />
        <fieldset className="po-checks">
          <legend>Nhóm số liệu (mỗi nhóm một tệp)</legend>
          {profile.categories.map((item) => (
            <label key={item.key} className="po-check">
              <input
                type="checkbox"
                checked={categories.includes(item.key)}
                onChange={(event) =>
                  setCategories(
                    event.target.checked ? [...categories, item.key] : categories.filter((key) => key !== item.key),
                  )
                }
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="po-checks">
          <legend>Định dạng</legend>
          <label className="po-check">
            <input type="radio" name="format" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
            Excel (.xlsx)
          </label>
          <label className="po-check">
            <input type="radio" name="format" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
            PDF
          </label>
        </fieldset>
        {error ? (
          <p role="alert" className="po-alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="po-note">
            {message}
          </p>
        ) : null}
        <div className="po-row">
          <button type="submit" className="po-btn" disabled={busy || categories.length === 0}>
            {busy ? 'Đang tạo tệp…' : 'Tạo tệp'}
          </button>
          <span className="po-small">Lần xuất được ghi vào nhật ký truy cập.</span>
        </div>
      </form>
    </>
  );
}

const REQUEST_STATUS: Record<AccessRequest['status'], string> = {
  pending: 'Chờ trường duyệt',
  approved: 'Trường đã duyệt',
  rejected: 'Trường từ chối',
  revoked: 'Trường đã rút',
};

function Requests({
  token,
  profile,
  items,
  reload,
  school,
  onSchool,
}: {
  token: string;
  profile: ParentOrgProfile;
  items: AccessRequest[];
  reload: () => void;
  school: string;
  onSchool: (code: string) => void;
}) {
  const [categories, setCategories] = useState<AggregateCategory[]>([]);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await parentOrgApi.createRequest(token, { school_code: school, categories, reason, hours: Number(hours) });
      setReason('');
      setMessage('Đã gửi đề nghị. Quản trị của trường sẽ duyệt hoặc từ chối.');
      reload();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  // Mở tab trước khi gọi máy chủ để trình duyệt không chặn cửa sổ bật lên; đường liên kết dùng một lần
  async function open(id: string) {
    setError(null);
    const tab = window.open('about:blank', '_blank');
    try {
      const reply = await parentOrgApi.openRequest(token, id);
      const link = reply.handoff.host ? `https://${reply.handoff.host}${reply.handoff.path}` : reply.handoff.path;
      if (tab) {
        tab.opener = null;
        tab.location.href = link;
      } else {
        window.location.assign(link);
      }
    } catch (caught) {
      tab?.close();
      setError(messageOf(caught));
    }
  }

  const categoryLabel = (key: AggregateCategory) => profile.categories.find((c) => c.key === key)?.label ?? key;
  const now = Date.now();
  return (
    <>
      <div>
        <h2>Đề nghị xem chi tiết một trường</h2>
        <p className="po-lead">Mặc định cấp trên chỉ thấy số liệu tổng hợp. Xem chi tiết cần quản trị trường duyệt.</p>
      </div>
      {error ? (
        <p role="alert" className="po-alert">
          {error}
        </p>
      ) : null}
      <form className="po-card" aria-label="Gửi đề nghị xem chi tiết" onSubmit={(event) => void submit(event)}>
        <div className="po-row">
          <label className="po-field">
            Trường
            <select value={school} onChange={(event) => onSchool(event.target.value)} required>
              <option value="">Chọn trường</option>
              {profile.schools.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="po-field">
            Xem trong (giờ, tối đa 168)
            <input type="number" value={hours} onChange={(event) => setHours(event.target.value)} min={1} max={168} />
          </label>
        </div>
        <fieldset className="po-checks">
          <legend>Nhóm dữ liệu muốn xem</legend>
          {profile.categories.map((category) => (
            <label key={category.key} className="po-check">
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
        <label className="po-field">
          Lý do
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={5}
            rows={3}
          />
        </label>
        <p className="po-note">
          Khi trường duyệt, bạn mở được một phiên chỉ đọc trong cổng quản trị của trường, chỉ các nhóm đã duyệt, đến hết
          hạn. Mỗi lần xem ghi ở nhật ký của trường và của nền tảng. Người xem: {profile.full_name} (bạn).
        </p>
        {message ? (
          <p role="status" className="po-note">
            {message}
          </p>
        ) : null}
        <div>
          <button type="submit" className="po-btn">
            Gửi đề nghị
          </button>
        </div>
      </form>
      <section className="po-card" aria-label="Đề nghị đã gửi">
        <h3>Đề nghị đã gửi</h3>
        {items.length === 0 ? <p className="po-small">Chưa có đề nghị.</p> : null}
        <ul className="po-requests">
          {items.map((item) => {
            const expired = item.status === 'approved' && item.expires_at && new Date(item.expires_at).getTime() <= now;
            return (
              <li key={item.id} className="po-request" aria-label={`Đề nghị ${item.school_name}`}>
                <div className="po-row" style={{ alignItems: 'center' }}>
                  <strong>{item.school_name}</strong>
                  <span className={`po-chip po-chip-${expired ? 'revoked' : item.status}`}>
                    {expired ? 'Đã hết hạn' : REQUEST_STATUS[item.status]}
                  </span>
                </div>
                <span className="po-small">
                  {item.categories.map(categoryLabel).join(', ')} · gửi {day(item.created_at)}
                  {item.status === 'approved' && item.expires_at ? ` · xem đến ${when(item.expires_at)}` : ''}
                  {item.decided_by_name ? ` · trả lời bởi ${item.decided_by_name}` : ''} · lý do: {item.reason}
                </span>
                {item.status === 'approved' && !expired ? (
                  <div className="po-row" style={{ alignItems: 'center' }}>
                    <button type="button" className="po-btn" onClick={() => void open(item.id)}>
                      Mở phiên xem chi tiết
                    </button>
                    <span className="po-small">Mở cổng quản trị của trường ở tab mới</span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<ParentOrgProfile | null>(null);
  const [unitId, setUnitId] = useState('');
  const [page, setPage] = useState<Page>(pageFromHash);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [requestSchool, setRequestSchool] = useState('');

  useEffect(() => {
    parentOrgApi
      .me(token)
      .then((me) => {
        setProfile(me);
        setUnitId(me.unit.id);
      })
      .catch(() => onLogout());
  }, [token, onLogout]);

  const loadRequests = useCallback(() => {
    parentOrgApi
      .requests(token)
      .then((reply) => setRequests(reply.items))
      .catch(() => setRequests([]));
  }, [token]);
  useEffect(loadRequests, [loadRequests]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!profile) {
    return <main className="po" aria-busy="true" />;
  }
  return (
    <div className="po">
      <header className="po-top">
        <div className="po-top-row">
          <strong>Trang đơn vị cấp trên</strong>
          <span className="po-user">
            {profile.full_name} · {profile.unit.name}
            <button type="button" onClick={onLogout}>
              Đăng xuất
            </button>
          </span>
        </div>
        <nav className="po-tabs" aria-label="Trang cấp trên">
          {PAGES.map(([key, text]) => (
            <a key={key} href={`#${key}`} aria-current={key === page ? 'page' : undefined}>
              {text}
            </a>
          ))}
        </nav>
      </header>
      <main className="po-main">
        {page === 'tong-hop' ? <Summary token={token} profile={profile} unitId={unitId} onUnit={setUnitId} /> : null}
        {page === 'so-sanh' ? (
          <Compare
            token={token}
            profile={profile}
            unitId={unitId}
            onUnit={setUnitId}
            requests={requests}
            onRequest={(code) => {
              setRequestSchool(code);
              window.location.hash = 'de-nghi';
            }}
          />
        ) : null}
        {page === 'xuat' ? <Export token={token} profile={profile} unitId={unitId} onUnit={setUnitId} /> : null}
        {page === 'de-nghi' ? (
          <Requests
            token={token}
            profile={profile}
            items={requests}
            reload={loadRequests}
            school={requestSchool}
            onSchool={setRequestSchool}
          />
        ) : null}
      </main>
    </div>
  );
}

export function ParentOrgApp() {
  const [token, setToken] = useState<string | null>(null);
  const logout = useCallback(() => setToken(null), []);
  return token ? <Dashboard token={token} onLogout={logout} /> : <Login onLoggedIn={setToken} />;
}

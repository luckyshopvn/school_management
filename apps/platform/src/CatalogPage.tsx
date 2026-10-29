import { OpenSchoolButton } from './OpenSchoolButton.js';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  catalogApi,
  type CatalogImportReport,
  type CatalogOverview,
  type CatalogUnitRow,
  type LoginPageSettings,
} from './catalog-api.js';
import { PlatformValidationError, type SupportAccessPolicy } from './platform-api.js';

// Danh mục đơn vị toàn quốc và đăng nhập theo đơn vị ở cổng nền tảng (DT-24, YCTD-220; tài liệu 47 mục 16):
// - số liệu danh mục, các lần nhập gần đây;
// - nhập hoặc cập nhật từ CSV (đơn vị hoặc phường, xã), chạy thử trước, báo cáo thêm, sửa, giữ nguyên, bỏ qua và cờ chất lượng;
// - tra cứu đơn vị theo sở, cấp, cờ, chữ; thấy trường đã khởi tạo gắn với đơn vị;
// - tiêu đề và chân trang thông tin hỗ trợ của trang đăng nhập ở tên miền chung;
// - chính sách vào trường của quản trị nền tảng (mặc định vào mọi trường; đổi cần mã xác thực hai lớp).
// Kho mã công khai không chứa danh mục thật: tệp thật chỉ nạp ở máy chủ triển khai
const KIND_LABELS = { units: 'Đơn vị (trường)', communes: 'Phường, xã' } as const;

const TOTAL_LABELS: Array<[keyof CatalogImportReport['totals'], string]> = [
  ['rows_read', 'Dòng đã đọc'],
  ['departments_inserted', 'Sở thêm mới'],
  ['departments_updated', 'Sở sửa tên'],
  ['communes_inserted', 'Phường, xã thêm mới'],
  ['communes_updated', 'Phường, xã sửa'],
  ['units_inserted', 'Đơn vị thêm mới'],
  ['units_updated', 'Đơn vị sửa'],
  ['units_unchanged', 'Đơn vị giữ nguyên'],
  ['units_skipped', 'Dòng bỏ qua'],
  ['units_flagged', 'Đơn vị gắn cờ'],
  ['units_missing', 'Đơn vị không còn trong tệp'],
  ['units_deactivated', 'Chuyển ngừng hoạt động'],
];

function messageOf(caught: unknown): string {
  if (caught instanceof PlatformValidationError && caught.problems.length) {
    return caught.problems.map((problem) => problem.message).join('; ');
  }
  return caught instanceof Error ? caught.message : 'Không thực hiện được';
}

export function CatalogPage({ token }: { token: string }) {
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    catalogApi
      .overview(token)
      .then(setOverview)
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  useEffect(load, [load]);

  return (
    <section>
      <h2>Danh mục đơn vị</h2>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      {overview ? (
        <dl className="facts" aria-label="Số liệu danh mục">
          <dt>Sở GD&ĐT</dt>
          <dd>{overview.departments}</dd>
          <dt>Phường, xã</dt>
          <dd>{overview.communes}</dd>
          <dt>Đơn vị</dt>
          <dd data-testid="catalog-units">{overview.units}</dd>
          <dt>Theo cấp học</dt>
          <dd>{overview.levels.map((level) => `${level.name}: ${overview.by_level[level.code] ?? 0}`).join('; ')}</dd>
          <dt>Cờ chất lượng</dt>
          <dd>
            {Object.entries(overview.flags)
              .map(([flag, count]) => `${overview.flag_labels[flag] ?? flag}: ${count}`)
              .join('; ') || 'Không có'}
          </dd>
          <dt>Trường đã gắn mã Bộ</dt>
          <dd>{overview.linked_schools}</dd>
        </dl>
      ) : null}
      <ImportForm
        token={token}
        onDone={(message) => {
          setNotice(message);
          load();
        }}
      />
      {overview ? <UnitSearch token={token} overview={overview} /> : null}
      {overview?.runs.length ? (
        <table aria-label="Các lần nhập gần đây">
          <thead>
            <tr>
              <th>Lúc</th>
              <th>Tệp</th>
              <th>Người nhập</th>
              <th>Thêm</th>
              <th>Sửa</th>
              <th>Bỏ qua</th>
            </tr>
          </thead>
          <tbody>
            {overview.runs.map((run) => (
              <tr key={run.id}>
                <td>
                  {new Date(run.started_at).toLocaleString('vi-VN')}
                  {run.dry_run ? ' (chạy thử)' : ''}
                </td>
                <td>{run.file_name ?? run.source}</td>
                <td>{run.actor_name}</td>
                <td>{run.totals.units_inserted ?? 0}</td>
                <td>{run.totals.units_updated ?? 0}</td>
                <td>{run.totals.units_skipped ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <LoginPageForm token={token} />
      <AccessPolicyForm token={token} />
    </section>
  );
}

function ImportForm({ token, onDone }: { token: string; onDone: (message: string) => void }) {
  const [kind, setKind] = useState<'units' | 'communes'>('units');
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CatalogImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Chọn tệp CSV');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const result = await catalogApi.importCsv(token, text, {
        kind,
        file_name: file.name,
        dry_run: dryRun,
        deactivate_missing: deactivateMissing,
      });
      setReport(result);
      onDone(result.dry_run ? 'Đã chạy thử, chưa ghi danh mục' : 'Đã nhập danh mục');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="wizard" aria-label="Nhập danh mục từ CSV" onSubmit={(event) => void submit(event)}>
      <fieldset>
        <legend>Nhập hoặc cập nhật danh mục từ CSV (UTF-8)</legend>
        {error ? <p role="alert">{error}</p> : null}
        <label>
          Loại tệp
          <select value={kind} onChange={(event) => setKind(event.target.value as 'units' | 'communes')}>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tệp CSV
          <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
          Chạy thử (chỉ xem báo cáo, chưa ghi)
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={deactivateMissing}
            onChange={(event) => setDeactivateMissing(event.target.checked)}
          />
          Đơn vị của các sở có trong tệp mà không còn trong tệp thì chuyển ngừng hoạt động
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Đang nhập...' : 'Nhập danh mục'}
        </button>
      </fieldset>
      {report ? (
        <div aria-label="Báo cáo nhập">
          <table>
            <tbody>
              {TOTAL_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <th>{label}</th>
                  <td>{report.totals[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.skipped.length ? (
            <ul aria-label="Dòng bỏ qua">
              {report.skipped.slice(0, 50).map((row) => (
                <li key={`${row.line}-${row.reason}`}>
                  Dòng {row.line}: {row.reason}
                  {row.code ? ` [${row.code}]` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function UnitSearch({ token, overview }: { token: string; overview: CatalogOverview }) {
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [flag, setFlag] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogUnitRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(offset: number) {
    setError(null);
    try {
      const page = await catalogApi.units(token, { department, q, level, flag, offset, include_inactive: true });
      setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
      setHasMore(page.has_more);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <form
      className="inline-form"
      aria-label="Tra cứu đơn vị"
      onSubmit={(event) => {
        event.preventDefault();
        void search(0);
      }}
    >
      {error ? <p role="alert">{error}</p> : null}
      <label>
        Sở
        <select value={department} onChange={(event) => setDepartment(event.target.value)} required>
          <option value="">Chọn sở</option>
          {overview.department_list.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cấp học
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">Mọi cấp</option>
          {overview.levels.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cờ
        <select value={flag} onChange={(event) => setFlag(event.target.value)}>
          <option value="">Mọi đơn vị</option>
          {Object.entries(overview.flag_labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tên hoặc mã
        <input value={q} onChange={(event) => setQ(event.target.value)} maxLength={100} />
      </label>
      <button type="submit">Tìm</button>
      {items.length ? (
        <table aria-label="Kết quả tra cứu đơn vị">
          <thead>
            <tr>
              <th>Mã Bộ</th>
              <th>Tên</th>
              <th>Phường, xã</th>
              <th>Cấp</th>
              <th>Cờ</th>
              <th>Trường đã khởi tạo</th>
              <th>Vào trường</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.moet_code}>
                <td>{item.moet_code}</td>
                <td>
                  {item.name}
                  {item.status === 'inactive' ? ' (ngừng hoạt động)' : ''}
                </td>
                <td>{item.commune_name ?? ''}</td>
                <td>{item.levels.join(', ')}</td>
                <td>{item.quality_flags.map((value) => overview.flag_labels[value] ?? value).join('; ')}</td>
                <td>{item.school_code ?? ''}</td>
                <td>
                  {item.status === 'inactive' ? null : (
                    <OpenSchoolButton
                      token={token}
                      moetCode={item.moet_code}
                      label={item.school_code ? 'Vào trường' : 'Khởi tạo và vào trường'}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {hasMore ? (
        <button type="button" onClick={() => void search(items.length)}>
          Xem thêm
        </button>
      ) : null}
    </form>
  );
}

// Chọn một đơn vị trong danh mục (khởi tạo trường, gắn trường đã có): chọn sở, gõ tên hoặc mã, bấm Chọn
export function CatalogUnitPicker({
  token,
  onPick,
  label = 'Chọn từ danh mục đơn vị',
}: {
  token: string;
  onPick: (unit: CatalogUnitRow) => void;
  label?: string;
}) {
  const [departments, setDepartments] = useState<Array<{ code: string; name: string }>>([]);
  const [department, setDepartment] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogUnitRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .overview(token)
      .then((value) => setDepartments(value.department_list))
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);

  async function search() {
    setError(null);
    try {
      setItems((await catalogApi.units(token, { department, q })).items);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  if (!departments.length) {
    return error ? <p role="alert">{error}</p> : null;
  }
  return (
    <div role="group" aria-label={label} className="inline-form">
      {error ? <p role="alert">{error}</p> : null}
      <label>
        Sở (danh mục)
        <select value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">Chọn sở</option>
          {departments.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tên hoặc mã Bộ
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void search();
            }
          }}
        />
      </label>
      <button type="button" disabled={!department} onClick={() => void search()}>
        Tìm đơn vị
      </button>
      {items.length ? (
        <ul aria-label="Đơn vị tìm được">
          {items.map((item) => (
            <li key={item.moet_code}>
              {item.moet_code} {item.name}
              {item.commune_name ? `, ${item.commune_name}` : ''} ({item.levels.join(', ')})
              {item.school_code ? ` — đã gắn trường ${item.school_code}` : ''}{' '}
              <button type="button" disabled={Boolean(item.school_code)} onClick={() => onPick(item)}>
                Chọn {item.moet_code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LoginPageForm({ token }: { token: string }) {
  const [settings, setSettings] = useState<LoginPageSettings | null>(null);
  const [lines, setLines] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .loginPage(token)
      .then((value) => {
        setSettings(value);
        setLines(value.support_lines.join('\n'));
      })
      .catch((caught: unknown) => setMessage(messageOf(caught)));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    try {
      const saved = await catalogApi.saveLoginPage(token, {
        ...settings,
        support_lines: lines
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      setSettings(saved);
      setMessage('Đã lưu trang đăng nhập');
    } catch (caught) {
      setMessage(messageOf(caught));
    }
  }

  if (!settings) {
    return null;
  }
  return (
    <form className="wizard" aria-label="Trang đăng nhập ở tên miền chung" onSubmit={(event) => void submit(event)}>
      <fieldset>
        <legend>Trang đăng nhập ở tên miền chung</legend>
        {message ? <p className="notice">{message}</p> : null}
        <p>
          Không dùng tên, quốc huy hay biểu trưng của cơ quan nhà nước; tiêu đề là tên của nền tảng. Trường có tên miền
          riêng dùng tên và biểu trưng của trường (Thiết lập, Thương hiệu).
        </p>
        <label>
          Tiêu đề
          <input
            value={settings.title}
            onChange={(event) => setSettings({ ...settings, title: event.target.value })}
            maxLength={120}
            required
          />
        </label>
        <label>
          Dòng phụ
          <input
            value={settings.subtitle}
            onChange={(event) => setSettings({ ...settings, subtitle: event.target.value })}
            maxLength={120}
          />
        </label>
        <label>
          Thông tin hỗ trợ ở chân trang (mỗi dòng một mục, tối đa 6)
          <textarea value={lines} onChange={(event) => setLines(event.target.value)} rows={3} />
        </label>
        <button type="submit">Lưu trang đăng nhập</button>
      </fieldset>
    </form>
  );
}

function AccessPolicyForm({ token }: { token: string }) {
  const [policy, setPolicy] = useState<SupportAccessPolicy | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .policy(token)
      .then(setPolicy)
      .catch((caught: unknown) => setMessage(messageOf(caught)));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!policy) {
      return;
    }
    try {
      setPolicy(await catalogApi.savePolicy(token, { ...policy, otp_code: otpCode.trim() }));
      setOtpCode('');
      setMessage('Đã lưu chính sách');
    } catch (caught) {
      setMessage(messageOf(caught));
    }
  }

  if (!policy) {
    return null;
  }
  return (
    <form
      className="wizard"
      aria-label="Chính sách vào trường của quản trị nền tảng"
      onSubmit={(event) => void submit(event)}
    >
      <fieldset>
        <legend>Chính sách vào trường của quản trị nền tảng</legend>
        {message ? <p className="notice">{message}</p> : null}
        <label className="inline">
          <input
            type="radio"
            name="mode"
            checked={policy.mode === 'any_school'}
            onChange={() => setPolicy({ ...policy, mode: 'any_school' })}
          />
          Vào mọi trường đã khởi tạo, không cần trường đồng ý (bắt buộc xác thực hai lớp, lý do, có hạn, ghi nhật ký)
        </label>
        <label className="inline">
          <input
            type="radio"
            name="mode"
            checked={policy.mode === 'school_grant'}
            onChange={() => setPolicy({ ...policy, mode: 'school_grant' })}
          />
          Chỉ khi trường cho phép (hợp đồng xử lý dữ liệu đòi trường đồng ý); phiên đang mở theo quyền nền tảng kết thúc
        </label>
        <label>
          Số giờ mặc định
          <input
            type="number"
            min={1}
            max={8}
            value={policy.default_hours}
            onChange={(event) => setPolicy({ ...policy, default_hours: Number(event.target.value) })}
          />
        </label>
        <label>
          Số giờ tối đa
          <input
            type="number"
            min={1}
            max={8}
            value={policy.max_hours}
            onChange={(event) => setPolicy({ ...policy, max_hours: Number(event.target.value) })}
          />
        </label>
        <label>
          Mã xác thực hai lớp
          <input
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            required
          />
        </label>
        <button type="submit">Lưu chính sách</button>
      </fieldset>
    </form>
  );
}

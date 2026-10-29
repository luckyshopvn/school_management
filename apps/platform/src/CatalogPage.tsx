import { OpenSchoolButton } from './OpenSchoolButton.js';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import {
  catalogApi,
  type CatalogImportReport,
  type CatalogOverview,
  type CatalogUnitRow,
  type LoginPageSettings,
} from './catalog-api.js';
import { type SupportAccessPolicy } from './platform-api.js';
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  errorMessage,
  fieldError,
  LoadError,
  OutcomeBanner,
  Skeleton,
  TabList,
  TabPanel,
  useBusy,
  type Outcome,
} from './platform-ui.js';

// Danh mục đơn vị toàn quốc và đăng nhập theo đơn vị ở cổng nền tảng (DT-24, YCTD-220; tài liệu 32 mục 16):
// - số liệu danh mục, các lần nhập gần đây;
// - nhập hoặc cập nhật từ CSV (đơn vị hoặc phường, xã), chạy thử trước, báo cáo thêm, sửa, giữ nguyên, bỏ qua và cờ chất lượng;
// - tra cứu đơn vị theo sở, cấp, cờ, chữ; thấy trường đã khởi tạo gắn với đơn vị;
// - tiêu đề và chân trang thông tin hỗ trợ của trang đăng nhập ở tên miền chung;
// - chính sách vào trường của quản trị nền tảng (mặc định vào mọi trường; đổi cần mã xác thực hai lớp).
// Kho mã công khai không chứa danh mục thật: tệp thật chỉ nạp ở máy chủ triển khai. Giao diện YCTD-370: ba thẻ chọn Danh mục, Trang đăng
// nhập, Chính sách vào trường; nhập thật hỏi xác nhận, báo cáo nhập trong hộp thoại; vai trò không được sửa thấy dạng chỉ xem
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

const TABS = [
  { key: 'danh-muc', label: 'Danh mục' },
  { key: 'trang-dang-nhap', label: 'Trang đăng nhập' },
  { key: 'chinh-sach', label: 'Chính sách vào trường' },
] as const;
type CatalogTab = (typeof TABS)[number]['key'];

function count(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('vi-VN');
}

function shortTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CatalogPage({
  token,
  role,
  onNavigate,
}: {
  token: string;
  role: OperatorRole;
  onNavigate: (page: string) => void;
}) {
  const canManage = operatorCan(role, 'catalog.manage');
  const [tab, setTab] = useState<CatalogTab>('danh-muc');
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [flag, setFlag] = useState('');

  const load = useCallback(() => {
    setLoadError(null);
    catalogApi
      .overview(token)
      .then(setOverview)
      .catch((caught: unknown) =>
        setLoadError(`Không đọc được số liệu danh mục: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`),
      );
  }, [token]);
  useEffect(load, [load]);

  const lastRun = overview?.runs[0];
  const flagged = overview ? Object.values(overview.flags).reduce((sum, value) => sum + value, 0) : 0;

  return (
    <section aria-label="Danh mục đơn vị">
      <div className="page-head">
        <div>
          <h1>Danh mục đơn vị</h1>
          <p className="lead">Danh mục trường, phường xã toàn quốc dùng cho trang đăng nhập chọn đơn vị và việc mở trường.</p>
        </div>
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      <TabList label="Phần của danh mục" tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'danh-muc' ? (
        <TabPanel tab="danh-muc">
          {!overview && !loadError ? (
            <section className="card">
              <Skeleton lines={4} label="Đang tải số liệu danh mục" />
            </section>
          ) : null}
          {overview ? (
            <>
              <div className="tiles compact" role="list" aria-label="Số liệu danh mục">
                <div className="card tile" role="listitem">
                  <span className="muted">Đơn vị (trường)</span>
                  <strong data-testid="catalog-units">{count(overview.units)}</strong>
                  <span className="muted">
                    {overview.levels.map((level) => `${level.name} ${count(overview.by_level[level.code])}`).join(' · ')}
                  </span>
                </div>
                <div className="card tile" role="listitem">
                  <span className="muted">Phường, xã</span>
                  <strong>{count(overview.communes)}</strong>
                  <span className="muted">{count(overview.departments)} sở</span>
                </div>
                <div className="card tile" role="listitem">
                  <span className="muted">Lần nhập gần nhất</span>
                  <strong style={{ fontSize: '1.25rem' }}>{lastRun ? shortTime(lastRun.started_at) : 'Chưa nhập'}</strong>
                  {lastRun ? (
                    <span className="muted">
                      Thêm {count(lastRun.totals.units_inserted)} · sửa {count(lastRun.totals.units_updated)} · bỏ qua{' '}
                      {count(lastRun.totals.units_skipped)}
                      {lastRun.dry_run ? ' (chạy thử)' : ''}
                    </span>
                  ) : null}
                </div>
                <div className="card tile" role="listitem">
                  <span className="muted">Đơn vị cần xem lại</span>
                  <strong>{count(flagged)}</strong>
                  <span className="muted">Theo cờ chất lượng</span>
                </div>
                <div className="card tile" role="listitem">
                  <span className="muted">Trường đã gắn mã Bộ</span>
                  <strong>{count(overview.linked_schools)}</strong>
                  <span className="muted">Gắn với đơn vị trong danh mục</span>
                </div>
              </div>
              {overview.units === 0 ? (
                <section className="card" style={{ marginBottom: '1.5rem' }}>
                  <EmptyState title="Danh mục chưa có đơn vị nào">
                    Nhập tệp phường, xã trước, rồi tới tệp đơn vị. Kho mã công khai không chứa danh mục thật: tệp thật chỉ
                    nạp ở máy chủ triển khai.
                  </EmptyState>
                </section>
              ) : null}
              <div className="columns">
                <UnitSearch
                  token={token}
                  overview={overview}
                  flag={flag}
                  onFlagChange={setFlag}
                  canEnter={role === 'quan_tri'}
                />
                <div className="narrow">
                  <section className="card" aria-labelledby="co-chat-luong">
                    <h2 id="co-chat-luong">Cờ chất lượng dữ liệu</h2>
                    {Object.keys(overview.flags).length ? (
                      <table aria-label="Cờ chất lượng">
                        <tbody>
                          {Object.entries(overview.flags).map(([value, total]) => (
                            <tr key={value}>
                              <td>{overview.flag_labels[value] ?? value}</td>
                              <td className="number">{count(total)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="button-link"
                                  aria-label={`Xem đơn vị có cờ ${overview.flag_labels[value] ?? value}`}
                                  onClick={() => {
                                    setFlag(value);
                                    document.getElementById('o-co-tra-cuu')?.focus();
                                  }}
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="muted">Không có cờ nào.</p>
                    )}
                    <p className="muted">"Xem" điền cờ vào ô Cờ của phần tra cứu; vẫn cần chọn sở.</p>
                  </section>
                  {canManage ? (
                    <ImportForm
                      token={token}
                      onDone={(result) => {
                        setOutcome(result);
                        load();
                      }}
                    />
                  ) : null}
                </div>
              </div>
              {overview.runs.length ? (
                <section className="card" aria-labelledby="lan-nhap" style={{ marginTop: '1.5rem' }}>
                  <h2 id="lan-nhap">Các lần nhập gần đây</h2>
                  <div className="table-scroll">
                    <table aria-label="Các lần nhập gần đây">
                      <thead>
                        <tr>
                          <th scope="col">Lúc</th>
                          <th scope="col">Tệp</th>
                          <th scope="col">Người nhập</th>
                          <th scope="col" className="number">
                            Thêm
                          </th>
                          <th scope="col" className="number">
                            Sửa
                          </th>
                          <th scope="col" className="number">
                            Bỏ qua
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.runs.map((run) => (
                          <tr key={run.id}>
                            <td className="nowrap">
                              {shortTime(run.started_at)}
                              {run.dry_run ? (
                                <>
                                  {' '}
                                  <span className="status" data-tone="idle">
                                    Chạy thử
                                  </span>
                                </>
                              ) : null}
                            </td>
                            <td>{run.file_name ?? run.source}</td>
                            <td>{run.actor_name}</td>
                            <td className="number">{count(run.totals.units_inserted)}</td>
                            <td className="number">{count(run.totals.units_updated)}</td>
                            <td className="number">{count(run.totals.units_skipped)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </TabPanel>
      ) : null}
      {tab === 'trang-dang-nhap' ? (
        <TabPanel tab="trang-dang-nhap">
          <LoginPageForm token={token} canManage={canManage} />
        </TabPanel>
      ) : null}
      {tab === 'chinh-sach' ? (
        <TabPanel tab="chinh-sach">
          <AccessPolicyForm
            token={token}
            canManage={operatorCan(role, 'support.policy')}
            onOpenAudit={operatorCan(role, 'audit.view') ? () => onNavigate('audit') : undefined}
          />
        </TabPanel>
      ) : null}
    </section>
  );
}

function ImportReport({ report }: { report: CatalogImportReport }) {
  return (
    <div aria-label="Báo cáo nhập" className="stack">
      <table>
        <tbody>
          {TOTAL_LABELS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td className="number">{count(report.totals[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.skipped.length ? (
        <div>
          <strong>Dòng bỏ qua (tối đa 50 dòng đầu)</strong>
          <ul aria-label="Dòng bỏ qua" style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
            {report.skipped.slice(0, 50).map((row) => (
              <li key={`${row.line}-${row.reason}`}>
                Dòng {row.line}: {row.reason}
                {row.code ? ` [${row.code}]` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ImportForm({ token, onDone }: { token: string; onDone: (outcome: Outcome) => void }) {
  const [kind, setKind] = useState<'units' | 'communes'>('units');
  const [file, setFile] = useState<File | null>(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [report, setReport] = useState<CatalogImportReport | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  function start(dryRun: boolean) {
    if (!file) {
      setError('Chọn tệp CSV.');
      return;
    }
    void run(async () => {
      setError(null);
      try {
        const text = await file.text();
        const result = await catalogApi.importCsv(token, text, {
          kind,
          file_name: file.name,
          dry_run: dryRun,
          deactivate_missing: deactivateMissing,
        });
        setConfirming(false);
        setReport(result);
        onDone(
          result.dry_run
            ? { tone: 'ok', text: 'Đã chạy thử, chưa ghi danh mục. Xem báo cáo trong hộp thoại.' }
            : {
                tone: 'ok',
                text: `Đã nhập danh mục: thêm ${count(result.totals.units_inserted)} đơn vị, sửa ${count(
                  result.totals.units_updated,
                )}, bỏ qua ${count(result.totals.units_skipped)}.`,
              },
        );
      } catch (caught) {
        const message = `Không nhập được tệp: ${errorMessage(caught)}. Sửa tệp CSV (UTF-8) rồi chạy thử lại.`;
        if (confirming) {
          setError(message);
        } else {
          onDone({ tone: 'danger', text: message });
        }
      }
    });
  }

  return (
    <section className="card" aria-labelledby="nhap-danh-muc">
      <h2 id="nhap-danh-muc">Nhập danh mục từ CSV</h2>
      <form
        className="stack"
        aria-label="Nhập danh mục từ CSV"
        onSubmit={(event) => {
          event.preventDefault();
          start(true);
        }}
      >
        <label className="field">
          Loại tệp
          <select value={kind} onChange={(event) => setKind(event.target.value as 'units' | 'communes')}>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tệp CSV (UTF-8)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setReport(null);
            }}
          />
          {error && !confirming ? <span className="field-error">{error}</span> : null}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={deactivateMissing}
            onChange={(event) => setDeactivateMissing(event.target.checked)}
          />
          Đơn vị của các sở có trong tệp mà không còn trong tệp thì chuyển ngừng hoạt động
        </label>
        <div className="button-row">
          <button type="submit" className="button-secondary button-large" disabled={busy} aria-busy={busy}>
            {busy && !confirming ? 'Đang chạy thử…' : 'Chạy thử'}
          </button>
          <button
            type="button"
            className="button-primary button-large"
            disabled={busy}
            onClick={() => {
              if (!file) {
                setError('Chọn tệp CSV.');
                return;
              }
              setError(null);
              setConfirming(true);
            }}
          >
            Nhập danh mục
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Chạy thử cho biết số đơn vị thêm, sửa, giữ nguyên, bỏ qua mà chưa ghi gì.
        </p>
      </form>
      {confirming && file ? (
        <ConfirmDialog
          title="Nhập danh mục vào hệ thống?"
          confirmLabel="Nhập danh mục"
          busy={busy}
          error={error}
          onConfirm={() => start(false)}
          onCancel={() => setConfirming(false)}
        >
          <p style={{ margin: 0 }}>
            Tệp <b>{file.name}</b> ({KIND_LABELS[kind].toLowerCase()}) sẽ được ghi vào danh mục: thêm và sửa theo tệp.
            {deactivateMissing ? ' Đã chọn chuyển đơn vị không còn trong tệp sang ngừng hoạt động.' : ''}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Nên chạy thử trước để xem báo cáo.
          </p>
        </ConfirmDialog>
      ) : null}
      {report && !confirming ? (
        <Dialog
          title={report.dry_run ? 'Báo cáo chạy thử: chưa ghi danh mục' : 'Báo cáo nhập danh mục'}
          onClose={() => setReport(null)}
        >
          <div className="dialog-body">
            <ImportReport report={report} />
          </div>
          <div className="dialog-foot">
            <button type="button" className="button-secondary" onClick={() => setReport(null)}>
              Đóng
            </button>
            {report.dry_run ? (
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setReport(null);
                  setConfirming(true);
                }}
              >
                Nhập thật tệp này
              </button>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

function UnitSearch({
  token,
  overview,
  flag,
  onFlagChange,
  canEnter,
}: {
  token: string;
  overview: CatalogOverview;
  flag: string;
  onFlagChange: (flag: string) => void;
  canEnter: boolean;
}) {
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogUnitRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();

  function search(offset: number) {
    void run(async () => {
      setError(null);
      try {
        const page = await catalogApi.units(token, { department, q, level, flag, offset, include_inactive: true });
        setItems((current) => (offset === 0 ? page.items : [...(current ?? []), ...page.items]));
        setHasMore(page.has_more);
      } catch (caught) {
        setError(`Không tra cứu được: ${errorMessage(caught)}`);
      }
    });
  }

  return (
    <section className="card wide" aria-labelledby="tra-cuu-don-vi">
      <h2 id="tra-cuu-don-vi">Tra cứu đơn vị</h2>
      <form
        className="filters"
        aria-label="Tra cứu đơn vị"
        onSubmit={(event) => {
          event.preventDefault();
          search(0);
        }}
      >
        <label>
          <span>
            Sở <span className="muted">(bắt buộc)</span>
          </span>
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
          <select id="o-co-tra-cuu" value={flag} onChange={(event) => onFlagChange(event.target.value)}>
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
        <div className="actions" style={{ margin: 0 }}>
          <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
            Tìm
          </button>
        </div>
      </form>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {items === null ? <p className="muted">Chọn sở rồi bấm Tìm.</p> : null}
      {items?.length === 0 ? <EmptyState title="Không tìm thấy đơn vị" /> : null}
      {items?.length ? (
        <div className="table-scroll">
          <table className="sticky-first" aria-label="Kết quả tra cứu đơn vị" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col">Mã Bộ</th>
                <th scope="col">Tên</th>
                <th scope="col">Phường, xã</th>
                <th scope="col">Cấp</th>
                <th scope="col">Cờ</th>
                <th scope="col">Trường đã khởi tạo</th>
                {canEnter ? (
                  <th scope="col">
                    <span className="visually-hidden">Vào trường</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.moet_code}>
                  <td>{item.moet_code}</td>
                  <td>
                    {item.name}
                    {item.status === 'inactive' ? (
                      <>
                        {' '}
                        <span className="status" data-tone="idle">
                          Ngừng hoạt động
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>{item.commune_name ?? ''}</td>
                  <td>{item.levels.join(', ')}</td>
                  <td>
                    {item.quality_flags.map((value) => (
                      <span key={value} className="status" data-tone="warn">
                        {overview.flag_labels[value] ?? value}
                      </span>
                    ))}
                  </td>
                  <td>{item.school_code ?? ''}</td>
                  {canEnter ? (
                    <td>
                      {item.status === 'inactive' ? null : (
                        <OpenSchoolButton
                          token={token}
                          moetCode={item.moet_code}
                          label={item.school_code ? 'Vào trường' : 'Khởi tạo và vào trường'}
                        />
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasMore ? (
        <div className="button-row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="button-secondary" disabled={busy} onClick={() => search(items?.length ?? 0)}>
            Xem thêm
          </button>
        </div>
      ) : null}
    </section>
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
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, [token]);

  async function search() {
    setError(null);
    try {
      setItems((await catalogApi.units(token, { department, q })).items);
    } catch (caught) {
      setError(errorMessage(caught));
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


function LoginPageForm({ token, canManage }: { token: string; canManage: boolean }) {
  const [settings, setSettings] = useState<LoginPageSettings | null>(null);
  const [lines, setLines] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    setLoadError(null);
    catalogApi
      .loginPage(token)
      .then((value) => {
        setSettings(value);
        setLines(value.support_lines.join('\n'));
      })
      .catch((caught: unknown) => setLoadError(`Không đọc được trang đăng nhập: ${errorMessage(caught)}`));
  }, [token]);
  useEffect(load, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const current = settings;
    if (!current) {
      return;
    }
    void run(async () => {
      try {
        const saved = await catalogApi.saveLoginPage(token, {
          ...current,
          support_lines: lines
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        });
        setSettings(saved);
        setOutcome({ tone: 'ok', text: 'Đã lưu trang đăng nhập.' });
      } catch (caught) {
        setOutcome({ tone: 'danger', text: `Không lưu được: ${errorMessage(caught)}` });
      }
    });
  }

  return (
    <section className="card" style={{ maxWidth: 720 }} aria-labelledby="trang-dang-nhap-chung">
      <h2 id="trang-dang-nhap-chung">Trang đăng nhập ở tên miền chung</h2>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      <p className="muted">
        Không dùng tên, quốc huy hay biểu trưng của cơ quan nhà nước; tiêu đề là tên của nền tảng. Trường có tên miền riêng
        dùng tên và biểu trưng của trường (Thiết lập, Thương hiệu).
      </p>
      {!settings && !loadError ? <Skeleton lines={3} /> : null}
      {settings && canManage ? (
        <form className="stack" aria-label="Trang đăng nhập ở tên miền chung" onSubmit={submit}>
          <label className="field">
            <span>
              Tiêu đề <span className="hint">tối đa 120 ký tự</span>
            </span>
            <input
              value={settings.title}
              onChange={(event) => setSettings({ ...settings, title: event.target.value })}
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span>
              Dòng phụ <span className="hint">tối đa 120 ký tự</span>
            </span>
            <input
              value={settings.subtitle}
              onChange={(event) => setSettings({ ...settings, subtitle: event.target.value })}
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>
              Thông tin hỗ trợ ở chân trang <span className="hint">mỗi dòng một mục, tối đa 6 dòng</span>
            </span>
            <textarea value={lines} onChange={(event) => setLines(event.target.value)} rows={4} />
          </label>
          <div className="button-row">
            <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
              {busy ? 'Đang lưu…' : 'Lưu trang đăng nhập'}
            </button>
          </div>
        </form>
      ) : null}
      {settings && !canManage ? (
        <>
          <dl className="details">
            <dt>Tiêu đề</dt>
            <dd>{settings.title}</dd>
            <dt>Dòng phụ</dt>
            <dd>{settings.subtitle}</dd>
            <dt>Thông tin hỗ trợ</dt>
            <dd>
              {settings.support_lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </dd>
          </dl>
          <p className="muted">Chỉ quản trị nền tảng sửa được.</p>
        </>
      ) : null}
    </section>
  );
}

const MODE_LABELS: Record<SupportAccessPolicy['mode'], string> = {
  any_school:
    'Vào mọi trường đã khởi tạo, không cần trường đồng ý (bắt buộc xác thực hai lớp, lý do, có hạn, ghi nhật ký)',
  school_grant:
    'Chỉ khi trường cho phép (hợp đồng xử lý dữ liệu đòi trường đồng ý); phiên đang mở theo quyền nền tảng kết thúc',
};

function AccessPolicyForm({
  token,
  canManage,
  onOpenAudit,
}: {
  token: string;
  canManage: boolean;
  onOpenAudit?: () => void;
}) {
  const [policy, setPolicy] = useState<SupportAccessPolicy | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, run] = useBusy();

  const load = useCallback(() => {
    setLoadError(null);
    catalogApi
      .policy(token)
      .then(setPolicy)
      .catch((caught: unknown) => setLoadError(`Không đọc được chính sách: ${errorMessage(caught)}`));
  }, [token]);
  useEffect(load, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const current = policy;
    if (!current) {
      return;
    }
    void run(async () => {
      setFailure(null);
      try {
        setPolicy(await catalogApi.savePolicy(token, { ...current, otp_code: otpCode.trim() }));
        setOtpCode('');
        setOutcome({ tone: 'ok', text: 'Đã lưu chính sách.' });
      } catch (caught) {
        setFailure(caught);
        setOutcome({ tone: 'danger', text: `Không lưu được chính sách: ${errorMessage(caught)}` });
      }
    });
  }

  const otpError = fieldError(failure, 'otp_code');
  return (
    <section className="card" style={{ maxWidth: 720 }} aria-labelledby="chinh-sach-vao-truong">
      <div className="card-head">
        <h2 id="chinh-sach-vao-truong">Chính sách vào trường của quản trị nền tảng</h2>
        {onOpenAudit ? (
          <button type="button" className="button-link" onClick={onOpenAudit}>
            Xem nhật ký vào trường
          </button>
        ) : null}
      </div>
      <OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} />
      {loadError ? <LoadError message={loadError} onRetry={load} /> : null}
      {!policy && !loadError ? <Skeleton lines={3} /> : null}
      {policy && canManage ? (
        <form className="stack" aria-label="Chính sách vào trường của quản trị nền tảng" onSubmit={submit}>
          <fieldset className="stack" style={{ gap: '0.5rem', border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Khi nào được vào trường</legend>
            {(Object.keys(MODE_LABELS) as Array<SupportAccessPolicy['mode']>).map((mode) => (
              <label key={mode} className="check">
                <input
                  type="radio"
                  name="mode"
                  checked={policy.mode === mode}
                  onChange={() => setPolicy({ ...policy, mode })}
                />
                {MODE_LABELS[mode]}
              </label>
            ))}
          </fieldset>
          <div className="grid-3">
            <label className="field">
              <span>
                Số giờ mặc định <span className="hint">1 đến 8</span>
              </span>
              <input
                type="number"
                min={1}
                max={8}
                value={policy.default_hours}
                onChange={(event) => setPolicy({ ...policy, default_hours: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>
                Số giờ tối đa <span className="hint">1 đến 8</span>
              </span>
              <input
                type="number"
                min={1}
                max={8}
                value={policy.max_hours}
                onChange={(event) => setPolicy({ ...policy, max_hours: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              Mã xác thực hai lớp của bạn
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                aria-invalid={otpError ? true : undefined}
              />
              {otpError ? <span className="field-error">{otpError}</span> : null}
            </label>
          </div>
          <div className="button-row">
            <button type="submit" className="button-primary button-large" disabled={busy} aria-busy={busy}>
              {busy ? 'Đang lưu…' : 'Lưu chính sách'}
            </button>
          </div>
        </form>
      ) : null}
      {policy && !canManage ? (
        <>
          <dl className="details">
            <dt>Khi nào được vào trường</dt>
            <dd>{MODE_LABELS[policy.mode]}</dd>
            <dt>Số giờ mặc định</dt>
            <dd>{policy.default_hours}</dd>
            <dt>Số giờ tối đa</dt>
            <dd>{policy.max_hours}</dd>
          </dl>
          <p className="muted">Chỉ quản trị nền tảng sửa được.</p>
        </>
      ) : null}
    </section>
  );
}

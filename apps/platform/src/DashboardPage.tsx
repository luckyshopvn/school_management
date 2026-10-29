import { useCallback, useEffect, useState } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import { dashboardApi, type DashboardOverview, type ErrorCountRow } from './platform-api.js';
import { Dialog, EmptyState, errorMessage, LoadError, Skeleton } from './platform-ui.js';

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197): danh sách trường kèm trạng thái, gói, dung lượng, số tài khoản, số học sinh,
// lần đăng nhập gần nhất, phiên bản cấu trúc dữ liệu, lỗi và cảnh báo; bấm số lỗi để xem lỗi gom theo giờ của trường đó. Giao diện
// YCTD-370: sáu ô chỉ số, nhóm nút lọc, lỗi theo giờ trong hộp thoại; số lỗi chỉ bấm được với vai trò có dashboard.errors
const STATUS: Record<string, { label: string; tone: string }> = {
  provisioning: { label: 'Đang khởi tạo', tone: 'warn' },
  trial: { label: 'Dùng thử', tone: 'info' },
  active: { label: 'Đang hoạt động', tone: 'ok' },
  read_only: { label: 'Chỉ đọc', tone: 'warn' },
  suspended: { label: 'Tạm dừng', tone: 'warn' },
  pending_deletion: { label: 'Chờ xóa', tone: 'warn' },
  deleted: { label: 'Đã xóa', tone: 'idle' },
};

function shortTime(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
}

function count(value: number | null | undefined): string {
  return value == null ? '' : value.toLocaleString('vi-VN');
}

function ErrorDialog({ token, school, onClose }: { token: string; school: string; onClose: () => void }) {
  const [rows, setRows] = useState<ErrorCountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dashboardApi
      .errors(token, school, 24)
      .then((reply) => setRows(reply.items))
      .catch((caught: unknown) => setError(`Không đọc được lỗi: ${errorMessage(caught)}`));
  }, [token, school]);
  return (
    <Dialog
      title={`Lỗi máy chủ 24 giờ gần nhất: ${school === '-' ? 'không thuộc trường nào' : school}`}
      onClose={onClose}
      wide={Boolean(rows?.length)}
    >
      <div className="dialog-body" aria-label="Lỗi theo giờ">
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        {rows === null && !error ? <Skeleton lines={3} /> : null}
        {rows && rows.length === 0 ? <EmptyState title="Không có lỗi." /> : null}
        {rows && rows.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Giờ</th>
                  <th scope="col">Dịch vụ</th>
                  <th scope="col">Đường dẫn</th>
                  <th scope="col" className="number">
                    Mã trạng thái
                  </th>
                  <th scope="col" className="number">
                    Số lần
                  </th>
                  <th scope="col">Mã lỗi gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.bucket}-${row.service}-${row.route}-${row.status}`}>
                    <td className="nowrap">{shortTime(row.bucket)}</td>
                    <td>{row.service === 'api' ? 'Máy chủ API' : 'Dịch vụ định danh'}</td>
                    <td>{row.route}</td>
                    <td className="number">{row.status}</td>
                    <td className="number">{row.count}</td>
                    <td>{row.last_code ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="dialog-foot">
        <button type="button" className="button-secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
    </Dialog>
  );
}

export function DashboardPage({ token, role }: { token: string; role: OperatorRole }) {
  const canSeeErrors = operatorCan(role, 'dashboard.errors');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [errorsOf, setErrorsOf] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    dashboardApi
      .overview(token)
      .then(setOverview)
      .catch((caught: unknown) =>
        setError(
          `Không đọc được bảng điều khiển: ${errorMessage(caught)}. Bấm Tải lại; lỗi lặp lại thì báo nhóm kỹ thuật.`,
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const items = overview?.items.filter((item) => !onlyAlerts || item.alerts.length > 0) ?? [];
  const errorCount = (label: string, school: string) =>
    canSeeErrors ? (
      <button
        type="button"
        className="button-link"
        aria-label={`Xem lỗi ${school === '-' ? 'không thuộc trường nào' : school}: ${label}`}
        onClick={() => setErrorsOf(school)}
      >
        {label}
      </button>
    ) : (
      <span>{label}</span>
    );
  return (
    <section aria-label="Bảng điều khiển">
      <div className="page-head">
        <div>
          <h1>Bảng điều khiển</h1>
          <p className="lead">
            Số liệu thu từ từng trường.
            {overview
              ? ` Cập nhật lúc ${shortTime(overview.generated_at)} · ngưỡng cảnh báo ${overview.error_alert_per_hour} lỗi mỗi giờ.`
              : ''}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button-secondary button-large"
            onClick={load}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
      </div>
      {error ? <LoadError message={error} onRetry={load} /> : null}
      {!overview && loading ? (
        <section className="card">
          <Skeleton lines={5} label="Đang tải bảng điều khiển" />
        </section>
      ) : null}
      {overview ? (
        <>
          <div className="tiles compact" role="list" aria-label="Tổng hợp">
            <div className="card tile" role="listitem">
              <span className="muted">Số trường</span>
              <strong>{count(overview.totals.schools)}</strong>
              <span className="muted">Đang phục vụ {count(overview.totals.serving)}</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Trường có cảnh báo</span>
              <strong>{count(overview.totals.with_alerts)}</strong>
              <span className="muted">Xem nút lọc "Có cảnh báo"</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Tài khoản</span>
              <strong>{count(overview.totals.users)}</strong>
              <span className="muted">Mọi trường</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Học sinh đang học</span>
              <strong>{count(overview.totals.active_students)}</strong>
              <span className="muted">Mọi trường</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Dung lượng tệp (MB)</span>
              <strong>{count(overview.totals.storage_mb)}</strong>
              <span className="muted">Mọi trường</span>
            </div>
            <div className="card tile" role="listitem">
              <span className="muted">Lỗi máy chủ 24 giờ</span>
              <strong>{count(overview.totals.errors_last_day)}</strong>
              {overview.totals.platform_errors_last_day ? (
                <span className="muted">
                  Không thuộc trường nào: {errorCount(count(overview.totals.platform_errors_last_day), '-')}
                </span>
              ) : null}
            </div>
          </div>
          {overview.items.length === 0 ? (
            <section className="card">
              <EmptyState title="Chưa có trường nào được khởi tạo">
                Trường được khởi tạo khi có người mở lần đầu ở Danh mục đơn vị hoặc trang đăng nhập.
              </EmptyState>
            </section>
          ) : (
            <section className="card" aria-labelledby="danh-sach-truong">
              <div className="card-head">
                <h2 id="danh-sach-truong">Trường</h2>
                <div className="pills" role="group" aria-label="Lọc trường">
                  <button type="button" aria-pressed={!onlyAlerts} onClick={() => setOnlyAlerts(false)}>
                    Tất cả ({count(overview.items.length)})
                  </button>
                  <button type="button" aria-pressed={onlyAlerts} onClick={() => setOnlyAlerts(true)}>
                    Có cảnh báo ({count(overview.items.filter((item) => item.alerts.length > 0).length)})
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="sticky-first" aria-label="Danh sách trường" style={{ minWidth: 1040 }}>
                  <thead>
                    <tr>
                      <th scope="col">Trường</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Gói</th>
                      <th scope="col" className="number">
                        Tài khoản đang dùng / tổng
                      </th>
                      <th scope="col" className="number">
                        Học sinh / giới hạn
                      </th>
                      <th scope="col" className="number">
                        Dung lượng MB / giới hạn
                      </th>
                      <th scope="col">Đăng nhập gần nhất</th>
                      <th scope="col">Cấu trúc dữ liệu</th>
                      <th scope="col" className="number">
                        Lỗi 1 giờ / 24 giờ
                      </th>
                      <th scope="col">Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const status = STATUS[item.status] ?? { label: item.status, tone: 'idle' };
                      return (
                        <tr key={item.id}>
                          <td style={{ minWidth: '15rem' }}>
                            <div>{item.name}</div>
                            <div className="muted">{item.code}</div>
                            {item.support ? (
                              <span className="status" data-tone="info">
                                Đang hỗ trợ: {item.support.operator_name},{' '}
                                {item.support.scope === 'read' ? 'chỉ đọc' : 'toàn quyền'}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <span className="status" data-tone={status.tone}>
                              {status.label}
                            </span>
                          </td>
                          <td className="nowrap">{item.plan?.name ?? 'Chưa gán'}</td>
                          <td className="number">
                            {item.metrics
                              ? `${count(item.metrics.users_active)} / ${count(item.metrics.users_total)}`
                              : ''}
                          </td>
                          <td className="number">
                            {count(item.metrics?.active_students)}
                            {item.plan?.max_active_students ? ` / ${count(item.plan.max_active_students)}` : ''}
                          </td>
                          <td className="number">
                            {count(item.metrics?.storage_mb)}
                            {item.plan?.max_storage_mb ? ` / ${count(item.plan.max_storage_mb)}` : ''}
                            {item.metrics?.database_mb != null ? (
                              <div className="muted">CSDL {count(item.metrics.database_mb)}</div>
                            ) : null}
                          </td>
                          <td className="nowrap">{shortTime(item.metrics?.last_login_at)}</td>
                          <td>
                            {item.metrics ? (
                              <span
                                className="status"
                                data-tone={item.metrics.schema_current ? 'ok' : 'warn'}
                                title={Object.entries(item.metrics.schema_versions)
                                  .map(([name, version]) => `${name} ${version ?? ''}`)
                                  .join(', ')}
                              >
                                {item.metrics.schema_current ? 'Mới nhất' : 'Chưa mới nhất'}
                              </span>
                            ) : (
                              <span className="status" data-tone="idle">
                                Chưa thu
                              </span>
                            )}
                          </td>
                          <td className="number">
                            {errorCount(`${item.errors.last_hour} / ${item.errors.last_day}`, item.code)}
                          </td>
                          <td>
                            {item.alerts.length ? (
                              <div className="stack" style={{ gap: 4 }}>
                                {item.alerts.map((alert) => (
                                  <span key={alert.kind} className="status" data-tone="warn">
                                    {alert.message}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="muted">
                          Không có trường nào có cảnh báo.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : null}
      {errorsOf ? <ErrorDialog token={token} school={errorsOf} onClose={() => setErrorsOf(null)} /> : null}
    </section>
  );
}

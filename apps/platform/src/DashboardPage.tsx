import { useCallback, useEffect, useState } from 'react';
import { dashboardApi, PlatformApiError, type DashboardOverview, type ErrorCountRow } from './platform-api.js';

// Bảng điều khiển nền tảng (DT-SaaS phần S4, YCTD-197): danh sách trường kèm trạng thái, gói, dung lượng, số tài khoản, số học sinh,
// lần đăng nhập gần nhất, phiên bản cấu trúc dữ liệu, lỗi và cảnh báo; bấm số lỗi để xem lỗi gom theo giờ của trường đó
const STATUS_LABELS: Record<string, string> = {
  provisioning: 'Đang khởi tạo',
  trial: 'Dùng thử',
  active: 'Đang hoạt động',
  read_only: 'Chỉ đọc',
  suspended: 'Tạm dừng',
  pending_deletion: 'Chờ xóa',
  deleted: 'Đã xóa',
};

function dateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('vi-VN') : '';
}

function ErrorList({ token, school, onClose }: { token: string; school: string; onClose: () => void }) {
  const [rows, setRows] = useState<ErrorCountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dashboardApi
      .errors(token, school, 24)
      .then((reply) => setRows(reply.items))
      .catch((caught: unknown) => setError(caught instanceof PlatformApiError ? caught.message : 'Không đọc được lỗi'));
  }, [token, school]);
  return (
    <section aria-label="Lỗi theo giờ">
      <h3>Lỗi máy chủ 24 giờ gần nhất: {school === '-' ? 'không thuộc trường nào' : school}</h3>
      <button type="button" onClick={onClose}>
        Đóng
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {rows && rows.length === 0 ? <p>Không có lỗi.</p> : null}
      {rows && rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Giờ</th>
              <th>Dịch vụ</th>
              <th>Đường dẫn</th>
              <th>Mã trạng thái</th>
              <th>Số lần</th>
              <th>Mã lỗi gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.bucket}-${row.service}-${row.route}-${row.status}`}>
                <td>{dateTime(row.bucket)}</td>
                <td>{row.service === 'api' ? 'Máy chủ API' : 'Dịch vụ định danh'}</td>
                <td>{row.route}</td>
                <td>{row.status}</td>
                <td>{row.count}</td>
                <td>{row.last_code ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function DashboardPage({ token }: { token: string }) {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [errorsOf, setErrorsOf] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    dashboardApi
      .overview(token)
      .then(setOverview)
      .catch((caught: unknown) =>
        setError(caught instanceof PlatformApiError ? caught.message : 'Không đọc được bảng điều khiển'),
      );
  }, [token]);

  useEffect(load, [load]);

  const items = overview?.items.filter((item) => !onlyAlerts || item.alerts.length > 0) ?? [];
  return (
    <section>
      <h2>Bảng điều khiển</h2>
      {error ? <p role="alert">{error}</p> : null}
      {overview ? (
        <>
          <dl className="facts" aria-label="Tổng hợp">
            <dt>Số trường</dt>
            <dd>
              {overview.totals.schools} (đang phục vụ {overview.totals.serving})
            </dd>
            <dt>Trường có cảnh báo</dt>
            <dd>{overview.totals.with_alerts}</dd>
            <dt>Tài khoản</dt>
            <dd>{overview.totals.users}</dd>
            <dt>Học sinh đang học</dt>
            <dd>{overview.totals.active_students}</dd>
            <dt>Dung lượng tệp</dt>
            <dd>{overview.totals.storage_mb} MB</dd>
            <dt>Lỗi máy chủ 24 giờ</dt>
            <dd>
              {overview.totals.errors_last_day}
              {overview.totals.platform_errors_last_day ? (
                <>
                  {' '}
                  (không thuộc trường nào:{' '}
                  <button type="button" className="link" onClick={() => setErrorsOf('-')}>
                    {overview.totals.platform_errors_last_day}
                  </button>
                  )
                </>
              ) : null}
            </dd>
          </dl>
          <div className="actions">
            <label className="inline">
              <input type="checkbox" checked={onlyAlerts} onChange={(event) => setOnlyAlerts(event.target.checked)} />
              Chỉ trường có cảnh báo
            </label>
            <button type="button" onClick={load}>
              Tải lại
            </button>
            <span>
              Cập nhật lúc {dateTime(overview.generated_at)}; ngưỡng cảnh báo lỗi {overview.error_alert_per_hour}{' '}
              lỗi/giờ
            </span>
          </div>
          {errorsOf ? <ErrorList token={token} school={errorsOf} onClose={() => setErrorsOf(null)} /> : null}
          <table aria-label="Danh sách trường">
            <thead>
              <tr>
                <th>Mã trường</th>
                <th>Tên trường</th>
                <th>Trạng thái</th>
                <th>Gói</th>
                <th>Tài khoản</th>
                <th>Học sinh</th>
                <th>Dung lượng (MB)</th>
                <th>Đăng nhập gần nhất</th>
                <th>Cấu trúc dữ liệu</th>
                <th>Lỗi 1 giờ / 24 giờ</th>
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-alert={item.alerts.length > 0 ? 'true' : 'false'}>
                  <td>{item.code}</td>
                  <td>
                    {item.name}
                    {item.support ? (
                      <div className="badge">
                        Đang hỗ trợ: {item.support.operator_name} (
                        {item.support.scope === 'read' ? 'chỉ đọc' : 'toàn quyền'})
                      </div>
                    ) : null}
                  </td>
                  <td>{STATUS_LABELS[item.status] ?? item.status}</td>
                  <td>{item.plan?.name ?? 'Chưa gán'}</td>
                  <td>{item.metrics ? `${item.metrics.users_active} / ${item.metrics.users_total}` : ''}</td>
                  <td>
                    {item.metrics?.active_students ?? ''}
                    {item.plan?.max_active_students ? ` / ${item.plan.max_active_students}` : ''}
                  </td>
                  <td>
                    {item.metrics?.storage_mb ?? ''}
                    {item.plan?.max_storage_mb ? ` / ${item.plan.max_storage_mb}` : ''}
                    {item.metrics?.database_mb != null ? ` (CSDL ${item.metrics.database_mb})` : ''}
                  </td>
                  <td>{dateTime(item.metrics?.last_login_at)}</td>
                  <td title={item.metrics ? JSON.stringify(item.metrics.schema_versions) : ''}>
                    {item.metrics ? (item.metrics.schema_current ? 'Mới nhất' : 'Chưa mới nhất') : 'Chưa thu'}
                  </td>
                  <td>
                    <button type="button" className="link" onClick={() => setErrorsOf(item.code)}>
                      {item.errors.last_hour} / {item.errors.last_day}
                    </button>
                  </td>
                  <td>
                    <ul className="alerts">
                      {item.alerts.map((alert) => (
                        <li key={alert.kind}>{alert.message}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

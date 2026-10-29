import { useEffect, useState } from 'react';
import { operatorCan, type OperatorRole } from '@school-management/shared';
import { auditApi, auditTime, schoolStatusLabel, type PlatformOverview } from './audit-api.js';
import { catalogApi, type CatalogOverview } from './catalog-api.js';
import { OpenSchoolButton } from './OpenSchoolButton.js';

// Trang Tổng quan của cổng vận hành (YCTD-324, theo thiết kế Eric duyệt ngày 2026-10-29): bốn ô chỉ số lấy từ dữ liệu thật (đơn vị trong
// danh mục, trường đã khởi tạo, trường bật tính năng trả phí, lượt quản trị vào trường 7 ngày); ô nào không có nguồn hoặc vai trò không
// được xem thì ẩn, không hiện số bịa. Bảng trường mở gần đây, gói tính năng, truy cập gần đây
const NUMBER = new Intl.NumberFormat('vi-VN');

export function OverviewPage({
  token,
  role,
  schoolCount,
  onNavigate,
}: {
  token: string;
  role: OperatorRole;
  schoolCount: number;
  onNavigate(key: string): void;
}) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [catalog, setCatalog] = useState<CatalogOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auditApi
      .overview(token)
      .then(setOverview)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không đọc được số liệu'));
    catalogApi
      .overview(token)
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, [token]);

  const canEnter = role === 'quan_tri';
  const canSeeAudit = operatorCan(role, 'audit.view');
  return (
    <section aria-label="Tổng quan">
      <h1>Tổng quan nền tảng</h1>
      <p className="lead">Mọi trường trong danh mục đều mở. Trường được khởi tạo khi có người mở lần đầu.</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="tiles" role="list" aria-label="Chỉ số chính">
        {catalog && catalog.units > 0 ? (
          <div className="card tile" role="listitem">
            <span className="muted">Trường trong danh mục</span>
            <strong data-testid="tile-catalog">{NUMBER.format(catalog.units)}</strong>
            <span className="muted">
              {NUMBER.format(catalog.departments)} sở · {NUMBER.format(catalog.communes)} phường, xã
            </span>
          </div>
        ) : null}
        <div className="card tile" role="listitem">
          <span className="muted">Đã khởi tạo</span>
          <strong data-testid="tile-schools">{NUMBER.format(overview?.schools_total ?? schoolCount)}</strong>
          {overview ? <span className="muted">+{NUMBER.format(overview.schools_today)} hôm nay</span> : null}
        </div>
        {overview ? (
          <div className="card tile" role="listitem">
            <span className="muted">Trường bật tính năng trả phí</span>
            <strong data-testid="tile-addons">{NUMBER.format(overview.schools_with_addons)}</strong>
            <span className="muted">Còn lại dùng gói của trường, trường tự khởi tạo dùng gói cơ bản miễn phí</span>
          </div>
        ) : null}
        {overview ? (
          <div className="card tile" role="listitem">
            <span className="muted">Lượt quản trị vào trường, 7 ngày</span>
            <strong data-testid="tile-entries">{NUMBER.format(overview.admin_entries_7d)}</strong>
            <span className="muted">Đều ghi nhật ký ở hai phía</span>
          </div>
        ) : null}
      </div>
      <div className="columns">
        <section className="card wide" aria-labelledby="mo-gan-day">
          <h2 id="mo-gan-day">Trường mở gần đây</h2>
          {overview && overview.recent_schools.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">Trường</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Gói</th>
                  <th scope="col">
                    <span className="visually-hidden">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.recent_schools.map((school) => {
                  const status = schoolStatusLabel(school.status, school.created_at);
                  return (
                    <tr key={school.code}>
                      <td>
                        <div>{school.name}</div>
                        <div className="muted">
                          {school.code}
                          {school.moet_code ? ` · Mã Bộ ${school.moet_code}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className="status" data-tone={status.tone}>
                          {status.label}
                        </span>
                      </td>
                      <td>{school.plan_name ?? 'Đầy đủ'}</td>
                      <td>
                        {canEnter && school.moet_code ? (
                          <OpenSchoolButton token={token} moetCode={school.moet_code} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">Chưa có trường nào.</p>
          )}
          <p>
            <button type="button" className="link" onClick={() => onNavigate('schools')}>
              Xem tất cả trường
            </button>
          </p>
        </section>
        <div className="narrow">
          <section className="card" aria-labelledby="goi-tinh-nang">
            <h2 id="goi-tinh-nang">Gói tính năng</h2>
            <p>
              <strong>Cơ bản, miễn phí:</strong> hồ sơ trường, cán bộ, lớp, học sinh, điểm danh, sổ liên lạc, thông báo,
              văn bản. Bật sẵn ở trường tự khởi tạo.
            </p>
            <p>
              <strong>Trả phí, bật theo từng trường:</strong> trợ lý AI, thi trực tuyến, học trực tuyến, gia sư, báo cáo
              nâng cao, tin nhắn SMS, Zalo.
            </p>
          </section>
          {canSeeAudit && overview ? (
            <section className="card" aria-labelledby="truy-cap-gan-day">
              <h2 id="truy-cap-gan-day">Truy cập gần đây</h2>
              {overview.recent_activity.length === 0 ? (
                <p className="muted">Chưa có.</p>
              ) : (
                <ol className="activity">
                  {overview.recent_activity.map((entry) => (
                    <li key={entry.id}>
                      <span>
                        {entry.actor}: {entry.label}
                        {entry.school_name ? `, ${entry.school_name}` : ''}
                      </span>
                      <span className="muted">{auditTime(entry.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p>
                <button type="button" className="link" onClick={() => onNavigate('audit')}>
                  Nhật ký truy cập
                </button>
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

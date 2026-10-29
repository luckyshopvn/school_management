import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { auditApi, auditTime, type AuditEntry, type AuditFilter, type AuditGroup } from './audit-api.js';

// Nhật ký truy cập của cổng vận hành (YCTD-324): lọc theo nhóm việc, mã trường, khoảng ngày; phân trang; xuất CSV đúng bộ lọc. Ở trang
// chi tiết trường, bảng này lọc sẵn theo mã trường
const GROUPS: ReadonlyArray<{ value: AuditGroup; label: string }> = [
  { value: 'all', label: 'Mọi việc' },
  { value: 'entry', label: 'Vào trường, phiên hỗ trợ' },
  { value: 'provision', label: 'Khởi tạo trường' },
  { value: 'features', label: 'Tính năng trả phí' },
];

export function AuditLogTable({ token, school }: { token: string; school?: string }) {
  const [draft, setDraft] = useState<AuditFilter>({ group: 'all', school: school ?? '', from: '', to: '', page: 1 });
  const [filter, setFilter] = useState<AuditFilter>(draft);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    auditApi
      .list(token, filter)
      .then((page) => {
        setItems(page.items);
        setHasMore(page.has_more);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không đọc được nhật ký'));
  }, [token, filter]);
  useEffect(load, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFilter({ ...draft, page: 1 });
  }

  return (
    <div className="card">
      <form className="filters" aria-label="Lọc nhật ký" onSubmit={submit}>
        <label>
          Việc
          <select
            value={draft.group}
            onChange={(event) => setDraft({ ...draft, group: event.target.value as AuditGroup })}
          >
            {GROUPS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        {school ? null : (
          <label>
            Mã trường
            <input value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })} />
          </label>
        )}
        <label>
          Từ ngày
          <input
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </label>
        <label>
          Đến ngày
          <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        </label>
        <div className="actions">
          <button type="submit" className="button-primary">
            Lọc
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              void auditApi
                .downloadCsv(token, filter)
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không xuất được'))
            }
          >
            Xuất CSV
          </button>
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <table aria-label="Nhật ký truy cập">
        <thead>
          <tr>
            <th scope="col">Thời điểm</th>
            <th scope="col">Việc</th>
            <th scope="col">Người làm</th>
            <th scope="col">Trường</th>
            <th scope="col">Lý do, phạm vi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id}>
              <td>{auditTime(entry.at)}</td>
              <td>{entry.label}</td>
              <td>
                {entry.actor}
                {entry.ip ? <div className="muted">{entry.ip}</div> : null}
              </td>
              <td>
                {entry.school_name ?? ''}
                {entry.school_code ? <div className="muted">{entry.school_code}</div> : null}
              </td>
              <td>
                {entry.reason ?? ''}
                {entry.scope ? <div className="muted">{entry.scope === 'full' ? 'toàn quyền' : 'chỉ đọc'}</div> : null}
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Không có dòng nào khớp bộ lọc.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <nav className="pager" aria-label="Phân trang nhật ký">
        <span className="muted">Trang {filter.page}</span>
        <span className="actions">
          <button
            type="button"
            className="button-secondary"
            disabled={filter.page <= 1}
            onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
          >
            Trang trước
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!hasMore}
            onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
          >
            Trang sau
          </button>
        </span>
      </nav>
    </div>
  );
}

export function AuditLogPage({ token }: { token: string }) {
  return (
    <section aria-label="Nhật ký truy cập">
      <h1>Nhật ký truy cập</h1>
      <p className="lead">
        Mỗi lần quản trị nền tảng vào trường, khởi tạo trường hay bật, tắt tính năng trả phí đều ghi tên người làm và
        giờ, ở cả cổng vận hành và nhật ký của trường.
      </p>
      <AuditLogTable token={token} />
    </section>
  );
}

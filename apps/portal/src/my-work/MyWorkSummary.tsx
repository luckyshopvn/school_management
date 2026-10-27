import { Link } from '@tanstack/react-router';
import { MY_WORK_SOURCE_LABELS, type MyWorkCount, type MyWorkSourceCode } from '@school-management/shared';
import { MY_WORK_PATH, useMyWorkCount } from './MyWorkBadge.js';

// Khối "Việc cần xử lý" trên trang chủ theo mẫu giao diện Tổng quan: số việc đang chờ theo từng phân hệ, lấy từ cùng
// truy vấn đếm của chuông Việc của tôi nên không gọi thêm máy chủ; bấm Xử lý mở trang Việc của tôi
const SHOWN_SOURCES = 5;

export interface WorkSourceRow {
  source: MyWorkSourceCode;
  count: number;
}

// Thứ tự các phân hệ trong khối: nhiều việc đang chờ lên trước, bằng nhau thì theo thứ tự nhãn trong
// MY_WORK_SOURCE_LABELS để thứ tự ổn định giữa các lần làm mới; tối đa SHOWN_SOURCES dòng
const SOURCE_ORDER = Object.keys(MY_WORK_SOURCE_LABELS) as MyWorkSourceCode[];

export function rankWorkSources(count: MyWorkCount): WorkSourceRow[] {
  return SOURCE_ORDER.map((source) => ({ source, count: count.by_source[source] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort(
      (left, right) =>
        right.count - left.count || SOURCE_ORDER.indexOf(left.source) - SOURCE_ORDER.indexOf(right.source),
    )
    .slice(0, SHOWN_SOURCES);
}

export function MyWorkSummary() {
  const work = useMyWorkCount();
  const count = work.data;
  if (!count) {
    return null;
  }
  const rows = rankWorkSources(count);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5" aria-label="Việc cần xử lý">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-section-title font-semibold text-text">Việc cần xử lý</h2>
        <Link to={MY_WORK_PATH} className="text-label font-medium text-link underline">
          Xem tất cả
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-content text-text-secondary">Không có việc nào đang chờ.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.source} className="flex items-center gap-3 border-t border-border py-3">
              <span className="flex h-7 min-w-9 items-center justify-center rounded-full bg-selected px-2 text-label font-bold text-brand-strong">
                {row.count}
              </span>
              <span className="min-w-0 flex-1 font-medium text-text">{MY_WORK_SOURCE_LABELS[row.source]}</span>
            </li>
          ))}
        </ul>
      )}
      {count.overdue ? <p className="text-label font-medium text-danger">{count.overdue} việc đã quá hạn</p> : null}
    </section>
  );
}

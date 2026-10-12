import { formatNumber, type ReportRow } from './reports-api.js';

// Bảng số liệu của một báo cáo; giá trị mã được đổi sang chữ dễ đọc (YCTD-62, YCTD-83)
export interface Column {
  key: string;
  label: string;
}

const LABELS: Record<string, string> = {
  income: 'Thu',
  expense: 'Chi',
  absent_notified: 'Vắng có báo',
  absent_unnotified: 'Vắng không báo',
};

export function ReportTable({ rows, columns, title }: { rows: ReportRow[]; columns: Column[]; title: string }) {
  return (
    <section
      className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
      aria-label={title}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-content text-text-secondary">Không có số liệu.</p>
      ) : (
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className="px-3 py-2">
                      {typeof value === 'string' && LABELS[value] ? LABELS[value] : formatNumber(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

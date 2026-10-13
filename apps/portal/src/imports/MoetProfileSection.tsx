// Thông tin theo CSDL ngành của trẻ hoặc nhân sự, chỉ đọc, thu gọn mặc định (YCTD-100). Nhãn là tiêu đề cột trong tệp
// của Bộ; máy chủ đã đổi ngày về ngày/tháng/năm và che số bí mật
export interface MoetProfileEntry {
  key: string;
  label: string;
  value: string;
}

export function MoetProfileSection({ entries }: { entries: MoetProfileEntry[] | null | undefined }) {
  if (!entries || entries.length === 0) {
    return null;
  }
  return (
    <details className="rounded-lg border border-border p-3" aria-label="Thông tin theo CSDL ngành">
      <summary className="cursor-pointer text-content font-semibold text-text">Thông tin theo CSDL ngành</summary>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.key} className="flex flex-col">
            <dt className="text-label text-text-secondary">{entry.label}</dt>
            <dd className="break-words">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

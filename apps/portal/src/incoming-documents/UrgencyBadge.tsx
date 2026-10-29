import { StatusBadge } from '@school-management/ui';

// Độ khẩn ghi bằng nhãn chữ ngay trong ô trích yếu (YCTD-336), thay cho tô màu chữ trích yếu kèm dòng chú thích màu: mức 2
// (Hỏa tốc) nhãn đỏ, mức 1 (Khẩn) nhãn cam; văn bản thường không có nhãn. Tên nhãn lấy theo danh mục độ khẩn của trường
export function UrgencyBadge({ level, name }: { level: number | null; name: string | null }) {
  if ((level ?? 0) >= 2) {
    return <StatusBadge tone="danger" label={name ?? 'Hỏa tốc'} />;
  }
  if (level === 1) {
    return <StatusBadge tone="warning" label={name ?? 'Khẩn'} />;
  }
  return null;
}

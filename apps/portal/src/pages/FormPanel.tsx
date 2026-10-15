import type { ReactNode } from 'react';
import { Button } from '@school-management/ui';

// Khung và nút của biểu mẫu theo khối mở từ nút trên thanh công cụ của lưới dữ liệu chung (DT-15 phần 15f3): biểu mẫu nằm
// trên lưới, cuối biểu mẫu là nút Ghi (gửi biểu mẫu) và Hủy (đóng biểu mẫu)
export function FormPanel({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4">{children}</section>;
}

export function FormButtons({
  busy,
  disabled,
  onCancel,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  onCancel(): void;
  // Nút phụ của biểu mẫu, đặt giữa Ghi và Hủy (ví dụ Thêm mặt hàng)
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="primary" disabled={busy || disabled}>
        Ghi
      </Button>
      {children}
      <Button variant="text" onClick={onCancel}>
        Hủy
      </Button>
    </div>
  );
}

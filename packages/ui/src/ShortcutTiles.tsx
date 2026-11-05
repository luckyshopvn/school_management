import type { ReactNode } from 'react';

// Ô lối tắt (TD-22, YCTD-384): các ô một hàng, biểu tượng trong ô 52 điểm ảnh, nhãn 14 điểm ảnh; ô cuối thường là "Tất cả" mở danh
// sách đủ chức năng. Thay hàng nút dài ở ứng dụng phụ huynh và cột nút ở ứng dụng giáo viên. Từ YCTD-395: nhãn đầy đủ cho trình đọc
// màn hình khi nhãn hiện ngắn, số việc chờ trên ô, số cột do nơi dùng chọn
export interface ShortcutTile {
  label: string;
  // Tên đầy đủ đọc cho trình đọc màn hình, chứa nhãn hiện
  accessibleLabel?: string;
  icon: ReactNode;
  count?: number;
  onSelect(): void;
}

export function ShortcutTiles({
  items,
  label = 'Lối tắt',
  columnsClassName = 'grid-cols-4',
  className = '',
}: {
  items: ShortcutTile[];
  label?: string;
  columnsClassName?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={`grid gap-1.5 rounded-pc-lon border border-pc-vien bg-pc-the px-2 py-3.5 shadow-pc ${columnsClassName} ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.accessibleLabel}
          onClick={item.onSelect}
          className="relative flex min-h-22 flex-col items-center gap-1.5 rounded-pc-nho text-center text-pc-co-nhan leading-tight text-pc-chu hover:bg-pc-nen-trang focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pc-nhan"
        >
          <span
            aria-hidden="true"
            className="grid size-13 place-items-center rounded-2xl bg-pc-nhan-nhat text-pc-nhan-dam"
          >
            {item.icon}
          </span>
          {item.label}
          {item.count ? (
            <span
              aria-hidden="true"
              className="absolute top-0 left-[calc(50%+0.875rem)] grid h-5.5 min-w-5.5 place-items-center rounded-full bg-pc-nguy-hiem px-1.5 text-pc-co-nhan font-bold text-white"
            >
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

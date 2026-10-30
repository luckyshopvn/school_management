import type { ReactNode } from 'react';

// Ô lối tắt (TD-22, YCTD-384): các ô một hàng, biểu tượng trong ô 52 điểm ảnh, nhãn 14 điểm ảnh; ô cuối thường là "Tất cả" mở danh
// sách đủ chức năng. Thay hàng nút dài ở ứng dụng phụ huynh và cột nút ở ứng dụng giáo viên
export interface ShortcutTile {
  label: string;
  icon: ReactNode;
  onSelect(): void;
}

export function ShortcutTiles({ items, label = 'Lối tắt' }: { items: ShortcutTile[]; label?: string }) {
  return (
    <nav
      aria-label={label}
      className="grid grid-cols-4 gap-1.5 rounded-pc-lon border border-pc-vien bg-pc-the px-2 py-3.5 shadow-pc"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onSelect}
          className="flex min-h-22 flex-col items-center gap-1.5 rounded-pc-nho text-center text-pc-co-nhan leading-tight text-pc-chu focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pc-nhan"
        >
          <span
            aria-hidden="true"
            className="grid size-13 place-items-center rounded-2xl bg-pc-nhan-nhat text-pc-nhan-dam"
          >
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

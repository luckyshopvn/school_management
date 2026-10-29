import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

// Nút "Thêm" mở menu thao tác phụ (YCTD-333, thiết kế lại cổng quản trị): thao tác ít dùng của màn hình (xuất tệp, cấu hình
// cột, việc phụ) vào đây để thanh công cụ chỉ còn nút chính. Theo mẫu menu button của WAI-ARIA: Enter, Space, mũi tên mở;
// mũi tên lên, xuống chuyển mục; Esc đóng và trả con trỏ về nút; bấm ra ngoài thì đóng
export interface MoreMenuItem {
  label: string;
  onSelect(): void;
  disabled?: boolean;
  title?: string;
}

export function MoreMenu({ items, label = 'Thêm' }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const menuItems = () => [
    ...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []),
  ];
  const focusItem = (index: number) => {
    const all = menuItems();
    all[(index + all.length) % all.length]?.focus();
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  if (items.length === 0) {
    return null;
  }
  const openAndFocus = (index: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  };
  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAndFocus(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocus(-1);
    }
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    const all = menuItems();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        focusItem(index - 1);
        break;
      case 'Home':
        focusItem(0);
        break;
      case 'End':
        focusItem(-1);
        break;
      case 'Escape':
        setOpen(false);
        button.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="relative" ref={container}>
      <button
        ref={button}
        type="button"
        className="flex items-center gap-1 rounded-lg border border-border-strong bg-card px-4 py-2 text-label font-medium text-text hover:bg-selected"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        onKeyDown={onButtonKeyDown}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      <ul
        id={menuId}
        ref={list}
        role="menu"
        aria-label={label}
        hidden={!open}
        onKeyDown={onMenuKeyDown}
        className="absolute right-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-32px)] rounded-md border border-border bg-card py-1 shadow-lg"
      >
        {items.map((item) => (
          <li key={item.label} role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              title={item.title}
              className="block w-full px-3 py-2 text-left text-label text-text hover:bg-selected focus:bg-selected focus:outline-none disabled:cursor-not-allowed disabled:text-text-muted"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

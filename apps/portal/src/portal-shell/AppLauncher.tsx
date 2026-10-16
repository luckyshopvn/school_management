import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAppLinks } from './portal-shell-api.js';

// Lưới ứng dụng liên kết ở thanh đầu trang như của Sở (DT-16 phần 16c): danh sách do quản trị cấu hình ở Quản trị hệ thống
// 3.6; chưa có ứng dụng nào thì ẩn nút. Liên kết mở ở thẻ mới, không gửi kèm thông tin trang đang mở
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
    </svg>
  );
}

export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const links = useQuery({ queryKey: ['app-links'], queryFn: listAppLinks });

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!links.data || links.data.length === 0) {
    return null;
  }
  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-header-strong"
        aria-label="Ứng dụng liên kết"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <GridIcon />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Ứng dụng liên kết"
          className="absolute right-0 top-10 z-40 w-72 max-w-[calc(100vw-32px)] whitespace-normal rounded-md border border-border bg-card p-2 text-text shadow-lg"
        >
          <ul className="grid grid-cols-2 gap-1">
            {links.data.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col gap-0.5 rounded-md p-2 hover:bg-selected"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-label font-semibold text-text">{link.name}</span>
                  {link.description ? (
                    <span className="text-label text-text-secondary">{link.description}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { GridDisplaySettingsDialog } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useDefaultGridPageSize } from './grid-settings.js';

// Menu người dùng theo Sở (DT-15 phần 15a): bấm tên người dùng ở thanh đầu trang mở Thông báo, Đổi mật khẩu, Cấu hình
// hiển thị lưới, Danh sách ý kiến đã gửi (phần 15g), Thoát. DT-16 phần 16c thêm Hồ sơ nhân sự cá nhân và Hướng dẫn cho đủ
// các mục như của Sở. YCTD-330 bỏ chân trang nên "Gửi phản hồi" chuyển vào đây
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2c-3.3 0-9 1.7-9 5v2h18v-2c0-3.3-5.7-5-9-5Z" />
    </svg>
  );
}

const itemClass =
  'block w-full px-3 py-1.5 text-left text-label text-text hover:bg-selected focus:bg-selected focus:outline-none';

export function UserMenu({
  fullName,
  onFeedback,
  onLogout,
}: {
  fullName: string | undefined;
  onFeedback(): void;
  onLogout(): void;
}) {
  const [open, setOpen] = useState(false);
  const [gridDialogOpen, setGridDialogOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const gridPageSize = useDefaultGridPageSize();

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const focusItem = (index: number) => {
    const list = items();
    list[(index + list.length) % list.length]?.focus();
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
    // Esc đóng menu cả khi con trỏ bàn phím còn ở nút (mở bằng chuột)
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAndFocus = (index: number) => {
    setOpen(true);
    // Menu hiện ở lần vẽ sau
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
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
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
      case ' ':
        (document.activeElement as HTMLElement | null)?.click();
        break;
      case 'Tab':
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  const saveError = gridPageSize.save.error;
  return (
    <div className="relative" ref={container}>
      <button
        ref={button}
        type="button"
        className="flex h-9 items-center gap-2 rounded-md px-2 text-label font-semibold text-white hover:bg-header-strong"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="menu-nguoi-dung"
        onClick={() => setOpen(!open)}
        onKeyDown={onButtonKeyDown}
      >
        <UserIcon />
        {fullName ? (
          <span
            className="sr-only max-w-48 truncate md:not-sr-only md:whitespace-nowrap"
            data-testid="current-user-name"
          >
            {fullName}
          </span>
        ) : (
          <span className="sr-only">Tài khoản</span>
        )}
        <span aria-hidden="true">▾</span>
      </button>
      <ul
        id="menu-nguoi-dung"
        ref={menu}
        role="menu"
        aria-label="Menu người dùng"
        hidden={!open}
        onKeyDown={onMenuKeyDown}
        className="absolute right-0 top-10 z-40 w-60 rounded-md border border-border bg-card py-1 shadow-lg"
      >
        <li role="none">
          <Link to="/notifications" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
            Thông báo
          </Link>
        </li>
        <li role="none">
          <Link to="/my-profile" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
            Hồ sơ nhân sự cá nhân
          </Link>
        </li>
        <li role="none">
          <Link
            to="/change-password"
            role="menuitem"
            tabIndex={-1}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Đổi mật khẩu
          </Link>
        </li>
        <li role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={itemClass}
            onClick={() => {
              setOpen(false);
              gridPageSize.save.reset();
              setGridDialogOpen(true);
            }}
          >
            Cấu hình hiển thị lưới
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onFeedback();
            }}
          >
            Gửi phản hồi
          </button>
        </li>
        <li role="none">
          <Link to="/my-feedback" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
            Danh sách ý kiến đã gửi
          </Link>
        </li>
        <li role="none">
          <Link to="/help" role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
            Hướng dẫn
          </Link>
        </li>
        <li role="none" className="border-t border-border">
          <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={onLogout}>
            Thoát
          </button>
        </li>
      </ul>
      {gridDialogOpen ? (
        <GridDisplaySettingsDialog
          open
          pageSize={gridPageSize.pageSize}
          busy={gridPageSize.save.isPending}
          error={
            saveError
              ? saveError instanceof ApiError
                ? saveError.message
                : 'Không kết nối được tới máy chủ, vui lòng thử lại'
              : undefined
          }
          onCancel={() => setGridDialogOpen(false)}
          onSave={(pageSize) => gridPageSize.save.mutate(pageSize, { onSuccess: () => setGridDialogOpen(false) })}
        />
      ) : null}
    </div>
  );
}

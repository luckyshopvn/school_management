import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { PortalWorkspace } from '@school-management/shared';
import { searchFunctions } from './function-search.js';

// Ô tìm chức năng ở thanh đầu trang (YCTD-332): gõ tên hoặc số thứ bậc, mũi tên lên, xuống chọn, Enter mở trang, Esc đóng.
// Theo mẫu combobox có danh sách gợi ý của WAI-ARIA. Kết quả lấy từ cây menu đã lọc theo quyền của mọi phân hệ người dùng được
// thấy; mở trang thuộc phân hệ khác thì thanh bên tự chuyển phân hệ như khi mở bằng đường dẫn
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function FunctionSearch({ workspaces }: { workspaces: PortalWorkspace[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const listId = useId();
  const matches = searchFunctions(workspaces, query);
  const showList = open && query.trim().length > 0;

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

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    void navigate({ to: path });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        setOpen(true);
        setActive((index) => (matches.length === 0 ? 0 : (index + 1) % matches.length));
        break;
      case 'ArrowUp':
        setOpen(true);
        setActive((index) => (matches.length === 0 ? 0 : (index - 1 + matches.length) % matches.length));
        break;
      case 'Enter': {
        const match = matches[active];
        if (showList && match) {
          go(match.entry.node.path);
        }
        break;
      }
      case 'Escape':
        setOpen(false);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const optionId = (index: number) => `${listId}-${index}`;
  return (
    <div className="relative min-w-0 flex-[1_1_16rem] max-w-md" ref={container}>
      <SearchIcon />
      <input
        type="search"
        role="combobox"
        aria-label="Tìm chức năng"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && matches[active] ? optionId(active) : undefined}
        placeholder="Tìm chức năng"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-md border border-white/30 bg-white pl-9 pr-3 text-label text-text placeholder:text-text-secondary"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Chức năng tìm thấy"
        hidden={!showList}
        className="absolute left-0 top-11 z-40 max-h-96 w-[min(28rem,calc(100vw-32px))] overflow-y-auto rounded-md border border-border bg-card py-1 text-text shadow-lg"
      >
        {matches.map((match, index) => (
          <li
            key={match.entry.node.path}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className={`flex cursor-pointer flex-col px-3 py-1.5 text-label ${index === active ? 'bg-selected' : ''}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => {
              // Giữ con trỏ ở ô tìm để không đóng danh sách trước khi mở trang
              event.preventDefault();
              go(match.entry.node.path);
            }}
          >
            <span className="font-medium">{match.text}</span>
            <span className="text-text-secondary">{match.entry.workspace.label}</span>
          </li>
        ))}
        {matches.length === 0 ? (
          <li
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="px-3 py-1.5 text-label text-text-secondary"
          >
            Không có chức năng phù hợp
          </li>
        ) : null}
      </ul>
    </div>
  );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listPortalMenuEntries, portalMenuText, type PortalWorkspace } from '@school-management/shared';
import { searchFunctions } from './function-search.js';
import { listRecentPages, searchPeople } from './recent-pages-api.js';

// Ô tìm chung ở thanh đầu trang (YCTD-332, YCTD-337): gõ tên hoặc số thứ bậc để tìm chức năng (theo cây menu đã lọc theo quyền
// của mọi phân hệ người dùng được thấy), gõ từ 2 ký tự thì tìm thêm học sinh, cán bộ theo tên ở máy chủ (kết quả theo phạm vi
// xem của người dùng, chỉ tên, lớp hoặc đơn vị). Bấm vào ô khi chưa gõ thì hiện nhóm "Hay dùng" (trang mở gần nhất). Mũi tên
// lên, xuống chọn, Enter mở, Esc đóng, theo mẫu combobox có danh sách gợi ý của WAI-ARIA. Mở trang thuộc phân hệ khác thì
// thanh bên tự chuyển phân hệ như khi mở bằng đường dẫn. Chữ trong ô 16 px ở mọi khổ để Safari trên iOS không tự phóng to
// khi chạm vào ô (quy tắc thiết bị DT-26 phần 26e)
const PEOPLE_MIN_LENGTH = 2;
const PEOPLE_DELAY_MS = 250;

interface Option {
  key: string;
  group: string;
  title: string;
  detail: string;
  path: string;
}

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

// Từ khóa gửi máy chủ chậm lại một chút để không gửi mỗi lần gõ một chữ
function useDelayed(value: string): string {
  const [delayed, setDelayed] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDelayed(value), PEOPLE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return delayed;
}

export function FunctionSearch({ workspaces }: { workspaces: PortalWorkspace[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const listId = useId();
  const text = query.trim();
  const peopleText = useDelayed(text);
  const people = useQuery({
    queryKey: ['global-search', peopleText],
    queryFn: () => searchPeople(peopleText),
    enabled: open && peopleText.length >= PEOPLE_MIN_LENGTH,
    staleTime: 30_000,
  });
  const recent = useQuery({ queryKey: ['recent-pages'], queryFn: listRecentPages, enabled: open && text === '' });

  // Nhãn trang theo cây menu người dùng thấy; trang không còn trên menu (đổi quyền, tắt cấp) thì không hiện
  const menuEntries = listPortalMenuEntries(workspaces);
  const labelOf = (path: string) => {
    const entry = menuEntries.find((candidate) => candidate.node.path === path);
    return entry ? { title: portalMenuText(entry.node), detail: entry.workspace.label } : undefined;
  };
  const options: Option[] =
    text === ''
      ? (recent.data ?? []).flatMap((page) => {
          const label = labelOf(page.path);
          return label ? [{ key: `recent:${page.path}`, group: 'Hay dùng', ...label, path: page.path }] : [];
        })
      : [
          ...searchFunctions(workspaces, query).map((match) => ({
            key: `page:${match.entry.node.path}`,
            group: 'Chức năng',
            title: match.text,
            detail: match.entry.workspace.label,
            path: match.entry.node.path,
          })),
          ...(peopleText === text && text.length >= PEOPLE_MIN_LENGTH
            ? [
                ...(people.data?.students ?? []).map((hit) => ({
                  key: `student:${hit.id}`,
                  group: 'Học sinh',
                  title: hit.name,
                  detail: hit.detail ?? '',
                  path: hit.path,
                })),
                ...(people.data?.staff ?? []).map((hit) => ({
                  key: `staff:${hit.id}`,
                  group: 'Cán bộ, giáo viên',
                  title: hit.name,
                  detail: hit.detail ?? '',
                  path: hit.path,
                })),
              ]
            : []),
        ];
  const showList = open && (text.length > 0 || options.length > 0);
  const activeIndex = options.length === 0 ? 0 : Math.min(active, options.length - 1);

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
        setActive(options.length === 0 ? 0 : (activeIndex + 1) % options.length);
        break;
      case 'ArrowUp':
        setOpen(true);
        setActive(options.length === 0 ? 0 : (activeIndex - 1 + options.length) % options.length);
        break;
      case 'Enter': {
        const option = options[activeIndex];
        if (showList && option) {
          go(option.path);
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
  const searching = text.length >= PEOPLE_MIN_LENGTH && (peopleText !== text || people.isFetching);
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
        aria-activedescendant={showList && options[activeIndex] ? optionId(activeIndex) : undefined}
        placeholder="Tìm chức năng, học sinh, cán bộ"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-md border border-pc-vien-o-nhap bg-white pl-9 pr-3 text-base text-text placeholder:text-text-secondary"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Chức năng tìm thấy"
        aria-busy={searching}
        hidden={!showList}
        className="absolute left-0 top-11 z-40 max-h-96 w-[min(28rem,calc(100vw-32px))] overflow-y-auto rounded-md border border-border bg-card py-1 text-text shadow-lg"
      >
        {options.map((option, index) => (
          <li
            key={option.key}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            className={`flex cursor-pointer flex-col px-3 py-1.5 text-label ${index === activeIndex ? 'bg-selected' : ''} ${index > 0 && options[index - 1]?.group !== option.group ? 'border-t border-border' : ''}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => {
              // Giữ con trỏ ở ô tìm để không đóng danh sách trước khi mở trang
              event.preventDefault();
              go(option.path);
            }}
          >
            {index === 0 || options[index - 1]?.group !== option.group ? (
              <span className="text-label font-semibold uppercase tracking-wide text-text-secondary">
                {option.group}
              </span>
            ) : null}
            <span className="font-medium">{option.title}</span>
            {option.detail ? <span className="text-text-secondary">{option.detail}</span> : null}
          </li>
        ))}
        {options.length === 0 && text.length > 0 ? (
          <li
            role="option"
            aria-selected={false}
            aria-disabled="true"
            className="px-3 py-1.5 text-label text-text-secondary"
          >
            {searching ? 'Đang tìm…' : 'Không có chức năng phù hợp'}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

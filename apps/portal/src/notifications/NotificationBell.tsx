import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { readNotifications, type NotificationItem } from './notifications-api.js';

// Chuông thông báo ở đầu trang thay mục Thông báo của thanh điều hướng (P19-04, YCTD-97): số chưa đọc, danh sách thông
// báo mới nhất, bấm một thông báo để xem nội dung và đánh dấu đã đọc, chọn nhiều thông báo để đánh dấu đã đọc cùng lúc,
// đọc tất cả, chuyển sang màn hình Thông báo để xem toàn bộ
const LATEST_COUNT = 10;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(value),
  );

const markRead = (id: string) => requestJson(`/api/v1/notifications/${id}/read`, { method: 'POST' });

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5H3.5C4.5 15.5 6 13.5 6 9Z" strokeLinejoin="round" />
      <path d="M10 19.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function BellItem({
  item,
  open,
  checked,
  onToggleOpen,
  onToggleChecked,
}: {
  item: NotificationItem;
  open: boolean;
  checked: boolean;
  onToggleOpen(): void;
  onToggleChecked(checked: boolean): void;
}) {
  return (
    <li
      className={`flex gap-2 border-b border-border px-3 py-2 last:border-b-0 ${item.is_read ? '' : 'bg-selected'}`}
      aria-label={`Thông báo ${item.title}`}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        aria-label={`Chọn thông báo ${item.title}`}
        onChange={(event) => onToggleChecked(event.target.checked)}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col text-left"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <span className={`text-content text-text ${item.is_read ? '' : 'font-semibold'}`}>{item.title}</span>
        <span className={`text-label text-text-secondary ${open ? 'whitespace-pre-line' : 'truncate'}`}>
          {item.body}
        </span>
        <span className="text-label text-text-muted">{formatTime(item.created_at)}</span>
      </button>
    </li>
  );
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const container = useRef<HTMLDivElement>(null);
  // Số chưa đọc làm mới mỗi phút; danh sách chỉ tải khi mở chuông
  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => readNotifications(true),
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', false],
    queryFn: () => readNotifications(false),
    enabled: expanded,
  });
  const unread = count.data?.unread_count ?? 0;
  const latest = (list.data?.notifications ?? []).slice(0, LATEST_COUNT);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const readOne = useMutation({ mutationFn: markRead, onSuccess: refresh });
  const readSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await markRead(id);
      }
    },
    onSuccess: async () => {
      setSelected(new Set());
      await refresh();
    },
  });
  const readAll = useMutation({
    mutationFn: () => requestJson('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      setSelected(new Set());
      await refresh();
    },
  });

  // Đóng khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!expanded) {
      return undefined;
    }
    const onPointer = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const allChecked = latest.length > 0 && latest.every((item) => selected.has(item.id));
  const selectedUnread = latest.filter((item) => selected.has(item.id) && !item.is_read).map((item) => item.id);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-current hover:bg-current/10"
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={() => setExpanded(!expanded)}
      >
        <BellIcon />
        {unread ? (
          <span
            className="absolute -right-0.5 -top-0.5 min-w-[22px] rounded-full bg-danger px-1 text-center text-label font-semibold leading-[22px] text-white"
            aria-hidden="true"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {expanded ? (
        <div
          role="dialog"
          aria-label="Thông báo mới"
          className="absolute right-0 top-11 z-30 flex w-[380px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-content font-semibold text-text">Thông báo ({unread} chưa đọc)</span>
            <Button variant="text" disabled={!unread || readAll.isPending} onClick={() => readAll.mutate()}>
              Đọc tất cả
            </Button>
          </div>
          {latest.length > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
              <label className="flex items-center gap-2 text-label text-text-secondary">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) =>
                    setSelected(event.target.checked ? new Set(latest.map((item) => item.id)) : new Set())
                  }
                />
                Chọn tất cả
              </label>
              <Button
                variant="text"
                disabled={selectedUnread.length === 0 || readSelected.isPending}
                onClick={() => readSelected.mutate(selectedUnread)}
              >
                Đánh dấu đã đọc ({selectedUnread.length})
              </Button>
            </div>
          ) : null}
          <ul className="max-h-[420px] overflow-y-auto" aria-label="Danh sách thông báo mới">
            {list.isPending ? <li className="px-3 py-4 text-label text-text-secondary">Đang tải…</li> : null}
            {list.data && latest.length === 0 ? (
              <li className="px-3 py-4 text-label text-text-secondary">Không có thông báo.</li>
            ) : null}
            {latest.map((item) => (
              <BellItem
                key={item.id}
                item={item}
                open={openId === item.id}
                checked={selected.has(item.id)}
                onToggleOpen={() => {
                  setOpenId(openId === item.id ? undefined : item.id);
                  if (!item.is_read) {
                    readOne.mutate(item.id);
                  }
                }}
                onToggleChecked={(checked) => {
                  const next = new Set(selected);
                  if (checked) {
                    next.add(item.id);
                  } else {
                    next.delete(item.id);
                  }
                  setSelected(next);
                }}
              />
            ))}
          </ul>
          <Link
            to="/notifications"
            className="border-t border-border px-3 py-2 text-center text-label font-medium text-link hover:underline"
            onClick={() => setExpanded(false)}
          >
            Xem tất cả thông báo
          </Link>
        </div>
      ) : null}
    </div>
  );
}

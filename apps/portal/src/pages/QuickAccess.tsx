import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MAX_QUICK_LINKS } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { useState } from 'react';
import { useNavigationEntries, type NavigationEntry } from './navigation-registry.js';
import { listQuickLinks, saveQuickLinks, type QuickLink } from './quick-links-api.js';
import { WORKSPACE_ICONS, WorkspaceIcon, type IconName } from './workspaces.js';

const QUICK_LINKS_KEY = ['quick-links'];

// Bộ chọn trang để ghim: các trang người dùng thấy trên menu, nhóm theo phân hệ
function QuickLinkPicker({
  entries,
  pinned,
  full,
  busy,
  onAdd,
  onClose,
}: {
  entries: NavigationEntry[];
  pinned: Set<string>;
  full: boolean;
  busy: boolean;
  onAdd(entry: NavigationEntry): void;
  onClose(): void;
}) {
  const groups = new Map<string, { icon: IconName; items: NavigationEntry[] }>();
  for (const entry of entries) {
    const title = entry.workspaceLabel;
    const group = groups.get(title) ?? { icon: WORKSPACE_ICONS[entry.workspace], items: [] };
    group.items.push(entry);
    groups.set(title, group);
  }
  return (
    <div
      role="dialog"
      aria-label="Chọn trang thêm vào truy cập nhanh"
      className="flex flex-col gap-3 rounded-lg border border-border-strong bg-page p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-text-secondary">
          {full
            ? `Đã đủ ${MAX_QUICK_LINKS} lối tắt, bỏ bớt trước khi thêm`
            : 'Bấm vào trang để thêm; chỉ hiện các trang bạn được mở'}
        </p>
        <Button onClick={onClose}>Đóng</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([title, group]) => (
          <section key={title} aria-label={`Phân hệ ${title}`} className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-label font-semibold text-text">
              <WorkspaceIcon name={group.icon} />
              {title}
            </h3>
            <ul className="flex flex-col gap-1">
              {group.items.map((entry) => {
                const isPinned = pinned.has(entry.path);
                return (
                  <li key={entry.path}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-label text-text hover:bg-selected disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isPinned || full || busy}
                      onClick={() => onAdd(entry)}
                    >
                      <span>{entry.label}</span>
                      {isPinned ? <span className="text-text-secondary">Đã ghim</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// "Truy cập nhanh" trên trang chủ (YCTD-102): mỗi tài khoản ghim tối đa 12 trang mình được mở, sắp xếp bằng kéo thả hoặc
// nút lên/xuống; lưu ở máy chủ nên dùng được trên mọi máy và qua các năm học
export function QuickAccess() {
  const queryClient = useQueryClient();
  const entries = useNavigationEntries();
  const links = useQuery({ queryKey: QUICK_LINKS_KEY, queryFn: listQuickLinks });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState<string | undefined>();
  const save = useMutation({
    mutationFn: (next: Array<{ path: string; label: string }>) => saveQuickLinks(next),
    onSuccess: (saved) => queryClient.setQueryData<QuickLink[]>(QUICK_LINKS_KEY, saved),
  });

  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  // Chỉ hiện lối tắt tới trang người dùng còn được mở; nhãn theo menu hiện hành
  const visible = (links.data ?? []).flatMap((link) => {
    const entry = entryByPath.get(link.path);
    return entry ? [{ path: link.path, label: entry.label, workspace: entry.workspace }] : [];
  });
  const pinned = new Set(visible.map((link) => link.path));
  const full = visible.length >= MAX_QUICK_LINKS;

  const persist = (next: Array<{ path: string; label: string }>) =>
    save.mutate(next.map((link) => ({ path: link.path, label: link.label })));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= visible.length || from === to) {
      return;
    }
    const next = [...visible];
    const [item] = next.splice(from, 1);
    if (item) {
      next.splice(to, 0, item);
      persist(next);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Truy cập nhanh">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section-title font-semibold text-text">Truy cập nhanh</h2>
        <Button onClick={() => setPickerOpen(!pickerOpen)} aria-expanded={pickerOpen}>
          + Thêm truy cập nhanh
        </Button>
      </div>
      {links.isError ? <Alert tone="danger">{links.error.message}</Alert> : null}
      {save.isError ? <Alert tone="danger">{save.error.message}</Alert> : null}
      {pickerOpen ? (
        <QuickLinkPicker
          entries={entries}
          pinned={pinned}
          full={full}
          busy={save.isPending}
          onAdd={(entry) => persist([...visible, entry])}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {links.isPending ? (
        <div className="h-20 animate-pulse rounded-lg bg-border" aria-hidden="true" />
      ) : visible.length === 0 ? (
        <p className="text-content text-text-secondary">
          Chưa có lối tắt. Bấm "Thêm truy cập nhanh" để ghim các trang hay dùng.
        </p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          aria-label="Lối tắt đã ghim"
        >
          {visible.map((link, index) => (
            <li
              key={link.path}
              draggable
              onDragStart={(event) => {
                setDragging(link.path);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (dragging) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = visible.findIndex((item) => item.path === dragging);
                setDragging(undefined);
                if (from >= 0) {
                  move(from, index);
                }
              }}
              onDragEnd={() => setDragging(undefined)}
              className={`flex flex-col gap-2 rounded-lg border border-border bg-page p-3 ${dragging === link.path ? 'opacity-50' : ''}`}
            >
              <Link
                to={link.path}
                className="flex min-h-12 items-center gap-2 text-label font-semibold text-text hover:text-brand-strong"
              >
                <WorkspaceIcon name={WORKSPACE_ICONS[link.workspace]} />
                <span>{link.label}</span>
              </Link>
              <div className="flex items-center justify-end gap-1 text-label">
                <button
                  type="button"
                  className="rounded px-1.5 text-text-secondary hover:bg-selected disabled:opacity-40"
                  aria-label={`Đưa ${link.label} lên trước`}
                  disabled={index === 0 || save.isPending}
                  onClick={() => move(index, index - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 text-text-secondary hover:bg-selected disabled:opacity-40"
                  aria-label={`Đưa ${link.label} ra sau`}
                  disabled={index === visible.length - 1 || save.isPending}
                  onClick={() => move(index, index + 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 text-danger hover:bg-selected disabled:opacity-40"
                  aria-label={`Bỏ ${link.label} khỏi truy cập nhanh`}
                  disabled={save.isPending}
                  onClick={() => persist(visible.filter((item) => item.path !== link.path))}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

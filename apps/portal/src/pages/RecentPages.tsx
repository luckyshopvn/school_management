import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { listPortalMenuEntries, portalMenuText } from '@school-management/shared';
import { listRecentPages, removeRecentPage } from './recent-pages-api.js';
import { WorkspaceContext } from './workspaces.js';

// Khối "Hay dùng" trên trang chủ (YCTD-337, GD-180): tối đa 8 trang mở gần nhất của tài khoản, lưu ở máy chủ; nút bỏ một
// trang khỏi danh sách (mở lại trang đó thì trang lại vào danh sách). Chỉ hiện trang còn trên menu người dùng thấy
export function RecentPages() {
  const { workspaces } = useContext(WorkspaceContext);
  const queryClient = useQueryClient();
  const recent = useQuery({ queryKey: ['recent-pages'], queryFn: listRecentPages });
  const remove = useMutation({
    mutationFn: removeRecentPage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recent-pages'] }),
  });
  const entries = listPortalMenuEntries(workspaces);
  const pages = (recent.data ?? []).flatMap((page) => {
    const entry = entries.find((candidate) => candidate.node.path === page.path);
    return entry ? [{ path: page.path, title: portalMenuText(entry.node) }] : [];
  });
  if (recent.isPending || pages.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="hay-dung" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h2 id="hay-dung" className="text-section-title font-semibold text-text">
        Hay dùng
      </h2>
      <ul className="flex flex-wrap gap-2" aria-label="Trang mở gần đây">
        {pages.map((page) => (
          <li key={page.path} className="flex items-center rounded-lg border border-border-strong">
            <Link
              to={page.path}
              className="flex min-h-10 items-center px-3 text-label font-medium text-link hover:underline max-xl:min-h-11"
            >
              {page.title}
            </Link>
            <button
              type="button"
              aria-label={`Bỏ ${page.title} khỏi Hay dùng`}
              disabled={remove.isPending}
              className="flex h-10 w-10 items-center justify-center border-l border-border text-text-secondary hover:bg-selected max-xl:h-11 max-xl:w-11"
              onClick={() => remove.mutate(page.path)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

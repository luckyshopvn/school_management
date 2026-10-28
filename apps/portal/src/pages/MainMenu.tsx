import { useEffect, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { portalMenuText, type PortalMenuNode, type PortalWorkspace } from '@school-management/shared';
import { MenuBadge } from '../my-work/MyWorkBadge.js';
import type { WorkspaceKey } from './workspaces.js';

// Thanh bên trái theo phân hệ (YCTD-330, quyết định GD-170 thay menu ngang của DT-15 phần 15a): cây menu đánh số của phân hệ
// đang chọn theo chiều dọc, giữ số thứ bậc theo hệ thống của Sở (GD-171). Mục cha là nút gập, mở ra các mục con; nhóm chứa
// trang đang mở tự mở. Cùng một thanh dùng cho mọi khổ màn hình: từ 1280 px luôn hiện bên trái, dưới 1280 px (DT-26 phần 26e)
// là ngăn kéo mở bằng nút "☰" ở thanh đầu trang

function isActivePath(pathname: string, path: string | undefined): boolean {
  return path !== undefined && (pathname === path || pathname.startsWith(`${path}/`));
}

// Số thứ bậc của các mục cha chứa trang đang mở, để mở sẵn và tô sáng cả nhánh
function activeTrail(nodes: PortalMenuNode[], pathname: string): string[] {
  for (const node of nodes) {
    if (isActivePath(pathname, node.path)) {
      return [node.number];
    }
    if (node.children) {
      const trail = activeTrail(node.children, pathname);
      if (trail.length > 0) {
        return [node.number, ...trail];
      }
    }
  }
  return [];
}

const groupKey = (workspace: WorkspaceKey, number: string) => `${workspace}:${number}`;

function WorkspaceTree({ workspace, hidden }: { workspace: PortalWorkspace; hidden: boolean }) {
  const { pathname } = useLocation();
  const trail = activeTrail(workspace.menu, pathname);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(trail.map((number) => groupKey(workspace.key, number))),
  );
  const trailKey = trail.join('|');

  // Mở trang thuộc nhóm đang gập (đường dẫn, chuông thông báo, truy cập nhanh) thì mở nhóm đó, giữ các nhóm người dùng đã mở
  useEffect(() => {
    if (!trailKey) {
      return;
    }
    setExpanded((previous) => {
      const keys = trailKey.split('|').map((number) => groupKey(workspace.key, number));
      if (keys.every((key) => previous.has(key))) {
        return previous;
      }
      return new Set([...previous, ...keys]);
    });
  }, [trailKey, workspace.key]);

  const toggle = (key: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderNodes = (nodes: PortalMenuNode[], depth: number) => (
    <ul className={`flex flex-col gap-0.5 ${depth > 0 ? 'mt-0.5 pl-3' : ''}`}>
      {nodes.map((node) => {
        const key = groupKey(workspace.key, node.number);
        const open = expanded.has(key);
        const inTrail = trail.includes(node.number);
        const listId = `menu-${key.replace(/[:.]/g, '-')}`;
        if (node.children) {
          return (
            <li key={key}>
              <button
                type="button"
                className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left max-xl:min-h-11 text-label hover:bg-nav-hover ${depth === 0 ? 'font-medium text-white' : 'text-nav-text'} ${inTrail && !open ? 'bg-nav-hover' : ''}`}
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => toggle(key)}
              >
                <span>{portalMenuText(node)}</span>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              {/* Mục con luôn có trong cây giao diện (ẩn khi gập) để biết người dùng có quyền mở trang nào */}
              <div id={listId} hidden={!open}>
                {renderNodes(node.children, depth + 1)}
              </div>
            </li>
          );
        }
        const current = isActivePath(pathname, node.path);
        return (
          <li key={key}>
            <Link
              to={node.path}
              data-menu-path={node.path}
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-label hover:bg-nav-hover max-xl:min-h-11 ${current ? 'bg-nav-active font-semibold text-white' : 'text-nav-text'}`}
            >
              <span className="min-w-0 flex-1">{portalMenuText(node)}</span>
              <MenuBadge path={node.path} />
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      role="group"
      aria-label={workspace.label}
      hidden={hidden}
      data-workspace={workspace.key}
      className="flex flex-col gap-0.5"
    >
      <Link
        to="/"
        aria-current={pathname === '/' ? 'page' : undefined}
        className={`flex min-h-10 items-center rounded-md px-3 text-label font-medium hover:bg-nav-hover max-xl:min-h-11 ${pathname === '/' ? 'bg-nav-active text-white' : 'text-white'}`}
      >
        Trang chủ
      </Link>
      {renderNodes(workspace.menu, 0)}
    </div>
  );
}

// Cây menu của mọi phân hệ người dùng được thấy; chỉ cây của phân hệ đang chọn hiện ra, các cây khác vẫn giữ (ẩn) để kiểm thử
// và trang chủ biết mục nào người dùng được mở
export function SideMenu({
  workspaces,
  current,
}: {
  workspaces: PortalWorkspace[];
  current: WorkspaceKey | undefined;
}) {
  return (
    <nav id="menu-gon" aria-label="Menu chức năng" className="flex flex-col">
      {workspaces.map((workspace) => (
        <WorkspaceTree key={workspace.key} workspace={workspace} hidden={workspace.key !== current} />
      ))}
    </nav>
  );
}

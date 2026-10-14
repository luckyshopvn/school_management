import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { portalMenuText, type PortalMenuNode, type PortalWorkspace } from '@school-management/shared';
import type { WorkspaceKey } from './workspaces.js';

// Menu ngang nhiều cấp đánh số theo hệ thống của Sở (DT-15 phần 15a): mỗi phân hệ một thanh menu; mục cấp một mở menu sổ
// xuống, cấp sâu hơn bật sang bên phải. Dùng được bằng chuột và bàn phím theo mẫu menubar của WAI-ARIA: mũi tên trái,
// phải giữa các mục cấp một; xuống, lên trong menu; Enter, Space mở hoặc chọn; Esc đóng một cấp; Tab đóng hết. Màn hình
// hẹp dưới 768 điểm ảnh dùng cây menu gập (MobileMenu)

const HOME_KEY = 'home';

function isActivePath(pathname: string, path: string | undefined): boolean {
  return path !== undefined && (pathname === path || pathname.startsWith(`${path}/`));
}

// Số thứ bậc của các mục cha chứa trang đang mở, để tô sáng cả nhánh
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

const itemId = (workspace: WorkspaceKey, key: string) => `menu-${workspace}-${key.replace(/\./g, '-')}`;

function Menubar({ workspace, hidden }: { workspace: PortalWorkspace; hidden: boolean }) {
  const { pathname } = useLocation();
  // Chuỗi số thứ bậc của các menu đang mở, cấp một trước
  const [openTrail, setOpenTrail] = useState<string[]>([]);
  const [focusedTop, setFocusedTop] = useState(HOME_KEY);
  const [pendingFocus, setPendingFocus] = useState<string>();
  const container = useRef<HTMLUListElement>(null);
  const active = activeTrail(workspace.menu, pathname);
  const topKeys = [HOME_KEY, ...workspace.menu.map((node) => node.number)];

  // Đổi trang thì đóng menu
  useEffect(() => {
    setOpenTrail([]);
  }, [pathname]);

  // Đưa con trỏ bàn phím tới mục sau khi menu chứa nó đã hiện
  useEffect(() => {
    if (pendingFocus) {
      document.getElementById(itemId(workspace.key, pendingFocus))?.focus();
      setPendingFocus(undefined);
    }
  }, [pendingFocus, workspace.key]);

  // Bấm ra ngoài thanh menu thì đóng
  useEffect(() => {
    if (openTrail.length === 0) {
      return undefined;
    }
    const onPointer = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpenTrail([]);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [openTrail.length]);

  const focusTop = (key: string, openIt: boolean, into: 'first' | 'last' | 'none' = 'first') => {
    setFocusedTop(key);
    const node = workspace.menu.find((item) => item.number === key);
    if (openIt && node?.children && into !== 'none') {
      setOpenTrail([key]);
      const target = into === 'first' ? node.children[0] : node.children.at(-1);
      setPendingFocus(target?.number ?? key);
    } else {
      setOpenTrail([]);
      setPendingFocus(key);
    }
  };
  const neighbourTop = (key: string, offset: number) =>
    topKeys[(topKeys.indexOf(key) + offset + topKeys.length) % topKeys.length] ?? HOME_KEY;

  const onTopKeyDown = (event: KeyboardEvent, node: PortalMenuNode | undefined, key: string) => {
    const hasChildren = Boolean(node?.children);
    switch (event.key) {
      case 'ArrowRight':
        focusTop(neighbourTop(key, 1), false);
        break;
      case 'ArrowLeft':
        focusTop(neighbourTop(key, -1), false);
        break;
      case 'Home':
        focusTop(topKeys[0] ?? HOME_KEY, false);
        break;
      case 'End':
        focusTop(topKeys.at(-1) ?? HOME_KEY, false);
        break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        if (hasChildren) {
          focusTop(key, true, 'first');
        } else if (event.key === ' ') {
          (event.currentTarget as HTMLElement).click();
        } else {
          return;
        }
        break;
      case 'ArrowUp':
        if (!hasChildren) {
          return;
        }
        focusTop(key, true, 'last');
        break;
      case 'Escape':
        setOpenTrail([]);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // Phím trong menu sổ xuống; trail là chuỗi số của các mục cha, siblings là các mục cùng menu
  const onItemKeyDown = (event: KeyboardEvent, node: PortalMenuNode, siblings: PortalMenuNode[], trail: string[]) => {
    const index = siblings.indexOf(node);
    const focusSibling = (next: number) => {
      const target = siblings[(next + siblings.length) % siblings.length];
      if (target) {
        setOpenTrail(trail);
        setPendingFocus(target.number);
      }
    };
    const topKey = trail[0] ?? HOME_KEY;
    switch (event.key) {
      case 'ArrowDown':
        focusSibling(index + 1);
        break;
      case 'ArrowUp':
        focusSibling(index - 1);
        break;
      case 'Home':
        focusSibling(0);
        break;
      case 'End':
        focusSibling(siblings.length - 1);
        break;
      case 'ArrowRight':
        if (node.children) {
          setOpenTrail([...trail, node.number]);
          setPendingFocus(node.children[0]?.number);
        } else {
          focusTop(neighbourTop(topKey, 1), true);
        }
        break;
      case 'ArrowLeft':
        if (trail.length > 1) {
          setOpenTrail(trail.slice(0, -1));
          setPendingFocus(trail.at(-1));
        } else {
          focusTop(neighbourTop(topKey, -1), true);
        }
        break;
      case 'Escape':
        setOpenTrail(trail.slice(0, -1));
        setPendingFocus(trail.at(-1));
        break;
      case 'Enter':
      case ' ':
        if (node.children) {
          setOpenTrail([...trail, node.number]);
          setPendingFocus(node.children[0]?.number);
        } else if (event.key === ' ') {
          (event.currentTarget as HTMLElement).click();
        } else {
          return;
        }
        break;
      case 'Tab':
        setOpenTrail([]);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  const renderSubmenu = (parent: PortalMenuNode, trail: string[]) => {
    const children = parent.children ?? [];
    const open = openTrail.length >= trail.length && trail.every((number, index) => openTrail[index] === number);
    const nested = trail.length > 1;
    return (
      <ul
        role="menu"
        aria-label={parent.label}
        hidden={!open}
        className={`absolute z-40 min-w-64 rounded-md border border-border bg-card py-1 text-text shadow-lg ${nested ? 'left-full top-0 -mt-1' : 'left-0 top-full'}`}
      >
        {children.map((node) => {
          const isActive = active.includes(node.number) && active.length > trail.length;
          const expanded = openTrail[trail.length] === node.number;
          const className = `flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left text-label hover:bg-selected focus:bg-selected focus:outline-none ${isActive ? 'font-semibold text-brand-strong' : ''}`;
          return (
            <li key={node.number} role="none" className="relative">
              {node.children ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    id={itemId(workspace.key, node.number)}
                    tabIndex={-1}
                    aria-haspopup="menu"
                    aria-expanded={expanded}
                    className={className}
                    onClick={() => setOpenTrail(expanded ? trail : [...trail, node.number])}
                    onMouseEnter={() => setOpenTrail([...trail, node.number])}
                    onKeyDown={(event) => onItemKeyDown(event, node, children, trail)}
                  >
                    <span>{portalMenuText(node)}</span>
                    <span aria-hidden="true">›</span>
                  </button>
                  {renderSubmenu(node, [...trail, node.number])}
                </>
              ) : (
                <Link
                  to={node.path}
                  role="menuitem"
                  id={itemId(workspace.key, node.number)}
                  tabIndex={-1}
                  data-menu-path={node.path}
                  aria-current={isActivePath(pathname, node.path) ? 'page' : undefined}
                  className={className}
                  onMouseEnter={() => setOpenTrail(trail)}
                  onKeyDown={(event) => onItemKeyDown(event, node, children, trail)}
                >
                  {portalMenuText(node)}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const topClass = (isActive: boolean, expanded: boolean) =>
    `flex h-10 items-center gap-1 whitespace-nowrap border-b-2 px-3 text-label font-medium hover:bg-selected focus:bg-selected focus:outline-none ${isActive ? 'border-brand text-brand-strong' : 'border-transparent text-text'} ${expanded ? 'bg-selected' : ''}`;

  return (
    <ul
      ref={container}
      role="menubar"
      aria-label={workspace.label}
      hidden={hidden}
      className="mx-auto flex w-full max-w-[1440px] flex-wrap items-stretch px-4"
    >
      <li role="none">
        <Link
          to="/"
          role="menuitem"
          id={itemId(workspace.key, HOME_KEY)}
          tabIndex={focusedTop === HOME_KEY ? 0 : -1}
          aria-current={pathname === '/' ? 'page' : undefined}
          className={topClass(pathname === '/', false)}
          onFocus={() => setFocusedTop(HOME_KEY)}
          onKeyDown={(event) => onTopKeyDown(event, undefined, HOME_KEY)}
        >
          Trang chủ
        </Link>
      </li>
      {workspace.menu.map((node) => {
        const isActive = active[0] === node.number;
        const expanded = openTrail[0] === node.number;
        return (
          <li key={node.number} role="none" className="relative">
            {node.children ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  id={itemId(workspace.key, node.number)}
                  tabIndex={focusedTop === node.number ? 0 : -1}
                  aria-haspopup="menu"
                  aria-expanded={expanded}
                  className={topClass(isActive, expanded)}
                  onClick={() => setOpenTrail(expanded ? [] : [node.number])}
                  onMouseEnter={() => {
                    if (openTrail.length > 0 && !expanded) {
                      setOpenTrail([node.number]);
                    }
                  }}
                  onFocus={() => setFocusedTop(node.number)}
                  onKeyDown={(event) => onTopKeyDown(event, node, node.number)}
                >
                  {portalMenuText(node)}
                  <span aria-hidden="true" className="text-text-secondary">
                    ▾
                  </span>
                </button>
                {renderSubmenu(node, [node.number])}
              </>
            ) : (
              <Link
                to={node.path}
                role="menuitem"
                id={itemId(workspace.key, node.number)}
                tabIndex={focusedTop === node.number ? 0 : -1}
                data-menu-path={node.path}
                aria-current={isActivePath(pathname, node.path) ? 'page' : undefined}
                className={topClass(isActive, false)}
                onFocus={() => setFocusedTop(node.number)}
                onKeyDown={(event) => onTopKeyDown(event, node, node.number)}
              >
                {portalMenuText(node)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Thanh menu dưới thanh đầu trang: mỗi phân hệ người dùng được thấy có một thanh, chỉ thanh của phân hệ đang chọn hiện ra;
// các thanh khác vẫn giữ trong cây giao diện (ẩn) để kiểm thử và trang chủ biết mục nào người dùng được mở
export function MainMenu({
  workspaces,
  current,
}: {
  workspaces: PortalWorkspace[];
  current: WorkspaceKey | undefined;
}) {
  return (
    <nav aria-label="Menu chức năng" className="sticky top-14 z-30 hidden border-b border-border bg-card md:block">
      {workspaces.map((workspace) => (
        <Menubar key={workspace.key} workspace={workspace} hidden={workspace.key !== current} />
      ))}
    </nav>
  );
}

// Màn hình hẹp: nút "☰" mở cây menu gập theo chiều dọc của phân hệ đang chọn
export function MobileMenu({ workspace, onClose }: { workspace: PortalWorkspace | undefined; onClose(): void }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(workspace ? activeTrail(workspace.menu, pathname) : []),
  );
  const firstPath = useRef(pathname);

  // Chọn trang khác thì đóng menu
  useEffect(() => {
    if (pathname !== firstPath.current) {
      onClose();
    }
  }, [pathname, onClose]);

  if (!workspace) {
    return null;
  }
  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpanded(next);
  };
  const renderNodes = (nodes: PortalMenuNode[], parentKey: string, depth: number) => (
    <ul className={`flex flex-col gap-0.5 ${depth > 0 ? 'ml-3 border-l border-border pl-2' : ''}`}>
      {nodes.map((node) => {
        const key = `${parentKey}${node.number}`;
        const open = expanded.has(node.number);
        const listId = `menu-gon-${key.replace(/\./g, '-')}`;
        return (
          <li key={key}>
            {node.children ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-label font-medium text-text hover:bg-selected"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(node.number)}
                >
                  <span>{portalMenuText(node)}</span>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                <div id={listId} hidden={!open}>
                  {renderNodes(node.children, key, depth + 1)}
                </div>
              </>
            ) : (
              <Link
                to={node.path}
                data-menu-path={node.path}
                aria-current={isActivePath(pathname, node.path) ? 'page' : undefined}
                className={`block rounded px-2 py-2 text-label text-text hover:bg-selected ${isActivePath(pathname, node.path) ? 'bg-selected font-semibold text-brand-strong' : ''}`}
              >
                {portalMenuText(node)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <nav
      id="menu-gon"
      aria-label="Menu chức năng"
      className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border bg-card p-3 md:hidden"
    >
      <Link
        to="/"
        aria-current={pathname === '/' ? 'page' : undefined}
        className="block rounded px-2 py-2 text-label font-medium text-text hover:bg-selected"
      >
        Trang chủ
      </Link>
      {renderNodes(workspace.menu, '', 0)}
    </nav>
  );
}

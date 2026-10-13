import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// Phân hệ của cổng quản trị (YCTD-101): menu sổ xuống ở thanh đầu trang chọn phân hệ, thanh điều hướng chỉ hiện nhóm
// chức năng của phân hệ đó; "Tất cả chức năng" hiện mọi nhóm (mặc định)
export type WorkspaceKey =
  'all' | 'education' | 'admissions' | 'finance' | 'personnel' | 'facilities' | 'reports' | 'system';

type IconName = 'cap' | 'enroll' | 'coins' | 'people' | 'box' | 'chart' | 'gear' | 'grid';

export const WORKSPACES: Array<{ key: WorkspaceKey; label: string; icon: IconName }> = [
  { key: 'education', label: 'Quản lý giáo dục mầm non', icon: 'cap' },
  { key: 'admissions', label: 'Tuyển sinh', icon: 'enroll' },
  { key: 'finance', label: 'Học phí và tài chính', icon: 'coins' },
  { key: 'personnel', label: 'Nhân sự', icon: 'people' },
  { key: 'facilities', label: 'Cơ sở vật chất', icon: 'box' },
  { key: 'reports', label: 'Báo cáo số liệu', icon: 'chart' },
  { key: 'system', label: 'Quản trị hệ thống', icon: 'gear' },
  { key: 'all', label: 'Tất cả chức năng', icon: 'grid' },
];

// Nhóm chức năng trên thanh điều hướng thuộc phân hệ nào
export const GROUP_WORKSPACE: Record<string, WorkspaceKey> = {
  'TRẺ VÀ LỚP': 'education',
  'GIẢNG DẠY': 'education',
  'Y TẾ': 'education',
  BẾP: 'education',
  'TƯƠNG TÁC': 'education',
  'HOẠT ĐỘNG VÀ TRUYỀN THÔNG': 'education',
  'TUYỂN SINH': 'admissions',
  'HỌC PHÍ VÀ TÀI CHÍNH': 'finance',
  'NHÂN SỰ': 'personnel',
  'KHO VÀ MUA HÀNG': 'facilities',
  'BÁO CÁO': 'reports',
  'THIẾT LẬP': 'system',
};

const WORKSPACE_KEY = 'portal.workspace';

function readWorkspace(): WorkspaceKey {
  try {
    const value = window.localStorage.getItem(WORKSPACE_KEY);
    return WORKSPACES.some((workspace) => workspace.key === value) ? (value as WorkspaceKey) : 'all';
  } catch {
    return 'all';
  }
}

interface WorkspaceState {
  current: WorkspaceKey;
  available: Set<WorkspaceKey>;
  select(key: WorkspaceKey): void;
  // Trang đang mở thuộc phân hệ khác phân hệ đang chọn thì chuyển sang phân hệ của trang
  ensure(key: WorkspaceKey): void;
  register(key: WorkspaceKey): void;
}

export const WorkspaceContext = createContext<WorkspaceState>({
  current: 'all',
  available: new Set(),
  select: () => undefined,
  ensure: () => undefined,
  register: () => undefined,
});

// Tên nhóm chứa mục điều hướng, để mục biết mình thuộc phân hệ nào
export const GroupContext = createContext<string | undefined>(undefined);

export function useWorkspaceState(): WorkspaceState {
  const [current, setCurrent] = useState<WorkspaceKey>(readWorkspace);
  const [available, setAvailable] = useState<Set<WorkspaceKey>>(() => new Set());
  const select = useCallback((key: WorkspaceKey) => {
    setCurrent(key);
    try {
      window.localStorage.setItem(WORKSPACE_KEY, key);
    } catch {
      // Không lưu được thì chỉ giữ trong phiên đang mở
    }
  }, []);
  const ensure = useCallback(
    (key: WorkspaceKey) => setCurrent((previous) => (previous === 'all' || previous === key ? previous : key)),
    [],
  );
  const register = useCallback(
    (key: WorkspaceKey) => setAvailable((previous) => (previous.has(key) ? previous : new Set(previous).add(key))),
    [],
  );
  return useMemo(
    () => ({ current, available, select, ensure, register }),
    [current, available, select, ensure, register],
  );
}

const ICON_PATHS: Record<IconName, ReactNode> = {
  cap: <path d="M12 4 2 9l10 5 8-4v5h2V9L12 4Zm-6 8.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" />,
  enroll: (
    <path d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6Zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
  ),
  coins: (
    <path d="M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4Zm0 2c4.4 0 7 1.4 7 2s-2.6 2-7 2-7-1.4-7-2 2.6-2 7-2Zm0 14c-4.4 0-7-1.4-7-2v-2.2c1.6.8 4.2 1.2 7 1.2s5.4-.4 7-1.2V17c0 .6-2.6 2-7 2Zm0-5c-4.4 0-7-1.4-7-2V9.8c1.6.8 4.2 1.2 7 1.2s5.4-.4 7-1.2V12c0 .6-2.6 2-7 2Z" />
  ),
  people: (
    <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13Zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5Z" />
  ),
  box: (
    <path d="M21 7 12 2 3 7v10l9 5 9-5V7Zm-9 2.7L6.3 6.6 12 3.5l5.7 3.1L12 9.7ZM5 8.4l6 3.3v7.6l-6-3.3V8.4Zm8 10.9v-7.6l6-3.3v7.6l-6 3.3Z" />
  ),
  chart: <path d="M4 20h16v2H2V2h2v18Zm3-2V10h3v8H7Zm5 0V5h3v13h-3Zm5 0v-6h3v6h-3Z" />,
  gear: (
    <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.3 7.3 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.3 7.3 0 0 0 1.7 1L11 21h4l.4-2.9a7.3 7.3 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13ZM13 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5Z" />
  ),
  grid: <path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z" />,
};

function WorkspaceIcon({ name }: { name: IconName }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-workspace text-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        {ICON_PATHS[name]}
      </svg>
    </span>
  );
}

// Menu sổ xuống chọn phân hệ ở thanh đầu trang
export function WorkspaceSwitcher({ state }: { state: WorkspaceState }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const options = WORKSPACES.filter((workspace) => workspace.key === 'all' || state.available.has(workspace.key));
  const current =
    WORKSPACES.find((workspace) => workspace.key === state.current) ??
    (WORKSPACES.at(-1) as (typeof WORKSPACES)[number]);

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

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        className="flex h-9 w-72 max-w-[60vw] items-center gap-2 rounded-md border border-white/60 bg-card pl-1.5 pr-2 text-left text-label text-text shadow-sm"
        aria-label={`Phân hệ: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WorkspaceIcon name={current.icon} />
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <span className="border-l border-border pl-2 text-text-secondary" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Chọn phân hệ"
          className="absolute left-0 top-10 z-30 w-72 max-w-[calc(100vw-32px)] rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {options.map((workspace) => (
            <li key={workspace.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={workspace.key === state.current}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-label text-text hover:bg-selected ${workspace.key === state.current ? 'bg-selected font-semibold' : ''}`}
                onClick={() => {
                  state.select(workspace.key);
                  setOpen(false);
                }}
              >
                <WorkspaceIcon name={workspace.icon} />
                {workspace.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

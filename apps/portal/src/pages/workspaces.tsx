import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PortalWorkspace, PortalWorkspaceKey } from '@school-management/shared';

// Phân hệ của cổng quản trị (YCTD-101, DT-15 phần 15a): ô chọn phân hệ ở thanh đầu trang chọn bộ menu ngang đánh số
// đang hiện; danh sách phân hệ và cây menu ở @school-management/shared (PORTAL_WORKSPACES)
export type WorkspaceKey = PortalWorkspaceKey;

export type IconName =
  | 'cap'
  | 'enroll'
  | 'coins'
  | 'people'
  | 'box'
  | 'chart'
  | 'gear'
  | 'cart'
  | 'chat'
  | 'book'
  | 'report'
  | 'sign'
  | 'school'
  | 'globe';

export const WORKSPACE_ICONS: Record<WorkspaceKey, IconName> = {
  education: 'cap',
  facilities: 'box',
  'entry-admissions': 'school',
  emis: 'chart',
  signing: 'sign',
  documents: 'report',
  system: 'gear',
  finance: 'coins',
  personnel: 'people',
  logistics: 'cart',
  interaction: 'chat',
  teaching: 'book',
  admissions: 'enroll',
  reports: 'report',
  kpi: 'chart',
  website: 'globe',
  'professional-records': 'book',
  emulation: 'sign',
  'quality-assurance': 'chart',
  library: 'book',
  'learning-resources': 'book',
  'online-exam': 'cap',
  tutoring: 'people',
};

const WORKSPACE_KEY = 'portal.workspace';

function readWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export interface WorkspaceState {
  // Phân hệ đang hiện, luôn thuộc danh sách phân hệ người dùng được thấy
  current: WorkspaceKey | undefined;
  workspaces: PortalWorkspace[];
  select(key: WorkspaceKey): void;
  // Trang đang mở thuộc phân hệ khác thì chuyển sang phân hệ của trang (không ghi nhớ)
  ensure(key: WorkspaceKey): void;
}

export const WorkspaceContext = createContext<WorkspaceState>({
  current: undefined,
  workspaces: [],
  select: () => undefined,
  ensure: () => undefined,
});

export function useWorkspaceState(workspaces: PortalWorkspace[]): WorkspaceState {
  const [chosen, setChosen] = useState<string | null>(readWorkspace);
  const select = useCallback((key: WorkspaceKey) => {
    setChosen(key);
    try {
      window.localStorage.setItem(WORKSPACE_KEY, key);
    } catch {
      // Không lưu được thì chỉ giữ trong phiên đang mở
    }
  }, []);
  const ensure = useCallback((key: WorkspaceKey) => setChosen(key), []);
  // Phân hệ đã chọn không còn (đổi quyền, giá trị cũ) thì dùng phân hệ đầu tiên người dùng được thấy
  const current = workspaces.find((workspace) => workspace.key === chosen)?.key ?? workspaces[0]?.key;
  return useMemo(() => ({ current, workspaces, select, ensure }), [current, workspaces, select, ensure]);
}

const ICON_PATHS: Record<IconName, ReactNode> = {
  // Ngôi trường: phân hệ Tuyển sinh đầu cấp (DT-17 phần 17c)
  school: <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3ZM5 13.2v4L12 21l7-3.8v-4L12 17l-7-3.8Z" />,
  // Bút kí trên dòng kẻ: phân hệ Quản lý kí hồ sơ (DT-16 phần 16k)
  sign: (
    <path d="M3 17.3V21h3.7l10.9-10.9-3.7-3.7L3 17.3ZM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.7 3.7L20.7 7Z" />
  ),
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
  cart: (
    <path d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM5.2 4H2V2h4.6l.9 2H21l-3.6 8H8.4l-.9 2H19v2H4.3l2.3-4.6L5.2 4Z" />
  ),
  chat: <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2Zm3 6v2h10V9H7Zm0 4v2h7v-2H7Z" />,
  book: <path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5V3Zm2 2v14h10V5H7Zm2 2h6v2H9V7Zm0 4h6v2H9v-2Z" />,
  report: <path d="M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12v2h8v-2H8Zm0 4v2h8v-2H8Z" />,
  globe: (
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4a14 14 0 0 1 1.9 4h-3.8A14 14 0 0 1 12 4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4Zm.8 2h2.9a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16ZM8 8H5.1a8 8 0 0 1 4.3-3.6A15.7 15.7 0 0 0 8 8Zm4 12a14 14 0 0 1-1.9-4h3.8A14 14 0 0 1 12 20Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6a15.7 15.7 0 0 0 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6Zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4Z" />
  ),
};

export function WorkspaceIcon({ name }: { name: IconName }) {
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

// Ô chọn phân hệ ở thanh đầu trang
export function WorkspaceSwitcher({ state }: { state: WorkspaceState }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const current = state.workspaces.find((workspace) => workspace.key === state.current);

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

  if (!current) {
    return null;
  }
  return (
    <div className="relative min-w-0" ref={container}>
      <button
        type="button"
        className="flex h-9 w-72 max-w-[52vw] items-center gap-2 rounded-md border border-white/60 bg-card pl-1.5 pr-2 text-left text-label text-text shadow-sm"
        aria-label={`Phân hệ: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WorkspaceIcon name={WORKSPACE_ICONS[current.key]} />
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <span className="border-l border-border pl-2 text-text-secondary" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Chọn phân hệ"
          className="absolute left-0 top-10 z-40 max-h-[calc(100vh-64px)] w-72 max-w-[calc(100vw-32px)] overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {state.workspaces.map((workspace) => (
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
                <WorkspaceIcon name={WORKSPACE_ICONS[workspace.key]} />
                {workspace.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

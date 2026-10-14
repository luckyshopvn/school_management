import { createContext, useContext, useMemo } from 'react';
import { listPortalMenuEntries, type PortalWorkspace, type PortalWorkspaceKey } from '@school-management/shared';

// Mục menu người dùng đang thấy (đã lọc theo quyền), để trang chủ cho ghim vào "Truy cập nhanh" (YCTD-102). Danh sách
// lấy thẳng từ cây menu đã lọc nên có đủ mục kể cả khi các menu sổ xuống đang đóng (DT-15 phần 15a)
export interface NavigationEntry {
  path: string;
  label: string;
  workspace: PortalWorkspaceKey;
}

interface NavigationRegistry {
  entries: NavigationEntry[];
}

export const NavigationRegistryContext = createContext<NavigationRegistry>({ entries: [] });

export function useNavigationRegistryState(workspaces: PortalWorkspace[]): NavigationRegistry {
  return useMemo(
    () => ({
      entries: listPortalMenuEntries(workspaces).map((entry) => ({
        path: entry.node.path,
        label: entry.node.label,
        workspace: entry.workspace.key,
      })),
    }),
    [workspaces],
  );
}

export function useNavigationEntries(): NavigationEntry[] {
  return useContext(NavigationRegistryContext).entries;
}

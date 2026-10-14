import { useMemo } from 'react';
import {
  MENU_PERMISSION_RULES,
  PORTAL_WORKSPACES,
  isMenuRuleSatisfied,
  type PortalMenuNode,
  type PortalQuickLinkPath,
  type PortalWorkspace,
} from '@school-management/shared';
import { useCurrentPermissions } from '../session/permissions.js';

// Mục menu người dùng được thấy theo điều kiện quyền ở gói dùng chung (MENU_PERMISSION_RULES, DT-15 phần 15e), giữ đúng
// điều kiện của thanh điều hướng cũ (trước DT-15); máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (AI-12). Mục không có điều
// kiện thì ai đăng nhập cũng thấy
function useMenuVisibility(): Partial<Record<PortalQuickLinkPath, boolean>> {
  const permissions = useCurrentPermissions();
  const has = (code: string) => permissions.has(code);
  return Object.fromEntries(
    Object.entries(MENU_PERMISSION_RULES).map(([path, rule]) => [path, isMenuRuleSatisfied(rule, has)]),
  ) as Partial<Record<PortalQuickLinkPath, boolean>>;
}

// Lọc cây menu theo quyền; nhóm không còn mục nào thì ẩn, phân hệ không còn mục nào thì bỏ khỏi ô chọn phân hệ
export function filterMenu(
  workspaces: PortalWorkspace[],
  visible: Partial<Record<PortalQuickLinkPath, boolean>>,
): PortalWorkspace[] {
  const filterNodes = (nodes: PortalMenuNode[]): PortalMenuNode[] =>
    nodes.flatMap((node) => {
      if (node.children) {
        const children = filterNodes(node.children);
        return children.length > 0 ? [{ ...node, children }] : [];
      }
      return node.path && visible[node.path] !== false ? [node] : [];
    });
  return workspaces.flatMap((workspace) => {
    const menu = filterNodes(workspace.menu);
    return menu.length > 0 ? [{ ...workspace, menu }] : [];
  });
}

export function usePortalMenu(): PortalWorkspace[] {
  // So sánh theo nội dung để cây menu không dựng lại mỗi lần vẽ
  const key = JSON.stringify(useMenuVisibility());
  return useMemo(() => filterMenu(PORTAL_WORKSPACES, JSON.parse(key)), [key]);
}

import { listPortalMenuEntries, portalMenuText, type PortalQuickLinkPath } from '@school-management/shared';

// Tiêu đề trang theo mục menu của trang, có số thứ bậc như của Sở, ví dụ "1.4. Danh sách người dùng" (DT-15 phần 15e);
// lấy từ cây menu nên đổi tên hoặc số ở menu thì tiêu đề đổi theo
export function menuPageTitle(path: PortalQuickLinkPath): string {
  const entry = listPortalMenuEntries().find((candidate) => candidate.node.path === path);
  return entry ? portalMenuText(entry.node) : '';
}

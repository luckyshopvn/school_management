import {
  listPortalMenuEntries,
  portalMenuText,
  type PortalMenuEntry,
  type PortalWorkspace,
} from '@school-management/shared';

// Tìm chức năng theo tên hoặc số thứ bậc của mục menu (YCTD-332): gõ không dấu vẫn khớp ("ho so hoc sinh", "4.1.1"). Chỉ tìm
// trong cây menu đã lọc theo quyền nên kết quả là trang người dùng mở được
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FunctionMatch {
  entry: PortalMenuEntry;
  text: string;
}

export function searchFunctions(workspaces: PortalWorkspace[], query: string, limit = 8): FunctionMatch[] {
  const keyword = normalizeSearchText(query);
  if (!keyword) {
    return [];
  }
  const words = keyword.split(' ');
  const seen = new Set<string>();
  const matches: FunctionMatch[] = [];
  for (const entry of listPortalMenuEntries(workspaces)) {
    // Một trang có ở nhiều phân hệ thì chỉ hiện một lần
    if (seen.has(entry.node.path)) {
      continue;
    }
    const text = portalMenuText(entry.node);
    const haystack = normalizeSearchText(`${text} ${entry.workspace.label}`);
    if (words.every((word) => haystack.includes(word))) {
      seen.add(entry.node.path);
      matches.push({ entry, text });
      if (matches.length >= limit) {
        break;
      }
    }
  }
  return matches;
}

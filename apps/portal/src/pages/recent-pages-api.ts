import { requestJson } from '../session/api-client.js';

// Trang mở gần đây của tài khoản cho nhóm "Hay dùng" (YCTD-337) và ô tìm chung học sinh, cán bộ, lưu, tìm ở máy chủ
export interface RecentPage {
  path: string;
  visited_at: string;
}

export function listRecentPages(): Promise<RecentPage[]> {
  return requestJson('/api/v1/me/recent-pages');
}

export function recordRecentPage(path: string): Promise<void> {
  return requestJson('/api/v1/me/recent-pages', { method: 'POST', body: JSON.stringify({ path }) });
}

export function removeRecentPage(path: string): Promise<void> {
  return requestJson(`/api/v1/me/recent-pages?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
}

export interface SearchHit {
  id: string;
  name: string;
  detail: string | null;
  path: string;
}

export function searchPeople(text: string): Promise<{ students: SearchHit[]; staff: SearchHit[] }> {
  return requestJson(`/api/v1/search?q=${encodeURIComponent(text)}`);
}

import { requestJson } from '../session/api-client.js';

// Lối tắt "Truy cập nhanh" của tài khoản đang đăng nhập (YCTD-102)
export interface QuickLink {
  path: string;
  label: string;
  position: number;
}

export function listQuickLinks(): Promise<QuickLink[]> {
  return requestJson('/api/v1/me/quick-links');
}

export function saveQuickLinks(links: Array<{ path: string; label: string }>): Promise<QuickLink[]> {
  return requestJson('/api/v1/me/quick-links', { method: 'PUT', body: JSON.stringify({ links }) });
}

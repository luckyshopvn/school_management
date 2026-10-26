import { createHash } from 'node:crypto';

// Thương hiệu dùng cho manifest và biểu tượng của ứng dụng web cài được (DT-26 phần 26a, YCTD-231); tách khỏi pwa-manifest.ts để
// school-settings.controller.ts dùng được mà không nhập vòng
export interface PwaBranding {
  display_name: string;
  app_short_name: string | null;
  primary_color: string | null;
  logo_content_type: string | null;
  // Đổi khi tên, màu hoặc biểu trưng đổi, để trình duyệt lấy biểu tượng mới
  revision: string;
}

export function revisionOf(parts: Array<string | null>): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}

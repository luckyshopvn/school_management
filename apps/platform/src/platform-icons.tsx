import type { ReactNode } from 'react';

// Biểu tượng của mục menu cổng nền tảng (DT-26 phần 26e, YCTD-235): khổ 768 đến 1279 px thanh bên chỉ còn biểu tượng. Mục mới chưa có
// biểu tượng thì hiện chữ cái đầu của tên mục
const PATHS: Record<string, ReactNode> = {
  overview: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  schools: <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />,
  plans: <path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
  billing: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4" />,
  dashboard: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  maintenance: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  'parent-orgs': <path d="M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4" />,
  ai: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  catalog: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  market: <path d="M3 9l2-5h14l2 5M3 9h18v11H3zM9 20v-6h6v6" />,
  operators: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 11l2 2 4-4" />,
};

export function PlatformMenuIcon({ menuKey, label }: { menuKey: string; label: string }) {
  const path = PATHS[menuKey];
  if (!path) {
    return (
      <span className="menu-icon menu-icon-letter" aria-hidden="true">
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <svg
      className="menu-icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

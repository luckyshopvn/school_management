import type { ColumnType } from 'kysely';

// Trang mở gần đây của từng tài khoản cho nhóm "Hay dùng" của cổng quản trị (YCTD-337, GD-180)
export interface UserRecentPagesTable {
  user_id: string;
  path: string;
  visited_at: ColumnType<Date, Date | undefined, Date>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    user_recent_pages: UserRecentPagesTable;
  }
}

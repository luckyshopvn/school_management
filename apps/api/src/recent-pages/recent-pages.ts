import { Body, Controller, Delete, Get, HttpCode, Injectable, Post, Query } from '@nestjs/common';
import { validationError } from '@school-management/server';
import { listPortalMenuEntries, portalMenuPathsOutsideLevels } from '@school-management/shared';
import { sql } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';

// Nhóm "Hay dùng" của cổng quản trị (YCTD-337, GD-180): các trang mỗi tài khoản mở gần nhất, lưu ở máy chủ theo người dùng.
// Trang chỉ ghi khi là mục menu của cổng quản trị; hiện tối đa 8 mục mới nhất, giữ tối đa 20 dòng mỗi tài khoản

export const RECENT_PAGES_SHOWN = 8;
export const RECENT_PAGES_KEPT = 20;

const MENU_PATHS = new Set<string>(listPortalMenuEntries().map((entry) => entry.node.path));

export function parseRecentPath(value: unknown, field = 'path'): string {
  const path = typeof value === 'string' ? value : '';
  if (!MENU_PATHS.has(path)) {
    throw validationError([{ field, message: 'Trang không thuộc menu của cổng quản trị' }]);
  }
  return path;
}

@Injectable()
export class RecentPagesService {
  constructor(
    private readonly databases: Databases,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  // Trang của cấp trường chưa bật không hiện (như Truy cập nhanh, DT-19 phần 19c)
  async list(userId: string): Promise<Array<{ path: string; visited_at: Date }>> {
    const hidden = portalMenuPathsOutsideLevels(await this.schoolLevels.enabled());
    const rows = await this.databases.system
      .selectFrom('user_recent_pages')
      .select(['path', 'visited_at'])
      .where('user_id', '=', userId)
      .orderBy('visited_at', 'desc')
      .limit(RECENT_PAGES_KEPT)
      .execute();
    return rows.filter((row) => !hidden.has(row.path as never)).slice(0, RECENT_PAGES_SHOWN);
  }

  // Ghi lần mở trang: đã có thì cập nhật thời điểm; quá số dòng giữ thì xóa dòng cũ nhất
  async record(userId: string, path: string): Promise<void> {
    await this.databases.system.transaction().execute(async (transaction) => {
      await sql`select pg_advisory_xact_lock(hashtext(${`recent:${userId}`}))`.execute(transaction);
      await transaction
        .insertInto('user_recent_pages')
        .values({ user_id: userId, path, visited_at: new Date() })
        .onConflict((conflict) => conflict.columns(['user_id', 'path']).doUpdateSet({ visited_at: new Date() }))
        .execute();
      const kept = transaction
        .selectFrom('user_recent_pages')
        .select('path')
        .where('user_id', '=', userId)
        .orderBy('visited_at', 'desc')
        .limit(RECENT_PAGES_KEPT);
      await transaction
        .deleteFrom('user_recent_pages')
        .where('user_id', '=', userId)
        .where('path', 'not in', kept)
        .execute();
    });
  }

  async remove(userId: string, path: string): Promise<void> {
    await this.databases.system
      .deleteFrom('user_recent_pages')
      .where('user_id', '=', userId)
      .where('path', '=', path)
      .execute();
  }
}

// Chỉ đọc và sửa danh sách của chính tài khoản đang đăng nhập; không cần quyền riêng vì mỗi trang vẫn tự kiểm tra quyền khi
// mở, giao diện chỉ hiện trang người dùng thấy trên menu
@Controller('me/recent-pages')
export class RecentPagesController {
  constructor(private readonly recentPages: RecentPagesService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.recentPages.list(currentUser.id);
  }

  @Post()
  @HttpCode(204)
  async record(@Body() body: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.recentPages.record(currentUser.id, parseRecentPath((body as Record<string, unknown> | undefined)?.path));
  }

  @Delete()
  @HttpCode(204)
  async remove(@Query('path') path: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.recentPages.remove(currentUser.id, parseRecentPath(path));
  }
}

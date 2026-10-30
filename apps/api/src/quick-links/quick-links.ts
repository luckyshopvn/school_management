import { Body, Controller, Get, Injectable, Put } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import { MAX_QUICK_LINKS, PORTAL_QUICK_LINK_PATHS, portalMenuPathsOutsideLevels } from '@school-management/shared';
import { sql } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';

export interface QuickLink {
  path: string;
  label: string;
  position: number;
}

const ALLOWED_PATHS = new Set<string>(PORTAL_QUICK_LINK_PATHS);
const MAX_LABEL_LENGTH = 100;

// Kiểm tra danh sách lối tắt gửi lên: đường dẫn trong danh sách cho phép, không trùng, nhãn 1-100 ký tự, tối đa 12 mục;
// thứ tự trong mảng là thứ tự hiển thị
export function parseQuickLinks(body: unknown): Array<{ path: string; label: string }> {
  const links = (body as Record<string, unknown> | undefined)?.links;
  if (!Array.isArray(links)) {
    throw validationError([{ field: 'links', message: 'Danh sách lối tắt phải là mảng' }]);
  }
  if (links.length > MAX_QUICK_LINKS) {
    throw validationError([{ field: 'links', message: `Tối đa ${MAX_QUICK_LINKS} lối tắt` }]);
  }
  const errors: FieldError[] = [];
  const seen = new Set<string>();
  const parsed = links.map((item: unknown, index) => {
    const link = (item ?? {}) as Record<string, unknown>;
    const path = typeof link.path === 'string' ? link.path : '';
    const label = typeof link.label === 'string' ? link.label.trim() : '';
    if (!ALLOWED_PATHS.has(path)) {
      errors.push({ field: `links[${index}].path`, message: 'Trang không thuộc danh sách được ghim' });
    } else if (seen.has(path)) {
      errors.push({ field: `links[${index}].path`, message: 'Trang đã có trong truy cập nhanh' });
    }
    seen.add(path);
    if (label === '' || label.length > MAX_LABEL_LENGTH) {
      errors.push({ field: `links[${index}].label`, message: `Tên lối tắt từ 1 đến ${MAX_LABEL_LENGTH} ký tự` });
    }
    return { path, label };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return parsed;
}

// Lối tắt "Truy cập nhanh" của từng tài khoản, lưu ở cơ sở dữ liệu hệ thống nên giữ qua các năm học (YCTD-102)
@Injectable()
export class QuickLinksService {
  constructor(
    private readonly databases: Databases,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  // Lối tắt tới mục menu của cấp trường chưa bật (hoặc đã tắt) không hiện, vẫn giữ trong cơ sở dữ liệu để hiện lại khi bật
  // cấp (DT-19 phần 19c); trường chỉ có Mầm non không ẩn gì. Lối tắt tới trang đã gỡ (gia sư trong trường, YCTD-393) không hiện,
  // lần lưu sau bỏ hẳn
  async list(userId: string): Promise<QuickLink[]> {
    const hidden = portalMenuPathsOutsideLevels(await this.schoolLevels.enabled());
    const links = await this.databases.system
      .selectFrom('user_quick_links')
      .select(['path', 'label', 'position'])
      .where('user_id', '=', userId)
      .orderBy('position')
      .execute();
    return links.filter((link) => ALLOWED_PATHS.has(link.path) && !hidden.has(link.path as never));
  }

  // Thay toàn bộ danh sách trong một giao dịch; vị trí đánh lại từ 0 theo thứ tự gửi lên
  async replace(userId: string, links: Array<{ path: string; label: string }>): Promise<QuickLink[]> {
    await this.databases.system.transaction().execute(async (transaction) => {
      // Hai lần lưu cùng lúc của một tài khoản chạy lần lượt, tránh trùng khóa (user_id, path)
      await sql`select pg_advisory_xact_lock(hashtext(${userId}))`.execute(transaction);
      await transaction.deleteFrom('user_quick_links').where('user_id', '=', userId).execute();
      if (links.length > 0) {
        await transaction
          .insertInto('user_quick_links')
          .values(links.map((link, position) => ({ user_id: userId, path: link.path, label: link.label, position })))
          .execute();
      }
    });
    return this.list(userId);
  }
}

// Chỉ đọc và sửa lối tắt của chính tài khoản đang đăng nhập; không cần quyền riêng. Máy chủ không đối chiếu quyền xem
// từng trang vì mỗi trang vẫn tự kiểm tra quyền khi mở; giao diện chỉ cho ghim trang người dùng thấy
@Controller('me/quick-links')
export class QuickLinksController {
  constructor(private readonly quickLinksService: QuickLinksService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.quickLinksService.list(currentUser.id);
  }

  @Put()
  replace(@Body() body: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.quickLinksService.replace(currentUser.id, parseQuickLinks(body));
  }
}

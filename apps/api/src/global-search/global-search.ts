import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApplicationError, validationError } from '@school-management/server';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildrenService } from '../children/children.service.js';
import { StaffService } from '../staff/staff.service.js';

// Ô tìm chung ở thanh đầu trang cổng quản trị (YCTD-337, GD-180): tìm học sinh và cán bộ theo tên. Dùng lại danh sách học
// sinh, danh sách cán bộ nên kết quả theo đúng phạm vi xem của người dùng (lớp được phân công, đơn vị, toàn trường); không có
// quyền xem nhóm nào thì nhóm đó trống. Chỉ trả tên, lớp hoặc đơn vị và đường dẫn, không trả số định danh hay dữ liệu khác
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_RESULT_LIMIT = 5;

export interface GlobalSearchResult {
  students: Array<{ id: string; name: string; detail: string | null; path: string }>;
  staff: Array<{ id: string; name: string; detail: string | null; path: string }>;
}

export function parseSearchText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < SEARCH_MIN_LENGTH || text.length > SEARCH_MAX_LENGTH) {
    throw validationError([{ field: 'q', message: `Từ khóa từ ${SEARCH_MIN_LENGTH} đến ${SEARCH_MAX_LENGTH} ký tự` }]);
  }
  return text;
}

// Không có quyền xem nhóm thì trả nhóm trống thay vì báo lỗi cả lần tìm
async function allowed<Value>(load: () => Promise<Value[]>): Promise<Value[]> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApplicationError && error.code === 'ERR_FORBIDDEN') {
      return [];
    }
    throw error;
  }
}

@Injectable()
export class GlobalSearchService {
  constructor(
    private readonly children: ChildrenService,
    private readonly staff: StaffService,
  ) {}

  async search(currentUser: CurrentUser, text: string): Promise<GlobalSearchResult> {
    const [students, staff] = await Promise.all([
      allowed(async () => {
        const page = await this.children.list(currentUser, { q: text, page: 1, pageSize: SEARCH_RESULT_LIMIT });
        return page.items.map((item) => ({
          id: item.id,
          name: item.full_name,
          detail: item.class_name ?? null,
          path: `/children?q=${encodeURIComponent(item.full_name)}`,
        }));
      }),
      allowed(async () => {
        const page = await this.staff.search(currentUser, { q: text, page: 1, pageSize: SEARCH_RESULT_LIMIT });
        return page.items.map((item) => ({
          id: item.id,
          name: item.full_name,
          detail: item.unit_name ?? null,
          path: `/staff/${item.id}`,
        }));
      }),
    ]);
    return { students, staff };
  }
}

@Controller('search')
export class GlobalSearchController {
  constructor(private readonly globalSearch: GlobalSearchService) {}

  @Get()
  search(@Query('q') q: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.globalSearch.search(currentUser, parseSearchText(q));
  }
}

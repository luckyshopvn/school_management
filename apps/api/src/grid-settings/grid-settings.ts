import { Body, Controller, Get, Injectable, Param, Put } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import { DATA_GRID_KEYS, DATA_GRID_PAGE_SIZES, type DataGridKey } from '@school-management/shared';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from '../common/databases.js';

export interface GridSettings {
  columns: string[] | null;
  page_size: number | null;
}

const ALLOWED_GRID_KEYS = new Set<string>(DATA_GRID_KEYS);
const ALLOWED_PAGE_SIZES = new Set<number>(DATA_GRID_PAGE_SIZES);
const MAX_COLUMNS = 100;
const COLUMN_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

// Khóa lưới trên đường dẫn phải thuộc danh sách lưới của cổng quản trị
export function parseGridKey(value: unknown): DataGridKey {
  if (typeof value !== 'string' || !ALLOWED_GRID_KEYS.has(value)) {
    throw validationError([{ field: 'gridKey', message: 'Lưới dữ liệu không tồn tại' }]);
  }
  return value as DataGridKey;
}

// Kiểm tra cấu hình gửi lên: columns là mã cột hiển thị theo thứ tự (không trùng, tối đa 100, ít nhất một cột), null
// hoặc bỏ trống là theo mặc định của lưới; page_size thuộc 10, 20, 50, 100, 200 hoặc null. Lưới "default" chỉ nhận
// số dòng mỗi trang
export function parseGridSettings(gridKey: DataGridKey, body: unknown): GridSettings {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validationError([{ field: 'body', message: 'Cấu hình lưới phải là đối tượng' }]);
  }
  const input = body as Record<string, unknown>;
  const errors: FieldError[] = [];
  let columns: string[] | null = null;
  if (input.columns !== undefined && input.columns !== null) {
    if (gridKey === 'default') {
      errors.push({ field: 'columns', message: 'Cấu hình chung chỉ có số dòng mỗi trang' });
    } else if (!Array.isArray(input.columns)) {
      errors.push({ field: 'columns', message: 'Danh sách cột phải là mảng' });
    } else if (input.columns.length === 0 || input.columns.length > MAX_COLUMNS) {
      errors.push({ field: 'columns', message: `Hiển thị từ 1 đến ${MAX_COLUMNS} cột` });
    } else {
      const seen = new Set<string>();
      input.columns.forEach((column: unknown, index) => {
        if (typeof column !== 'string' || !COLUMN_ID_PATTERN.test(column)) {
          errors.push({ field: `columns[${index}]`, message: 'Mã cột không hợp lệ' });
        } else if (seen.has(column)) {
          errors.push({ field: `columns[${index}]`, message: 'Cột bị trùng' });
        } else {
          seen.add(column);
        }
      });
      columns = [...seen];
    }
  }
  let pageSize: number | null = null;
  if (input.page_size !== undefined && input.page_size !== null) {
    if (typeof input.page_size !== 'number' || !ALLOWED_PAGE_SIZES.has(input.page_size)) {
      errors.push({ field: 'page_size', message: `Số dòng mỗi trang là một trong ${DATA_GRID_PAGE_SIZES.join(', ')}` });
    } else {
      pageSize = input.page_size;
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { columns, page_size: pageSize };
}

// Cấu hình lưới dữ liệu của từng tài khoản, lưu ở cơ sở dữ liệu hệ thống nên giữ qua các năm học (DT-15 phần 15a)
@Injectable()
export class GridSettingsService {
  constructor(private readonly databases: Databases) {}

  // Chưa lưu thì trả hai giá trị null, giao diện dùng mặc định của lưới
  async read(userId: string, gridKey: DataGridKey): Promise<GridSettings> {
    const row = await this.databases.system
      .selectFrom('user_grid_settings')
      .select('settings')
      .where('user_id', '=', userId)
      .where('grid_key', '=', gridKey)
      .executeTakeFirst();
    return { columns: row?.settings.columns ?? null, page_size: row?.settings.page_size ?? null };
  }

  // Ghi đè cả cấu hình của lưới; gửi cả hai giá trị null là trở về mặc định
  async save(userId: string, gridKey: DataGridKey, settings: GridSettings): Promise<GridSettings> {
    const value = JSON.stringify({
      ...(settings.columns ? { columns: settings.columns } : {}),
      ...(settings.page_size ? { page_size: settings.page_size } : {}),
    });
    await this.databases.system
      .insertInto('user_grid_settings')
      .values({ user_id: userId, grid_key: gridKey, settings: value })
      .onConflict((conflict) =>
        conflict.columns(['user_id', 'grid_key']).doUpdateSet({ settings: value, updated_at: new Date() }),
      )
      .execute();
    return this.read(userId, gridKey);
  }
}

// Chỉ đọc và sửa cấu hình của chính tài khoản đang đăng nhập; không cần quyền riêng vì không chứa dữ liệu nghiệp vụ
@Controller('me/grid-settings')
export class GridSettingsController {
  constructor(private readonly gridSettingsService: GridSettingsService) {}

  @Get(':gridKey')
  read(@Param('gridKey') gridKey: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.gridSettingsService.read(currentUser.id, parseGridKey(gridKey));
  }

  @Put(':gridKey')
  save(@Param('gridKey') gridKey: string, @Body() body: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    const key = parseGridKey(gridKey);
    return this.gridSettingsService.save(currentUser.id, key, parseGridSettings(key, body));
  }
}

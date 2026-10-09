import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readInteger,
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Loại danh mục dùng chung do hệ thống định nghĩa; phân hệ nào cần loại mới thì thêm vào đây (P01-05, YCTD-42)
export const CATALOG_TYPES = [
  { code: 'parent_relationship', label: 'Quan hệ với trẻ' },
  { code: 'leave_type', label: 'Loại nghỉ phép' },
  { code: 'contract_type', label: 'Loại hợp đồng' },
  { code: 'asset_category', label: 'Nhóm tài sản' },
] as const;

export interface CatalogItem {
  id: string;
  catalog_type: string;
  code: string;
  name: string;
  order_no: number;
  status: CatalogStatus;
}

interface CatalogItemChanges {
  code?: string;
  name?: string;
  order_no?: number;
  status?: CatalogStatus;
}

const COLUMNS = ['id', 'catalog_type', 'code', 'name', 'order_no', 'status'] as const;
const ORDER_RANGE = { min: 0, max: 9999 };
const DUPLICATE_MESSAGE = 'Mã đã có trong loại danh mục này';

function isCatalogType(value: unknown): value is string {
  return CATALOG_TYPES.some((type) => type.code === value);
}

@Injectable()
export class CatalogItemsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(filter: { catalogType?: string; status?: CatalogStatus }): Promise<CatalogItem[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('catalog_items').select(COLUMNS);
    if (filter.catalogType) {
      query = query.where('catalog_type', '=', filter.catalogType);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    return query.orderBy('catalog_type').orderBy('order_no').orderBy('name').execute();
  }

  async create(
    input: { catalog_type: string; code: string; name: string; order_no: number },
    origin: ChangeOrigin,
  ): Promise<CatalogItem> {
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('catalog_items')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'catalog_items',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      DUPLICATE_MESSAGE,
      'code',
    );
  }

  async update(itemId: string, changes: CatalogItemChanges, origin: ChangeOrigin): Promise<CatalogItem> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('catalog_items')
      .select(COLUMNS)
      .where('id', '=', itemId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy mục danh mục', 'catalog_item');
    }
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('catalog_items')
          .set({ ...changes, updated_at: this.clock.now() })
          .where('id', '=', itemId)
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'catalog_items',
          entityId: itemId,
          action: 'update',
          before: existing,
          after: updated,
        });
        return updated;
      }),
      DUPLICATE_MESSAGE,
      'code',
    );
  }
}

// Mọi người đã đăng nhập xem được để chọn mục; chỉ VT-02 tạo, sửa (YCTD-42)
@Controller()
export class CatalogItemsController {
  constructor(private readonly catalogItemsService: CatalogItemsService) {}

  @Get('catalog-types')
  types() {
    return CATALOG_TYPES;
  }

  @Get('catalog-items')
  list(@Query('catalog_type') catalogType?: string, @Query('status') status?: string) {
    const errors: FieldError[] = [];
    if (catalogType !== undefined && !isCatalogType(catalogType)) {
      errors.push({ field: 'catalog_type', message: 'Loại danh mục không có trong hệ thống' });
    }
    const parsedStatus = readStatus(status === undefined ? undefined : { status }, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalogItemsService.list({ catalogType, status: parsedStatus });
  }

  @Post('catalog-items')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isCatalogType(body?.catalog_type)) {
      errors.push({ field: 'catalog_type', message: 'Loại danh mục không có trong hệ thống' });
    }
    const input = {
      catalog_type: String(body?.catalog_type ?? ''),
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE) ?? 0,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalogItemsService.create(input, originOf(request, currentUser));
  }

  @Patch('catalog-items/:id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã mục danh mục không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: CatalogItemChanges = {
      code: body?.code === undefined ? undefined : readRequiredText(body, 'code', errors),
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalogItemsService.update(itemId, changes, originOf(request, currentUser));
  }
}

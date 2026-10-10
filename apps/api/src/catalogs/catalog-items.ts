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
  attributes: Record<string, unknown>;
}

interface CatalogItemChanges {
  code?: string;
  name?: string;
  order_no?: number;
  status?: CatalogStatus;
  attributes?: unknown;
}

// Thuộc tính tính công của loại nghỉ phép (YCTD-59): trường trả lương, trừ số ngày phép năm, bảo hiểm xã hội chi trả.
// Trừ phép năm thì phải là nghỉ trường trả lương; bảo hiểm chi trả thì trường không trả lương
export interface LeaveTypeAttributes {
  is_paid: boolean;
  deducts_annual_leave: boolean;
  insurance_paid: boolean;
}

const LEAVE_TYPE_FLAGS = ['is_paid', 'deducts_annual_leave', 'insurance_paid'] as const;

export function readLeaveTypeAttributes(value: unknown, errors: FieldError[]): LeaveTypeAttributes | undefined {
  const input = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  for (const flag of LEAVE_TYPE_FLAGS) {
    if (typeof input[flag] !== 'boolean') {
      errors.push({ field: `attributes.${flag}`, message: 'Loại nghỉ phép bắt buộc chọn có hoặc không' });
    }
  }
  if (errors.some((error) => error.field.startsWith('attributes.'))) {
    return undefined;
  }
  const attributes = {
    is_paid: input.is_paid as boolean,
    deducts_annual_leave: input.deducts_annual_leave as boolean,
    insurance_paid: input.insurance_paid as boolean,
  };
  if (attributes.deducts_annual_leave && !attributes.is_paid) {
    errors.push({ field: 'attributes.deducts_annual_leave', message: 'Loại nghỉ trừ phép năm phải là nghỉ có lương' });
  }
  if (attributes.insurance_paid && attributes.is_paid) {
    errors.push({ field: 'attributes.insurance_paid', message: 'Bảo hiểm chi trả thì trường không trả lương' });
  }
  return attributes;
}

function attributesFor(catalogType: string, value: unknown): string {
  if (catalogType !== 'leave_type') {
    return '{}';
  }
  const errors: FieldError[] = [];
  const attributes = readLeaveTypeAttributes(value, errors);
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return JSON.stringify(attributes);
}

const COLUMNS = ['id', 'catalog_type', 'code', 'name', 'order_no', 'status', 'attributes'] as const;
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
    input: { catalog_type: string; code: string; name: string; order_no: number; attributes: unknown },
    origin: ChangeOrigin,
  ): Promise<CatalogItem> {
    const { database } = await this.currentSchoolYear.require();
    const attributes = attributesFor(input.catalog_type, input.attributes);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('catalog_items')
          .values({ ...input, attributes, created_by: origin.actorUserId })
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
    const { attributes, ...columns } = changes;
    const attributesText = attributes === undefined ? undefined : attributesFor(existing.catalog_type, attributes);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('catalog_items')
          .set({ ...columns, attributes: attributesText, updated_at: this.clock.now() })
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
      attributes: body?.attributes,
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
      attributes: body?.attributes,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalogItemsService.update(itemId, changes, originOf(request, currentUser));
  }
}

import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ActivityAccess, check, readText } from './activity-access.js';

// Danh mục hoạt động (P14-03), danh mục tin tức (P14-05), chủ đề thư viện (P14-06) theo đơn vị (BR-01, YCTD-78). Danh mục
// của Trường chính dùng chung cho mọi đơn vị; người dùng trong đơn vị đọc được danh mục đang dùng
export type CatalogTable = 'activity_categories' | 'news_categories' | 'library_topics';

const PERMISSIONS: Record<CatalogTable, string> = {
  activity_categories: PERMISSION_CODES.contentManage,
  news_categories: PERMISSION_CODES.contentManage,
  library_topics: PERMISSION_CODES.libraryManage,
};

@Injectable()
export class ContentCatalogsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, table: CatalogTable, orgUnitId: string, includeInactive: boolean) {
    await this.organizationScopes.assertCanAccessAnyRole(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    let query = database
      .selectFrom(table as 'activity_categories')
      .selectAll()
      .where('org_unit_id', 'in', [orgUnitId, root?.id ?? orgUnitId]);
    if (!includeInactive) {
      query = query.where('status', '=', 'active');
    }
    return query.orderBy('order_no').orderBy('name').execute();
  }

  async create(
    currentUser: CurrentUser,
    table: CatalogTable,
    input: { org_unit_id: string; name: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    await this.access.assertStaff(
      currentUser,
      PERMISSIONS[table],
      input.org_unit_id,
      'Bạn không có quyền quản lý danh mục của đơn vị này',
    );
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto(table as 'activity_categories')
          .values({ ...input, created_by: currentUser.id })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên danh mục đã có trong đơn vị',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: table,
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(
    currentUser: CurrentUser,
    table: CatalogTable,
    id: string,
    input: { name?: string; order_no?: number; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom(table as 'activity_categories')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy danh mục', table);
    }
    await this.access.assertStaff(
      currentUser,
      PERMISSIONS[table],
      existing.org_unit_id,
      'Bạn không có quyền quản lý danh mục của đơn vị này',
    );
    return database.transaction().execute(async (transaction) => {
      const updated = await conflictOnDuplicate(
        transaction
          .updateTable(table as 'activity_categories')
          .set({ ...input, updated_at: this.clock.now() })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên danh mục đã có trong đơn vị',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: table,
        entityId: id,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}

function readCatalogInput(body: RequestBody, errors: FieldError[], required: boolean) {
  const input: { name?: string; order_no?: number; status?: RecordStatus } = {};
  const name = readText(body, 'name', errors, { required, maximum: 100 });
  if (name) {
    input.name = name;
  }
  const order = readInteger(body, 'order_no', errors, { min: 0, max: 9999 });
  if (order !== undefined) {
    input.order_no = order;
  }
  const status = readStatus(body, errors);
  if (status) {
    input.status = status;
  }
  return input;
}

function catalogController(path: string, table: CatalogTable) {
  @Controller(path)
  class CatalogController {
    constructor(readonly catalogs: ContentCatalogsService) {}

    @Get()
    list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
      if (!isUuid(query.org_unit_id)) {
        throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
      }
      return this.catalogs.list(currentUser, table, query.org_unit_id, query.include_inactive === 'true');
    }

    @Post()
    @HttpCode(201)
    create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
      const errors: FieldError[] = [];
      const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
      const input = readCatalogInput(body, errors, true);
      check(errors);
      return this.catalogs.create(
        currentUser,
        table,
        { org_unit_id: orgUnitId, name: input.name ?? '', order_no: input.order_no ?? 0 },
        originOf(request, currentUser),
      );
    }

    @Patch(':id')
    update(
      @Param('id', uuidParameter('Mã danh mục không hợp lệ')) id: string,
      @Body() body: RequestBody,
      @Req() request: Request,
      @AuthenticatedUser() currentUser: CurrentUser,
    ) {
      const errors: FieldError[] = [];
      const input = readCatalogInput(body, errors, false);
      check(errors);
      return this.catalogs.update(currentUser, table, id, input, originOf(request, currentUser));
    }
  }
  return CatalogController;
}

export const ActivityCategoriesController = catalogController('activity-categories', 'activity_categories');
export const NewsCategoriesController = catalogController('news-categories', 'news_categories');
export const LibraryTopicsController = catalogController('library-topics', 'library_topics');

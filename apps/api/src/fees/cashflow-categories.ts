import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CashflowType, CatalogStatus } from '@school-management/database';
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
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { assertStaff, readEnum } from './fee-catalog-fields.js';

// Khoản mục và nhóm thu chi dùng chung toàn trường; phiếu thu, phiếu chi bắt buộc chọn khoản mục (P06-10, BR-36, YCTD-49)
const FLOW_TYPES: readonly CashflowType[] = ['income', 'expense'];
const COLUMNS = ['id', 'code', 'name', 'group_name', 'flow_type', 'status'] as const;

interface CategoryChanges {
  name?: string;
  group_name?: string;
  status?: CatalogStatus;
}

@Injectable()
export class CashflowCategoriesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, filter: { status?: CatalogStatus; flowType?: CashflowType }) {
    assertStaff(currentUser);
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('cashflow_categories').select(COLUMNS);
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.flowType) {
      query = query.where('flow_type', '=', filter.flowType);
    }
    return query.orderBy('flow_type', 'desc').orderBy('group_name').orderBy('code').execute();
  }

  async create(
    input: { code: string; name: string; group_name: string; flow_type: CashflowType },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('cashflow_categories')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'cashflow_categories',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã khoản mục đã tồn tại',
      'code',
    );
  }

  // Mã và loại thu chi không đổi để số liệu đã ghi giữ đúng nhóm
  async update(categoryId: string, changes: CategoryChanges, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('cashflow_categories')
      .select(COLUMNS)
      .where('id', '=', categoryId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy khoản mục', 'cashflow_category');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('cashflow_categories')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', categoryId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'cashflow_categories',
        entityId: categoryId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}

// Nhân sự xem được; kế toán và kế toán trưởng tạo, sửa (P06-10)
@Controller('cashflow-categories')
export class CashflowCategoriesController {
  constructor(private readonly categoriesService: CashflowCategoriesService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const status = readStatus(query.status === undefined ? undefined : { status: query.status }, errors);
    const flowType = readEnum(query, 'flow_type', FLOW_TYPES, errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.categoriesService.list(currentUser, { status, flowType });
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.cashflowCategoryManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      group_name: readRequiredText(body, 'group_name', errors),
      flow_type: readEnum(body, 'flow_type', FLOW_TYPES, errors, true) ?? 'income',
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.categoriesService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.cashflowCategoryManage)
  update(
    @Param('id', uuidParameter('Mã khoản mục không hợp lệ')) categoryId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined || body?.flow_type !== undefined) {
      errors.push({ field: 'code', message: 'Mã và loại thu chi không đổi được' });
    }
    const changes: CategoryChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      group_name: body?.group_name === undefined ? undefined : readRequiredText(body, 'group_name', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.categoriesService.update(categoryId, changes, originOf(request, currentUser));
  }
}

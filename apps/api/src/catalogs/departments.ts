import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { CatalogAccess } from './catalog-access.js';

// Phòng ban theo đơn vị, có phòng ban cha cùng đơn vị (P01-03)
export interface Department {
  id: string;
  org_unit_id: string;
  parent_id: string | null;
  name: string;
  status: CatalogStatus;
}

interface DepartmentChanges {
  name?: string;
  parent_id?: string | null;
  status?: CatalogStatus;
}

const COLUMNS = ['id', 'org_unit_id', 'parent_id', 'name', 'status'] as const;
const PERMISSION = PERMISSION_CODES.departmentManage;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly catalogAccess: CatalogAccess,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string): Promise<Department[]> {
    const database = await this.catalogAccess.readableDatabase(currentUser, orgUnitId);
    if (!database) {
      return [];
    }
    return database
      .selectFrom('departments')
      .select(COLUMNS)
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
  }

  async create(
    currentUser: CurrentUser,
    input: { org_unit_id: string; parent_id: string | null; name: string },
    origin: ChangeOrigin,
  ): Promise<Department> {
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, input.org_unit_id);
    if (input.parent_id) {
      await this.assertValidParent(database, input.org_unit_id, input.parent_id, null);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('departments')
        .values({ ...input, created_by: origin.actorUserId })
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: created.org_unit_id,
        entityName: 'departments',
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
    departmentId: string,
    changes: DepartmentChanges,
    origin: ChangeOrigin,
  ): Promise<Department> {
    const existing = await this.find(departmentId);
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    if (changes.parent_id && changes.parent_id !== existing.parent_id) {
      await this.assertValidParent(database, existing.org_unit_id, changes.parent_id, departmentId);
    }
    if (changes.status === 'inactive' && existing.status === 'active') {
      const activeChild = await database
        .selectFrom('departments')
        .select('name')
        .where('parent_id', '=', departmentId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (activeChild) {
        throw ruleViolationError('BR-75', 'Hãy ngừng sử dụng các phòng ban con trước', [
          { field: 'children', message: activeChild.name },
        ]);
      }
    }
    if (changes.status === 'active' && existing.status === 'inactive') {
      const parentId = changes.parent_id === undefined ? existing.parent_id : changes.parent_id;
      if (parentId) {
        await this.assertValidParent(database, existing.org_unit_id, parentId, departmentId);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('departments')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', departmentId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'departments',
        entityId: departmentId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  private async find(departmentId: string): Promise<Department> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('departments')
      .select(COLUMNS)
      .where('id', '=', departmentId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy phòng ban', 'department');
    }
    return existing;
  }

  // Phòng ban cha cùng đơn vị, đang hoạt động và không phải chính nó hoặc phòng ban con của nó
  private async assertValidParent(
    database: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
    orgUnitId: string,
    parentId: string,
    departmentId: string | null,
  ): Promise<void> {
    const departments = await database
      .selectFrom('departments')
      .select(['id', 'parent_id', 'org_unit_id', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .execute();
    const parent = departments.find((department) => department.id === parentId);
    if (!parent) {
      throw ruleViolationError('P01-03', 'Phòng ban cha phải thuộc cùng đơn vị');
    }
    if (parent.status !== 'active') {
      throw ruleViolationError('BR-75', 'Phòng ban cha đã ngừng sử dụng');
    }
    let ancestorId: string | null = parentId;
    while (departmentId && ancestorId) {
      if (ancestorId === departmentId) {
        throw ruleViolationError('P01-03', 'Không chọn được phòng ban con làm phòng ban cha');
      }
      ancestorId = departments.find((department) => department.id === ancestorId)?.parent_id ?? null;
    }
  }
}

// Ai có vai trò ở đơn vị đều xem được; VT-02 và VT-06 tạo, sửa trong phạm vi đơn vị (YCTD-42)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  list(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.departmentsService.list(currentUser, orgUnitId);
  }

  @Post()
  @RequirePermission(PERMISSION)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      parent_id: readOptionalUuid(body, 'parent_id', errors) ?? null,
      name: readRequiredText(body, 'name', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.departmentsService.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION)
  update(
    @Param('id', uuidParameter('Mã phòng ban không hợp lệ')) departmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: DepartmentChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      parent_id: readOptionalUuid(body, 'parent_id', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.departmentsService.update(currentUser, departmentId, changes, originOf(request, currentUser));
  }
}

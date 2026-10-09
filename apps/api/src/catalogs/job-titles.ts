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
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { CatalogAccess } from './catalog-access.js';

// Chức danh theo đơn vị, kèm cấp bậc ghi tự do (P01-04)
export interface JobTitle {
  id: string;
  org_unit_id: string;
  name: string;
  level: string | null;
  status: CatalogStatus;
}

interface JobTitleChanges {
  name?: string;
  level?: string | null;
  status?: CatalogStatus;
}

const COLUMNS = ['id', 'org_unit_id', 'name', 'level', 'status'] as const;
const PERMISSION = PERMISSION_CODES.departmentManage;
const DUPLICATE_MESSAGE = 'Tên chức danh đã có trong đơn vị';

@Injectable()
export class JobTitlesService {
  constructor(
    private readonly catalogAccess: CatalogAccess,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string): Promise<JobTitle[]> {
    const database = await this.catalogAccess.readableDatabase(currentUser, orgUnitId);
    if (!database) {
      return [];
    }
    return database
      .selectFrom('job_titles')
      .select(COLUMNS)
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
  }

  async create(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string; level: string | null },
    origin: ChangeOrigin,
  ): Promise<JobTitle> {
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, input.org_unit_id);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('job_titles')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: created.org_unit_id,
          entityName: 'job_titles',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      DUPLICATE_MESSAGE,
      'name',
    );
  }

  async update(
    currentUser: CurrentUser,
    jobTitleId: string,
    changes: JobTitleChanges,
    origin: ChangeOrigin,
  ): Promise<JobTitle> {
    const { database: current } = await this.currentSchoolYear.require();
    const existing = await current
      .selectFrom('job_titles')
      .select(COLUMNS)
      .where('id', '=', jobTitleId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy chức danh', 'job_title');
    }
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('job_titles')
          .set({ ...changes, updated_at: this.clock.now() })
          .where('id', '=', jobTitleId)
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'job_titles',
          entityId: jobTitleId,
          action: 'update',
          before: existing,
          after: updated,
        });
        return updated;
      }),
      DUPLICATE_MESSAGE,
      'name',
    );
  }
}

// Ai có vai trò ở đơn vị đều xem được; VT-02 và VT-06 tạo, sửa trong phạm vi đơn vị (YCTD-42)
@Controller('job-titles')
export class JobTitlesController {
  constructor(private readonly jobTitlesService: JobTitlesService) {}

  @Get()
  list(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.jobTitlesService.list(currentUser, orgUnitId);
  }

  @Post()
  @RequirePermission(PERMISSION)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readRequiredText(body, 'name', errors),
      level: readOptionalText(body, 'level', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.jobTitlesService.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION)
  update(
    @Param('id', uuidParameter('Mã chức danh không hợp lệ')) jobTitleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: JobTitleChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      level: readOptionalText(body, 'level', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.jobTitlesService.update(currentUser, jobTitleId, changes, originOf(request, currentUser));
  }
}

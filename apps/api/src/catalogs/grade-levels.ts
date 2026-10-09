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
  readRequiredInteger,
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Bậc học dùng chung toàn trường, độ tuổi theo tháng (P01-12, YCTD-42). Lớp và biểu phí tham chiếu theo mã nên mã không đổi được
export interface GradeLevel {
  id: string;
  code: string;
  name: string;
  age_from_months: number;
  age_to_months: number;
  order_no: number;
  status: CatalogStatus;
}

interface GradeLevelChanges {
  name?: string;
  age_from_months?: number;
  age_to_months?: number;
  order_no?: number;
  status?: CatalogStatus;
}

const COLUMNS = ['id', 'code', 'name', 'age_from_months', 'age_to_months', 'order_no', 'status'] as const;
const AGE_RANGE = { min: 0, max: 120 };
const ORDER_RANGE = { min: 0, max: 9999 };

function assertAgeOrder(ageFrom: number, ageTo: number): void {
  if (ageFrom > ageTo) {
    throw validationError([{ field: 'age_to_months', message: 'Tuổi đến phải lớn hơn hoặc bằng tuổi từ' }]);
  }
}

@Injectable()
export class GradeLevelsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(status?: CatalogStatus): Promise<GradeLevel[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('grade_levels').select(COLUMNS);
    if (status) {
      query = query.where('status', '=', status);
    }
    return query.orderBy('order_no').orderBy('code').execute();
  }

  async create(input: Omit<GradeLevel, 'id' | 'status'>, origin: ChangeOrigin): Promise<GradeLevel> {
    assertAgeOrder(input.age_from_months, input.age_to_months);
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('grade_levels')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'grade_levels',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã bậc học đã tồn tại',
      'code',
    );
  }

  async update(gradeLevelId: string, changes: GradeLevelChanges, origin: ChangeOrigin): Promise<GradeLevel> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('grade_levels')
      .select(COLUMNS)
      .where('id', '=', gradeLevelId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy bậc học', 'grade_level');
    }
    assertAgeOrder(
      changes.age_from_months ?? existing.age_from_months,
      changes.age_to_months ?? existing.age_to_months,
    );
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('grade_levels')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', gradeLevelId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'grade_levels',
        entityId: gradeLevelId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}

// Mọi người đã đăng nhập xem được để chọn bậc học; chỉ VT-02 tạo, sửa (YCTD-42)
@Controller('grade-levels')
export class GradeLevelsController {
  constructor(private readonly gradeLevelsService: GradeLevelsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const errors: FieldError[] = [];
    const parsedStatus = readStatus(status === undefined ? undefined : { status }, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.list(parsedStatus);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      age_from_months: readRequiredInteger(body, 'age_from_months', errors, AGE_RANGE),
      age_to_months: readRequiredInteger(body, 'age_to_months', errors, AGE_RANGE),
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE) ?? 0,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã bậc học không hợp lệ')) gradeLevelId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined) {
      errors.push({ field: 'code', message: 'Mã bậc học không đổi được vì lớp và biểu phí tham chiếu theo mã' });
    }
    const changes: GradeLevelChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      age_from_months: readInteger(body, 'age_from_months', errors, AGE_RANGE),
      age_to_months: readInteger(body, 'age_to_months', errors, AGE_RANGE),
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.update(gradeLevelId, changes, originOf(request, currentUser));
  }
}

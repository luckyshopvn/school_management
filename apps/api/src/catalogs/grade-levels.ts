import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  GRADE_LEVEL_TEMPLATES,
  PERMISSION_CODES,
  nextGradeLevel,
  usesAgeGroups,
  type GradeProgression,
  type SchoolLevelCode,
} from '@school-management/shared';
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
import { SchoolLevelResolver } from '../common/school-levels.js';
import { assertLevelEnabled, readSchoolLevel, STRUCTURE_RULE_CODE } from './school-level-fields.js';

// Bậc học (khối) dùng chung toàn trường, độ tuổi theo tháng (P01-12, YCTD-42). Lớp và biểu phí tham chiếu theo mã nên mã không
// đổi được. Khối thuộc một cấp học (DT-19 phần 19b, YCTD-152): khối Mầm non bắt buộc tháng tuổi, khối của cấp khác bỏ trống
// được; mã khối không trùng trong trường kể cả giữa các cấp; cấp của khối không đổi sau khi tạo vì lớp lấy cấp theo khối
export interface GradeLevel {
  id: string;
  code: string;
  name: string;
  age_from_months: number | null;
  age_to_months: number | null;
  order_no: number;
  status: CatalogStatus;
  school_level: SchoolLevelCode;
}

export interface GradeLevelInput {
  code: string;
  name: string;
  age_from_months: number | null;
  age_to_months: number | null;
  order_no: number;
  school_level: SchoolLevelCode;
}

interface GradeLevelChanges {
  name?: string;
  age_from_months?: number | null;
  age_to_months?: number | null;
  order_no?: number;
  status?: CatalogStatus;
}

// Kết quả nạp khối mẫu của một cấp: khối thêm mới và mã đã có nên bỏ qua
export interface GradeTemplateResult {
  created: GradeLevel[];
  skipped: string[];
}

const COLUMNS = [
  'id',
  'code',
  'name',
  'age_from_months',
  'age_to_months',
  'order_no',
  'status',
  'school_level',
] as const;
const AGE_RANGE = { min: 0, max: 120 };
const ORDER_RANGE = { min: 0, max: 9999 };

// Mầm non nhập đủ hai tháng tuổi; cấp khác nhập cả hai hoặc bỏ trống cả hai
export function assertGradeAges(level: SchoolLevelCode, ageFrom: number | null, ageTo: number | null): void {
  const errors: FieldError[] = [];
  if (usesAgeGroups(level)) {
    if (ageFrom === null) {
      errors.push({ field: 'age_from_months', message: 'Bắt buộc nhập' });
    }
    if (ageTo === null) {
      errors.push({ field: 'age_to_months', message: 'Bắt buộc nhập' });
    }
  } else if ((ageFrom === null) !== (ageTo === null)) {
    errors.push({
      field: ageFrom === null ? 'age_from_months' : 'age_to_months',
      message: 'Nhập cả tuổi từ và tuổi đến hoặc bỏ trống cả hai',
    });
  }
  if (errors.length === 0 && ageFrom !== null && ageTo !== null && ageFrom > ageTo) {
    errors.push({ field: 'age_to_months', message: 'Tuổi đến phải lớn hơn hoặc bằng tuổi từ' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

// Tháng tuổi gửi lên: trống hoặc null là bỏ trống (máy chủ kiểm tra bắt buộc theo cấp), số phải trong khoảng
function readAge(body: RequestBody, field: string, errors: FieldError[]): number | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return readInteger(body, field, errors, AGE_RANGE) ?? null;
}

@Injectable()
export class GradeLevelsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  async list(status?: CatalogStatus, level?: SchoolLevelCode): Promise<GradeLevel[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('grade_levels').select(COLUMNS);
    if (status) {
      query = query.where('status', '=', status);
    }
    if (level) {
      query = query.where('school_level', '=', level);
    }
    return query.orderBy('order_no').orderBy('code').execute();
  }

  async create(input: GradeLevelInput, origin: ChangeOrigin): Promise<GradeLevel> {
    assertGradeAges(input.school_level, input.age_from_months, input.age_to_months);
    await assertLevelEnabled(this.schoolLevels, input.school_level);
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

  // Nạp khối mẫu của cấp (Tiểu học khối 1 đến 5, THCS 6 đến 9, THPT 10 đến 12); mã đã có thì bỏ qua, không sửa khối đã có
  async loadTemplate(level: SchoolLevelCode, origin: ChangeOrigin): Promise<GradeTemplateResult> {
    const templates = GRADE_LEVEL_TEMPLATES[level];
    if (templates.length === 0) {
      throw ruleViolationError(
        STRUCTURE_RULE_CODE,
        'Cấp Mầm non không có khối mẫu; nhà trường khai báo khối của mình',
        [{ field: 'school_level', message: 'Chọn Tiểu học, THCS hoặc THPT' }],
      );
    }
    await assertLevelEnabled(this.schoolLevels, level);
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (
          await transaction
            .selectFrom('grade_levels')
            .select('code')
            .where(
              'code',
              'in',
              templates.map((item) => item.code),
            )
            .execute()
        ).map((row) => row.code),
      );
      const result: GradeTemplateResult = { created: [], skipped: [] };
      for (const template of templates) {
        if (existing.has(template.code)) {
          result.skipped.push(template.code);
          continue;
        }
        const created = await transaction
          .insertInto('grade_levels')
          .values({
            ...template,
            school_level: level,
            age_from_months: null,
            age_to_months: null,
            created_by: origin.actorUserId,
          })
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
        result.created.push(created);
      }
      return result;
    });
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
    assertGradeAges(
      existing.school_level,
      changes.age_from_months !== undefined ? changes.age_from_months : existing.age_from_months,
      changes.age_to_months !== undefined ? changes.age_to_months : existing.age_to_months,
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

  // Khối kế tiếp khi lên lớp (YCTD-152), theo các cấp đang bật của trường
  async next(code: string): Promise<GradeProgression> {
    const progression = nextGradeLevel(await this.list(), await this.schoolLevels.enabled(), code);
    if (!progression) {
      throw notFoundError('Không tìm thấy bậc học', 'grade_level');
    }
    return progression;
  }
}

// Mọi người đã đăng nhập xem được để chọn bậc học; chỉ VT-02 tạo, sửa (YCTD-42)
@Controller('grade-levels')
export class GradeLevelsController {
  constructor(private readonly gradeLevelsService: GradeLevelsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('school_level') level?: string) {
    const errors: FieldError[] = [];
    const parsedStatus = readStatus(status === undefined ? undefined : { status }, errors);
    const parsedLevel = readSchoolLevel({ school_level: level }, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.list(parsedStatus, parsedLevel);
  }

  @Get('next')
  next(@Query('code') code?: string) {
    if (!code) {
      throw validationError([{ field: 'code', message: 'Bắt buộc nhập mã bậc học' }]);
    }
    return this.gradeLevelsService.next(code);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: GradeLevelInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      age_from_months: readAge(body, 'age_from_months', errors) ?? null,
      age_to_months: readAge(body, 'age_to_months', errors) ?? null,
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE) ?? 0,
      school_level: readSchoolLevel(body, 'school_level', errors) ?? 'MN',
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.create(input, originOf(request, currentUser));
  }

  @Post('templates')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.catalogManage)
  loadTemplate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readSchoolLevel(body, 'school_level', errors);
    if (!level && errors.length === 0) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
    }
    if (errors.length > 0 || !level) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.loadTemplate(level, originOf(request, currentUser));
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
    if (body?.school_level !== undefined) {
      errors.push({ field: 'school_level', message: 'Cấp học của khối không đổi được vì lớp lấy cấp theo khối' });
    }
    const changes: GradeLevelChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      age_from_months: readAge(body, 'age_from_months', errors),
      age_to_months: readAge(body, 'age_to_months', errors),
      order_no: readInteger(body, 'order_no', errors, ORDER_RANGE),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.gradeLevelsService.update(gradeLevelId, changes, originOf(request, currentUser));
  }
}

import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readOptionalText,
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readSchoolLevel, STRUCTURE_RULE_CODE } from './school-level-fields.js';

// Khung chương trình theo cấp (DT-19 phần 19b, YCTD-152): mã, tên, cấp, khối áp dụng (trống là mọi khối của cấp), mặc định
// của cấp. Lớp chọn chương trình cùng cấp; lớp không chọn theo chương trình mặc định của cấp. Chương trình môn học, số tiết là
// DT-20, DT-21. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: đặt mặc định mới thì bỏ mặc định cũ của cấp; không
// ngừng dùng chương trình mặc định; cấp của chương trình không đổi sau khi tạo
export interface Curriculum {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  grade_level_codes: string[];
  is_default: boolean;
  note: string | null;
  status: CatalogStatus;
}

interface CurriculumInput {
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  grade_level_codes: string[];
  is_default: boolean;
  note: string | null;
}

type CurriculumChanges = Partial<Omit<CurriculumInput, 'code' | 'school_level'>> & { status?: CatalogStatus };
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const COLUMNS = ['id', 'code', 'name', 'school_level', 'grade_level_codes', 'is_default', 'note', 'status'] as const;

function readGradeCodes(body: RequestBody, errors: FieldError[]): string[] | undefined {
  const value = body?.grade_level_codes;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((code) => typeof code !== 'string' || code.trim() === '')) {
    errors.push({ field: 'grade_level_codes', message: 'Danh sách mã khối không hợp lệ' });
    return undefined;
  }
  return [...new Set(value.map((code: string) => code.trim()))];
}

function readFlag(body: RequestBody, field: string, errors: FieldError[]): boolean | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Phải là đúng hoặc sai' });
    return undefined;
  }
  return value;
}

// Khối áp dụng phải là khối có trong danh mục và cùng cấp với chương trình
async function assertGradeCodes(database: Executor, level: SchoolLevelCode, codes: string[]): Promise<void> {
  if (codes.length === 0) {
    return;
  }
  const grades = await database
    .selectFrom('grade_levels')
    .select(['code', 'school_level'])
    .where('code', 'in', codes)
    .execute();
  const wrong = codes.filter((code) => grades.find((grade) => grade.code === code)?.school_level !== level);
  if (wrong.length > 0) {
    throw ruleViolationError(STRUCTURE_RULE_CODE, `Khối ${wrong.join(', ')} không có hoặc không thuộc cấp của chương trình`, [
      { field: 'grade_level_codes', message: 'Chọn khối cùng cấp' },
    ]);
  }
}

@Injectable()
export class CurriculaService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(level?: SchoolLevelCode): Promise<Curriculum[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('curricula').select(COLUMNS);
    if (level) {
      query = query.where('school_level', '=', level);
    }
    return query.orderBy('school_level').orderBy('code').execute();
  }

  async create(input: CurriculumInput, origin: ChangeOrigin): Promise<Curriculum> {
    const { database } = await this.currentSchoolYear.require();
    await assertGradeCodes(database, input.school_level, input.grade_level_codes);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        if (input.is_default) {
          await this.clearDefault(transaction, input.school_level);
        }
        const created = await transaction
          .insertInto('curricula')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'curricula',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã chương trình đã tồn tại',
      'code',
    );
  }

  async update(curriculumId: string, changes: CurriculumChanges, origin: ChangeOrigin): Promise<Curriculum> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('curricula')
      .select(COLUMNS)
      .where('id', '=', curriculumId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy chương trình', 'curriculum');
    }
    const isDefault = changes.is_default ?? existing.is_default;
    if (isDefault && (changes.status ?? existing.status) === 'inactive') {
      throw ruleViolationError(STRUCTURE_RULE_CODE, 'Chương trình mặc định của cấp không ngừng sử dụng được', [
        { field: 'status', message: 'Đặt chương trình khác làm mặc định trước' },
      ]);
    }
    if (changes.is_default === false && existing.is_default) {
      throw ruleViolationError(STRUCTURE_RULE_CODE, 'Mỗi cấp cần một chương trình mặc định', [
        { field: 'is_default', message: 'Đặt chương trình khác làm mặc định thay cho chương trình này' },
      ]);
    }
    if (changes.grade_level_codes) {
      await assertGradeCodes(database, existing.school_level, changes.grade_level_codes);
    }
    return database.transaction().execute(async (transaction) => {
      if (changes.is_default && !existing.is_default) {
        await this.clearDefault(transaction, existing.school_level);
      }
      const updated = await transaction
        .updateTable('curricula')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', curriculumId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'curricula',
        entityId: curriculumId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  private async clearDefault(transaction: Transaction<SchoolYearDatabase>, level: SchoolLevelCode): Promise<void> {
    await transaction
      .updateTable('curricula')
      .set({ is_default: false, updated_at: this.clock.now() })
      .where('school_level', '=', level)
      .where('is_default', '=', true)
      .execute();
  }
}

// Mọi người đã đăng nhập xem được để chọn chương trình cho lớp; chỉ người quản lý danh mục tạo, sửa (như bậc học)
@Controller('curricula')
export class CurriculaController {
  constructor(private readonly curriculaService: CurriculaService) {}

  @Get()
  list(@Query('school_level') level?: string) {
    const errors: FieldError[] = [];
    const parsed = readSchoolLevel({ school_level: level }, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.curriculaService.list(parsed);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readSchoolLevel(body, 'school_level', errors);
    if (!level && body?.school_level === undefined) {
      errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
    }
    const input: CurriculumInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      school_level: level ?? 'MN',
      grade_level_codes: readGradeCodes(body, errors) ?? [],
      is_default: readFlag(body, 'is_default', errors) ?? false,
      note: readOptionalText(body, 'note', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.curriculaService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã chương trình không hợp lệ')) curriculumId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['code', 'school_level']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Mã và cấp của chương trình không đổi được' });
      }
    }
    const changes: CurriculumChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      grade_level_codes: readGradeCodes(body, errors),
      is_default: readFlag(body, 'is_default', errors),
      note: readOptionalText(body, 'note', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.curriculaService.update(curriculumId, changes, originOf(request, currentUser));
  }
}

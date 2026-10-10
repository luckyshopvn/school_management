import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus, DiscountCalculationMethod, SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
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
import { assertStaff, readAmount, readEnum } from './fee-catalog-fields.js';

// Danh mục loại miễn giảm dùng chung toàn trường (P05-11, BR-20, BR-21, BR-75, YCTD-49): theo phần trăm hoặc số tiền,
// áp dụng cho học phí chính khóa ('tuition') và các dịch vụ được chọn
const METHODS: readonly DiscountCalculationMethod[] = ['percent', 'amount'];
export const TUITION_TARGET = 'tuition';

interface DiscountTypeInput {
  code: string;
  name: string;
  calculation_method: DiscountCalculationMethod;
  value: number;
  applies_to: string[];
  condition_note: string | null;
}

interface DiscountTypeChanges {
  name?: string;
  value?: number;
  applies_to?: string[];
  condition_note?: string | null;
  status?: CatalogStatus;
}

const COLUMNS = [
  'id',
  'code',
  'name',
  'calculation_method',
  'value',
  'applies_to',
  'condition_note',
  'status',
] as const;

type DiscountTypeRow = {
  id: string;
  code: string;
  name: string;
  calculation_method: DiscountCalculationMethod;
  value: string;
  applies_to: string[];
  condition_note: string | null;
  status: CatalogStatus;
};

const present = (row: DiscountTypeRow) => ({ ...row, value: Number(row.value) });

function readValue(body: RequestBody, method: DiscountCalculationMethod | undefined, errors: FieldError[]) {
  if (method === 'percent') {
    const value = body?.value;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
      errors.push({ field: 'value', message: 'Phần trăm là số nguyên từ 1 đến 100' });
      return 0;
    }
    return value;
  }
  return readAmount(body?.value, 'value', errors, 1);
}

function readTargets(body: RequestBody, errors: FieldError[]): string[] {
  const raw = body?.applies_to;
  if (!Array.isArray(raw) || raw.length === 0 || raw.some((target) => typeof target !== 'string')) {
    errors.push({ field: 'applies_to', message: 'Chọn ít nhất một khoản áp dụng' });
    return [];
  }
  return [...new Set(raw as string[])];
}

@Injectable()
export class DiscountTypesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, status?: CatalogStatus) {
    assertStaff(currentUser);
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('discount_types').select(COLUMNS);
    if (status) {
      query = query.where('status', '=', status);
    }
    return (await query.orderBy('code').execute()).map(present);
  }

  async create(input: DiscountTypeInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertTargets(database, input.applies_to);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('discount_types')
          .values({ ...input, applies_to: JSON.stringify(input.applies_to), created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'discount_types',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return present(created);
      }),
      'Mã loại miễn giảm đã tồn tại',
      'code',
    );
  }

  // Ngừng sử dụng thì giảm trừ cũ giữ nguyên, không chọn được cho giảm trừ mới (BR-75); mã và cách tính không đổi
  async update(discountTypeId: string, changes: DiscountTypeChanges, valueBody: RequestBody, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('discount_types')
      .select(COLUMNS)
      .where('id', '=', discountTypeId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy loại miễn giảm', 'discount_type');
    }
    if (valueBody?.value !== undefined) {
      const errors: FieldError[] = [];
      changes.value = readValue(valueBody, existing.calculation_method, errors);
      if (errors.length > 0) {
        throw validationError(errors);
      }
    }
    if (changes.applies_to) {
      await this.assertTargets(database, changes.applies_to);
    }
    return database.transaction().execute(async (transaction) => {
      const { applies_to: appliesTo, ...rest } = changes;
      const updated = await transaction
        .updateTable('discount_types')
        .set({
          ...rest,
          ...(appliesTo ? { applies_to: JSON.stringify(appliesTo) } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', discountTypeId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'discount_types',
        entityId: discountTypeId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return present(updated);
    });
  }

  private async assertTargets(database: Kysely<SchoolYearDatabase>, targets: string[]): Promise<void> {
    const services = new Set((await database.selectFrom('services').select('id').execute()).map((row) => row.id));
    const unknown = targets.filter((target) => target !== TUITION_TARGET && !services.has(target));
    if (unknown.length > 0) {
      throw validationError([
        {
          field: 'applies_to',
          message: 'Khoản áp dụng là học phí chính khóa (tuition) hoặc mã dịch vụ có trong danh mục',
        },
      ]);
    }
  }
}

// Nhân sự xem được; kế toán và Hiệu trưởng tạo, sửa (P05-11)
@Controller('discount-types')
export class DiscountTypesController {
  constructor(private readonly discountTypesService: DiscountTypesService) {}

  @Get()
  list(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const parsedStatus = readStatus(status === undefined ? undefined : { status }, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.discountTypesService.list(currentUser, parsedStatus);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.discountTypeManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const method = readEnum(body, 'calculation_method', METHODS, errors, true);
    const input: DiscountTypeInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      calculation_method: method ?? 'percent',
      value: readValue(body, method, errors),
      applies_to: readTargets(body, errors),
      condition_note: readOptionalText(body, 'condition_note', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.discountTypesService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.discountTypeManage)
  update(
    @Param('id', uuidParameter('Mã loại miễn giảm không hợp lệ')) discountTypeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined || body?.calculation_method !== undefined) {
      errors.push({ field: 'code', message: 'Mã và cách tính của loại miễn giảm không đổi được' });
    }
    const changes: DiscountTypeChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      applies_to: body?.applies_to === undefined ? undefined : readTargets(body, errors),
      condition_note: readOptionalText(body, 'condition_note', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.discountTypesService.update(discountTypeId, changes, body, originOf(request, currentUser));
  }
}

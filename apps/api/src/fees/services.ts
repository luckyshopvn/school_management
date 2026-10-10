import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus, ServiceCalculationMethod } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
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
import { readBoolean, readEnum } from './fee-catalog-fields.js';

// Danh mục dịch vụ dùng chung toàn trường (P05-02, BR-19, BR-75, BR-83, YCTD-49). Bán trú do hệ thống tạo sẵn
export const CALCULATION_METHODS: readonly ServiceCalculationMethod[] = ['monthly', 'per_present_day'];

export interface ServiceRecord {
  id: string;
  code: string;
  name: string;
  unit: string;
  calculation_method: ServiceCalculationMethod;
  is_mandatory: boolean;
  is_system: boolean;
  status: CatalogStatus;
}

interface ServiceChanges {
  name?: string;
  unit?: string;
  calculation_method?: ServiceCalculationMethod;
  is_mandatory?: boolean;
  status?: CatalogStatus;
}

const COLUMNS = ['id', 'code', 'name', 'unit', 'calculation_method', 'is_mandatory', 'is_system', 'status'] as const;

@Injectable()
export class ServicesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(status?: CatalogStatus): Promise<ServiceRecord[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('services').select(COLUMNS);
    if (status) {
      query = query.where('status', '=', status);
    }
    return query.orderBy('is_system', 'desc').orderBy('code').execute();
  }

  async create(
    input: Pick<ServiceRecord, 'code' | 'name' | 'unit' | 'calculation_method' | 'is_mandatory'>,
    origin: ChangeOrigin,
  ): Promise<ServiceRecord> {
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('services')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'services',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã dịch vụ đã tồn tại',
      'code',
    );
  }

  // Ngừng sử dụng thì đăng ký cũ giữ nguyên, không đăng ký mới được (BR-75); bán trú không ngừng, không đổi cách tính (BR-83)
  async update(serviceId: string, changes: ServiceChanges, origin: ChangeOrigin): Promise<ServiceRecord> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('services')
      .select(COLUMNS)
      .where('id', '=', serviceId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy dịch vụ', 'service');
    }
    if (
      existing.is_system &&
      (changes.status === 'inactive' ||
        (changes.calculation_method !== undefined && changes.calculation_method !== existing.calculation_method) ||
        changes.is_mandatory === false)
    ) {
      throw ruleViolationError('BR-83', 'Bán trú là dịch vụ bắt buộc, không ngừng sử dụng và không đổi cách tính được');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('services')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', serviceId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'services',
        entityId: serviceId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}

// Mọi người đã đăng nhập xem được để đăng ký dịch vụ; kế toán tạo, sửa (P05-02)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(@Query('status') status?: string) {
    const errors: FieldError[] = [];
    const parsedStatus = readStatus(status === undefined ? undefined : { status }, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.servicesService.list(parsedStatus);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.feeCatalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      unit: readRequiredText(body, 'unit', errors),
      calculation_method: readEnum(body, 'calculation_method', CALCULATION_METHODS, errors, true) ?? 'monthly',
      is_mandatory: readBoolean(body, 'is_mandatory', errors) ?? false,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.servicesService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.feeCatalogManage)
  update(
    @Param('id', uuidParameter('Mã dịch vụ không hợp lệ')) serviceId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined) {
      errors.push({ field: 'code', message: 'Mã dịch vụ không đổi được' });
    }
    const changes: ServiceChanges = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      unit: body?.unit === undefined ? undefined : readRequiredText(body, 'unit', errors),
      calculation_method: readEnum(body, 'calculation_method', CALCULATION_METHODS, errors, false),
      is_mandatory: readBoolean(body, 'is_mandatory', errors),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.servicesService.update(serviceId, changes, originOf(request, currentUser));
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { OrgUnitStatus, OrgUnitType } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { OrgUnitsService, type ChangeOrigin, type OrgUnitChanges, type OrgUnitInput } from './org-units.service.js';

type RequestBody = Record<string, unknown> | undefined;

const UNIT_TYPES: OrgUnitType[] = ['truong_chinh', 'phan_hieu', 'diem_truong'];
const STATUSES: OrgUnitStatus[] = ['active', 'inactive'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readOptionalText(body: RequestBody, field: string, errors: FieldError[]): string | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return undefined;
  }
  return value.trim() === '' ? null : value.trim();
}

function readRequiredText(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = readOptionalText(body, field, errors);
  if (!value) {
    errors.push({ field, message: 'Bắt buộc nhập' });
    return '';
  }
  return value;
}

function readOptionalUuid(body: RequestBody, field: string, errors: FieldError[]): string | null | undefined {
  const value = readOptionalText(body, field, errors);
  if (value && !UUID_PATTERN.test(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return undefined;
  }
  return value;
}

function readUnitType(value: unknown, errors: FieldError[]): OrgUnitType | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!UNIT_TYPES.includes(value as OrgUnitType)) {
    errors.push({ field: 'unit_type', message: 'Loại đơn vị phải là truong_chinh, phan_hieu hoặc diem_truong' });
    return undefined;
  }
  return value as OrgUnitType;
}

function originOf(request: Request, currentUser: CurrentUser): ChangeOrigin {
  return { actorUserId: currentUser.id, ipAddress: request.ip ?? null };
}

// Cây đơn vị hai cấp (P01-01); mọi người đã đăng nhập xem được, chỉ VT-02 sửa được (PQ-12)
@Controller('org-units')
export class OrgUnitsController {
  constructor(private readonly orgUnitsService: OrgUnitsService) {}

  @Get()
  list(@Query('unit_type') unitType?: string, @Query('status') status?: string) {
    const errors: FieldError[] = [];
    const parsedType = readUnitType(unitType, errors);
    if (status !== undefined && !STATUSES.includes(status as OrgUnitStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái phải là active hoặc inactive' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.orgUnitsService.list({ unitType: parsedType, status: status as OrgUnitStatus | undefined });
  }

  @Get('tree')
  tree() {
    return this.orgUnitsService.tree();
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.orgUnitManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const unitType = readUnitType(body?.unit_type, errors);
    if (body?.unit_type === undefined) {
      errors.push({ field: 'unit_type', message: 'Bắt buộc chọn loại đơn vị' });
    }
    const input: OrgUnitInput = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      unit_type: unitType ?? 'diem_truong',
      parent_id: readOptionalUuid(body, 'parent_id', errors) ?? null,
      address: readOptionalText(body, 'address', errors) ?? null,
      phone: readOptionalText(body, 'phone', errors) ?? null,
      manager_user_id: readOptionalUuid(body, 'manager_user_id', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.orgUnitsService.create(input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.orgUnitManage)
  update(
    @Param('id', uuidParameter('Mã đơn vị không hợp lệ')) orgUnitId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: OrgUnitChanges = {
      code: body?.code === undefined ? undefined : readRequiredText(body, 'code', errors),
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      unit_type: readUnitType(body?.unit_type, errors),
      parent_id: readOptionalUuid(body, 'parent_id', errors),
      address: readOptionalText(body, 'address', errors),
      phone: readOptionalText(body, 'phone', errors),
      manager_user_id: readOptionalUuid(body, 'manager_user_id', errors),
    };
    if (body?.status !== undefined) {
      if (!STATUSES.includes(body.status as OrgUnitStatus)) {
        errors.push({ field: 'status', message: 'Trạng thái phải là active hoặc inactive' });
      } else {
        changes.status = body.status as OrgUnitStatus;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.orgUnitsService.update(orgUnitId, changes, originOf(request, currentUser));
  }
}

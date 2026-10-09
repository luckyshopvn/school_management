import { Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { SettingsService } from './settings.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readOrgUnitId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
  }
  return value;
}

// Cấu hình theo đơn vị (P01-08); ai có vai trò trong đơn vị đều xem được, VT-02 và VT-03 sửa được (PQ-15)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  read(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.settingsService.read(currentUser, readOrgUnitId(orgUnitId));
  }

  @Put()
  @RequirePermission(PERMISSION_CODES.settingManage)
  update(
    @Body() body: Record<string, unknown> | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const values = body?.values;
    if (typeof values !== 'object' || values === null || Array.isArray(values) || Object.keys(values).length === 0) {
      throw validationError([{ field: 'values', message: 'Cần ít nhất một mục cấu hình' }]);
    }
    return this.settingsService.update(
      currentUser,
      readOrgUnitId(body?.org_unit_id),
      values as Record<string, unknown>,
      originOf(request, currentUser),
    );
  }
}

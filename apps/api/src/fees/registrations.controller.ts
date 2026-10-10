import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { LateChargeMethod } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readOptionalText, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from './fee-catalog-fields.js';
import { parsePeriod } from './registration-periods.js';
import { ServiceRegistrationsService } from './registrations.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHARGE_METHODS: readonly LateChargeMethod[] = ['full_month', 'actual_days'];

function readRequiredUnit(value: unknown): string {
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
  }
  return value;
}

// Đăng ký dịch vụ theo tháng, chốt kỳ, duyệt đăng ký và hủy trễ, đăng ký học hè (P05-03, P05-04, P05-13; YCTD-50).
// Quyền kiểm tra ở tầng nghiệp vụ theo quan hệ phụ huynh và phạm vi đơn vị
@Controller()
export class ServiceRegistrationsController {
  constructor(private readonly registrations: ServiceRegistrationsService) {}

  @Get('service-registrations/periods')
  periods() {
    return this.registrations.periodList();
  }

  @Get('service-registrations')
  sheet(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.registrations.sheet(currentUser, readRequiredUnit(query.org_unit_id), parsePeriod(query.period));
  }

  @Get('service-registrations/pending')
  pending(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.registrations.pending(currentUser, orgUnitId ? readRequiredUnit(orgUnitId) : null);
  }

  @Get('children/:id/service-registrations')
  childView(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query('period') period: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.registrations.childView(currentUser, childId, parsePeriod(period));
  }

  @Post('service-registrations')
  @HttpCode(201)
  register(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ');
    const serviceId = readRequiredUuid(body, 'service_id', errors, 'Bắt buộc chọn dịch vụ');
    const startDate = body?.service_start_date;
    if (
      startDate !== undefined &&
      startDate !== null &&
      (typeof startDate !== 'string' || !DATE_PATTERN.test(startDate))
    ) {
      errors.push({ field: 'service_start_date', message: 'Ngày dạng YYYY-MM-DD' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.registrations.register(
      currentUser,
      {
        childId,
        serviceId,
        period: parsePeriod(body?.period),
        serviceStartDate: (startDate as string | null | undefined) ?? null,
      },
      originOf(request, currentUser),
    );
  }

  @Post('service-registrations/lock')
  @HttpCode(200)
  lock(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.registrations.lock(
      currentUser,
      readRequiredUnit(body?.org_unit_id),
      parsePeriod(body?.period),
      originOf(request, currentUser),
    );
  }

  @Post('service-registrations/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã đăng ký không hợp lệ')) registrationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.registrations.cancel(currentUser, registrationId, originOf(request, currentUser));
  }

  @Post('service-registrations/:id/approve-late')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã đăng ký không hợp lệ')) registrationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const chargeMethod = readEnum(body, 'charge_method', CHARGE_METHODS, errors, false) ?? null;
    const note = readOptionalText(body, 'note', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.registrations.decide(
      currentUser,
      registrationId,
      { approve: true, chargeMethod, note },
      originOf(request, currentUser),
    );
  }

  @Post('service-registrations/:id/reject-late')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã đăng ký không hợp lệ')) registrationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.registrations.decide(
      currentUser,
      registrationId,
      { approve: false, chargeMethod: null, note: reason },
      originOf(request, currentUser),
    );
  }

  @Get('summer-registrations')
  summerList(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.child_id !== undefined && !isUuid(query.child_id)) {
      throw validationError([{ field: 'child_id', message: 'Mã trẻ không hợp lệ' }]);
    }
    return this.registrations.summerList(currentUser, {
      childId: query.child_id,
      orgUnitId: query.org_unit_id === undefined ? undefined : readRequiredUnit(query.org_unit_id),
      period: query.period === undefined ? undefined : parsePeriod(query.period),
    });
  }

  @Post('summer-registrations')
  @HttpCode(201)
  registerSummer(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.registrations.registerSummer(
      currentUser,
      childId,
      parsePeriod(body?.period),
      originOf(request, currentUser),
    );
  }

  @Delete('summer-registrations/:id')
  cancelSummer(
    @Param('id', uuidParameter('Mã đăng ký học hè không hợp lệ')) summerRegistrationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.registrations.cancelSummer(currentUser, summerRegistrationId, originOf(request, currentUser));
  }
}

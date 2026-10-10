import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { PickupType } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { PickupsService, type PickupPerson } from './pickups.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^0\d{9}$/;
const PICKUP_TYPES: PickupType[] = ['handover', 'gate_check'];

function readOptionalDate(value: unknown, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

function readLimitedText(body: RequestBody, field: string, errors: FieldError[], maximum: number): string {
  const value = readRequiredText(body, field, errors);
  if (value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value;
}

function readPhone(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = readOptionalText(body, field, errors) ?? null;
  if (!value) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập số điện thoại' });
    }
    return null;
  }
  if (!PHONE_PATTERN.test(value)) {
    errors.push({ field, message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
  }
  return value;
}

// Người được ủy quyền đón trẻ, đón trả, xác nhận tại cổng và phụ huynh xác nhận người đón (P02-04, P04-03, YCTD-48).
// Quyền kiểm tra ở tầng nghiệp vụ theo quan hệ phụ huynh, phân công lớp và đơn vị
@Controller()
export class PickupsController {
  constructor(private readonly pickupsService: PickupsService) {}

  @Get('children/:id/authorized-pickups')
  listAuthorized(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.pickupsService.listAuthorized(currentUser, childId);
  }

  @Post('children/:id/authorized-pickups')
  @HttpCode(201)
  createAuthorized(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const fullName = readLimitedText(body, 'full_name', errors, 200);
    const relationship = readLimitedText(body, 'relationship', errors, 50);
    const phone = readPhone(body, 'phone', errors, true) ?? '';
    const validFrom = readOptionalDate(body?.valid_from, 'valid_from', errors);
    const validTo = readOptionalDate(body?.valid_to, 'valid_to', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.pickupsService.createAuthorized(
      currentUser,
      childId,
      { fullName, relationship, phone, validFrom, validTo },
      originOf(request, currentUser),
    );
  }

  @Delete('authorized-pickups/:id')
  revokeAuthorized(
    @Param('id', uuidParameter('Mã ủy quyền không hợp lệ')) authorizedPickupId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.pickupsService.revokeAuthorized(currentUser, authorizedPickupId, originOf(request, currentUser));
  }

  @Get('classes/:id/pickups')
  classPickups(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('date') date: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const parsed = readOptionalDate(date, 'date', errors);
    if (errors.length > 0 || !parsed) {
      throw validationError(errors.length ? errors : [{ field: 'date', message: 'Ngày dạng YYYY-MM-DD' }]);
    }
    return this.pickupsService.classPickups(currentUser, classId, parsed);
  }

  @Get('pickup-directory')
  directory(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    const search = (query.search ?? '').trim();
    if (search.length < 2) {
      errors.push({ field: 'search', message: 'Nhập ít nhất 2 ký tự của tên trẻ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.pickupsService.directory(currentUser, query.org_unit_id ?? '', search);
  }

  @Post('children/:id/pickups')
  @HttpCode(201)
  record(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const pickupType = (body?.pickup_type ?? 'handover') as PickupType;
    if (!PICKUP_TYPES.includes(pickupType)) {
      errors.push({ field: 'pickup_type', message: 'Loại là handover hoặc gate_check' });
    }
    const date = readOptionalDate(body?.date, 'date', errors);
    const guardianId = readOptionalUuid(body, 'guardian_id', errors);
    const authorizedPickupId = readOptionalUuid(body, 'authorized_pickup_id', errors);
    let person: PickupPerson | null = null;
    if (guardianId) {
      person = { guardianId };
    } else if (authorizedPickupId) {
      person = { authorizedPickupId };
    } else if (body?.person && typeof body.person === 'object') {
      const raw = body.person as RequestBody;
      const localErrors: FieldError[] = [];
      const fullName = readLimitedText(raw, 'full_name', localErrors, 200);
      const relationship = readLimitedText(raw, 'relationship', localErrors, 50);
      const phone = readPhone(raw, 'phone', localErrors, false);
      errors.push(...localErrors.map((error) => ({ ...error, field: `person.${error.field}` })));
      person = { fullName, relationship, phone };
    } else {
      errors.push({ field: 'person', message: 'Chọn người đón hoặc nhập thông tin người đón' });
    }
    const photoFileId = readOptionalUuid(body, 'photo_file_id', errors) ?? null;
    let pickedUpAt: Date | null = null;
    if (body?.picked_up_at !== undefined && body.picked_up_at !== null) {
      pickedUpAt = typeof body.picked_up_at === 'string' ? new Date(body.picked_up_at) : new Date(Number.NaN);
      if (Number.isNaN(pickedUpAt.getTime())) {
        errors.push({ field: 'picked_up_at', message: 'Thời điểm không hợp lệ' });
      }
    }
    if (errors.length > 0 || !person) {
      throw validationError(errors);
    }
    return this.pickupsService.record(
      currentUser,
      childId,
      { pickupType, date, person, photoFileId, pickedUpAt },
      originOf(request, currentUser),
    );
  }

  @Get('pickup-confirmations')
  myConfirmationRequests(@Query('status') status: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.pickupsService.myConfirmationRequests(currentUser, status === 'all' ? 'all' : 'pending');
  }

  @Post('pickup-confirmations/:id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.pickupsService.respond(currentUser, requestId, 'confirmed', originOf(request, currentUser));
  }

  @Post('pickup-confirmations/:id/refuse')
  @HttpCode(200)
  refuse(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.pickupsService.respond(currentUser, requestId, 'refused', originOf(request, currentUser));
  }
}

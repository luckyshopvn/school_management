import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { DayHalf, LeaveRequestStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { LeaveService, type LeavePolicyInput } from './leave.service.js';
import { TimesheetsService } from './timesheets.service.js';

// Quy định phép năm, số ngày phép, đơn nghỉ phép, chốt và mở lại bảng công (P08-03, P08-04, P08-11; YCTD-59).
// Quyền kiểm tra ở tầng nghiệp vụ theo đơn vị và hồ sơ liên kết tài khoản
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_TEXT = 500;
const DAY_HALVES: readonly DayHalf[] = ['morning', 'afternoon'];
const REQUEST_STATUSES: readonly LeaveRequestStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

function readDate(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = body?.[field];
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function readText(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = readRequiredText(body, field, errors);
  if (value.length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
  }
  return value;
}

function readNumber(body: RequestBody, field: string, errors: FieldError[], range: { min: number; max: number }) {
  const value = body?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
    errors.push({ field, message: `Số từ ${range.min} đến ${range.max}` });
    return 0;
  }
  return value;
}

function readHalfDays(value: number, field: string, errors: FieldError[]): number {
  if (!Number.isInteger(value * 2)) {
    errors.push({ field, message: 'Số ngày theo đơn vị nửa ngày' });
  }
  return value;
}

function readPolicy(body: RequestBody, errors: FieldError[]): LeavePolicyInput {
  const from = readNumber(body, 'seniority_from_years', errors, { min: 0, max: 60 });
  const to =
    body?.seniority_to_years === null || body?.seniority_to_years === undefined
      ? null
      : readNumber(body, 'seniority_to_years', errors, { min: 1, max: 60 });
  if (!Number.isInteger(from) || (to !== null && !Number.isInteger(to))) {
    errors.push({ field: 'seniority_from_years', message: 'Thâm niên tính bằng năm tròn' });
  }
  if (to !== null && to <= from) {
    errors.push({ field: 'seniority_to_years', message: 'Thâm niên đến phải lớn hơn thâm niên từ' });
  }
  return {
    jobTitleId: readRequiredUuid(body, 'job_title_id', errors, 'Bắt buộc chọn chức danh'),
    seniorityFromYears: from,
    seniorityToYears: to,
    entitledDays: readHalfDays(readNumber(body, 'entitled_days', errors, { min: 0, max: 60 }), 'entitled_days', errors),
  };
}

// Trống hoặc null là nghỉ cả ngày
function readHalf(body: RequestBody, field: string, errors: FieldError[]): DayHalf | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return readEnum(body, field, DAY_HALVES, errors, true) ?? null;
}

function readMonth(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
  }
  return value;
}

function readUnit(value: unknown): string {
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
  }
  return value;
}

@Controller()
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly timesheets: TimesheetsService,
  ) {}

  @Get('leave-policies')
  policies() {
    return this.leave.listPolicies();
  }

  @Post('leave-policies')
  createPolicy(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readPolicy(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.leave.createPolicy(currentUser, input, originOf(request, currentUser));
  }

  @Put('leave-policies/:id')
  updatePolicy(
    @Param('id', uuidParameter('Mã quy định không hợp lệ')) policyId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readPolicy(body, errors);
    const status = readEnum(body, 'status', ['active', 'inactive'] as const, errors, true);
    if (errors.length > 0 || !status) {
      throw validationError(errors);
    }
    return this.leave.updatePolicy(currentUser, policyId, { ...input, status }, originOf(request, currentUser));
  }

  @Get('leave-balances')
  balances(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const year = Number(query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw validationError([{ field: 'year', message: 'Năm không hợp lệ' }]);
    }
    return this.leave.listBalances(currentUser, readUnit(query.org_unit_id), year);
  }

  @Put('leave-balances')
  adjustBalance(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      staffId: readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự'),
      year: readNumber(body, 'year', errors, { min: 2000, max: 2100 }),
      entitledDays: readHalfDays(
        readNumber(body, 'entitled_days', errors, { min: 0, max: 60 }),
        'entitled_days',
        errors,
      ),
      reason: readText(body, 'reason', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.leave.adjustBalance(currentUser, input, originOf(request, currentUser));
  }

  @Get('me/leave-requests')
  mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.leave.mine(currentUser);
  }

  @Get('leave-requests')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const status = readEnum(query, 'status', REQUEST_STATUSES, errors, false) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.leave.list(currentUser, { orgUnitId: readUnit(query.org_unit_id), status });
  }

  @Post('leave-requests')
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const fromDate = readDate(body, 'from_date', errors);
    const toDate = readDate(body, 'to_date', errors);
    const firstDayHalf = readHalf(body, 'first_day_half', errors);
    const lastDayHalf = readHalf(body, 'last_day_half', errors);
    if (fromDate && toDate && toDate < fromDate) {
      errors.push({ field: 'to_date', message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' });
    }
    // Một ngày thì chọn buổi bất kỳ; nhiều ngày thì ngày đầu chỉ nghỉ buổi chiều, ngày cuối chỉ nghỉ buổi sáng
    if (fromDate && fromDate === toDate && lastDayHalf) {
      errors.push({ field: 'last_day_half', message: 'Nghỉ một ngày thì chỉ chọn buổi ở ngày bắt đầu' });
    }
    if (fromDate && toDate && fromDate < toDate) {
      if (firstDayHalf === 'morning') {
        errors.push({ field: 'first_day_half', message: 'Ngày đầu chỉ nghỉ được buổi chiều' });
      }
      if (lastDayHalf === 'afternoon') {
        errors.push({ field: 'last_day_half', message: 'Ngày cuối chỉ nghỉ được buổi sáng' });
      }
    }
    const input = {
      staffId: readOptionalUuid(body, 'staff_id', errors) ?? null,
      leaveTypeId: readRequiredUuid(body, 'leave_type_id', errors, 'Bắt buộc chọn loại nghỉ'),
      fromDate,
      toDate,
      firstDayHalf,
      lastDayHalf,
      reason: readText(body, 'reason', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.leave.create(currentUser, input, originOf(request, currentUser));
  }

  @Post('leave-requests/:id/approve')
  approve(
    @Param('id', uuidParameter('Mã đơn nghỉ không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.leave.approve(currentUser, requestId, originOf(request, currentUser));
  }

  @Post('leave-requests/:id/reject')
  reject(
    @Param('id', uuidParameter('Mã đơn nghỉ không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.leave.reject(currentUser, requestId, reason, originOf(request, currentUser));
  }

  @Post('leave-requests/:id/cancel')
  cancel(
    @Param('id', uuidParameter('Mã đơn nghỉ không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.leave.cancel(currentUser, requestId, originOf(request, currentUser));
  }

  @Get('timesheet-periods')
  period(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.timesheets.period(currentUser, readUnit(query.org_unit_id), readMonth(query.month));
  }

  @Post('attendance-logs/lock')
  close(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.timesheets.close(
      currentUser,
      readUnit(body?.org_unit_id),
      readMonth(body?.month),
      originOf(request, currentUser),
    );
  }

  @Get('attendance-logs/reopen-requests')
  reopenRequests(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.timesheets.pendingReopenRequests(currentUser);
  }

  @Post('attendance-logs/reopen-requests')
  requestReopen(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.timesheets.requestReopen(
      currentUser,
      readUnit(body?.org_unit_id),
      readMonth(body?.month),
      reason,
      originOf(request, currentUser),
    );
  }

  @Post('attendance-logs/reopen-requests/:id/approve')
  approveReopen(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.timesheets.decideReopen(
      currentUser,
      requestId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('attendance-logs/reopen-requests/:id/reject')
  rejectReopen(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.timesheets.decideReopen(
      currentUser,
      requestId,
      { approve: false, reason },
      originOf(request, currentUser),
    );
  }
}

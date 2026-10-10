import { Body, Controller, Get, Post, Put, Query, Req } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { StaffAttendanceService } from './staff-attendance.service.js';

// Chấm công của nhân sự (P08-01, YCTD-59). Quyền kiểm tra ở tầng nghiệp vụ theo đơn vị và hồ sơ liên kết tài khoản
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAXIMUM_NOTE = 500;

function readTime(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if ((value === undefined || value === null || value === '') && !required) {
    return null;
  }
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    errors.push({ field, message: 'Giờ dạng HH:MM, ví dụ 07:30' });
    return null;
  }
  return value;
}

@Controller()
export class StaffAttendanceController {
  constructor(private readonly attendance: StaffAttendanceService) {}

  @Get('me/attendance-logs')
  mine(@Query('month') month: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.attendance.mine(currentUser, month ?? '');
  }

  @Post('me/attendance-logs/check-in')
  checkIn(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.attendance.checkIn(currentUser, originOf(request, currentUser));
  }

  @Post('me/attendance-logs/check-out')
  checkOut(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.attendance.checkOut(currentUser, originOf(request, currentUser));
  }

  @Get('attendance-logs')
  sheet(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.attendance.sheet(currentUser, query.org_unit_id, query.month ?? '');
  }

  @Put('attendance-logs')
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffId = readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự');
    const workDate = body?.work_date;
    if (typeof workDate !== 'string' || !DATE_PATTERN.test(workDate) || Number.isNaN(Date.parse(workDate))) {
      errors.push({ field: 'work_date', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    const checkIn = readTime(body, 'check_in', errors, true);
    const checkOut = readTime(body, 'check_out', errors, false);
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null;
    if (note && note.length > MAXIMUM_NOTE) {
      errors.push({ field: 'note', message: `Tối đa ${MAXIMUM_NOTE} ký tự` });
    }
    if (errors.length > 0 || checkIn === null) {
      throw validationError(errors);
    }
    return this.attendance.save(
      currentUser,
      { staffId, workDate: workDate as string, checkIn, checkOut, note },
      originOf(request, currentUser),
    );
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { AttendanceStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalText,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ATTENDANCE_STATUSES, AttendanceService, type AttendanceEntry } from './attendance.service.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

// Điểm danh, chốt ngày, báo vắng (P04-01, 02, 06; QT-02; YCTD-47). Quyền kiểm tra ở tầng nghiệp vụ theo phân công lớp
@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('classes/:id/attendance')
  sheet(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('date') date: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const parsed = readDate(date, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.sheet(currentUser, classId, parsed);
  }

  @Put('classes/:id/attendance')
  save(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    const rawEntries = Array.isArray(body?.entries) ? (body.entries as unknown[]) : [];
    if (rawEntries.length === 0) {
      errors.push({ field: 'entries', message: 'Cần ít nhất một trẻ' });
    }
    const entries: AttendanceEntry[] = rawEntries.map((value, index) => {
      const entry = (value ?? {}) as Record<string, unknown>;
      if (!isUuid(entry.child_id)) {
        errors.push({ field: `entries.${index}.child_id`, message: 'Mã trẻ không hợp lệ' });
      }
      if (!ATTENDANCE_STATUSES.includes(entry.status as AttendanceStatus)) {
        errors.push({ field: `entries.${index}.status`, message: 'Trạng thái điểm danh không hợp lệ' });
      }
      const note = readOptionalText(entry, 'note', errors) ?? null;
      if (note && note.length > 500) {
        errors.push({ field: `entries.${index}.note`, message: 'Tối đa 500 ký tự' });
      }
      return { child_id: entry.child_id as string, status: entry.status as AttendanceStatus, note };
    });
    const offline = body?.offline_recorded_at;
    let offlineRecordedAt: Date | null = null;
    if (offline !== undefined && offline !== null) {
      offlineRecordedAt = typeof offline === 'string' ? new Date(offline) : new Date(Number.NaN);
      if (Number.isNaN(offlineRecordedAt.getTime())) {
        errors.push({ field: 'offline_recorded_at', message: 'Thời điểm không hợp lệ' });
      }
    }
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.save(
      currentUser,
      classId,
      { date, entries, reason, offlineRecordedAt },
      originOf(request, currentUser),
    );
  }

  @Post('classes/:id/attendance/lock')
  @HttpCode(200)
  lock(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.lock(currentUser, classId, date, originOf(request, currentUser));
  }

  @Post('classes/:id/attendance/unlock')
  @HttpCode(200)
  unlock(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const date = readDate(body?.date, 'date', errors);
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.unlock(currentUser, classId, date, reason, originOf(request, currentUser));
  }

  @Post('absences')
  @HttpCode(201)
  reportAbsence(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ');
    const fromDate = readDate(body?.from_date, 'from_date', errors);
    const toDate =
      body?.to_date === undefined || body.to_date === null ? fromDate : readDate(body.to_date, 'to_date', errors);
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (reason && reason.length > 500) {
      errors.push({ field: 'reason', message: 'Tối đa 500 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.reportAbsence(
      currentUser,
      { childId, fromDate, toDate, reason },
      originOf(request, currentUser),
    );
  }

  @Get('absences')
  absences(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.child_id)) {
      errors.push({ field: 'child_id', message: 'Bắt buộc chọn trẻ' });
    }
    const fromDate = readDate(query.from_date, 'from_date', errors);
    const toDate = readDate(query.to_date ?? query.from_date, 'to_date', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.attendanceService.absences(currentUser, query.child_id ?? '', fromDate, toDate);
  }

  @Get('children/:id/attendance')
  childAttendance(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query('month') month: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      throw validationError([{ field: 'month', message: 'Tháng dạng YYYY-MM' }]);
    }
    return this.attendanceService.childAttendance(currentUser, childId, month);
  }
}

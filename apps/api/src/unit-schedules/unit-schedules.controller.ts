import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { RoomBookingStatus } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { sendWorkbook } from '../facilities/facilities-workbook.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { readWorkDate, readWorkText } from '../work/work-access.js';
import { UnitSchedulesService, type ScheduleFilter } from './unit-schedules.js';

// Điểm cuối lịch đơn vị, phòng họp, mẫu lịch (DT-18 phần 18c, YCTD-141). Bộ bảo vệ chặn người không có quyền nào của nhóm
// lịch; phạm vi đơn vị của người đăng ký lịch kiểm tra ở dịch vụ
const VIEW = PERMISSION_CODES.scheduleView;
const MANAGE = PERMISSION_CODES.scheduleManage;
const ROOMS = PERMISSION_CODES.meetingRoomManage;
const ANY = [VIEW, MANAGE, ROOMS];
const ID_MESSAGE = 'Mã không hợp lệ';
const BOOKING_STATUSES: RoomBookingStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

function throwIfAny(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readUnit(query: Record<string, unknown>, errors: FieldError[]): string | null {
  const value = query.org_unit_id;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field: 'org_unit_id', message: ID_MESSAGE });
    return null;
  }
  return value;
}

function readFilter(query: Record<string, string | undefined>): ScheduleFilter {
  const errors: FieldError[] = [];
  const from = readWorkDate(query, 'from', errors, true);
  const to = readWorkDate(query, 'to', errors, true);
  if (from && to && to < from) {
    errors.push({ field: 'to', message: 'Đến ngày không trước từ ngày' });
  }
  const filter: ScheduleFilter = {
    from: from ?? '',
    to: to ?? '',
    orgUnitId: readUnit(query, errors),
    mine: query.view === 'mine',
    location: query.location?.trim().slice(0, 200) || null,
    participant: query.participant?.trim().slice(0, 200) || null,
  };
  throwIfAny(errors);
  return filter;
}

@Controller()
export class UnitSchedulesController {
  constructor(private readonly schedules: UnitSchedulesService) {}

  // ---- Phòng họp ----

  @Get('meeting-rooms')
  @RequirePermission(...ANY)
  listRooms(@Query('active') active: string | undefined) {
    return this.schedules.listRooms(active === 'true');
  }

  @Post('meeting-rooms')
  @RequirePermission(ROOMS)
  createRoom(@Body() body: RequestBody) {
    return this.schedules.saveRoom(null, body);
  }

  @Put('meeting-rooms/:id')
  @RequirePermission(ROOMS)
  updateRoom(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @Body() body: RequestBody) {
    return this.schedules.saveRoom(id, body);
  }

  @Delete('meeting-rooms/:id')
  @HttpCode(204)
  @RequirePermission(ROOMS)
  async deleteRoom(@Param('id', uuidParameter(ID_MESSAGE)) id: string) {
    await this.schedules.deleteRoom(id);
  }

  // ---- Đăng ký phòng họp ----

  @Get('room-bookings')
  @RequirePermission(...ANY)
  listBookings(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      from: readWorkDate(query, 'from', errors),
      to: readWorkDate(query, 'to', errors),
      roomId: query.room_id && isUuid(query.room_id) ? query.room_id : null,
      status: readEnum(query, 'status', BOOKING_STATUSES, errors, false) ?? null,
      mine: query.mine === 'true',
    };
    if (query.room_id && !isUuid(query.room_id)) {
      errors.push({ field: 'room_id', message: ID_MESSAGE });
    }
    throwIfAny(errors);
    return this.schedules.listBookings(currentUser, filter);
  }

  @Post('room-bookings')
  @RequirePermission(...ANY)
  createBooking(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.createBooking(currentUser, body);
  }

  @Post('room-bookings/:id/approve')
  @HttpCode(200)
  @RequirePermission(ROOMS)
  approve(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    throwIfAny(errors);
    return this.schedules.decideBooking(currentUser, id, true, note);
  }

  @Post('room-bookings/:id/reject')
  @HttpCode(200)
  @RequirePermission(ROOMS)
  reject(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    throwIfAny(errors);
    return this.schedules.decideBooking(currentUser, id, false, note);
  }

  @Post('room-bookings/:id/cancel')
  @HttpCode(200)
  @RequirePermission(...ANY)
  cancel(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.cancelBooking(currentUser, id);
  }

  // ---- Lịch đơn vị, lịch họp ----

  @Get('unit-schedules')
  @RequirePermission(...ANY)
  listEntries(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.listEntries(currentUser, readFilter(query));
  }

  @Get('unit-schedules/export')
  @RequirePermission(...ANY)
  async exportEntries(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(query.format ?? 'xlsx');
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(
      response,
      await this.schedules.exportEntries(currentUser, readFilter(query), format, request.ip ?? null),
    );
  }

  @Post('unit-schedules')
  @RequirePermission(MANAGE)
  createEntry(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.saveEntry(currentUser, null, body);
  }

  @Post('unit-schedules/publish')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  publish(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const from = readWorkDate(body, 'from', errors, true);
    const to = readWorkDate(body, 'to', errors, true);
    const orgUnitId = readUnit(body ?? {}, errors);
    throwIfAny(errors);
    return this.schedules.publish(currentUser, { from: from as string, to: to as string, orgUnitId });
  }

  @Put('unit-schedules/:id')
  @RequirePermission(MANAGE)
  updateEntry(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.schedules.saveEntry(currentUser, id, body);
  }

  @Delete('unit-schedules/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteEntry(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.schedules.deleteEntry(currentUser, id);
  }

  // ---- Mẫu lịch ----

  @Get('unit-schedule-templates')
  @RequirePermission(MANAGE)
  listTemplates() {
    return this.schedules.listTemplates();
  }

  @Post('unit-schedule-templates')
  @RequirePermission(MANAGE)
  createTemplate(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schedules.saveTemplate(currentUser, null, body);
  }

  @Put('unit-schedule-templates/:id')
  @RequirePermission(MANAGE)
  updateTemplate(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.schedules.saveTemplate(currentUser, id, body);
  }

  @Delete('unit-schedule-templates/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async deleteTemplate(@Param('id', uuidParameter(ID_MESSAGE)) id: string) {
    await this.schedules.deleteTemplate(id);
  }

  @Post('unit-schedule-templates/:id/apply')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  applyTemplate(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const weekOf = readWorkDate(body, 'week_of', errors, true);
    const orgUnitId = readUnit(body ?? {}, errors);
    throwIfAny(errors);
    return this.schedules.applyTemplate(currentUser, id, { weekOf: weekOf as string, orgUnitId });
  }
}

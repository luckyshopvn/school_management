import { Body, Controller, Get, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AttendanceDeviceKind } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser, PublicEndpoint } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readOptionalText, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  AttendanceDevicesService,
  MAXIMUM_EVENTS_PER_REQUEST,
  type DeviceEvent,
} from './attendance-devices.service.js';

// Thiết bị điểm danh, lát L2 (YCTD-389). Quyền kiểm tra ở tầng nghiệp vụ
const KINDS: AttendanceDeviceKind[] = ['qr_scanner', 'rfid_reader', 'face_terminal', 'camera_station'];
const MAXIMUM_PUNCH_FILE_BYTES = 5 * 1024 * 1024;

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('attendance-devices')
export class AttendanceDevicesController {
  constructor(private readonly devices: AttendanceDevicesService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.devices.list(currentUser);
  }

  @Post()
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const locationName = readOptionalText(body, 'location_name', errors) ?? null;
    if (!isUuid(body?.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Chọn đơn vị' });
    }
    if (!KINDS.includes(body?.kind as AttendanceDeviceKind)) {
      errors.push({ field: 'kind', message: 'Loại thiết bị không hợp lệ' });
    }
    const direction = body?.direction;
    if (direction !== 'in' && direction !== 'out' && direction !== 'both') {
      errors.push({ field: 'direction', message: 'Hướng là vào, ra hoặc cả hai' });
    }
    if (name.length > 120) {
      errors.push({ field: 'name', message: 'Tối đa 120 ký tự' });
    }
    if (locationName && locationName.length > 200) {
      errors.push({ field: 'location_name', message: 'Tối đa 200 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.devices.create(
      currentUser,
      {
        orgUnitId: body?.org_unit_id as string,
        kind: body?.kind as AttendanceDeviceKind,
        name,
        locationName,
        direction: direction as 'in' | 'out' | 'both',
      },
      originOf(request, currentUser),
    );
  }

  @Post(':id/rotate-key')
  @HttpCode(200)
  rotateKey(
    @Param('id', uuidParameter('Mã thiết bị không hợp lệ')) deviceId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.devices.rotateKey(currentUser, deviceId, originOf(request, currentUser));
  }

  @Post(':id/disable')
  @HttpCode(200)
  disable(
    @Param('id', uuidParameter('Mã thiết bị không hợp lệ')) deviceId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.devices.setDisabled(currentUser, deviceId, body?.disabled !== false, originOf(request, currentUser));
  }

  @Post(':id/import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_PUNCH_FILE_BYTES, files: 1 } }))
  importFile(
    @Param('id', uuidParameter('Mã thiết bị không hợp lệ')) deviceId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.devices.importFile(
      currentUser,
      deviceId,
      file.originalname,
      file.buffer,
      originOf(request, currentUser),
    );
  }
}

// Điểm nhận công khai của thiết bị (BM-232): không dùng mã phiên, xác thực bằng khóa thiết bị ở tiêu đề `x-device-key`; nhận theo tên
// miền của trường. Thân: { events: [{ external_id, code, direction?, occurred_at }] }, tối đa 500 lượt mỗi lần
@Controller('device-events')
@PublicEndpoint()
export class DeviceEventsController {
  constructor(private readonly devices: AttendanceDevicesService) {}

  @Post()
  @HttpCode(200)
  receive(@Body() body: RequestBody, @Req() request: Request) {
    const raw = Array.isArray(body?.events) ? (body.events as unknown[]) : null;
    if (!raw || raw.length === 0 || raw.length > MAXIMUM_EVENTS_PER_REQUEST) {
      throw validationError([{ field: 'events', message: `Gửi từ 1 đến ${MAXIMUM_EVENTS_PER_REQUEST} lượt` }]);
    }
    const errors: FieldError[] = [];
    const events: DeviceEvent[] = raw.map((value, index) => {
      const event = (value ?? {}) as Record<string, unknown>;
      const externalId = typeof event.external_id === 'string' ? event.external_id.trim() : '';
      const code = typeof event.code === 'string' ? event.code.trim() : '';
      const occurredAt = typeof event.occurred_at === 'string' ? new Date(event.occurred_at) : new Date(Number.NaN);
      const direction = event.direction ?? null;
      if (!externalId || externalId.length > 100) {
        errors.push({ field: `events.${index}.external_id`, message: 'Mã sự kiện từ 1 đến 100 ký tự' });
      }
      if (!code || code.length > 64) {
        errors.push({ field: `events.${index}.code`, message: 'Mã người từ 1 đến 64 ký tự' });
      }
      if (Number.isNaN(occurredAt.getTime())) {
        errors.push({ field: `events.${index}.occurred_at`, message: 'Thời điểm dạng ISO 8601 có múi giờ' });
      }
      if (direction !== null && direction !== 'in' && direction !== 'out') {
        errors.push({ field: `events.${index}.direction`, message: 'Hướng là in hoặc out' });
      }
      return { externalId, code, direction: direction as 'in' | 'out' | null, occurredAt };
    });
    if (errors.length > 0) {
      throw validationError(errors.slice(0, 20));
    }
    const key = request.headers['x-device-key'];
    return this.devices.receive(typeof key === 'string' ? key : undefined, events, request.ip ?? null);
  }
}

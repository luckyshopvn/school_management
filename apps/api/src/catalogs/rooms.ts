import { Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { CatalogStatus } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readRequiredInteger,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readRoomFacility, type RoomFacilityChanges } from '../facilities/facility-rules.js';
import { CatalogAccess } from './catalog-access.js';

// Phòng học theo đơn vị (P01-11); gán phòng cho lớp làm khi có lớp học. Khai báo cơ sở vật chất (YCTD-102) thêm khối
// phòng, loại phòng, hiện trạng, diện tích và thuộc tính theo quy chuẩn
export interface Room {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  capacity: number;
  status: CatalogStatus;
  room_block: string | null;
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  facility_attributes: Record<string, unknown>;
}

interface RoomChanges extends RoomFacilityChanges {
  code?: string;
  name?: string;
  capacity?: number;
  status?: CatalogStatus;
}

const COLUMNS = [
  'id',
  'org_unit_id',
  'code',
  'name',
  'capacity',
  'status',
  'room_block',
  'room_type',
  'condition',
  'area_m2',
  'facility_attributes',
] as const;

function formatRoom<T extends { area_m2: string | null }>(row: T): Omit<T, 'area_m2'> & { area_m2: number | null } {
  return { ...row, area_m2: row.area_m2 === null ? null : Number(row.area_m2) };
}

function storedChanges<T extends RoomFacilityChanges>(
  changes: T,
): Omit<T, 'facility_attributes'> & { facility_attributes?: string } {
  const { facility_attributes: attributes, ...rest } = changes;
  return attributes === undefined ? rest : { ...rest, facility_attributes: JSON.stringify(attributes) };
}
const PERMISSION = PERMISSION_CODES.roomManage;
const DUPLICATE_MESSAGE = 'Mã phòng đã có trong đơn vị';
const CAPACITY_RANGE = { min: 1, max: 1000 };

@Injectable()
export class RoomsService {
  constructor(
    private readonly catalogAccess: CatalogAccess,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string): Promise<Room[]> {
    const database = await this.catalogAccess.readableDatabase(currentUser, orgUnitId);
    if (!database) {
      return [];
    }
    return (
      await database.selectFrom('rooms').select(COLUMNS).where('org_unit_id', '=', orgUnitId).orderBy('code').execute()
    ).map(formatRoom);
  }

  async create(
    currentUser: CurrentUser,
    input: { org_unit_id: string; code: string; name: string; capacity: number } & RoomFacilityChanges,
    origin: ChangeOrigin,
  ): Promise<Room> {
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, input.org_unit_id);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('rooms')
          .values({ ...storedChanges(input), created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: created.org_unit_id,
          entityName: 'rooms',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return formatRoom(created);
      }),
      DUPLICATE_MESSAGE,
      'code',
    );
  }

  async update(
    currentUser: CurrentUser,
    roomId: string,
    body: RequestBody,
    changes: RoomChanges,
    origin: ChangeOrigin,
  ): Promise<Room> {
    const { database: current } = await this.currentSchoolYear.require();
    const existing = await current.selectFrom('rooms').select(COLUMNS).where('id', '=', roomId).executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy phòng học', 'room');
    }
    // Loại phòng kiểm tra theo khối phòng, loại phòng đang lưu khi lần sửa chỉ đổi một trong hai
    const errors: FieldError[] = [];
    Object.assign(changes, readRoomFacility(body, errors, existing));
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const database = await this.catalogAccess.writableDatabase(currentUser, PERMISSION, existing.org_unit_id);
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const updated = await transaction
          .updateTable('rooms')
          .set({ ...storedChanges(changes), updated_at: this.clock.now() })
          .where('id', '=', roomId)
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'rooms',
          entityId: roomId,
          action: 'update',
          before: existing,
          after: updated,
        });
        return formatRoom(updated);
      }),
      DUPLICATE_MESSAGE,
      'code',
    );
  }
}

// Ai có vai trò ở đơn vị đều xem được; VT-02 và VT-03 tạo, sửa trong phạm vi đơn vị (YCTD-42)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  list(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.roomsService.list(currentUser, orgUnitId);
  }

  @Post()
  @RequirePermission(PERMISSION)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      capacity: readRequiredInteger(body, 'capacity', errors, CAPACITY_RANGE),
      ...readRoomFacility(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.roomsService.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION)
  update(
    @Param('id', uuidParameter('Mã phòng học không hợp lệ')) roomId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: RoomChanges = {
      code: body?.code === undefined ? undefined : readRequiredText(body, 'code', errors),
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      capacity: readInteger(body, 'capacity', errors, CAPACITY_RANGE),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.roomsService.update(currentUser, roomId, body, changes, originOf(request, currentUser));
  }
}

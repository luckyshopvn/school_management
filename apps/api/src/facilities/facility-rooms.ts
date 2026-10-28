import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req, Res } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  PERMISSION_CODES,
  ROOM_ATTRIBUTES,
  ROOM_BLOCKS,
  ROOM_CONDITIONS,
  ROOM_TYPES,
  type CodeLabel,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from './facilities-workbook.js';

// Khai báo cơ sở vật chất (khảo sát mục 4, dòng 1.1 và 1.2; YCTD-102): danh sách phòng của các đơn vị trong phạm vi theo
// năm khối phòng, lọc loại phòng và hiện trạng, kèm tổng hợp số phòng, diện tích theo khối và hiện trạng; xuất Excel. Thêm,
// sửa phòng vẫn qua danh mục phòng học (/rooms, quyền P01.room.manage). Người quản lý thiết bị cũng xem được vì menu 1.1 hiện
// cho P13.equipment.manage và MH-80 cho VT-11 xem (YCTD-340)
const VIEW = [PERMISSION_CODES.facilitiesReport, PERMISSION_CODES.roomManage, PERMISSION_CODES.equipmentManage];

export interface FacilityRoomFilter {
  orgUnitId: string | null;
  roomBlock: string | null;
  roomType: string | null;
  condition: string | null;
  status: 'active' | 'inactive' | null;
}

export interface FacilityRoom {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  capacity: number;
  status: string;
  room_block: string | null;
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  facility_attributes: Record<string, unknown>;
  built_this_year: boolean;
  class_names: string[];
}

export interface RoomSummaryRow {
  room_block: string;
  label: string;
  total: number;
  permanent: number;
  semi_permanent: number;
  temporary: number;
  borrowed: number;
  unspecified: number;
  area_m2: number;
}

const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

// Tổng hợp số phòng đang dùng theo khối và hiện trạng (báo cáo cơ sở vật chất, dòng 1.2); phòng chưa chọn khối vào dòng
// "Chưa phân khối"
export function summarizeRooms(rooms: Array<Pick<FacilityRoom, 'room_block' | 'condition' | 'area_m2' | 'status'>>) {
  const blocks: Array<{ value: string; label: string }> = ROOM_BLOCKS.map((block) => ({
    value: block.value,
    label: block.label,
  }));
  blocks.push({ value: 'unassigned', label: 'Chưa phân khối' });
  const rows: RoomSummaryRow[] = blocks.map((block) => ({
    room_block: block.value,
    label: block.label,
    total: 0,
    permanent: 0,
    semi_permanent: 0,
    temporary: 0,
    borrowed: 0,
    unspecified: 0,
    area_m2: 0,
  }));
  for (const room of rooms.filter((row) => row.status === 'active')) {
    const row = rows.find((item) => item.room_block === (room.room_block ?? 'unassigned')) ?? rows[rows.length - 1]!;
    row.total += 1;
    const condition = room.condition as keyof RoomSummaryRow | null;
    if (condition && ['permanent', 'semi_permanent', 'temporary', 'borrowed'].includes(condition)) {
      (row[condition] as number) += 1;
    } else {
      row.unspecified += 1;
    }
    row.area_m2 = Math.round((row.area_m2 + (room.area_m2 ?? 0)) * 100) / 100;
  }
  const total: RoomSummaryRow = {
    room_block: 'total',
    label: 'Tổng số',
    total: 0,
    permanent: 0,
    semi_permanent: 0,
    temporary: 0,
    borrowed: 0,
    unspecified: 0,
    area_m2: 0,
  };
  for (const row of rows) {
    for (const key of ['total', 'permanent', 'semi_permanent', 'temporary', 'borrowed', 'unspecified'] as const) {
      total[key] += row[key];
    }
    total.area_m2 = Math.round((total.area_m2 + row.area_m2) * 100) / 100;
  }
  return [...rows.filter((row) => row.room_block !== 'unassigned' || row.total > 0), total];
}

function readCodeQuery(
  value: string | undefined,
  field: string,
  values: ReadonlyArray<CodeLabel>,
  errors: FieldError[],
): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!values.some((item) => item.value === value)) {
    errors.push({ field, message: `Giá trị là ${values.map((item) => item.value).join(', ')}` });
    return null;
  }
  return value;
}

export function readFacilityRoomFilter(query: Record<string, string | undefined>): FacilityRoomFilter {
  const errors: FieldError[] = [];
  const orgUnitId = query.org_unit_id || null;
  if (orgUnitId !== null && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const filter: FacilityRoomFilter = {
    orgUnitId,
    roomBlock: readCodeQuery(query.room_block, 'room_block', ROOM_BLOCKS, errors),
    roomType: readCodeQuery(query.room_type, 'room_type', ROOM_TYPES, errors),
    condition: readCodeQuery(query.condition, 'condition', ROOM_CONDITIONS, errors),
    status: readCodeQuery(
      query.status,
      'status',
      [
        { value: 'active', label: '' },
        { value: 'inactive', label: '' },
      ],
      errors,
    ) as FacilityRoomFilter['status'],
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return filter;
}

@Injectable()
export class FacilityRoomsService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, filter: FacilityRoomFilter) {
    const unitIds = await this.data.units(currentUser, VIEW, filter.orgUnitId);
    const database = await this.data.database();
    let query = database
      .selectFrom('rooms')
      .innerJoin('org_units', 'org_units.id', 'rooms.org_unit_id')
      .select([
        'rooms.id',
        'rooms.org_unit_id',
        'org_units.name as org_unit_name',
        'rooms.code',
        'rooms.name',
        'rooms.capacity',
        'rooms.status',
        'rooms.room_block',
        'rooms.room_type',
        'rooms.condition',
        'rooms.area_m2',
        'rooms.facility_attributes',
        'rooms.built_this_year',
      ])
      .where('rooms.org_unit_id', 'in', unitIds)
      .orderBy('org_units.name')
      .orderBy('rooms.code');
    if (filter.roomBlock) {
      query = query.where('rooms.room_block', '=', filter.roomBlock);
    }
    if (filter.roomType) {
      query = query.where('rooms.room_type', '=', filter.roomType);
    }
    if (filter.condition) {
      query = query.where('rooms.condition', '=', filter.condition);
    }
    if (filter.status) {
      query = query.where('rooms.status', '=', filter.status);
    }
    const rows = await query.execute();
    const classes = rows.length
      ? await database
          .selectFrom('classes')
          .select(['room_id', 'name'])
          .where('status', '=', 'active')
          .where(
            'room_id',
            'in',
            rows.map((row) => row.id),
          )
          .orderBy('name')
          .execute()
      : [];
    const rooms: FacilityRoom[] = rows.map((row) => ({
      ...row,
      area_m2: row.area_m2 === null ? null : Number(row.area_m2),
      class_names: classes.filter((item) => item.room_id === row.id).map((item) => item.name),
    }));
    return { org_unit_ids: unitIds, rooms, summary: summarizeRooms(rooms) };
  }

  async export(currentUser: CurrentUser, filter: FacilityRoomFilter, ipAddress: string | null) {
    const result = await this.list(currentUser, filter);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    const attributeValue = (value: unknown, kind: string, options?: ReadonlyArray<CodeLabel>) => {
      if (value === undefined || value === null) {
        return '';
      }
      if (kind === 'boolean') {
        return value ? 'Có' : 'Không';
      }
      if (kind === 'choice') {
        return labelOf(options ?? [], String(value));
      }
      return value;
    };
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'facility-rooms',
      fileName: `khai-bao-co-so-vat-chat-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: result.org_unit_ids,
      ipAddress,
      createdAt,
      sheets: [
        {
          title: 'Danh sách phòng',
          heading: ['1.1 Khai báo cơ sở vật chất'],
          columns: [
            { key: 'org_unit_name', label: 'Điểm trường', width: 24 },
            { key: 'code', label: 'Mã phòng', width: 12 },
            { key: 'name', label: 'Tên phòng', width: 28 },
            { key: 'room_block', label: 'Khối phòng', width: 36 },
            { key: 'room_type', label: 'Loại phòng', width: 24 },
            { key: 'condition', label: 'Hiện trạng', width: 16 },
            { key: 'area_m2', label: 'Diện tích (m²)' },
            { key: 'capacity', label: 'Sức chứa' },
            { key: 'class_names', label: 'Nhóm, lớp', width: 24 },
            { key: 'status', label: 'Trạng thái', width: 12 },
            ...ROOM_ATTRIBUTES.map((attribute) => ({ key: attribute.key, label: attribute.label })),
          ],
          rows: result.rooms.map((room) => ({
            ...room,
            room_block: labelOf(ROOM_BLOCKS, room.room_block),
            room_type: labelOf(ROOM_TYPES, room.room_type),
            condition: labelOf(ROOM_CONDITIONS, room.condition),
            area_m2: room.area_m2 ?? '',
            class_names: room.class_names.join(', '),
            status: room.status === 'active' ? 'Đang dùng' : 'Ngừng dùng',
            ...Object.fromEntries(
              ROOM_ATTRIBUTES.map((attribute) => [
                attribute.key,
                attributeValue(room.facility_attributes[attribute.key], attribute.kind, attribute.options),
              ]),
            ),
          })),
        },
        {
          title: 'Tổng hợp',
          heading: ['1.2 Báo cáo cơ sở vật chất (phòng đang dùng)'],
          columns: [
            { key: 'label', label: 'Chỉ tiêu', width: 44 },
            { key: 'total', label: 'Tổng số' },
            { key: 'permanent', label: 'Kiên cố' },
            { key: 'semi_permanent', label: 'Bán kiên cố' },
            { key: 'temporary', label: 'Tạm' },
            { key: 'borrowed', label: 'Nhờ, mượn, thuê' },
            { key: 'unspecified', label: 'Chưa khai báo hiện trạng' },
            { key: 'area_m2', label: 'Diện tích (m²)' },
          ],
          rows: result.summary as unknown as Array<Record<string, unknown>>,
        },
      ],
    });
  }
}

@Controller('facilities/rooms')
export class FacilityRoomsController {
  constructor(private readonly rooms: FacilityRoomsService) {}

  @Get()
  @RequirePermission(...VIEW)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.rooms.list(currentUser, readFacilityRoomFilter(query));
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async export(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const query = Object.fromEntries(
      Object.entries(body ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    sendWorkbook(response, await this.rooms.export(currentUser, readFacilityRoomFilter(query), request.ip ?? null));
  }
}

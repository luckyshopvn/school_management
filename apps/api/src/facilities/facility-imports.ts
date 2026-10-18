import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FacilityImportType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  DEVELOPMENT_AREAS,
  EQUIPMENT_AGE_GROUPS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_NORM_BASES,
  EQUIPMENT_TARGET_USERS,
  PERMISSION_CODES,
  ROOM_ATTRIBUTES,
  ROOM_BLOCKS,
  ROOM_CONDITIONS,
  ROOM_TYPES,
  type CodeLabel,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import {
  MAXIMUM_IMPORT_BYTES,
  buildErrorWorkbook,
  buildTemplate,
  readSheet,
  type ImportCatalog,
  type ImportColumn,
  type RowError,
  type SheetRow,
} from '../imports/excel.js';
import { foldText } from '../imports/moet-columns.js';
import { FacilitiesData } from './facilities-data.js';

// Nhập từ Excel của phân hệ Cơ sở vật chất, TBDH (DT-16 phần 16i, YCTD-128), dùng công cụ nhập chung của 16a (tải file mẫu,
// file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, kiểm tra cả tệp, xuất file lỗi, ghi khi không còn dòng lỗi):
// - rooms: 1.1 Khai báo cơ sở vật chất, mỗi dòng một phòng của một đơn vị; mã đơn vị và mã phòng đã có thì cập nhật, ô
//   trống giữ giá trị đang có; cần quyền quản lý phòng học ở đơn vị của dòng;
// - equipment_items: danh mục thiết bị dạy học (2.1 danh mục tối thiểu, 2.2 thiết bị ngoài danh mục), mã đã có thì cập
//   nhật, mã trống là thiết bị mới (máy chủ cấp mã); cần quyền quản lý thiết bị ở phạm vi toàn trường.
// Lần nhập lưu ở bảng riêng facility_import_jobs (không đổi ràng buộc loại nhập của bảng lần nhập chung)
const RULE = 'YCTD-128';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAXIMUM_TEXT = 300;

const ROOM_STATUSES = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Ngừng dùng' },
];
const EQUIPMENT_KINDS = [
  { value: 'minimum', label: 'Tối thiểu' },
  { value: 'outside', label: 'Ngoài danh mục' },
];
const EQUIPMENT_STATUSES = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Ngừng sử dụng' },
];
const BOOLEANS = { yes: ['co', 'x', '1', 'true', 'dat'], no: ['khong', '0', 'false'] };

export const ROOM_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'org_unit', header: 'Mã đơn vị', note: 'Bắt buộc: mã đơn vị (điểm trường, phân hiệu) trong danh mục' },
  { key: 'code', header: 'Mã phòng', note: 'Bắt buộc; mã đã có trong đơn vị thì cập nhật phòng đó' },
  { key: 'name', header: 'Tên phòng', note: 'Bắt buộc với phòng mới; ô trống giữ tên đang có' },
  { key: 'capacity', header: 'Sức chứa', note: 'Số nguyên từ 1 đến 1000; bắt buộc với phòng mới' },
  { key: 'room_block', header: 'Khối phòng', note: 'Mã hoặc tên khối phòng; để trống thì lấy theo loại phòng' },
  { key: 'room_type', header: 'Loại phòng', note: 'Mã hoặc tên loại phòng thuộc khối phòng (xem Tra cứu danh mục)' },
  { key: 'condition', header: 'Hiện trạng', note: 'Kiên cố, Bán kiên cố, Tạm hoặc Nhờ, mượn, thuê' },
  { key: 'area_m2', header: 'Diện tích (m²)', note: 'Số không âm, dấu thập phân là dấu chấm hoặc dấu phẩy' },
  { key: 'status', header: 'Trạng thái', note: 'Đang dùng hoặc Ngừng dùng; để trống là Đang dùng với phòng mới' },
  ...ROOM_ATTRIBUTES.map((field) => ({
    key: field.key,
    header: field.label,
    note: [
      field.kind === 'boolean'
        ? 'Có hoặc Không'
        : field.kind === 'integer'
          ? 'Số nguyên không âm'
          : field.kind === 'number'
            ? 'Số không âm'
            : field.kind === 'choice'
              ? (field.options ?? []).map((option) => option.label).join(', ')
              : 'Chữ, tối đa 500 ký tự',
      field.roomTypes ? 'chỉ cho Phòng vệ sinh' : null,
      'không bắt buộc',
    ]
      .filter(Boolean)
      .join('; '),
  })),
];
export const LOCKED_ROOM_IMPORT_COLUMNS = ['org_unit', 'code'];

export const EQUIPMENT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'code', header: 'Mã thiết bị', note: 'Mã đã có thì cập nhật thiết bị đó; để trống là thiết bị mới' },
  { key: 'name', header: 'Tên thiết bị', note: 'Bắt buộc với thiết bị mới, tối đa 300 ký tự' },
  { key: 'unit', header: 'Đơn vị tính', note: 'Bắt buộc với thiết bị mới, tối đa 30 ký tự' },
  { key: 'equipment_group', header: 'Nhóm thiết bị', note: 'Mã hoặc tên nhóm thiết bị; bắt buộc với thiết bị mới' },
  { key: 'development_area', header: 'Lĩnh vực phát triển', note: 'Mã hoặc tên lĩnh vực; không bắt buộc' },
  { key: 'age_group', header: 'Nhóm tuổi', note: 'Mã hoặc tên nhóm tuổi; bắt buộc với thiết bị mới' },
  {
    key: 'quantity',
    header: 'Số lượng',
    note: 'Số lượng tối thiểu của một nhóm, lớp (hoặc một học sinh); bắt buộc với thiết bị mới',
  },
  { key: 'norm_basis', header: 'Tính theo', note: 'Theo nhóm, lớp hoặc Theo học sinh; để trống là theo nhóm, lớp' },
  { key: 'target_users', header: 'Đối tượng sử dụng', note: 'Học sinh, Giáo viên hoặc Học sinh và giáo viên' },
  { key: 'equipment_type', header: 'Loại thiết bị', note: 'Không bắt buộc, tối đa 100 ký tự' },
  { key: 'kind', header: 'Danh mục', note: 'Tối thiểu hoặc Ngoài danh mục; để trống là Ngoài danh mục với thiết bị mới' },
  { key: 'status', header: 'Trạng thái', note: 'Đang dùng hoặc Ngừng sử dụng; không bắt buộc' },
  { key: 'note', header: 'Ghi chú', note: 'Không bắt buộc, tối đa 500 ký tự' },
];
export const LOCKED_EQUIPMENT_IMPORT_COLUMNS = ['code', 'name'];

const IMPORT_TYPES: Record<
  FacilityImportType,
  { columns: ImportColumn[]; locked: string[]; title: string; fileName: string }
> = {
  rooms: {
    columns: ROOM_IMPORT_COLUMNS,
    locked: LOCKED_ROOM_IMPORT_COLUMNS,
    title: 'Khai báo cơ sở vật chất',
    fileName: 'mau-nhap-phong',
  },
  equipment_items: {
    columns: EQUIPMENT_IMPORT_COLUMNS,
    locked: LOCKED_EQUIPMENT_IMPORT_COLUMNS,
    title: 'Danh mục thiết bị dạy học',
    fileName: 'mau-nhap-thiet-bi',
  },
};

// Giá trị danh mục theo mã hoặc tên, không phân biệt dấu, hoa thường
function matchCode(values: ReadonlyArray<CodeLabel>, text: string): string | null {
  const folded = foldText(text);
  return values.find((item) => foldText(item.value) === folded || foldText(item.label) === folded)?.value ?? null;
}

function parseNumber(text: string): number | null {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

function parseBoolean(text: string): boolean | null {
  const folded = foldText(text);
  return BOOLEANS.yes.includes(folded) ? true : BOOLEANS.no.includes(folded) ? false : null;
}

const headerOf = (columns: ImportColumn[], key: string) => columns.find((column) => column.key === key)?.header ?? null;

export interface ImportRoomContext {
  units: Array<{ id: string; code: string; name: string }>;
  rooms: Array<{
    id: string;
    org_unit_id: string;
    code: string;
    name: string;
    capacity: number;
    status: string;
    room_block: string | null;
    room_type: string | null;
    condition: string | null;
    area_m2: number | null;
    facility_attributes: Record<string, unknown>;
  }>;
}

export interface ParsedRoom {
  row: number;
  room_id: string | null;
  org_unit_id: string;
  code: string;
  name: string;
  capacity: number;
  status: 'active' | 'inactive';
  room_block: string | null;
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  facility_attributes: Record<string, unknown>;
}

// Đọc các dòng phòng; trả lỗi theo dòng, cột như công cụ nhập chung. Hàm thuần, không đọc cơ sở dữ liệu
export function parseRoomRows(rows: SheetRow[], context: ImportRoomContext) {
  const errors: RowError[] = [];
  const rooms: ParsedRoom[] = [];
  const seen = new Map<string, number>();
  for (const { row, values } of rows) {
    const add = (key: string | null, message: string) =>
      errors.push({ row, column: key ? headerOf(ROOM_IMPORT_COLUMNS, key) : null, message });
    const before = errors.length;
    const unitText = foldText(values.org_unit ?? '');
    const unit = context.units.find((item) => foldText(item.code) === unitText || foldText(item.name) === unitText);
    if (!unitText) {
      add('org_unit', 'Bắt buộc nhập mã đơn vị');
    } else if (!unit) {
      add('org_unit', `Không có đơn vị "${values.org_unit}" trong phạm vi quản lý phòng của bạn`);
    }
    const code = values.code?.trim() ?? '';
    if (!code) {
      add('code', 'Bắt buộc nhập mã phòng');
    } else if (code.length > 50) {
      add('code', 'Mã phòng tối đa 50 ký tự');
    }
    const existing = unit ? context.rooms.find((room) => room.org_unit_id === unit.id && room.code === code) : undefined;
    const key = `${unit?.id ?? ''}|${code}`;
    if (unit && code && seen.has(key)) {
      add('code', `Mã phòng trùng dòng ${seen.get(key)} của tệp`);
    }
    seen.set(key, row);
    const name = values.name?.trim() || existing?.name || '';
    if (!name) {
      add('name', 'Bắt buộc nhập tên phòng với phòng mới');
    } else if (name.length > MAXIMUM_TEXT) {
      add('name', `Tên phòng tối đa ${MAXIMUM_TEXT} ký tự`);
    }
    let capacity = existing?.capacity ?? 0;
    if (values.capacity) {
      const parsed = parseNumber(values.capacity);
      if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        add('capacity', 'Sức chứa là số nguyên từ 1 đến 1000');
      } else {
        capacity = parsed;
      }
    } else if (!existing) {
      add('capacity', 'Bắt buộc nhập sức chứa với phòng mới');
    }
    let roomBlock = existing?.room_block ?? null;
    if (values.room_block) {
      roomBlock = matchCode(ROOM_BLOCKS, values.room_block);
      if (!roomBlock) {
        add('room_block', `Không có khối phòng "${values.room_block}"`);
      }
    }
    let roomType = existing?.room_type ?? null;
    if (values.room_type) {
      roomType = matchCode(ROOM_TYPES, values.room_type);
      if (!roomType) {
        add('room_type', `Không có loại phòng "${values.room_type}"`);
      } else if (!values.room_block) {
        roomBlock = ROOM_TYPES.find((type) => type.value === roomType)?.block ?? roomBlock;
      }
    }
    const typeBlock = ROOM_TYPES.find((type) => type.value === roomType)?.block;
    if (roomType && typeBlock && roomBlock !== typeBlock) {
      add('room_type', 'Loại phòng không thuộc khối phòng đã chọn');
    }
    let condition = existing?.condition ?? null;
    if (values.condition) {
      condition = matchCode(ROOM_CONDITIONS, values.condition);
      if (!condition) {
        add('condition', 'Hiện trạng là Kiên cố, Bán kiên cố, Tạm hoặc Nhờ, mượn, thuê');
      }
    }
    let area = existing?.area_m2 ?? null;
    if (values.area_m2) {
      area = parseNumber(values.area_m2);
      if (area === null || area > 1_000_000) {
        add('area_m2', 'Diện tích là số không âm');
      } else {
        area = Math.round(area * 100) / 100;
      }
    }
    let status = (existing?.status ?? 'active') as 'active' | 'inactive';
    if (values.status) {
      const parsed = matchCode(ROOM_STATUSES, values.status);
      if (!parsed) {
        add('status', 'Trạng thái là Đang dùng hoặc Ngừng dùng');
      } else {
        status = parsed as 'active' | 'inactive';
      }
    }
    const attributes: Record<string, unknown> = { ...(existing?.facility_attributes ?? {}) };
    for (const field of ROOM_ATTRIBUTES) {
      const text = values[field.key] ?? '';
      if (!text) {
        continue;
      }
      if (field.roomTypes && (roomType === null || !field.roomTypes.includes(roomType))) {
        add(field.key, 'Chỉ khai báo cho Phòng vệ sinh');
        continue;
      }
      if (field.kind === 'boolean') {
        const parsed = parseBoolean(text);
        if (parsed === null) {
          add(field.key, 'Ghi Có hoặc Không');
        } else {
          attributes[field.key] = parsed;
        }
      } else if (field.kind === 'integer' || field.kind === 'number') {
        const parsed = parseNumber(text);
        if (parsed === null || (field.kind === 'integer' && !Number.isInteger(parsed)) || parsed > 1_000_000) {
          add(field.key, field.kind === 'integer' ? 'Phải là số nguyên không âm' : 'Phải là số không âm');
        } else {
          attributes[field.key] = field.kind === 'number' ? Math.round(parsed * 100) / 100 : parsed;
        }
      } else if (field.kind === 'choice') {
        const parsed = matchCode(field.options ?? [], text);
        if (!parsed) {
          add(field.key, `Giá trị là ${(field.options ?? []).map((option) => option.label).join(', ')}`);
        } else {
          attributes[field.key] = parsed;
        }
      } else if (text.length > 500) {
        add(field.key, 'Tối đa 500 ký tự');
      } else {
        attributes[field.key] = text;
      }
    }
    // Đổi sang loại phòng khác thì bỏ các thuộc tính riêng của loại phòng cũ
    for (const field of ROOM_ATTRIBUTES) {
      if (field.roomTypes && (roomType === null || !field.roomTypes.includes(roomType)) && !values[field.key]) {
        delete attributes[field.key];
      }
    }
    if (errors.length > before || !unit) {
      continue;
    }
    rooms.push({
      row,
      room_id: existing?.id ?? null,
      org_unit_id: unit.id,
      code,
      name,
      capacity,
      status,
      room_block: roomBlock,
      room_type: roomType,
      condition,
      area_m2: area,
      facility_attributes: attributes,
    });
  }
  return { rooms, errors };
}

export interface ImportEquipmentContext {
  items: Array<{
    id: string;
    code: string;
    name: string;
    unit: string;
    equipment_group: string;
    development_area: string | null;
    age_group: string;
    quantity: number;
    norm_basis: string;
    target_users: string;
    equipment_type: string | null;
    is_minimum: boolean;
    status: string;
    note: string | null;
  }>;
}

export interface ParsedEquipmentItem {
  row: number;
  item_id: string | null;
  code: string | null;
  name: string;
  unit: string;
  equipment_group: string;
  development_area: string | null;
  age_group: string;
  quantity: number;
  norm_basis: string;
  target_users: string;
  equipment_type: string | null;
  is_minimum: boolean;
  status: 'active' | 'inactive';
  note: string | null;
}

// Đọc các dòng danh mục thiết bị; hàm thuần
export function parseEquipmentRows(rows: SheetRow[], context: ImportEquipmentContext) {
  const errors: RowError[] = [];
  const items: ParsedEquipmentItem[] = [];
  const seen = new Map<string, number>();
  for (const { row, values } of rows) {
    const add = (key: string | null, message: string) =>
      errors.push({ row, column: key ? headerOf(EQUIPMENT_IMPORT_COLUMNS, key) : null, message });
    const before = errors.length;
    const code = values.code?.trim() || null;
    if (code && code.length > 30) {
      add('code', 'Mã thiết bị tối đa 30 ký tự');
    }
    if (code && seen.has(code)) {
      add('code', `Mã thiết bị trùng dòng ${seen.get(code)} của tệp`);
    }
    if (code) {
      seen.set(code, row);
    }
    const existing = code ? context.items.find((item) => item.code === code) : undefined;
    const text = (key: string, max: number, label: string, required: boolean, fallback: string | null) => {
      const value = values[key]?.trim() || fallback || '';
      if (!value && required) {
        add(key, `Bắt buộc nhập ${label} với thiết bị mới`);
      } else if (value.length > max) {
        add(key, `${label[0]?.toUpperCase()}${label.slice(1)} tối đa ${max} ký tự`);
      }
      return value;
    };
    const name = text('name', MAXIMUM_TEXT, 'tên thiết bị', true, existing?.name ?? null);
    const unit = text('unit', 30, 'đơn vị tính', true, existing?.unit ?? null);
    const code_ = (key: string, values_: ReadonlyArray<CodeLabel>, label: string, fallback: string | null) => {
      const raw = values[key] ?? '';
      if (!raw) {
        return fallback;
      }
      const parsed = matchCode(values_, raw);
      if (!parsed) {
        add(key, `Không có ${label} "${raw}" (xem Tra cứu danh mục)`);
      }
      return parsed;
    };
    const group = code_('equipment_group', EQUIPMENT_GROUPS, 'nhóm thiết bị', existing?.equipment_group ?? null);
    if (!group && !values.equipment_group) {
      add('equipment_group', 'Bắt buộc nhập nhóm thiết bị với thiết bị mới');
    }
    const area = code_('development_area', DEVELOPMENT_AREAS, 'lĩnh vực phát triển', existing?.development_area ?? null);
    const ageGroup = code_('age_group', EQUIPMENT_AGE_GROUPS, 'nhóm tuổi', existing?.age_group ?? null);
    if (!ageGroup && !values.age_group) {
      add('age_group', 'Bắt buộc nhập nhóm tuổi với thiết bị mới');
    }
    let quantity = existing?.quantity ?? null;
    if (values.quantity) {
      quantity = parseNumber(values.quantity);
      if (quantity === null || quantity > 100_000) {
        add('quantity', 'Số lượng là số từ 0 đến 100000');
      } else {
        quantity = Math.round(quantity * 100) / 100;
      }
    } else if (!existing) {
      add('quantity', 'Bắt buộc nhập số lượng với thiết bị mới');
    }
    const basis = code_('norm_basis', EQUIPMENT_NORM_BASES, 'cách tính', existing?.norm_basis ?? 'class');
    const target = code_('target_users', EQUIPMENT_TARGET_USERS, 'đối tượng sử dụng', existing?.target_users ?? 'tre');
    const type = values.equipment_type?.trim() || existing?.equipment_type || null;
    if (type && type.length > 100) {
      add('equipment_type', 'Loại thiết bị tối đa 100 ký tự');
    }
    const kind = code_('kind', EQUIPMENT_KINDS, 'danh mục', existing ? (existing.is_minimum ? 'minimum' : 'outside') : 'outside');
    const status = code_('status', EQUIPMENT_STATUSES, 'trạng thái', existing?.status ?? 'active');
    const note = values.note?.trim() || existing?.note || null;
    if (note && note.length > 500) {
      add('note', 'Ghi chú tối đa 500 ký tự');
    }
    if (errors.length > before || !group || !ageGroup || quantity === null || !basis || !target || !kind || !status) {
      continue;
    }
    items.push({
      row,
      item_id: existing?.id ?? null,
      code,
      name,
      unit,
      equipment_group: group,
      development_area: area,
      age_group: ageGroup,
      quantity,
      norm_basis: basis,
      target_users: target,
      equipment_type: type,
      is_minimum: kind === 'minimum',
      status: status as 'active' | 'inactive',
      note,
    });
  }
  return { items, errors };
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

@Injectable()
export class FacilityImportsService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private type(type: string): FacilityImportType {
    if (type !== 'rooms' && type !== 'equipment_items') {
      throw validationError([{ field: 'type', message: 'Loại dữ liệu nhập là rooms hoặc equipment_items' }]);
    }
    return type;
  }

  // Quyền theo loại nhập: phòng theo phạm vi quản lý phòng học; danh mục thiết bị cần phạm vi toàn trường
  private async assertAccess(currentUser: CurrentUser, type: FacilityImportType): Promise<string[]> {
    if (type === 'rooms') {
      if (!currentUser.hasPermission(PERMISSION_CODES.roomManage)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý phòng học');
      }
      return this.data.units(currentUser, [PERMISSION_CODES.roomManage], null);
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.equipmentManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý thiết bị dạy học');
    }
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION_CODES.equipmentManage],
      'Chỉ người quản lý thiết bị toàn trường nhập được danh mục thiết bị',
    );
    return [];
  }

  async columns(currentUser: CurrentUser, rawType: string) {
    const type = this.type(rawType);
    await this.assertAccess(currentUser, type);
    const definition = IMPORT_TYPES[type];
    return {
      columns: definition.columns.map((column) => ({ ...column, locked: definition.locked.includes(column.key) })),
      updates_existing: true,
      template_with_data: true,
    };
  }

  async catalogs(currentUser: CurrentUser, rawType: string): Promise<ImportCatalog[]> {
    const type = this.type(rawType);
    const unitIds = await this.assertAccess(currentUser, type);
    const list = (key: string, title: string, column: string, values: ReadonlyArray<CodeLabel>) => ({
      key,
      title,
      column,
      items: values.map((item) => ({ code: item.value, name: item.label })),
    });
    if (type === 'rooms') {
      const database = await this.data.database();
      const units = await database
        .selectFrom('org_units')
        .select(['code', 'name'])
        .where('id', 'in', unitIds)
        .orderBy('name')
        .execute();
      return [
        { key: 'org_units', title: 'Đơn vị', column: 'Mã đơn vị', items: units },
        list('room_blocks', 'Khối phòng', 'Khối phòng', ROOM_BLOCKS),
        {
          key: 'room_types',
          title: 'Loại phòng',
          column: 'Loại phòng',
          items: ROOM_TYPES.map((item) => ({ code: item.value, name: item.label, note: labelOf(ROOM_BLOCKS, item.block) })),
        },
        list('conditions', 'Hiện trạng', 'Hiện trạng', ROOM_CONDITIONS),
        list('statuses', 'Trạng thái', 'Trạng thái', ROOM_STATUSES),
        ...ROOM_ATTRIBUTES.filter((field) => field.kind === 'choice').map((field) =>
          list(field.key, field.label, field.label, field.options ?? []),
        ),
      ];
    }
    return [
      list('equipment_groups', 'Nhóm thiết bị', 'Nhóm thiết bị', EQUIPMENT_GROUPS),
      list('development_areas', 'Lĩnh vực phát triển', 'Lĩnh vực phát triển', DEVELOPMENT_AREAS),
      list('age_groups', 'Nhóm tuổi', 'Nhóm tuổi', EQUIPMENT_AGE_GROUPS),
      list('norm_bases', 'Tính theo', 'Tính theo', EQUIPMENT_NORM_BASES),
      list('target_users', 'Đối tượng sử dụng', 'Đối tượng sử dụng', EQUIPMENT_TARGET_USERS),
      list('kinds', 'Danh mục', 'Danh mục', EQUIPMENT_KINDS),
      list('statuses', 'Trạng thái', 'Trạng thái', EQUIPMENT_STATUSES),
    ];
  }

  // Tệp mẫu; kèm dữ liệu thì điền phòng của các đơn vị trong phạm vi hoặc cả danh mục thiết bị
  async template(currentUser: CurrentUser, rawType: string, withData: boolean) {
    const type = this.type(rawType);
    const unitIds = await this.assertAccess(currentUser, type);
    const definition = IMPORT_TYPES[type];
    let rows: Array<Record<string, unknown>> = [];
    if (withData) {
      const database = await this.data.database();
      if (type === 'rooms') {
        const context = await this.roomContext(database, unitIds);
        rows = context.rooms.map((room) => ({
          org_unit: context.units.find((unit) => unit.id === room.org_unit_id)?.code ?? '',
          code: room.code,
          name: room.name,
          capacity: room.capacity,
          room_block: labelOf(ROOM_BLOCKS, room.room_block),
          room_type: labelOf(ROOM_TYPES, room.room_type),
          condition: labelOf(ROOM_CONDITIONS, room.condition),
          area_m2: room.area_m2 ?? '',
          status: labelOf(ROOM_STATUSES, room.status),
          ...Object.fromEntries(
            ROOM_ATTRIBUTES.map((field) => {
              const value = room.facility_attributes[field.key];
              return [
                field.key,
                value === undefined || value === null
                  ? ''
                  : field.kind === 'boolean'
                    ? value
                      ? 'Có'
                      : 'Không'
                    : field.kind === 'choice'
                      ? labelOf(field.options ?? [], String(value))
                      : value,
              ];
            }),
          ),
        }));
      } else {
        const context = await this.equipmentContext(database);
        rows = context.items.map((item) => ({
          ...item,
          equipment_group: labelOf(EQUIPMENT_GROUPS, item.equipment_group),
          development_area: labelOf(DEVELOPMENT_AREAS, item.development_area),
          age_group: labelOf(EQUIPMENT_AGE_GROUPS, item.age_group),
          norm_basis: labelOf(EQUIPMENT_NORM_BASES, item.norm_basis),
          target_users: labelOf(EQUIPMENT_TARGET_USERS, item.target_users),
          kind: item.is_minimum ? 'Tối thiểu' : 'Ngoài danh mục',
          status: labelOf(EQUIPMENT_STATUSES, item.status),
        }));
      }
    }
    return {
      buffer: await buildTemplate(definition.title, definition.columns, {
        rows,
        catalogs: await this.catalogs(currentUser, type),
      }),
      fileName: `${definition.fileName}${withData ? '-kem-du-lieu' : ''}.xlsx`,
    };
  }

  private async roomContext(database: Kysely<SchoolYearDatabase>, unitIds: string[]): Promise<ImportRoomContext> {
    if (unitIds.length === 0) {
      return { units: [], rooms: [] };
    }
    const [units, rooms] = await Promise.all([
      database.selectFrom('org_units').select(['id', 'code', 'name']).where('id', 'in', unitIds).execute(),
      database
        .selectFrom('rooms')
        .select([
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
        ])
        .where('org_unit_id', 'in', unitIds)
        .orderBy('code')
        .execute(),
    ]);
    return { units, rooms: rooms.map((room) => ({ ...room, area_m2: room.area_m2 === null ? null : Number(room.area_m2) })) };
  }

  private async equipmentContext(database: Kysely<SchoolYearDatabase>): Promise<ImportEquipmentContext> {
    const items = await database
      .selectFrom('equipment_items')
      .select([
        'id',
        'code',
        'name',
        'unit',
        'equipment_group',
        'development_area',
        'age_group',
        'quantity',
        'norm_basis',
        'target_users',
        'equipment_type',
        'is_minimum',
        'status',
        'note',
      ])
      .orderBy('order_no')
      .orderBy('code')
      .execute();
    return { items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) };
  }

  private view(job: {
    id: string;
    status: 'validated' | 'failed' | 'committed';
    total_rows: number;
    error_rows: number;
    errors: unknown[];
    payload: unknown[];
  }) {
    return {
      id: job.id,
      status: job.status,
      total_rows: job.total_rows,
      error_rows: job.error_rows,
      errors: job.errors as RowError[],
      assigned_rows: job.payload.length,
    };
  }

  // Tải tệp lên và kiểm tra cả tệp; lưu tệp gốc ở kho tệp để xuất file lỗi
  async upload(
    currentUser: CurrentUser,
    rawType: string,
    fileName: string,
    body: Buffer,
    selectedKeys: string[] | undefined,
    origin: ChangeOrigin,
  ) {
    const type = this.type(rawType);
    const unitIds = await this.assertAccess(currentUser, type);
    const definition = IMPORT_TYPES[type];
    const database = await this.data.database();
    const root = await this.data.root(database);
    const selected = selectedKeys ? new Set([...definition.locked, ...selectedKeys]) : undefined;
    const rows = await readSheet(body, definition.columns, selected);
    let errors: RowError[];
    let payload: unknown[];
    if (type === 'rooms') {
      const result = parseRoomRows(rows, await this.roomContext(database, unitIds));
      errors = result.errors;
      payload = result.rooms;
    } else {
      const result = parseEquipmentRows(rows, await this.equipmentContext(database));
      errors = result.errors;
      payload = result.items;
    }
    const storageKey = `imports/facilities/${randomUUID()}.xlsx`;
    await this.fileStorage.put(storageKey, body, XLSX_TYPE);
    const job = await database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: root.id,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: XLSX_TYPE,
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return transaction
        .insertInto('facility_import_jobs')
        .values({
          import_type: type,
          org_unit_id: root.id,
          file_id: file.id,
          status: errors.length > 0 ? 'failed' : 'validated',
          total_rows: rows.length,
          error_rows: new Set(errors.map((error) => error.row)).size,
          errors: JSON.stringify(errors),
          payload: JSON.stringify(errors.length > 0 ? [] : payload),
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    return this.view(job);
  }

  private async findJob(database: Kysely<SchoolYearDatabase>, jobId: string, currentUser: CurrentUser) {
    const job = await database.selectFrom('facility_import_jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'facility_import_job');
    }
    const unitIds = await this.assertAccess(currentUser, job.import_type);
    return { job, unitIds };
  }

  // Ghi dữ liệu đọc được; phòng kiểm tra lại phạm vi và trùng mã ngay lúc ghi
  async commit(currentUser: CurrentUser, jobId: string, origin: ChangeOrigin) {
    const database = await this.data.database();
    const { job, unitIds } = await this.findJob(database, jobId, currentUser);
    if (job.status !== 'validated') {
      throw ruleViolationError(
        RULE,
        job.status === 'committed' ? 'Lần nhập đã ghi dữ liệu' : 'Tệp còn dòng lỗi, sửa tệp rồi tải lên lại',
      );
    }
    const committed = await database.transaction().execute(async (transaction) => {
      if (job.import_type === 'rooms') {
        for (const room of job.payload as ParsedRoom[]) {
          if (!unitIds.includes(room.org_unit_id)) {
            throw ruleViolationError(RULE, `Dòng ${room.row}: đơn vị nằm ngoài phạm vi quản lý phòng của bạn`);
          }
          await this.writeRoom(transaction, room, origin, jobId);
        }
      } else {
        for (const item of job.payload as ParsedEquipmentItem[]) {
          await this.writeItem(transaction, item, origin, jobId);
        }
      }
      return transaction
        .updateTable('facility_import_jobs')
        .set({ status: 'committed', committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    return this.view(committed);
  }

  private async writeRoom(
    transaction: Kysely<SchoolYearDatabase>,
    room: ParsedRoom,
    origin: ChangeOrigin,
    jobId: string,
  ) {
    const values = {
      name: room.name,
      capacity: room.capacity,
      status: room.status,
      room_block: room.room_block,
      room_type: room.room_type,
      condition: room.condition,
      area_m2: room.area_m2,
      facility_attributes: JSON.stringify(room.facility_attributes),
    };
    const before = await transaction
      .selectFrom('rooms')
      .selectAll()
      .where('org_unit_id', '=', room.org_unit_id)
      .where('code', '=', room.code)
      .executeTakeFirst();
    const saved = before
      ? await transaction
          .updateTable('rooms')
          .set({ ...values, updated_at: this.clock.now() })
          .where('id', '=', before.id)
          .returningAll()
          .executeTakeFirstOrThrow()
      : await transaction
          .insertInto('rooms')
          .values({ org_unit_id: room.org_unit_id, code: room.code, ...values, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: room.org_unit_id,
      entityName: 'rooms',
      entityId: saved.id,
      action: before ? 'update' : 'create',
      before: before ?? null,
      after: { ...saved, import_job_id: jobId },
    });
  }

  private async writeItem(
    transaction: Kysely<SchoolYearDatabase>,
    item: ParsedEquipmentItem,
    origin: ChangeOrigin,
    jobId: string,
  ) {
    const { row: _row, item_id: _itemId, code, ...values } = item;
    const before = code
      ? await transaction.selectFrom('equipment_items').selectAll().where('code', '=', code).executeTakeFirst()
      : undefined;
    let saved;
    if (before) {
      saved = await transaction
        .updateTable('equipment_items')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', before.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      const last = await transaction
        .selectFrom('equipment_items')
        .select(sql<number>`coalesce(max(order_no), 0)`.as('order_no'))
        .executeTakeFirstOrThrow();
      const orderNo = Number(last.order_no) + 1;
      saved = await transaction
        .insertInto('equipment_items')
        .values({
          ...values,
          code: code ?? `${values.is_minimum ? 'TT' : 'NDM'}-${String(orderNo).padStart(4, '0')}`,
          order_no: orderNo,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: null,
      entityName: 'equipment_items',
      entityId: saved.id,
      action: before ? 'update' : 'create',
      before: before ?? null,
      after: { ...saved, import_job_id: jobId },
    });
  }

  async errorFile(currentUser: CurrentUser, jobId: string) {
    const database = await this.data.database();
    const { job } = await this.findJob(database, jobId, currentUser);
    const errors = job.errors as RowError[];
    if (errors.length === 0) {
      throw ruleViolationError(RULE, 'Lần nhập này không có dòng lỗi');
    }
    const file = await database
      .selectFrom('files')
      .select(['storage_key', 'file_name'])
      .where('id', '=', job.file_id)
      .executeTakeFirstOrThrow();
    const body = await this.fileStorage.get(file.storage_key);
    const baseName = file.file_name.replace(/\.(xlsx|xls)$/i, '');
    return { buffer: buildErrorWorkbook(body, errors, 1), fileName: `${baseName}-loi.xlsx` };
  }
}

function sendXlsx(response: Response, buffer: Buffer, fileName: string, asciiName: string) {
  response.setHeader('content-type', XLSX_TYPE);
  response.setHeader(
    'content-disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  response.setHeader('cache-control', 'no-store');
  response.send(buffer);
}

// Đường dẫn cùng dạng công cụ nhập chung (/imports) để màn hình dùng chung thành phần nhập Excel của 16a; quyền kiểm tra
// theo loại nhập trong dịch vụ (quản lý phòng học hoặc quản lý thiết bị)
@Controller('facility-imports')
export class FacilityImportsController {
  constructor(private readonly imports: FacilityImportsService) {}

  @Get('templates/:type/columns')
  columns(@Param('type') type: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.imports.columns(currentUser, type);
  }

  @Get('catalogs/:type')
  async catalogs(@Param('type') type: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return { items: await this.imports.catalogs(currentUser, type) };
  }

  @Get('templates/:type')
  async template(
    @Param('type') type: string,
    @Query('with_data') withData: string | undefined,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.imports.template(currentUser, type, withData === 'true');
    sendXlsx(response, file.buffer, file.fileName, file.fileName);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    const type = typeof body?.type === 'string' ? body.type : '';
    const columns = body?.columns;
    if (columns !== undefined && columns !== null && columns !== '' && typeof columns !== 'string') {
      throw validationError([{ field: 'columns', message: 'Danh sách cột không hợp lệ' }]);
    }
    const keys =
      typeof columns === 'string' && columns !== ''
        ? columns
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean)
        : undefined;
    return this.imports.upload(
      currentUser,
      type,
      Buffer.from(file.originalname, 'latin1').toString('utf8'),
      file.buffer,
      keys,
      originOf(request, currentUser),
    );
  }

  @Post(':id/commit')
  @HttpCode(200)
  commit(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.imports.commit(currentUser, jobId, originOf(request, currentUser));
  }

  @Get(':id/error-file')
  async errorFile(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.imports.errorFile(currentUser, jobId);
    sendXlsx(response, file.buffer, file.fileName, `tep-loi-${jobId.slice(0, 8)}.xlsx`);
  }
}

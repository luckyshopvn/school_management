import {
  ROOM_ATTRIBUTES,
  ROOM_BLOCKS,
  ROOM_CONDITIONS,
  ROOM_TYPES,
  type EquipmentAgeGroup,
  type ProfileField,
} from '@school-management/shared';
import type { FieldError } from '@school-management/server';
import type { RequestBody } from '../common/request-fields.js';

// Quy tắc dùng chung của thiết bị dạy học, cơ sở vật chất và hồ sơ trường (DT-14 phần 14d, YCTD-102)

// Nhóm tuổi của nhóm, lớp suy từ độ tuổi của bậc học (khối): lấy tháng tuổi giữa khoảng "từ – đến" của khối rồi xếp vào
// nhóm tuổi của Thông tư 02/2010. Ví dụ khối 18–36 tháng (giữa 27) là nhà trẻ 24–36 tháng, khối 36–48 tháng là mẫu giáo
// 3–4 tuổi. Không có khối thì không xếp được (null)
export function ageGroupOfMonths(fromMonths: number, toMonths: number): EquipmentAgeGroup {
  const middle = (fromMonths + toMonths) / 2;
  if (middle <= 12) {
    return 'nt_3_12';
  }
  if (middle <= 24) {
    return 'nt_12_24';
  }
  if (middle < 36) {
    return 'nt_24_36';
  }
  if (middle < 48) {
    return 'mg_3_4';
  }
  if (middle < 60) {
    return 'mg_4_5';
  }
  return 'mg_5_6';
}

export function isNurseryGroup(ageGroup: string | null): boolean {
  return ageGroup !== null && ageGroup.startsWith('nt_');
}

// Đọc và kiểm tra một nhóm giá trị theo danh sách trường cố định; khóa lạ bị từ chối; ô trống bỏ qua
export function readProfileValues(
  value: unknown,
  fields: ReadonlyArray<ProfileField>,
  prefix: string,
  errors: FieldError[],
): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ field: prefix, message: 'Phải là đối tượng' });
    return {};
  }
  const result: Record<string, unknown> = {};
  const byKey = new Map(fields.map((field) => [field.key, field]));
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const field = byKey.get(key);
    const path = `${prefix}.${key}`;
    if (!field) {
      errors.push({ field: path, message: 'Trường không có trong biểu mẫu' });
      continue;
    }
    if (raw === undefined || raw === null || raw === '') {
      continue;
    }
    switch (field.kind) {
      case 'boolean':
        if (typeof raw !== 'boolean') {
          errors.push({ field: path, message: 'Phải là có hoặc không' });
        } else {
          result[key] = raw;
        }
        break;
      case 'integer':
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 1_000_000) {
          errors.push({ field: path, message: 'Phải là số nguyên không âm' });
        } else {
          result[key] = raw;
        }
        break;
      case 'number':
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 100_000_000) {
          errors.push({ field: path, message: 'Phải là số không âm' });
        } else {
          result[key] = Math.round(raw * 100) / 100;
        }
        break;
      case 'date':
        if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
          errors.push({ field: path, message: 'Ngày dạng YYYY-MM-DD' });
        } else {
          result[key] = raw;
        }
        break;
      case 'choice':
        if (typeof raw !== 'string' || !(field.options ?? []).some((option) => option.value === raw)) {
          errors.push({
            field: path,
            message: `Giá trị là ${(field.options ?? []).map((option) => option.value).join(', ')}`,
          });
        } else {
          result[key] = raw;
        }
        break;
      default:
        if (typeof raw !== 'string' || raw.trim().length > 500) {
          errors.push({ field: path, message: 'Phải là chữ, tối đa 500 ký tự' });
        } else {
          result[key] = raw.trim();
        }
    }
  }
  return result;
}

export interface RoomFacilityChanges {
  room_block?: string | null;
  room_type?: string | null;
  condition?: string | null;
  area_m2?: number | null;
  facility_attributes?: Record<string, unknown>;
}

function readCode(
  body: RequestBody,
  field: string,
  values: ReadonlyArray<{ value: string }>,
  errors: FieldError[],
): string | null | undefined {
  const raw = body?.[field];
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === '') {
    return null;
  }
  if (typeof raw !== 'string' || !values.some((item) => item.value === raw)) {
    errors.push({ field, message: `Giá trị là ${values.map((item) => item.value).join(', ')}` });
    return undefined;
  }
  return raw;
}

// Khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính theo quy chuẩn; loại phòng phải thuộc khối phòng (khi sửa,
// so với khối hoặc loại đang lưu nếu lần sửa chỉ đổi một trong hai)
export function readRoomFacility(
  body: RequestBody,
  errors: FieldError[],
  existing: { room_block: string | null; room_type: string | null } | null = null,
): RoomFacilityChanges {
  const changes: RoomFacilityChanges = {};
  const block = readCode(body, 'room_block', ROOM_BLOCKS, errors);
  if (block !== undefined) {
    changes.room_block = block;
  }
  const type = readCode(body, 'room_type', ROOM_TYPES, errors);
  if (type !== undefined) {
    changes.room_type = type;
  }
  const effectiveBlock = block === undefined ? (existing?.room_block ?? null) : block;
  const effectiveType = type === undefined ? (existing?.room_type ?? null) : type;
  const definition = ROOM_TYPES.find((item) => item.value === effectiveType);
  if (effectiveType !== null && definition && definition.block !== effectiveBlock) {
    errors.push({ field: 'room_type', message: 'Loại phòng không thuộc khối phòng đã chọn' });
  }
  const condition = readCode(body, 'condition', ROOM_CONDITIONS, errors);
  if (condition !== undefined) {
    changes.condition = condition;
  }
  const area = body?.area_m2;
  if (area === null || area === '') {
    changes.area_m2 = null;
  } else if (area !== undefined) {
    if (typeof area !== 'number' || !Number.isFinite(area) || area < 0 || area > 1_000_000) {
      errors.push({ field: 'area_m2', message: 'Diện tích là số không âm' });
    } else {
      changes.area_m2 = Math.round(area * 100) / 100;
    }
  }
  if (body?.facility_attributes !== undefined) {
    changes.facility_attributes = readProfileValues(
      body.facility_attributes,
      ROOM_ATTRIBUTES,
      'facility_attributes',
      errors,
    );
    // Thuộc tính riêng của một số loại phòng (thông tin nhà vệ sinh) chỉ ghi cho đúng loại phòng đó (DT-16 phần 16i)
    for (const field of ROOM_ATTRIBUTES) {
      if (
        field.roomTypes &&
        changes.facility_attributes[field.key] !== undefined &&
        (effectiveType === null || !field.roomTypes.includes(effectiveType))
      ) {
        const types = field.roomTypes.map((type) => ROOM_TYPES.find((item) => item.value === type)?.label ?? type);
        errors.push({ field: `facility_attributes.${field.key}`, message: `Chỉ khai báo cho ${types.join(', ')}` });
      }
    }
  }
  return changes;
}

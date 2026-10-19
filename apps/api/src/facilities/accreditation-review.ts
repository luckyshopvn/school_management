import { Body, Controller, Get, HttpCode, Injectable, Post, Put, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  ACCREDITATION_LEVELS,
  NATIONAL_STANDARD_LEVELS,
  PERMISSION_CODES,
  RECOGNITION_YEAR_RANGE,
  SCHOOL_OWNERSHIP_TYPES,
} from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { FacilitiesData } from './facilities-data.js';

// 1.7 Rà soát thông tin kiểm định chất lượng giáo dục theo Sở (DT-16 phần 16e; đủ ô như Sở ở DT-17 phần 17e, khảo sát mục
// 10.5): tên trường, mã trường, loại hình, cấp học; chuẩn quốc gia, kiểm định CLGD (năm, ngày công nhận, mức độ hoặc cấp
// độ); số lớp, phòng học, phòng bộ môn, diện tích đất, diện tích sàn xây dựng, số học sinh, hai chỉ số diện tích trên học
// sinh; thời điểm đăng ký chuẩn quốc gia; ghi chú. "Lấy dữ liệu" tính từ dữ liệu sẵn có và hồ sơ trường, chưa ghi; "Ghi"
// lưu bản rà soát của năm học (một bản, gắn với Trường chính). Người dùng sửa được số đã lấy trước khi ghi. Xem như hồ sơ
// trường; ghi cần quyền cập nhật hồ sơ trường và phạm vi toàn trường
const MANAGE = PERMISSION_CODES.schoolProfileManage;
const VIEW = [MANAGE, PERMISSION_CODES.emisReport];
// Phòng học là phòng sinh hoạt chung của lớp; phòng bộ môn là các phòng giáo dục chuyên biệt của khối phòng phụ trợ (Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD)
const CLASSROOM_TYPES = ['group_room'];
const SUBJECT_ROOM_TYPES = ['physical_education', 'arts_education', 'multi_purpose', 'english_room', 'computer_room'];
const COUNT_FIELDS = ['class_count', 'classroom_count', 'subject_room_count', 'child_count'] as const;
const AREA_FIELDS = ['land_area_m2', 'floor_area_m2', 'area_per_child_m2', 'floor_area_per_child_m2'] as const;
const YEAR_FIELDS = ['national_standard_year', 'accreditation_year'] as const;
const DATE_FIELDS = ['national_standard_date', 'accreditation_date'] as const;
type TextKey =
  | 'school_name'
  | 'school_code'
  | 'ownership_type'
  | 'national_standard_level'
  | 'accreditation_level'
  | 'national_standard_registration';
// Ô chữ: độ dài tối đa như Sở (tên trường 200, mã trường 20), ô bắt buộc, danh sách giá trị của ô chọn
const TEXT_FIELDS: ReadonlyArray<{
  key: TextKey;
  label: string;
  maximum: number;
  required?: boolean;
  options?: ReadonlyArray<{ value: string }>;
}> = [
  { key: 'school_name', label: 'tên trường', maximum: 200, required: true },
  { key: 'school_code', label: 'mã trường', maximum: 20, required: true },
  { key: 'ownership_type', label: 'loại hình', maximum: 20, required: true, options: SCHOOL_OWNERSHIP_TYPES },
  { key: 'national_standard_level', label: 'mức độ', maximum: 1, options: NATIONAL_STANDARD_LEVELS },
  { key: 'accreditation_level', label: 'cấp độ', maximum: 1, options: ACCREDITATION_LEVELS },
  { key: 'national_standard_registration', label: 'thời điểm đăng ký', maximum: 100 },
];
// Hệ thống chỉ phục vụ cấp Mầm non nên cấp học cố định (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const EDUCATION_LEVEL = 'Mầm non';
// Ghi chú tối đa 500 ký tự như Sở (khảo sát mục 10.5)
export const MAXIMUM_NOTE_LENGTH = 500;

export interface AccreditationFigures {
  school_name: string | null;
  school_code: string | null;
  ownership_type: string | null;
  education_level: string;
  national_standard_year: number | null;
  national_standard_date: string | null;
  national_standard_level: string | null;
  accreditation_year: number | null;
  accreditation_date: string | null;
  accreditation_level: string | null;
  national_standard_registration: string | null;
  class_count: number | null;
  classroom_count: number | null;
  subject_room_count: number | null;
  land_area_m2: number | null;
  floor_area_m2: number | null;
  child_count: number | null;
  area_per_child_m2: number | null;
  floor_area_per_child_m2: number | null;
}

export type AccreditationInput = Omit<AccreditationFigures, 'education_level'> & { note: string | null };

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const toYear = (value: unknown): number | null => (Number.isInteger(value) ? (value as number) : null);

// Diện tích trên học sinh (đất hoặc sàn xây dựng) là diện tích chia số học sinh, làm tròn hai chữ số; thiếu một trong hai
// thì trống
export function areaPerChild(area: number | null, childCount: number | null): number | null {
  return area === null || !childCount ? null : Math.round((area * 100) / childCount) / 100;
}

export function readAccreditationInput(body: RequestBody, errors: FieldError[]): AccreditationInput {
  const input = {} as AccreditationInput;
  for (const field of TEXT_FIELDS) {
    const value = body?.[field.key];
    const text = typeof value === 'string' ? value.trim() : '';
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push({ field: field.key, message: 'Phải là chữ' });
    } else if (text === '') {
      if (field.required) {
        errors.push({ field: field.key, message: `Bắt buộc nhập ${field.label}` });
      }
    } else if (field.options && !field.options.some((option) => option.value === text)) {
      errors.push({ field: field.key, message: 'Giá trị không có trong danh sách' });
    } else if (text.length > field.maximum) {
      errors.push({ field: field.key, message: `Tối đa ${field.maximum} ký tự` });
    }
    input[field.key] = text === '' ? null : text;
  }
  for (const field of YEAR_FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      input[field] = null;
    } else if (
      !Number.isInteger(value) ||
      (value as number) < RECOGNITION_YEAR_RANGE.min ||
      (value as number) > RECOGNITION_YEAR_RANGE.max
    ) {
      errors.push({ field, message: `Năm từ ${RECOGNITION_YEAR_RANGE.min} đến ${RECOGNITION_YEAR_RANGE.max}` });
    } else {
      input[field] = value as number;
    }
  }
  for (const field of DATE_FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      input[field] = null;
    } else if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    } else {
      input[field] = value;
    }
  }
  for (const field of COUNT_FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      input[field] = null;
    } else if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
      errors.push({ field, message: 'Số nguyên không âm' });
    } else {
      input[field] = value as number;
    }
  }
  for (const field of AREA_FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      input[field] = null;
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000_000_000) {
      errors.push({ field, message: 'Số không âm' });
    } else {
      input[field] = Math.round(value * 100) / 100;
    }
  }
  const note = body?.note;
  if (note !== undefined && note !== null && typeof note !== 'string') {
    errors.push({ field: 'note', message: 'Ghi chú là chữ' });
  } else if (typeof note === 'string' && note.trim().length > MAXIMUM_NOTE_LENGTH) {
    errors.push({ field: 'note', message: `Ghi chú tối đa ${MAXIMUM_NOTE_LENGTH} ký tự` });
  }
  input.note = typeof note === 'string' && note.trim() !== '' ? note.trim() : null;
  return input;
}

@Injectable()
export class AccreditationReviewService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  async read(currentUser: CurrentUser) {
    await this.data.units(currentUser, VIEW, null);
    const database = await this.data.database();
    const root = await this.data.root(database);
    const saved = await database
      .selectFrom('accreditation_reviews')
      .selectAll()
      .where('org_unit_id', '=', root.id)
      .executeTakeFirst();
    return {
      org_unit: root,
      saved: saved
        ? {
            school_name: saved.school_name,
            school_code: saved.school_code,
            ownership_type: saved.ownership_type,
            education_level: saved.education_level ?? EDUCATION_LEVEL,
            national_standard_year: saved.national_standard_year,
            national_standard_date: saved.national_standard_date,
            national_standard_level: saved.national_standard_level,
            accreditation_year: saved.accreditation_year,
            accreditation_date: saved.accreditation_date,
            accreditation_level: saved.accreditation_level,
            national_standard_registration: saved.national_standard_registration,
            class_count: saved.class_count,
            classroom_count: saved.classroom_count,
            subject_room_count: saved.subject_room_count,
            land_area_m2: toNumber(saved.land_area_m2),
            floor_area_m2: toNumber(saved.floor_area_m2),
            child_count: saved.child_count,
            area_per_child_m2: toNumber(saved.area_per_child_m2),
            floor_area_per_child_m2: toNumber(saved.floor_area_per_child_m2),
            note: saved.note,
            collected_at: saved.collected_at,
            updated_at: saved.updated_at,
          }
        : null,
    };
  }

  // "Lấy dữ liệu": thông tin trường, chuẩn quốc gia, kiểm định CLGD ở hồ sơ trường (1.1); lớp đang dùng, phòng đang dùng
  // theo loại phòng, diện tích đất ở hồ sơ trường, diện tích sàn xây dựng ở hồ sơ trường (chưa nhập thì tổng diện tích các
  // phòng đang dùng đã khai báo ở FA 1.1), học sinh đang học ở lớp đang dùng; chưa ghi
  async collect(currentUser: CurrentUser): Promise<AccreditationFigures & { collected_at: Date }> {
    const unitIds = await this.data.units(currentUser, VIEW, null);
    const database = await this.data.database();
    return { ...(await collectFigures(this.data, database, unitIds)), collected_at: this.clock.now() };
  }

  async save(currentUser: CurrentUser, input: AccreditationInput, collected: boolean, origin: ChangeOrigin) {
    await this.data.assertWholeSchool(currentUser, [MANAGE], 'Chỉ người có phạm vi toàn trường ghi bản rà soát');
    const database = await this.data.database();
    const root = await this.data.root(database);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('accreditation_reviews')
        .selectAll()
        .where('org_unit_id', '=', root.id)
        .executeTakeFirst();
      const values = {
        ...input,
        education_level: EDUCATION_LEVEL,
        updated_by: origin.actorUserId,
        ...(collected ? { collected_at: now } : {}),
      };
      const after = before
        ? await transaction
            .updateTable('accreditation_reviews')
            .set({ ...values, updated_at: now })
            .where('id', '=', before.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('accreditation_reviews')
            .values({ ...values, org_unit_id: root.id })
            .returningAll()
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: root.id,
        entityName: 'accreditation_reviews',
        entityId: after.id,
        action: before ? 'update' : 'create',
        before: before ?? null,
        after,
      });
    });
    return this.read(currentUser);
  }
}

export async function collectFigures(
  data: FacilitiesData,
  database: Kysely<SchoolYearDatabase>,
  unitIds: string[],
): Promise<AccreditationFigures> {
  const root = await data.root(database);
  const [classes, rooms, profile] = await Promise.all([
    data.classes(database, unitIds),
    database
      .selectFrom('rooms')
      .select(['room_type', 'area_m2'])
      .where('status', '=', 'active')
      .where('org_unit_id', 'in', unitIds)
      .execute(),
    database.selectFrom('school_profiles').select('general').where('org_unit_id', '=', root.id).executeTakeFirst(),
  ]);
  const general = (profile?.general ?? {}) as Record<string, unknown>;
  const areas = rooms.map((room) => toNumber(room.area_m2)).filter((area): area is number => area !== null);
  const landArea = toNumber(general.land_area_m2);
  // Diện tích sàn xây dựng lấy ở hồ sơ trường; chưa nhập thì tổng diện tích các phòng đang dùng như trước 17e
  const floorArea =
    toNumber(general.floor_area_m2) ??
    (areas.length > 0 ? Math.round(areas.reduce((sum, area) => sum + area, 0) * 100) / 100 : null);
  const childCount = classes.reduce((sum, item) => sum + item.child_count, 0);
  return {
    // Tên trường là tên Trường chính ở cây đơn vị; mã trường là mã định danh ở hồ sơ trường, chưa nhập thì mã đơn vị
    // (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
    school_name: root.name,
    school_code: toText(general.moet_code) ?? root.code,
    ownership_type: toText(general.ownership_type),
    education_level: EDUCATION_LEVEL,
    national_standard_year: toYear(general.national_standard_year),
    national_standard_date: toText(general.national_standard_date),
    national_standard_level: toText(general.national_standard_level),
    accreditation_year: toYear(general.accreditation_year),
    accreditation_date: toText(general.accreditation_date),
    accreditation_level: toText(general.accreditation_level),
    national_standard_registration: toText(general.national_standard_registration),
    class_count: classes.length,
    classroom_count: rooms.filter((room) => CLASSROOM_TYPES.includes(room.room_type ?? '')).length,
    subject_room_count: rooms.filter((room) => SUBJECT_ROOM_TYPES.includes(room.room_type ?? '')).length,
    land_area_m2: landArea,
    floor_area_m2: floorArea,
    child_count: childCount,
    area_per_child_m2: areaPerChild(landArea, childCount),
    floor_area_per_child_m2: areaPerChild(floorArea, childCount),
  };
}

@Controller('accreditation-review')
export class AccreditationReviewController {
  constructor(private readonly reviews: AccreditationReviewService) {}

  @Get()
  @RequirePermission(...VIEW)
  read(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.reviews.read(currentUser);
  }

  @Post('collect')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  collect(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.reviews.collect(currentUser);
  }

  @Put()
  @RequirePermission(MANAGE)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readAccreditationInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reviews.save(currentUser, input, body?.collected === true, originOf(request, currentUser));
  }
}

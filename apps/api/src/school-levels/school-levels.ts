import { Body, Controller, Get, Injectable, Put, Req } from '@nestjs/common';
import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  isSchoolLevelCode,
  PERMISSION_CODES,
  SCHOOL_LEVEL_CODES,
  type SchoolLevelCode,
  type SchoolLevelView,
} from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import type { RequestBody } from '../common/request-fields.js';
import { SchoolLevelResolver } from '../common/school-levels.js';

// Cấp học của trường ở 1.4 Cấu hình trường (DT-19 phần 19a, YCTD-151): bật, tắt, thứ tự, tên hiển thị, thuật ngữ gọi
// người học, nhãn ô ngữ cảnh của bốn cấp cố định. Mọi người đã đăng nhập đọc được; Hiệu trưởng (P01.school-level.manage)
// sửa. Cấp không bao giờ bị xóa: tắt cấp chỉ ẩn, lớp và học sinh của cấp giữ nguyên (BR-154). Nhật ký thao tác ghi vào cơ sở
// dữ liệu năm học đang dùng nếu có, như thông báo hệ thống
const MAXIMUM_NAME = 100;
const MAXIMUM_TERM = 50;
const MAXIMUM_LABEL = 30;
const AUDIT_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

export interface SchoolLevelInput {
  code: SchoolLevelCode;
  is_enabled: boolean;
  order_no: number;
  display_name: string;
  learner_term: string;
  context_label: string;
}

function readText(item: Record<string, unknown>, field: string, maximum: number, prefix: string, errors: FieldError[]) {
  const value = item[field];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field: `${prefix}.${field}`, message: 'Bắt buộc nhập' });
    return '';
  }
  const text = value.trim();
  if (text.length > maximum) {
    errors.push({ field: `${prefix}.${field}`, message: `Tối đa ${maximum} ký tự` });
  }
  return text;
}

// Gửi đủ bốn cấp, mỗi cấp một lần; thứ tự là số nguyên 1 đến 99, không trùng
export function parseSchoolLevelsInput(body: RequestBody): SchoolLevelInput[] {
  const raw = body?.levels;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'levels', message: 'Cần danh sách cấp học' }]);
  }
  const errors: FieldError[] = [];
  const levels: SchoolLevelInput[] = [];
  raw.forEach((value, index) => {
    const prefix = `levels[${index}]`;
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    if (!isSchoolLevelCode(item.code)) {
      errors.push({ field: `${prefix}.code`, message: 'Mã cấp là MN, TH, THCS hoặc THPT' });
      return;
    }
    if (typeof item.is_enabled !== 'boolean') {
      errors.push({ field: `${prefix}.is_enabled`, message: 'Bật hoặc tắt' });
    }
    const order = item.order_no;
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 1 || order > 99) {
      errors.push({ field: `${prefix}.order_no`, message: 'Thứ tự là số nguyên từ 1 đến 99' });
    }
    levels.push({
      code: item.code,
      is_enabled: item.is_enabled === true,
      order_no: typeof order === 'number' ? order : 0,
      display_name: readText(item, 'display_name', MAXIMUM_NAME, prefix, errors),
      learner_term: readText(item, 'learner_term', MAXIMUM_TERM, prefix, errors),
      context_label: readText(item, 'context_label', MAXIMUM_LABEL, prefix, errors),
    });
  });
  const codes = levels.map((level) => level.code);
  if (errors.length === 0 && (codes.length !== SCHOOL_LEVEL_CODES.length || new Set(codes).size !== codes.length)) {
    errors.push({ field: 'levels', message: 'Gửi đủ bốn cấp MN, TH, THCS, THPT, mỗi cấp một lần' });
  }
  const orders = levels.map((level) => level.order_no);
  if (errors.length === 0 && new Set(orders).size !== orders.length) {
    errors.push({ field: 'levels', message: 'Thứ tự các cấp không được trùng' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  if (!levels.some((level) => level.is_enabled)) {
    throw ruleViolationError('BR-154', 'Trường phải bật ít nhất một cấp học');
  }
  return levels;
}

export interface SchoolLevelListItem extends SchoolLevelView {
  class_count: number;
}

@Injectable()
export class SchoolLevelsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly resolver: SchoolLevelResolver,
  ) {}

  // Số lớp của năm học đang dùng theo cấp để cảnh báo trước khi tắt; cấp của lớp theo khối (phần 19b, YCTD-152)
  private async classCounts(): Promise<Map<SchoolLevelCode, number>> {
    const counts = new Map<SchoolLevelCode, number>();
    const current = await this.currentSchoolYear.find();
    if (current) {
      const rows = await current.database
        .selectFrom('classes')
        .select(['school_level', (builder) => builder.fn.countAll<string>().as('total')])
        .groupBy('school_level')
        .execute();
      for (const row of rows) {
        counts.set(row.school_level, Number(row.total));
      }
    }
    return counts;
  }

  async list(currentUser: CurrentUser): Promise<{ levels: SchoolLevelListItem[]; user_levels: SchoolLevelCode[] }> {
    const [levels, counts, userLevels] = await Promise.all([
      this.resolver.all(),
      this.classCounts(),
      this.resolver.forUser(currentUser),
    ]);
    return {
      levels: levels.map((level) => ({ ...level, class_count: counts.get(level.code) ?? 0 })),
      user_levels: userLevels,
    };
  }

  async update(currentUser: CurrentUser, input: SchoolLevelInput[], origin: ChangeOrigin) {
    const before = await this.resolver.all();
    await this.databases.system.transaction().execute(async (transaction) => {
      for (const level of input) {
        await transaction
          .insertInto('school_levels')
          .values({ ...level, updated_by_name: origin.actorName, updated_at: new Date() })
          .onConflict((conflict) =>
            conflict.column('code').doUpdateSet({
              is_enabled: level.is_enabled,
              order_no: level.order_no,
              display_name: level.display_name,
              learner_term: level.learner_term,
              context_label: level.context_label,
              updated_by_name: origin.actorName,
              updated_at: new Date(),
            }),
          )
          .execute();
      }
    });
    this.resolver.invalidate();
    const after = await this.resolver.all();
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'school_levels',
        entityId: AUDIT_ENTITY_ID,
        action: 'update',
        before,
        after,
      });
    }
    return this.list(currentUser);
  }
}

@Controller('school-levels')
export class SchoolLevelsController {
  constructor(private readonly schoolLevels: SchoolLevelsService) {}

  @Get()
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.schoolLevels.list(currentUser);
  }

  @Put()
  @RequirePermission(PERMISSION_CODES.schoolLevelManage)
  update(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.schoolLevels.update(currentUser, parseSchoolLevelsInput(body), originOf(request, currentUser));
  }
}

import { Body, Controller, Get, HttpCode, Injectable, Post, Put, Req, Res } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  FACILITY_INVESTMENT_CATEGORIES,
  PERMISSION_CODES,
  type FacilityInvestmentCategoryCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import type { RequestBody } from '../common/request-fields.js';
import { readTableFileFormat, type TableFileFormat } from '../exports/table-file.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from './facilities-workbook.js';
import { investmentSuggestions } from './facility-report-calc.js';

// 6.1 Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ (khảo sát mục 3.6; DT-16 phần 16i, YCTD-128): toàn trường, mỗi
// chỉ tiêu (phòng học, nhà công vụ cho giáo viên) một dòng gồm thực trạng (kiên cố, bán kiên cố, cấp 4 xuống cấp, nhờ mượn)
// và nhu cầu đầu tư (số lớp, số phòng, kinh phí triệu đồng). "Lấy số liệu từ khai báo phòng" điền thực trạng theo phòng đang
// dùng của loại phòng ứng với chỉ tiêu; người nhập sửa lại rồi Ghi. Xem theo quyền báo cáo cơ sở vật chất toàn trường,
// ghi cần quyền cập nhật hồ sơ trường ở phạm vi toàn trường
const VIEW = [PERMISSION_CODES.facilitiesReport, PERMISSION_CODES.schoolProfileManage];
const MANAGE = PERMISSION_CODES.schoolProfileManage;
const MAXIMUM_COUNT = 100_000;
const MAXIMUM_BUDGET = 1_000_000_000;
const MAXIMUM_NOTE = 500;
const COUNT_FIELDS = [
  'permanent',
  'semi_permanent',
  'degraded_level4',
  'borrowed',
  'need_classes',
  'need_rooms',
] as const;

export interface InvestmentInput {
  category: FacilityInvestmentCategoryCode;
  permanent: number | null;
  semi_permanent: number | null;
  degraded_level4: number | null;
  borrowed: number | null;
  need_classes: number | null;
  need_rooms: number | null;
  need_budget_million: number | null;
  note: string | null;
}

export function readInvestments(body: RequestBody, errors: FieldError[]): InvestmentInput[] {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ field: 'items', message: 'Nhập số liệu của ít nhất một chỉ tiêu' });
    return [];
  }
  const result: InvestmentInput[] = [];
  items.forEach((raw: unknown, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const prefix = `items.${index}`;
    const before = errors.length;
    if (!FACILITY_INVESTMENT_CATEGORIES.some((category) => category.value === item.category)) {
      errors.push({ field: `${prefix}.category`, message: 'Chỉ tiêu không hợp lệ' });
      return;
    }
    if (result.some((other) => other.category === item.category)) {
      errors.push({ field: `${prefix}.category`, message: 'Chỉ tiêu bị lặp' });
      return;
    }
    const counts: Partial<Record<(typeof COUNT_FIELDS)[number], number | null>> = {};
    for (const field of COUNT_FIELDS) {
      const value = item[field];
      if (value === undefined || value === null || value === '') {
        counts[field] = null;
      } else if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAXIMUM_COUNT) {
        errors.push({ field: `${prefix}.${field}`, message: 'Phải là số nguyên không âm' });
      } else {
        counts[field] = value;
      }
    }
    let budget: number | null = null;
    const rawBudget = item.need_budget_million;
    if (rawBudget !== undefined && rawBudget !== null && rawBudget !== '') {
      if (typeof rawBudget !== 'number' || !Number.isFinite(rawBudget) || rawBudget < 0 || rawBudget > MAXIMUM_BUDGET) {
        errors.push({ field: `${prefix}.need_budget_million`, message: 'Kinh phí là số không âm (triệu đồng)' });
      } else {
        budget = Math.round(rawBudget * 100) / 100;
      }
    }
    let note: string | null = null;
    if (item.note !== undefined && item.note !== null) {
      if (typeof item.note !== 'string') {
        errors.push({ field: `${prefix}.note`, message: 'Ghi chú phải là chữ' });
      } else {
        note = item.note.trim() || null;
        if (note && note.length > MAXIMUM_NOTE) {
          errors.push({ field: `${prefix}.note`, message: `Ghi chú tối đa ${MAXIMUM_NOTE} ký tự` });
        }
      }
    }
    if (errors.length > before) {
      return;
    }
    result.push({
      category: item.category as FacilityInvestmentCategoryCode,
      permanent: counts.permanent ?? null,
      semi_permanent: counts.semi_permanent ?? null,
      degraded_level4: counts.degraded_level4 ?? null,
      borrowed: counts.borrowed ?? null,
      need_classes: counts.need_classes ?? null,
      need_rooms: counts.need_rooms ?? null,
      need_budget_million: budget,
      note,
    });
  });
  return result;
}

@Injectable()
export class FacilityInvestmentsService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser) {
    await this.data.assertWholeSchool(
      currentUser,
      VIEW,
      'Thực trạng và nhu cầu đầu tư lập cho toàn trường, cần phạm vi toàn trường',
    );
    const current = await this.currentSchoolYear.require();
    const database = current.database;
    const root = await this.data.root(database);
    const [year, saved, rooms, classes] = await Promise.all([
      this.databases.system
        .selectFrom('academic_years')
        .select('name')
        .where('id', '=', current.academicYearId)
        .executeTakeFirstOrThrow(),
      database.selectFrom('facility_investments').selectAll().where('org_unit_id', '=', root.id).execute(),
      database
        .selectFrom('rooms')
        .select(['room_block', 'room_type', 'condition', 'area_m2', 'status', 'facility_attributes'])
        .execute(),
      database.selectFrom('classes').select(['id', 'room_id']).where('status', '=', 'active').execute(),
    ]);
    const suggestions = investmentSuggestions(
      rooms.map((room) => ({ ...room, area_m2: room.area_m2 === null ? null : Number(room.area_m2) })),
    );
    const items = FACILITY_INVESTMENT_CATEGORIES.map((category) => {
      const row = saved.find((item) => item.category === category.value);
      return {
        category: category.value,
        label: category.label,
        permanent: row?.permanent ?? null,
        semi_permanent: row?.semi_permanent ?? null,
        degraded_level4: row?.degraded_level4 ?? null,
        borrowed: row?.borrowed ?? null,
        need_classes: row?.need_classes ?? null,
        need_rooms: row?.need_rooms ?? null,
        need_budget_million: row?.need_budget_million === null || !row ? null : Number(row.need_budget_million),
        note: row?.note ?? null,
        updated_at: row?.updated_at ?? null,
        suggestion: suggestions.find((item) => item.category === category.value) ?? null,
      };
    });
    return {
      school_name: root.name,
      academic_year: year.name,
      class_count: classes.length,
      classes_without_room: classes.filter((row) => row.room_id === null).length,
      can_manage: currentUser.hasPermission(MANAGE),
      items,
    };
  }

  async save(currentUser: CurrentUser, items: InvestmentInput[], origin: ChangeOrigin) {
    await this.data.assertWholeSchool(
      currentUser,
      [MANAGE],
      'Thực trạng và nhu cầu đầu tư ghi cho toàn trường, cần quyền cập nhật hồ sơ trường ở phạm vi toàn trường',
    );
    const database = await this.data.database();
    const root = await this.data.root(database);
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const before = await transaction
          .selectFrom('facility_investments')
          .selectAll()
          .where('org_unit_id', '=', root.id)
          .where('category', '=', item.category)
          .executeTakeFirst();
        const { category, ...values } = item;
        const saved = await transaction
          .insertInto('facility_investments')
          .values({ org_unit_id: root.id, category, ...values, updated_by: currentUser.id })
          .onConflict((conflict) =>
            conflict
              .columns(['org_unit_id', 'category'])
              .doUpdateSet({ ...values, updated_by: currentUser.id, updated_at: this.clock.now() }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: root.id,
          entityName: 'facility_investments',
          entityId: saved.id,
          action: before ? 'update' : 'create',
          before: before ?? null,
          after: saved,
        });
      }
    });
    return this.list(currentUser);
  }

  async export(currentUser: CurrentUser, ipAddress: string | null, format: TableFileFormat) {
    const result = await this.list(currentUser);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'facility-investments',
      fileName: `thuc-trang-nhu-cau-dau-tu-${fileStamp(createdAt)}.xlsx`,
      filters: {},
      orgUnitIds: [],
      ipAddress,
      createdAt,
      format,
      sheets: [
        {
          title: 'Thực trạng, nhu cầu',
          heading: [
            '6.1 Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ',
            `${result.school_name}, năm học ${result.academic_year}`,
          ],
          columns: [
            { key: 'label', label: 'Chỉ tiêu', width: 32 },
            { key: 'permanent', label: 'Kiên cố' },
            { key: 'semi_permanent', label: 'Bán kiên cố' },
            { key: 'degraded_level4', label: 'Cấp 4 xuống cấp' },
            { key: 'borrowed', label: 'Nhờ, mượn' },
            { key: 'need_classes', label: 'Nhu cầu: số lớp' },
            { key: 'need_rooms', label: 'Nhu cầu: số phòng' },
            { key: 'need_budget_million', label: 'Nhu cầu: kinh phí (triệu đồng)' },
            { key: 'note', label: 'Ghi chú', width: 32 },
          ],
          rows: result.items.map((item) => ({ ...item, suggestion: undefined })),
        },
      ],
    });
  }
}

@Controller('facilities/investments')
export class FacilityInvestmentsController {
  constructor(private readonly investments: FacilityInvestmentsService) {}

  @Get()
  @RequirePermission(...VIEW)
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.investments.list(currentUser);
  }

  @Put()
  @RequirePermission(MANAGE)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const items = readInvestments(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.investments.save(currentUser, items, originOf(request, currentUser));
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
    const format = readTableFileFormat(body?.format);
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(response, await this.investments.export(currentUser, request.ip ?? null, format));
  }
}

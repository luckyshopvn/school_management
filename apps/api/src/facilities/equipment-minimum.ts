import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  EQUIPMENT_AGE_GROUPS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_SCHOOL_LEVELS,
  PERMISSION_CODES,
  type EquipmentSchoolLevel,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { buildEquipmentReport } from './equipment-report-calc.js';
import { compareMinimum, type ComparisonStatus } from './equipment-stocktake-calc.js';
import { EQUIPMENT_TEMPLATES } from './equipment-templates.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from './facilities-workbook.js';

// Đối sánh danh mục thiết bị tối thiểu theo cấp học (DT-18 phần 18g, YCTD-143):
// - danh mục của trường là cấu hình (bảng equipment_items, cột cấp học); "Nạp danh mục mẫu" thêm các dòng của mẫu có mã chưa
//   có, không sửa dòng đã có; có thể ngừng dùng các thiết bị gieo sẵn tạm thời của phần 14d (mã NT…, MG…) chưa có số hiện
//   có, tài sản gắn, để tổng hợp không đếm hai lần;
// - đối sánh theo đơn vị và cấp học: định mức và hiện có tính như 2.1 Tổng hợp thiết bị dạy học (BR-102); thiết bị đủ định
//   mức là "Đủ", có nhưng chưa đủ là "Thiếu", chưa có là "Chưa có"; nhóm tuổi không có lớp thì không áp dụng
const MANAGE = PERMISSION_CODES.equipmentManage;
const REPORT = PERMISSION_CODES.facilitiesReport;

const STATUS_LABELS: Record<ComparisonStatus, string> = { enough: 'Đủ', short: 'Thiếu', none: 'Chưa có' };

const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? value ?? '';

function readLevel(value: unknown, errors: FieldError[]): EquipmentSchoolLevel {
  if (value === undefined || value === null || value === '') {
    return 'MN';
  }
  if (typeof value !== 'string' || !EQUIPMENT_SCHOOL_LEVELS.some((item) => item.value === value)) {
    errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    return 'MN';
  }
  return value as EquipmentSchoolLevel;
}

export interface ComparisonFilter {
  orgUnitId: string | null;
  schoolLevel: EquipmentSchoolLevel;
  status: ComparisonStatus | null;
}

export function readComparisonFilter(query: Record<string, unknown>): ComparisonFilter {
  const errors: FieldError[] = [];
  const orgUnitId = query.org_unit_id ? query.org_unit_id : null;
  if (orgUnitId !== null && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const status = query.status ? query.status : null;
  if (status !== null && status !== 'enough' && status !== 'short' && status !== 'none') {
    errors.push({ field: 'status', message: 'Kết quả là enough, short hoặc none' });
  }
  const schoolLevel = readLevel(query.school_level, errors);
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { orgUnitId: orgUnitId as string | null, schoolLevel, status: status as ComparisonStatus | null };
}

@Injectable()
export class EquipmentMinimumService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  async templates(currentUser: CurrentUser) {
    await this.data.units(currentUser, [MANAGE, REPORT], null);
    const database = await this.data.database();
    const codes = new Set(
      (await database.selectFrom('equipment_items').select('code').execute()).map((row) => row.code),
    );
    return EQUIPMENT_TEMPLATES.map((template) => ({
      code: template.code,
      school_level: template.school_level,
      title: template.title,
      source: template.source,
      item_count: template.items.length,
      loaded_count: template.items.filter((item) => codes.has(item.code)).length,
    }));
  }

  async load(currentUser: CurrentUser, templateCode: string, retirePlaceholders: boolean, origin: ChangeOrigin) {
    await this.data.assertWholeSchool(
      currentUser,
      [MANAGE],
      'Chỉ người quản lý thiết bị toàn trường nạp được danh mục mẫu',
    );
    const template = EQUIPMENT_TEMPLATES.find((item) => item.code === templateCode);
    if (!template) {
      throw notFoundError('Không có danh mục mẫu này', 'equipment_template');
    }
    const database = await this.data.database();
    return database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (await transaction.selectFrom('equipment_items').select('code').execute()).map((row) => row.code),
      );
      const last = await transaction
        .selectFrom('equipment_items')
        .select(sql<number>`coalesce(max(order_no), 0)`.as('order_no'))
        .executeTakeFirstOrThrow();
      let order = Number(last.order_no);
      let added = 0;
      for (const item of template.items) {
        if (existing.has(item.code)) {
          continue;
        }
        order += 1;
        const created = await transaction
          .insertInto('equipment_items')
          .values({
            ...item,
            development_area: null,
            norm_basis: 'class',
            is_minimum: true,
            is_seeded: true,
            order_no: order,
            school_level: template.school_level,
            template_code: template.code,
            note: item.note ?? `Theo ${template.source}`,
            created_by: origin.actorUserId,
          })
          .returning(['id', 'code', 'name', 'age_group', 'quantity', 'template_code'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'equipment_items',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        added += 1;
      }
      let retired = 0;
      if (retirePlaceholders) {
        // Dòng gieo sẵn tạm thời của phần 14d: is_seeded, chưa có mã mẫu, chưa có số hiện có hay tài sản gắn
        const placeholders = await transaction
          .selectFrom('equipment_items')
          .select('id')
          .where('is_seeded', '=', true)
          .where('template_code', 'is', null)
          .where('status', '=', 'active')
          .where('school_level', '=', template.school_level)
          .where(({ not, exists, selectFrom }) =>
            not(
              exists(
                selectFrom('equipment_holdings')
                  .select('equipment_holdings.id')
                  .whereRef('equipment_holdings.equipment_item_id', '=', 'equipment_items.id')
                  .where('equipment_holdings.quantity', '>', '0'),
              ),
            ),
          )
          .where(({ not, exists, selectFrom }) =>
            not(
              exists(
                selectFrom('assets')
                  .select('assets.id')
                  .whereRef('assets.equipment_item_id', '=', 'equipment_items.id'),
              ),
            ),
          )
          .execute();
        for (const placeholder of placeholders) {
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: null,
            entityName: 'equipment_items',
            entityId: placeholder.id,
            action: 'update',
            before: { status: 'active' },
            after: { status: 'inactive', template_code: template.code },
          });
        }
        if (placeholders.length > 0) {
          await transaction
            .updateTable('equipment_items')
            .set({ status: 'inactive', updated_at: this.clock.now() })
            .where(
              'id',
              'in',
              placeholders.map((row) => row.id),
            )
            .execute();
        }
        retired = placeholders.length;
      }
      return { template_code: template.code, added, existing: template.items.length - added, retired };
    });
  }

  async compare(currentUser: CurrentUser, filter: ComparisonFilter) {
    const unitIds = await this.data.units(currentUser, [REPORT, MANAGE], filter.orgUnitId);
    const database = await this.data.database();
    const [classes, allItems, levels, holdings, assets] = await Promise.all([
      this.data.classes(database, unitIds),
      this.data.items(database),
      database.selectFrom('equipment_items').select(['id', 'school_level']).execute(),
      this.data.holdings(database, unitIds),
      this.data.assets(database, unitIds),
    ]);
    const levelOf = new Map(levels.map((row) => [row.id, row.school_level]));
    const items = allItems.filter((item) => item.is_minimum && levelOf.get(item.id) === filter.schoolLevel);
    const comparison = compareMinimum(
      buildEquipmentReport({ items, classes, holdings, assets, classId: null }).rows,
    );
    return {
      org_unit_ids: unitIds,
      school_level: filter.schoolLevel,
      catalog_count: items.length,
      not_applicable_count: items.length - comparison.rows.length,
      unclassified_classes: classes.filter((row) => row.age_group === null).map((row) => row.name),
      rows: filter.status ? comparison.rows.filter((row) => row.status === filter.status) : comparison.rows,
      totals: comparison.totals,
    };
  }

  async export(currentUser: CurrentUser, filter: ComparisonFilter, format: 'xlsx' | 'pdf', ipAddress: string | null) {
    const report = await this.compare(currentUser, filter);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'equipment-minimum',
      fileName: `doi-sanh-danh-muc-toi-thieu-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: report.org_unit_ids,
      ipAddress,
      createdAt,
      format,
      sheets: [
        {
          title: 'Đối sánh danh mục tối thiểu',
          heading: [
            '2.6 Đối sánh danh mục thiết bị tối thiểu',
            `Cấp học: ${labelOf(EQUIPMENT_SCHOOL_LEVELS, report.school_level)}; đủ ${report.totals.enough}, thiếu ${report.totals.short}, chưa có ${report.totals.none} trên ${report.totals.item_count} thiết bị áp dụng (${report.totals.rate_percent ?? 0}% đủ)`,
          ],
          columns: [
            { key: 'code', label: 'Mã', width: 12 },
            { key: 'name', label: 'Tên thiết bị', width: 40 },
            { key: 'unit', label: 'Đơn vị tính', width: 10 },
            { key: 'age_group', label: 'Nhóm tuổi', width: 20 },
            { key: 'equipment_group', label: 'Nhóm thiết bị', width: 24 },
            { key: 'norm', label: 'Định mức tối thiểu' },
            { key: 'available', label: 'Hiện có' },
            { key: 'shortage', label: 'Thiếu' },
            { key: 'status', label: 'Kết quả', width: 12 },
          ],
          rows: report.rows.map((row) => ({
            ...row,
            age_group: labelOf(EQUIPMENT_AGE_GROUPS, row.age_group),
            equipment_group: labelOf(EQUIPMENT_GROUPS, row.equipment_group),
            status: STATUS_LABELS[row.status],
          })),
        },
      ],
    });
  }
}

@Controller()
export class EquipmentMinimumController {
  constructor(private readonly minimum: EquipmentMinimumService) {}

  @Get('equipment-templates')
  @RequirePermission(MANAGE, REPORT)
  templates(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.minimum.templates(currentUser);
  }

  @Post('equipment-templates/:code/load')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  load(
    @Param('code') code: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const retire = body?.retire_placeholders;
    if (retire !== undefined && typeof retire !== 'boolean') {
      throw validationError([{ field: 'retire_placeholders', message: 'Phải là có hoặc không' }]);
    }
    return this.minimum.load(currentUser, code, retire === true, originOf(request, currentUser));
  }

  @Get('equipment-minimum')
  @RequirePermission(REPORT, MANAGE)
  compare(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.minimum.compare(currentUser, readComparisonFilter(query));
  }

  @Post('equipment-minimum/export')
  @HttpCode(200)
  @RequirePermission(REPORT, MANAGE)
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
    const file = await this.minimum.export(currentUser, readComparisonFilter(body ?? {}), format, request.ip ?? null);
    sendWorkbook(response, file);
  }
}

import { Body, Controller, Get, HttpCode, Injectable, Put, Post, Query, Req, Res } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  FACILITY_STANDARD_LEVELS,
  PERMISSION_CODES,
  ROOM_BLOCKS,
  type FacilityStandardLevelCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { readTableFileFormat, type TableFileFormat } from '../exports/table-file.js';
import { UpperLevelForms } from '../submissions/upper-level-submissions.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook, type WorkbookSheet } from './facilities-workbook.js';
import {
  buildFacilityFigures,
  buildToiletFigures,
  overallStandardLevel,
  standardLevelLabel,
  type ReportRoom,
} from './facility-report-calc.js';

// 1.2 Báo cáo cơ sở vật chất (khảo sát mục 4, dòng 1.2; DT-16 phần 16i, YCTD-128): lập báo cáo số liệu phòng theo khối,
// loại phòng và hiện trạng (tổng số, kiên cố, bán kiên cố, tạm, nhờ mượn thuê, diện tích), thẻ nhà vệ sinh, tổng hợp mức độ
// đạt chuẩn theo từng khối phòng (Hiệu trưởng đánh giá, mức của trường là mức thấp nhất); xuất Excel, PDF; gửi lên cấp trên
// theo mẫu chạy nội bộ của 16a: Xuất tệp gửi, nộp bằng tay, Đánh dấu đã gửi. Xem theo phạm vi của quyền báo cáo cơ sở vật
// chất; đánh giá mức độ đạt chuẩn và gửi lập cho toàn trường
const VIEW = [PERMISSION_CODES.facilitiesReport, PERMISSION_CODES.schoolProfileManage];
const MANAGE = PERMISSION_CODES.schoolProfileManage;
export const FACILITIES_REPORT_FORM = 'facilities-report';
const MAXIMUM_NOTE = 500;

export interface StandardLevelInput {
  room_block: string;
  level: FacilityStandardLevelCode;
  note: string | null;
}

export function readStandardLevels(body: RequestBody, errors: FieldError[]): StandardLevelInput[] {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ field: 'items', message: 'Chọn mức độ đạt chuẩn của ít nhất một khối phòng' });
    return [];
  }
  const result: StandardLevelInput[] = [];
  items.forEach((raw: unknown, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const prefix = `items.${index}`;
    if (!ROOM_BLOCKS.some((block) => block.value === item.room_block)) {
      errors.push({ field: `${prefix}.room_block`, message: 'Khối phòng không hợp lệ' });
      return;
    }
    if (result.some((other) => other.room_block === item.room_block)) {
      errors.push({ field: `${prefix}.room_block`, message: 'Khối phòng bị lặp' });
      return;
    }
    if (!FACILITY_STANDARD_LEVELS.some((level) => level.value === item.level)) {
      errors.push({
        field: `${prefix}.level`,
        message: `Mức độ là ${FACILITY_STANDARD_LEVELS.map((level) => level.value).join(', ')}`,
      });
      return;
    }
    const note = typeof item.note === 'string' ? item.note.trim() || null : null;
    if (item.note !== undefined && item.note !== null && typeof item.note !== 'string') {
      errors.push({ field: `${prefix}.note`, message: 'Ghi chú phải là chữ' });
      return;
    }
    if (note && note.length > MAXIMUM_NOTE) {
      errors.push({ field: `${prefix}.note`, message: `Ghi chú tối đa ${MAXIMUM_NOTE} ký tự` });
      return;
    }
    result.push({ room_block: item.room_block as string, level: item.level as FacilityStandardLevelCode, note });
  });
  return result;
}

@Injectable()
export class FacilityReportService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly clock: Clock,
    forms: UpperLevelForms,
  ) {
    forms.register({
      code: FACILITIES_REPORT_FORM,
      name: '1.2 Báo cáo cơ sở vật chất',
      permission: PERMISSION_CODES.facilitiesReport,
      unlockPermission: PERMISSION_CODES.schoolProfileManage,
      completeness: async (currentUser) => {
        const report = await this.wholeSchoolReport(currentUser);
        return report.completeness;
      },
      snapshot: async (currentUser, ipAddress) => {
        const report = await this.wholeSchoolReport(currentUser);
        return { file: await this.export(currentUser, null, ipAddress, 'xlsx', report), data: report };
      },
    });
  }

  private async wholeSchoolReport(currentUser: CurrentUser) {
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION_CODES.facilitiesReport],
      'Báo cáo cơ sở vật chất gửi lên cấp trên lập cho toàn trường, cần phạm vi toàn trường',
    );
    return this.report(currentUser, null);
  }

  async report(currentUser: CurrentUser, orgUnitId: string | null) {
    const unitIds = await this.data.units(currentUser, VIEW, orgUnitId);
    const current = await this.currentSchoolYear.require();
    const database = current.database;
    const root = await this.data.root(database);
    const [year, rows, levels, classes, roomClasses] = await Promise.all([
      this.databases.system
        .selectFrom('academic_years')
        .select('name')
        .where('id', '=', current.academicYearId)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('rooms')
        .select(['id', 'room_block', 'room_type', 'condition', 'area_m2', 'status', 'facility_attributes'])
        .where('org_unit_id', 'in', unitIds)
        .execute(),
      database
        .selectFrom('facility_standard_levels')
        .select(['room_block', 'level', 'note', 'updated_at'])
        .where('org_unit_id', '=', root.id)
        .execute(),
      this.data.classes(database, unitIds),
      database
        .selectFrom('classes')
        .select(['id', 'room_id'])
        .where('status', '=', 'active')
        .where('org_unit_id', 'in', unitIds)
        .execute(),
    ]);
    const rooms: Array<ReportRoom & { id: string }> = rows.map((row) => ({
      ...row,
      area_m2: row.area_m2 === null ? null : Number(row.area_m2),
    }));
    const active = rooms.filter((room) => room.status === 'active');
    const figures = buildFacilityFigures(rooms);
    const toilets = buildToiletFigures(rooms);
    // Gợi ý cho từng khối: số phòng, diện tích; khối nuôi dưỡng, chăm sóc, giáo dục thêm số nhóm, lớp có phòng riêng và
    // diện tích phòng sinh hoạt chung bình quân một học sinh
    const careRoomIds = new Set(
      active.filter((room) => room.room_block === 'care_education' && room.room_type === 'group_room').map((r) => r.id),
    );
    const childCount = classes.reduce((sum, row) => sum + row.child_count, 0);
    const groupArea = active
      .filter((room) => careRoomIds.has(room.id))
      .reduce((sum, room) => sum + (room.area_m2 ?? 0), 0);
    const standard = ROOM_BLOCKS.map((block) => {
      const saved = levels.find((item) => item.room_block === block.value);
      const blockRow = figures.find((row) => row.key === block.value);
      const hints = [`${blockRow?.total ?? 0} phòng đang dùng, ${blockRow?.area_m2 ?? 0} m²`];
      if (block.value === 'care_education') {
        const withRoom = roomClasses.filter((row) => row.room_id !== null && careRoomIds.has(row.room_id)).length;
        hints.push(`${withRoom}/${roomClasses.length} nhóm, lớp có phòng sinh hoạt chung riêng`);
        if (childCount > 0) {
          hints.push(`Phòng sinh hoạt chung bình quân ${Math.round((groupArea / childCount) * 100) / 100} m²/học sinh`);
        }
      }
      return {
        room_block: block.value,
        label: block.label,
        level: (saved?.level ?? null) as FacilityStandardLevelCode | null,
        level_label: standardLevelLabel(saved?.level ?? null),
        note: saved?.note ?? null,
        updated_at: saved?.updated_at ?? null,
        hints,
      };
    });
    const overall = overallStandardLevel(levels);
    const toiletRooms = active.filter((room) => room.room_type === 'toilet');
    const completeness = [
      {
        label: 'Mọi phòng đang dùng đã chọn khối phòng và loại phòng',
        done: active.every((room) => room.room_block !== null && room.room_type !== null),
      },
      {
        label: 'Mọi phòng đang dùng đã khai báo hiện trạng và diện tích',
        done: active.every((room) => room.condition !== null && room.area_m2 !== null),
      },
      {
        label: 'Phòng vệ sinh đã khai báo đối tượng sử dụng và tình trạng đạt chuẩn',
        done: toiletRooms.every(
          (room) =>
            room.facility_attributes.toilet_users !== undefined && room.facility_attributes.toilet_standard !== undefined,
        ),
      },
      { label: 'Đã đánh giá mức độ đạt chuẩn của đủ năm khối phòng', done: overall !== null },
    ];
    return {
      school_name: root.name,
      academic_year: year.name,
      org_unit_ids: unitIds,
      whole_school: orgUnitId === null,
      figures,
      toilets,
      standard,
      overall_level: overall,
      overall_level_label: standardLevelLabel(overall),
      completeness,
    };
  }

  // Ghi mức độ đạt chuẩn của các khối phòng cho toàn trường (gắn với Trường chính)
  async saveLevels(currentUser: CurrentUser, items: StandardLevelInput[], origin: ChangeOrigin) {
    await this.data.assertWholeSchool(
      currentUser,
      [MANAGE],
      'Mức độ đạt chuẩn đánh giá cho toàn trường, cần quyền cập nhật hồ sơ trường ở phạm vi toàn trường',
    );
    const database = await this.data.database();
    const root = await this.data.root(database);
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const before = await transaction
          .selectFrom('facility_standard_levels')
          .select(['id', 'level', 'note'])
          .where('org_unit_id', '=', root.id)
          .where('room_block', '=', item.room_block)
          .executeTakeFirst();
        const saved = await transaction
          .insertInto('facility_standard_levels')
          .values({ org_unit_id: root.id, ...item, updated_by: currentUser.id })
          .onConflict((conflict) =>
            conflict.columns(['org_unit_id', 'room_block']).doUpdateSet({
              level: item.level,
              note: item.note,
              updated_by: currentUser.id,
              updated_at: this.clock.now(),
            }),
          )
          .returning(['id', 'room_block', 'level', 'note'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: root.id,
          entityName: 'facility_standard_levels',
          entityId: saved.id,
          action: before ? 'update' : 'create',
          before: before ?? null,
          after: saved,
        });
      }
    });
    return this.report(currentUser, null);
  }

  async export(
    currentUser: CurrentUser,
    orgUnitId: string | null,
    ipAddress: string | null,
    format: TableFileFormat = 'xlsx',
    prepared?: Awaited<ReturnType<FacilityReportService['report']>>,
  ) {
    const report = prepared ?? (await this.report(currentUser, orgUnitId));
    const database = await this.data.database();
    const createdAt = this.clock.now();
    const heading = (title: string) => [title, `${report.school_name}, năm học ${report.academic_year}`];
    const sheets: WorkbookSheet[] = [
      {
        title: 'Số liệu phòng',
        heading: heading('1.2 Báo cáo cơ sở vật chất – Số liệu phòng đang dùng'),
        columns: [
          { key: 'label', label: 'Chỉ tiêu', width: 48 },
          { key: 'total', label: 'Tổng số' },
          { key: 'permanent', label: 'Kiên cố' },
          { key: 'semi_permanent', label: 'Bán kiên cố' },
          { key: 'temporary', label: 'Tạm' },
          { key: 'borrowed', label: 'Nhờ, mượn, thuê' },
          { key: 'unspecified', label: 'Chưa khai báo hiện trạng' },
          { key: 'area_m2', label: 'Diện tích (m²)' },
        ],
        rows: report.figures as unknown as Array<Record<string, unknown>>,
      },
      {
        title: 'Nhà vệ sinh',
        heading: [
          ...heading('1.2 Báo cáo cơ sở vật chất – Nhà vệ sinh'),
          `Phòng sinh hoạt chung có vệ sinh khép kín: ${report.toilets.group_rooms_ensuite}, liền kề: ${report.toilets.group_rooms_adjacent} trên ${report.toilets.group_rooms} phòng`,
        ],
        columns: [
          { key: 'label', label: 'Chỉ tiêu', width: 48 },
          { key: 'rooms', label: 'Số phòng' },
          { key: 'met', label: 'Đạt chuẩn' },
          { key: 'not_met', label: 'Chưa đạt chuẩn' },
          { key: 'unassessed', label: 'Chưa đánh giá' },
          { key: 'separate_gender', label: 'Riêng nam, nữ' },
          { key: 'seats', label: 'Số chỗ' },
        ],
        rows: report.toilets.rows as unknown as Array<Record<string, unknown>>,
      },
      {
        title: 'Mức độ đạt chuẩn',
        heading: [
          ...heading('1.2 Báo cáo cơ sở vật chất – Mức độ đạt chuẩn'),
          `Mức độ đạt chuẩn của trường: ${report.overall_level_label}`,
          'Mức theo tiêu chuẩn cơ sở vật chất trường mầm non, cần đối chiếu văn bản hiện hành',
        ],
        columns: [
          { key: 'label', label: 'Khối phòng', width: 48 },
          { key: 'level_label', label: 'Mức độ đạt chuẩn', width: 16 },
          { key: 'hints', label: 'Số liệu tham khảo', width: 60 },
          { key: 'note', label: 'Ghi chú', width: 40 },
        ],
        rows: report.standard.map((row) => ({ ...row, hints: row.hints.join('; '), note: row.note ?? '' })),
      },
    ];
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: FACILITIES_REPORT_FORM,
      fileName: `bao-cao-co-so-vat-chat-${fileStamp(createdAt)}.xlsx`,
      filters: { org_unit_id: orgUnitId },
      orgUnitIds: report.org_unit_ids,
      ipAddress,
      createdAt,
      format,
      sheets,
    });
  }
}

function readOrgUnitQuery(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
  }
  return value;
}

@Controller('facilities/report')
export class FacilityReportController {
  constructor(private readonly reports: FacilityReportService) {}

  @Get()
  @RequirePermission(...VIEW)
  report(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.report(currentUser, readOrgUnitQuery(orgUnitId));
  }

  @Put('standard-levels')
  @RequirePermission(MANAGE)
  saveLevels(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const items = readStandardLevels(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reports.saveLevels(currentUser, items, originOf(request, currentUser));
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
    sendWorkbook(
      response,
      await this.reports.export(currentUser, readOrgUnitQuery(body?.org_unit_id), request.ip ?? null, format),
    );
  }
}

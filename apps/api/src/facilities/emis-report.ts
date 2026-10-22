import { Controller, Get, HttpCode, Injectable, Post, Req, Res } from '@nestjs/common';
import { Clock } from '@school-management/server';
import { PERMISSION_CODES, SCHOOL_OWNERSHIP_TYPES, type SchoolOwnershipType } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { childIdsOutsideLevel, classIdsOutsideLevel } from '../common/report-levels.js';
import { Databases } from '../common/databases.js';
import { buildEmisStartOfYear, type EmisChild, type EmisStaff } from './emis-calc.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from './facilities-workbook.js';

// Báo cáo EMIS đầu năm, Biểu 1 (khảo sát mục 5, dòng 1.1; YCTD-102): tính trên dữ liệu của năm học đang dùng, xem trên
// màn hình và xuất Excel. Từ DT-16 phần 16j màn hình 1.1 dựng bằng apps/api/src/emis/emis-forms.ts (thêm thẻ Ngân sách nhà
// nước nhập tay, gửi lên cấp trên chạy nội bộ); điểm cuối ở đây giữ cho tương thích. Cần phạm vi toàn trường theo quyền
// P17.report.emis
const PERMISSION = PERMISSION_CODES.emisReport;

const text = (profile: Record<string, unknown> | null, key: string): string | null => {
  const value = profile?.[key];
  return typeof value === 'string' ? value : null;
};

@Injectable()
export class EmisReportService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  async startOfYear(currentUser: CurrentUser) {
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION],
      'Báo cáo EMIS lập cho toàn trường, cần phạm vi toàn trường',
    );
    const current = await this.currentSchoolYear.require();
    const database = current.database;
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['name', 'start_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const startDate = year.start_date as unknown;
    const startYear =
      startDate instanceof Date
        ? startDate.getFullYear()
        : typeof startDate === 'string'
          ? Number(startDate.slice(0, 4))
          : Number(/\d{4}/.exec(year.name)?.[0] ?? this.clock.now().getFullYear());
    const root = await this.data.root(database);
    const units = await database
      .selectFrom('org_units')
      .select(['id', 'unit_type'])
      .where('status', '=', 'active')
      .execute();
    const unitIds = units.map((unit) => unit.id);
    const [profile, classes, children, staff, rooms] = await Promise.all([
      database.selectFrom('school_profiles').select('general').where('org_unit_id', '=', root.id).executeTakeFirst(),
      this.data.classes(database, unitIds),
      database
        .selectFrom('children')
        .leftJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .select([
          'children.id',
          'children.gender',
          'children.dob',
          'children.moet_profile',
          'class_enrollments.class_id',
        ])
        .where('children.status', '=', 'active')
        .execute(),
      database
        .selectFrom('staff')
        .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
        .select(['staff.gender', 'staff.moet_profile', 'job_titles.name as job_title'])
        .where('staff.status', '=', 'active')
        .execute(),
      database
        .selectFrom('rooms')
        .select(['room_type', 'condition', 'area_m2'])
        .where('status', '=', 'active')
        .execute(),
    ]);
    const ownershipValue = profile?.general?.ownership_type;
    const ownership = SCHOOL_OWNERSHIP_TYPES.some((type) => type.value === ownershipValue)
      ? (ownershipValue as SchoolOwnershipType)
      : null;
    const classAge = new Map(classes.map((row) => [row.id, row.age_group]));
    // Biểu mẫu EMIS Mầm non chỉ tính lớp và trẻ của cấp Mầm non (DT-19 phần 19d, YCTD-154)
    const [outsideClasses, outsideChildren] = await Promise.all([
      classIdsOutsideLevel(database, 'MN'),
      childIdsOutsideLevel(database, 'MN'),
    ]);
    const nurseryClasses = classes.filter((row) => !outsideClasses.has(row.id));
    const seen = new Set<string>();
    const emisChildren: EmisChild[] = [];
    for (const child of children) {
      if (seen.has(child.id) || outsideChildren.has(child.id)) {
        continue;
      }
      seen.add(child.id);
      const dob = child.dob as unknown;
      const birthYear = dob instanceof Date ? dob.getFullYear() : Number(String(dob).slice(0, 4));
      emisChildren.push({
        gender: child.gender,
        birth_year: birthYear,
        age_group: child.class_id ? (classAge.get(child.class_id) ?? null) : null,
        ethnicity: text(child.moet_profile, 'ethnicity'),
        disability: text(child.moet_profile, 'disability_type'),
      });
    }
    const emisStaff: EmisStaff[] = staff.map((member) => ({
      gender: member.gender,
      ethnicity: text(member.moet_profile, 'ethnicity'),
      position_group: text(member.moet_profile, 'position_group'),
      job_title: member.job_title,
      party_member: member.moet_profile?.party_member === true,
    }));
    const result = buildEmisStartOfYear({
      ownership,
      startYear,
      units,
      classes: nurseryClasses,
      children: emisChildren,
      staff: emisStaff,
      rooms: rooms.map((room) => ({ ...room, area_m2: room.area_m2 === null ? null : Number(room.area_m2) })),
    });
    return {
      school_name: root.name,
      academic_year: year.name,
      start_year: startYear,
      ownership,
      ...result,
    };
  }

  async export(currentUser: CurrentUser, ipAddress: string | null) {
    const report = await this.startOfYear(currentUser);
    const createdAt = this.clock.now();
    const database = await this.data.database();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'emis-start-of-year',
      fileName: `emis-dau-nam-${fileStamp(createdAt)}.xlsx`,
      filters: { form: 'start_of_year' },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: report.tabs.map((tab) => ({
        title: tab.label,
        heading: [
          `Báo cáo EMIS đầu năm – Biểu 1 – ${tab.label}`,
          `${report.school_name}, năm học ${report.academic_year}`,
          'Mã số, tên chỉ tiêu cần đối chiếu biểu mẫu chính thức',
        ],
        columns: [
          { key: 'label', label: 'Chỉ tiêu', width: 48 },
          { key: 'unit', label: 'Đơn vị', width: 12 },
          { key: 'code', label: 'Mã số', width: 8 },
          { key: 'total', label: 'Tổng số' },
          { key: 'public', label: 'Công lập' },
          { key: 'private', label: 'Tư thục' },
          { key: 'people_founded', label: 'Dân lập' },
          { key: 'female', label: 'Nữ' },
          { key: 'ethnic_minority', label: 'Dân tộc thiểu số' },
        ],
        rows: tab.rows as unknown as Array<Record<string, unknown>>,
      })),
    });
  }
}

@Controller('reports/emis')
export class EmisReportController {
  constructor(private readonly emis: EmisReportService) {}

  @Get('start-of-year')
  @RequirePermission(PERMISSION)
  startOfYear(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.emis.startOfYear(currentUser);
  }

  @Post('start-of-year/export')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  async export(@Req() request: Request, @Res() response: Response, @AuthenticatedUser() currentUser: CurrentUser) {
    sendWorkbook(response, await this.emis.export(currentUser, request.ip ?? null));
  }
}

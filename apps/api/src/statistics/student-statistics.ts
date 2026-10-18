import { Controller, Get, Injectable, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase, StudentHealthTerm } from '@school-management/database';
import { Clock, type FieldError } from '@school-management/server';
import { EYE_CONDITIONS, PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  buildTableFile,
  CONTENT_TYPES,
  readTableFileFormat,
  withExtension,
  type TableFileFormat,
} from '../exports/table-file.js';
import { ageInMonths } from '../health/health-access.js';
import { SchoolTerms } from '../health/school-terms.js';
import { termOfDate, termRangeOf, TERMS } from '../health/student-health-calc.js';
import { check, optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { childAgeGroup, profileText } from './statistics-calc.js';
import { buildStudentStatistics, type StudentFacts, type StudentStatistics } from './student-statistics-calc.js';

// 5.3 Thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h): đọc học sinh đang học trong phạm vi quyền
// P17.child-statistics.view kèm lớp hiện tại, kết quả hoàn thành chương trình (4.4), thông tin sức khỏe của học kỳ (4.6) và
// dữ liệu tệp CSDL ngành (dân tộc, khuyết tật, đối tượng chính sách, biết bơi). Xuất Excel hoặc PDF bằng tệp bảng dùng chung
// của 16a, ghi nhật ký xuất có dữ liệu cá nhân (danh sách học sinh dân tộc; BR-74)
const NO_ID = '00000000-0000-0000-0000-000000000000';
const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);
const TERM_LABELS: Record<StudentHealthTerm, string> = { first_term: 'Học kỳ I', second_term: 'Học kỳ II' };

function readStatisticsTerm(query: QueryValues, errors: FieldError[]): StudentHealthTerm | null {
  const term = query.term?.trim() || null;
  if (term !== null && !TERMS.includes(term as StudentHealthTerm)) {
    errors.push({ field: 'term', message: 'Học kỳ là first_term hoặc second_term' });
    return null;
  }
  return term as StudentHealthTerm | null;
}

// Học sinh đang học của các đơn vị kèm dữ kiện thống kê; dùng chung cho 5.3 và báo cáo sức khỏe đầu năm
export async function loadStudentFacts(
  database: Kysely<SchoolYearDatabase>,
  orgUnitIds: string[],
  term: StudentHealthTerm,
  today: string,
): Promise<StudentFacts[]> {
  const children = await database
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .leftJoin('class_enrollments', (join) =>
      join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
    )
    .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .leftJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
    .select([
      'children.id',
      'children.full_name',
      'children.dob',
      'children.gender',
      'children.special_needs_note',
      'children.moet_profile',
      'org_units.name as org_unit_name',
      'classes.id as class_id',
      'classes.name as class_name',
      'grade_levels.age_from_months',
    ])
    .where('children.status', '=', 'active')
    .where('children.org_unit_id', 'in', nonEmpty(orgUnitIds))
    .orderBy('org_units.name')
    .orderBy('classes.name')
    .orderBy('children.full_name')
    .execute();
  const ids = nonEmpty(children.map((row) => row.id));
  const [completions, records] = await Promise.all([
    database.selectFrom('program_completions').select(['child_id', 'result']).where('child_id', 'in', ids).execute(),
    database
      .selectFrom('student_health_records')
      .select(['child_id', 'can_swim', 'eye_conditions', 'physical_education'])
      .where('term_type', '=', term)
      .where('child_id', 'in', ids)
      .execute(),
  ]);
  const completionOf = new Map(completions.map((row) => [row.child_id, row.result]));
  const recordOf = new Map(records.map((row) => [row.child_id, row]));
  const seen = new Set<string>();
  const facts: StudentFacts[] = [];
  for (const row of children) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    const record = recordOf.get(row.id);
    facts.push({
      id: row.id,
      full_name: row.full_name,
      dob: row.dob,
      gender: row.gender,
      org_unit_name: row.org_unit_name,
      class_id: row.class_id,
      class_name: row.class_name,
      class_age_from_months: row.age_from_months,
      age_group: childAgeGroup(ageInMonths(row.dob, today)),
      ethnicity: profileText(row.moet_profile, 'ethnicity'),
      disability:
        profileText(row.moet_profile, 'disability_type') ??
        (row.special_needs_note?.trim() ? 'Có nhu cầu đặc biệt, chưa ghi loại' : null),
      policy: profileText(row.moet_profile, 'policy_target'),
      profile_can_swim: row.moet_profile?.can_swim === true,
      completion: completionOf.get(row.id) ?? null,
      term_record: record
        ? {
            can_swim: record.can_swim,
            eye_conditions: record.eye_conditions ?? [],
            physical_education: record.physical_education,
          }
        : null,
    });
  }
  return facts;
}

@Injectable()
export class StudentStatisticsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly schoolTerms: SchoolTerms,
    private readonly clock: Clock,
  ) {}

  async students(currentUser: CurrentUser, orgUnitId: string | null, chosenTerm: StudentHealthTerm | null) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.childStatisticsView, orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const today = VIETNAM_DATE.format(this.clock.now());
    const terms = await this.schoolTerms.ranges();
    const term = chosenTerm ?? termOfDate(today, terms);
    const facts = await loadStudentFacts(database, scope.orgUnitIds, term, today);
    return {
      on_date: today,
      term,
      term_range: termRangeOf(terms, term),
      org_unit_ids: scope.orgUnitIds,
      ...buildStudentStatistics(facts),
    };
  }

  async export(
    currentUser: CurrentUser,
    orgUnitId: string | null,
    chosenTerm: StudentHealthTerm | null,
    format: TableFileFormat,
    query: QueryValues,
    ip: string | null,
  ) {
    const report = await this.students(currentUser, orgUnitId, chosenTerm);
    const createdAt = this.clock.now();
    const sheets = statisticsSheets(report);
    const buffer = await buildTableFile(format, sheets, createdAt);
    const fileName = withExtension(`thong-ke-hoc-sinh-${report.term === 'first_term' ? 'hk1' : 'hk2'}.xlsx`, format);
    const { database } = await this.currentSchoolYear.require();
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'student-statistics',
        filters_data: JSON.stringify(query),
        org_unit_ids: report.org_unit_ids,
        row_count: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ip,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: CONTENT_TYPES[format] };
  }
}

// Các bảng của tệp xuất 5.3, cùng thứ tự với màn hình
export function statisticsSheets(report: StudentStatistics & { term: StudentHealthTerm; on_date: string }) {
  const groups = report.age_groups;
  const ageColumns = groups.map((group) => ({ key: group.key, label: group.label }));
  const heading = [`Thống kê học sinh, ${TERM_LABELS[report.term]}`, `Tuổi tính đến ngày ${report.on_date}`];
  const withAges = (row: { ages: Record<string, number> }) =>
    Object.fromEntries(groups.map((group) => [group.key, row.ages[group.key] ?? 0]));
  const eyeColumns = EYE_CONDITIONS.map((item) => ({ key: item.value, label: item.label }));
  return [
    {
      title: 'Độ tuổi theo lớp',
      heading,
      columns: [
        { key: 'class_name', label: 'Lớp', width: 24 },
        { key: 'total', label: 'Tổng số' },
        { key: 'female', label: 'Nữ' },
        ...ageColumns,
      ],
      rows: report.by_class.map((row) => ({
        class_name: row.class_name,
        total: row.total,
        female: row.female,
        ...withAges(row),
      })),
    },
    {
      title: 'Hoàn thành chương trình',
      heading: [...heading, `Số lớp mẫu giáo 5–6 tuổi: ${report.completion.class_count}`],
      columns: [
        { key: 'label', label: 'Nhóm', width: 28 },
        { key: 'count', label: 'Số trẻ' },
        { key: 'completed', label: 'Hoàn thành' },
        { key: 'not_completed', label: 'Chưa hoàn thành' },
        { key: 'percent', label: 'Tỷ lệ hoàn thành (%)' },
      ],
      rows: report.completion.categories,
    },
    {
      title: 'Diện chính sách theo tuổi',
      heading,
      columns: [
        { key: 'value', label: 'Đối tượng chính sách', width: 32 },
        { key: 'total', label: 'Tổng số' },
        { key: 'female', label: 'Nữ' },
        ...ageColumns,
      ],
      rows: report.policy_by_age.map((row) => ({
        value: row.value,
        total: row.total,
        female: row.female,
        ...withAges(row),
      })),
    },
    {
      title: 'Biết bơi, bệnh về mắt',
      heading,
      columns: [
        { key: 'label', label: 'Nhóm tuổi', width: 24 },
        { key: 'total', label: 'Số học sinh' },
        { key: 'swimming', label: 'Biết bơi' },
        { key: 'swimming_female', label: 'Biết bơi: nữ' },
        { key: 'eye_any', label: 'Có bệnh về mắt' },
        ...eyeColumns,
      ],
      rows: [
        ...report.term_health.by_age.map((row) => ({ ...row, label: row.label, total: row.total })),
        { ...report.term_health.totals, label: 'Tổng cộng', total: report.totals.children_count },
      ].map((row) => ({
        label: row.label,
        total: row.total,
        swimming: row.swimming.count,
        swimming_female: row.swimming.female,
        eye_any: row.eye_any.count,
        ...Object.fromEntries(row.eye_conditions.map((item) => [item.value, item.count])),
      })),
    },
    {
      title: 'Học sinh dân tộc',
      heading: [...heading, `Học sinh dân tộc thiểu số: ${report.ethnic.count} (nữ ${report.ethnic.female})`],
      columns: [
        { key: 'full_name', label: 'Họ tên', width: 28 },
        { key: 'dob', label: 'Ngày sinh' },
        { key: 'gender', label: 'Giới tính' },
        { key: 'class_name', label: 'Lớp', width: 20 },
        { key: 'ethnicity', label: 'Dân tộc', width: 16 },
      ],
      rows: report.ethnic.students.map((row) => ({
        ...row,
        gender: row.gender === 'female' ? 'Nữ' : 'Nam',
        class_name: row.class_name ?? '',
      })),
    },
  ];
}

@Controller('statistics')
export class StudentStatisticsController {
  constructor(private readonly statistics: StudentStatisticsService) {}

  @Get('students')
  @RequirePermission(PERMISSION_CODES.childStatisticsView)
  students(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const term = readStatisticsTerm(query, errors);
    check(errors);
    return this.statistics.students(currentUser, orgUnitId, term);
  }

  @Get('students/export')
  @RequirePermission(PERMISSION_CODES.childStatisticsView)
  async export(
    @Query() query: QueryValues,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const term = readStatisticsTerm(query, errors);
    const format = readTableFileFormat(query.format) ?? 'xlsx';
    check(errors);
    const file = await this.statistics.export(currentUser, orgUnitId, term, format, query, request.ip ?? null);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('x-export-log-id', file.logId);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }
}

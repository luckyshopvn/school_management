import { Controller, Get, Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, StudentHealthTerm } from '@school-management/database';
import { Clock } from '@school-management/server';
import { PERMISSION_CODES, SCHOOL_OWNERSHIP_TYPES, type SchoolOwnershipType } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { FacilitiesData } from '../facilities/facilities-data.js';
import { profileText } from '../statistics/statistics-calc.js';
import { buildStartOfYearHealthReport, type HealthReportChild } from './emis-health-calc.js';
import { assessGrowth } from './growth-calc.js';
import { SchoolTerms } from './school-terms.js';
import { latestGrowthByChild, termOfDate, termRangeOf, type TermRange } from './student-health-calc.js';

// Số liệu "Báo cáo sức khỏe học sinh đầu năm" (khảo sát mục 5, dòng 1.3; DT-16 phần 16h). Điểm nối cho phần 16j: hàm
// `startOfYearHealth` trả các dòng cùng dạng Biểu 1 EMIS (tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số) kèm
// cảnh báo thiếu dữ liệu; 16j dựng màn hình 1.3, xuất tệp và đăng ký biểu mẫu gửi lên cấp trên (UpperLevelForms) từ hàm
// này. Cần phạm vi toàn trường theo quyền P17.report.emis như Biểu 1
const PERMISSION = PERMISSION_CODES.emisReport;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);
const toNumber = (value: string | null) => (value === null ? null : Number(value));
const dateText = (value: unknown) =>
  value instanceof Date ? VIETNAM_DATE.format(value) : String(value ?? '').slice(0, 10);

// Dữ kiện của từng học sinh đang học cho báo cáo sức khỏe đầu năm (học kỳ I); biểu cuối năm của phần 16j gọi với học kỳ II
export async function loadStartOfYearHealthChildren(
  database: Kysely<SchoolYearDatabase>,
  terms: TermRange[],
  term: StudentHealthTerm = 'first_term',
): Promise<HealthReportChild[]> {
  const children = await database
    .selectFrom('children')
    .select(['id', 'dob', 'gender', 'special_needs_note', 'moet_profile'])
    .where('status', '=', 'active')
    .execute();
  const ids = nonEmpty(children.map((child) => child.id));
  const [checks, measurements, records] = await Promise.all([
    database
      .selectFrom('health_check_results')
      .innerJoin('health_check_campaigns', 'health_check_campaigns.id', 'health_check_results.campaign_id')
      .select(['health_check_results.child_id', 'health_check_campaigns.from_date'])
      .where('health_check_results.child_id', 'in', ids)
      .execute(),
    database
      .selectFrom('health_measurements')
      .innerJoin('growth_rounds', 'growth_rounds.id', 'health_measurements.growth_round_id')
      .select([
        'health_measurements.child_id',
        'health_measurements.weight_kg',
        'health_measurements.height_cm',
        'growth_rounds.id as growth_round_id',
        'growth_rounds.name as round_name',
        'growth_rounds.measured_on',
      ])
      .where('health_measurements.child_id', 'in', ids)
      .execute(),
    database
      .selectFrom('student_health_records')
      .select(['child_id', 'eye_conditions'])
      .where('term_type', '=', term)
      .where('child_id', 'in', ids)
      .execute(),
  ]);
  const examined = new Set(
    checks.filter((row) => termOfDate(dateText(row.from_date), terms) === term).map((row) => row.child_id),
  );
  const growth = latestGrowthByChild(
    measurements.map((row) => ({
      child_id: row.child_id,
      growth_round_id: row.growth_round_id,
      round_name: row.round_name,
      measured_on: dateText(row.measured_on),
      weight_kg: toNumber(row.weight_kg),
      height_cm: toNumber(row.height_cm),
    })),
    terms,
    term,
  );
  const eyes = new Map(records.map((row) => [row.child_id, row.eye_conditions ?? []]));
  return children.map((child) => {
    const point = growth.get(child.id);
    return {
      id: child.id,
      gender: child.gender,
      ethnicity: profileText(child.moet_profile, 'ethnicity'),
      disability:
        profileText(child.moet_profile, 'disability_type') ??
        (child.special_needs_note?.trim() ? 'Có nhu cầu đặc biệt' : null),
      examined: examined.has(child.id),
      assessment: point ? assessGrowth(child, point.measured_on, point) : null,
      eye_conditions: eyes.get(child.id) ?? [],
    };
  });
}

@Injectable()
export class EmisHealthReportService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly schoolTerms: SchoolTerms,
    private readonly clock: Clock,
  ) {}

  async startOfYearHealth(currentUser: CurrentUser) {
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION],
      'Báo cáo sức khỏe học sinh đầu năm lập cho toàn trường, cần phạm vi toàn trường',
    );
    const { database } = await this.currentSchoolYear.require();
    const terms = await this.schoolTerms.ranges();
    const root = await this.data.root(database);
    const profile = await database
      .selectFrom('school_profiles')
      .select('general')
      .where('org_unit_id', '=', root.id)
      .executeTakeFirst();
    const ownershipValue = profile?.general?.ownership_type;
    const ownership = SCHOOL_OWNERSHIP_TYPES.some((type) => type.value === ownershipValue)
      ? (ownershipValue as SchoolOwnershipType)
      : null;
    const result = buildStartOfYearHealthReport({
      ownership,
      children: await loadStartOfYearHealthChildren(database, terms),
    });
    return {
      school_name: root.name,
      ownership,
      term_range: termRangeOf(terms, 'first_term'),
      generated_on: VIETNAM_DATE.format(this.clock.now()),
      ...result,
    };
  }
}

@Controller('reports/emis')
export class EmisHealthReportController {
  constructor(private readonly report: EmisHealthReportService) {}

  @Get('start-of-year-health')
  @RequirePermission(PERMISSION)
  startOfYearHealth(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.report.startOfYearHealth(currentUser);
  }
}

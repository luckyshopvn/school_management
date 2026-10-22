import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { readLevelFilter, type LevelFilter } from '../common/report-levels.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { ageInMonths } from '../health/health-access.js';
import { check, optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import {
  AGE_GROUPS,
  CHILD_FIELD_RULES,
  STAFF_FIELD_RULES,
  breakdown,
  childAgeGroup,
  classAgeGroup,
  countMissing,
  percentOf,
  profileText,
  type ChildProfileFacts,
  type StaffProfileFacts,
} from './statistics-calc.js';

// Thống kê theo tiêu chí ngành (DT-14 phần 14a, YCTD-102): 5.1 lớp học theo nhóm tuổi, 5.2 nhân sự theo trình độ, vị trí
// việc làm, hình thức hợp đồng, 5.3 học sinh theo độ tuổi, dân tộc, khuyết tật, diện chính sách, biết bơi, bệnh về mắt,
// 5.8, 5.9 hồ sơ chưa nhập đủ. Học sinh là trẻ trạng thái đang học; nhân sự là nhân sự đang làm việc. Phạm vi theo đơn vị
// được gán của quyền P17.child-statistics.view (học sinh, lớp) và P17.staff-statistics.view (nhân sự)
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  probation: 'Thử việc',
  fixed_term: 'Hợp đồng xác định thời hạn',
  indefinite: 'Hợp đồng không xác định thời hạn',
};
const NO_ID = '00000000-0000-0000-0000-000000000000';
const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_ID]);

function readField(query: QueryValues, keys: string[], errors: FieldError[]): string | null {
  const field = query.field?.trim() || null;
  if (field !== null && !keys.includes(field)) {
    errors.push({ field: 'field', message: 'Trường thông tin không có trong danh sách' });
  }
  return field;
}

@Injectable()
export class StatisticsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  // Tham số cấp của thống kê (DT-19 phần 19d, YCTD-154)
  levelFilter(currentUser: CurrentUser, query: QueryValues): Promise<LevelFilter> {
    return readLevelFilter(this.schoolLevels, currentUser, query);
  }

  private today() {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async childScope(currentUser: CurrentUser, orgUnitId: string | null) {
    return this.reports.unitScope(currentUser, PERMISSION_CODES.childStatisticsView, orgUnitId, false);
  }

  private async staffScope(currentUser: CurrentUser, orgUnitId: string | null) {
    return this.reports.unitScope(currentUser, PERMISSION_CODES.staffStatisticsView, orgUnitId, false);
  }

  // Trẻ đang học trong phạm vi kèm lớp hiện tại; lọc cấp thì chỉ trẻ đang học lớp thuộc cấp đó (YCTD-154)
  private async activeChildren(orgUnitIds: string[], levels: LevelFilter = null) {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('children')
      .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'children.address',
        'children.national_id_last4',
        'children.special_needs_note',
        'children.moet_profile',
        'org_units.name as org_unit_name',
        'classes.name as class_name',
      ])
      .where('children.status', '=', 'active')
      .where('children.org_unit_id', 'in', orgUnitIds)
      .$if(levels !== null, (query) => query.where('classes.school_level', 'in', levels ?? []))
      .orderBy('org_units.name')
      .orderBy('classes.name')
      .orderBy('children.full_name')
      .execute();
  }

  private async activeStaff(orgUnitIds: string[]) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.dob',
        'staff.gender',
        'staff.phone',
        'staff.email',
        'staff.address',
        'staff.id_number_last4',
        'staff.moet_profile',
        'staff.bank_account_number',
        'staff.tax_code',
        'org_units.name as org_unit_name',
        'job_titles.name as job_title_name',
      ])
      .where('staff.status', '=', 'active')
      .where('staff.org_unit_id', 'in', orgUnitIds)
      .orderBy('org_units.name')
      .orderBy('staff.full_name')
      .execute();
    const contracts = await database
      .selectFrom('employment_contracts')
      .select(['staff_id', 'contract_type', 'start_date'])
      .where('status', '=', 'active')
      .where('staff_id', 'in', nonEmpty(staff.map((row) => row.id)))
      .orderBy('start_date', 'desc')
      .execute();
    const contractOf = new Map<string, string>();
    for (const contract of contracts) {
      if (!contractOf.has(contract.staff_id)) {
        contractOf.set(contract.staff_id, contract.contract_type);
      }
    }
    return staff.map((row) => ({ ...row, contract_type: contractOf.get(row.id) ?? null }));
  }

  // 5.1 Thống kê lớp học: số lớp đang hoạt động và số học sinh đang học theo nhóm tuổi của bậc học. Nhóm tuổi chỉ có ở lớp Mầm
  // non; lớp của cấp khác thống kê theo khối (DT-19 phần 19d, YCTD-154)
  async classes(currentUser: CurrentUser, orgUnitId: string | null, levels: LevelFilter = null) {
    const scope = await this.childScope(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const classes = await database
      .selectFrom('classes')
      .leftJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
      .select([
        'classes.id',
        'classes.school_level',
        'classes.grade_level',
        'grade_levels.name as grade_name',
        'grade_levels.order_no as grade_order',
        'grade_levels.age_from_months',
      ])
      .where('classes.org_unit_id', 'in', scope.orgUnitIds)
      .where('classes.status', '=', 'active')
      .$if(levels !== null, (query) => query.where('classes.school_level', 'in', levels ?? []))
      .execute();
    const enrolled = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['class_enrollments.class_id', 'children.gender'])
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('class_enrollments.class_id', 'in', nonEmpty(classes.map((row) => row.id)))
      .execute();
    const nursery = classes.filter((row) => row.school_level === 'MN');
    const groups = AGE_GROUPS.filter((group) => group.stage !== 'other').map((group) => {
      const classIds = new Set(
        nursery.filter((row) => classAgeGroup(row.age_from_months ?? 0) === group.key).map((row) => row.id),
      );
      const members = enrolled.filter((row) => classIds.has(row.class_id));
      return {
        key: group.key,
        label: group.label,
        stage: group.stage,
        class_count: classIds.size,
        class_percent: percentOf(classIds.size, classes.length),
        children_count: members.length,
        female_count: members.filter((row) => row.gender === 'female').length,
        children_percent: percentOf(members.length, enrolled.length),
      };
    });
    const gradeCodes = [...new Set(classes.filter((row) => row.school_level !== 'MN').map((row) => row.grade_level))];
    const gradeGroups = gradeCodes
      .map((code) => {
        const inGrade = classes.filter((row) => row.school_level !== 'MN' && row.grade_level === code);
        const classIds = new Set(inGrade.map((row) => row.id));
        const members = enrolled.filter((row) => classIds.has(row.class_id));
        return {
          grade_level: code,
          label: inGrade[0]?.grade_name ?? code,
          school_level: inGrade[0]?.school_level ?? 'MN',
          order_no: inGrade[0]?.grade_order ?? 0,
          class_count: classIds.size,
          class_percent: percentOf(classIds.size, classes.length),
          children_count: members.length,
          female_count: members.filter((row) => row.gender === 'female').length,
          children_percent: percentOf(members.length, enrolled.length),
        };
      })
      .sort((left, right) => left.order_no - right.order_no || left.grade_level.localeCompare(right.grade_level))
      .map(({ order_no: _order, ...group }) => group);
    return {
      groups,
      grade_groups: gradeGroups,
      totals: {
        class_count: classes.length,
        children_count: enrolled.length,
        female_count: enrolled.filter((row) => row.gender === 'female').length,
      },
    };
  }

  // 5.3 Thống kê học sinh
  async children(currentUser: CurrentUser, orgUnitId: string | null, levels: LevelFilter = null) {
    const scope = await this.childScope(currentUser, orgUnitId);
    const today = this.today();
    const rows = (await this.activeChildren(scope.orgUnitIds, levels)).map((row) => ({
      ...row,
      age_group: childAgeGroup(ageInMonths(row.dob, today)),
    }));
    const female = rows.filter((row) => row.gender === 'female');
    const disability = (row: (typeof rows)[number]) =>
      profileText(row.moet_profile, 'disability_type') ??
      (row.special_needs_note?.trim() ? 'Có nhu cầu đặc biệt, chưa ghi loại' : null);
    const withValue = <T>(items: T[], value: (row: T) => string | null) => items.filter((row) => value(row) !== null);
    const disabled = withValue(rows, disability);
    const policy = withValue(rows, (row) => profileText(row.moet_profile, 'policy_target'));
    const eyes = withValue(rows, (row) => profileText(row.moet_profile, 'eye_disease'));
    const swimmers = rows.filter((row) => row.moet_profile?.can_swim === true);
    return {
      on_date: today,
      totals: { children_count: rows.length, female_count: female.length },
      by_age: AGE_GROUPS.map((group) => {
        const members = rows.filter((row) => row.age_group === group.key);
        return {
          key: group.key,
          label: group.label,
          count: members.length,
          female: members.filter((row) => row.gender === 'female').length,
          percent: percentOf(members.length, rows.length),
        };
      }).filter((group) => group.count > 0 || (group.key !== 'under_3_months' && group.key !== 'over_6')),
      by_ethnicity: breakdown(rows, (row) => profileText(row.moet_profile, 'ethnicity')),
      disability: { count: disabled.length, by_type: breakdown(disabled, disability) },
      policy: {
        count: policy.length,
        by_type: breakdown(policy, (row) => profileText(row.moet_profile, 'policy_target')),
      },
      swimming: {
        count: swimmers.length,
        female: swimmers.filter((row) => row.gender === 'female').length,
        percent: percentOf(swimmers.length, rows.length),
      },
      eye_disease: {
        count: eyes.length,
        by_type: breakdown(eyes, (row) => profileText(row.moet_profile, 'eye_disease')),
      },
    };
  }

  // 5.2 Thống kê nhân sự: trình độ, vị trí việc làm, hình thức hợp đồng, nhóm chức vụ. Lấy theo tệp CSDL ngành, chưa có thì
  // vị trí việc làm theo chức danh và hình thức hợp đồng theo hợp đồng lao động đang hiệu lực
  async staff(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.staffScope(currentUser, orgUnitId);
    const rows = await this.activeStaff(scope.orgUnitIds);
    return {
      totals: { staff_count: rows.length, female_count: rows.filter((row) => row.gender === 'female').length },
      by_qualification: breakdown(rows, (row) => profileText(row.moet_profile, 'professional_qualification')),
      by_job_position: breakdown(rows, (row) => profileText(row.moet_profile, 'job_position') ?? row.job_title_name),
      by_contract_form: breakdown(
        rows,
        (row) =>
          profileText(row.moet_profile, 'contract_form') ??
          (row.contract_type ? (CONTRACT_TYPE_LABELS[row.contract_type] ?? row.contract_type) : null),
      ),
      by_position_group: breakdown(rows, (row) => profileText(row.moet_profile, 'position_group')),
    };
  }

  // 5.8 Hồ sơ học sinh chưa nhập đủ: số học sinh thiếu từng trường; chọn trường thì kèm danh sách
  async missingChildFields(
    currentUser: CurrentUser,
    orgUnitId: string | null,
    field: string | null,
    levels: LevelFilter = null,
  ) {
    const scope = await this.childScope(currentUser, orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.activeChildren(scope.orgUnitIds, levels);
    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select([
        'child_guardians.child_id',
        'guardians.full_name',
        'guardians.phone',
        'guardians.occupation',
        'guardians.birth_year',
        'guardians.id_number_last4',
      ])
      .where('child_guardians.child_id', 'in', nonEmpty(rows.map((row) => row.id)))
      .execute();
    const byChild = new Map<string, ChildProfileFacts['guardians']>();
    for (const guardian of guardians) {
      byChild.set(guardian.child_id, [...(byChild.get(guardian.child_id) ?? []), guardian]);
    }
    const facts = rows.map((row) => ({ row, facts: { ...row, guardians: byChild.get(row.id) ?? [] } }));
    const rule = CHILD_FIELD_RULES.find((item) => item.key === field);
    return {
      total: rows.length,
      fields: countMissing(
        CHILD_FIELD_RULES,
        facts.map((item) => item.facts),
      ),
      field,
      records: rule
        ? facts
            .filter((item) => rule.isMissing(item.facts))
            .map(({ row }) => ({
              id: row.id,
              full_name: row.full_name,
              dob: row.dob,
              org_unit_name: row.org_unit_name,
              class_name: row.class_name,
            }))
        : [],
    };
  }

  // 5.9 Hồ sơ nhân sự chưa nhập đủ
  async missingStaffFields(currentUser: CurrentUser, orgUnitId: string | null, field: string | null) {
    const scope = await this.staffScope(currentUser, orgUnitId);
    const rows = await this.activeStaff(scope.orgUnitIds);
    const facts: Array<{ row: (typeof rows)[number]; facts: StaffProfileFacts }> = rows.map((row) => ({
      row,
      facts: { ...row, has_active_contract: row.contract_type !== null },
    }));
    const rule = STAFF_FIELD_RULES.find((item) => item.key === field);
    return {
      total: rows.length,
      fields: countMissing(
        STAFF_FIELD_RULES,
        facts.map((item) => item.facts),
      ),
      field,
      records: rule
        ? facts
            .filter((item) => rule.isMissing(item.facts))
            .map(({ row }) => ({
              id: row.id,
              code: row.code,
              full_name: row.full_name,
              org_unit_name: row.org_unit_name,
              job_title_name: row.job_title_name,
            }))
        : [],
    };
  }
}

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  private unit(query: QueryValues) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    check(errors);
    return orgUnitId;
  }

  @Get('classes')
  @RequirePermission(PERMISSION_CODES.childStatisticsView)
  async classes(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const orgUnitId = this.unit(query);
    return this.statistics.classes(currentUser, orgUnitId, await this.statistics.levelFilter(currentUser, query));
  }

  @Get('children')
  @RequirePermission(PERMISSION_CODES.childStatisticsView)
  async children(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const orgUnitId = this.unit(query);
    return this.statistics.children(currentUser, orgUnitId, await this.statistics.levelFilter(currentUser, query));
  }

  @Get('staff')
  @RequirePermission(PERMISSION_CODES.staffStatisticsView)
  staff(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.statistics.staff(currentUser, this.unit(query));
  }

  @Get('missing-child-fields')
  @RequirePermission(PERMISSION_CODES.childStatisticsView)
  async missingChildFields(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const field = readField(
      query,
      CHILD_FIELD_RULES.map((rule) => rule.key),
      errors,
    );
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const orgUnitId = this.unit(query);
    return this.statistics.missingChildFields(
      currentUser,
      orgUnitId,
      field,
      await this.statistics.levelFilter(currentUser, query),
    );
  }

  @Get('missing-staff-fields')
  @RequirePermission(PERMISSION_CODES.staffStatisticsView)
  missingStaffFields(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const field = readField(
      query,
      STAFF_FIELD_RULES.map((rule) => rule.key),
      errors,
    );
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.statistics.missingStaffFields(currentUser, this.unit(query), field);
  }
}

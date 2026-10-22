import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { KitchenAccess } from '../kitchen/kitchen-access.js';
import {
  buildReport,
  classifyDay,
  datesBetween,
  periodRange,
  type ChildRoll,
  type Period,
  type ReportInput,
} from './attendance-meals-calc.js';
import { check, optionalUuid, type QueryValues } from './report-filters.js';
import { ReportsService } from './reports.service.js';

// Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng (DT-13 phần 13c, YCTD-100). Người có quyền xem báo cáo điểm danh
// (P17.report.attendance) xem các lớp của đơn vị trong phạm vi, giáo viên xem lớp được phân công; bếp và người xem dữ liệu
// bếp của đơn vị xem số suất ăn theo ngày của đơn vị đó. Số liệu tính trực tiếp từ điểm danh, báo vắng và lịch năm học
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS: Period[] = ['day', 'week', 'month'];

export interface AttendanceMealsFilter {
  period: Period;
  date: string;
  orgUnitId: string | null;
  classId: string | null;
}

export function readAttendanceMealsFilter(query: QueryValues, errors: FieldError[]): AttendanceMealsFilter {
  const period = (query.period ?? 'month') as Period;
  if (!PERIODS.includes(period)) {
    errors.push({ field: 'period', message: 'Kỳ báo cáo là day, week hoặc month' });
  }
  const date = query.date ?? '';
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.push({ field: 'date', message: 'Ngày theo dạng YYYY-MM-DD' });
  }
  return {
    period,
    date,
    orgUnitId: optionalUuid(query, 'org_unit_id', errors),
    classId: optionalUuid(query, 'class_id', errors),
  };
}

@Injectable()
export class AttendanceMealsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly kitchenAccess: KitchenAccess,
    private readonly clock: Clock,
  ) {}

  // Báo cáo trên màn hình và dữ liệu cho tệp Excel: các lớp trong phạm vi, mỗi lớp từng ngày, nhóm theo khối
  async report(currentUser: CurrentUser, filter: AttendanceMealsFilter) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.attendanceReport, filter.orgUnitId, true);
    let classIds = scope.classIds;
    if (filter.classId) {
      await this.assertClassInScope(filter.classId, scope.orgUnitIds, scope.classIds);
      classIds = [filter.classId];
    }
    return this.compute(scope.orgUnitIds, classIds, filter.period, filter.date);
  }

  // Bảng điểm danh từng trẻ của một lớp trong kỳ (mã P, K, B, N theo mẫu)
  async classMatrix(currentUser: CurrentUser, filter: AttendanceMealsFilter) {
    if (!filter.classId) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    const result = await this.report(currentUser, filter);
    const classReport = result.classes.find((row) => row.class_id === filter.classId);
    return {
      period: result.period,
      from: result.from,
      to: result.to,
      days: result.days,
      class: classReport ?? null,
      children: result.children[filter.classId] ?? [],
    };
  }

  // Suất ăn theo ngày cho bếp (P12): một ngày hoặc một tuần của đơn vị, theo lớp và theo khối; hôm nay tính theo điểm danh
  // đã lưu đến lúc xem kèm số trẻ chưa điểm danh mà không báo vắng
  async mealCounts(currentUser: CurrentUser, filter: AttendanceMealsFilter) {
    if (!filter.orgUnitId) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    if (filter.period === 'month') {
      throw validationError([{ field: 'period', message: 'Suất ăn của bếp xem theo ngày hoặc theo tuần' }]);
    }
    await this.kitchenAccess.assertRead(currentUser, filter.orgUnitId);
    const result = await this.compute([filter.orgUnitId], null, filter.period, filter.date);
    const today = this.today();
    return {
      period: result.period,
      from: result.from,
      to: result.to,
      today,
      days: result.days,
      classes: result.classes.map(({ days, ...row }) => ({
        ...row,
        days: days.map((day) => ({
          date: day.date,
          enrolled: day.enrolled,
          meal_count: day.meal_count,
          pending: day.pending,
          absent: day.absent_p + day.absent_k + day.absent_b,
        })),
      })),
      groups: result.groups.map(({ days, ...row }) => ({
        ...row,
        days: days.map((day) => ({
          date: day.date,
          enrolled: day.enrolled,
          meal_count: day.meal_count,
          pending: day.pending,
          absent: day.absent_p + day.absent_k + day.absent_b,
        })),
      })),
      totals: result.totals,
      note: result.days.some((day) => day.date === today && day.counted)
        ? 'Hôm nay: số suất theo điểm danh đã lưu đến lúc xem; cột "chưa điểm danh" là trẻ chưa được điểm danh và không báo vắng, bếp có thể dự tính thêm'
        : null,
    };
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async assertClassInScope(classId: string, orgUnitIds: string[], classIds: string[] | null) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    if (!orgUnitIds.includes(classRecord.org_unit_id) || (classIds && !classIds.includes(classId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
    }
  }

  async compute(orgUnitIds: string[], classIds: string[] | null, period: Period, date: string) {
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const system = this.databases.system;
    const { from, to } = periodRange(period, date);
    const today = this.today();
    const year = await system
      .selectFrom('academic_years')
      .select('school_days_of_week')
      .where('id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    const terms = await system
      .selectFrom('academic_terms')
      .select(['start_date', 'end_date', 'term_type'])
      .where('academic_year_id', '=', academicYearId)
      // Lịch chung cả trường; lịch riêng của cấp đọc ở lịch theo cấp (YCTD-152)
      .where('school_level', 'is', null)
      .execute();
    const offWeeks = await system
      .selectFrom('school_weeks')
      .select(['start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      // Lịch chung cả trường; lịch riêng của cấp đọc ở lịch theo cấp (YCTD-152)
      .where('school_level', 'is', null)
      .where('is_off', '=', true)
      .execute();
    // Ngày lễ của cả năm học cho danh sách "Ngày lễ trong năm" của bảng Data; phân loại ngày dùng ngày lễ trong kỳ
    const yearHolidays = await database
      .selectFrom('holidays')
      .select(['holiday_date', 'name'])
      .orderBy('holiday_date')
      .execute();
    const holidays = yearHolidays.filter((row) => row.holiday_date >= from && row.holiday_date <= to);
    const changes = await database
      .selectFrom('school_day_changes')
      .select(['change_date', 'change_type'])
      .where('change_date', '>=', from)
      .where('change_date', '<=', to)
      .execute();
    const calendar = { schoolDaysOfWeek: year.school_days_of_week, terms, offWeeks, holidays, changes };
    const days = datesBetween(from, to).map((day) => classifyDay(day, calendar, today));

    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'grade_level', 'status'])
      .where('org_unit_id', 'in', orgUnitIds)
      .$if(classIds !== null, (query) => query.where('id', 'in', nonEmpty(classIds ?? [])))
      .execute();
    const ids = nonEmpty(classes.map((row) => row.id));
    const enrollments = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'children.status',
        'class_enrollments.class_id',
        'class_enrollments.from_date',
        'class_enrollments.to_date',
      ])
      .where('class_enrollments.class_id', 'in', ids)
      .where('class_enrollments.from_date', '<=', to)
      .where((expression) =>
        expression.or([
          expression('class_enrollments.to_date', 'is', null),
          expression('class_enrollments.to_date', '>', from),
        ]),
      )
      .execute();
    const attendance = await database
      .selectFrom('attendance_records')
      .innerJoin('children', 'children.id', 'attendance_records.child_id')
      .select([
        'attendance_records.child_id',
        'children.full_name',
        'children.status as child_status',
        'attendance_records.class_id',
        'attendance_records.attendance_date',
        'attendance_records.status',
        'attendance_records.note',
      ])
      .where('attendance_records.class_id', 'in', ids)
      .where('attendance_records.attendance_date', '>=', from)
      .where('attendance_records.attendance_date', '<=', to)
      .execute();
    const children = new Map<string, ChildRoll>();
    for (const row of enrollments) {
      const child = children.get(row.child_id) ?? {
        child_id: row.child_id,
        full_name: row.full_name,
        status: row.status,
        enrollments: [],
      };
      child.enrollments.push({ class_id: row.class_id, from_date: row.from_date, to_date: row.to_date });
      children.set(row.child_id, child);
    }
    for (const row of attendance) {
      if (!children.has(row.child_id)) {
        children.set(row.child_id, {
          child_id: row.child_id,
          full_name: row.full_name,
          status: row.child_status,
          enrollments: [],
        });
      }
    }
    const childIds = nonEmpty([...children.keys()]);
    const absences = await database
      .selectFrom('absence_records')
      .select(['child_id', 'absence_date', 'reason', 'is_advised'])
      .where('child_id', 'in', childIds)
      .where('absence_date', '>=', from)
      .where('absence_date', '<=', to)
      .execute();
    const summerChildren = new Map<string, Set<string>>();
    for (const month of new Set(days.filter((day) => day.summer).map((day) => day.date.slice(0, 7)))) {
      const rows = await database
        .selectFrom('summer_registrations')
        .select('child_id')
        .where('period_year', '=', Number(month.slice(0, 4)))
        .where('period_month', '=', Number(month.slice(5, 7)))
        .where('status', '=', 'active')
        .execute();
      summerChildren.set(month, new Set(rows.map((row) => row.child_id)));
    }
    const gradeLevels = await database
      .selectFrom('grade_levels')
      .select(['code', 'name', 'age_from_months', 'order_no'])
      .execute();
    const units = await database.selectFrom('org_units').select(['id', 'name', 'unit_type']).execute();
    const input: ReportInput = {
      days,
      classes,
      gradeLevels,
      children: [...children.values()],
      attendance: attendance.map((row) => ({
        child_id: row.child_id,
        class_id: row.class_id,
        attendance_date: row.attendance_date,
        status: row.status,
        note: row.note,
      })),
      absences,
      summerChildren,
    };
    const built = buildReport(input);
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    return {
      period,
      date,
      from,
      to,
      today,
      // Tên trường trên tệp Excel lấy theo tên Trường chính đã cấu hình
      school_name: units.find((unit) => unit.unit_type === 'truong_chinh')?.name ?? '',
      reference_date: built.reference_date,
      days,
      meal_day_count: days.filter((day) => day.counted).length,
      holiday_count: days.filter((day) => day.code === 'NL' || day.code === 'NK').length,
      holidays,
      year_holidays: yearHolidays,
      classes: built.classes.map((row) => ({ ...row, org_unit_name: unitNames.get(row.org_unit_id) ?? '' })),
      groups: built.groups,
      totals: built.totals,
      children: Object.fromEntries([...built.matrices.entries()]),
    };
  }
}

function nonEmpty(ids: string[]): string[] {
  return ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'];
}

export type AttendanceMealsReport = Awaited<ReturnType<AttendanceMealsService['compute']>>;

@Controller()
export class AttendanceMealsController {
  constructor(private readonly service: AttendanceMealsService) {}

  @Get('reports/attendance-meals')
  async report(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readAttendanceMealsFilter(query, errors);
    check(errors);
    // Màn hình tổng hợp không cần mã từng trẻ; bảng từng trẻ của một lớp đọc ở điểm cuối riêng
    return { ...(await this.service.report(currentUser, filter)), children: undefined };
  }

  @Get('reports/attendance-meals/children')
  children(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readAttendanceMealsFilter(query, errors);
    check(errors);
    return this.service.classMatrix(currentUser, filter);
  }

  @Get('kitchen/meal-counts')
  mealCounts(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readAttendanceMealsFilter({ period: 'day', ...query }, errors);
    check(errors);
    return this.service.mealCounts(currentUser, filter);
  }
}

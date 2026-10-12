import { Controller, Get, Query } from '@nestjs/common';
import type { FieldError } from '@school-management/server';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import {
  check,
  dateRange,
  flowType,
  minimumOverdueDays,
  month,
  optionalUuid,
  type QueryValues,
} from './report-filters.js';
import { ReportsService } from './reports.service.js';

// Bảng điều khiển và báo cáo cơ bản (P17; YCTD-62). Quyền và phạm vi kiểm tra ở tầng nghiệp vụ
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard/leadership')
  leadership(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = { orgUnitId: optionalUuid(query, 'org_unit_id', errors), month: month(query, errors) };
    check(errors);
    return this.reports.dashboard(currentUser, 'leadership', filter);
  }

  @Get('dashboard/unit')
  unit(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = { orgUnitId: optionalUuid(query, 'org_unit_id', errors), month: month(query, errors) };
    check(errors);
    return this.reports.dashboard(currentUser, 'unit', filter);
  }

  @Get('dashboard/birthdays')
  birthdays(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      month: month(query, errors),
    };
    check(errors);
    return this.reports.birthdays(currentUser, filter);
  }

  @Get('reports/tuition')
  tuition(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      month: month(query, errors),
      gradeLevel: query.grade_level?.trim() || null,
    };
    check(errors);
    return this.reports.tuition(currentUser, filter);
  }

  @Get('reports/debts')
  debts(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      minimumOverdueDays: minimumOverdueDays(query, errors),
    };
    check(errors);
    return this.reports.debtsReport(currentUser, filter);
  }

  @Get('reports/cash-flow')
  cashFlow(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      ...dateRange(query, errors),
      flowType: flowType(query, errors),
      createdBy: optionalUuid(query, 'created_by', errors),
    };
    check(errors);
    return this.reports.cashFlow(currentUser, filter);
  }

  @Get('reports/attendance')
  attendance(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      ...dateRange(query, errors),
    };
    check(errors);
    return this.reports.attendanceReport(currentUser, filter);
  }

  @Get('reports/staff-attendance')
  staffAttendance(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      month: month(query, errors),
      departmentId: optionalUuid(query, 'department_id', errors),
    };
    check(errors);
    return this.reports.staffAttendanceReport(currentUser, filter);
  }

  @Get('reports/saturday-classes')
  saturday(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      classId: optionalUuid(query, 'class_id', errors),
      ...dateRange(query, errors),
    };
    check(errors);
    return this.reports.saturdayReport(currentUser, filter);
  }
}

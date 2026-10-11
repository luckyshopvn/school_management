import { Controller, Get, Query } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid } from '../common/request-fields.js';
import { ReportsService } from './reports.service.js';

// Bảng điều khiển và báo cáo cơ bản (P17; YCTD-62). Quyền và phạm vi kiểm tra ở tầng nghiệp vụ
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type QueryValues = Record<string, string | undefined>;

function optionalUuid(query: QueryValues, field: string, errors: FieldError[]): string | null {
  const value = query[field];
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

function month(query: QueryValues, errors: FieldError[]): string {
  const value = query.month;
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) {
    errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
    return '';
  }
  return value;
}

function dateRange(query: QueryValues, errors: FieldError[]): { from: string; to: string } {
  const from = query.from ?? '';
  const to = query.to ?? '';
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    errors.push({ field: 'from', message: 'Khoảng ngày from, to theo dạng YYYY-MM-DD, from không sau to' });
  }
  return { from, to };
}

function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

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
    const days = query.minimum_overdue_days;
    const minimumOverdueDays = days === undefined || days === '' ? null : Number(days);
    if (
      minimumOverdueDays !== null &&
      (!Number.isInteger(minimumOverdueDays) || minimumOverdueDays < 1 || minimumOverdueDays > 3650)
    ) {
      errors.push({ field: 'minimum_overdue_days', message: 'Số ngày quá hạn từ 1 đến 3650' });
    }
    const filter = { orgUnitId: optionalUuid(query, 'org_unit_id', errors), minimumOverdueDays };
    check(errors);
    return this.reports.debtsReport(currentUser, filter);
  }

  @Get('reports/cash-flow')
  cashFlow(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const flowType = query.flow_type;
    if (flowType !== undefined && flowType !== '' && flowType !== 'income' && flowType !== 'expense') {
      errors.push({ field: 'flow_type', message: 'Loại thu chi là income hoặc expense' });
    }
    const filter = {
      orgUnitId: optionalUuid(query, 'org_unit_id', errors),
      ...dateRange(query, errors),
      flowType: flowType === 'income' || flowType === 'expense' ? (flowType as 'income' | 'expense') : null,
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

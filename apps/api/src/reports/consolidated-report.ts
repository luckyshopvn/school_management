import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApplicationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { monthRange } from '../staff-attendance/staff-attendance.service.js';
import { check, month, uuidList, type QueryValues } from './report-filters.js';
import { ReportsService } from './reports.service.js';

// Báo cáo hợp nhất nhiều đơn vị (P17-11; BR-01; YCTD-83): so sánh chỉ số của tháng giữa các đơn vị đã chọn, kèm dòng tổng
// toàn bộ đơn vị đã chọn. Kết quả chỉ có số liệu tổng hợp theo đơn vị, không có tên hay mã của trẻ, phụ huynh, nhân sự,
// nên cán bộ quản lý cấp trên (VT-19) xem được mà không thấy dữ liệu cá nhân
export interface ConsolidatedUnitRow {
  org_unit_id: string | null;
  org_unit_code: string;
  org_unit_name: string;
  unit_type: string;
  children_count: number;
  classes_count: number;
  staff_count: number;
  attendance_present_count: number;
  attendance_record_count: number;
  attendance_rate_percent: number | null;
  tuition_payable_amount: number;
  tuition_paid_amount: number;
  tuition_outstanding_amount: number;
  tuition_collection_percent: number | null;
  debt_outstanding_amount: number;
  debt_overdue_amount: number;
  income_amount: number;
  expense_amount: number;
  difference_amount: number;
}

const SUM_KEYS = [
  'children_count',
  'classes_count',
  'staff_count',
  'attendance_present_count',
  'attendance_record_count',
  'tuition_payable_amount',
  'tuition_paid_amount',
  'tuition_outstanding_amount',
  'debt_outstanding_amount',
  'debt_overdue_amount',
  'income_amount',
  'expense_amount',
  'difference_amount',
] as const;

const percent = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : null);

@Injectable()
export class ConsolidatedReportService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
  ) {}

  async report(currentUser: CurrentUser, filter: { month: string; orgUnitIds: string[] }) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.consolidatedReport, null, false);
    const outside = filter.orgUnitIds.filter((id) => !scope.orgUnitIds.includes(id));
    if (outside.length > 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Có đơn vị nằm ngoài phạm vi của bạn');
    }
    const selected = filter.orgUnitIds.length > 0 ? filter.orgUnitIds : scope.orgUnitIds;
    const { database } = await this.currentSchoolYear.require();
    const units = await database
      .selectFrom('org_units')
      .select(['id', 'code', 'name', 'unit_type'])
      .where('id', 'in', selected)
      .orderBy('unit_type', 'desc')
      .orderBy('code')
      .execute();
    const { from, to } = monthRange(filter.month);
    const rows: ConsolidatedUnitRow[] = [];
    for (const unit of units) {
      const dashboard = await this.reports.dashboardForUnits([unit.id], filter.month);
      const cash = await this.reports.cashFlowForUnits([unit.id], { from, to, flowType: null, createdBy: null });
      rows.push({
        org_unit_id: unit.id,
        org_unit_code: unit.code,
        org_unit_name: unit.name,
        unit_type: unit.unit_type,
        children_count: dashboard.children_count,
        classes_count: dashboard.classes_count,
        staff_count: dashboard.staff_count,
        attendance_present_count: dashboard.attendance.present_count,
        attendance_record_count: dashboard.attendance.record_count,
        attendance_rate_percent: dashboard.attendance.rate_percent,
        tuition_payable_amount: dashboard.tuition.payable_amount,
        tuition_paid_amount: dashboard.tuition.paid_amount,
        tuition_outstanding_amount: dashboard.tuition.outstanding_amount,
        tuition_collection_percent: percent(dashboard.tuition.paid_amount, dashboard.tuition.payable_amount),
        debt_outstanding_amount: dashboard.debt.outstanding_amount,
        debt_overdue_amount: dashboard.debt.overdue_amount,
        income_amount: cash.totals.income_amount,
        expense_amount: cash.totals.expense_amount,
        difference_amount: cash.totals.difference_amount,
      });
    }
    const totals = Object.fromEntries(
      SUM_KEYS.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)]),
    ) as Record<(typeof SUM_KEYS)[number], number>;
    return {
      month: filter.month,
      units: rows,
      totals: {
        ...totals,
        attendance_rate_percent: percent(totals.attendance_present_count, totals.attendance_record_count),
        tuition_collection_percent: percent(totals.tuition_paid_amount, totals.tuition_payable_amount),
      },
    };
  }
}

@Controller('reports')
export class ConsolidatedReportController {
  constructor(private readonly consolidated: ConsolidatedReportService) {}

  @Get('consolidated')
  consolidatedReport(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = { month: month(query, errors), orgUnitIds: uuidList(query, 'org_unit_ids', errors) };
    check(errors);
    return this.consolidated.report(currentUser, filter);
  }
}

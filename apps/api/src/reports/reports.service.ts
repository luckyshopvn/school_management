import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { DebtsService } from '../fees/debts.service.js';
import { invoiceAmounts } from '../fees/invoice-amounts.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { monthRange, StaffAttendanceService } from '../staff-attendance/staff-attendance.service.js';
import { TimesheetsService } from '../staff-attendance/timesheets.service.js';

// Bảng điều khiển và báo cáo cơ bản (P17-01 đến P17-07, P17-13, P17-14; BR-01, BR-12, BR-33, BR-36, BR-39, BR-84;
// YCTD-62). Số liệu tính trực tiếp từ dữ liệu gốc của năm học đang mở, lọc theo đơn vị trong phạm vi người xem; giáo viên
// chỉ thấy điểm danh và sinh nhật của lớp được phân công
const PRESENT_STATUSES = ['present', 'late', 'early_leave', 'late_and_early_leave'];
const ACTIVE_DOCUMENT_STATUSES = ['issued', 'pending_reversal'] as const;

interface UnitScope {
  orgUnitIds: string[];
  classIds: string[] | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly debts: DebtsService,
    private readonly attendance: StaffAttendanceService,
    private readonly timesheets: TimesheetsService,
    private readonly clock: Clock,
  ) {}

  // P17-01, P17-02: số trẻ, số lớp, số nhân sự, học phí của tháng, công nợ, tỷ lệ đi học
  async dashboard(
    currentUser: CurrentUser,
    kind: 'leadership' | 'unit',
    filter: { orgUnitId: string | null; month: string },
  ) {
    const permission = kind === 'leadership' ? PERMISSION_CODES.leadershipDashboard : PERMISSION_CODES.unitDashboard;
    const { orgUnitIds } = await this.unitScope(currentUser, permission, filter.orgUnitId, false);
    return this.dashboardForUnits(orgUnitIds, filter.month);
  }

  // Số liệu bảng điều khiển của các đơn vị đã kiểm tra phạm vi; dùng cả cho đối tác đọc báo cáo tổng hợp (YCTD-63)
  async dashboardForUnits(orgUnitIds: string[], monthText: string) {
    const filter = { month: monthText };
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(filter.month);
    const [year, month] = filter.month.split('-').map(Number) as [number, number];
    const children = await database
      .selectFrom('children')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('org_unit_id', 'in', orgUnitIds)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const classes = await database
      .selectFrom('classes')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('org_unit_id', 'in', orgUnitIds)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const staff = await database
      .selectFrom('staff')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('org_unit_id', 'in', orgUnitIds)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    const invoices = await database
      .selectFrom('invoices')
      .select(['id', 'total_amount'])
      .where('org_unit_id', 'in', orgUnitIds)
      .where('status', '=', 'issued')
      .where('period_year', '=', year)
      .where('period_month', '=', month)
      .execute();
    const amounts = [...(await invoiceAmounts(database, invoices)).values()];
    let outstanding = 0;
    let overdue = 0;
    for (const orgUnitId of orgUnitIds) {
      for (const row of await this.debts.unitRows({ orgUnitId, classId: null, overdueOnly: false })) {
        outstanding += row.outstanding_amount;
        overdue += row.overdue_amount;
      }
    }
    const attendance = await this.attendanceCounts(database, { orgUnitIds, classIds: null }, from, to);
    const presents = attendance.reduce((sum, row) => sum + row.present, 0);
    const total = attendance.reduce((sum, row) => sum + row.total, 0);
    return {
      month: filter.month,
      org_unit_ids: orgUnitIds,
      children_count: Number(children.count),
      classes_count: Number(classes.count),
      staff_count: Number(staff.count),
      tuition: {
        invoice_count: invoices.length,
        payable_amount: amounts.reduce((sum, row) => sum + row.payable_amount, 0),
        paid_amount: amounts.reduce((sum, row) => sum + row.paid_amount, 0),
        outstanding_amount: amounts.reduce((sum, row) => sum + Math.max(row.outstanding_amount, 0), 0),
      },
      debt: { outstanding_amount: outstanding, overdue_amount: overdue },
      attendance: {
        present_count: presents,
        record_count: total,
        rate_percent: total ? Math.round((presents * 1000) / total) / 10 : null,
      },
    };
  }

  // P17-13: trẻ đang học có ngày sinh trong tháng
  async birthdays(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; classId: string | null; month: string },
  ) {
    const scope = await this.unitScope(currentUser, PERMISSION_CODES.birthdayView, filter.orgUnitId, true);
    const { database } = await this.currentSchoolYear.require();
    const monthNumber = Number(filter.month.slice(5, 7));
    let query = database
      .selectFrom('children')
      .innerJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'classes.id as class_id',
        'classes.name as class_name',
      ])
      .where('children.status', '=', 'active')
      .where('children.org_unit_id', 'in', scope.orgUnitIds)
      .where(sql<number>`extract(month from children.dob)`, '=', monthNumber)
      .orderBy('classes.name')
      .orderBy('children.dob');
    if (scope.classIds) {
      query = query.where(
        'classes.id',
        'in',
        scope.classIds.length ? scope.classIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    if (filter.classId) {
      query = query.where('classes.id', '=', filter.classId);
    }
    const rows = await query.execute();
    const year = Number(filter.month.slice(0, 4));
    return rows
      .map((row) => ({ ...row, turning_age: year - Number(row.dob.slice(0, 4)) }))
      .sort((left, right) => left.dob.slice(5).localeCompare(right.dob.slice(5)));
  }

  // P17-03: học phí của kỳ theo lớp: phải thu, giảm trừ, điều chỉnh, đã thu, còn phải nộp
  async tuition(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; month: string; gradeLevel: string | null },
  ) {
    const { orgUnitIds } = await this.unitScope(currentUser, PERMISSION_CODES.tuitionReport, filter.orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const [year, month] = filter.month.split('-').map(Number) as [number, number];
    let query = database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'invoices.id',
        'invoices.total_amount',
        'invoices.invoice_kind',
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.grade_level',
      ])
      .where('invoices.org_unit_id', 'in', orgUnitIds)
      .where('invoices.status', '=', 'issued')
      .where('invoices.period_year', '=', year)
      .where('invoices.period_month', '=', month);
    if (filter.gradeLevel) {
      query = query.where('classes.grade_level', '=', filter.gradeLevel);
    }
    const rows = await query.execute();
    const amounts = await invoiceAmounts(database, rows);
    const groups = new Map<string, Record<string, number | string | null>>();
    for (const row of rows) {
      const key = row.class_id ?? 'none';
      const amount = amounts.get(row.id);
      const group = groups.get(key) ?? {
        class_id: row.class_id,
        class_name: row.class_name ?? 'Chưa xếp lớp',
        grade_level: row.grade_level,
        invoice_count: 0,
        total_amount: 0,
        discount_amount: 0,
        adjustment_amount: 0,
        payable_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0,
      };
      group.invoice_count = Number(group.invoice_count) + 1;
      group.total_amount = Number(group.total_amount) + Number(row.total_amount);
      group.discount_amount = Number(group.discount_amount) + (amount?.discount_amount ?? 0);
      group.adjustment_amount = Number(group.adjustment_amount) + (amount?.adjustment_amount ?? 0);
      group.payable_amount = Number(group.payable_amount) + (amount?.payable_amount ?? 0);
      group.paid_amount = Number(group.paid_amount) + (amount?.paid_amount ?? 0);
      group.outstanding_amount = Number(group.outstanding_amount) + Math.max(amount?.outstanding_amount ?? 0, 0);
      groups.set(key, group);
    }
    const classes = [...groups.values()].sort((left, right) =>
      String(left.class_name).localeCompare(String(right.class_name), 'vi'),
    );
    return { month: filter.month, classes, totals: this.totals(classes) };
  }

  // P17-04: công nợ theo trẻ và theo lớp, lọc theo số ngày quá hạn tối thiểu
  async debtsReport(currentUser: CurrentUser, filter: { orgUnitId: string | null; minimumOverdueDays: number | null }) {
    const { orgUnitIds } = await this.unitScope(currentUser, PERMISSION_CODES.debtReport, filter.orgUnitId, false);
    return this.debtsForUnits(orgUnitIds, filter.minimumOverdueDays);
  }

  async debtsForUnits(orgUnitIds: string[], minimumOverdueDays: number | null) {
    const filter = { minimumOverdueDays };
    const children = [];
    for (const orgUnitId of orgUnitIds) {
      for (const row of await this.debts.unitRows({ orgUnitId, classId: null, overdueOnly: false })) {
        if (row.balance_amount <= 0 && row.outstanding_amount <= 0) {
          continue;
        }
        if (
          filter.minimumOverdueDays !== null &&
          (row.overdue_amount <= 0 || row.overdue_days < filter.minimumOverdueDays)
        ) {
          continue;
        }
        children.push({ ...row, org_unit_id: orgUnitId });
      }
    }
    const classes = new Map<string, Record<string, number | string | null>>();
    for (const row of children) {
      const key = row.class_id ?? 'none';
      const group = classes.get(key) ?? {
        class_id: row.class_id,
        class_name: row.class_name ?? 'Chưa xếp lớp',
        child_count: 0,
        outstanding_amount: 0,
        overdue_amount: 0,
        credit_amount: 0,
      };
      group.child_count = Number(group.child_count) + 1;
      group.outstanding_amount = Number(group.outstanding_amount) + row.outstanding_amount;
      group.overdue_amount = Number(group.overdue_amount) + row.overdue_amount;
      group.credit_amount = Number(group.credit_amount) + row.credit_amount;
      classes.set(key, group);
    }
    return {
      children,
      classes: [...classes.values()],
      totals: {
        outstanding_amount: children.reduce((sum, row) => sum + row.outstanding_amount, 0),
        overdue_amount: children.reduce((sum, row) => sum + row.overdue_amount, 0),
        credit_amount: children.reduce((sum, row) => sum + row.credit_amount, 0),
      },
    };
  }

  // P17-05: thu, chi, chênh lệch theo khoản mục; lọc đơn vị, khoảng ngày, loại thu chi, người lập (BR-36)
  async cashFlow(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      from: string;
      to: string;
      flowType: 'income' | 'expense' | null;
      createdBy: string | null;
    },
  ) {
    const { orgUnitIds } = await this.unitScope(currentUser, PERMISSION_CODES.cashFlowReport, filter.orgUnitId, false);
    return this.cashFlowForUnits(orgUnitIds, filter);
  }

  async cashFlowForUnits(
    orgUnitIds: string[],
    filter: { from: string; to: string; flowType: 'income' | 'expense' | null; createdBy: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const documents: Array<{
      flow_type: 'income' | 'expense';
      id: string;
      code: string | null;
      document_date: string;
      amount: number;
      category_id: string;
      category_name: string;
      org_unit_id: string;
      created_by: string;
      party: string;
    }> = [];
    if (filter.flowType !== 'expense') {
      let receipts = database
        .selectFrom('receipts')
        .innerJoin('cashflow_categories', 'cashflow_categories.id', 'receipts.category_id')
        .select([
          'receipts.id',
          'receipts.code',
          'receipts.receipt_date',
          'receipts.amount',
          'receipts.category_id',
          'cashflow_categories.name as category_name',
          'receipts.org_unit_id',
          'receipts.created_by',
          'receipts.payer_name',
        ])
        .where('receipts.org_unit_id', 'in', orgUnitIds)
        .where('receipts.status', 'in', ACTIVE_DOCUMENT_STATUSES)
        .where('receipts.receipt_date', '>=', filter.from)
        .where('receipts.receipt_date', '<=', filter.to);
      if (filter.createdBy) {
        receipts = receipts.where('receipts.created_by', '=', filter.createdBy);
      }
      for (const row of await receipts.execute()) {
        documents.push({
          flow_type: 'income',
          id: row.id,
          code: row.code,
          document_date: row.receipt_date,
          amount: Number(row.amount),
          category_id: row.category_id,
          category_name: row.category_name,
          org_unit_id: row.org_unit_id,
          created_by: row.created_by,
          party: row.payer_name,
        });
      }
    }
    if (filter.flowType !== 'income') {
      let payments = database
        .selectFrom('payments')
        .innerJoin('cashflow_categories', 'cashflow_categories.id', 'payments.category_id')
        .select([
          'payments.id',
          'payments.code',
          'payments.payment_date',
          'payments.amount',
          'payments.category_id',
          'cashflow_categories.name as category_name',
          'payments.org_unit_id',
          'payments.created_by',
          'payments.payee_name',
        ])
        .where('payments.org_unit_id', 'in', orgUnitIds)
        .where('payments.status', 'in', ACTIVE_DOCUMENT_STATUSES)
        .where('payments.payment_date', '>=', filter.from)
        .where('payments.payment_date', '<=', filter.to);
      if (filter.createdBy) {
        payments = payments.where('payments.created_by', '=', filter.createdBy);
      }
      for (const row of await payments.execute()) {
        documents.push({
          flow_type: 'expense',
          id: row.id,
          code: row.code,
          document_date: row.payment_date ?? '',
          amount: Number(row.amount),
          category_id: row.category_id,
          category_name: row.category_name,
          org_unit_id: row.org_unit_id,
          created_by: row.created_by,
          party: row.payee_name,
        });
      }
    }
    documents.sort((left, right) => left.document_date.localeCompare(right.document_date));
    const categories = new Map<
      string,
      { flow_type: string; category_id: string; category_name: string; count: number; amount: number }
    >();
    for (const document of documents) {
      const key = `${document.flow_type}:${document.category_id}`;
      const group = categories.get(key) ?? {
        flow_type: document.flow_type,
        category_id: document.category_id,
        category_name: document.category_name,
        count: 0,
        amount: 0,
      };
      group.count += 1;
      group.amount += document.amount;
      categories.set(key, group);
    }
    const income = documents.filter((row) => row.flow_type === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expense = documents.filter((row) => row.flow_type === 'expense').reduce((sum, row) => sum + row.amount, 0);
    return {
      from: filter.from,
      to: filter.to,
      categories: [...categories.values()],
      documents,
      totals: { income_amount: income, expense_amount: expense, difference_amount: income - expense },
    };
  }

  // P17-06: tỷ lệ đi học theo lớp và danh sách trẻ vắng
  async attendanceReport(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; classId: string | null; from: string; to: string },
  ) {
    const scope = await this.unitScope(currentUser, PERMISSION_CODES.attendanceReport, filter.orgUnitId, true);
    const { database } = await this.currentSchoolYear.require();
    const classScope = {
      ...scope,
      classIds: filter.classId
        ? [filter.classId].filter((id) => !scope.classIds || scope.classIds.includes(id))
        : scope.classIds,
    };
    const counts = await this.attendanceCounts(database, classScope, filter.from, filter.to);
    let absences = database
      .selectFrom('attendance_records')
      .innerJoin('children', 'children.id', 'attendance_records.child_id')
      .innerJoin('classes', 'classes.id', 'attendance_records.class_id')
      .select([
        'attendance_records.attendance_date',
        'attendance_records.status',
        'attendance_records.note',
        'children.full_name',
        'classes.name as class_name',
      ])
      .where('attendance_records.org_unit_id', 'in', scope.orgUnitIds)
      .where('attendance_records.attendance_date', '>=', filter.from)
      .where('attendance_records.attendance_date', '<=', filter.to)
      .where('attendance_records.status', 'in', ['absent_notified', 'absent_unnotified']);
    if (classScope.classIds) {
      absences = absences.where('attendance_records.class_id', 'in', this.nonEmpty(classScope.classIds));
    }
    return {
      classes: counts.map((row) => ({
        ...row,
        rate_percent: row.total ? Math.round((row.present * 1000) / row.total) / 10 : null,
      })),
      absences: await absences
        .orderBy('attendance_records.attendance_date')
        .orderBy('classes.name')
        .orderBy('children.full_name')
        .execute(),
    };
  }

  // P17-07: ngày đi làm, nghỉ theo đơn, vắng, số lần đi muộn, về sớm, giờ làm thêm của nhân sự theo tháng
  async staffAttendanceReport(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; month: string; departmentId: string | null },
  ) {
    const { orgUnitIds } = await this.unitScope(
      currentUser,
      PERMISSION_CODES.staffAttendanceReport,
      filter.orgUnitId,
      false,
    );
    const { database } = await this.currentSchoolYear.require();
    const { from, to } = monthRange(filter.month);
    const today = VIETNAM_DATE.format(this.clock.now());
    const until = to < today ? to : today;
    const result = [];
    if (from > until) {
      return { month: filter.month, staff: [] };
    }
    for (const orgUnitId of orgUnitIds) {
      let staffQuery = database
        .selectFrom('staff')
        .leftJoin('departments', 'departments.id', 'staff.department_id')
        .select(['staff.id', 'staff.code', 'staff.full_name', 'departments.name as department_name'])
        .where('staff.org_unit_id', '=', orgUnitId);
      if (filter.departmentId) {
        staffQuery = staffQuery.where('staff.department_id', '=', filter.departmentId);
      }
      const staff = await staffQuery.orderBy('staff.full_name').execute();
      if (staff.length === 0) {
        continue;
      }
      const days = await this.timesheets.buildDays(
        database,
        orgUnitId,
        from,
        until,
        await this.attendance.workHours(orgUnitId),
      );
      for (const person of staff) {
        const own = days.filter((day) => day.staff_id === person.id);
        if (own.length === 0) {
          continue;
        }
        result.push({
          ...person,
          org_unit_id: orgUnitId,
          present_days: own.filter((day) => day.status === 'present').reduce((sum, day) => sum + 1 - day.leave_days, 0),
          leave_days: own.reduce((sum, day) => sum + day.leave_days, 0),
          absent_days: own.reduce((sum, day) => sum + day.absent_days, 0),
          late_count: own.filter((day) => (day.late_minutes ?? 0) > 0).length,
          early_leave_count: own.filter((day) => (day.early_leave_minutes ?? 0) > 0).length,
          overtime_minutes: own.reduce((sum, day) => sum + day.overtime_minutes, 0),
        });
      }
    }
    return { month: filter.month, until, staff: result };
  }

  // P17-14: các ngày thứ bảy học bù trong khoảng và số trẻ đi học, vắng của từng ngày theo lớp
  async saturdayReport(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; classId: string | null; from: string; to: string },
  ) {
    const scope = await this.unitScope(currentUser, PERMISSION_CODES.saturdayReport, filter.orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const makeupDays = await database
      .selectFrom('school_day_changes')
      .select(['change_date', 'note'])
      .where('change_type', '=', 'makeup_school_day')
      .where('change_date', '>=', filter.from)
      .where('change_date', '<=', filter.to)
      .orderBy('change_date')
      .execute();
    const result = [];
    for (const day of makeupDays) {
      const counts = await this.attendanceCounts(
        database,
        { orgUnitIds: scope.orgUnitIds, classIds: filter.classId ? [filter.classId] : null },
        day.change_date,
        day.change_date,
      );
      result.push({
        date: day.change_date,
        note: day.note,
        classes: counts,
        present_count: counts.reduce((sum, row) => sum + row.present, 0),
        absent_count: counts.reduce((sum, row) => sum + row.absent_notified + row.absent_unnotified, 0),
      });
    }
    return { days: result };
  }

  private async attendanceCounts(database: Kysely<SchoolYearDatabase>, scope: UnitScope, from: string, to: string) {
    let query = database
      .selectFrom('attendance_records')
      .innerJoin('classes', 'classes.id', 'attendance_records.class_id')
      .select(['attendance_records.class_id', 'classes.name as class_name', 'attendance_records.status'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('attendance_records.org_unit_id', 'in', scope.orgUnitIds)
      .where('attendance_records.attendance_date', '>=', from)
      .where('attendance_records.attendance_date', '<=', to)
      .groupBy(['attendance_records.class_id', 'classes.name', 'attendance_records.status']);
    if (scope.classIds) {
      query = query.where('attendance_records.class_id', 'in', this.nonEmpty(scope.classIds));
    }
    const rows = await query.execute();
    const groups = new Map<
      string,
      {
        class_id: string;
        class_name: string;
        present: number;
        absent_notified: number;
        absent_unnotified: number;
        total: number;
      }
    >();
    for (const row of rows) {
      const group = groups.get(row.class_id) ?? {
        class_id: row.class_id,
        class_name: row.class_name,
        present: 0,
        absent_notified: 0,
        absent_unnotified: 0,
        total: 0,
      };
      const count = Number(row.count);
      group.total += count;
      if (PRESENT_STATUSES.includes(row.status)) {
        group.present += count;
      } else if (row.status === 'absent_notified') {
        group.absent_notified += count;
      } else {
        group.absent_unnotified += count;
      }
      groups.set(row.class_id, group);
    }
    return [...groups.values()].sort((left, right) => left.class_name.localeCompare(right.class_name, 'vi'));
  }

  // Đơn vị trong phạm vi quyền; giáo viên không có quyền thì xem theo lớp được phân công nếu báo cáo cho phép
  private async unitScope(
    currentUser: CurrentUser,
    permission: string,
    orgUnitId: string | null,
    allowTeacherClasses: boolean,
  ): Promise<UnitScope> {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    let units: string[];
    let classIds: string[] | null = null;
    if (scope.wholeSchool) {
      units = (await database.selectFrom('org_units').select('id').execute()).map((row) => row.id);
    } else if (scope.orgUnitIds.length > 0) {
      units = scope.orgUnitIds;
    } else if (allowTeacherClasses) {
      const classes = await database
        .selectFrom('class_staff_assignments')
        .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
        .select(['classes.id', 'classes.org_unit_id'])
        .where('class_staff_assignments.staff_user_id', '=', currentUser.id)
        .where('class_staff_assignments.status', '=', 'active')
        .execute();
      if (classes.length === 0) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem báo cáo này');
      }
      units = [...new Set(classes.map((row) => row.org_unit_id))];
      classIds = classes.map((row) => row.id);
    } else {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem báo cáo này');
    }
    if (orgUnitId) {
      if (!units.includes(orgUnitId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
      }
      units = [orgUnitId];
    }
    if (units.length === 0) {
      throw validationError([{ field: 'org_unit_id', message: 'Chưa có đơn vị nào' }]);
    }
    return { orgUnitIds: units, classIds };
  }

  private nonEmpty(ids: string[]): string[] {
    return ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'];
  }

  private totals(rows: Array<Record<string, number | string | null>>) {
    const keys = [
      'invoice_count',
      'total_amount',
      'discount_amount',
      'adjustment_amount',
      'payable_amount',
      'paid_amount',
      'outstanding_amount',
    ];
    return Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)]));
  }
}

import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import { monthRange, StaffAttendanceService } from '../staff-attendance/staff-attendance.service.js';
import { calculatePayslip, type PayItemAssignment, type TimesheetTotals } from './payroll-calculation.js';

// Bảng lương toàn trường theo tháng (P08-06, P08-08; BR-43, BR-44, BR-45, BR-46, BR-77, BR-82; YCTD-60). Đầu tháng M kế
// toán tính phần trả trước của tháng M kèm điều chỉnh theo bảng công đã chốt của tháng M−1; chặn khi còn đơn vị chưa
// chốt công tháng M−1. Ngày công chuẩn là số ngày làm việc của tháng M−1 theo lịch. Duyệt theo hạn mức bảng lương của
// Trường chính; duyệt xong phiếu lương hiện cho từng nhân sự và không sửa trực tiếp được nữa
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const PRINCIPAL_ROLE = 'VT-02';

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly attendance: StaffAttendanceService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser) {
    await this.viewScope(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('payrolls')
      .select(['id', 'period_year', 'period_month', 'status', 'total_net', 'requires_principal', 'approved_at'])
      .orderBy('period_year', 'desc')
      .orderBy('period_month', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, total_net: Number(row.total_net) }));
  }

  // Bảng lương kèm phiếu của nhân sự trong phạm vi người xem
  async read(currentUser: CurrentUser, payrollId: string) {
    const scope = await this.viewScope(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const payroll = await database.selectFrom('payrolls').selectAll().where('id', '=', payrollId).executeTakeFirst();
    if (!payroll) {
      throw notFoundError('Không tìm thấy bảng lương', 'payroll');
    }
    let query = database
      .selectFrom('payslips')
      .innerJoin('staff', 'staff.id', 'payslips.staff_id')
      .innerJoin('org_units', 'org_units.id', 'payslips.org_unit_id')
      .selectAll('payslips')
      .select(['staff.full_name', 'staff.code', 'org_units.name as unit_name'])
      .where('payslips.payroll_id', '=', payrollId);
    if (!scope.wholeSchool) {
      query = query.where('payslips.org_unit_id', 'in', scope.orgUnitIds);
    }
    const payslips = await query.orderBy('org_units.name').orderBy('staff.full_name').execute();
    const lines =
      payslips.length === 0
        ? []
        : await database
            .selectFrom('payslip_lines')
            .selectAll()
            .where(
              'payslip_id',
              'in',
              payslips.map((row) => row.id),
            )
            .orderBy('order_no')
            .execute();
    return {
      ...payroll,
      total_net: Number(payroll.total_net),
      can_manage: currentUser.hasPermission(PERMISSION_CODES.payrollManage),
      can_approve: await this.canApprove(currentUser, payroll.requires_principal),
      skipped: payroll.skipped.filter((row) => scope.wholeSchool || scope.orgUnitIds.includes(row.org_unit_id)),
      payslips: payslips.map((payslip) => ({
        ...this.moneyView(payslip),
        lines: lines
          .filter((line) => line.payslip_id === payslip.id)
          .map((line) => ({ ...line, amount: Number(line.amount) })),
      })),
    };
  }

  // Phiếu lương đã duyệt của chính mình (BR-46)
  async mine(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    const payslips = await database
      .selectFrom('payslips')
      .innerJoin('payrolls', 'payrolls.id', 'payslips.payroll_id')
      .selectAll('payslips')
      .select(['payrolls.period_year', 'payrolls.period_month'])
      .where('payslips.staff_id', '=', staff.id)
      .where('payrolls.status', '=', 'approved')
      .orderBy('payrolls.period_year', 'desc')
      .orderBy('payrolls.period_month', 'desc')
      .execute();
    const lines =
      payslips.length === 0
        ? []
        : await database
            .selectFrom('payslip_lines')
            .selectAll()
            .where(
              'payslip_id',
              'in',
              payslips.map((row) => row.id),
            )
            .orderBy('order_no')
            .execute();
    return payslips.map((payslip) => ({
      ...this.moneyView(payslip),
      lines: lines
        .filter((line) => line.payslip_id === payslip.id)
        .map((line) => ({ ...line, amount: Number(line.amount) })),
    }));
  }

  // Tính hoặc tính lại bảng lương còn nháp của tháng M
  async calculate(currentUser: CurrentUser, month: string, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán được tính bảng lương');
    }
    const { from } = monthRange(month);
    if (VIETNAM_DATE.format(this.clock.now()) < from) {
      throw ruleViolationError('BR-43', 'Chỉ tính bảng lương từ ngày 1 của tháng đó');
    }
    const { database } = await this.currentSchoolYear.require();
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    const existing = await database
      .selectFrom('payrolls')
      .select(['id', 'status'])
      .where('period_year', '=', year)
      .where('period_month', '=', monthNumber)
      .executeTakeFirst();
    if (existing && existing.status !== 'draft') {
      throw ruleViolationError(
        'BR-45',
        'Bảng lương đã trình duyệt hoặc đã duyệt, không tính lại được; sai thì điều chỉnh ở kỳ sau',
      );
    }
    const computed = await this.compute(database, month);
    const total = computed.payslips.reduce((sum, payslip) => sum + payslip.result.net_amount, 0);
    const payrollId = await database.transaction().execute(async (transaction) => {
      const values = {
        status: 'draft' as const,
        total_net: total,
        tax_table_id: computed.taxTableId,
        skipped: JSON.stringify(computed.skipped),
        calculated_by: origin.actorUserId,
        calculated_at: this.clock.now(),
        return_reason: null,
      };
      const saved = existing
        ? await transaction
            .updateTable('payrolls')
            .set({ ...values, updated_at: this.clock.now() })
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('payrolls')
            .values({ ...values, period_year: year, period_month: monthNumber })
            .returning('id')
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('payslips').where('payroll_id', '=', saved.id).execute();
      for (const payslip of computed.payslips) {
        const row = await transaction
          .insertInto('payslips')
          .values({
            payroll_id: saved.id,
            staff_id: payslip.staffId,
            org_unit_id: payslip.orgUnitId,
            contract_id: payslip.contractId,
            prepaid_amount: payslip.result.prepaid_amount,
            adjustment_amount: payslip.result.adjustment_amount,
            taxable_income: payslip.result.taxable_income,
            tax_amount: payslip.result.tax_amount,
            net_amount: payslip.result.net_amount,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (payslip.result.lines.length > 0) {
          await transaction
            .insertInto('payslip_lines')
            .values(
              payslip.result.lines.map((line, index) => ({
                payslip_id: row.id,
                section: line.section,
                line_type: line.line_type,
                code: line.code,
                name: line.name,
                amount: line.amount,
                basis: line.basis,
                order_no: index,
              })),
            )
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payrolls',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ? { status: 'draft' } : null,
        after: { month, payslips: computed.payslips.length, total_net: total, skipped: computed.skipped.length },
      });
      return saved.id;
    });
    return this.read(currentUser, payrollId);
  }

  async submit(currentUser: CurrentUser, payrollId: string, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán được trình bảng lương');
    }
    const { database } = await this.currentSchoolYear.require();
    const payroll = await this.load(database, payrollId);
    if (payroll.status !== 'draft') {
      throw ruleViolationError('BR-77', 'Bảng lương này không còn nháp');
    }
    const root = await this.root(database);
    const threshold = root
      ? await database
          .selectFrom('approval_thresholds')
          .select('threshold_amount')
          .where('org_unit_id', '=', root.id)
          .where('document_type', '=', 'payroll')
          .where('status', '=', 'active')
          .executeTakeFirst()
      : undefined;
    const requiresPrincipal = !threshold || Number(payroll.total_net) >= Number(threshold.threshold_amount);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payrolls')
        .set({
          status: 'pending',
          requires_principal: requiresPrincipal,
          submitted_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', payrollId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payrolls',
        entityId: payrollId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'pending', requires_principal: requiresPrincipal },
      });
      if (root) {
        await queueNotification(transaction, {
          orgUnitId: root.id,
          templateCode: 'payroll_submitted',
          title: 'Bảng lương cần phê duyệt',
          body: `Bảng lương tháng ${payroll.period_month}/${payroll.period_year}, tổng thực nhận ${Number(payroll.total_net).toLocaleString('vi-VN')} đồng`,
          targetType: 'payrolls',
          targetId: payrollId,
          recipients: [
            ...(requiresPrincipal ? [] : [{ roleCode: 'VT-15', orgUnitId: root.id, channel: 'in_app' as const }]),
            { roleCode: PRINCIPAL_ROLE, orgUnitId: root.id, channel: 'in_app' },
          ],
        });
      }
    });
    return this.read(currentUser, payrollId);
  }

  // Duyệt thì công bố phiếu lương; trả lại thì bảng lương về nháp kèm lý do
  async decide(
    currentUser: CurrentUser,
    payrollId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const payroll = await this.load(database, payrollId);
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollApprove)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền phê duyệt bảng lương');
    }
    if (payroll.status !== 'pending') {
      throw ruleViolationError('BR-77', 'Bảng lương này không chờ duyệt');
    }
    if (!(await this.canApprove(currentUser, payroll.requires_principal))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        payroll.requires_principal
          ? 'Bảng lương từ hạn mức trở lên hoặc chưa cấu hình hạn mức, cần Hiệu trưởng duyệt'
          : 'Phó Hiệu trưởng phải được gán ở Trường chính mới duyệt được bảng lương toàn trường',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payrolls')
        .set(
          decision.approve
            ? {
                status: 'approved',
                approved_by: origin.actorUserId,
                approved_at: this.clock.now(),
                updated_at: this.clock.now(),
              }
            : { status: 'draft', return_reason: decision.reason, submitted_at: null, updated_at: this.clock.now() },
        )
        .where('id', '=', payrollId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payrolls',
        entityId: payrollId,
        action: 'update',
        before: { status: 'pending' },
        after: decision.approve ? { status: 'approved' } : { status: 'draft', return_reason: decision.reason },
      });
      const root = await this.root(transaction);
      if (decision.approve) {
        const users = await transaction
          .selectFrom('payslips')
          .innerJoin('staff', 'staff.id', 'payslips.staff_id')
          .select(['staff.user_id', 'payslips.org_unit_id'])
          .where('payslips.payroll_id', '=', payrollId)
          .where('staff.user_id', 'is not', null)
          .execute();
        await queueNotification(transaction, {
          orgUnitId: root?.id ?? null,
          templateCode: 'payslip_published',
          title: 'Đã có phiếu lương',
          body: `Phiếu lương tháng ${payroll.period_month}/${payroll.period_year} đã được công bố`,
          targetType: 'payrolls',
          targetId: payrollId,
          recipients: [
            ...users.map((row) => ({ userId: row.user_id as string, channel: 'in_app' as const })),
            ...(root ? [{ roleCode: 'VT-04', orgUnitId: root.id, channel: 'in_app' as const }] : []),
          ],
        });
      } else if (payroll.calculated_by) {
        await queueNotification(transaction, {
          orgUnitId: root?.id ?? null,
          templateCode: 'payroll_returned',
          title: 'Bảng lương bị trả lại',
          body: `Bảng lương tháng ${payroll.period_month}/${payroll.period_year}: ${decision.reason ?? ''}`,
          targetType: 'payrolls',
          targetId: payrollId,
          recipients: [{ userId: payroll.calculated_by, channel: 'in_app' }],
        });
      }
    });
    return this.read(currentUser, payrollId);
  }

  // Tính phiếu lương của mọi nhân sự cho tháng M
  private async compute(database: Executor, month: string) {
    const { from, to } = monthRange(month);
    const lastMonth = previousMonth(month);
    const last = monthRange(lastMonth);
    const problems: FieldError[] = [];

    // Mọi đơn vị có nhân sự làm việc trong tháng M−1 phải chốt công tháng đó
    const lastMonthStaff = await database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .select(['staff.org_unit_id', 'org_units.name'])
      .where('staff.start_date', '<=', last.to)
      .where((expression) =>
        expression.or([expression('staff.end_date', 'is', null), expression('staff.end_date', '>=', last.from)]),
      )
      .distinct()
      .execute();
    const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number) as [number, number];
    const closedPeriods = await database
      .selectFrom('timesheet_periods')
      .select(['id', 'org_unit_id'])
      .where('period_year', '=', lastYear)
      .where('period_month', '=', lastMonthNumber)
      .where('status', '=', 'closed')
      .execute();
    for (const unit of lastMonthStaff) {
      if (!closedPeriods.some((period) => period.org_unit_id === unit.org_unit_id)) {
        problems.push({
          field: 'timesheet_periods',
          message: `${unit.name} chưa chốt công tháng ${lastMonthNumber}/${lastYear}`,
        });
      }
    }
    if (problems.length > 0) {
      throw ruleViolationError('BR-43', `Còn đơn vị chưa chốt công tháng ${lastMonthNumber}/${lastYear}`, problems);
    }
    const taxTable = await database
      .selectFrom('tax_tables')
      .selectAll()
      .where('effective_from', '<=', from)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();
    if (!taxTable) {
      throw ruleViolationError('BR-44', 'Chưa có biểu thuế hiệu lực cho tháng này');
    }
    const standardDays = [...(await this.calendar.staffDays(last.from, last.to)).values()].filter(
      (day) => day.kind === 'work',
    ).length;

    const staffRows = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'start_date', 'end_date', 'status', 'dependents_count'])
      .where('start_date', '<=', to)
      .where((expression) =>
        expression.or([expression('end_date', 'is', null), expression('end_date', '>=', last.from)]),
      )
      .orderBy('full_name')
      .execute();
    const staffIds = staffRows.map((row) => row.id);
    if (staffIds.length === 0) {
      return { taxTableId: taxTable.id, skipped: [], payslips: [] };
    }
    const contracts = await database
      .selectFrom('employment_contracts')
      .selectAll()
      .where('staff_id', 'in', staffIds)
      .orderBy('start_date', 'desc')
      .execute();
    const days = closedPeriods.length
      ? await database
          .selectFrom('timesheet_days')
          .select(['staff_id', 'status', 'leave_days', 'unpaid_days', 'overtime_minutes'])
          .where(
            'period_id',
            'in',
            closedPeriods.map((period) => period.id),
          )
          .execute()
      : [];
    const assignments = await database
      .selectFrom('staff_pay_items')
      .innerJoin('pay_item_types', 'pay_item_types.id', 'staff_pay_items.pay_item_type_id')
      .select([
        'staff_pay_items.staff_id',
        'staff_pay_items.amount',
        'staff_pay_items.rate_percent',
        'pay_item_types.kind',
        'pay_item_types.code',
        'pay_item_types.name',
        'pay_item_types.calculation_method',
        'pay_item_types.default_amount',
        'pay_item_types.rate_percent as default_rate_percent',
        'pay_item_types.is_tax_exempt',
        'pay_item_types.is_mandatory_insurance',
      ])
      .where('staff_pay_items.staff_id', 'in', staffIds)
      .where('pay_item_types.status', '=', 'active')
      .orderBy('pay_item_types.kind')
      .orderBy('pay_item_types.code')
      .execute();
    const unitHours = new Map<string, { standardMinutes: number; overtimeRatePercent: number | null }>();
    const hoursOf = async (orgUnitId: string) => {
      const cached = unitHours.get(orgUnitId);
      if (cached) {
        return cached;
      }
      const hours = await this.attendance.workHours(orgUnitId);
      const rate = (await this.settings.effective(orgUnitId)).find(
        (item) => item.key === 'overtime_rate_percent',
      )?.value;
      const value = {
        standardMinutes:
          hours.startMinutes === null || hours.endMinutes === null
            ? 0
            : hours.endMinutes - hours.startMinutes - hours.lunchMinutes,
        overtimeRatePercent: typeof rate === 'number' ? rate : null,
      };
      unitHours.set(orgUnitId, value);
      return value;
    };

    const skipped: Array<{ staff_id: string; org_unit_id: string; full_name: string; reason: string }> = [];
    const payslips = [];
    for (const person of staffRows) {
      // Nhân sự đã chấm dứt hợp đồng được tính ở bảng quyết toán cuối cùng (BR-90)
      if (person.status === 'terminated') {
        skipped.push({
          staff_id: person.id,
          org_unit_id: person.org_unit_id,
          full_name: person.full_name,
          reason: 'Đã chấm dứt hợp đồng, tính ở bảng quyết toán',
        });
        continue;
      }
      const own = contracts.filter((contract) => contract.staff_id === person.id);
      const coversFirstDay = (date: string) =>
        own.find(
          (contract) =>
            contract.start_date <= date &&
            (contract.end_date === null || contract.end_date >= date) &&
            (contract.terminated_on === null || contract.terminated_on >= date),
        );
      // Trả trước tháng M: hợp đồng còn hiệu lực ngày 1 tháng M và nhân sự vào làm trước tháng M (Q-155)
      const prepaidContract = person.start_date <= from ? coversFirstDay(from) : undefined;
      const ownDays = days.filter((day) => day.staff_id === person.id);
      const adjustmentContract = ownDays.length ? own.find((contract) => contract.start_date <= last.to) : undefined;
      if (!prepaidContract && !adjustmentContract) {
        if (person.start_date <= to) {
          skipped.push({
            staff_id: person.id,
            org_unit_id: person.org_unit_id,
            full_name: person.full_name,
            reason: 'Chưa có hợp đồng hiệu lực trong kỳ',
          });
        }
        continue;
      }
      const workdayRows = ownDays.filter((day) => ['present', 'leave', 'absent'].includes(day.status));
      const totals: TimesheetTotals = {
        workdayRows: workdayRows.length,
        unpaidDays: ownDays.reduce((sum, day) => sum + Number(day.unpaid_days), 0),
        workedDays: ownDays
          .filter((day) => day.status === 'present')
          .reduce((sum, day) => sum + 1 - Number(day.leave_days), 0),
        overtimeMinutes: ownDays.reduce((sum, day) => sum + day.overtime_minutes, 0),
      };
      const hours = await hoursOf(person.org_unit_id);
      if (adjustmentContract && totals.overtimeMinutes > 0 && hours.overtimeRatePercent === null) {
        problems.push({
          field: 'overtime_rate_percent',
          message: `${person.full_name}: đơn vị chưa cấu hình hệ số làm thêm giờ`,
        });
      }
      const items: PayItemAssignment[] = assignments
        .filter((item) => item.staff_id === person.id)
        .map((item) => ({
          kind: item.kind,
          code: item.code,
          name: item.name,
          calculation_method: item.calculation_method,
          amount:
            item.amount !== null
              ? Number(item.amount)
              : item.default_amount !== null
                ? Number(item.default_amount)
                : null,
          rate_percent:
            item.rate_percent !== null
              ? Number(item.rate_percent)
              : item.default_rate_percent !== null
                ? Number(item.default_rate_percent)
                : null,
          is_tax_exempt: item.is_tax_exempt,
          is_mandatory_insurance: item.is_mandatory_insurance,
        }));
      const result = calculatePayslip({
        prepaid: prepaidContract
          ? {
              contractNo: prepaidContract.contract_no,
              baseSalary: Number(prepaidContract.base_salary),
              contractAllowances: prepaidContract.allowances,
            }
          : null,
        adjustment: adjustmentContract
          ? {
              contractNo: adjustmentContract.contract_no,
              baseSalary: Number(adjustmentContract.base_salary),
              prepaidLastMonth: person.start_date <= last.from && Boolean(coversFirstDay(last.from)),
              standardDays,
              standardMinutes: hours.standardMinutes,
              overtimeRatePercent: hours.overtimeRatePercent,
              totals,
              month: lastMonth,
            }
          : null,
        items,
        dependents: person.dependents_count,
        taxTable: {
          personal_deduction: Number(taxTable.personal_deduction),
          dependent_deduction: Number(taxTable.dependent_deduction),
          brackets: taxTable.brackets,
        },
      });
      payslips.push({
        staffId: person.id,
        orgUnitId: person.org_unit_id,
        contractId: (prepaidContract ?? adjustmentContract)?.id ?? null,
        result,
      });
    }
    if (problems.length > 0) {
      throw ruleViolationError('BR-82', 'Chưa đủ cấu hình để tính tiền làm thêm giờ', problems);
    }
    return { taxTableId: taxTable.id, skipped, payslips };
  }

  // Hiệu trưởng duyệt mọi bảng lương; Phó Hiệu trưởng gán ở Trường chính duyệt bảng dưới hạn mức
  private async canApprove(currentUser: CurrentUser, requiresPrincipal: boolean): Promise<boolean> {
    const isPrincipal = currentUser.description.assignments.some(
      (assignment) =>
        assignment.role_code === PRINCIPAL_ROLE && assignment.permissions.includes(PERMISSION_CODES.payrollApprove),
    );
    if (isPrincipal) {
      return true;
    }
    if (requiresPrincipal) {
      return false;
    }
    return (await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.payrollApprove)).wholeSchool;
  }

  private async viewScope(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.payrollView);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem bảng lương');
    }
    return scope;
  }

  private async load(database: Executor, payrollId: string) {
    const payroll = await database.selectFrom('payrolls').selectAll().where('id', '=', payrollId).executeTakeFirst();
    if (!payroll) {
      throw notFoundError('Không tìm thấy bảng lương', 'payroll');
    }
    return payroll;
  }

  private root(database: Executor) {
    return database.selectFrom('org_units').select('id').where('unit_type', '=', 'truong_chinh').executeTakeFirst();
  }

  private moneyView<
    Row extends {
      prepaid_amount: string;
      adjustment_amount: string;
      taxable_income: string;
      tax_amount: string;
      net_amount: string;
    },
  >(row: Row) {
    return {
      ...row,
      prepaid_amount: Number(row.prepaid_amount),
      adjustment_amount: Number(row.adjustment_amount),
      taxable_income: Number(row.taxable_income),
      tax_amount: Number(row.tax_amount),
      net_amount: Number(row.net_amount),
    };
  }
}

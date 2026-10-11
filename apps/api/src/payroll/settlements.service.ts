import { Injectable } from '@nestjs/common';
import type { ReceiptMethod, SchoolYearDatabase, SettlementLine } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { SchoolCalendar } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { PaymentsService } from '../finance/payments.service.js';
import { ReceiptsService } from '../finance/receipts.service.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import { monthRange, StaffAttendanceService } from '../staff-attendance/staff-attendance.service.js';
import { TimesheetsService } from '../staff-attendance/timesheets.service.js';
import { calculatePayslip, progressiveTax, type PayItemAssignment } from './payroll-calculation.js';
import { PayrollService } from './payroll.service.js';

// Bảng quyết toán khi chấm dứt hợp đồng (BR-90, Q-156, CTC-P08-040, CTC-P08-041), phiếu thu thu hồi lương không gắn trẻ
// (CTC-P08-042) và phiếu chi lương từ bảng lương hoặc bảng quyết toán đã duyệt (CTC-P08-039, CTC-P06-034; YCTD-61).
// Lương được hưởng của tháng nghỉ việc tính theo công từ ngày 1 đến ngày chấm dứt; so với phần đã trả trước của tháng đó:
// dương là trả thêm bằng phiếu chi lương, âm là khoản phải thu hồi bằng phiếu thu
const ACTIVE_RECEIPT_STATUSES = ['issued', 'pending_reversal'] as const;
const ACTIVE_PAYMENT_STATUSES = ['draft', 'pending', 'issued', 'pending_reversal'] as const;

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    private readonly attendance: StaffAttendanceService,
    private readonly timesheets: TimesheetsService,
    private readonly settings: SettingsService,
    private readonly payroll: PayrollService,
    private readonly payments: PaymentsService,
    private readonly receipts: ReceiptsService,
    private readonly clock: Clock,
  ) {}

  // Hợp đồng đã chấm dứt kèm bảng quyết toán nếu đã lập, trong phạm vi người xem bảng lương
  async list(currentUser: CurrentUser) {
    const scope = await this.viewScope(currentUser);
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('employment_contracts')
      .innerJoin('staff', 'staff.id', 'employment_contracts.staff_id')
      .leftJoin('payroll_settlements', 'payroll_settlements.contract_id', 'employment_contracts.id')
      .select([
        'employment_contracts.id as contract_id',
        'employment_contracts.contract_no',
        'employment_contracts.terminated_on',
        'staff.id as staff_id',
        'staff.full_name',
        'staff.org_unit_id',
        'payroll_settlements.id as settlement_id',
        'payroll_settlements.status',
        'payroll_settlements.payable_amount',
      ])
      .where('employment_contracts.status', '=', 'terminated')
      .orderBy('employment_contracts.terminated_on', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('staff.org_unit_id', 'in', scope.orgUnitIds);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      ...row,
      payable_amount: row.payable_amount === null ? null : Number(row.payable_amount),
    }));
  }

  async read(currentUser: CurrentUser, settlementId: string) {
    const scope = await this.viewScope(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const settlement = await database
      .selectFrom('payroll_settlements')
      .innerJoin('staff', 'staff.id', 'payroll_settlements.staff_id')
      .innerJoin('employment_contracts', 'employment_contracts.id', 'payroll_settlements.contract_id')
      .selectAll('payroll_settlements')
      .select(['staff.full_name', 'staff.org_unit_id', 'employment_contracts.contract_no'])
      .where('payroll_settlements.id', '=', settlementId)
      .executeTakeFirst();
    if (!settlement || (!scope.wholeSchool && !scope.orgUnitIds.includes(settlement.org_unit_id))) {
      throw notFoundError('Không tìm thấy bảng quyết toán', 'payroll_settlement');
    }
    const receipts = await database
      .selectFrom('receipts')
      .select(['id', 'code', 'amount', 'status', 'receipt_date'])
      .where('settlement_id', '=', settlementId)
      .orderBy('created_at')
      .execute();
    const payments = await database
      .selectFrom('payments')
      .select(['id', 'code', 'amount', 'status'])
      .where('settlement_id', '=', settlementId)
      .orderBy('created_at')
      .execute();
    const payable = Number(settlement.payable_amount);
    const recovered = receipts
      .filter((row) => (ACTIVE_RECEIPT_STATUSES as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      ...settlement,
      earned_amount: Number(settlement.earned_amount),
      prepaid_amount: Number(settlement.prepaid_amount),
      tax_difference: Number(settlement.tax_difference),
      payable_amount: payable,
      recovery_outstanding: settlement.status === 'approved' && payable < 0 ? -payable - recovered : 0,
      receipts: receipts.map((row) => ({ ...row, amount: Number(row.amount) })),
      payments: payments.map((row) => ({ ...row, amount: Number(row.amount) })),
      can_manage: currentUser.hasPermission(PERMISSION_CODES.payrollManage),
      can_approve: await this.payroll.canApprove(currentUser, settlement.requires_principal),
    };
  }

  // Lập hoặc tính lại bảng quyết toán còn nháp của một hợp đồng đã chấm dứt
  async calculate(currentUser: CurrentUser, contractId: string, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán được lập bảng quyết toán');
    }
    const { database } = await this.currentSchoolYear.require();
    const contract = await database
      .selectFrom('employment_contracts')
      .innerJoin('staff', 'staff.id', 'employment_contracts.staff_id')
      .select([
        'employment_contracts.id',
        'employment_contracts.contract_no',
        'employment_contracts.base_salary',
        'employment_contracts.allowances',
        'employment_contracts.status',
        'employment_contracts.terminated_on',
        'staff.id as staff_id',
        'staff.org_unit_id',
        'staff.full_name',
        'staff.start_date',
        'staff.dependents_count',
      ])
      .where('employment_contracts.id', '=', contractId)
      .executeTakeFirst();
    if (!contract) {
      throw notFoundError('Không tìm thấy hợp đồng', 'employment_contract');
    }
    if (contract.status !== 'terminated' || !contract.terminated_on) {
      throw ruleViolationError('BR-90', 'Chỉ lập bảng quyết toán cho hợp đồng đã chấm dứt');
    }
    const existing = await database
      .selectFrom('payroll_settlements')
      .select(['id', 'status'])
      .where('contract_id', '=', contractId)
      .executeTakeFirst();
    if (existing && existing.status !== 'draft') {
      throw ruleViolationError('BR-45', 'Bảng quyết toán đã trình duyệt hoặc đã duyệt, không tính lại được');
    }
    const computed = await this.compute(database, contract);
    const requiresPrincipal = await this.payroll.requiresPrincipal(database, computed.payable);
    const settlementId = await database.transaction().execute(async (transaction) => {
      const values = {
        terminated_on: contract.terminated_on as string,
        earned_amount: computed.earned,
        prepaid_amount: computed.prepaid,
        tax_difference: computed.taxDifference,
        payable_amount: computed.payable,
        lines: JSON.stringify(computed.lines),
        requires_principal: requiresPrincipal,
        calculated_by: origin.actorUserId,
        calculated_at: this.clock.now(),
        return_reason: null,
      };
      const saved = existing
        ? await transaction
            .updateTable('payroll_settlements')
            .set({ ...values, updated_at: this.clock.now() })
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('payroll_settlements')
            .values({ ...values, staff_id: contract.staff_id, contract_id: contractId })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: contract.org_unit_id,
        entityName: 'payroll_settlements',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ? { status: 'draft' } : null,
        after: { earned: computed.earned, prepaid: computed.prepaid, payable: computed.payable },
      });
      return saved.id;
    });
    return this.read(currentUser, settlementId);
  }

  async submit(currentUser: CurrentUser, settlementId: string, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán được trình bảng quyết toán');
    }
    const { database } = await this.currentSchoolYear.require();
    const settlement = await this.load(database, settlementId);
    if (settlement.status !== 'draft') {
      throw ruleViolationError('BR-77', 'Bảng quyết toán này không còn nháp');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payroll_settlements')
        .set({ status: 'pending', updated_at: this.clock.now() })
        .where('id', '=', settlementId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payroll_settlements',
        entityId: settlementId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'pending' },
      });
      const root = await this.payroll.root(transaction);
      if (root) {
        await queueNotification(transaction, {
          orgUnitId: root.id,
          templateCode: 'payroll_settlement_submitted',
          title: 'Bảng quyết toán cần phê duyệt',
          body: `Bảng quyết toán khi nghỉ việc: ${Number(settlement.payable_amount).toLocaleString('vi-VN')} đồng`,
          targetType: 'payroll_settlements',
          targetId: settlementId,
          recipients: [
            ...(settlement.requires_principal
              ? []
              : [{ roleCode: 'VT-15', orgUnitId: root.id, channel: 'in_app' as const }]),
            { roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' },
          ],
        });
      }
    });
    return this.read(currentUser, settlementId);
  }

  async decide(
    currentUser: CurrentUser,
    settlementId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const settlement = await this.load(database, settlementId);
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollApprove)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt bảng quyết toán');
    }
    if (settlement.status !== 'pending') {
      throw ruleViolationError('BR-77', 'Bảng quyết toán này không chờ duyệt');
    }
    if (!(await this.payroll.canApprove(currentUser, settlement.requires_principal))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bảng quyết toán từ hạn mức trở lên cần Hiệu trưởng duyệt');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payroll_settlements')
        .set(
          decision.approve
            ? {
                status: 'approved',
                approved_by: origin.actorUserId,
                approved_at: this.clock.now(),
                updated_at: this.clock.now(),
              }
            : { status: 'draft', return_reason: decision.reason, updated_at: this.clock.now() },
        )
        .where('id', '=', settlementId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payroll_settlements',
        entityId: settlementId,
        action: 'update',
        before: { status: 'pending' },
        after: decision.approve ? { status: 'approved' } : { status: 'draft', return_reason: decision.reason },
      });
      if (settlement.calculated_by) {
        await queueNotification(transaction, {
          orgUnitId: null,
          templateCode: decision.approve ? 'payroll_settlement_approved' : 'payroll_settlement_returned',
          title: decision.approve ? 'Bảng quyết toán đã duyệt' : 'Bảng quyết toán bị trả lại',
          body: decision.reason ?? 'Lập phiếu chi hoặc phiếu thu theo kết quả quyết toán',
          targetType: 'payroll_settlements',
          targetId: settlementId,
          recipients: [{ userId: settlement.calculated_by, channel: 'in_app' }],
        });
      }
    });
    return this.read(currentUser, settlementId);
  }

  // Phiếu thu thu hồi lương: số tiền không vượt khoản còn phải thu hồi (CTC-P08-042)
  async recover(
    currentUser: CurrentUser,
    settlementId: string,
    input: {
      amount: number;
      method: ReceiptMethod;
      accountId: string;
      categoryId: string;
      receiptDate: string;
      content: string | null;
      requestKey: string;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const repeated = await database
      .selectFrom('receipts')
      .select('id')
      .where('request_key', '=', input.requestKey)
      .executeTakeFirst();
    if (repeated) {
      return this.read(currentUser, settlementId);
    }
    const detail = await this.read(currentUser, settlementId);
    if (detail.status !== 'approved') {
      throw ruleViolationError('BR-90', 'Bảng quyết toán chưa được duyệt');
    }
    if (input.amount > detail.recovery_outstanding) {
      throw ruleViolationError('BR-90', `Số tiền vượt khoản còn phải thu hồi (${detail.recovery_outstanding})`);
    }
    const account = await database
      .selectFrom('cash_accounts')
      .select(['id', 'org_unit_id', 'status', 'account_type'])
      .where('id', '=', input.accountId)
      .executeTakeFirst();
    if (!account || account.status !== 'active') {
      throw validationError([{ field: 'account_id', message: 'Quỹ hoặc tài khoản không tồn tại hoặc đã ngừng dùng' }]);
    }
    await this.assertReceiptScope(currentUser, account.org_unit_id);
    if (input.method === 'cash' ? account.account_type !== 'cash' : account.account_type === 'cash') {
      throw validationError([{ field: 'account_id', message: 'Hình thức thu không khớp loại quỹ hoặc tài khoản' }]);
    }
    const category = await database
      .selectFrom('cashflow_categories')
      .select(['flow_type', 'status'])
      .where('id', '=', input.categoryId)
      .executeTakeFirst();
    if (!category || category.status !== 'active' || category.flow_type !== 'income') {
      throw validationError([{ field: 'category_id', message: 'Khoản mục phải là khoản mục thu đang dùng' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .selectFrom('payroll_settlements')
        .select('id')
        .where('id', '=', settlementId)
        .forUpdate()
        .execute();
      await this.receipts.issueRecoveryInTransaction(
        transaction,
        {
          staffId: detail.staff_id,
          staffName: detail.full_name,
          settlementId,
          account,
          categoryId: input.categoryId,
          amount: input.amount,
          method: input.method,
          receiptDate: input.receiptDate,
          content: input.content,
          requestKey: input.requestKey,
        },
        origin,
      );
    });
    return this.read(currentUser, settlementId);
  }

  // Phiếu chi lương nháp từ bảng lương đã duyệt; sau đó đính chứng từ và trình duyệt như phiếu chi thường (QT-05)
  async createPayrollPayment(
    currentUser: CurrentUser,
    payrollId: string,
    input: { accountId: string; categoryId: string; requestKey: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const payroll = await database.selectFrom('payrolls').selectAll().where('id', '=', payrollId).executeTakeFirst();
    if (!payroll) {
      throw notFoundError('Không tìm thấy bảng lương', 'payroll');
    }
    if (payroll.status !== 'approved') {
      throw ruleViolationError('BR-77', 'Bảng lương chưa được duyệt');
    }
    await this.assertNoActivePayment(database, 'payroll_id', payrollId);
    const root = await this.payroll.root(database);
    if (!root) {
      throw ruleViolationError('BR-01', 'Chưa có Trường chính');
    }
    return this.payments.create(
      currentUser,
      {
        paymentType: 'payroll',
        childId: null,
        payeeName: 'Nhân sự toàn trường',
        amount: Number(payroll.total_net),
        content: `Chi lương tháng ${payroll.period_month}/${payroll.period_year}`,
        accountId: input.accountId,
        categoryId: input.categoryId,
        fileIds: [],
        orgUnitId: root.id,
        requestKey: input.requestKey,
      },
      origin,
      { payrollId },
    );
  }

  async createSettlementPayment(
    currentUser: CurrentUser,
    settlementId: string,
    input: { accountId: string; categoryId: string; requestKey: string },
    origin: ChangeOrigin,
  ) {
    const detail = await this.read(currentUser, settlementId);
    if (detail.status !== 'approved') {
      throw ruleViolationError('BR-90', 'Bảng quyết toán chưa được duyệt');
    }
    if (detail.payable_amount <= 0) {
      throw ruleViolationError('BR-90', 'Bảng quyết toán không có khoản phải trả thêm');
    }
    const { database } = await this.currentSchoolYear.require();
    await this.assertNoActivePayment(database, 'settlement_id', settlementId);
    const root = await this.payroll.root(database);
    if (!root) {
      throw ruleViolationError('BR-01', 'Chưa có Trường chính');
    }
    return this.payments.create(
      currentUser,
      {
        paymentType: 'payroll',
        childId: null,
        payeeName: detail.full_name,
        amount: detail.payable_amount,
        content: `Chi quyết toán lương hợp đồng ${detail.contract_no}`,
        accountId: input.accountId,
        categoryId: input.categoryId,
        fileIds: [],
        orgUnitId: root.id,
        requestKey: input.requestKey,
      },
      origin,
      { settlementId },
    );
  }

  private async compute(
    database: Kysely<SchoolYearDatabase>,
    contract: {
      id: string;
      contract_no: string;
      base_salary: string;
      allowances: Array<{ name: string; amount: number }>;
      terminated_on: string | null;
      staff_id: string;
      org_unit_id: string;
      start_date: string;
      dependents_count: number;
    },
  ) {
    const terminatedOn = contract.terminated_on as string;
    const month = terminatedOn.slice(0, 7);
    const { from, to } = monthRange(month);
    const startOfWork = contract.start_date > from ? contract.start_date : from;
    const hours = await this.attendance.workHours(contract.org_unit_id);
    if (hours.startMinutes === null || hours.endMinutes === null) {
      throw ruleViolationError('BR-39', 'Đơn vị chưa cấu hình giờ vào làm và giờ tan làm của nhân sự');
    }
    const pending = await database
      .selectFrom('leave_requests')
      .select('id')
      .where('staff_id', '=', contract.staff_id)
      .where('status', '=', 'pending')
      .where('from_date', '<=', terminatedOn)
      .where('to_date', '>=', from)
      .executeTakeFirst();
    if (pending) {
      throw ruleViolationError('BR-40', 'Còn đơn nghỉ chờ duyệt trong tháng nghỉ việc, xử lý xong mới quyết toán được');
    }
    const days = (await this.timesheets.buildDays(database, contract.org_unit_id, from, terminatedOn, hours)).filter(
      (day) => day.staff_id === contract.staff_id && day.work_date >= startOfWork,
    );
    const standardDays = [...(await this.calendar.staffDays(from, to)).values()].filter(
      (day) => day.kind === 'work',
    ).length;
    if (standardDays === 0) {
      throw ruleViolationError('BR-43', 'Tháng nghỉ việc không có ngày làm việc theo lịch');
    }
    const workdayRows = days.filter((day) => ['present', 'leave', 'absent'].includes(day.status));
    const unpaidDays = days.reduce((sum, day) => sum + day.unpaid_days, 0);
    const workedDays = days.filter((day) => day.status === 'present').reduce((sum, day) => sum + 1 - day.leave_days, 0);
    const overtimeMinutes = days.reduce((sum, day) => sum + day.overtime_minutes, 0);
    const paidDays = workdayRows.length - unpaidDays;
    const base = Number(contract.base_salary);
    const ratio = paidDays / standardDays;
    const label = `tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;
    const money = (value: number) => value.toLocaleString('vi-VN');
    const lines: Array<SettlementLine & { tax_exempt: boolean; mandatory_insurance: boolean; deduction: boolean }> = [];
    const plain = { tax_exempt: false, mandatory_insurance: false, deduction: false };
    const earnedBase = Math.round(base * ratio);
    lines.push({
      code: 'LUONG_THANG_NGHI',
      name: `Lương ${label} đến ngày ${terminatedOn}`,
      amount: earnedBase,
      basis: `${money(base)} × ${paidDays} / ${standardDays} ngày công chuẩn`,
      ...plain,
    });
    for (const allowance of contract.allowances) {
      lines.push({
        code: 'PC_HD',
        name: allowance.name,
        amount: Math.round(allowance.amount * ratio),
        basis: `${money(allowance.amount)} × ${paidDays} / ${standardDays}`,
        ...plain,
      });
    }
    const items = await this.items(database, contract.staff_id);
    for (const item of items) {
      const sign = item.kind === 'allowance' ? 1 : -1;
      const flags = {
        tax_exempt: item.is_tax_exempt,
        mandatory_insurance: item.is_mandatory_insurance,
        deduction: item.kind === 'deduction',
      };
      if (item.calculation_method === 'fixed_monthly' && item.amount !== null) {
        lines.push({
          code: item.code,
          name: item.name,
          amount: sign * Math.round(item.amount * ratio),
          basis: `${money(item.amount)} × ${paidDays} / ${standardDays}`,
          ...flags,
        });
      } else if (item.calculation_method === 'percent_of_base' && item.rate_percent !== null) {
        lines.push({
          code: item.code,
          name: item.name,
          amount: sign * Math.round((earnedBase * item.rate_percent) / 100),
          basis: `${money(earnedBase)} × ${item.rate_percent}%`,
          ...flags,
        });
      } else if (item.calculation_method === 'per_workday' && item.amount !== null && workedDays > 0) {
        lines.push({
          code: item.code,
          name: item.name,
          amount: sign * Math.round(item.amount * workedDays),
          basis: `${money(item.amount)} × ${workedDays} ngày đi làm`,
          ...flags,
        });
      }
    }
    if (overtimeMinutes > 0) {
      const rate = (await this.settings.effective(contract.org_unit_id)).find(
        (item) => item.key === 'overtime_rate_percent',
      )?.value;
      if (typeof rate !== 'number') {
        throw ruleViolationError('BR-82', 'Đơn vị chưa cấu hình hệ số làm thêm giờ');
      }
      const standardMinutes = hours.endMinutes - hours.startMinutes - hours.lunchMinutes;
      lines.push({
        code: 'LAM_THEM',
        name: `Làm thêm giờ ${label}`,
        amount: Math.round((base * overtimeMinutes * rate) / (standardDays * standardMinutes * 100)),
        basis: `${money(base)} / ${standardDays} ngày / ${standardMinutes / 60} giờ × ${rate}% × ${overtimeMinutes / 60} giờ`,
        ...plain,
      });
    }

    // Phiếu lương của tháng nghỉ việc: phần trả trước đã nhận, thuế đã khấu trừ, điều chỉnh tháng trước đã trả
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    const payslip = await database
      .selectFrom('payslips')
      .innerJoin('payrolls', 'payrolls.id', 'payslips.payroll_id')
      .select(['payslips.id', 'payslips.prepaid_amount', 'payslips.tax_amount', 'payrolls.status'])
      .where('payrolls.period_year', '=', year)
      .where('payrolls.period_month', '=', monthNumber)
      .where('payslips.staff_id', '=', contract.staff_id)
      .executeTakeFirst();
    if (payslip && payslip.status !== 'approved') {
      throw ruleViolationError(
        'BR-90',
        `Bảng lương tháng ${monthNumber}/${year} có phiếu của nhân sự này nhưng chưa duyệt, xử lý bảng lương trước`,
      );
    }
    let previousIncome: Array<{
      amount: number;
      tax_exempt: boolean;
      mandatory_insurance: boolean;
      deduction: boolean;
    }> = [];
    if (payslip) {
      previousIncome = (
        await database
          .selectFrom('payslip_lines')
          .select(['amount', 'line_type', 'code'])
          .where('payslip_id', '=', payslip.id)
          .where('section', '=', 'adjustment')
          .execute()
      ).map((line) => ({
        amount: Number(line.amount),
        tax_exempt: items.some((item) => item.code === line.code && item.is_tax_exempt),
        mandatory_insurance: items.some((item) => item.code === line.code && item.is_mandatory_insurance),
        deduction: line.line_type === 'deduction',
      }));
    } else {
      // Chưa có phiếu lương tháng nghỉ việc: điều chỉnh theo công tháng trước tính luôn trong bảng quyết toán
      const lastMonth = previousMonth(month);
      const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number) as [number, number];
      const lastDays = await database
        .selectFrom('timesheet_days')
        .innerJoin('timesheet_periods', 'timesheet_periods.id', 'timesheet_days.period_id')
        .select([
          'timesheet_days.status',
          'timesheet_days.leave_days',
          'timesheet_days.unpaid_days',
          'timesheet_days.overtime_minutes',
        ])
        .where('timesheet_days.staff_id', '=', contract.staff_id)
        .where('timesheet_periods.period_year', '=', lastYear)
        .where('timesheet_periods.period_month', '=', lastMonthNumber)
        .where('timesheet_periods.status', '=', 'closed')
        .execute();
      if (lastDays.length > 0) {
        const last = monthRange(lastMonth);
        const lastStandard = [...(await this.calendar.staffDays(last.from, last.to)).values()].filter(
          (day) => day.kind === 'work',
        ).length;
        const rate = (await this.settings.effective(contract.org_unit_id)).find(
          (item) => item.key === 'overtime_rate_percent',
        )?.value;
        const result = calculatePayslip({
          prepaid: null,
          adjustment: {
            contractNo: contract.contract_no,
            baseSalary: base,
            prepaidLastMonth: contract.start_date <= last.from,
            standardDays: lastStandard,
            standardMinutes: hours.endMinutes - hours.startMinutes - hours.lunchMinutes,
            overtimeRatePercent: typeof rate === 'number' ? rate : null,
            totals: {
              workdayRows: lastDays.filter((day) => ['present', 'leave', 'absent'].includes(day.status)).length,
              unpaidDays: lastDays.reduce((sum, day) => sum + Number(day.unpaid_days), 0),
              workedDays: lastDays
                .filter((day) => day.status === 'present')
                .reduce((sum, day) => sum + 1 - Number(day.leave_days), 0),
              overtimeMinutes: lastDays.reduce((sum, day) => sum + day.overtime_minutes, 0),
            },
            month: lastMonth,
          },
          items,
          dependents: 0,
          taxTable: { personal_deduction: 0, dependent_deduction: 0, brackets: [] },
        });
        for (const line of result.lines.filter((item) => item.section === 'adjustment')) {
          lines.push({
            code: line.code,
            name: line.name,
            amount: line.amount,
            basis: line.basis,
            tax_exempt: line.tax_exempt,
            mandatory_insurance: line.mandatory_insurance,
            deduction: line.line_type === 'deduction',
          });
        }
      }
    }

    const taxTable = await database
      .selectFrom('tax_tables')
      .selectAll()
      .where('effective_from', '<=', from)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();
    if (!taxTable) {
      throw ruleViolationError('BR-44', 'Chưa có biểu thuế hiệu lực cho tháng nghỉ việc');
    }
    const all = [...lines, ...previousIncome];
    const income = all.filter((line) => !line.deduction).reduce((sum, line) => sum + line.amount, 0);
    const exempt = all.filter((line) => line.tax_exempt).reduce((sum, line) => sum + line.amount, 0);
    const insurance = all.filter((line) => line.mandatory_insurance).reduce((sum, line) => sum - line.amount, 0);
    const family =
      Number(taxTable.personal_deduction) + contract.dependents_count * Number(taxTable.dependent_deduction);
    const taxDue = progressiveTax(Math.max(0, income - exempt - insurance - family), taxTable.brackets);
    const taxDifference = taxDue - (payslip ? Number(payslip.tax_amount) : 0);
    const earned = lines.reduce((sum, line) => sum + line.amount, 0);
    const prepaid = payslip ? Number(payslip.prepaid_amount) : 0;
    return {
      lines: lines.map(({ code, name, amount, basis }) => ({ code, name, amount, basis })),
      earned,
      prepaid,
      taxDifference,
      payable: earned - prepaid - taxDifference,
    };
  }

  private async items(database: Kysely<SchoolYearDatabase>, staffId: string): Promise<PayItemAssignment[]> {
    const rows = await database
      .selectFrom('staff_pay_items')
      .innerJoin('pay_item_types', 'pay_item_types.id', 'staff_pay_items.pay_item_type_id')
      .select([
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
      .where('staff_pay_items.staff_id', '=', staffId)
      .where('pay_item_types.status', '=', 'active')
      .execute();
    return rows.map((item) => ({
      kind: item.kind,
      code: item.code,
      name: item.name,
      calculation_method: item.calculation_method,
      amount:
        item.amount !== null ? Number(item.amount) : item.default_amount !== null ? Number(item.default_amount) : null,
      rate_percent:
        item.rate_percent !== null
          ? Number(item.rate_percent)
          : item.default_rate_percent !== null
            ? Number(item.default_rate_percent)
            : null,
      is_tax_exempt: item.is_tax_exempt,
      is_mandatory_insurance: item.is_mandatory_insurance,
    }));
  }

  private async assertNoActivePayment(
    database: Kysely<SchoolYearDatabase>,
    column: 'payroll_id' | 'settlement_id',
    id: string,
  ) {
    const existing = await database
      .selectFrom('payments')
      .select('code')
      .where(column, '=', id)
      .where('status', 'in', ACTIVE_PAYMENT_STATUSES)
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError('BR-77', `Đã có phiếu chi lương ${existing.code ?? 'nháp'} cho chứng từ này`);
    }
  }

  private async assertReceiptScope(currentUser: CurrentUser, orgUnitId: string) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.receiptManage);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập phiếu thu vào quỹ hoặc tài khoản này');
    }
  }

  private async viewScope(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.payrollView);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem bảng quyết toán');
    }
    return scope;
  }

  private async load(database: Kysely<SchoolYearDatabase>, settlementId: string) {
    const settlement = await database
      .selectFrom('payroll_settlements')
      .selectAll()
      .where('id', '=', settlementId)
      .executeTakeFirst();
    if (!settlement) {
      throw notFoundError('Không tìm thấy bảng quyết toán', 'payroll_settlement');
    }
    return settlement;
  }
}

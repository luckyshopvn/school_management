import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { PayrollService } from './payroll.service.js';

// Khoản điều chỉnh lương cho kỳ sau (BR-45, YCTD-61): bảng lương đã duyệt không sửa trực tiếp; sai thì kế toán lập khoản
// điều chỉnh có lý do cho tháng chưa trình duyệt, Ban Giám hiệu duyệt theo hạn mức bảng lương của Trường chính; khoản
// đã duyệt được cộng hoặc trừ vào bảng lương của tháng đó khi tính
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAXIMUM_REASON = 500;

@Injectable()
export class PayrollAdjustmentsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly payroll: PayrollService,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, status: 'pending' | 'approved' | 'rejected' | null) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollView)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem khoản điều chỉnh lương');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('payroll_adjustments')
      .innerJoin('staff', 'staff.id', 'payroll_adjustments.staff_id')
      .selectAll('payroll_adjustments')
      .select(['staff.full_name', 'staff.code'])
      .orderBy('payroll_adjustments.created_at', 'desc');
    if (status) {
      query = query.where('payroll_adjustments.status', '=', status);
    }
    const rows = await query.execute();
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        amount: Number(row.amount),
        can_decide: row.status === 'pending' && (await this.payroll.canApprove(currentUser, row.requires_principal)),
      })),
    );
  }

  async create(
    currentUser: CurrentUser,
    input: { staffId: string; month: string; amount: number; reason: string },
    origin: ChangeOrigin,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán được lập khoản điều chỉnh lương');
    }
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'full_name'])
      .where('id', '=', input.staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    const [year, month] = input.month.split('-').map(Number) as [number, number];
    await this.assertMonthOpen(year, month);
    const requiresPrincipal = await this.payroll.requiresPrincipal(database, input.amount);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('payroll_adjustments')
        .values({
          staff_id: input.staffId,
          target_year: year,
          target_month: month,
          amount: input.amount,
          reason: input.reason,
          requires_principal: requiresPrincipal,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payroll_adjustments',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, requires_principal: requiresPrincipal },
      });
      const root = await this.payroll.root(transaction);
      if (root) {
        await queueNotification(transaction, {
          orgUnitId: root.id,
          templateCode: 'payroll_adjustment_submitted',
          title: 'Khoản điều chỉnh lương cần duyệt',
          body: `${staff.full_name}: ${input.amount.toLocaleString('vi-VN')} đồng vào lương tháng ${month}/${year}. ${input.reason}`,
          targetType: 'payroll_adjustments',
          targetId: row.id,
          recipients: [
            ...(requiresPrincipal ? [] : [{ roleCode: 'VT-15', orgUnitId: root.id, channel: 'in_app' as const }]),
            { roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' },
          ],
        });
      }
      return row;
    });
    return (await this.list(currentUser, null)).find((row) => row.id === created.id);
  }

  async decide(
    currentUser: CurrentUser,
    adjustmentId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const adjustment = await database
      .selectFrom('payroll_adjustments')
      .selectAll()
      .where('id', '=', adjustmentId)
      .executeTakeFirst();
    if (!adjustment) {
      throw notFoundError('Không tìm thấy khoản điều chỉnh lương', 'payroll_adjustment');
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.payrollApprove)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt khoản điều chỉnh lương');
    }
    if (adjustment.status !== 'pending') {
      throw ruleViolationError('BR-45', 'Khoản điều chỉnh này đã được xử lý');
    }
    if (!(await this.payroll.canApprove(currentUser, adjustment.requires_principal))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Khoản điều chỉnh từ hạn mức trở lên cần Hiệu trưởng duyệt');
    }
    if (adjustment.created_by === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập khoản điều chỉnh');
    }
    if (decision.approve) {
      await this.assertMonthOpen(adjustment.target_year, adjustment.target_month);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('payroll_adjustments')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          reject_reason: decision.reason,
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
        })
        .where('id', '=', adjustmentId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'payroll_adjustments',
        entityId: adjustmentId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: decision.approve ? 'approved' : 'rejected', reason: decision.reason },
      });
      await queueNotification(transaction, {
        orgUnitId: null,
        templateCode: decision.approve ? 'payroll_adjustment_approved' : 'payroll_adjustment_rejected',
        title: decision.approve ? 'Khoản điều chỉnh lương đã duyệt' : 'Khoản điều chỉnh lương bị từ chối',
        body: `Lương tháng ${adjustment.target_month}/${adjustment.target_year}${decision.reason ? `: ${decision.reason}` : ''}`,
        targetType: 'payroll_adjustments',
        targetId: adjustmentId,
        recipients: [{ userId: adjustment.created_by, channel: 'in_app' }],
      });
    });
    return (await this.list(currentUser, null)).find((row) => row.id === adjustmentId);
  }

  // Tháng nhận khoản điều chỉnh chưa có bảng lương đã trình hoặc đã duyệt
  private async assertMonthOpen(year: number, month: number) {
    const { database } = await this.currentSchoolYear.require();
    const payroll = await database
      .selectFrom('payrolls')
      .select('status')
      .where('period_year', '=', year)
      .where('period_month', '=', month)
      .executeTakeFirst();
    if (payroll && payroll.status !== 'draft') {
      throw ruleViolationError('BR-45', `Bảng lương tháng ${month}/${year} đã trình duyệt, chọn tháng sau`);
    }
  }
}

@Controller()
export class PayrollAdjustmentsController {
  constructor(private readonly adjustments: PayrollAdjustmentsService) {}

  @Get('payroll-adjustments')
  list(@Query('status') status: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const parsed = readEnum({ status }, 'status', ['pending', 'approved', 'rejected'] as const, errors, false) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.adjustments.list(currentUser, parsed);
  }

  @Post('payroll-adjustments')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffId = readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự');
    const month = body?.month;
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
    }
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000_000) {
      errors.push({ field: 'amount', message: 'Số tiền là số nguyên đồng khác 0; âm là trừ, dương là cộng' });
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > MAXIMUM_REASON) {
      errors.push({ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_REASON} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.adjustments.create(
      currentUser,
      { staffId, month: month as string, amount: amount as number, reason },
      originOf(request, currentUser),
    );
  }

  @Post('payroll-adjustments/:id/approve')
  approve(
    @Param('id', uuidParameter('Mã khoản điều chỉnh không hợp lệ')) adjustmentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.adjustments.decide(
      currentUser,
      adjustmentId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('payroll-adjustments/:id/reject')
  reject(
    @Param('id', uuidParameter('Mã khoản điều chỉnh không hợp lệ')) adjustmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > MAXIMUM_REASON) {
      throw validationError([{ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_REASON} ký tự` }]);
    }
    return this.adjustments.decide(
      currentUser,
      adjustmentId,
      { approve: false, reason },
      originOf(request, currentUser),
    );
  }
}

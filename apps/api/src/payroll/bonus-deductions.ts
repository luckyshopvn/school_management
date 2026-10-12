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
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Lương thưởng và khấu trừ theo tháng (P08-07; BR-44, BR-45; YCTD-81). Kế toán, kế toán trưởng ghi khoản thưởng (loại
// phụ cấp, thưởng của danh mục lương) hoặc khoản khấu trừ khác cho một nhân sự vào bảng lương của một tháng, bắt buộc
// ghi căn cứ (BR-44). Khoản đang hiệu lực được cộng hoặc trừ vào phiếu lương khi tính bảng lương của tháng đó; tháng đã
// trình duyệt hoặc đã duyệt bảng lương thì không ghi, không hủy được nữa mà lập khoản điều chỉnh cho kỳ sau (BR-45)
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAXIMUM_TEXT = 500;
const MAXIMUM_AMOUNT = 10_000_000_000;

@Injectable()
export class BonusDeductionsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, filter: { month: string | null; staffId: string | null }) {
    if (
      !currentUser.hasPermission(PERMISSION_CODES.bonusDeductionManage) &&
      !currentUser.hasPermission(PERMISSION_CODES.payrollView)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem khoản thưởng và khấu trừ');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('staff_bonus_deductions')
      .innerJoin('staff', 'staff.id', 'staff_bonus_deductions.staff_id')
      .innerJoin('pay_item_types', 'pay_item_types.id', 'staff_bonus_deductions.pay_item_type_id')
      .selectAll('staff_bonus_deductions')
      .select([
        'staff.full_name',
        'staff.code as staff_code',
        'pay_item_types.kind',
        'pay_item_types.code as item_code',
        'pay_item_types.name as item_name',
      ])
      .orderBy('staff_bonus_deductions.target_year', 'desc')
      .orderBy('staff_bonus_deductions.target_month', 'desc')
      .orderBy('staff.full_name');
    if (filter.month) {
      const [year, month] = filter.month.split('-').map(Number) as [number, number];
      query = query
        .where('staff_bonus_deductions.target_year', '=', year)
        .where('staff_bonus_deductions.target_month', '=', month);
    }
    if (filter.staffId) {
      query = query.where('staff_bonus_deductions.staff_id', '=', filter.staffId);
    }
    const rows = await query.execute();
    const locked = await this.lockedMonths();
    const canManage = currentUser.hasPermission(PERMISSION_CODES.bonusDeductionManage);
    return rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      can_cancel: canManage && row.status === 'active' && !locked.has(`${row.target_year}-${row.target_month}`),
    }));
  }

  async create(
    currentUser: CurrentUser,
    input: { staffId: string; payItemTypeId: string; month: string; amount: number; basis: string },
    origin: ChangeOrigin,
  ) {
    this.assertManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'full_name', 'status', 'org_unit_id'])
      .where('id', '=', input.staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    if (staff.status !== 'active') {
      throw ruleViolationError('BR-90', `${staff.full_name} đã chấm dứt hợp đồng, ghi vào bảng quyết toán`);
    }
    const itemType = await database
      .selectFrom('pay_item_types')
      .select(['id', 'kind', 'name', 'status'])
      .where('id', '=', input.payItemTypeId)
      .executeTakeFirst();
    if (!itemType || itemType.status !== 'active') {
      throw validationError([{ field: 'pay_item_type_id', message: 'Loại thưởng hoặc khấu trừ phải đang dùng' }]);
    }
    const [year, month] = input.month.split('-').map(Number) as [number, number];
    await this.assertMonthOpen(year, month);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('staff_bonus_deductions')
        .values({
          staff_id: input.staffId,
          pay_item_type_id: input.payItemTypeId,
          target_year: year,
          target_month: month,
          amount: input.amount,
          basis: input.basis,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff_bonus_deductions',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, kind: itemType.kind },
      });
      return row;
    });
    return (await this.list(currentUser, { month: input.month, staffId: input.staffId })).find(
      (row) => row.id === created.id,
    );
  }

  async cancel(currentUser: CurrentUser, id: string, reason: string, origin: ChangeOrigin) {
    this.assertManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const row = await database.selectFrom('staff_bonus_deductions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy khoản thưởng hoặc khấu trừ', 'staff_bonus_deduction');
    }
    if (row.status !== 'active') {
      throw ruleViolationError('BR-45', 'Khoản này đã hủy');
    }
    await this.assertMonthOpen(row.target_year, row.target_month);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff_bonus_deductions')
        .set({
          status: 'cancelled',
          cancelled_by: origin.actorUserId,
          cancelled_at: this.clock.now(),
          cancel_reason: reason,
        })
        .where('id', '=', id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'staff_bonus_deductions',
        entityId: id,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'cancelled', reason },
      });
    });
    const month = `${row.target_year}-${String(row.target_month).padStart(2, '0')}`;
    return (await this.list(currentUser, { month, staffId: row.staff_id })).find((item) => item.id === id);
  }

  private assertManager(currentUser: CurrentUser) {
    if (!currentUser.hasPermission(PERMISSION_CODES.bonusDeductionManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ kế toán, kế toán trưởng được ghi thưởng và khấu trừ');
    }
  }

  // Bảng lương của tháng đã trình duyệt hoặc đã duyệt thì khóa (BR-45)
  private async assertMonthOpen(year: number, month: number) {
    if ((await this.lockedMonths()).has(`${year}-${month}`)) {
      throw ruleViolationError(
        'BR-45',
        `Bảng lương tháng ${month}/${year} đã trình duyệt hoặc đã duyệt; lập khoản điều chỉnh cho kỳ sau`,
      );
    }
  }

  private async lockedMonths(): Promise<Set<string>> {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('payrolls')
      .select(['period_year', 'period_month'])
      .where('status', '!=', 'draft')
      .execute();
    return new Set(rows.map((row) => `${row.period_year}-${row.period_month}`));
  }
}

@Controller()
export class BonusDeductionsController {
  constructor(private readonly bonusDeductions: BonusDeductionsService) {}

  @Get('bonus-deductions')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.month !== undefined && !MONTH_PATTERN.test(query.month)) {
      errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
    }
    if (query.staff_id !== undefined && !isUuid(query.staff_id)) {
      errors.push({ field: 'staff_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.bonusDeductions.list(currentUser, { month: query.month ?? null, staffId: query.staff_id ?? null });
  }

  @Post('bonus-deductions')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffId = readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự');
    const payItemTypeId = readRequiredUuid(body, 'pay_item_type_id', errors, 'Bắt buộc chọn loại thưởng hoặc khấu trừ');
    const month = body?.month;
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      errors.push({ field: 'month', message: 'Tháng theo dạng YYYY-MM' });
    }
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAXIMUM_AMOUNT) {
      errors.push({ field: 'amount', message: 'Số tiền là số nguyên đồng lớn hơn 0' });
    }
    const basis = typeof body?.basis === 'string' ? body.basis.trim() : '';
    if (!basis || basis.length > MAXIMUM_TEXT) {
      errors.push({ field: 'basis', message: `Bắt buộc ghi căn cứ, tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.bonusDeductions.create(
      currentUser,
      { staffId, payItemTypeId, month: month as string, amount: amount as number, basis },
      originOf(request, currentUser),
    );
  }

  @Post('bonus-deductions/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter('Mã khoản không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > MAXIMUM_TEXT) {
      throw validationError([{ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_TEXT} ký tự` }]);
    }
    return this.bonusDeductions.cancel(currentUser, id, reason, originOf(request, currentUser));
  }
}

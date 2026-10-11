import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { validationError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { PayrollService } from './payroll.service.js';

// Bảng lương toàn trường và phiếu lương (P08-06, P08-08; YCTD-60). Quyền kiểm tra ở tầng nghiệp vụ
const MAXIMUM_REASON = 500;

@Controller()
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('payrolls')
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.payroll.list(currentUser);
  }

  @Post('payrolls')
  calculate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const month = body?.month;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
    }
    return this.payroll.calculate(currentUser, month, originOf(request, currentUser));
  }

  @Get('payrolls/:id')
  read(
    @Param('id', uuidParameter('Mã bảng lương không hợp lệ')) payrollId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payroll.read(currentUser, payrollId);
  }

  @Post('payrolls/:id/submit')
  submit(
    @Param('id', uuidParameter('Mã bảng lương không hợp lệ')) payrollId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payroll.submit(currentUser, payrollId, originOf(request, currentUser));
  }

  @Post('payrolls/:id/approve')
  approve(
    @Param('id', uuidParameter('Mã bảng lương không hợp lệ')) payrollId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payroll.decide(currentUser, payrollId, { approve: true, reason: null }, originOf(request, currentUser));
  }

  @Post('payrolls/:id/return')
  returnToDraft(
    @Param('id', uuidParameter('Mã bảng lương không hợp lệ')) payrollId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > MAXIMUM_REASON) {
      throw validationError([{ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_REASON} ký tự` }]);
    }
    return this.payroll.decide(currentUser, payrollId, { approve: false, reason }, originOf(request, currentUser));
  }

  @Get('me/payslips')
  mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.payroll.mine(currentUser);
  }
}
